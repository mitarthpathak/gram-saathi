# Agent work log

## Phase 0 — recon

- Files changed: `docs/AGENT_NOTES.md`, `docs/AGENT_LOG.md`.
- Commands run: `npm install` (PowerShell policy rejected `npm.ps1`); `npm.cmd install` (failed with EPERM opening the user npm cache; approval request was made); `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd test --workspaces --if-present`; `npm.cmd run build`.
- Results: typecheck passed; lint could not start because `eslint` is not recognized (dependencies likely incomplete); 131/134 tests passed, with 3 existing eligibility tests failing because all rules are unverified; build passed. No code changes were made during recon.
- Open issues: npm install/cache approval result needs checking; working tree had uncommitted edits before work began and they are being preserved. Git branch `feat/conversation-layer` created from current HEAD.

## Phase 1 — conversation module

- Files changed: `server/src/modules/chat/conversation.ts`, `server/test/conversation.test.ts`.
- Commands run: `npm.cmd run typecheck`; `npm.cmd test -w server -- --run test/conversation.test.ts`; `npm.cmd run build`; `npm.cmd run lint`.
- Results: intent-first routing returns direct responses without search for non-scheme intents, uses English standalone search text for scheme questions, filters passages by score, and accepts only returned passage ids. Empty non-scheme replies now return notFound. Session history is capped at 6 turns and 500 LRU sessions.
- Results: final verification passed: typecheck, lint with no diagnostics, focused conversation suite (10/10), and workspace build. The npm install retry completed without changing the lockfile.
- Open issues: none for this phase.

## Phase 2 — adapters and text chat wiring

- Files changed: `server/src/modules/chat/service.ts`, `server/src/modules/rag/service.ts`, `server/src/modules/chat/conversation.ts`, `server/test/chat.test.ts`.
- Commands run: `npm.cmd run typecheck` (passed); `npm.cmd run lint` (passed); `npm.cmd test -w server` (124 passed, 3 pre-existing eligibility failures from unverified rules); `npm.cmd run build` (passed).
- Results: live chat now runs intent detection before retrieval. The adapter reuses `geminiClient.generateJson`; RAG search maps chunk ids, section names, text, and scores, bypasses optional query translation for the already-English query, and uses `RAG_MIN_SCORE`. The server passes language/dialect hints, loads only consented exemplars through the existing per-label limiter, reads recent history, and records successful turns. The mocked chat path is kept on its previous flow. Added service tests with a fake Gemini backend and vector store.
- Open issues: cache behavior is retained for mock mode; the live intent path currently does not use the old answer cache because history can change clarification meaning. This tradeoff needs documentation. Full server tests still have the three baseline eligibility failures.

## Phase 3 — voice wiring

- Files changed: `server/src/modules/chat/service.ts`, `server/test/voiceConversation.test.ts`.
- Commands run: `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd test -w server -- --run test/voiceConversation.test.ts`; `npm.cmd run build`.
- Results: STT output continues into `answerQuestion`, which now routes through the same `handleTurn` path as typed text. Explicit dialect selection is retained. The repo's confidence policy is explicit: high-confidence classification can inform the reply prompt, while medium confidence and abstention are omitted. Fake-STT coverage verifies transcript, language, and selected dialect are carried through.
- Open issues: automatic real-audio dialect confidence is not live-tested; the focused fake-STT suite passed. Full server suite retains 3 pre-existing eligibility failures.

## Phase 4 — response mapping and contract

- Files changed: `shared/src/types.ts`, `server/src/modules/chat/service.ts`, `docs/API_CONTRACT.md`.
- Commands run: `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd test -w server -- --run test/chat.test.ts test/conversation.test.ts test/voiceConversation.test.ts`; `npm.cmd run build`.
- Results: the optional `intent` field is typed and documented. Direct replies have no citations, return `fraudWarning: ''`, and map the intent. Grounded and not-found replies preserve the existing source, fraud, SMS, and fixed-text mapping. The pre-existing client change hides fraud warnings for direct responses because they have no sources and are not not-found.
- Open issues: none for this phase; all focused tests, typecheck, lint, and build passed.

## Phase 5 — dialect plumbing

- Files changed: `docs/RUNBOOK.md`, `docs/DECISIONS.md`.
- Commands run: inspected `data/dialects/registry.json`, `data/dialects/exemplars/*.jsonl`, client language feature files, and existing `exemplars.ts` selection; `npm.cmd test -w server -- --run test/dialectRegistry.test.ts test/dialect.test.ts`.
- Results: Braj and Wagdi were already present as experimental Hindi dialect entries, so the registry stayed unchanged. All 14 dialect exemplar files currently contain zero examples; RUNBOOK lists each and suggests 20+ consented native-speaker examples. No client dialect selector exists; the server/API supports a confirmed dialect hint. Text chat now uses the existing consented exemplar store with its configured per-label and token limits.
- Open issues: dialect samples and automatic classification need native-speaker review; no exemplars were added.

## Phase 6 — spoken replies (TTS)

