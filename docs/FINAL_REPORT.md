# Conversation layer delivery report

Date: 2026-10-31  
Branch: `feat/conversation-layer`
Pull request: [#9](https://github.com/mitarthpathak/gram-saathi/pull/9)

After `main` advanced, the three reported client-file conflicts were resolved in a forward-only
branch commit. The conflict result was checked with `git merge-tree --write-tree` (exit 0); no
rebase or merge was performed. Typecheck, lint and build pass on the resolution; the same three
baseline eligibility tests remain failing because the rules are unverified.

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
- **9 — Scheme audit:** after the owner authorized pushing the existing working-tree edits, six
  scheme summaries (Atal Pension Yojana, Ayushman Bharat PM-JAY, MGNREGA, PM-KISAN, PMSBY and
  PMUY) were checked against official government sources, with `sourceUrl` and access date recorded
  in each file. PMAY-Gramin remains sample-marked and unverified. The vector store was regenerated.
- **10 — Client polish:** existing client behavior already had the thinking indicator, plain direct
  bubbles and no sources card for direct replies. Client typecheck and build passed; owner edits
  were preserved.
- **11 — Deploy readiness:** added optional boolean health fields for dialect and TTS configuration.
  Confirmed the vector store exists and Vercel includes server data and eligibility JSON files.
  Mock smoke returned HTTP 200 for all 12 documented routes plus `/`.
- **12 — Docs:** updated architecture, task status, decisions, README and the ordered runbook.
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
- `npm.cmd run ingest -w server` — completed after the six official-source reviews; the vector
  store fingerprint and timestamp changed. Live retrieval quality was not measured by ingest.
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
- New environment variables: `GEMINI_FALLBACK_MODEL` (default `gemini-3.6-flash`; `none` disables
  fallback), `GEMINI_TTS_MODEL` (blank disables server TTS) and `GEMINI_TTS_TIMEOUT_MS` (default
  `15000`). No Bhashini environment variables were added. The example keeps `USE_MOCKS=true` for a
  safe no-key quickstart.

## Third-party verification

- Gemini speech generation request/output details were checked against the [official Gemini speech
  generation documentation](https://ai.google.dev/gemini-api/docs/speech-generation). Actual TTS
  output remains untested because no TTS model is configured.
- The configured default chat/fallback model IDs were checked against [Google's official Gemini
  model catalog](https://ai.google.dev/gemini-api/docs/models) on 2026-10-31. Account access and
  live generation remain unverified.
- **UNVERIFIED:** Bhashini/Dhruva TTS is not implemented. Official [Bhashini pipeline
  docs](https://dibd-bhashini.gitbook.io/bhashini-apis/pipeline-compute-call) require account
  pipeline configuration, including an inference URL and auth header; [available
  models](https://dibd-bhashini.gitbook.io/bhashini-apis/available-models-for-usage) do not verify
  this owner's selected pipeline or credentials.
- Official PMAY-G sources were fetched on 2026-10-31: [Department of Rural Development
  continuation circular (PDF)](https://pmayg.dord.gov.in/netiay/writereaddata/Circulars/Letter%20to%20all%20States%2014%20Aug%20%281%29.pdf),
  [PMAY-G guidelines (PDF)](https://pmayg.dord.gov.in/netiayHome/Uploaded/Guidelines-English_Book_Final.pdf),
  and [official PMAY portal](https://pmayg.nic.in). PMAY content remains unchanged because it was
  not yet verified against a specific current benefit/eligibility claim.
- Six scheme summaries now record official source URLs and access date `2026-10-31` in front
  matter. URLs are in the respective files under `data/schemes/`; PM-JAY, MGNREGA and PMSBY source
  pages/PDFs were reachable through official government search results, though direct PDF access
  was restricted for PM-JAY. Exact URLs remain recorded per file for owner review.

## Needs human verification

- Review the six source-checked summaries and claims against their linked official government
  sources. PMAY-Gramin remains `sample: true` and `verified: false` and needs a human review against
  a specific current source before ingesting it.
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

## Run it

Use mock mode first: `npm install`, set `USE_MOCKS=true`, then `npm run dev`. For live setup,
follow [`RUNBOOK.md`](RUNBOOK.md) in order. The live path requires reviewed scheme data, an
ingested vector store, a Gemini key and model access. Never put credentials in source control or
`VITE_*` values.
