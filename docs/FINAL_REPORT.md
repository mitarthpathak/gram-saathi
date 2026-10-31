# Dialect voice delivery report

Date: 2026-10-31 · Branch: `feat/dialect-voice` (from `feat/conversation-layer` at `1b5d297`) ·
Not merged, no pull request.

The previous job's report (conversation layer, PR #9) is in git history:
`git show 1b5d297:docs/FINAL_REPORT.md`. Its open owner items are carried over at the end of this
file.

## Verdict

The code for dialect-worded replies, the facts lock, server speech with honest labels and the audit
harness is written and tested **with fake models only**. **Nothing in this job has been run against
the real Gemini models**, no real speaker has been recorded and no native speaker has reviewed a
reply or listened to a voice. The deployed app (`https://gram-saathi.vercel.app`) is an older `main`
build running on **mock data** (`/api/health` → `{"status":"ok","mocks":true}`, re-checked
2026-10-31). Every statement below says how it was checked.

## What each phase did and how it was verified

| Phase                           | Commit    | Done                                                                                                                                                                                                                                                                                                                                                                                                       | Verified (sandbox, no key)                                                                                                               | Not verified                                                                 |
| ------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 0 Recon                         | `4c62fcb` | Text, voice, dialect and Listen flows mapped with file paths; 9 contradictions recorded ([AGENT_NOTES.md](AGENT_NOTES.md)).                                                                                                                                                                                                                                                                                | Code reading; mock functions run with `tsx`.                                                                                             | —                                                                            |
| 1 Audit harness                 | `0bc0b90` | `npm run audit -w server` (Stages A–J, readiness matrix, "ki keh raho he" verdict), baseline report, `eval/audio/README.md`, review sheet.                                                                                                                                                                                                                                                                 | Harness unit tests; baseline run in mock mode.                                                                                           | Real-mode stages (no key); Stage H (no client).                              |
| 2 Dialect replies               | `6f70381` | Standard grounded answer first, then `renderInDialect()` rewords wording only; deterministic facts lock (digits in 3 scripts, ₹ amounts, URLs, phone numbers, scheme names); `answerStyle` with reason; `DIALECT_REPLY`, `DIALECT_RENDER_TIMEOUT_MS`; `dialect-render.json` (all `verified: false`); clarifications may not add facts. The understand step's own dialect guess no longer styles any reply. | 23 new unit tests with a fake model; audit check `I-clarify-guard`.                                                                      | Real rewording quality (NEEDS-HUMAN); real-model routing.                    |
| 3 Server speech                 | `dbf514c` | `POST /api/tts` through `geminiClient` (retry, timeout, concurrency lane, cache, Markdown/emoji strip, sentence split, 3 MB cap, 24 kHz fallback); `dialectId` in, `basis` out; `tts-voices.json` placeholders; `tts:voices`, `tts:samples` scripts; voice design/replication documented as owner-only.                                                                                                    | 28 unit tests with a fake `fetch`/backend; audit checks `I-tts-*`, `J-shape-tts*`.                                                       | Any real audio, voice id, accent or pronunciation.                           |
| 4 Client                        | `36895b1` | Listen: answer audio → `POST /api/tts {text, language, dialectId?}` → browser voice; one localized message only if both fail; low-bandwidth never fetches server audio (bug fix); honest dialect/voice notes in 4 languages; slow-answer text.                                                                                                                                                             | Phase 4: `tsc` over `client/src` with loose shims and a Node harness (12/12). Phase 6: the real `speak()` in real Chromium (7/7, below). | Client typecheck/build with the real toolchain; phones; how the labels look. |
| 5 Audit re-run                  | `38689dd` | Before/after report; [AUDIT_FINDINGS.md](AUDIT_FINDINGS.md) (4 fixed, 11 not; Phase 6 settled N6 for the registry and added N12–N14).                                                                                                                                                                                                                                                                      | Mock-mode audit; no matrix cell changed (expected without a key).                                                                        | Everything real-mode.                                                        |
| 6 Docs and report (this commit) | —         | README, ARCHITECTURE, API_CONTRACT, TASKS, DECISIONS, RUNBOOK, this report; audit variables added to `.env.example`; independent re-check below.                                                                                                                                                                                                                                                           | See next section.                                                                                                                        | —                                                                            |

## Independent re-check in a fresh sandbox (Phase 6)

