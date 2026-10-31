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
