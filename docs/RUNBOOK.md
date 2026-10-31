# Owner runbook

Use this sequence after pulling the feature branch. Commands are run from the repository root.
The live flow can incur Gemini usage. Scheme facts only come from the generated vector store.

## First verification run

1. Copy `.env.example` to `.env`, add `GEMINI_API_KEY`, set `USE_MOCKS=false`, and leave
   `GEMINI_TTS_MODEL` empty unless server speech is wanted. Set `GEMINI_TTS_MODEL` to a model id
   from the official Gemini speech-generation documentation to enable it. Keep credentials out
   of logs, source control, and all `VITE_*` variables. Check the configured chat model with one
   smalltalk call; this exercises the understand step without a scheme lookup:

   ```bash
   npm run query -w server -- "Hello"
   ```

2. Build the retrieval index and optional low-bandwidth FAQ data from the reviewed repo documents:

   ```bash
   npm run ingest -w server
   npm run prewarm -w server
   ```

   Inspect the generated files before committing/deploying: `server/data/vectorstore.json` and
   `server/data/faq.json`.

3. Measure retrieval scores, then set `RAG_MIN_SCORE` in `.env` to the recommended value and
   review the printed score distributions. Do not copy a recommendation blindly if the two groups
   overlap:

   ```bash
   npm run calibrate -w server
   ```

4. Run the live quality checks against the current index. They are advisory: inspect every failed
   row and the cited scheme passages before treating results as acceptable.

   ```bash
   # PowerShell
   $env:EVAL_MODE='live'; npm run eval -w server; Remove-Item Env:EVAL_MODE
   # bash
   EVAL_MODE=live npm run eval -w server
   ```

5. Start the app and expose the client over HTTPS using a tunnel. If the tunnel hostname is not
   already allowed by Vite, add it to `server.allowedHosts` in `client/vite.config.ts`:

   ```bash
   npm run dev
   cloudflared tunnel --url http://localhost:5173
   ```

   Open the HTTPS tunnel URL on a phone and speak five real sentences in the owner's language.
   Check the transcript and any reported dialect against what was said. Repeat for typed and voice
   questions. Do not use synthetic dialect phrases as evidence.

6. Ask native speakers to review 15–20 replies. Collect explicit consent before adding any speech
   to `data/dialects/exemplars/`; preserve their wording and keep eval speakers separate from
   exemplar speakers.

7. Work through every item in [Needs human verification](FINAL_REPORT.md#needs-human-verification)
   before presenting scheme answers as reliable.

## Dialect data needed

The consented exemplar store currently contains **0 examples** for every dialect. Collect at least
**20 consented utterances from native speakers per dialect** before evaluating a label; 20 is a
starting floor, not a guarantee of accuracy. Do not write synthetic examples or normalize a
speaker's words.

| Dialect | Current consented exemplars | Suggested minimum |
|---|---:|---:|
| Awadhi | 0 | 20+ |
| Bagri | 0 | 20+ |
| Bhojpuri | 0 | 20+ |
| Braj | 0 | 20+ |
| Bundeli | 0 | 20+ |
| Dhundhari/Jaipuri | 0 | 20+ |
| Harauti | 0 | 20+ |
| Haryanvi | 0 | 20+ |
| Malvi | 0 | 20+ |
| Marwari | 0 | 20+ |
| Mewari | 0 | 20+ |
| Mewati | 0 | 20+ |
| Shekhawati | 0 | 20+ |
| Wagdi | 0 | 20+ |

Braj and Wagdi are experimental Hindi entries in the registry. The client has no dialect selector;
the API accepts a confirmed `dialectHint`. Exemplar prompts respect
`DIALECT_EXEMPLARS_PER_LABEL` and `DIALECT_EXEMPLAR_TOKEN_BUDGET`; empty labels add no examples.

## Known limits and recovery

- `npm run query -w server -- "Hello"` checks the configured chat model. If it reports an AI error,
  confirm `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL`, account access, quota, and service availability.
- The calibration CLI was not runnable in the agent environment: `tsx` failed before the script
  started with `uv_os_get_passwd returned ENOMEM` (Node v24.18.0). Retry it on the owner's machine.
- Bhashini/Dhruva is not wired. Account-specific pipeline details are needed; see
  [DECISIONS.md](DECISIONS.md#server-side-tts).
- Dialect output is best-effort. Wagdi speech recognition is expected to be weak until reviewed
  native audio and consented examples are available.
- Browser voices vary by phone. Server Gemini TTS is optional; dialect text uses its base-language
  voice (Hindi for Braj/Wagdi).
- README has owner edits in the starting working tree and was left untouched under the repo's
  preservation rule. Check the limitations and configuration section against this runbook before
  using README as the operational reference.