Phases 0–5 ran in an earlier agent session. This session started from a clean clone with the same
limits (npm registry blocked by the egress proxy: `CONNECT registry.npmjs.org:443` → 403; no
`GEMINI_API_KEY`), rebuilt the dependency-free check kit from scratch (real TypeScript 6.0.3,
`@types/node` 26.1.2, `yaml` 2.9.0, zod v4 from zod 3.25.76; shims for `vitest` on `node:test`,
`express`, `cors`, `multer`, `dotenv`, `unpdf`, `@google/genai`) and re-ran the checks. "Sandbox
shim" results are not `npm run typecheck` / `npm test`.

| Check                                 | Command                                                                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server + shared typecheck (shim)      | `tsc --noEmit -p server/tsconfig.json` (and `shared`)                      | 0 errors each. Negative control: a wrong `LanguageCode` in an `AnswerStyle` is reported (TS2322).                                                                                                                                                                                                                                                                                                                                 |
| Server tests (shim)                   | `tsx --test server/test/*.test.ts` with the vitest env                     | 183 pass, 10 fail — same as Phase 5. The 10: 7 need real Express (rate limit ×2, `GET /api/dialects` ×2, mock voice flow ×1, `dialectTranscribe` ×2), 3 eligibility tests fail by design (`Eligibility results are disabled until every rule is verified`).                                                                                                                                                                       |
| Audit reproducibility                 | `tsx scripts/audit.ts --skip-static --label recheck`                       | All 85 check statuses, every matrix cell and the "ki keh raho he" verdict identical to the committed run (generated files then restored).                                                                                                                                                                                                                                                                                         |
| Formatting                            | prettier 3.8.1 (repo pins ^3.9.10)                                         | 24 files differ repo-wide (29 at the branch base). Of the files this branch touched, only `docs/DECISIONS.md` was newly unformatted; it is formatted in this commit. The others were already unformatted at the base and are left alone.                                                                                                                                                                                          |
| Client Listen logic in a real browser | `speak()` bundled with esbuild, run in Chromium 153 (Playwright), stub API | 7/7: `dialectId` sent only when given; low-bandwidth makes no `/api/tts` call; `audioUrl: null` and a failed request fall back to the browser voice; answer audio plays without a request; `basis` → honest note. A WAV built with the server's own joiner (`encodeWav(concatPcm(…, 250))`) decodes in Chromium (1.45 s). Headless Chromium has 0 speech voices, so the browser fallback correctly reports failure (`ok: false`). |
| Stage H mechanism                     | Chromium `--use-file-for-fake-audio-capture`                               | Works: a tone file gives signal (peak 0.195), silence gives 0. Stage H itself stays NOT-TESTED: no client can be served (Vite not installable), no consented clip, and the deployed app is blocked by the proxy.                                                                                                                                                                                                                  |
| Deployed app                          | WebFetch                                                                   | `/api/health` → `{"status":"ok","mocks":true}`; `/api/dialects` lists all 14 registry dialects, so file tracing does ship `data/dialects/registry.json` with this `vercel.json` (finding N6 settled for the registry).                                                                                                                                                                                                            |
| Gemini TTS docs                       | WebFetch of the speech-generation page                                     | Still "Last updated 2026-10-28 UTC"; Hindi, Marathi, Tamil, English, Awadhi, Bhojpuri, Chhattisgarhi, Magahi, Maithili listed for both 3.8 models; Braj, Marwari, Rajasthani, Haryanvi, Bundeli, Bhili/Wagdi, Konkani, Dogri not listed. No input token limit is stated on the page.                                                                                                                                              |
| "ki keh raho he" on `main` (deployed) | `main`'s own mock `answerQuestion()` via `tsx`                             | Typed, mock mode: not-found text, no sources — same as on this branch. See the section below.                                                                                                                                                                                                                                                                                                                                     |
| Merge readiness                       | `git merge-tree` (read-only)                                               | This branch is 24 commits ahead and 19 behind `main`; a merge conflicts in 11 files, including the Listen path. See risk 2.                                                                                                                                                                                                                                                                                                       |

## Regional readiness matrix

From `docs/PIPELINE_AUDIT.md` (run "after", mock mode, no key). Evidence for every cell is in that
file and `audit/results.json`. "TTS names this language" is a documentation check (PASS = the TTS
language table names it; FAIL = it does not, so speech can only be a Hindi-voice approximation).

