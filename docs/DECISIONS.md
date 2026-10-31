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
