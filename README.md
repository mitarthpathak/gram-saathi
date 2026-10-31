# Gram Saathi

A voice-first, multilingual assistant that answers questions about government schemes for rural
citizens: farmers, ASHA workers and panchayat offices. Ask by voice in **Hindi, Marathi, Tamil
or English**. You get a short answer in your language that is grounded in official scheme
documents, with source citations, a fraud warning, the answer read aloud, and an SMS-length
version for basic phones.

Also included: an **eligibility check** (3–4 questions tell you which schemes you may qualify
for), a **low-bandwidth mode** with answers saved for offline use, and an **SMS fallback
preview**.

> **Status: prototype; the real pipeline is built but not yet proven.** The Gemini voice/chat
> pipeline, intent routing, retrieval, dialect-worded replies with a facts lock, server speech
> with honest labels, eligibility, SMS and the mock paths are implemented and tested with fake
> models. On this branch (`feat/dialect-voice`) **nothing has been run against the real Gemini
> models yet**, and the deployed demo serves mock data. Six scheme summaries were checked against
> official sources on 2026-10-31; PMAY-G remains a sample, eligibility rules remain unverified and
> dialect exemplars are empty. What works and what is unproven, per language and dialect:
> [docs/FINAL_REPORT.md](docs/FINAL_REPORT.md) and [docs/PIPELINE_AUDIT.md](docs/PIPELINE_AUDIT.md).

## Quick start

Requires **Node 22.22+** (or 24 LTS) and npm 10.

**Mock mode (no key, canned answers):**

```bash
npm install
cp .env.example .env    # USE_MOCKS=true is the default: every module serves fixtures
npm run dev
```

Mock answers come from fixtures and prove nothing about the real pipeline. In mock mode every
spoken question gets a canned transcript, whatever was said.

**Real mode (Gemini):** set `GEMINI_API_KEY` and `USE_MOCKS=false` in `.env`, then build the index
(`npm run ingest -w server`) and follow [docs/RUNBOOK.md](docs/RUNBOOK.md) in order: health check,
ingest, `npm run audit -w server`, real-speaker clips, voices, native review, model pinning.
`GET /api/health` must report `"mocks":false`.

`npm run dev` starts **both** the API and the UI. Run it once. If you prefer separate terminals,
run `npm run dev:server` and `npm run dev:client` instead; do not start a second server workspace
process, or it will fail with `EADDRINUSE` on port 4000. To preview only the browser-side mock UI,
set `VITE_USE_MOCKS=true` and run `npm run dev:client`.

- UI: <http://localhost:5173> (open it in your browser's phone emulation)
- API: <http://localhost:4000/api/health> → `{"status":"ok","mocks":true,"dialectConfigured":false,"ttsConfigured":false}`

```bash
curl -s localhost:4000/api/chat/query -H 'Content-Type: application/json' \
  -d '{"text":"PM Kisan me kitna paisa milta hai?","language":"hi","sessionId":"demo"}'
```

## Scripts (run from the repo root)

| Command              | What it does                                                                |
| -------------------- | --------------------------------------------------------------------------- |
| `npm run dev`        | API (tsx watch, :4000) and UI (Vite, :5173) together                        |
| `npm run dev:server` | Only the API                                                                |
| `npm run dev:client` | Only the UI (add `VITE_USE_MOCKS=true` to run with no API at all)           |
| `npm run build`      | Type-check `shared`, compile `server` to `server/dist`, build `client/dist` |
| `npm start`          | Run the compiled API (`node server/dist/index.js`)                          |
| `npm run typecheck`  | Type-check all workspaces                                                   |
| `npm run lint`       | ESLint (`lint:fix` to auto-fix)                                             |
| `npm run format`     | Prettier (`format:check` to verify)                                         |

Workspace scripts also work directly, e.g. `npm run dev -w client`.

## Configuration

One `.env` at the repo root is shared by both apps (template: [.env.example](.env.example)).

