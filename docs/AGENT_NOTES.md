# Recon notes

## Existing request flows

- **Text:** `client/src/features/chat/*` calls the typed API wrapper in `client/src/lib/api.ts`, which posts to `/api/chat/query`. Express routes/controllers under `server/src/modules/chat/` call `answerQuestion` in `service.ts`. The service detects language/script, handles greeting and small talk with fixed messages, applies dialect detection, checks an in-memory answer cache, then calls `searchSchemes`, filters on `RAG_MIN_SCORE`, and generates a passage-grounded Gemini answer. It maps retrieved chunks to source excerpts, adds a reviewed fraud warning and SMS text, and returns `QueryResponse`.
- **Voice:** `client/src/features/voice/` records audio and posts multipart to `/api/voice/query`. `server/src/modules/voice/service.ts` transcribes through Gemini (or existing mocks), determines answer language, then calls the same `answerQuestion` service with transcript, audio evidence, language, optional dialect hint, and session id. Audio size enforcement is in the voice route/middleware.
- **Dialect:** `server/src/modules/dialect/registry.ts` loads `data/dialects/registry.json`; `classifier.ts` uses active labels and `exemplars.ts` loads consented JSONL data bounded by `DIALECT_EXEMPLARS_PER_LABEL` and a token budget. Voice may classify audio/transcript; typed-text classification is opt-in. A selected dialect hint maps to its base language and skips classification. Client language/dialect selectors live under `client/src/features/language/`.
- **TTS / Listen:** API contract defines `POST /api/tts` with `{text, language}` and `{audioUrl}`. `server/src/modules/tts/service.ts` currently returns null in mock mode and is a stub otherwise. Chat responses currently set `audioUrl: null`. The client Listen action calls `speak` in `client/src/features/voice/speak.ts`; it uses an audio URL if one exists and falls back asynchronously to browser `speechSynthesis`, with Hindi voice fallback for Marathi.

## Environment and scripts

Defaults below are from `.env.example` and config, not from `.env` (which was not opened).

| Variable | Default / purpose |
|---|---|
| `USE_MOCKS` | `false` in the checked-in example; config defaults to mock mode. Can list mocked modules. |
| `PORT` | `4000` |
| `CLIENT_ORIGIN` | `http://localhost:5173` |
| `LOG_LEVEL` | empty; config chooses debug in development and info in production |
| `GEMINI_API_KEY` | empty; required for live Gemini |
| `GEMINI_CHAT_MODEL` | `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.6-flash` |
| `GEMINI_AUDIO_MODEL` | empty; uses chat model |
| `GEMINI_EMBED_MODEL` | `gemini-embedding-2` |
| `GEMINI_EMBED_DIMENSIONS` | `768` |
| `GEMINI_THINKING_LEVEL` | `low` |
| `GEMINI_TIMEOUT_MS` | `30000` |
| `GEMINI_MAX_RETRIES` | `3` |
| `GEMINI_MAX_CONCURRENT_CALLS` | `8` |
| `DIALECT_ENSEMBLE_SIZE`, `DIALECT_MIN_VOTES` | unset; dialect calibration defaults apply |
| `DIALECT_TIMEOUT_MS` | `6000` |
| `DIALECT_TEXT_DETECT` | `false` |
| `DIALECT_ACTIVE` | `all` |
| `DIALECT_EXEMPLARS_PER_LABEL` | `4` |
| `DIALECT_EXEMPLAR_TOKEN_BUDGET` | `1800` |
| `RAG_TOP_K` | `4` |
| `RAG_MIN_SCORE` | `0.5` |
| `RAG_TRANSLATE_QUERY` | `false` |
| `CACHE_MAX_ENTRIES` | `500` |
| `CACHE_TTL_MINUTES` | `360` |
| `SMS_MAX_SEGMENTS` | `2` |
| `RATE_LIMIT_PER_MINUTE` | `30` |
| `TRUST_PROXY` | `1` |
| `VITE_API_URL` | empty |
| `VITE_USE_MOCKS` | `false` |

Root scripts: `dev`, `dev:server`, `dev:client`, `eval:dialect`, `calibrate:dialect`, `merge:contrib`, `build`, `typecheck`, `start`, `lint`, `lint:fix`, `format`, `format:check`. Server scripts include `dev`, `build`, `typecheck`, `start`, `test`, `ingest`, `prewarm`, `query`. Client scripts include `dev`, `build`, `typecheck`, `preview`.

## Mocked vs real

- `USE_MOCKS` is module-aware and mock implementations live in `server/src/mocks`; frontend-only `VITE_USE_MOCKS` uses `client/src/mocks` and avoids the API.
- Real chat and voice use `server/src/lib/geminiClient.ts`; real retrieval uses the generated vector store via `server/src/modules/rag/`. Ingestion and prewarm are explicit scripts.
- Current scheme markdown is marked sample/unverified. No vector store or FAQ generated data was assumed present. Dialect examples are consent-gated JSONL and may be empty. Server TTS is a stub; browser speech is the active Listen path.

## Documentation contradictions found

- README describes direct RAG and calls the Gemini voice/chat pipeline implemented, while actual chat service short-circuits some greetings/small talk but still sends most other intents directly to RAG; a conversation intent layer is absent.
- Architecture says query translation is optional and answer caching shares runs; this matches code, but its chart implies dialect detection runs in parallel with RAG, while current service awaits dialect outcome before cache/retrieval.
- Architecture claims chat answer prompts stay in a dialect's parent language, but current prompt construction is based on `LanguageCode` and dialect id as context; it does not itself ensure dialect output.
- API contract calls TTS optional and browser speech default; service currently is a stub and `audioUrl` is always null from chat.
- README quickstart and `.env.example` disagree on default `USE_MOCKS`: README says set true for no-key demo, while example sets false and config behavior needs explicit inspection.
- README says the server health response includes `mocks`; the API contract agrees. Deployment text assumes generated JSON data is committed, while current data availability must be confirmed in deployment phase.

## Baseline verification (before behavior changes)

- `npm.cmd run typecheck`: passed for shared, server, and client.
- `npm.cmd run lint`: could not start; `eslint` executable missing.
- `npm.cmd test --workspaces --if-present`: 131 passed, 3 failed in eligibility tests because unverified eligibility rules block the tested flows (`ELIGIBILITY_RULES_UNVERIFIED`).
- `npm.cmd run build`: passed for shared, server, and client.
- `npm.cmd install`: PowerShell execution policy blocked `npm.ps1`; `npm.cmd install` failed with EPERM accessing npm's user cache. No attempt was made to clear or alter the cache.
