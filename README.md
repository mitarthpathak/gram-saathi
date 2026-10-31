# Gram Saathi

A voice-first, multilingual assistant that answers questions about government schemes for rural
citizens: farmers, ASHA workers and panchayat offices. Ask by voice in **Hindi, Marathi, Tamil
or English**. You get a short answer in your language that is grounded in official scheme
documents, with source citations, a fraud warning, the answer read aloud, and an SMS-length
version for basic phones.

Also included: an **eligibility check** (3–4 questions tell you which schemes you may qualify
for), a **low-bandwidth mode** with answers saved for offline use, and an **SMS fallback
preview**.

> **Status: prototype.** The Gemini voice/chat pipeline, retrieval, eligibility, SMS, and mock
> paths are implemented. Six concise scheme summaries were checked against their linked official
> sources on 2026-10-31; PMAY-G remains a sample, eligibility rules remain unverified, and dialect
> exemplars are empty. Ingest the reviewed documents before using live retrieval. Do not present
> the unverified parts as production-ready.

## Quick start

Requires **Node 22.22+** (or 24 LTS) and npm 10.

```bash
npm install
cp .env.example .env    # optional; set USE_MOCKS=true for a no-key demo
npm run dev
```

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
| `GEMINI_TTS_MODEL` / `GEMINI_TTS_TIMEOUT_MS` | unset / `15000` | Optional Gemini speech and request timeout. Empty model keeps browser speech. |
| `USE_MOCKS` | `true` | `true`, `false`, or comma-separated mocked modules. |
| `PORT` / `CLIENT_ORIGIN` | `4000` / `http://localhost:5173` | API port and server CORS allow-list. |
| `RAG_TOP_K` / `RAG_MIN_SCORE` | `4` / `0.5` | Retrieval count and minimum score. The threshold is uncalibrated until runbook step 3. |
| `DIALECT_*` | see below | Classification, active labels and consented-example limits. |
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

- Dialect output is best-effort until native speakers review model replies and consented examples.
  Wagdi speech recognition is expected to be weak with the current data.
- Dialect text is spoken using its base-language voice (Hindi for Braj/Wagdi). Browser speech
  voices vary by phone; server Gemini TTS is optional and disabled without `GEMINI_TTS_MODEL`.
- Six scheme summaries have linked official sources; PMAY-G remains a sample. Eligibility rules
  remain unverified and the eligibility endpoint is disabled until every rule is verified.
- The retrieval score default is uncalibrated. Review sources and run calibration/eval before
  treating live answers as reliable.

## Project structure

```
gram-saathi/
├── client/                 Vite + React + TypeScript + Tailwind CSS + React Router
│   └── src/
│       ├── app/            App, routes, SiteShell, Dock, providers
│       ├── features/
│       │   ├── landing/    scrollytelling landing page: hero, chapters, intro, Saathi
│       │   ├── app-shell/  the app's frame: desktop phone sheet, phone full screen, tabs
│       │   ├── voice/      MicButton, useRecorder, speak (browser TTS)
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
│       ├── modules/        health, voice, chat, rag, eligibility, sms, tts, faq
│       │                   (each: routes.ts, controller.ts, service.ts)
│       ├── middleware/     errorHandler, requestLogger, upload
│       ├── lib/            geminiClient, cache, languages, vectors, logger
│       └── mocks/          multilingual mock payloads
├── shared/src/             API contract types (types.ts, index.ts)
├── data/schemes/           scheme documents for retrieval (+ how to add one)
├── docs/                   API_CONTRACT.md, ARCHITECTURE.md, TASKS.md, DEPLOYMENT.md
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