- Files changed: `server/src/config/env.ts`, `server/src/modules/tts/service.ts`, `server/src/createApp.ts`, `server/test/tts.test.ts`, `client/src/features/voice/speak.ts`, `client/src/features/voice/SpeakButton.tsx`, `client/src/features/voice/strings.ts`, `.env.example`, `docs/API_CONTRACT.md`, `docs/DECISIONS.md`.
- Commands run: reviewed current official Gemini speech-generation docs and Bhashini pipeline docs/model list on 2026-10-31; `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd test -w server -- --run test/tts.test.ts`; `npm.cmd run build`.
- Results: optional Gemini TTS uses the documented Interactions API; the configured model is required, request timeout is enforced, audio is returned as a WAV data URL, and provider errors return the existing no-audio form. TTS now uses the shared AI rate limiter. The Listen button tries server audio, then browser speech synthesis, and shows one localized failure message only if both are unavailable. Tests cover success, timeout, provider error, malformed output and no provider.
- Open issues: Bhashini/Dhruva was not implemented because the official docs require account-specific callback URL and inference auth header; the exact payload/response and selected TTS pipeline were not independently verified for this account. This is marked UNVERIFIED in decisions and the final report. No real TTS provider call has been run.

## Phase 7 — RAG threshold calibration

- Files changed: `server/scripts/calibrate-rag.ts`, `server/test/calibrateRag.test.ts`, `server/package.json`, `docs/DECISIONS.md`, `docs/RUNBOOK.md`.
- Commands run: `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd test -w server -- --run test/calibrateRag.test.ts`; `npm.cmd run build`; `npm.cmd run calibrate -w server`.
- Results: added 10 fixed scheme retrieval queries and 10 non-scheme messages, score summaries, and a midpoint recommendation when the groups separate (balanced-accuracy fallback when they overlap). Threshold math tests passed. English query text is paired with language metadata so no unconsented Marathi/Tamil samples are invented.
- Open issues: the calibration command did not reach the script because the installed `tsx` startup failed with `uv_os_get_passwd returned ENOMEM` (Node v24.18.0). A Gemini key is configured (checked as a boolean only); no score recommendation was produced. Run the documented command on the owner's normal environment after verifying the vector store.
- Commit note: the initial Phase 7 commit missed the package script and `.env.example` calibration comment because the staged patch did not apply. They are included in the immediate Phase 7 follow-up commit; the owner's other `.env.example` edits remain unstaged.

## Phase 8 — evaluation harness

- Files changed: `server/eval/testset.json`, `server/scripts/eval.ts`, `server/test/evalHarness.test.ts`, `server/vitest.eval.config.mts`, `server/package.json`.
- Commands run: `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd run eval -w server`; `npm.cmd run build`.
- Results: added 10 scheme question templates expanded across hi/mr/ta/en (40 cases) and 10 non-scheme cases. Offline fake-dependency mode passed 50/50 plumbing checks and prints the requested pass/fail table. Live mode checks intent, expected citations, script, Roman text outside preserved scheme names/URLs, and numbers/rupee amounts against cited snippets; live quality does not set the build exit status. Scheme ids match the repo's scheme filenames.
- Open issues: live model evaluation was not run. Input questions are English with answer-language hints, because R6 prohibits inventing Marathi/Tamil sample sentences and there are no consented multilingual exemplars. The `tsx` runtime issue from Phase 7 still prevents the calibration CLI from running in this environment.
- Commit note: the `eval` and `calibrate` npm scripts share `server/package.json`; that file is committed with this phase after the Phase 7 calibration command's first staging attempt failed.

## Phase 9 — scheme data audit

- Files changed: `docs/AGENT_LOG.md` only; no scheme document was modified.
- Commands run: inspected verification front matter in `data/schemes/*.md`; browsed official PMAY-G Department of Rural Development government sources on 2026-10-31: `https://pmayg.dord.gov.in/netiay/writereaddata/Circulars/Letter%20to%20all%20States%2014%20Aug%20%281%29.pdf`, `https://pmayg.dord.gov.in/netiayHome/Uploaded/Guidelines-English_Book_Final.pdf`, and `https://pmayg.nic.in`.
- Results: PMAY-Gramin is the only scheme data file still marked `sample: true` and `verified: false`. Official government sources were fetched; the 2024 continuation circular and guidelines are available.
- Open issues: every `data/schemes/*.md` file already had uncommitted changes before work began. R3 requires leaving those owner changes untouched, so the PMAY-Gramin file could not be updated with verified text/sourceUrl/access date. It is listed for human review. No scheme file changed, so ingest was not rerun; the generated vector store may be stale relative to the owner's pending data edits.

## Phase 10 — client polish

- Files changed: `docs/AGENT_LOG.md` only; existing owner client changes already provide the requested presentation behavior.
- Commands run: inspected `ChatProvider.tsx`, `ChatScreen.tsx`, `ChatWindow.tsx`, `MessageBubble.tsx`, `useChat.ts`, and API routing; `npm.cmd run typecheck -w client`; `npm.cmd run build -w client`.
- Results: client typecheck and production build passed. The existing busy/thinking indicator covers the added understand step; direct responses have no sources and the existing message bubble hides the empty fraud warning; both typed and transcribed voice input call the same server chat flow.
- Open issues: none for this phase; pre-existing owner edits in client files remain unstaged and unchanged by this phase.

## Phase 11 — build and deploy readiness

