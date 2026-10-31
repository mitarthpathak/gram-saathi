# Decisions

## Conversation routing

- **Decision:** Every live typed message and every voice transcript goes through the same intent-understanding step. Only `scheme_question` may retrieve passages; its query is requested in English and skips legacy query translation.
- **Alternatives considered:** Keep a deterministic greeting classifier in front of RAG; translate non-English input in the RAG module; continue retrieving for all messages.
- **Why:** The model must distinguish clarifications and social messages before retrieval. The explicit English query prevents duplicate translation and improves search consistency.

## Session history and caching

- **Decision:** Live chat uses process-local six-turn history capped at 500 LRU sessions. The old answer cache remains on the mocked chat path; live turns are not served from the answer cache.
- **Alternatives considered:** Cache live results by question; cache only grounded answers; move memory into shared storage.
- **Why:** A repeated utterance can be a clarification whose meaning depends on the previous assistant answer. Caching before intent understanding can return a scheme result for a clarification. Shared durable memory is outside this demo's scope.

## Dialect confidence

- **Decision:** A user-confirmed dialect is always passed as a hint. Automatic dialect output is passed only when the existing repo classifier marks it high confidence; medium results and abstentions do not override language understanding.
- **Alternatives considered:** Pass medium-confidence labels; disable all automatic dialect hints.
- **Why:** The classifier's confidence is not calibrated for production. A user confirmation is stronger evidence, and the repo already treats medium confidence conservatively.

## Server-side TTS