| Row                                 | Understands speech | Identifies dialect | Answers in correct language | Answers in the dialect (text) | TTS names this language | Speaks the reply | Accent matches |
| ----------------------------------- | ------------------ | ------------------ | --------------------------- | ----------------------------- | ----------------------- | ---------------- | -------------- |
| Hindi                               | MOCK-ONLY          | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | PASS                    | MOCK-ONLY        | MOCK-ONLY      |
| Marathi                             | MOCK-ONLY          | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | PASS                    | MOCK-ONLY        | MOCK-ONLY      |
| Tamil                               | MOCK-ONLY          | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | PASS                    | MOCK-ONLY        | MOCK-ONLY      |
| English                             | MOCK-ONLY          | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | PASS                    | MOCK-ONLY        | MOCK-ONLY      |
| Marwari (मारवाड़ी)                  | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | FAIL                    | MOCK-ONLY        | MOCK-ONLY      |
| Dhundhari/Jaipuri (ढूंढाड़ी/जयपुरी) | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | FAIL                    | MOCK-ONLY        | MOCK-ONLY      |
| Shekhawati (शेखावाटी)               | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | FAIL                    | MOCK-ONLY        | MOCK-ONLY      |
| Bagri (बागड़ी)                      | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | FAIL                    | MOCK-ONLY        | MOCK-ONLY      |
| Mewari (मेवाड़ी)                    | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | FAIL                    | MOCK-ONLY        | MOCK-ONLY      |
| Mewati (मेवाती)                     | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | FAIL                    | MOCK-ONLY        | MOCK-ONLY      |
| Harauti (हाड़ौती)                   | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | FAIL                    | MOCK-ONLY        | MOCK-ONLY      |
| Malvi (मालवी)                       | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | FAIL                    | MOCK-ONLY        | MOCK-ONLY      |
| Wagdi (वागड़ी)                      | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | FAIL                    | MOCK-ONLY        | MOCK-ONLY      |
| Braj (ब्रज)                         | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | FAIL                    | MOCK-ONLY        | MOCK-ONLY      |
| Haryanvi (हरियाणवी)                 | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | FAIL                    | MOCK-ONLY        | MOCK-ONLY      |
| Bhojpuri (भोजपुरी)                  | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | PASS                    | MOCK-ONLY        | MOCK-ONLY      |
| Awadhi (अवधी)                       | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | PASS                    | MOCK-ONLY        | MOCK-ONLY      |
| Bundeli (बुंदेली)                   | NOT-TESTED         | NOT-TESTED         | MOCK-ONLY                   | MOCK-ONLY                     | FAIL                    | MOCK-ONLY        | MOCK-ONLY      |

Once the audit runs with a key, "Answers in the dialect (text)" and "Accent matches" become
NEEDS-HUMAN for every dialect row: code can check facts and script, not whether a villager would
call the wording or the voice their own.

## Verdict per row, in plain words

- **Hindi:** The whole Hindi path is built, but none of it has run with the real models: whether it
  understands spoken Hindi, answers correctly and speaks the answer is unknown.
- **Marathi:** Same as Hindi; in addition many phones have no Marathi browser voice, so Marathi
  speech depends on server speech, which has never produced real audio.
- **Tamil:** Same as Hindi: built, not run with real models, not heard by anyone.
- **English:** Same as Hindi: built, not run with real models.
- **Marwari:** The app can try to reword an answer into Marwari, but this was never run for real and
  no Marwari speaker has read it; any speech would be a Hindi voice, not a Marwari one.
- **Dhundhari/Jaipuri:** Same as Marwari: untested wording, Hindi-voice speech only.
- **Shekhawati:** Same as Marwari: untested wording, Hindi-voice speech only.
- **Bagri:** Same as Marwari: untested wording, Hindi-voice speech only.
- **Mewari:** Same as Marwari: untested wording, Hindi-voice speech only.
- **Mewati:** Same as Marwari: untested wording, Hindi-voice speech only.
- **Harauti:** Same as Marwari: untested wording, Hindi-voice speech only.
- **Malvi:** Same as Marwari: untested wording, Hindi-voice speech only.
- **Wagdi:** Same as Marwari, and recognising spoken Wagdi (a Bhili variety) is expected to be
  weak; nothing was tested.
- **Braj:** Same as Marwari: untested wording, Hindi-voice speech only.
- **Haryanvi:** Same as Marwari: untested wording, Hindi-voice speech only.
- **Bhojpuri:** The TTS model names Bhojpuri, so the app asks for real Bhojpuri speech, but neither
  the wording nor the voice has been run or heard; treat both as unproven.