- Files changed: `server/src/modules/health/service.ts`, `shared/src/types.ts`, `docs/API_CONTRACT.md`, `server/test/health.test.ts`, `docs/AGENT_LOG.md`.
- Commands run: `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd test --workspaces --if-present`; `npm.cmd run build`; started the built server with `USE_MOCKS=true` and called every documented API route plus `/` using PowerShell/curl.
- Results: typecheck, lint and build passed; all 12 routes returned HTTP 200 in mock smoke (health, dialects, chat, voice, dialect transcription, eligibility start/answer, SMS, FAQ, TTS, RAG and root). Added optional boolean `dialectConfigured` and `ttsConfigured` health fields; data files are present at `server/data/vectorstore.json`, and `vercel.json` includes `server/data/*.json` and eligibility data. Test suite: 132 passed, 3 pre-existing eligibility tests failed because unverified rules disable that feature (same failures recorded at baseline).
- Open issues: no real text query was run; the scheme corpus includes owner-pending edits and PMAY-Gramin remains unverified. TTS is not configured in this environment, so no live TTS call was run. FAQ source data is generated by the documented prewarm step; no `server/data/faq.json` is checked in, so production deploy requires prewarm output/data as described in deployment docs.

## Phase 12 — docs

- Files changed: `docs/ARCHITECTURE.md`, `docs/TASKS.md`, `docs/RUNBOOK.md`, `docs/DECISIONS.md`, `docs/AGENT_LOG.md`.
- Commands run: inspected README, architecture, task list, runbook, decisions, API contract, environment template, deployment config, scripts and health fields; no code changed in this phase.
- Results: architecture now documents understand → route → retrieve → answer → response mapping → optional TTS/browser fallback; task status reflects delivered work; runbook gives the requested owner sequence, commands, dialect exemplar counts and human review checklist; decisions capture conservative choices and limits.
- Open issues: README was already modified in the starting working tree by the owner. R3 requires leaving it untouched; its current status/configuration/limitations text still needs owner reconciliation with this runbook. See `docs/DECISIONS.md`.

## Phase 13 — final verification and report

- Files changed: `docs/FINAL_REPORT.md`, `docs/AGENT_LOG.md`.
- Commands run: `npm.cmd install`; `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd test --workspaces --if-present`; `npm.cmd run build`; `npm.cmd run eval -w server`; client typecheck/build; checked `.env` configuration using booleans only; attempted one real query; started compiled server with `USE_MOCKS=true` and called every documented endpoint plus `/`.
- Results: install, typecheck, lint, build and offline eval passed; offline eval 50/50. Full tests remain 132 passed/3 failed, matching baseline eligibility failures. Final mock smoke passed all 12 API routes plus root; health returned `mocks=true`, `dialectConfigured=false`, `ttsConfigured=false`. Gemini key is configured but `GEMINI_TTS_MODEL` is not; live PM-KISAN query returned `AI_UNAVAILABLE` 503 and an approved-network retry yielded no inspectable result. No live TTS call was configured or run.
- Open issues: calibration CLI remains unable to start because of `tsx`/Node `uv_os_get_passwd returned ENOMEM`; live eval, real text, TTS and phone/native-speaker checks remain unverified. Scheme/eligibility verification, generated FAQ, calibration threshold, native dialect exemplars and README reconciliation remain listed in `FINAL_REPORT.md`.

## Phase 14 — owner follow-up: reconcile staged work and prepare PR