- **Decision:** Gemini TTS is implemented against the current official speech-generation API, and is enabled only when `GEMINI_TTS_MODEL` and `GEMINI_API_KEY` are configured. Bhashini/Dhruva remains unimplemented until the owner's callback URL, auth header and selected pipeline are confirmed.
- **Alternatives considered:** Hardcode a public example endpoint or model/service id; implement only browser speech.
- **Why:** The current Gemini docs provide the Interactions request and WAV output format. Bhashini's official docs say its compute endpoint and auth header come from an account-specific pipeline config, and an account's selected service/pipeline is required; there is no safe universal endpoint, service id or credential default. The adapter must be verified against an owner's account before it is wired.
- **References checked 2026-10-31:** [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation); [Bhashini pipeline compute](https://dibd-bhashini.gitbook.io/bhashini-apis/pipeline-compute-call); [Bhashini available models](https://dibd-bhashini.gitbook.io/bhashini-apis/available-models-for-usage).

## Scheme data

- **Decision:** Do not modify scheme data unless an official government source is fetched and its details can be verified. Preserve any unverified or sample-marked text and list it for human review.
- **Alternatives considered:** Fill gaps from prior knowledge; infer details from third-party summaries.
- **Why:** Eligibility, amounts, dates and links affect citizens and must be traceable to official sources.

## Calibration and multilingual eval inputs

- **Decision:** Calibration and eval use English standalone retrieval queries with `hi`, `mr`, `ta`, or `en` as requested answer-language metadata. No new Marathi or Tamil sample sentences are fabricated because the repo has no consented exemplars for those labels.
- **Alternatives considered:** Copy existing FAQ translations into the eval set; invent regional-language queries; omit the language-specific output-script checks.
- **Why:** The task's data policy forbids generating regional-language sample sentences. English query text still lets the harness check answer language/script for each language hint, while native-speaker input examples remain a human data-collection task.

## Existing working-tree changes and README

- **Decision:** Preserve the owner's pre-existing edits until the owner explicitly requested “push everything”; then include the staged client/config/data edits in a follow-up commit. Corrected client mock replies to use the existing native-script fixtures, and reconciled README/report statements with the reviewed sources and current runbook.
- **Alternatives considered:** Leave the staged changes uncommitted or commit them without checking native-script output and source provenance.
- **Why:** The later explicit instruction authorizes committing the owner's work. The output-script and scheme-source rules still apply, so the mock output was kept native-script and the six modified scheme summaries received official source URLs/access dates. PMAY-Gramin remains unverified.

## Health capability fields

- **Decision:** Health returns booleans for whether dialect classification and Gemini TTS have their required model/key configuration and are not mocked. The fields are optional in the shared type so older client fixtures and servers remain compatible.
- **Alternatives considered:** Return only feature-presence flags or make the new fields required immediately.
- **Why:** Capability status should tell an operator whether the server can use the real feature, while the optional additive contract preserves old fixtures.

---

# Dialect voice job (`feat/dialect-voice`, started 2026-10-31)

## Resuming from the existing agent log

- **Decision:** `docs/AGENT_LOG.md` already contained Phases 0–15 of the finished conversation-layer
  job. Those phases are not phases of this job, so this job starts at its own Phase 0 and appends
  a separate section to the same log instead of rewriting it.
- **Alternatives considered:** Treat the log as this job's progress and skip to "Phase 16"; start
  a new log file.
- **Why:** Phase names and goals differ, nothing of this job had run, and one log keeps the full
  history in one place.

## Branch base

- **Decision:** `feat/dialect-voice` is branched from `feat/conversation-layer` (not `main`).
- **Why:** The brief says to branch from `feat/conversation-layer` when it exists and is not
  merged. It is not merged (PR #9 open), and it contains the conversation router and TTS module
  this job builds on. Consequence: this branch also lacks the 18 commits `main` has gained since
  the merge base (UI redesign PRs); reconciling them is the owner's merge, not this job's.

## Verification without installable dependencies

- **Decision:** The npm registry (and PyPI) is blocked from this sandbox by the egress proxy
  (403 on CONNECT, direct DNS fails). It was not retried or routed around. Verification uses a
  sandbox kit kept outside the repo and linked as an ignored `node_modules`: real TypeScript 6.0.3,
  `@types/node`, `yaml`, and zod v4 (from zod 3.25.76's `zod/v4` build), plus shims for `vitest`
  (subset on `node:test`), `express`, `cors`, `multer`, `dotenv`, `unpdf` and `@google/genai`.
- **Alternatives considered:** Skip all verification (dishonestly thin); fetch packages from a
  mirror or GitHub (routing around the block); write the code untested.
- **Why:** The kit gives real compiler checks and real executions of the repo's own tests for
  everything that does not need Express or the Gemini SDK. Its baseline reproduces the previous
  job's real `npm test` result (132 pass / 3 known eligibility failures) once the 7 Express-bound
  tests are set aside, which is evidence the shim is faithful enough for differential checks. It
  is still not the repo's toolchain: every result from it is labelled "sandbox shim", and
  `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and the client remain NOT-TESTED
  here and are listed for the owner.

## Recon notes file

- **Decision:** `docs/AGENT_NOTES.md` is replaced with this job's recon; the previous job's notes
  stay in git history.
- **Why:** The old notes described the pre-conversation-layer code and would mislead.

## Audit gold set comes from repo data

- **Decision:** Stages C–E use the team-written FAQ seed questions in `data/faq/questions.json`
  (12 questions × hi/mr/ta/en) mapped to scheme ids in `server/eval/audit-goldset.json`, plus the
  10 non-scheme messages already in `server/eval/testset.json`. No new Hindi, Marathi, Tamil or
  dialect sentence was written for the audit.
- **Alternatives considered:** English-only queries with language hints (the previous job's eval
  choice); writing new Marathi/Tamil questions.
- **Why:** Native-script retrieval and answers are exactly what the audit must measure, and these
  questions already ship in the app (offline FAQ), so they are repo data rather than invented text.
  The previous job's English-only choice still stands for `npm run eval`.

## Diagnostics observer in the Gemini client

- **Decision:** `server/src/lib/geminiClient.ts` gained `setGeminiObserver()`, called after every
  generate/embed attempt with label, model, timing and (in memory only) the prompt text. Unset by
  default; it changes no behaviour.
- **Why:** The audit must show whether a dialect instruction reached a generation prompt and how
  many sequential calls a request makes. Wrapping the private SDK backend from outside was not
  possible without exporting it, which would be a larger change.

## Audit thresholds (documented, not tuned)

- Retrieval recall@k: PASS ≥ 0.9, PARTIAL ≥ 0.6 per language. Speech CER: PASS ≤ 0.15 with the
  right language, PARTIAL ≤ 0.35. Latency shape: more than 4 sequential model calls per request is
  flagged FAIL. TTS duration plausibility: 2–30 characters per second (catches empty or truncated
  audio, not accents).
- **Why:** Fixed, simple cut-offs make runs comparable; they are reported next to every result so
  the owner can disagree with them. Nothing human-judged (dialect quality, accent) is ever PASS.

## Audit process layout

- **Decision:** `npm run audit -w server` runs three worker processes: `configured` (the API as
  `.env` configures it), `mock-reference` (only when the configured run is not fully mocked, to
  reproduce mock behaviour for the "ki keh raho he" verdict) and `fake` (`NODE_ENV=test`,
  `USE_MOCKS=false`, no key, fake Gemini backend, for error codes and call shape). Each worker
  reaches the API through the real Express app on a local port, or — when the app cannot start —
  by calling the controllers and the error handler directly, which the report states.
- **Why:** Each mode needs a clean environment (`env.ts` is parsed once per process), a crashed
  worker must not crash the audit, and the fake worker must never read a developer's real key.

## Generated audit files and recordings

- **Decision:** `docs/PIPELINE_AUDIT*.md`, `audit/` and `eval/review/` are excluded from Prettier
  (rewritten on every run); `eval/out/` (generated speech) and `eval/audio/*.wav` (real voices,
  personal data) are git-ignored.

## Dialect replies: two steps and a facts lock

- **Decision:** The answer prompt no longer carries any dialect instruction: the grounded answer
  (and every conversational reply) is written in the standard base language. A separate step
  (`server/src/modules/chat/dialectRender.ts`) rewords only the wording into the dialect, and a
  deterministic facts lock (`checkFactsLock` in `server/src/lib/facts.ts`) rejects any rewrite
  whose numbers (any digit script), rupee amounts, URLs/domains, hyphenated phone numbers or scheme
  names differ from the standard answer. Rejections, timeouts (`DIALECT_RENDER_TIMEOUT_MS`), model
  errors, non-native-script output, newly added Roman words and rewrites far longer than the
  original (> 1.6× + 40 characters) all keep the standard answer, and `answerStyle` says why.
- **Policy:** a user-confirmed `dialectHint` always applies; a classifier result applies only at
  `high` confidence; medium/abstention gives `low_confidence`; typed text without a hint has no
  dialect. The understand step's free-form `dialect` guess is no longer used for anything (it used
  to style the answer prompt even for typed text with no hint, against the conservative policy).
- **Details:** Fixed reviewed texts (not-found) are never reworded (`render_off`); a reply whose
  language is not the dialect's parent language is not reworded (`render_off`, rewording is not
  translation); non-native or new Roman output is reported as `error`. The SMS keeps the checked
  standard wording and is computed in parallel with the rewording, so a dialect reply adds one
  model call but no sequential step (fake-backend shape: 4 sequential). The rewording call uses
  the label `reply-dialect` so it shares the answer lane of the concurrency limiter, not the
  classifier lane. All 14 dialects currently have zero consented exemplars, so every rewording is
  zero-shot best effort; this is logged and visible in the audit, not added to the contract.
- **Next step rule:** the tone guide asks the rewording to keep an existing next step; it cannot add
  one because it only sees the standard answer, not the passages (adding content would break the
  "wording only" guarantee).
- **Scheme names in the lock:** a small alias table built from repo text (`data/schemes` names,
  `data/faq/questions.json` Devanagari and Tamil spellings); generic words such as "किसान" are not
  aliases. A domain such as pmkisan.gov.in counts as a PM-KISAN mention.
- **Test change:** `server/test/conversation.test.ts` asserted "spoken the braj way" in the answer
  prompt; it now asserts the opposite, which is the intended new behaviour.
- **Alternatives considered:** one-step generation in dialect (no way to check facts); comparing
  only digits (misses URLs and scheme names); rewording the SMS too (unchecked facts in SMS).

## Clarifications cannot introduce facts

- **Decision:** A smalltalk / clarify / out-of-scope reply whose numbers, rupee amounts, URLs or
  phone numbers are not all present in the session's earlier assistant answers is replaced by a
  fixed "please ask again" message (`ASK_AGAIN` in `chat/messages.ts`; Hindi, Marathi and Tamil
  marked for native review).
- **Why:** This is the real-mode guard for the reported "ki keh raho he" class of bug: the intent
  router exists (so a fix is in scope), but a clarification produced by the model was never
  checked against what the user had actually been told.

## Server speech (Phase 3 of the dialect voice job)

This supersedes the "enabled only when `GEMINI_TTS_MODEL` is configured" part of
[Server-side TTS](#server-side-tts); the Bhashini part stands.

- **Decision:** `POST /api/tts` calls Gemini TTS through `server/src/lib/geminiClient.ts`
  (`synthesizeAudio`: the shared `withRetries`, typed `GeminiError`s, the answer lane of the
  concurrency cap, the diagnostics observer with label `tts`, and a hard timeout race). The backend
  makes the documented REST call (`POST /v1beta/interactions`, `x-goog-api-key` header,
  `input[].content[]` text with optional `speech_metadata.style`, `response_format {type: audio,
mime_type: audio/wav, sample_rate}`, `generation_config.speech_config [{voice}]`) with `fetch`
  rather than SDK methods, so it does not depend on SDK typings for the Interactions speech fields.
  The installed SDK in the lockfile is `@google/genai` 2.32.0 (≥ 2.24.0 required for
  `voices.list`); no upgrade was needed. The SDK backend's `synthesize` delegates to the exported
  `synthesizeViaRest`, which tests drive with a fake `fetch`.
- **Defaults (from the brief):** `GEMINI_TTS_MODEL=gemini-3.8-flash-lite-tts`,
  `GEMINI_TTS_DIALECT_MODEL=gemini-3.8-flash-tts` (used whenever a valid dialect of the text's
  language is sent), `GEMINI_TTS_SAMPLE_RATE=16000`, `TTS_MAX_CHARS=600`, `TTS_STYLE` empty,
  `TTS_TIMEOUT_MS` (falls back to the existing `GEMINI_TTS_TIMEOUT_MS`, 15 s). `none` disables a
  model. Consequence: in real mode server speech is now **on by default**; an existing `.env` with
  an empty `GEMINI_TTS_MODEL=` (the old "off") now gets the default model. Set `none` to keep the
  browser voice only. Mock mode is unchanged: no provider call, `audioUrl: null` (plus the new
  optional `basis: 'none'`).
- **Retries:** at most one retry (`min(1, GEMINI_MAX_RETRIES)`) because a person is waiting; any
  failure returns `audioUrl: null` so the client falls back to browser speech instead of an error.
- **Sample rate:** if the API answers 400 at the configured rate, one retry at 24000 Hz (the
  documented default); only if that succeeds is the smaller rate remembered as rejected for the
  rest of the process. Other errors are not retried this way.
- **Basis:** `named-dialect` for registry dialects that `dialect-render.json` marks
  `ttsNamedLanguage` (Bhojpuri, Awadhi; Chhattisgarhi, Magahi and Maithili are also named by the
  docs but are not registry dialects), `base-language-approximation` for the other twelve,
  `language` without a dialect, `none` without audio. It describes what the TTS model claims,
  not what it sounds like: nothing about pronunciation or accent is verified.
- **Contract:** `TtsRequest.dialectId?` (validated against the registry like `dialectHint`; a
  dialect of another language is ignored) and `TtsResponse.basis?`, both optional. The client
  must send `dialectId` only with dialect-worded text.
- **Text:** spoken exactly as given. Only Markdown markers and emoji are removed
  (`speechText.ts`); Indic joiners (ZWJ/ZWNJ), numbers, URLs and numbered lists are kept. Over
  `TTS_MAX_CHARS`, the text is split at sentence ends (`.!?।॥` followed by a space, so domains and
  decimals stay whole), then at clause ends, then between words; pieces are synthesized in
  parallel and joined into one WAV with 250 ms of silence between them.
- **Payload and cache:** data URLs over 3,000,000 characters are dropped (`null`), about 70 s of
  audio at 16 kHz or 47 s at 24 kHz, so very long answers fall back to the browser voice. A
  24-entry, 1-hour in-memory LRU per process caches finished audio by SHA-256 of (text, voice,
  model, rate, style). Logs carry the model, voice entry, piece count, byte size and error kind,
  never the text or the key.
- **Voices:** `server/src/config/tts-voices.json` maps each language (and optionally a dialect) to
  `{ voice }` or `{ voiceId }`. All defaults are the prebuilt `Kore` (the voice used in the
  official examples), `"status": "to-be-auditioned"`. `npm run tts:voices -w server` lists
  Extended Voice Library candidates; `npm run tts:samples -w server` renders the existing
  greeting of each language (no scheme facts, no invented dialect text) per configured voice.
  Neither script was run against the real API here (no key): both were exercised only against a
  fake `fetch`/backend in the sandbox. No voice was designed or replicated; the manual,
  consent-first process is in docs/RUNBOOK.md.
- **Verified against docs (fetched 2026-10-31, page "Last updated 2026-10-28 UTC"):** the request
  shape above; audio at `steps[].content[]` (`type: audio`, `.data`) in REST and `output_audio.data`
  in the SDKs; WAV is the unary default, `audio/l16` headerless PCM; sample rates 24000/16000/8000
  appear in examples; both models list Hindi, Marathi, Tamil, English, Awadhi, Bhojpuri,
  Chhattisgarhi, Magahi and Maithili, and do not list Braj, Marwari, Rajasthani, Haryanvi,
  Bundeli or Bhili/Wagdi; `GET /v1beta/voices` filters (`language_code`, `region_code`, `accent`,
  …, `page_size` ≤ 1000, `page_token`/`next_page_token`) and voice fields (`id`, `display_name`,
  `language_code`, `accent`, `gender`, `pitch`, `description`); style must not be used for
  permanent accent changes.
- **UNVERIFIED:** (1) that a library or designed voice id goes in `speech_config.voice` like a
  prebuilt name (the docs print `voice.id` but show no request using it); (2) REST field casing of
  the voices list (the script accepts snake_case and camelCase); (3) the 8,192-token input limit
  in the brief (not stated on the page fetched; 600-character pieces stay far below it anyway);
  (4) whether the API accepts 16000 Hz for every model (hence the fallback); (5) whether the
  response carries a `mime_type` (the code checks for a RIFF header instead).
- **Alternatives considered:** the SDK's `interactions.create` (typings for speech fields would
  have to be trusted or cast); streaming audio (larger change, not needed for a Listen button);
  returning an error status on provider failure (the client would need new handling; `null`
  already means "use the browser voice").

## Client: Listen, honest labels, low-bandwidth (Phase 4 of the dialect voice job)

- **Decision:** `speak()` (client/src/features/voice/speak.ts) plays the answer's `audioUrl`, else
  `POST /api/tts { text, language, dialectId? }`, else browser speech synthesis, and returns who
  spoke plus the server's `basis`. `dialectId` is sent only when `answerStyle.rendered ===
  'dialect'`, so standard text is never labelled or voiced as a dialect.
- **Low-bandwidth fix:** the setting is documented as "no server audio", but the old `speak()`
  still called `/api/tts` (only the answer's `audioUrl` was suppressed). Now low-bandwidth mode
  never requests or plays server audio, for every Listen button (the button reads the setting
  itself, so the eligibility wizard is covered too) and for the automatic reply after a voice
  question.
- **Labels:** under a dialect-worded answer the bubble shows "बोली का रूप, प्रयोगात्मक" (and the
  dialect's native name) unless `GET /api/dialects` marks that dialect `tested`; an unknown or
  unreachable status counts as experimental. After speaking dialect-worded text, the bubble shows
  "आवाज़ हिन्दी में, बोली का उच्चारण अनुमानित" for every voice except server audio whose basis is
  `named-dialect` (that gets "बोली की आवाज़, प्रयोगात्मक", since nobody has listened to it yet).
  The browser's voice reading dialect text is always labelled an approximation. Strings follow the
  `strings.ts` pattern in all four languages; the new Marathi and Tamil strings carry
  `TODO(review-native)`.
- **Progress:** the server cannot report which step it is on, so the existing typing indicator
  only switches to a generic "still working on the answer" after 6 s (dialect wording adds a
  step), and the Listen button shows "Preparing audio…" with dots while server speech is fetched.
- **Failure message:** browser speech now resolves on the utterance's `start` (or after 2.5 s,
  since some engines never fire it) and fails on `error`, so the one localized "Audio playback is
  unavailable" toast appears only when server and browser speech both fail. Starting new speech
  also stops server audio that is still playing.
- **Client API:** `api.dialects()` (existing `GET /api/dialects`, contract v3) was added to the
  client `Api` interface; the client mock returns no dialects.
- **Alternatives considered:** a dialect selector or candidate chips (a redesign, out of scope);
  hard-coding "experimental" for all dialects (true today, wrong once a dialect is marked tested);
  streaming progress events from the server (larger change than the brief allows).