- **Awadhi:** Same as Bhojpuri: the TTS model names it, nothing run or heard.
- **Bundeli:** Same as Marwari: untested wording, Hindi-voice speech only.

## "ki keh raho he"

- **Deployed app:** mock mode (`mocks: true`; its FAQ ids `faq-1…` are the mock format).
- **Typed, mock mode:** not reproduced on this branch **or on `main`** (the deployed code, checked
  in Phase 6 by running `main`'s own mock `answerQuestion()`): the mock keyword search finds
  nothing and the fixed not-found text is returned. The browser-only mock (`VITE_USE_MOCKS`) uses an
  identical copy of the same mock search.
- **Spoken, mock mode:** reproduced for any recording: mock speech-to-text ignores the audio and
  returns the canned PM-KISAN question, which gets the canned formal-Hindi PM-KISAN answer.
- **Conclusion:** explanation (1), mock mode, accounts for the screenshot only if the question was
  **spoken**. If it was really **typed**, it came from a real-mode run (explanation 2), most likely
  on `main`-era code that forces every message through retrieval; that cannot be reproduced here
  without a key.
- **Fix on this branch (real mode only):** the intent router classifies messages before retrieval
  (its prompt names "ki keh raho he" as a clarification), and a clarification may not state
  numbers, amounts, URLs or phone numbers the user was not already told (fixed "please ask again"
  text otherwise). Both are tested with a fake model only (`I-clarify-guard` PASS); whether the real
  model routes the message correctly is NOT-TESTED. Mock mode is unchanged by design (R8).

## The three biggest risks

1. **No real-model run at all.** Model ids (`gemini-3.8-flash`, `gemini-3.6-flash`,
   `gemini-embedding-2`, `gemini-3.8-flash-lite-tts`, `gemini-3.8-flash-tts`), the TTS request
   shape, voice ids, retrieval thresholds and latency are all unproven with the owner's key. The
   first real run can fail in ways no fake shows. Runbook steps 1–3 answer this.
2. **Merging into `main` will conflict, in the Listen path.** `main` gained PR #12 ("play server
   TTS audio with browser fallback") after this branch was cut. A trial merge conflicts in 11 files
   (`speak.ts`, `SpeakButton.tsx`, `voice/strings.ts`, `ChatProvider.tsx`, `ChatWindow.tsx`,
   `MessageBubble.tsx`, `useChat.ts`, `lib/api.ts`, `mocks/index.ts`, `.gitignore`,
   `.prettierignore`); the updated `feat/conversation-layer` conflicts in 9. `main`'s
   `fetchServerTts()` gives up after 6 s (this server's TTS timeout is 15 s per piece), switches
   server speech off for the rest of the session after one `audioUrl: null` (this server returns
   `null` per request, e.g. for an over-long answer), and sends no `dialectId`. A careless
   resolution would silently lose the low-bandwidth fix, `dialectId` or the honest labels.
   Resolve by hand and re-run the client tests from both sides.
3. **Dialect output is on by default and unreviewed.** `DIALECT_REPLY=best_effort` rewords replies
   for any confirmed or high-confidence dialect, zero-shot (0 consented exemplars for all 14
   dialects), and 12 of 14 dialects are spoken by a Hindi voice. The facts lock keeps numbers,
   links and scheme names, but cannot judge whether the wording is natural, correct or respectful.
   Until native review, use `DIALECT_REPLY=verified_only` (nothing is verified yet, so this means
   standard-language replies) for any public demo.

## NOT-TESTED (and why)

- Everything that needs a Gemini key: model ids (B), retrieval scores and recall (C), real text
  answers per language (D), dialect rewording (E), speech-to-text and dialect identification (F),
  server speech (G), real latency (J). No key in the sandbox.
- Speech recognition for real village speakers, every dialect included: no consented clips in
  `eval/audio/` (see its README).
- Stage H browser end-to-end mic test: Playwright and Chromium exist in the Phase 6 sandbox, but no
  client could be served (Vite not installable) and there is no consented clip.
- The repo's own toolchain: `npm install`, `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run build`, client typecheck/build, `format:check` with the pinned prettier (registry
  blocked). Sandbox-shim results above are the substitute, labelled as such.
- Multer upload limits (10 MB, non-audio) and the client's error toast: the Express app could not
  start in the sandbox.
- `npm run tts:voices`, `npm run tts:samples`, `npm run calibrate`, `EVAL_MODE=live npm run eval`
  against the real API.
- This branch on Vercel; anything on a phone.

## NEEDS-HUMAN

- Dialect wording: native speakers rate `eval/review/dialect-review.csv` (understandable, natural,
  correct dialect, facts correct, 1–5) after a real-mode audit fills its `dialect_answer` column.
- Pronunciation and accent of every server voice (`eval/out/tts/`), and auditioning voice
  candidates (`docs/tts-voice-candidates.md` once generated).
- Setting `"verified": true` in `server/src/config/dialect-render.json`, per dialect, only after
  that review.
- Native review of the new Marathi and Tamil UI strings and the `ASK_AGAIN` texts (marked
  `TODO(review-native)`).
- Consent records for any recorded clip, exemplar, designed or replicated voice.
- Carried over: PMAY-Gramin (still `sample: true`), the four eligibility rule files, and the six
  source-checked scheme summaries.

## UNVERIFIED assumptions

1. A library or designed voice id can be passed in `speech_config.voice` like a prebuilt name (the
   docs list `voice.id` but show no request using it).
2. REST field casing of `GET /v1beta/voices` (the script accepts both snake_case and camelCase).
3. Every TTS model accepts `sample_rate: 16000` (the code retries at 24000 on a 400).
4. Whether the TTS response carries a `mime_type` (the code checks the RIFF header instead).
5. The brief's 8,192-token TTS input limit: not stated on the docs page (re-read 2026-10-31);
   600-character pieces stay far below any such limit.
6. The model ids above exist and are enabled for the owner's key.
7. That the sandbox shims behave like the real packages for the code paths tested (vitest subset,
   Express/multer types, zod 3.25.76's v4 build vs the pinned ^4.6.7, `@types/node` 26 vs ^22).
8. Vercel ships `data/dialects/exemplars/*.jsonl` (the registry is shipped, checked; the exemplar
   files are all empty today, so nothing depends on them yet).

## API and configuration changes in this job

- **Contract v4:** optional `QueryResponse.answerStyle` with `language`, `dialectId`,
  `rendered` (`dialect` or `standard`) and an optional `reason` (`no_dialect`, `low_confidence`,
  `render_off`, `facts_check_failed`, `timeout`, `error`, `not_verified`). Mock mode always
  returns `rendered: 'standard'`.
- **Contract v5:** optional `TtsRequest.dialectId` and `TtsResponse.basis` (`language`,
  `named-dialect`, `base-language-approximation`, `none`). `audioUrl` may be a WAV `data:` URL.
  Phase 6 added wording (no type change): `audioUrl: null` is per request.
- **Behaviour change:** in real mode `POST /api/tts` now returns server speech by default
  (`GEMINI_TTS_MODEL` defaulted from unset to `gemini-3.8-flash-lite-tts`); set `none` for browser
  speech only. An existing `.env` with an empty `GEMINI_TTS_MODEL=` now gets the default model.
- **New server variables:** `DIALECT_REPLY` (`best_effort`), `DIALECT_RENDER_TIMEOUT_MS` (8000),
  `GEMINI_TTS_DIALECT_MODEL` (`gemini-3.8-flash-tts`), `GEMINI_TTS_SAMPLE_RATE` (16000),
  `TTS_TIMEOUT_MS` (falls back to `GEMINI_TTS_TIMEOUT_MS`, 15000), `TTS_MAX_CHARS` (600),
  `TTS_STYLE` (empty).
- **Audit-only variables:** `AUDIT_BASE_URL`, `AUDIT_CLIENT_URL`, `AUDIT_TEXT_PER_LANGUAGE`,
  `AUDIT_ENV_NOTE`, `AUDIT_WORKER_TIMEOUT_MS` (commented in `.env.example`).
- **New config files:** `server/src/config/dialect-render.json`, `server/src/config/tts-voices.json`.
- **New scripts:** `npm run audit -w server`, `npm run tts:voices -w server`,
  `npm run tts:samples -w server`.
- **Client:** `api.dialects()` added to the client `Api` (endpoint already in contract v3).

## Carried over from the conversation-layer job (still open)

Verify PMAY-Gramin and the eligibility rules against official sources; generate
`server/data/faq.json` (`npm run prewarm -w server`); calibrate `RAG_MIN_SCORE`; run the live eval;
collect 20+ consented exemplars per dialect. The order is in [RUNBOOK.md](RUNBOOK.md).
