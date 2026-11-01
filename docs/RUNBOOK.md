# Owner runbook

Run these steps in this order after pulling `feat/dialect-voice`. Commands run from the repository
root (bash; PowerShell variants where they differ). Real mode spends Gemini quota. Scheme facts
only come from the generated vector store. Nothing in steps 1–8 has been run by the agent that
wrote this file (no key, no npm registry): every result you get is the first real one.

For a public demo before step 6 is finished, set `DIALECT_REPLY=verified_only` (no dialect is
verified yet, so replies stay in the standard language). The default `mirror` rewords spoken
answers to sound like the speaker (for example Haryanvi in, Haryanvi-worded answer out), with the
facts locked but the wording unreviewed.

## 1. Keys, real mode, health check

```bash
cp .env.example .env       # then edit .env: GEMINI_API_KEY=<your key>; USE_MOCKS=auto (or false)
npm install
npm run typecheck && npm run lint && npm test -w server && npm run build
npm run dev:server         # terminal 1
curl -s http://localhost:4000/api/health   # terminal 2
```

- The repo checks above were never run with the real toolchain on this branch. Expected: the
  3 eligibility tests fail by design (rules unverified); anything else is new and needs fixing.
- `/api/health` must show `"mocks":false`. `true` means some module is still mocked: the key is
  missing, or `USE_MOCKS` is set to `true` or a module list (an older `.env` copied
  `USE_MOCKS=true`; change it to `auto` or `false`). Also keep `VITE_USE_MOCKS=false`, or the
  browser answers from its own fixtures and never sends your recording.
- On Vercel: set `GEMINI_API_KEY` for Production and Preview, and delete `USE_MOCKS` there (or set
  it to `auto`/`false`), then redeploy. Until then the deployed mic keeps answering the canned demo
  question. `"ttsConfigured":true` means server speech is on (set
  `GEMINI_TTS_MODEL=none` to keep browser speech only).
- One cheap model call (smalltalk, no scheme lookup): `npm run query -w server -- "Hello"`.
- Keep the key out of logs, source control and every `VITE_*` variable.

## 2. Ingest and prewarm

```bash
npm run ingest -w server
npm run prewarm -w server
```

Inspect `server/data/vectorstore.json` and `server/data/faq.json` before committing them. Ingest
on the platform you deploy from, or line endings make the startup check warn that the index is
stale (finding N1 in [AUDIT_FINDINGS.md](AUDIT_FINDINGS.md)).

## 3. Pipeline audit

```bash
AUDIT_BASE_URL=https://gram-saathi.vercel.app npm run audit -w server -- --label first-real
# PowerShell
$env:AUDIT_BASE_URL='https://gram-saathi.vercel.app'; npm run audit -w server -- --label first-real
```

- Writes `docs/PIPELINE_AUDIT.md` (before/after table on top, compared with the mock-mode
  baseline), `audit/results.json`, `eval/review/dialect-review.csv` and sample WAVs in
  `eval/out/tts/` (git-ignored).
- Read Stage B first. If a model id does not resolve, fix it (step 8) and run again before reading
  anything else.
- Stage C prints a `RAG_MIN_SCORE` recommendation. Use it only if the scheme and non-scheme score
  groups separate; restart the server and run the audit again after changing it. The older tools
  still work for a second opinion: `npm run calibrate -w server` and
  `EVAL_MODE=live npm run eval -w server`.
- Stage D answers the "ki keh raho he" question for real mode. Stage J shows real latency (the voice
  path makes 6 sequential model calls; finding N2).
- Optional variables: `AUDIT_TEXT_PER_LANGUAGE` (default 3), `AUDIT_ENV_NOTE` (a note about this
  machine), `AUDIT_WORKER_TIMEOUT_MS`. They are listed, commented out, in `.env.example`.

## 4. Real-speaker clips, then audit again

Record and label clips exactly as [eval/audio/README.md](../eval/audio/README.md) says (10 per
language or dialect, 5–10 s, 16 kHz mono WAV, consent first), then:

```bash
npm run audit -w server -- --label with-clips
```

Optional Stage H (a real browser pressing the mic button with a fake microphone that plays a
clip). Playwright is not a dependency of the repo, so install it only for this:

```bash
npm install --no-save playwright && npx playwright install chromium
npm run dev                                          # client :5173 against the real-mode API
AUDIT_CLIENT_URL=http://localhost:5173 npm run audit -w server -- --label with-browser
```

## 5. Voice candidates and auditioning

```bash
npm run tts:voices -w server     # writes docs/tts-voice-candidates.md (hi-IN, mr-IN, ta-IN, en-IN, region IN)
npm run tts:samples -w server    # renders each language's greeting in every configured voice
```

Put candidates into `server/src/config/tts-voices.json`, render samples again, and let a native
speaker listen. Details in [Voices](#voices-auditioning-voice-design-and-voice-replication-owner-only)
below.

## 6. Native-speaker review, then (human) `verified: true`

- Native speakers of each dialect fill the rating columns of `eval/review/dialect-review.csv`
  (understandable, natural, correct dialect, facts correct, 1–5, reviewer, notes) and listen to the
  WAVs in `eval/out/tts/` and `eval/out/tts/samples/`.
- Only a person sets `"verified": true` for a dialect in `server/src/config/dialect-render.json`,
  and only where the review earned it. With `DIALECT_REPLY=verified_only`, only those dialects get
  dialect wording.
- Registry `testStatus` changes go through the dialect calibration (real mode), which refuses until
  a label has 20+ held-out native rows:
  `npm run calibrate:dialect -- --target 0.90 --write-status`.
- Also review the strings marked `TODO(review-native)` (new Marathi and Tamil UI text, `ASK_AGAIN`).

## 7. Optional: voice design or voice replication (owner only, with consent)

See [Voices](#voices-auditioning-voice-design-and-voice-replication-owner-only), items 4 and 5.
The code never designs, clones or replicates a voice.

## 8. Pin model ids

When Stage B shows every model id resolving, write those exact ids into the deployment
environment (Vercel → Project Settings → Environment Variables) and `.env`: `GEMINI_CHAT_MODEL`,
`GEMINI_FALLBACK_MODEL`, `GEMINI_AUDIO_MODEL`, `GEMINI_EMBED_MODEL`, `GEMINI_TTS_MODEL`,
`GEMINI_TTS_DIALECT_MODEL`. Do not use moving aliases (such as `-latest`). Re-run step 3 after any
model change; changing `GEMINI_EMBED_MODEL` or `GEMINI_EMBED_DIMENSIONS` also needs step 2.

## Before merging into `main`

`feat/dialect-voice` already contains `main` (`f8ccd8e`, including PR #12) and the updated
`feat/conversation-layer` (`462aa75`): both were merged into this branch on 2026-10-31 (Phase 7),
and a read-only trial merge into `main` had no conflicts. Agents push only to
`feat/dialect-voice`, never to `main`.

1. Merge PR #9 (`feat/conversation-layer`) into `main`, or merge this branch directly: it contains
   PR #9.
2. If `main` has moved since, merge `main` into `feat/dialect-voice` first and resolve there.
   In the Listen code keep: low-bandwidth never fetches server audio; `dialectId` only for
   dialect-worded text; `basis` → honest labels; `audioUrl: null` with `basis` is per request.
3. Run `npm run typecheck`, `npm test` in both workspaces (`npm test -w client` includes the new
   `serverTts` and `speak` tests) and `npm run build`, then steps 1 and 3 above.

## Dialect data needed

The consented exemplar store currently contains **0 examples** for every dialect. Collect at least
**20 consented utterances from native speakers per dialect** before evaluating a label; 20 is a
starting floor, not a guarantee of accuracy. Do not write synthetic examples or normalize a
speaker's words.

| Dialect           | Current consented exemplars | Suggested minimum |
| ----------------- | --------------------------: | ----------------: |
| Awadhi            |                           0 |               20+ |
| Bagri             |                           0 |               20+ |
| Bhojpuri          |                           0 |               20+ |
| Braj              |                           0 |               20+ |
| Bundeli           |                           0 |               20+ |
| Dhundhari/Jaipuri |                           0 |               20+ |
| Harauti           |                           0 |               20+ |
| Haryanvi          |                           0 |               20+ |
| Malvi             |                           0 |               20+ |
| Marwari           |                           0 |               20+ |
| Mewari            |                           0 |               20+ |
| Mewati            |                           0 |               20+ |
| Shekhawati        |                           0 |               20+ |
| Wagdi             |                           0 |               20+ |

Braj and Wagdi are experimental Hindi entries in the registry. The client has no dialect selector;
the API accepts a confirmed `dialectHint`. Exemplar prompts respect
`DIALECT_EXEMPLARS_PER_LABEL` and `DIALECT_EXEMPLAR_TOKEN_BUDGET`; empty labels add no examples.
Keep a speaker's recordings in either the exemplar set or the eval set, never both.

## Voices: auditioning, voice design and voice replication (owner only)

Code in this repo never creates, designs, clones or replicates a voice. The voices in
`server/src/config/tts-voices.json` are prebuilt placeholders (`Kore`, the voice in the official
examples) marked `"status": "to-be-auditioned"`. Choosing better voices is a human job:

1. **List candidates** from the Gemini Extended Voice Library (needs `GEMINI_API_KEY`):

   ```bash
   npm run tts:voices -w server
   ```

   This writes `docs/tts-voice-candidates.md` (id, display name, language, accent, gender, pitch,
   description) for `hi-IN`, `mr-IN`, `ta-IN`, `en-IN` and region `IN`. An accent label is the
   provider's description, not a verified dialect.

2. **Try a candidate**: put it in `tts-voices.json`, either for a language
   (`"hi": { "voiceId": "<id>", "status": "to-be-auditioned" }`) or for one dialect
   (`"dialects": { "braj": { "voiceId": "<id>", "status": "to-be-auditioned" } }`), then render the
   fixed neutral sentence (the existing greeting of each language) in every configured voice:

   ```bash
   npm run tts:samples -w server                   # add -- --both-models to compare models
   ```

   Files land in `eval/out/tts/samples/` (git-ignored) with an `index.md` to fill in. That library
   ids are passed in `speech_config.voice` exactly like prebuilt names is UNVERIFIED (the docs do
   not show it); if a sample fails with a 400 for a library id, check the current docs.

3. **Audition**: a native speaker of that language or dialect listens and writes who listened and
   the verdict in `index.md`. Only then set `"status": "auditioned"`. Remove voices they reject.

4. **Voice design (optional, owner only)**: in Google AI Studio (or `POST /v1beta/voices` with
   `type="prompted"`, per the speech-generation docs) describe a voice persona in words, for
   example age range, warmth and pace. Never describe or imitate a real person. The result is a
   persistent `voice_…` id with a sample; audition it as in steps 2–3 before using it.

5. **Voice replication (optional, owner only, consent required)**: replicating a real speaker's
   voice needs that speaker's informed, recorded consent first. Record the consent (who, which
   voice, for what use, how long, how to withdraw) and keep it outside this repository. Then, in
   Google AI Studio (or `POST /v1beta/voices` with `type="replicated"`), supply the reference
   audio and the consent audio the docs require; use a stored voice (`voice_…` id), not the
   7-day `voicekey_…` form. Add it to `tts-voices.json` with a `note` pointing to your internal
   consent record (no personal data in the repo), audition it, and if consent is withdrawn,
   delete the voice at the provider, remove it from the config and redeploy.

## Known limits and recovery

- `npm run query -w server -- "Hello"` checks the configured chat model. If it reports an AI error,
  confirm `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL`, account access, quota, and service availability.
- In the conversation-layer job's environment the calibration CLI did not start (`tsx`:
  `uv_os_get_passwd returned ENOMEM`, Node v24.18.0). If you see that, try Node 22.
- Bhashini/Dhruva is not wired. Account-specific pipeline details are needed; see
  [DECISIONS.md](DECISIONS.md#server-side-tts).
- Dialect output is best-effort and unreviewed. Wagdi speech recognition is expected to be weak
  until reviewed native audio and consented examples are available.
- Browser voices vary by phone (many have no Marathi voice). Server speech returns no audio (the
  client then uses the browser voice) on any provider error or timeout, or when the audio would
  exceed about 3 MB (roughly 70 s at 16 kHz). Dialect text not named by the TTS model is spoken
  with its base-language voice (Hindi for Braj/Wagdi); the response says so (`basis`).
