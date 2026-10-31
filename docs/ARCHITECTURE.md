# Architecture

## Current conversation flow (real mode)

Real mode means `USE_MOCKS=false`, or the default `USE_MOCKS=auto` with `GEMINI_API_KEY` set. Mock
mode keeps the older fixture pipeline unchanged (see [Mock mode](#mock-mode)); there the mic's
audio is ignored and a canned question is answered. Every arrow labelled "Gemini" is one model call.

```mermaid
flowchart TB
  U((User)) -->|types| CHAT[/POST /api/chat/query/]
  U -->|speaks| VOICE[/POST /api/voice/query/]
  VOICE --> STT[Gemini: verbatim transcript + language]
  STT --> IDENT[Gemini: dialect identification, up to 3 votes]
  IDENT --> POLICY
  CHAT --> POLICY{dialect applies?<br/>confirmed dialectHint, or<br/>identification at high confidence}
  POLICY --> UNDERSTAND[Gemini: intent, language, English search query]
  UNDERSTAND --> ROUTE{intent}
  ROUTE -->|smalltalk / clarify / out of scope| DIRECT[direct reply, standard language]
  DIRECT --> GUARD{states facts the user<br/>was not told?}
  GUARD -->|yes| ASK[fixed 'please ask again' text]
  GUARD -->|no| STYLE
  ASK --> STYLE
  ROUTE -->|scheme question| SEARCH[Gemini embedding + vector search]
  SEARCH -->|nothing at or above RAG_MIN_SCORE| NOTFOUND[fixed not-found text, never reworded]
  SEARCH -->|passages| ANSWER[Gemini: standard-language answer from cited passages only]
  ANSWER -->|numbers not in cited passages| NOTFOUND
  ANSWER -->|checked answer| BOTH
  BOTH[in parallel] --> SMS[Gemini: SMS version of the standard wording]
  BOTH --> STYLE{reword? DIALECT_REPLY,<br/>dialect of the answer's language}
  STYLE -->|yes| RENDER[Gemini: reword into the dialect]
  RENDER --> LOCK{facts lock + native script}
  LOCK -->|pass| DTEXT[dialect-worded answer]
  LOCK -->|fail, timeout, error| STEXT[standard answer]
  STYLE -->|no| STEXT
  DTEXT --> RESP[QueryResponse + answerStyle]
  STEXT --> RESP
  NOTFOUND --> RESP
  SMS --> RESP
  RESP --> LISTEN{Listen pressed}
  LISTEN -->|low-bandwidth mode| BROWSER[browser speech]
  LISTEN --> TTS[/POST /api/tts text, language,<br/>dialectId only for dialect-worded text/]
  TTS --> GTTS[Gemini TTS: dialect model when a dialect applies;<br/>split at sentences, joined WAV]
  GTTS -->|audio| PLAY[play WAV + basis label]
  GTTS -->|null: error, timeout, over 3 MB| BROWSER
```

**Identify.** Typed and spoken messages enter the same `handleTurn` module
(`server/src/modules/chat/conversation.ts`). Voice first goes through
`server/src/modules/voice/service.ts` (transcription), then the dialect classifier votes on the
audio (`server/src/modules/dialect/`). A dialect applies only when the user confirmed it
(`dialectHint`) or the classifier is at `high` confidence; typed text has no dialect unless a hint
is sent (`DIALECT_TEXT_DETECT=false`). The understand call returns intent, language and an English
search query; its own guess about the dialect is not used.

**Answer.** Smalltalk, clarification and out-of-scope messages get a direct reply and never search.
Such a reply may not state numbers, rupee amounts, URLs or phone numbers that the session's earlier
answers did not contain; otherwise a fixed "please ask again" text replaces it (the guard for the
"ki keh raho he" report). A scheme question gets one English vector search; only passages at or
above `RAG_MIN_SCORE` reach the answer model, which may cite only those passage ids. Every Western
digit run in the answer must appear in a cited passage, or the fixed not-found text is returned.
The answer is always written in the standard base language first.

**Dialect render.** When a dialect applies and `DIALECT_REPLY` allows it (`mirror`, `best_effort`,
or `verified_only` with `"verified": true` in `server/src/config/dialect-render.json`),
`renderInDialect()` (`chat/dialectRender.ts`) rewords only the wording, zero-shot or with consented
exemplars. With `mirror` (the default) a spoken question that is not confirmed or identified with
high confidence is still reworded, towards the speaker's own transcript (quoted as a style sample,
never as facts or instructions), with the classifier's candidates only as hints; the answer then
has `answerStyle.dialectId: null` and is spoken with the base-language voice. `checkFactsLock()` (`server/src/lib/facts.ts`, no AI) compares numbers in Devanagari,
Tamil and Western digits, rupee amounts, URLs and domains, phone numbers and scheme names; any
difference, a timeout (`DIALECT_RENDER_TIMEOUT_MS`), an error, non-native script or new Roman words
keep the standard answer. `answerStyle` reports `rendered: 'dialect' | 'standard'` and the reason.
Fixed texts are never reworded, and the SMS always keeps the checked standard wording (it is
computed in parallel, so rewording adds a call but no sequential step).

**Speech.** The client's Listen button (`client/src/features/voice/speak.ts`) plays audio already
attached to the answer, else calls `POST /api/tts` (`server/src/modules/tts/`), else uses browser
speech; low-bandwidth mode goes straight to browser speech. The server sends the text unchanged
(only Markdown and emoji removed) to Gemini TTS through `geminiClient.synthesizeAudio`, using
`GEMINI_TTS_DIALECT_MODEL` when a dialect applies and the voice from
`server/src/config/tts-voices.json`. `basis` tells the client what the audio is: `language`,
`named-dialect` (the TTS model names the dialect: Bhojpuri, Awadhi), `base-language-approximation`
(any other dialect: a Hindi voice) or `none`. The client turns `basis` into a visible note. Any
failure returns `audioUrl: null` and the browser voice takes over.

Session history keeps the latest six turns for up to 500 least-recently-used sessions per process
(process-local, live mode only). Grounded answers map only their used passages to sources; direct
answers have no sources or fraud banner.

**Model calls per request** (measured with a fake backend by the audit, Stage J): typed scheme
question 4 calls, 4 sequential; with a dialect 5 calls, 4 sequential; spoken scheme question 8
calls, 6 sequential (over the audit's budget of 4; finding N2); Listen 1 call per piece of up to
`TTS_MAX_CHARS`, pieces in parallel. Real latency is unmeasured.

### Checking it: the pipeline audit

`npm run audit -w server` (`server/scripts/audit.ts`) runs separate worker processes (the API as
configured, a mock reference, and a fake-model worker for error codes and call counts) and writes
`docs/PIPELINE_AUDIT.md` and `audit/results.json` with a status and evidence for every stage
(A static checks … J latency) and a regional readiness matrix per language and dialect. Real-speaker
clips are read from `eval/audio/` (git-ignored WAVs + `labels.json`); generated speech goes to
`eval/out/tts/` for listening; `eval/review/dialect-review.csv` is the native-review sheet.

Supporting flows remain separate: **eligibility** evaluates local deterministic rules from
`data/eligibility/`; **faq** serves pre-generated answers from `server/data/faq.json`; dialect
metadata and consented exemplars load from `data/dialects/`.

### Build artifacts for deployment

```text
data/schemes + GEMINI_API_KEY --npm run ingest--> server/data/vectorstore.json
data/faq/questions.json      --npm run prewarm--> server/data/faq.json
data/eligibility/*.json      --bundled directly by Vercel
```

`vercel.json` includes `server/data/*.json` and `data/eligibility/*.json`. Build the vector store
and FAQ cache locally and commit them before deploy. Current `server/data/vectorstore.json` exists;
`server/data/faq.json` is absent until `npm run prewarm -w server` runs.

## Dialect registry and identification

The registry at data/dialects/registry.json is validated with zod when the server loads it. Each
dialect has a stable id, display and native names, parent answer language, states, suggested
districts, confusion hypotheses, and an experimental status. nativeNameVerify: true marks a
spelling that needs review. Registry validation checks unique ids, supported parent languages, and
that every confusableWith value refers to a dialect or standard classifier label.

The confusableWith pairs are hypotheses for later evaluation; they have not been verified.
Confidence reflects agreement across model views, not calibrated accuracy. No real-audio evaluation
has been run for these labels.
Every current dialect maps to Hindi (hi). Unsupported Gujarati, Punjabi, and other languages
produce no confident dialect result unless the user confirms one; the answer language then falls
back to the confirmed dialect's parent, selected language hint, or Hindi.

For audio, the classifier uses separate audio-only, transcript-only, and combined views, limited
by the calibrated ensemble size (default 3). The Gemini schema restricts each view to the current
active dialect ids plus standard-language classes. Geography is not provided as evidence. Ties,
mixed speech, weak evidence, low vote counts, timeouts, and model errors lead to an abstention. A
partial ensemble can still decide with the calls that returned. Dialect results are calculated per
request and are not cached with the grounded answer.

The standard labels are hindi (plain Hindi with no regional markers), marathi, tamil, english,
gujarati, punjabi, other_language, and mixed_or_uncertain. Only DIALECT_ACTIVE dialect ids are
eligible; standard labels remain available. A smaller active dialect set reduces competing
choices and is expected to improve accuracy.

### Real examples and measurement

`data/dialects/exemplars/<label>.jsonl` is empty until the team contributes consented native
recordings/transcripts. The zod loader validates each JSONL row. Prompt selection is deterministic,
limited by `DIALECT_EXEMPLARS_PER_LABEL` and a shared conservative token budget; when both labels have
examples, confusable pairs are rendered side by side. A label without examples remains zero-shot and
is included in the startup `no exemplars` log. Never generate dialect rows with an LLM or create
Roman spellings from Devanagari.

`data/eval/dialect/testset.jsonl` is a held-out set. With `USE_MOCKS=false` and `GEMINI_API_KEY` set,
`npm run eval:dialect` rejects any speaker id
that also appears in the exemplar files, applies a bounded row concurrency, retries Gemini errors,
and caches each row by content hash, prompt version, model, ensemble size and vote threshold. It
writes JSON and Markdown reports under `server/data/eval-report/`, including class metrics,
confusion matrix, coverage/abstention, wrong high-confidence rows, script/short-text/code-switch/
duration breakdowns and confusable-pair accuracy.

With `USE_MOCKS=false`, `npm run calibrate:dialect -- --target 0.90` sweeps ensemble size 1–3 and minimum votes 1–3. It
chooses the highest-coverage setting meeting answered precision, but refuses to write calibration
until every active label has at least 20 held-out rows. `data/dialects/calibration.json` supplies
startup defaults; explicit `DIALECT_ENSEMBLE_SIZE` and `DIALECT_MIN_VOTES` env values take priority.
The command prints per-label `tested` suggestions (20+ native rows and precision at target); registry
status changes require `--write-status`.

`POST /api/dialect/transcribe` accepts the same in-memory `audio/*` multipart upload (max 10 MB) as
the voice endpoint and returns a verbatim transcript plus a stable script enum. It supports mocks.
`npm run merge:contrib -- a.json b.json` validates contributor exports and requires `consent: true`
before writing anything. Audio is stored in `data/eval/dialect/audio/`; each anonymous speaker is
assigned wholly to exemplars or testset using a deterministic hash, with balancing to try to give
labels with multiple speakers both sides. Missing confidence and license metadata stay explicitly
`unrated` and `not-specified`.

Gemini requests share `GEMINI_MAX_CONCURRENT_CALLS` (default 8). Answer-side work enters a priority
queue; classifier calls can occupy at most cap minus one slots so one slot remains available for an
answer during a burst. When all views start together, three parallel classifier calls should take
roughly one model-call duration; queue saturation, model variance and upload/transcription time add
latency. A rolling p50/p95 of classifier duration is logged (including queue time). Real audio
latency and accuracy have not yet been measured.

## The eligibility wizard

```
  POST /api/eligibility/start  -> first useful question from data/eligibility/questions.json
  POST /api/eligibility/answer:
     answer: number / true-false / option label / plain yes-no word? --yes--> value (no AI)
                 | no: free-form, e.g. "do bigha zameen", "main kisaan hu"
                 v
             Gemini reads the value (JSON) --cannot--> 422 UNCLEAR_ANSWER, same question again
                 |
                 v
     every scheme's conditions, three-valued (yes / no / not known yet), plain code, no AI
                 |
     a scheme still undecided? --yes--> next question that can change it (the rest are skipped)
                 | no
                 v
     results: eligible first; reason = text of the condition that failed, in the user's language
```

Gemini only translates texts that have no reviewed translation and reads free-form answers;
it never decides eligibility.

## Repository layout

| Path             | What                                                                           |
| ---------------- | ------------------------------------------------------------------------------ |
| `shared/src/`    | API contract types (types only, no runtime code, no build step)                |
| `server/src/`    | Express API: one folder per module in `modules/`                               |
| `client/src/`    | React app: one folder per feature in `features/`                               |
| `data/schemes/`  | Source documents for retrieval (Markdown + front matter)                       |
| `data/dialects/` | Validated regional-variety registry used by detection and confirmation         |
| `docs/`          | This file, the [API contract](API_CONTRACT.md) and the [workstreams](TASKS.md) |

## Server

```
server/src/
  index.ts            loads data (startup.ts), then starts the HTTP server (dev, npm start)
  app.ts              the app as a default export, without listen(): the entry on Vercel
  createApp.ts        middleware + one router per module, mounted under /api
  startup.ts          loads the knowledge base, FAQ and rules; warns about missing / stale data
  config/env.ts       .env loading and zod validation (fails fast on bad values)
  modules/<name>/     routes.ts -> controller.ts -> service.ts (+ prompts.ts for AI modules)
    dialect/          registry validation, closed-label Gemini ensemble, pure vote decision
    rag/              documents, chunking, vectorStore, prompts, service
    eligibility/      rules (format), engine (evaluation), answers, localize, prompts, service
  middleware/         errorHandler (one error format), requestLogger, upload (multer)
  lib/                geminiClient, cache (LRU), languages, vectors, logger, httpError, validation
  mocks/              mock data (mirrored in client/src/mocks)
server/scripts/       ingest.ts, prewarm.ts, query.ts (npm run ingest | prewarm | query)
server/test/          vitest unit tests (npm test -w server)
server/data/          generated: vectorstore.json, faq.json (commit them for deploys)
```

Each module has the same three layers:

- **routes.ts**: paths and middleware only.
- **controller.ts**: HTTP. Validates the request with zod, types the response with the contract
  type, calls the service. No business logic.
- **service.ts**: the logic, as plain async functions that other modules can call
  (`chat` calls `rag.searchSchemes` and `sms.countSmsSegments`; `voice` calls
  `chat.answerQuestion`).

Every service decides between mock and real at the top:

```ts
if (isMocked('rag')) return mockSearchSchemes(input.query, topK).map(fromMockChunk);
// real implementation follows
```

All AI calls go through `lib/geminiClient.ts` (`@google/genai`): structured JSON generation with
a zod schema (`generateJson`) and batched embeddings (`embedTexts`). It owns timeouts, retries
with exponential backoff and jitter on 429 / 5xx / timeouts / network errors (honouring the wait
Gemini asks for), and typed `GeminiError`s that become `429 AI_RATE_LIMITED`, `502 AI_ERROR`,
`503 AI_NOT_CONFIGURED | AI_UNAVAILABLE` or `504 AI_TIMEOUT`. Tests swap in a fake backend with
`setGeminiBackend`. Prompts live in the module that owns them (`prompts.ts`).

### Mock mode

- `USE_MOCKS=auto` (default): the real pipeline when `GEMINI_API_KEY` is set, otherwise every
  module serves mock data.
- `USE_MOCKS=true`: every module serves mock data, with no API key needed. The voice route ignores
  the recording and answers a canned question.
- `USE_MOCKS=false`: everything real. Needs `GEMINI_API_KEY`, the knowledge base
  (`npm run ingest -w server`) and, for `/api/faq/top`, the FAQ (`npm run prewarm -w server`).
  Without them the endpoints answer 503 with the command to run; the eligibility wizard works
  without AI as long as answers are exact values or plain yes / no words.
- `USE_MOCKS=eligibility,sms`: **only the listed modules** stay mocked. This lets one workstream
  switch its own module to the real implementation while the others keep working.
  Module names: `voice, chat, dialect, rag, eligibility, sms, tts, faq`.
- `VITE_USE_MOCKS=true`: the browser answers from `client/src/mocks` and never calls the server
  (frontend-only work or a static demo deploy). The mock files `query.ts`, `eligibility.ts` and
  `faq.ts` are identical copies in `server/src/mocks` and `client/src/mocks`.

Logic that needs no AI: text language detection, retrieval scoring and the relevance gate, the
eligibility rules, SMS segment counting and the sentence-boundary fallback, the answer cache.

## Client

```
client/src/
  app/              shell: App, routes, SiteShell (landing + app modal), Dock, providers
  features/landing/ the scrollytelling landing page: hero/, chapters/, intro, sky, strings.ts
  features/app-shell/ the app's frame: desktop phone sheet, phone full screen, 3-tab nav
  features/<name>/  screens and components of one feature, its strings.ts, its hooks
  components/ui/    Button, Card, Badge, Spinner, Toast
  components/art/   Saathi the mascot, PhoneFrame, hand-drawn doodles (all inline SVG / CSS)
  components/motion/ MaskedLines, CyclingText, reveal props
  lib/              api.ts (typed client), config.ts, i18n.ts, settings.ts, storage.ts
  lib/motion/       easings, useMotionTier, MotionProvider, GSAP and Lenis loaders
  mocks/            in-browser API used when VITE_USE_MOCKS=true
  prerender.tsx     build-time render of "/" (see below)
```

- **Routes:** `/` is the landing page. `/app`, `/app/eligibility` and `/app/sms` are the app
  (chat, eligibility wizard, SMS preview with low-bandwidth mode and offline FAQ), loaded as
  separate chunks. Desktop (1024 px and wider): the app is a route modal over the landing page,
  in a phone frame that the dock's "Open app" pill morphs into (backgroundLocation state: Back
  closes it, tab switches replace history). Phones: the app is full screen and slides up. The
  old `/chat`, `/eligibility` and `/sms` paths redirect.
- **Look:** "Leaf & Marigold" tokens (paper, ink, leaf, marigold, accent text, dusk, pastels),
  radii, warm shadows, easings and keyframes live in `src/index.css` (`@theme`); change them
  there to re-theme everything. Display text uses self-hosted, subset variable fonts
  (Bricolage Grotesque, Anek Devanagari / Tamil, built by `client/scripts/subset-fonts.py`);
  body text stays on system fonts.
- **Motion:** `useMotionTier()` is `full` (desktop with a mouse: pinned story, parallax, Lenis
  smooth scroll), `lite` (phones and low-end devices: no pinning, no blur) or `reduced`
  (`prefers-reduced-motion` or low-bandwidth mode: fades only). Motion (`motion/react`, lazily
  loaded features) for components; GSAP + ScrollTrigger only for the pinned story, loaded with it.
  Animations use transform, opacity and clip-path. Indic text is animated per word or line,
  never per character.
- **Prerendering:** `npm run build` also renders `/` to HTML (`src/prerender.tsx` +
  `scripts/prerender.mjs`), so the landing page paints before any JavaScript; the intro and the
  hero entrance are pure CSS for the same reason, and the JS is requested after the first paint.
  A head script in `index.html` hides that HTML when it cannot match the visit (another
  language, low-data mode, another path) and the app renders from scratch instead.
- **State:** `SettingsContext` (language, low-bandwidth mode, session id; saved in localStorage),
  `ChatContext` (the conversation; survives switching screens), `ToastContext`.
- **API:** components never call `fetch`; they use `api` from `lib/api.ts`, which is typed with
  the contract and switches to the mocks when `VITE_USE_MOCKS=true`.
- **Translations:** each feature has a `strings.ts` with the four languages
  (`Strings<typeof en>` makes the build fail if a key is missing). Use
  `const t = useStrings(myStrings)`. Answers come from the API already translated.
- **Accessibility for low-literacy users:** big touch targets (48 px or more), icons with every
  label, language names in their own script, read-aloud buttons, WCAG AA contrast, visible focus,
  and system fonts for all body text.
- **Low-bandwidth mode:** text first, no server audio (Listen uses the phone's voice), top answers
  cached on the device. The service worker and offline shell come in step 3.
- **Listen and honest labels:** `features/voice/speak.ts` plays server speech when it can
  (`serverTts.ts`: cache, 20 s deadline, `dialectId` only for dialect-worded text) and the browser
  voice otherwise; under a dialect-worded answer the bubble says the wording is experimental, and
  after speech it says when the voice is only a Hindi-voice approximation (`VoiceNoteLine.tsx`,
  strings in four languages).

## Configuration

One `.env` at the repo root (template: `.env.example`) feeds both apps; an optional
`server/.env` overrides it for the server, and real environment variables override both. The
server reads all variables; Vite exposes only `VITE_*` variables to the browser, so **secrets
must never use the `VITE_` prefix**. In dev, Vite proxies `/api` to the server port, so the
client needs no `VITE_API_URL` and the server needs no CORS setup. If the client is served from
another origin, set `VITE_API_URL` on the client and add the client's URL to `CLIENT_ORIGIN`.

Every variable (validated in `server/src/config/env.ts`; an empty value means "use the default"):

| Variable                        | Default                                       | What it does                                                                                              |
| ------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                      | `development`                                 | `production` lowers the default log level to `info`; `test` skips `.env` files                            |
| `PORT`                          | `4000`                                        | HTTP port of the API (and the target of the Vite dev proxy)                                               |
| `USE_MOCKS`                     | `auto`                                        | `auto` (real when `GEMINI_API_KEY` is set), `true`, `false`, or the modules that stay mocked: `voice, chat, dialect, rag, eligibility, sms, tts, faq` |
| `CLIENT_ORIGIN`                 | `http://localhost:5173`                       | Origins allowed by CORS, comma-separated                                                                  |
| `LOG_LEVEL`                     | `debug` (dev), `info` (prod), `error` (tests) | `debug`, `info`, `warn` or `error`; debug shows each Gemini call with timings and token counts            |
| `GEMINI_API_KEY`                | none                                          | Google AI Studio key. Needed for every real AI call; server only                                          |
| `GEMINI_CHAT_MODEL`             | `gemini-3.8-flash`                            | Answers, SMS rewrite, eligibility answer reading and translation, query translation                       |
| `GEMINI_FALLBACK_MODEL`         | `gemini-3.6-flash`                            | Retry model for temporary primary-model errors; `none` disables fallback                                |
| `GEMINI_AUDIO_MODEL`            | `GEMINI_CHAT_MODEL`                           | Speech-to-text and language identification                                                                |
| `GEMINI_TTS_MODEL`              | `gemini-3.8-flash-lite-tts`                   | Server speech (`POST /api/tts`); `none` keeps browser speech only                                         |
| `GEMINI_TTS_DIALECT_MODEL`      | `gemini-3.8-flash-tts`                        | Speech model for dialect-worded replies; `none` uses `GEMINI_TTS_MODEL` for them too                       |
| `GEMINI_TTS_SAMPLE_RATE`        | `16000`                                       | `16000`, `24000` or `8000`; falls back to `24000` once if the API refuses the rate                        |
| `TTS_TIMEOUT_MS`                | `GEMINI_TTS_TIMEOUT_MS`                       | Per-call speech deadline (1000–120000); the older name `GEMINI_TTS_TIMEOUT_MS` (default `15000`) still works |
| `TTS_MAX_CHARS`                 | `600`                                         | Longer texts are split at sentence ends and the pieces joined into one WAV (100–2000)                      |
| `TTS_STYLE`                     | empty                                         | One constant delivery style for every voice (e.g. "calm and clear"); never an accent                      |
| `GEMINI_EMBED_MODEL`            | `gemini-embedding-2`                          | Embedding model used by `npm run ingest`; queries always use the model the knowledge base was built with  |
| `GEMINI_EMBED_DIMENSIONS`       | `768`                                         | Embedding size for ingestion (128–3072)                                                                   |
| `GEMINI_THINKING_LEVEL`         | `low`                                         | `minimal`, `low`, `medium`, `high`, or `default` (let the model decide). Higher = slower, more careful    |
| `GEMINI_TIMEOUT_MS`             | `30000`                                       | Timeout per Gemini call                                                                                   |
| `GEMINI_MAX_RETRIES`            | `3`                                           | Retries on rate limits, 5xx, timeouts and network errors (0–8)                                            |
| `GEMINI_MAX_CONCURRENT_CALLS`   | `8`                                           | Shared Gemini call cap; classifier work leaves one slot available for answer-side work (2–64)             |
| `DIALECT_ENSEMBLE_SIZE`         | `3` (or calibration file)                     | Independent audio, transcript, and combined views (1–3); explicitly set env value overrides calibration   |
| `DIALECT_MIN_VOTES`             | `2` (or calibration file)                     | Agreeing votes required to select a label (1–3); explicitly set env value overrides calibration           |
| `DIALECT_TIMEOUT_MS`            | `6000`                                        | Per-view classification deadline; failures never fail the answer                                          |
| `DIALECT_TEXT_DETECT`           | `false`                                       | Classify typed questions from transcript text (one view; set minimum votes to 1 for a confident result)   |
| `DIALECT_ACTIVE`                | `all`                                         | `all` or comma-separated dialect ids; a smaller set means higher accuracy                                 |
| `DIALECT_EXEMPLARS_PER_LABEL`   | `4`                                           | Maximum deterministic real examples injected per label                                                    |
| `DIALECT_EXEMPLAR_TOKEN_BUDGET` | `1800`                                        | Shared conservative budget for prompt examples; whole examples are omitted when the budget is exhausted   |
| `DIALECT_REPLY`                 | `mirror`                                      | Dialect wording of replies: `mirror` (also rewords spoken answers towards the speaker's own words), `best_effort` (confirmed or high-confidence dialect), `verified_only` (only `"verified": true` in `server/src/config/dialect-render.json`), `off` |
| `DIALECT_RENDER_TIMEOUT_MS`     | `8000`                                        | Longest wait for the rewording step before the standard answer is used (500–60000)                        |
| `RAG_TOP_K`                     | `4`                                           | Chunks retrieved per question (1–10)                                                                      |
| `RAG_MIN_SCORE`                 | `0.5`                                         | Cosine similarity a chunk needs to be used; none left means `notFound`. Calibrate with `npm run query`    |
| `RAG_TRANSLATE_QUERY`           | `false`                                       | Translate non-English questions to English before embedding (one extra Gemini call)                       |
| `CACHE_MAX_ENTRIES`             | `500`                                         | Answers kept in the in-memory cache; `0` disables it                                                      |
| `CACHE_TTL_MINUTES`             | `360`                                         | How long a cached answer lives; `0` = until evicted                                                       |
| `SMS_MAX_SEGMENTS`              | `2`                                           | SMS length limit in segments (1–10)                                                                       |
| `RATE_LIMIT_PER_MINUTE`         | `30`                                          | Requests per minute per IP to the AI endpoints (voice, chat, rag, eligibility, sms); `0` = no limit       |
| `TRUST_PROXY`                   | `1`                                           | Proxy hops in front of the server, so the limit sees the real client IP (1 on Vercel)                     |
| `VITE_API_URL`                  | empty (same origin)                           | Client: API origin, e.g. when the API runs on another domain                                              |
| `VITE_USE_MOCKS`                | `false`                                       | Client: answer from `client/src/mocks` in the browser and never call the server                           |

Model defaults follow the Gemini API docs at the time of writing
([models](https://ai.google.dev/gemini-api/docs/models),
[embeddings](https://ai.google.dev/gemini-api/docs/embeddings)); they are plain strings, so
switching models is a config change. Changing the embedding model or size needs a new
`npm run ingest`.

## Roadmap and TODO markers

| Step | Scope                                                                                                                                                                                                                                                                  | Status                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1    | Skeleton: contract, mocks, UI, tooling                                                                                                                                                                                                                                 | Done                                                                                         |
| 2    | Gemini speech-to-text and language detection, retrieval over in-memory embeddings, grounded answers, SMS compression, eligibility rules from data, FAQ prewarm, real mic recording                                                                                      | Built; not yet run with a real key on this branch                                            |
| 2b   | Conversation layer (intent routing), dialect identification, dialect-worded replies with facts lock, server speech with `basis` labels, pipeline audit (branches `feat/conversation-layer`, `feat/dialect-voice`)                                                      | Built and tested with fake models; real runs and native review pending ([RUNBOOK](RUNBOOK.md)) |
| 3    | Vector DB, semantic answer cache, PWA (service worker, offline shell), deployment hardening; faster voice path (6 sequential model calls today)                                                                                                                        | `TODO(step-3)`                                                                               |
| Next | More languages and schemes, a dialect selector in the UI (the API already takes `dialectHint`), WhatsApp channel, streamed speech for long answers                                                                                                                      | Not started                                                                                  |

Find the work: `git grep -n "TODO(step-2)"` (or `step-3`, or `TODO(review-native)` for strings a
native speaker must review).

## Design decisions

- **Contract first, mocks everywhere.** Every workstream can build against realistic data from
  hour 0, and integration is a config switch instead of a merge marathon.
- **Types-only `shared` package.** Both apps import it with `import type`, so it is erased at
  build time: no build step, no bundling of a workspace package into the server. An ESLint rule
  keeps runtime code out of it. Runtime lists such as language codes live in each app, typed as
  `Record<LanguageCode, ...>` so they cannot drift from the contract.
- **CommonJS server compiled by `tsc`.** Relative imports need no file extensions, `tsx`
  runs it in dev and `node dist/index.js` in production.
- **No vector database (yet).** A few thousand chunks fit in memory and brute-force cosine
  similarity takes milliseconds, so the knowledge base is one JSON file built by
  `npm run ingest` and loaded at startup. Each query is embedded with the same model and size
  as the stored chunks.
- **Structured output everywhere.** Every Gemini call returns JSON checked against a zod schema
  (e.g. the answer must cite passage ids that were actually sent), so the code never parses
  free text.
- **Grounded or nothing.** Answers cite their sources; with no relevant source the API says
  `notFound` instead of guessing. The fraud warning is static text, never model output.
- **Deterministic eligibility.** Rules are data (`data/eligibility/`) evaluated by plain code,
  never an LLM: the same answers always give the same result. Gemini only translates missing
  texts and reads free-form answers into values.
- **Built for basic phones.** SMS output respects segment limits (Indic scripts use Unicode SMS:
  70 characters, or 67 per part), and low-bandwidth mode keeps answers available offline.
