# Gram Saathi

A voice-first, multilingual assistant that answers questions about government schemes for rural
citizens: farmers, ASHA workers and panchayat offices. Ask by voice in **Hindi, Marathi, Tamil
or English**. You get a short answer in your language that is grounded in official scheme
documents, with source citations, a fraud warning, the answer read aloud, and an SMS-length
version for basic phones.

Also included: an **eligibility check** (3–4 questions tell you which schemes you may qualify
for), a **low-bandwidth mode** with answers saved for offline use, and an **SMS fallback
preview**.

> **Status: step 1 of 3, the skeleton.** Everything runs end to end on realistic mock data.
> Real AI (Gemini) comes in step 2 and the vector DB in step 3; look for `TODO(step-2)` /
> `TODO(step-3)`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#roadmap-and-todo-markers).

## Quick start

Requires **Node 22.22+** (or 24 LTS) and npm 10.

```bash
npm install
cp .env.example .env    # optional: the defaults run everything on mock data
npm run dev
```

- UI: <http://localhost:5173> (open it in your browser's phone emulation)
- API: <http://localhost:4000/api/health> → `{"status":"ok","mocks":true}`

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

| Variable             | Used by | Default                 | Notes                                                                        |
| -------------------- | ------- | ----------------------- | ---------------------------------------------------------------------------- |
| `GEMINI_API_KEY`     | server  | –                       | Not needed while mocks are on. Never commit it                               |
| `GEMINI_CHAT_MODEL`  | server  | `gemini-flash-latest`   | Pin an exact model id before the demo                                        |
| `GEMINI_EMBED_MODEL` | server  | `gemini-embedding-001`  |                                                                              |
| `USE_MOCKS`          | server  | `true`                  | `true`, `false`, or a list of modules to keep mocked, e.g. `eligibility,sms` |
| `PORT`               | both    | `4000`                  | API port; the Vite dev proxy follows it                                      |
| `CLIENT_ORIGIN`      | server  | `http://localhost:5173` | CORS allow-list (comma-separated); add your deployed UI URL                  |
| `VITE_API_URL`       | client  | empty                   | Empty in dev (proxy). In production: the API origin                          |
| `VITE_USE_MOCKS`     | client  | `false`                 | `true` = the browser uses `client/src/mocks`, no server needed               |

`VITE_*` values are compiled into the public JavaScript bundle, so never put secrets in them.

## Project structure

```
gram-saathi/
├── client/                 Vite + React + TypeScript + Tailwind CSS + React Router
│   └── src/
│       ├── app/            App, router, providers, layout (header + bottom nav)
│       ├── features/
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
