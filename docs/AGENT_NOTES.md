# Recon notes — dialect voice job (branch `feat/dialect-voice`)

Written in Phase 0 of the dialect-voice job on 2026-10-31. The previous job's recon notes
(conversation layer) are in git history (`git show feat/conversation-layer:docs/AGENT_NOTES.md`).
Code was read on this branch; where these notes and the code disagree, trust the code.

## Starting point

- `feat/dialect-voice` was branched from `feat/conversation-layer` (HEAD `1b5d297`) because that
  branch is **not merged** into `main` (PR #9 is open). `main` and `feat/conversation-layer` have
  diverged: each has 18 commits the other lacks (merge base `aaec91c9`). The deployed app
  (`https://gram-saathi.vercel.app`) is built from `main`, not from this branch.
- `docs/AGENT_LOG.md` already held Phases 0–15 of the previous (conversation-layer) job, all
  finished. None of them is a phase of this job, so this job starts at its own Phase 0 and appends
  a new section to the same log (decision recorded in `docs/DECISIONS.md`).

## Environment limits in this sandbox (affect every "verified" claim)

- **No dependencies could be installed.** `npm install` fails: direct DNS for `registry.npmjs.org`
  fails (`ENOTFOUND`) and the egress proxy answers `403` to `CONNECT registry.npmjs.org:443`
  (proxy status: `connect_rejected`, policy denial). pip is blocked the same way. Per the proxy
  rules this was not retried or routed around.
- **No Gemini key** (`GEMINI_API_KEY` unset, no `.env`), so no real-mode stage can run here.
- **Sandbox verification kit** (outside the repo, linked as an ignored `node_modules`): real
  TypeScript 6.0.3 (matches the repo's `~6.0.3`), real `@types/node`, real `yaml` 2.9.0, real zod v4
  (the `zod/v4` build shipped in zod 3.25.76; the repo pins zod ^4.6.7), and small shims for
  packages that are not on this machine: `vitest` (a vitest-compatible subset on `node:test`),
  `express`, `cors`, `multer`, `dotenv`, `unpdf`, `@google/genai`. Results from this kit are
  labelled **sandbox shim** everywhere and never replace `npm run typecheck` / `npm test`.
- Not runnable at all here: ESLint (no `typescript-eslint`, `@eslint/js`, `globals`), the client
  typecheck/build (no `vite`, `@types/react`, `react-router`, `lucide-react`), and any test that
  starts the Express app.

## Request flows (file paths; where language and dialect live)

### Text: `POST /api/chat/query`

1. `server/src/modules/chat/controller.ts` validates `{ text, language?, dialectHint?, sessionId }`
   with zod; `dialectHint` must be a registry id (`isDialectId`).
2. `server/src/modules/chat/service.ts` `answerQuestion()`:
   - **Language:** `parentLanguageForDialect(dialectHint)` → `input.detectedLanguage` (voice) →
     deterministic `detectTextLanguage(text, language)` (`chat/language.ts`). Script via
     `detectTextScript`.
   - **Dialect:** `getDialectOutcome()` — a hint always wins (`dialectHintOutcome`, marked
     `high`); typed text is never classified unless `DIALECT_TEXT_DETECT=true`; voice audio goes to
     `classifyDialect()` (`dialect/classifier.ts`); `conservativeDialectOutcome()` drops `medium`
     to `null` and keeps candidates. `dialectId = dialectHint ?? dialect.dialect?.id`.
3. **Real mode** (`USE_MOCKS` does not contain `chat`) → `answerConversation()` →
   `handleTurn()` in `server/src/modules/chat/conversation.ts`:
   - _Understand_ call (`generateJson`, label `conversation`): intent
     (`scheme_question | smalltalk | clarify | out_of_scope`), `language`, a free-form `dialect`
     string, `searchQueryEn`, and a direct `reply` for non-scheme intents. The prompt names
     "ki keh raho he" as a `clarify` example.
   - **The dialect does reach the answer prompt.** `dialect = input.dialectHint ?? u.dialect`;
     `answerSystem(lang, dialect, examples)` adds "spoken the `<dialect>` way" plus consented
     exemplars for that label. Because `u.dialect` is the understand model's own guess, **a
     dialect can reach the answer prompt even for typed text with no hint and with the
     classifier abstaining** — this contradicts the conservative policy in `docs/DECISIONS.md`
     ("Dialect confidence") and `DIALECT_TEXT_DETECT=false`. The response's `dialect` field still
     reports the classifier/hint result (often `null`), so the reply can be dialect-styled while
     the response says no dialect was identified.
   - Direct replies (smalltalk/clarify/out_of_scope) are written by the understand call "in the
     user's language and dialect"; `clarify` restates the previous answer with **no facts check**.
   - Scheme questions: one English search (`rag/service.ts` `searchSchemes`, translation skipped),
     `RAG_MIN_SCORE` filter, _answer_ call (`answersQuestion`, `usedChunkIds`), then in
     `service.ts` `preservesContextNumbers()` (every digit run in the answer must appear in a cited
     chunk; Western digits only), then `compressForSms` (another Gemini call unless `sms` mocked).
   - `detectedLanguage` in the response is the understand model's `language`, not the
     deterministic detection.
4. **Mock mode** (`chat` mocked) keeps the pre-conversation pipeline byte-for-byte: exact greeting
   / "where are you from" matches (`chat/messages.ts`), answer cache, `searchSchemes` → mock
   keyword search (`mocks/query.ts` `mockSearchSchemes`, PM-KISAN / PM-JAY regexes only), fixed
   not-found text, `mockGenerateAnswer` (native or Roman fixtures). No intent routing.

### Voice: `POST /api/voice/query`

1. `voice/controller.ts`: multipart `audio` (≤10 MB, `audio/*`), `language?`, `dialectHint?`.
2. `voice/service.ts` `answerVoiceQuery()` → `transcribe()` (Gemini audio→JSON:
   `transcript`, `detectedLanguage` free string, `script`) → `answerLanguageFromTranscription()`
   (hint's parent language, else the STT language mapped to a `LanguageCode`) → `answerQuestion()`
   with `dialectEvidence.audio` so the classifier runs on the audio.
3. Mock: `transcribe()` returns `mockTranscribe(language)`, which **ignores the audio** and
   alternates two canned questions (PM-KISAN, Ayushman) per language.
4. Sequential Gemini calls on a live voice turn: STT → dialect classifier (ensemble up to
   `DIALECT_ENSEMBLE_SIZE`) → understand → answer → SMS = 5 sequential stages before any TTS.

### Dialect

- Registry `data/dialects/registry.json`: 14 dialects, all `parentLanguage: "hi"`, all
  `testStatus: "experimental"` (marwari, dhundhari, shekhawati, bagri, mewari, mewati, harauti,
  malvi, wagdi, braj, haryanvi, bhojpuri, awadhi, bundeli). Served by `GET /api/dialects`.
- Exemplar store `data/dialects/exemplars/<label>.jsonl` (loader `dialect/exemplars.ts`, rows must
  have `consent: true`): **all 22 files are empty (0 rows)**. Every dialect is zero-shot.
- Classification `dialect/classifier.ts` (ensemble votes, calibration file optional), env
  `DIALECT_*`. There is no dialect _text generation_ step besides the answer prompt's
  "spoken the X way" line.
- Client: **no dialect UI**. The client never sends `dialectHint` (`ChatProvider.tsx` sends
  `{ text, language, sessionId }`) and never shows `dialect` or `dialectCandidates`. So "the
  existing candidates UX" does not exist on this branch.

### Speak / Listen

- Server: `QueryResponse.audioUrl` is always `null` (`chat/service.ts`, all branches).
- `POST /api/tts` (`tts/controller.ts` → `tts/service.ts` `synthesizeSpeech`): only `{ text,
language }`; enabled when `GEMINI_TTS_MODEL` and `GEMINI_API_KEY` are set and `tts` is not
  mocked. It calls the Interactions REST endpoint with plain `fetch`, hard-coded voice `Kore`,
  a style annotation `warm, clear, conversational`, `response_format: { type: 'audio' }` with no
  mime type or sample rate, and returns `data:audio/wav;base64,…`. No retries, no concurrency cap,
  no cache, no Markdown stripping, no length split, no dialect handling, no `basis`. Any failure →
  `{ audioUrl: null }`. It does sit behind the shared AI rate limiter (`createApp.ts`).
- Client `client/src/features/voice/speak.ts`: play `audioUrl` if given, else **always** call
  `POST /api/tts`, else browser `speechSynthesis` (Marathi falls back to a Hindi voice).
  `ChatProvider.tsx` auto-speaks voice answers; `MessageBubble.tsx` renders the Listen button.
  Low-bandwidth mode passes `audioUrl: null`, but `speak()` then still calls `/api/tts` — so
  low-bandwidth mode currently **does** download server audio when TTS is configured (contradicts
  `lib/settings.ts`: "no server audio").

## Environment variables that exist (server, `server/src/config/env.ts`)

`NODE_ENV, PORT, USE_MOCKS, CLIENT_ORIGIN, LOG_LEVEL, GEMINI_API_KEY, GEMINI_CHAT_MODEL
(gemini-3.8-flash), GEMINI_FALLBACK_MODEL (gemini-3.6-flash), GEMINI_AUDIO_MODEL, GEMINI_TTS_MODEL
(unset), GEMINI_TTS_TIMEOUT_MS (15000), GEMINI_EMBED_MODEL (gemini-embedding-2),
GEMINI_EMBED_DIMENSIONS (768), GEMINI_THINKING_LEVEL, GEMINI_TIMEOUT_MS, GEMINI_MAX_RETRIES,
GEMINI_MAX_CONCURRENT_CALLS, DIALECT_ENSEMBLE_SIZE, DIALECT_MIN_VOTES, DIALECT_TIMEOUT_MS,
DIALECT_TEXT_DETECT (false), DIALECT_ACTIVE, DIALECT_EXEMPLARS_PER_LABEL (4),
DIALECT_EXEMPLAR_TOKEN_BUDGET (1800), RAG_TOP_K, RAG_MIN_SCORE (0.5, uncalibrated),
RAG_TRANSLATE_QUERY, CACHE_MAX_ENTRIES, CACHE_TTL_MINUTES, SMS_MAX_SEGMENTS, RATE_LIMIT_PER_MINUTE,
TRUST_PROXY`. Client: `VITE_API_URL, VITE_USE_MOCKS`.

## What is mocked

`USE_MOCKS` defaults to `true` (all of `voice, chat, dialect, rag, eligibility, sms, tts, faq`).
`GET /api/health` reports `mocks: true` when **any** module is mocked. Mock voice ignores audio;
mock RAG is two keyword regexes; mock TTS returns `null`; the client's `VITE_USE_MOCKS` mirrors
the same fixtures in the browser.

## The "ki keh raho he" report — evidence gathered in Phase 0

- `GET https://gram-saathi.vercel.app/api/health` (fetched 2026-10-31) →
  `{"status":"ok","mocks":true}` (no `dialectConfigured`/`ttsConfigured` fields: a `main` build).
- `GET https://gram-saathi.vercel.app/api/faq/top?lang=hi` → 3 items with ids `faq-1..faq-3`,
  which is the id format of the **mock** FAQ (`mocks/faq.ts`); real prewarmed ids look like
  `pm-kisan-amount` (`data/faq/questions.json`). So at least `faq` is mocked in production, and
  the default `USE_MOCKS=true` is the simplest explanation for both observations. `mocks:true` alone
  cannot prove `chat` is mocked (it means "any module").
- Ran the pure mock functions (sandbox, `tsx`): `mockSearchSchemes("ki keh raho he")` → `[]`, so a
  **typed** "ki keh raho he" in mock mode gets the fixed not-found text, not PM-KISAN. Any
  **spoken** query in mock mode gets the canned transcript "पीएम किसान योजना में साल में कितना पैसा
  मिलता है?" and the formal-Hindi PM-KISAN fixture ("…पात्र किसान परिवारों को हर साल ₹6,000…").
- Phase 1 runs this properly through the audit (Stage D) and states the conclusion with mode.

## Contradictions (docs / brief vs code on this branch)

1. Brief: "nothing says the dialect reaches the answer prompt". Code: it does
   (`answerSystem(..., dialect, ...)`), including an unverified model-guessed dialect.
2. Brief: "`.env.example` has NO TTS variables", "README still says step 1 of 3". True on `main`;
   on this branch `.env.example` has `GEMINI_TTS_MODEL` / `GEMINI_TTS_TIMEOUT_MS` and README says
   "Status: prototype".
3. Brief: TTS "optional in the contract with `{ text, language }` only". Still true for the type,
   but a real (partial) Gemini TTS implementation exists (`tts/service.ts`).
4. Brief: intent routing unknown. Code: `conversation.ts` intent router exists and lists
   "ki keh raho he" as `clarify` — but only in real mode; mock mode has no router.
5. `docs/ARCHITECTURE.md` roadmap row 3 still lists "server TTS" as a step-3 TODO while the same
   file's flow diagram shows Gemini TTS; `chat/service.ts` keeps `TODO(step-3)` for server TTS.
6. `docs/ARCHITECTURE.md` says "the repo's automatic dialect result is forwarded only at high
   confidence" — true for the classifier, but the understand step's own dialect guess bypasses it
   (item 1).
7. `lib/settings.ts` says low-bandwidth means "no server audio"; `speak.ts` calls `/api/tts`
   anyway.
8. `README.md` says "Dialect text is spoken using its base-language voice"; TTS has no dialect
   input at all, and the browser voice is chosen by base language code only.
9. `docs/AGENT_LOG.md` (previous job) says lint passed; `prettier --check .` reports 29 files
   with style differences on this branch (checked with prettier 3.8.1 here; CI pins ^3.9.10), so
   CI's `format:check` step would likely fail. Not fixed here (unrelated formatting churn, R9).

## Baseline verification (before any behaviour change)

| Check                          | Command                                           | Result here                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| install                        | `npm install`                                     | **FAIL (environment)**: registry blocked (ENOTFOUND / proxy 403)                                                                                                                     |
| typecheck (repo tooling)       | `npm run typecheck`                               | **FAIL (environment)**: no `node_modules`                                                                                                                                            |
| lint                           | `npm run lint`                                    | **FAIL (environment)**: ESLint plugins missing                                                                                                                                       |
| format                         | `prettier --check .` (3.8.1)                      | 29 files differ (pre-existing)                                                                                                                                                       |
| test (repo tooling)            | `npm test -w server`                              | **FAIL (environment)**: `vitest` missing                                                                                                                                             |
| build                          | `npm run build`                                   | **FAIL (environment)**                                                                                                                                                               |
| server typecheck, sandbox shim | `tsc --noEmit -p server/tsconfig.json` (TS 6.0.3) | 0 errors                                                                                                                                                                             |
| shared typecheck, sandbox shim | `tsc --noEmit -p shared/tsconfig.json`            | 0 errors                                                                                                                                                                             |
| server tests, sandbox shim     | `tsx --test server/test/*.test.ts`                | 135 tests: 125 pass, 10 fail = 7 need real Express (sandbox-only) + 3 known eligibility failures (rules unverified; same 3 as the previous job's real `npm test`: 132 pass / 3 fail) |
| client typecheck/build         | —                                                 | **NOT-TESTED**: client dependencies unavailable                                                                                                                                      |
