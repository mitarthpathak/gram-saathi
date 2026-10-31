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