| Variable | Default | Purpose |
|---|---:|---|
| `GEMINI_API_KEY` | unset | Server-only; required for live Gemini calls. Never commit it. |
| `GEMINI_CHAT_MODEL` | `gemini-3.8-flash` | Conversation and answer model. |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.6-flash` | Retry model for temporary primary-model errors; `none` disables fallback. |
| `GEMINI_AUDIO_MODEL` | chat model | Optional speech-to-text model override. |
| `GEMINI_EMBED_MODEL` / `GEMINI_EMBED_DIMENSIONS` | `gemini-embedding-2` / `768` | Vector store model and size; changing either requires ingest. |
| `GEMINI_TTS_MODEL` / `GEMINI_TTS_DIALECT_MODEL` | `gemini-3.8-flash-lite-tts` / `gemini-3.8-flash-tts` | Server speech model, and the model for dialect-worded replies. `none` keeps browser speech only. |
| `GEMINI_TTS_SAMPLE_RATE` / `TTS_TIMEOUT_MS` / `TTS_MAX_CHARS` / `TTS_STYLE` | `16000` / `15000` / `600` / empty | Speech output rate (falls back to 24000), per-call timeout (older name `GEMINI_TTS_TIMEOUT_MS`), split size, one constant delivery style (never an accent). |
| `USE_MOCKS` | `true` | `true`, `false`, or comma-separated mocked modules. |
| `PORT` / `CLIENT_ORIGIN` | `4000` / `http://localhost:5173` | API port and server CORS allow-list. |
| `RAG_TOP_K` / `RAG_MIN_SCORE` | `4` / `0.5` | Retrieval count and minimum score. The threshold is uncalibrated until runbook step 3. |
| `DIALECT_*` | see below | Classification, active labels and consented-example limits. |
| `DIALECT_REPLY` / `DIALECT_RENDER_TIMEOUT_MS` | `best_effort` / `8000` | Dialect wording of replies: `off`, `best_effort` (a confirmed or high-confidence dialect) or `verified_only` (only dialects a native reviewer marked `verified` in `server/src/config/dialect-render.json`; none yet). Use `verified_only` for public demos until review. |
| `AUDIT_*` | unset | Only for `npm run audit -w server`: deployed URL to probe, client URL for the browser test, notes, timeouts (commented in `.env.example`). |
| `VITE_API_URL` / `VITE_USE_MOCKS` | empty / `false` | Client API origin and browser-only mocks. Never put secrets in `VITE_*`. |