- Files changed: `.env.example`, `README.md`, client chat/eligibility/API/mocks, six scheme summaries and `data/schemes/README.md`, `server/data/vectorstore.json`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/RUNBOOK.md`, `docs/FINAL_REPORT.md`, `docs/AGENT_LOG.md`.
- Commands run: inspected staged and unstaged diffs; `npm.cmd run ingest -w server`; `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd test --workspaces --if-present`; `npm.cmd run build`; `git diff --check`.
- Results: explicit owner instruction authorized including the starting-tree staged work. Six scheme summaries now record official source URLs and access date 2026-10-31; PMAY-Gramin remains unverified. Ingest regenerated the vector-store fingerprint. Roman-script client mock replies were removed in favor of the existing native-script fixtures. Typecheck/lint/build passed; 132 tests passed and the same three baseline eligibility tests failed due to unverified rules. Whitespace checks passed.
- Open issues: calibration startup, real Gemini text/TTS, phone testing, and PMAY-Gramin/eligibility verification remain unverified. PR creation depends on GitHub credentials/API availability; report the exact outcome.

## Phase 15 — publish PR and close follow-up

- Files changed: `docs/FINAL_REPORT.md`, `docs/AGENT_LOG.md`.
- Commands run: `git push -u origin feat/conversation-layer`; GitHub REST API request using the configured credential helper (credential values were not printed).
- Results: pushed commit `fa776b8`; opened PR [#9](https://github.com/mitarthpathak/gram-saathi/pull/9) against `main` with a filled summary/checklist, including the exact verification results and open review items.
- Open issues: the PR is open for review; the report's remaining verification items are listed under “Needs human verification.”

## Phase 16 — resolve conflicts after main advanced

- Files changed: `client/src/features/voice/SpeakButton.tsx`, `client/src/features/voice/speak.ts`, `client/src/lib/api.ts`, `client/src/mocks/dialects.ts`, `client/src/mocks/index.ts`, `docs/AGENT_LOG.md`.
- Commands run: `git fetch origin main`; inspected branch/base file changes; `git merge-tree --write-tree` (first identified the listed conflicts, then returned exit code 0 after a forward-only conflict-resolution commit candidate); `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd test --workspaces --if-present`; `npm.cmd run build`.
- Results: preserved the current main API/dialect mock additions, the conversation-aware native-script mock replies, and optional server TTS followed by browser fallback. No rebase or merge was performed. Typecheck, lint, and build passed. Tests: 132 passed and the same 3 baseline eligibility tests failed because rules remain unverified.
- Results: pushed the forward-only conflict-resolution commit; GitHub API reports PR #9 `mergeable: true` against base commit `34dac54`.
- Open issues: review/verification items in `FINAL_REPORT.md` remain.

## Phase 17 — confirm remote PR status

- Files changed: `docs/AGENT_LOG.md`, `docs/FINAL_REPORT.md`.
- Commands run: GitHub REST API GET for PR #9 using the configured credential helper; credential values were not printed.
- Results: PR #9 is open and `mergeable: true` against `main` at `34dac54`.
- Open issues: none for conflict resolution; outstanding product verification tasks remain documented in `FINAL_REPORT.md`.

## Phase 18 — sync latest main and compact phone layout

- Files changed: latest `origin/main` tree (merge commit `ba03936`), `client/src/index.css`, `docs/AGENT_LOG.md`, `docs/FINAL_REPORT.md`.
- Commands run: `git fetch origin main`; verified staged index tree equals `git merge-tree --write-tree HEAD origin/main` and has no unmerged paths; `npm.cmd install`; `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd test --workspaces --if-present`; `npm.cmd run build`.
- Results: latest main is `698b211`; merge result has no conflicts. The mobile layout now uses a 92% root rem scale at widths up to 480px, leaving desktop sizing and browser zoom unchanged. Typecheck, lint and build passed; 132 server tests and 8 client tests passed. Three eligibility tests fail because the eligibility rules are unverified.
- Open issues: three eligibility tests remain failing due to unverified rules.

## Phase 19 — app modal scroll and phone scale polish

- Files changed: `client/src/lib/motion/smoothScroll.ts`, `client/src/features/app-shell/AppChrome.tsx`, `client/src/features/app-shell/AppFullscreen.tsx`, `client/src/features/app-shell/AppSheet.tsx`, `client/src/features/chat/ChatWindow.tsx`, `client/src/index.css`, `docs/AGENT_LOG.md`, `docs/FINAL_REPORT.md`.
- Commands run: `npm.cmd run typecheck -w client`; `npm.cmd run lint`; `npm.cmd run build -w client`.
- Results: client typecheck, lint and production build passed. Modal now locks and restores document/body scrolling while preserving the previous page position; app scroll regions keep native scrolling with contained overscroll and a themed scrollbar. Phone modal maximum height is smaller and narrow-screen root scale is 88%.
- Open issues: browser interaction was not manually exercised in this follow-up; three previously recorded eligibility tests still fail due to unverified rules.

---

# Dialect voice job (branch `feat/dialect-voice`)

Earlier sections above belong to the finished conversation-layer job. This job's phases follow.

## Phase 0 — recon and baseline

- Branch: created `feat/dialect-voice` from `feat/conversation-layer` (`1b5d297`), which is not
  merged into `main` (PR #9 open).
- Files changed: `docs/AGENT_NOTES.md` (rewritten for this job), `docs/DECISIONS.md`,
  `docs/AGENT_LOG.md`.
- Commands run: `npm install` (failed: `ENOTFOUND registry.npmjs.org`, then proxy `403` on
  CONNECT — not retried further); `npm run typecheck`, `npm run lint`, `npm test -w server`,
  `npm run build` (all fail for lack of dependencies); `prettier --check .` (29 pre-existing
  differences); sandbox kit: `tsc --noEmit` for server and shared with TypeScript 6.0.3 (0 errors
  each), `tsx --test server/test/*.test.ts` (135 tests: 125 pass, 7 fail only because Express is
  not installable, 3 known eligibility failures); `tsx` probe of `mockSearchSchemes`,
  `mockTranscribe`, `mockGenerateAnswer`; WebFetch of the deployed `/api/health` and
  `/api/faq/top?lang=hi`.
- Results: flows, dialect plumbing, TTS state, env vars, mocks and 9 contradictions recorded in
  `docs/AGENT_NOTES.md`. Key findings: the dialect already reaches the answer prompt (including an
  unverified model-guessed dialect for typed text); the intent router exists but only in real
  mode; the deployed server reports `mocks:true` and serves mock FAQ ids; a typed
  "ki keh raho he" cannot produce PM-KISAN in mock mode while any spoken query does.
- Open issues: no dependency install, no Gemini key and no client toolchain in this sandbox. All
  repo-tooling checks are NOT-TESTED here; sandbox-shim results are labelled as such.

## Phase 1 — honest audit harness and baseline

- Files changed: `server/scripts/audit.ts` and `server/scripts/audit/{types,checks,context,goldset,kb,transport,stagesText,stagesSpeech,e2e,worker,fakeWorker,report,ttsLanguages}.ts`,
  `server/src/lib/facts.ts` (pure fact extraction, used by the audit now and the facts lock in
  Phase 2), `server/src/lib/geminiClient.ts` (diagnostics observer only),
  `server/eval/audit-goldset.json`, `server/test/audit.test.ts`, `server/package.json`
  (`audit` script), `eval/audio/README.md`, `eval/audio/labels.example.json`, `.gitignore`,
  `.prettierignore`, generated `docs/PIPELINE_AUDIT.md`, `docs/PIPELINE_AUDIT.baseline.md`,
  `audit/results.json`, `audit/results.baseline.json`, `eval/review/dialect-review.csv`,
  `docs/DECISIONS.md`.
- Commands run (sandbox kit): `tsc --noEmit -p server/tsconfig.json` (0 errors);
  `tsx --test server/test/audit.test.ts` (13/13 pass); full server suite (148 tests: 138 pass,
  the same 10 failures as baseline — 7 Express-only, 3 known eligibility); `prettier --check` on
  touched files (clean); `tsx scripts/audit.ts --baseline` with `AUDIT_BASE_URL` and an
  `AUDIT_ENV_NOTE` describing this sandbox.
- Baseline results (mock mode, no key, in-process API): A NOT-TESTED (no dependencies),
  B PARTIAL (models NOT-TESTED; index present; index fingerprint matches only as CRLF; PMAY-G
  sample), C/D/E/F/G MOCK-ONLY, H NOT-TESTED, I PARTIAL (7 error-code checks PASS with a fake
  backend; multer limits and the client path NOT-TESTED), J FAIL (voice path: 8 calls, 6
  sequential, over the 4-call budget; typed scheme path 4 sequential).
- "ki keh raho he": typed in mock mode → fixed not-found text (not reproduced); any spoken query
  in mock mode → canned PM-KISAN transcript and formal-Hindi answer (reproduced). Real mode
  NOT-TESTED (no key). Deployed app not reachable from the shell; the earlier WebFetch evidence
  (`mocks:true`, mock FAQ ids) is in the report's environment note.
- Findings (not fixed here, out of scope or human-owned): (1) `fingerprintDocuments` hashes raw
  text, so the Windows-built index looks stale on Linux/Vercel and startup logs a false warning;
  (2) the voice path makes 6 sequential model calls; (3) the verified PM-KISAN summary says
  "₹6,000 per year in three equal instalments" — a correct derived "₹2,000" in an answer is not in
  the passage, and `preservesContextNumbers` would turn such answers into notFound (real-mode
  risk, NOT-TESTED); (4) mock fixtures mention ₹2,000, pmkisan.gov.in etc. that the verified
  passages do not.
- Open issues: everything real-mode is NOT-TESTED here; Stage H code was never executed (no
  Playwright, no client server); the in-process transport skips multer and the rate limiter.

## Phase 2 — dialect-aware text replies and tone

- Files changed: `shared/src/types.ts` (`AnswerStyle`, `QueryResponse.answerStyle?`),
  `docs/API_CONTRACT.md` (field, section, changelog v4), `server/src/config/env.ts`
  (`DIALECT_REPLY`, `DIALECT_RENDER_TIMEOUT_MS`), `.env.example`,
  `server/src/config/dialect-render.json` (14 dialects, all `verified: false`; bhojpuri and
  awadhi `ttsNamedLanguage: true`), `server/src/modules/dialect/renderConfig.ts`,
  `server/src/lib/facts.ts` (scheme aliases, `checkFactsLock`),
  `server/src/modules/chat/dialectRender.ts` (pure rewording step, tone rules, policy),
  `server/src/modules/chat/conversation.ts` (standard-language answer; model dialect guess no
  longer used), `server/src/modules/chat/service.ts` (decision, rewording in parallel with SMS,
  `answerStyle` on every path incl. mocks, clarify facts guard), `server/src/modules/chat/messages.ts`
  (`ASK_AGAIN`), tests `server/test/dialectRender.test.ts`, `server/test/answerStyleMock.test.ts`,
  updated `server/test/conversation.test.ts`, `server/scripts/audit/fakeWorker.ts`.
- Commands run (sandbox kit): server and shared `tsc --noEmit` (0 errors); new tests 23/23 pass;
  full server suite 172 tests: 162 pass, the same 10 baseline failures (7 Express-only, 3
  eligibility); `audit --skip-static` in mock mode (E now reports `render_off` in mock mode; the
  fake-backend shape of a typed dialect question is 5 calls, 4 sequential).
- Results: with a hint or high-confidence identification, the reply is reworded and facts-locked;
  otherwise `answerStyle` explains why not. Clarifications cannot add facts. Verified with fake
  model output only.
- Open issues: dialect quality and naturalness NEEDS-HUMAN; real-model behaviour NOT-TESTED (no
  key); exemplars are all empty, so rewording is zero-shot; `ASK_AGAIN` strings need native review.

## Phase 3 — spoken replies (server TTS)

- Files changed: `server/src/lib/geminiClient.ts` (`SpeechRequest`/`SpeechResult`, optional
  `GeminiBackend.synthesize`, `speechRequestBody`, `extractSpeechAudio`, `synthesizeViaRest`,
  `synthesizeAudio`, observer kind `speech`), `server/src/lib/wav.ts` (new),
  `server/src/modules/tts/{service,controller,speechText,voices}.ts`,
  `server/src/config/tts-voices.json` (new, placeholders "to-be-auditioned"),
  `server/src/config/env.ts` (TTS variables), `server/src/modules/health/service.ts`,
  `shared/src/types.ts` (`TtsRequest.dialectId?`, `TtsBasis`, `TtsResponse.basis?`),
  `server/scripts/tts-voices.ts`, `server/scripts/tts-samples.ts`, `server/package.json`
  (`tts:voices`, `tts:samples`), `server/test/tts.test.ts` (rewritten), audit
  (`fakeWorker.ts`: fake speech backend, `I-tts-ok`, `I-tts-basis`, `I-tts-unknown-dialect`,
  `J-shape-tts` via the observer, `J-shape-tts-long`; `stagesText.ts`: `B-model-tts-dialect`,
  dialect answers kept only when actually dialect-worded; `stagesSpeech.ts`: dialectId only with
  dialect text), `.env.example`, `docs/API_CONTRACT.md` (TTS section, changelog v5),
  `docs/RUNBOOK.md` (voice auditioning, design and consent-only replication), `README.md` (env rows,
  limitation), `docs/DECISIONS.md`, `docs/tts-voice-candidates.md` (placeholder: not generated).
- Docs re-read 2026-10-31 (speech-generation page, last updated 2026-10-28): request/response
  shape, voices endpoint and fields, language table (Chhattisgarhi, Magahi, Maithili, Awadhi,
  Bhojpuri named for both models; Braj, Marwari, Rajasthani, Haryanvi, Bundeli, Wagdi not).
  UNVERIFIED items listed in DECISIONS.
- Commands run (sandbox kit): server and shared `tsc --noEmit` (0 errors); `tts.test.ts` 28/28
  pass; full server suite 192 tests: 182 pass, the same 10 baseline failures; both owner scripts
  without a key (exit 1 with a clear message) and against a fake `fetch`/backend (pagination,
  field casing, sample-rate fallback); `audit --skip-static` in mock mode (I-tts checks PASS with
  the fake backend; J-shape-tts 1 call, long answer 3 calls in parallel); generated audit files
  restored afterwards (the official re-run is Phase 5); prettier on new and previously clean files.
- Results: real-mode speech, voice selection, basis labels, splitting, cache, payload cap and the
  rate fallback are implemented and tested with fakes only. No real TTS call was made (no key):
  real audio, voice quality and pronunciation are NOT-TESTED / NEEDS-HUMAN.
- Open issues: library voice ids in `speech_config.voice` UNVERIFIED; answers longer than about
  70 s of speech exceed the payload cap and fall back to the browser voice; the client does not
  yet send `dialectId` or show `basis` (Phase 4).

## Phase 4 — client (Listen, honest labels, low-bandwidth, typing indicator)

- Files changed: `client/src/features/voice/speak.ts` (options object, server/browser result,
  `voiceNoteFor`, low-bandwidth skips server audio, browser failure detection, stop server audio),
  `client/src/features/voice/SpeakButton.tsx` (reads low-bandwidth, `dialectId`, "Preparing
  audio…" state, `onSpoken`), `client/src/features/voice/VoiceNoteLine.tsx` (new),
  `client/src/features/voice/strings.ts` and `client/src/features/chat/strings.ts` (new keys in
  en/hi/mr/ta; mr/ta marked for native review), `client/src/features/chat/dialects.ts` (new,
  cached `GET /api/dialects`), `client/src/features/chat/MessageBubble.tsx` (dialect note, voice
  note, dialectId), `client/src/features/chat/ChatProvider.tsx` (auto-speak passes dialectId,
  records the voice note), `client/src/features/chat/useChat.ts` (`voiceNote?`),
  `client/src/features/chat/ChatWindow.tsx` (slow-answer text), `client/src/lib/api.ts`
  (`dialects()`), `client/src/mocks/index.ts` (`dialects`, `basis: 'none'`), `docs/DECISIONS.md`.
- Commands run: client `tsc -b` / `vite build` NOT-TESTED (React, Vite and lucide are not
  installed; npm registry blocked). Instead: `tsc` over all of `client/src` against loose
  sandbox-only shims for react/react-router/lucide/vite (exit 0 with `noImplicitAny` off; the
  remaining implicit-any reports were all shim artifacts in untouched files), with a negative
  control proving it catches wrong string keys, a wrong language code and a wrong `basis`; a Node
  harness (esbuild bundle, fake `Audio`, fake `speechSynthesis`, fake API) for `speak()` and
  `voiceNoteFor()`: 12/12 PASS (dialectId sent only when given, low-bandwidth makes no `/api/tts`
  call, null audio / error / blocked playback fall back to the browser voice, both failing returns
  `ok: false`); prettier on touched files.
- Results: SYNTHETIC-ONLY. No real browser, phone or server audio was used; how the labels look and
  whether playback works on phones is NOT-TESTED.
- Open issues: client typecheck and build must be run by the owner (`npm run typecheck -w client`,
  `npm run build -w client`); the new mr/ta strings need native review (runbook, Phase 6).

## Phase 5 — audit re-run and comparison

- Files changed: `server/scripts/audit/report.ts` (before/after moved to the top, check-level
  changes table, link to the findings file), `server/scripts/audit.ts` ("ki keh raho he" verdict
  cites the new guard check), `server/scripts/audit/fakeWorker.ts` (`I-clarify-guard`),
  `server/test/audit.test.ts` (comparison test), regenerated `docs/PIPELINE_AUDIT.md`,
  `audit/results.json`, `eval/review/dialect-review.csv`; new hand-maintained
  `docs/AUDIT_FINDINGS.md` (4 fixed, 11 not fixed).
- Commands run: `AUDIT_ENV_NOTE=… tsx scripts/audit.ts --label after` (sandbox: mock mode, no key,
  in-process transport); WebFetch of the deployed `/api/health` (`{"status":"ok","mocks":true}`);
  a WebFetch of the deployed `/api/dialects` failed (tool usage limit), so N6 stays UNVERIFIED;
  full server suite 193 tests: 183 pass, the same 10 baseline failures; server `tsc --noEmit`
  0 errors; prettier on touched files.
- Results: stage statuses identical to the baseline (A NOT-TESTED, B PARTIAL, C–G MOCK-ONLY,
  H NOT-TESTED, I PARTIAL, J FAIL), no matrix cell changed — expected without a key. New checks,
  all with a fake model: `I-tts-ok`, `I-tts-basis`, `I-tts-unknown-dialect`, `I-clarify-guard`,
  `J-shape-tts-long` (PASS). `J-shape-voice` is still FAIL (6 sequential calls).
- Bugs fixed in this phase: none new; the audit's own bugs found earlier were fixed in Phase 3
  (dialectId only with dialect text). Everything else is listed in `docs/AUDIT_FINDINGS.md`.
- Note: the report says "uncommitted changes present" because the harness edits above are
  committed together with the report (one commit per phase).

## Phase 6 — docs, final report and independent re-check

- Resumed in a new agent session from this log (R2): Phases 0–5 committed, Phase 6 open. Branch
  checked out from `origin/feat/dialect-voice` at `38689dd`; no other branch touched.
- Files changed: `README.md` (status, mock vs real quickstart, `DIALECT_REPLY` / `AUDIT_*` rows,
  known limitations, "Checking what really works", docs list, structure), `docs/ARCHITECTURE.md`
  (real-mode pipeline diagram: identify → answer → dialect render → speech; call counts; audit;
  TTS and dialect variables; roadmap; client notes), `docs/API_CONTRACT.md` (`audioUrl: null` is
  per request; TTS request duration; no type change), `docs/TASKS.md` (current status and owner
  table), `docs/DECISIONS.md` (Phase 6 section; prettier), `docs/RUNBOOK.md` (rewritten in the
  required 8-step order plus "Before merging into `main`"), `docs/FINAL_REPORT.md` (rewritten for
  this job), `docs/AUDIT_FINDINGS.md` (N6 checked; N12–N14 added), `.env.example` (commented
  `AUDIT_*` variables), `docs/AGENT_LOG.md`.
- Commands run (sandbox: npm registry 403 at the proxy, no key; kit rebuilt from packages on disk:
  TypeScript 6.0.3, `@types/node` 26.1.2, `yaml` 2.9.0, zod 3.25.76 `zod/v4`, shims for vitest,
  express, cors, multer, dotenv, unpdf, `@google/genai`):
  - `tsc --noEmit -p shared/tsconfig.json`, `tsc --noEmit -p server/tsconfig.json` → 0 errors each;
    negative control (wrong `LanguageCode` in an `AnswerStyle`) → TS2322 reported.
  - `tsx --test --test-reporter=spec test/*.test.ts` (server, vitest env) → 183 pass, 10 fail:
    rate limit ×2, `GET /api/dialects` ×2, mock voice flow ×1 and `dialectTranscribe.test.ts` (2
    tests, file cannot load) need real Express; 3 eligibility tests fail by design. Same as Phase 5.
  - `tsx scripts/audit.ts --skip-static --label recheck` → 85 checks, every status, the matrix and
    the "ki keh raho he" verdict identical to the committed run; generated files restored with
    `git checkout`.
  - prettier 3.8.1 `--check`: 24 files repo-wide (29 at base `1b5d297`); of this branch's files
    only `docs/DECISIONS.md` was newly unformatted (now formatted).
  - Real Chromium 153 via the preinstalled Playwright: fake microphone flag
    (`--use-file-for-fake-audio-capture`) tone → peak 0.195, silence → 0; the real `speak.ts`
    bundled with esbuild against a stub API: 7/7 (dialectId only when given; low-bandwidth makes no
    `/api/tts` call; null audio and request errors fall back to browser speech; answer audio needs
    no request; `basis` → note). A WAV made with `encodeWav(concatPcm(…, 250))` decodes (1.45 s).
    Headless Chromium has 0 speech voices, so browser speech reports `ok: false`. Harnesses are in
    the agent's scratch space, not the repo.
  - `main`'s own mock `answerQuestion("ki keh raho he")` via `tsx` (temporary worktree, removed) →
    not-found text, no sources; client and server mock `query.ts` identical on `main`.
  - `git merge-tree --write-tree HEAD main` / `HEAD origin/feat/conversation-layer` (read-only) →
    11 / 9 conflicting files.
  - WebFetch: deployed `/api/health` → `{"status":"ok","mocks":true}`; `/api/dialects` → 14
    dialects; speech-generation docs → same model ids and language table as Phase 3, no input
    token limit stated, "Last updated 2026-10-28 UTC". `curl` to the deployed app from the shell →
    proxy 403 (not retried).
  - `mmdc` render of the new architecture diagram → renders.
- Results: no code changed in this phase. Stage statuses unchanged (A NOT-TESTED, B PARTIAL, C–G
  MOCK-ONLY, H NOT-TESTED, I PARTIAL, J FAIL); no matrix cell changed.
- Open issues: everything real-mode (owner, runbook steps 1–8); merge with `main` (N12); typed
  "ki keh raho he" points to a real-mode run (N13); `ASK_AGAIN` rewording (N14). Push: see the
  commit's delivery note in the final message.

## Phase 7 — bring `main`'s UI into the branch (owner request)

- Request: compare this branch's UI with `main` and make the later merge easy; never push to
  `main`, always push to `feat/dialect-voice`.
- Commits: `f0c27c2` (merge `origin/feat/conversation-layer` at `462aa75`, which contains `main` up
  to `698b211`), `642e2a8` (merge `origin/main` at `f8ccd8e`, PR #12), `9f27583` (restore the
  low-bandwidth guard lost in the merge), plus this docs commit.
- Conflicts resolved: `.gitignore`, `.prettierignore` (both sides kept); `useChat.ts`,
  `ChatProvider.tsx`, `ChatWindow.tsx`, `MessageBubble.tsx` (main's UI + dialect and voice notes);
  `speak.ts`, `SpeakButton.tsx`, `serverTts.ts` (add/add), `voice/strings.ts` (main's design +
  `dialectId`, `basis`, `onVoice`, `onUnavailable`); `README.md`, `docs/ARCHITECTURE.md`,
  `docs/AGENT_LOG.md`, `docs/FINAL_REPORT.md`. `api.dialects()` removed (main's `getDialects()`).
- Commands run (sandbox: npm registry blocked, no key):
  - `tsc --noEmit` server and shared → 0 errors; server tests (shim) → 183 pass, 10 fail (same 7
    Express-bound + 3 eligibility).
  - Client loose-shim typecheck (`client/tsconfig.sandbox.json`, local only, git-excluded; React
    hooks typed, other packages `any`) → no errors besides TS2709 shim artifacts; negative control
    reports a wrong `dialectId` type, a missing `via` and a missing string key.
  - Client tests via a sandbox runner (esbuild bundle per test file, `vi.mock` factories, fresh
    modules per test) → 19/19, including 5 new tests; mutating the per-request-null rule back to
    `main`'s makes the new test fail.
  - Merged `speak()` in real Chromium 153 against a stubbed API → 7/7 (dialectId and basis, no
    request in low-bandwidth mode, per-request null then server again, answer audio, browser
    fallback reports `onUnavailable` with 0 voices, loading listener toggles).
  - `main` is an ancestor of the branch (`git merge-base --is-ancestor`); a read-only trial merge
    into `main` (`git merge-tree`) has no conflicts.
- Not done: building or rendering the client (Vite, Tailwind, UI packages unavailable); real
  `npm test -w client`.
- Open issues: N9 (typed questions send no `dialectHint`), N13, N14, N15 in `AUDIT_FINDINGS.md`.

## Phase 8 — the mic answers your own speech, in your own way (owner request)

- Request: the mic must answer the captured audio, not a canned demo; Haryanvi in → Haryanvi out.
- Diagnosis: client uploads real audio (`useRecorder.ts`; placeholder audio only without a
  recorder); the server defaulted to `USE_MOCKS=true`, where `mockTranscribe()` ignores audio; the
  deployed app reports `mocks: true`. Regional replies needed a confirmed or high-confidence dialect.
- Files changed: `server/src/config/env.ts` (`USE_MOCKS=auto` default, `resolveMockSetting`,
  `DIALECT_REPLY=mirror` default), `server/src/modules/chat/dialectRender.ts` (`SpeakerStyle`,
  unnamed target, speaker block, unchanged-rewrite rule, `decideReplyDialect` context),
  `server/src/modules/chat/service.ts` (speaker sample, mirror decision in real mode only, fixed
  `ASK_AGAIN` not reworded), tests `server/test/dialectMirror.test.ts`,
  `server/test/useMocksAuto.test.ts`, `.env.example`, `README.md`, `docs/API_CONTRACT.md` (v6, no
  type change), `docs/ARCHITECTURE.md`, `docs/RUNBOOK.md`, `docs/AUDIT_FINDINGS.md` (F6, F7, N16),
  `docs/FINAL_REPORT.md`, `docs/DECISIONS.md`, regenerated `docs/PIPELINE_AUDIT.md` and
  `audit/results.json` (label `phase-8-mirror`).
- Commands run (sandbox, no key): server `tsc --noEmit` 0 errors; new tests 10/10; full server suite
  202 tests: 193 pass, the same 9 environment failures (Express-bound + 3 eligibility);
  `describeMocks()` in separate processes for `auto`/no key (all mocked), `auto`/key (off),
  `true`/key (all), `eligibility,sms`/key (those two); audit `--skip-static --label phase-8-mirror`
  (stage statuses unchanged; `J-shape-voice` now 9 calls, still 6 sequential).
- Not done: any real-model or real-speaker run (no key); client unchanged (it already labels
  dialect-worded answers and sends no `dialectId` when `answerStyle.dialectId` is null).
