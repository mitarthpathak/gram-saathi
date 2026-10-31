# Workstreams

## Current status — 2026-10-31 (branch `feat/dialect-voice`)

Built on top of the conversation layer (PR #9, not yet merged): dialect-worded replies with a
deterministic facts lock and `answerStyle`, a facts guard on clarifications, server speech
(`POST /api/tts`) with `dialectId` and honest `basis` labels, the Listen button using server speech
with browser fallback and low-bandwidth respected, and the pipeline audit
(`npm run audit -w server`). All of it is tested with fake models only; nothing has run against the
real Gemini models, and the repo's own `npm install` / typecheck / lint / test / build were not run
on this branch (the agent's sandbox could not install packages). These statuses supersede the
historical step-2/step-3 checklist below where they conflict.

| Who    | What                                                                                          | Where                                              |
| ------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Owner  | Repo checks, real-mode health check, ingest, first real audit, model pinning                  | [RUNBOOK.md](RUNBOOK.md) steps 1–3, 8              |
| Owner  | Merge PR #9, then reconcile this branch with `main` (11 conflicting files, Listen path)       | [RUNBOOK.md](RUNBOOK.md#before-merging-into-main)  |
| Team   | Record consented real-speaker clips (10 per language/dialect) and exemplars (20+ per dialect) | `eval/audio/README.md`, `data/dialects/exemplars/` |
| Native | Rate `eval/review/dialect-review.csv`, audition voices, review `TODO(review-native)` strings  | [RUNBOOK.md](RUNBOOK.md) steps 5–6                 |
| Owner  | Set `"verified": true` per dialect only after that review                                     | `server/src/config/dialect-render.json`            |
| Owner  | Verify PMAY-G and eligibility rules; prewarm the FAQ; calibrate `RAG_MIN_SCORE`               | carried over from the conversation-layer job       |

Results and risks: [`FINAL_REPORT.md`](FINAL_REPORT.md). Open audit findings:
[`AUDIT_FINDINGS.md`](AUDIT_FINDINGS.md).

Four workstreams, each owning its own folders, so 3–4 people can work in parallel with few
merge conflicts. Everything already runs on mock data, so nobody waits for anybody: build your
part behind the mocks, then switch it on (`USE_MOCKS` takes a list of modules that stay mocked).

**Rules of thumb**

- Stay inside the folders your workstream owns. If you must touch someone else's file, keep the
  change tiny and ask the owner to review.
- The contract (`shared/src/types.ts` + `docs/API_CONTRACT.md`) changes only through a contract PR
  ([CONTRIBUTING.md](../CONTRIBUTING.md#the-api-contract-rule)).
- Small PRs into `main`, rebased first. Look for `TODO(step-2)` / `TODO(step-3)` in your folders.

## Ownership map

| Workstream                 | Branches                              | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Voice + Chat UI**     | `feature/voice-ui`, `feature/chat-ui` | `client/src/features/voice/`<br>`client/src/features/chat/`<br>`client/src/features/sources/`<br>`client/src/features/language/`<br>`client/src/mocks/query.ts`                                                                                                                                                                                                                                                                                                                                                           |
| **2. RAG backend**         | `feature/rag-backend`                 | `server/src/modules/chat/`, `voice/`, `rag/`, `tts/`<br>`server/src/lib/geminiClient.ts`, `server/src/lib/cache.ts`<br>`server/src/mocks/query.ts`, `server/scripts/`, `server/test/`<br>`data/schemes/`                                                                                                                                                                                                                                                                                                                  |
| **3. Eligibility + SMS**   | `feature/eligibility`, `feature/sms`  | `client/src/features/eligibility/`<br>`client/src/features/sms/` (except the two low-bandwidth files below)<br>`server/src/modules/eligibility/`, `server/src/modules/sms/`<br>`server/src/mocks/eligibility.ts`, `client/src/mocks/eligibility.ts`<br>`data/eligibility/`                                                                                                                                                                                                                                                |
| **4. PWA + Deploy + Demo** | `feature/sms-pwa`, `feature/deploy`   | `client/src/app/`, `client/src/components/ui/`, `client/src/lib/`<br>`client/public/`, `client/index.html`, `client/vite.config.ts`<br>`client/src/features/sms/LowBandwidthToggle.tsx`, `client/src/features/sms/OfflineFaqList.tsx`<br>`server/src/modules/faq/`, `server/src/mocks/faq.ts`, `client/src/mocks/faq.ts`, `data/faq/`<br>`server/src/{index,app}.ts`, `server/src/config/`, `server/src/middleware/`, the rest of `server/src/lib/`<br>root config files, `.github/`, `README.md`, `docs/ARCHITECTURE.md` |

**Shared files** (change together, ping the owners): `shared/src/*` and `docs/API_CONTRACT.md`
(contract PR only); `client/src/mocks/index.ts` (each workstream edits only its own handlers);
`client/src/lib/api.ts` (only in contract PRs).

## 1. Voice + Chat UI

The main screen: push-to-talk, transcript, answers with sources, fraud warning, text fallback.

Step 2

- [x] `useRecorder`: real recording with `getUserMedia` + `MediaRecorder` (`audio/webm;codecs=opus`,
      `audio/mp4` on Safari), clear messages for a blocked or missing mic, auto-send after 30 s,
      the mic is released after each question.
- [x] Recording feedback: timer and live level meter. Still open: vibration on start/stop.
- [x] Friendly messages for `NO_SPEECH_DETECTED`, `AI_*` and setup errors (`ChatProvider`).
- [x] Listen tries server `audioUrl` first and falls back to browser speech; no auto-read setting.
- [ ] Retry button on error bubbles; disable input while offline.
- [ ] Native speakers check every `strings.ts` in hi / mr / ta.

Step 3

- [ ] On-device speech recognition fallback (Web Speech API) when the network is slow.
- [ ] Polish: scroll-to-latest button, long-answer "read more", larger-text setting.

## 2. RAG backend

Everything behind `/api/chat/query`, `/api/voice/query` and `/api/tts`, plus the knowledge base.
Work with `USE_MOCKS=eligibility,sms,faq,tts` so only your modules run for real.

Step 2

- [x] `lib/geminiClient.ts` with `@google/genai`: structured JSON (`generateJson`) and batched
      embeddings (`embedTexts`), timeouts, retries with backoff, typed errors.
- [x] `voice`: speech-to-text + language detection in one Gemini call; dialects map to hi/mr/ta/en.
- [x] `rag`: `npm run ingest -w server` (section-first chunking, Gemini embeddings,
      `server/data/vectorstore.json`), in-memory cosine search, `RAG_MIN_SCORE` threshold.
- [x] `chat`: grounded prompt, JSON `{ answer, usedChunkIds }` mapped to `sources`, `notFound`
      when nothing is relevant, answer cache. Try it: `npm run query -w server -- "…"`.
- [x] Five more schemes in `data/schemes/` (APY, PMSBY, Ujjwala, MGNREGA, PMAY-G), as SAMPLES.
- [ ] Replace all seven SAMPLE documents with official text (`sample: false`, `verified: true`),
      then add PM Fasal Bima, Sukanya Samriddhi, PMJJBY and the NFSA ration card.
- [ ] With the real documents ingested, calibrate `RAG_MIN_SCORE` using the scores that
      `npm run query` prints (unrelated questions must fall below it).
- [x] Optional Gemini TTS with browser fallback; server-side language voice support still depends
      on configured model capability.

Step 3

- [ ] Vector DB for embeddings (replace the in-memory index).
- [ ] Semantic cache in `lib/cache.ts` (hit on paraphrases).
- [x] Conversation eval harness: 10 scheme question templates across each answer language plus
      10 non-scheme intent cases. Current language-specific input coverage needs native examples.

## 3. Eligibility + SMS

The eligibility wizard end to end and SMS compression.

Step 2

- [x] Eligibility questions and rules as data in `data/eligibility/`, evaluated by plain code
      with three-valued logic (questions that no longer matter are skipped); unit-tested.
      Gemini only translates missing texts and reads free-form answers.
- [ ] Verify the four SAMPLE rule files against the official guidelines (`"verified": true`).
- [x] Client: on `422 UNCLEAR_ANSWER` the wizard stays on the question and asks again.
- [ ] Client: answer wizard questions by voice and send the words as a free-form answer.
- [x] Results screen: "Ask about it" opens the chat with a question about that scheme.
- [x] `sms/compress` with Gemini: at most `SMS_MAX_SEGMENTS`, keeps amounts, URLs and helplines;
      falls back to whole sentences. "Rs" instead of "₹" in English (GSM-7).
- [ ] SMS screen: copy button, share via the phone's SMS app (`sms:?body=`).

Step 3

- [ ] More schemes in the wizard (one JSON file each in `data/eligibility/`).
- [ ] Optional: real SMS sending through a gateway (Indian numbers require DLT registration, so
      demo with a simulator).

## 4. PWA + Deploy + Demo

The app shell, offline / low-bandwidth behaviour, deployment and the demo itself.

Step 2

- [ ] HTTPS tunnel for phone testing (the mic needs https), e.g.
      `cloudflared tunnel --url http://localhost:5173`; add the tunnel host to `server.allowedHosts`
      in `vite.config.ts`.
- [ ] Deploy on Vercel: one project, `client` + `server` services from `vercel.json`
      ([DEPLOYMENT.md](DEPLOYMENT.md)). Set `USE_MOCKS=false` and `GEMINI_API_KEY`, commit
      `server/data/*.json` after `ingest` + `prewarm`.
- [ ] A second, frontend-only deploy with `VITE_USE_MOCKS=true` as the demo fallback.
- [x] FAQ: seed questions in `data/faq/questions.json`, answers pre-generated by
      `npm run prewarm -w server` into `server/data/faq.json`.
- [ ] Review the FAQ questions with the RAG workstream once real documents are in.

Step 3

- [ ] PWA: `vite-plugin-pwa`, manifest and icons, offline app shell, precache `/api/faq/top`.
- [ ] Low-bandwidth mode: smaller payloads, lazy-load screens, check bundle size.
- [ ] Demo script, seed questions per language, backup screen recording.

## Suggested 24-hour plan

| Hours | What                                                                                       |
| ----- | ------------------------------------------------------------------------------------------ |
| 0–1   | Everyone: `npm install`, `npm run dev`, read the docs, create your branch                  |
| 1–9   | Step 2 in parallel, each behind the mocks; small PRs into `main` as pieces work            |
| 9–11  | Integration: run `USE_MOCKS=false`, fix the seams, test on a real phone through the tunnel |
| 11–17 | Step 3 + deployment                                                                        |
| 17–21 | Polish, translation check with native speakers, accessibility pass, more scheme documents  |
| 21–24 | Feature freeze, demo rehearsal, backup recording, mock-mode fallback ready                 |

## Demo checklist

- [ ] Hold the mic and ask in Hindi → answer with sources and fraud warning, read aloud.
- [ ] Ask the same question in Tamil → Tamil answer; ask again → "saved answer" badge.
- [ ] Ask something not in the documents → "not in official documents" (no guessing).
- [ ] "View as SMS" → feature phone with segment count.
- [ ] Eligibility wizard → results with reasons.
- [ ] Turn on low-bandwidth mode, go offline → saved answers still work.