The remaining server settings cover timeouts/retries, dialect confidence, translation, cache,
SMS length and rate limits. See the full [environment table in the architecture guide](docs/ARCHITECTURE.md#configuration).
`VITE_*` values are compiled into the public JavaScript bundle, so never put secrets in them.

### Real API setup and common startup errors

For `USE_MOCKS=false`, add a valid server-only `GEMINI_API_KEY` and build the retrieval index
with `npm run ingest -w server`. Ingestion accepts only secure official documents marked
`sample: false` and `verified: true`; PMAY-G remains a sample. Run
`npm run prewarm -w server` to create the optional offline FAQ cache after the index exists. A
missing index produces `KNOWLEDGE_BASE_MISSING`; a missing FAQ only disables
`GET /api/faq/top` and produces `FAQ_NOT_READY`.

`EADDRINUSE` means another server process already owns the configured API port. Stop the extra
server, then use either the combined root command or the two split commands above. Gemini `503`
responses are upstream service, account, quota, or availability failures; the server retries
them, but restarting the UI or generating a local FAQ cannot repair the Gemini service. Check
the API key, model access, quota, and Google AI service status before retrying. Do not add an
automatic mock fallback to real answers, since that can make demo content look like sourced
scheme guidance.

## Known limitations

- **Nothing on this branch has run against the real models yet.** Every real-mode result in
  `docs/PIPELINE_AUDIT.md` is NOT-TESTED or MOCK-ONLY until the owner runs the audit with a key.
- **Dialect text is model-generated and unverified.** A reply is reworded into a dialect only
  after the standard answer is written, and a deterministic facts lock keeps its numbers, amounts,
  links and scheme names; but whether the wording is natural or even the right dialect is unknown
  until native speakers review it. All 14 dialects have zero consented examples, so the rewording
  is zero-shot.
- **Braj, Marwari, Wagdi and the other dialects the TTS model does not name are spoken by a Hindi
  voice**: a base-language approximation, not a dialect accent (the response says so with
  `basis: "base-language-approximation"`). Bhojpuri and Awadhi are named by the TTS model, but
  nobody has listened yet. The voices in `server/src/config/tts-voices.json` are placeholders
  until a person auditions them.
- **Wagdi speech recognition is expected to be weak**, and no dialect's speech recognition has
  been tested with real speakers.
- **Synthetic-audio tests do not prove real-speaker accuracy.** Machine-generated clips (Stage F
  without real recordings) are labelled SYNTHETIC-ONLY for that reason.
- **Browser voices vary by phone**; many phones have no Marathi voice. In real mode server speech
  is on by default (`GEMINI_TTS_MODEL=none` turns it off); low-bandwidth mode always uses the
  phone's voice.
- Six scheme summaries have linked official sources; PMAY-G remains a sample. Eligibility rules
  remain unverified and the eligibility endpoint is disabled until every rule is verified.
- The retrieval score default is uncalibrated. Review sources and run calibration/eval before
  treating live answers as reliable.

## Checking what really works

`npm run audit -w server` runs the pipeline audit and writes
[docs/PIPELINE_AUDIT.md](docs/PIPELINE_AUDIT.md): every stage from speech-to-text to speech output
per language and dialect, with a status (PASS, FAIL, PARTIAL, MOCK-ONLY, SYNTHETIC-ONLY,
NEEDS-HUMAN, NOT-TESTED) and the evidence for it. Mock-mode results never count as proof of the
real pipeline. Real-speaker clips go in `eval/audio/` (see its README); open problems are tracked in
[docs/AUDIT_FINDINGS.md](docs/AUDIT_FINDINGS.md).

## Project structure

```
gram-saathi/
├── client/                 Vite + React + TypeScript + Tailwind CSS + React Router
│   └── src/
│       ├── app/            App, routes, SiteShell, Dock, providers
│       ├── features/
│       │   ├── landing/    scrollytelling landing page: hero, chapters, intro, Saathi
│       │   ├── app-shell/  the app's frame: desktop phone sheet, phone full screen, tabs
│       │   ├── voice/      MicButton, useRecorder, speak (server speech, browser fallback), voice notes
│       │   ├── chat/       ChatScreen, ChatWindow, MessageBubble, FraudWarning
│       │   ├── sources/    SourceCard, SourceList
│       │   ├── eligibility/ EligibilityWizard, ResultCard
│       │   ├── sms/        FeaturePhoneMock, LowBandwidthToggle, OfflineFaqList
│       │   └── language/   LanguageSelector
│       ├── components/ui/  Button, Card, Badge, Spinner, Toast
│       ├── lib/            api.ts (typed fetch wrapper), config.ts, i18n, settings
│       └── mocks/          in-browser API for VITE_USE_MOCKS=true
├── server/                 Node + Express + TypeScript (tsx in dev), zod, multer
│   └── src/
│       ├── index.ts, app.ts, createApp.ts, config/env.ts
│       ├── modules/        health, voice, chat, dialect, rag, eligibility, sms, tts, faq
│       │                   (each: routes.ts, controller.ts, service.ts)
│       ├── config/         env.ts, dialect-render.json, tts-voices.json
│       ├── middleware/     errorHandler, requestLogger, upload
│       ├── lib/            geminiClient, facts (facts lock), wav, cache, languages, vectors, logger
│       └── mocks/          multilingual mock payloads
│   └── scripts/            ingest, prewarm, query, calibrate, audit, tts-voices, tts-samples
├── shared/src/             API contract types (types.ts, index.ts)
├── data/schemes/           scheme documents for retrieval (+ how to add one)
├── data/dialects/          dialect registry and consented exemplars (empty)
├── eval/                   real-speaker clip guide (audio/), native review sheet (review/)
├── audit/                  generated audit results (results.json)
├── docs/                   RUNBOOK, FINAL_REPORT, PIPELINE_AUDIT, API_CONTRACT, ARCHITECTURE, …
└── .github/                PR template, CI (lint + build)
```

## Team workflow

| Workstream             | Owns (summary)                                                                  |
| ---------------------- | ------------------------------------------------------------------------------- |
| 1. Voice + Chat UI     | `client/src/features/{voice,chat,sources,language}`                             |
| 2. RAG backend         | `server/src/modules/{chat,voice,rag,tts}`, `lib/geminiClient`, `data/schemes`   |
| 3. Eligibility + SMS   | `client/src/features/{eligibility,sms}`, `server/src/modules/{eligibility,sms}` |
| 4. PWA + Deploy + Demo | `client/src/{app,components,lib}`, server infra, `faq`, PWA, CI, deploy         |

The exact ownership map and step-2/step-3 tasks are in [docs/TASKS.md](docs/TASKS.md). Branch
naming, PR rules and the API contract rule are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Docs

- [docs/RUNBOOK.md](docs/RUNBOOK.md): the owner's steps from first key to verified dialects, in order
- [docs/FINAL_REPORT.md](docs/FINAL_REPORT.md): what was built, how it was checked, the regional readiness matrix and the risks
- [docs/PIPELINE_AUDIT.md](docs/PIPELINE_AUDIT.md) (generated) and [docs/AUDIT_FINDINGS.md](docs/AUDIT_FINDINGS.md): audit results and open findings
- [docs/DECISIONS.md](docs/DECISIONS.md): design decisions and their alternatives
- [docs/API_CONTRACT.md](docs/API_CONTRACT.md): every endpoint with examples (types in `shared/src/types.ts`)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how it fits together, mock mode, roadmap
- [docs/TASKS.md](docs/TASKS.md): workstreams, folder ownership, 24-hour plan, demo checklist
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): one Vercel project with `client` and `server` services (`vercel.json`)
- [data/schemes/README.md](data/schemes/README.md): adding scheme documents

## Testing on a phone

- Same Wi-Fi: `npm run dev:server` and `npm run dev -w client -- --host`, then open the
  "Network" URL Vite prints.
- The microphone (step 2) only works over HTTPS: use a tunnel such as
  `cloudflared tunnel --url http://localhost:5173` and add its host to `server.allowedHosts`
  in `client/vite.config.ts`.

## Renaming the project

"gram-saathi" is a working name. To rename, replace `gram-saathi` / `@gram-saathi/` and
`Gram Saathi` across the repo (package names, `client/index.html`, `client/src/lib/config.ts`),
then run `npm install` to refresh the lockfile:

```bash
git grep -lE "gram-saathi|Gram Saathi"
```
