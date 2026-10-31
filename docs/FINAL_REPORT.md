# Conversation layer delivery report

Date: 2026-10-31  
Branch: `feat/conversation-layer`

## Work completed by phase

- **0 — Recon:** documented the original text, voice, dialect and Listen flows, configuration,
  scripts, mock/real boundaries and documentation contradictions in `AGENT_NOTES.md`.
- **1 — Conversation module:** added intent-first `handleTurn`, direct and clarification routing,
  score thresholding, passage-id allowlisting and six-turn/500-session memory, with fake-dependency
  tests including `ki keh raho he`.
- **2 — Text wiring:** connected live text chat to `handleTurn`, English-query retrieval without a
  second translation, session history, and the existing Gemini error contract. The mock path
  remains separate and makes no Gemini call.
- **3 — Voice wiring:** transcript requests reuse the same chat path; selected dialect hints pass
  through, and automatic hints pass only at high confidence.
- **4 — Response contract:** mapped direct/grounded/not-found results; added optional
  `QueryResponse.intent` and updated shared types and API contract together.
- **5 — Dialects:** Braj and Wagdi already existed as experimental Hindi registry entries. Wired
  consented exemplars into chat; all 14 exemplar sets are currently empty. No dialect selector is
  present in the client.
- **6 — Spoken replies:** added optional Gemini TTS with timeout and browser fallback; the Listen
  action tries server audio first. TTS is disabled unless a model and key are configured.
- **7 — Calibration:** added the retrieval score calibration script and command. The script did
  not execute here because `tsx` failed at startup with `uv_os_get_passwd returned ENOMEM`.
- **8 — Evaluation:** added the 50-case offline plumbing harness and advisory live checks. Offline
  result: 50/50 passed. Live model quality was not verified.
- **9 — Scheme audit:** fetched official PMAY-G sources but did not change scheme files because
  the owner had uncommitted edits in the scheme data. PMAY-Gramin remains sample-marked and
  unverified; no ingest was run.
- **10 — Client polish:** existing client behavior already had the thinking indicator, plain direct
  bubbles and no sources card for direct replies. Client typecheck and build passed; owner edits
  were preserved.
- **11 — Deploy readiness:** added optional boolean health fields for dialect and TTS configuration.
  Confirmed the vector store exists and Vercel includes server data and eligibility JSON files.
  Mock smoke returned HTTP 200 for all 12 documented routes plus `/`.
- **12 — Docs:** updated architecture, task status, decisions and the ordered runbook. README was
  already modified in the starting tree and remains untouched; it needs owner reconciliation with
  the runbook.
- **13 — Final verification:** reinstall and final checks are summarized below. This report and
  the final phase log complete the report phase.

## Verification

- `npm.cmd install` — passed (`up to date`).
- `npm.cmd run typecheck` — passed for shared, server and client.
- `npm.cmd run lint` — passed.
- `npm.cmd test --workspaces --if-present` — 132 passed, 3 failed, 135 total. The same three
  eligibility tests failed at baseline and at final verification because unverified eligibility
  rules intentionally disable that feature (`ELIGIBILITY_RULES_UNVERIFIED`).
- `npm.cmd run build` — passed for shared, server and client.
- `npm.cmd run eval -w server` — passed, offline plumbing mode 50/50. This does not measure model
  answer quality.
- `npm.cmd run typecheck -w client` and `npm.cmd run build -w client` — passed.
- Mock server smoke — `/`, health, dialects, chat, voice, dialect transcription, eligibility
  start/answer, SMS, FAQ, TTS and RAG all returned HTTP 200. Health showed mocks on and both live
  feature flags false.
- Calibration CLI — **not tested successfully**: `tsx` exited before running script code with
  `uv_os_get_passwd returned ENOMEM` (Node v24.18.0).
- Real text — **not verified**: one live PM-KISAN query returned `AI_UNAVAILABLE` (503) in the
  sandbox. An approved-network retry produced no result to inspect.
- Real TTS — **not tested**: `GEMINI_TTS_MODEL` is not configured. Browser fallback was not tested
  on a phone.
- Phone, native-speaker and accessibility checks — **not tested**.

## API and configuration changes

- `QueryResponse.intent` is optional and may be `scheme_question`, `smalltalk`, `clarify`, or
  `out_of_scope`. Direct replies have no sources and an empty fraud warning.
- `HealthResponse` optionally includes `dialectConfigured` and `ttsConfigured`; both are booleans
  and expose no secret values.
- `POST /api/tts` returns an audio data URL when optional Gemini TTS succeeds, otherwise the
  existing `{ "audioUrl": null }` browser-fallback form.
- New environment variables: `GEMINI_TTS_MODEL` (blank disables server TTS) and
  `GEMINI_TTS_TIMEOUT_MS` (default `15000`). No Bhashini environment variables were added.

## Third-party verification

- Gemini speech generation request/output details were checked against the [official Gemini speech
  generation documentation](https://ai.google.dev/gemini-api/docs/speech-generation). Actual TTS
  output remains untested because no TTS model is configured.
- **UNVERIFIED:** Bhashini/Dhruva TTS is not implemented. Official [Bhashini pipeline
  docs](https://dibd-bhashini.gitbook.io/bhashini-apis/pipeline-compute-call) require account
  pipeline configuration, including an inference URL and auth header; [available
  models](https://dibd-bhashini.gitbook.io/bhashini-apis/available-models-for-usage) do not verify
  this owner's selected pipeline or credentials.
- Official PMAY-G sources were fetched on 2026-10-31: [Department of Rural Development
  continuation circular (PDF)](https://pmayg.dord.gov.in/netiay/writereaddata/Circulars/Letter%20to%20all%20States%2014%20Aug%20%281%29.pdf),
  [PMAY-G guidelines (PDF)](https://pmayg.dord.gov.in/netiayHome/Uploaded/Guidelines-English_Book_Final.pdf),
  and [official PMAY portal](https://pmayg.nic.in). No scheme text was copied or changed.

## Needs human verification

- Review all scheme documents and their existing owner edits against the official government
  sources. PMAY-Gramin remains `sample: true` and `verified: false`; all seven scheme files had
  pre-existing working-tree edits and were left unchanged. Rebuild `server/data/vectorstore.json`
  after those documents are reviewed; the checked-in vector store may not match pending source
  edits.
- Verify the four eligibility rule files against official sources. Eligibility is disabled while
  any rule remains unverified, explaining the three known test failures.
- Generate `server/data/faq.json` with `npm run prewarm -w server`; it is absent from the current
  workspace. `vercel.json` includes the generated file pattern.
- Run `npm run calibrate -w server`, set `RAG_MIN_SCORE`, then run
  `EVAL_MODE=live npm run eval -w server` on a machine where Gemini is available.
- Have native speakers review at least 15–20 replies. Collect 20+ explicitly consented exemplars
  per dialect as a starting point; all current dialect exemplar files are empty.
- Test real transcription, dialect recognition, Marathi/Tamil output and TTS on an HTTPS phone.
  Dialect output is best-effort; Wagdi speech recognition is expected to be weak; dialect speech
  uses the base-language voice; browser voices vary by device.
- Update README after reconciling its pre-existing owner edits with `RUNBOOK.md` and this report.

## Run it

Use mock mode first: `npm install`, set `USE_MOCKS=true`, then `npm run dev`. For live setup,
follow [`RUNBOOK.md`](RUNBOOK.md) in order. The live path requires reviewed scheme data, an
ingested vector store, a Gemini key and model access. Never put credentials in source control or
`VITE_*` values.
