# Pipeline audit

Generated 2026-10-31T06:03:32.254Z by `npm run audit -w server` (label **after**) on branch `feat/dialect-voice` at `36895b1` (uncommitted changes present).

Statuses: PASS (ran and met the check), FAIL, PARTIAL, MOCK-ONLY (fixtures, proves nothing about the real pipeline), SYNTHETIC-ONLY (machine-generated audio, weak evidence), NEEDS-HUMAN (code cannot judge it), NOT-TESTED (with the reason). Nothing here is called PASS without a run.

Problems this audit raised that are not fixed in code are tracked by hand in [AUDIT_FINDINGS.md](AUDIT_FINDINGS.md); this file is regenerated on every run.

## Before / after

Baseline: baseline at `4c62fcb` (2026-10-31T05:21:13.835Z). Now: after at `36895b1`.

| Stage | Before | After |
|---|---|---|
| A Static checks | NOT-TESTED | NOT-TESTED |
| B Real-mode preflight | PARTIAL | PARTIAL |
| C Retrieval | MOCK-ONLY | MOCK-ONLY |
| D Text answers (POST /api/chat/query) | MOCK-ONLY | MOCK-ONLY |
| E Dialect text | MOCK-ONLY | MOCK-ONLY |
| F Speech in (POST /api/voice/query) | MOCK-ONLY | MOCK-ONLY |
| G Speech out (POST /api/tts) | MOCK-ONLY | MOCK-ONLY |
| H Browser end-to-end mic test (optional) | NOT-TESTED | NOT-TESTED |
| I Robustness and error codes | PARTIAL | PARTIAL |
| J Latency and cost shape | FAIL | FAIL |

No matrix cell changed status.

**Check-level changes**

| Check | Before | After | What it checks |
|---|---|---|---|
| I-tts-ok | (new) | PASS | Server speech returns a WAV data URL (fake provider) |
| I-tts-basis | (new) | PASS | Speech basis is reported honestly for named and unnamed dialects |
| I-tts-unknown-dialect | (new) | PASS | POST /api/tts with an unknown dialectId |
| I-clarify-guard | (new) | PASS | A clarification cannot introduce facts the user was not told (fake model) |
| J-shape-tts-long | (new) | PASS | Listen on a long answer (split into pieces) |

A stage status aggregates its checks, so new passing checks do not change a stage that also has NOT-TESTED, MOCK-ONLY or FAIL checks. Checks run with a fake model prove plumbing, not real-model behaviour.

## How this run was made

| Worker | Purpose | USE_MOCKS | Gemini key | API access |
|---|---|---|---|---|
| configured | Stages B–H and live J, exactly as the environment is configured | voice, chat, dialect, rag, eligibility, sms, tts, faq | not set | controllers called in-process |
| fake | Stages I and J (shape): USE_MOCKS=false, no key, fake Gemini backend | off | not set | controllers called in-process |

**Environment notes**

- Agent sandbox, 2026-10-31: no GEMINI_API_KEY, npm registry blocked (no express, vite, react, playwright); a sandbox shim kit provides typescript, tsx, zod, dotenv and a node:test-based vitest shim. The deployed app (https://gram-saathi.vercel.app/api/health, fetched with WebFetch on 2026-10-31) answered {"status":"ok","mocks":true} without dialectConfigured/ttsConfigured, i.e. an older build in mock mode; it is not reachable from the shell.
- configured worker: Express app could not be started (express is not installed in the agent sandbox (npm registry blocked)); controllers and the error handler are called directly, without Express routing, multer or the per-IP rate limiter.
- fake worker: Express app could not be started (express is not installed in the agent sandbox (npm registry blocked)); controllers and the error handler are called directly, without Express routing, multer or the per-IP rate limiter.

## Regional readiness matrix

| Row | Understands speech | Identifies dialect | Answers in correct language | Answers in the dialect (text) | TTS names this language | Speaks the reply | Accent matches |
|---|---|---|---|---|---|---|---|
| Hindi | MOCK-ONLY | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | PASS | MOCK-ONLY | MOCK-ONLY |
| Marathi | MOCK-ONLY | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | PASS | MOCK-ONLY | MOCK-ONLY |
| Tamil | MOCK-ONLY | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | PASS | MOCK-ONLY | MOCK-ONLY |
| English | MOCK-ONLY | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | PASS | MOCK-ONLY | MOCK-ONLY |
| Marwari (मारवाड़ी) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | FAIL | MOCK-ONLY | MOCK-ONLY |
| Dhundhari/Jaipuri (ढूंढाड़ी/जयपुरी) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | FAIL | MOCK-ONLY | MOCK-ONLY |
| Shekhawati (शेखावाटी) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | FAIL | MOCK-ONLY | MOCK-ONLY |
| Bagri (बागड़ी) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | FAIL | MOCK-ONLY | MOCK-ONLY |
| Mewari (मेवाड़ी) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | FAIL | MOCK-ONLY | MOCK-ONLY |
| Mewati (मेवाती) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | FAIL | MOCK-ONLY | MOCK-ONLY |
| Harauti (हाड़ौती) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | FAIL | MOCK-ONLY | MOCK-ONLY |
| Malvi (मालवी) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | FAIL | MOCK-ONLY | MOCK-ONLY |
| Wagdi (वागड़ी) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | FAIL | MOCK-ONLY | MOCK-ONLY |
| Braj (ब्रज) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | FAIL | MOCK-ONLY | MOCK-ONLY |
| Haryanvi (हरियाणवी) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | FAIL | MOCK-ONLY | MOCK-ONLY |
| Bhojpuri (भोजपुरी) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | PASS | MOCK-ONLY | MOCK-ONLY |
| Awadhi (अवधी) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | PASS | MOCK-ONLY | MOCK-ONLY |
| Bundeli (बुंदेली) | NOT-TESTED | NOT-TESTED | MOCK-ONLY | MOCK-ONLY | FAIL | MOCK-ONLY | MOCK-ONLY |

<details><summary>Evidence for every cell</summary>

**Hindi**

- Understands speech: MOCK-ONLY — results.json stages.F check F-mock-hi
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.D checks D-hi-*
- Answers in the dialect (text): MOCK-ONLY — standard-language row: same as "answers in correct language"
- TTS names this language: PASS — "Hindi" is listed for both Gemini 3.8 TTS models (https://ai.google.dev/gemini-api/docs/speech-generation, updated 2026-10-28, read 2026-10-31)
- Speaks the reply: MOCK-ONLY — results.json stages.G check G-hi
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Marathi**

- Understands speech: MOCK-ONLY — results.json stages.F check F-mock-mr
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.D checks D-mr-*
- Answers in the dialect (text): MOCK-ONLY — standard-language row: same as "answers in correct language"
- TTS names this language: PASS — "Marathi" is listed for both Gemini 3.8 TTS models (https://ai.google.dev/gemini-api/docs/speech-generation, updated 2026-10-28, read 2026-10-31)
- Speaks the reply: MOCK-ONLY — results.json stages.G check G-mr
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Tamil**

- Understands speech: MOCK-ONLY — results.json stages.F check F-mock-ta
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.D checks D-ta-*
- Answers in the dialect (text): MOCK-ONLY — standard-language row: same as "answers in correct language"
- TTS names this language: PASS — "Tamil" is listed for both Gemini 3.8 TTS models (https://ai.google.dev/gemini-api/docs/speech-generation, updated 2026-10-28, read 2026-10-31)
- Speaks the reply: MOCK-ONLY — results.json stages.G check G-ta
- Accent matches: MOCK-ONLY — no server audio in mock mode

**English**

- Understands speech: MOCK-ONLY — results.json stages.F check F-mock-en
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.D checks D-en-*
- Answers in the dialect (text): MOCK-ONLY — standard-language row: same as "answers in correct language"
- TTS names this language: PASS — "English" is listed for both Gemini 3.8 TTS models (https://ai.google.dev/gemini-api/docs/speech-generation, updated 2026-10-28, read 2026-10-31)
- Speaks the reply: MOCK-ONLY — results.json stages.G check G-en
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Marwari (मारवाड़ी)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-marwari
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-marwari (rendered standard: render_off)
- TTS names this language: FAIL — not listed by name in the TTS language table (https://ai.google.dev/gemini-api/docs/speech-generation, read 2026-10-31); speech can only approximate it with the parent-language voice
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Dhundhari/Jaipuri (ढूंढाड़ी/जयपुरी)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-dhundhari
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-dhundhari (rendered standard: render_off)
- TTS names this language: FAIL — not listed by name in the TTS language table (https://ai.google.dev/gemini-api/docs/speech-generation, read 2026-10-31); speech can only approximate it with the parent-language voice
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Shekhawati (शेखावाटी)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-shekhawati
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-shekhawati (rendered standard: render_off)
- TTS names this language: FAIL — not listed by name in the TTS language table (https://ai.google.dev/gemini-api/docs/speech-generation, read 2026-10-31); speech can only approximate it with the parent-language voice
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Bagri (बागड़ी)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-bagri
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-bagri (rendered standard: render_off)
- TTS names this language: FAIL — not listed by name in the TTS language table (https://ai.google.dev/gemini-api/docs/speech-generation, read 2026-10-31); speech can only approximate it with the parent-language voice
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Mewari (मेवाड़ी)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-mewari
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-mewari (rendered standard: render_off)
- TTS names this language: FAIL — not listed by name in the TTS language table (https://ai.google.dev/gemini-api/docs/speech-generation, read 2026-10-31); speech can only approximate it with the parent-language voice
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Mewati (मेवाती)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-mewati
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-mewati (rendered standard: render_off)
- TTS names this language: FAIL — not listed by name in the TTS language table (https://ai.google.dev/gemini-api/docs/speech-generation, read 2026-10-31); speech can only approximate it with the parent-language voice
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Harauti (हाड़ौती)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-harauti
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-harauti (rendered standard: render_off)
- TTS names this language: FAIL — not listed by name in the TTS language table (https://ai.google.dev/gemini-api/docs/speech-generation, read 2026-10-31); speech can only approximate it with the parent-language voice
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Malvi (मालवी)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-malvi
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-malvi (rendered standard: render_off)
- TTS names this language: FAIL — not listed by name in the TTS language table (https://ai.google.dev/gemini-api/docs/speech-generation, read 2026-10-31); speech can only approximate it with the parent-language voice
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Wagdi (वागड़ी)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-wagdi
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-wagdi (rendered standard: render_off)
- TTS names this language: FAIL — not listed by name in the TTS language table (https://ai.google.dev/gemini-api/docs/speech-generation, read 2026-10-31); speech can only approximate it with the parent-language voice
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Braj (ब्रज)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-braj
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-braj (rendered standard: render_off)
- TTS names this language: FAIL — not listed by name in the TTS language table (https://ai.google.dev/gemini-api/docs/speech-generation, read 2026-10-31); speech can only approximate it with the parent-language voice
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Haryanvi (हरियाणवी)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-haryanvi
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-haryanvi (rendered standard: render_off)
- TTS names this language: FAIL — not listed by name in the TTS language table (https://ai.google.dev/gemini-api/docs/speech-generation, read 2026-10-31); speech can only approximate it with the parent-language voice
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Bhojpuri (भोजपुरी)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-bhojpuri
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-bhojpuri (rendered standard: render_off)
- TTS names this language: PASS — "Bhojpuri" is listed for both Gemini 3.8 TTS models (https://ai.google.dev/gemini-api/docs/speech-generation, updated 2026-10-28, read 2026-10-31)
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Awadhi (अवधी)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-awadhi
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-awadhi (rendered standard: render_off)
- TTS names this language: PASS — "Awadhi" is listed for both Gemini 3.8 TTS models (https://ai.google.dev/gemini-api/docs/speech-generation, updated 2026-10-28, read 2026-10-31)
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

**Bundeli (बुंदेली)**

- Understands speech: NOT-TESTED — no clip for this row was run
- Identifies dialect: NOT-TESTED — needs labelled real-speaker clips in eval/audio (none supplied)
- Answers in correct language: MOCK-ONLY — results.json stages.E check E-bundeli
- Answers in the dialect (text): MOCK-ONLY — results.json stages.E check E-bundeli (rendered standard: render_off)
- TTS names this language: FAIL — not listed by name in the TTS language table (https://ai.google.dev/gemini-api/docs/speech-generation, read 2026-10-31); speech can only approximate it with the parent-language voice
- Speaks the reply: MOCK-ONLY — mock TTS returns no audio for any input
- Accent matches: MOCK-ONLY — no server audio in mock mode

</details>

### Verdict per row

- **Hindi:** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches.
- **Marathi:** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches.
- **Tamil:** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches.
- **English:** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches.
- **Marwari (मारवाड़ी):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches. TTS does not name this variety, so its speech can only be a parent-language approximation.
- **Dhundhari/Jaipuri (ढूंढाड़ी/जयपुरी):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches. TTS does not name this variety, so its speech can only be a parent-language approximation.
- **Shekhawati (शेखावाटी):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches. TTS does not name this variety, so its speech can only be a parent-language approximation.
- **Bagri (बागड़ी):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches. TTS does not name this variety, so its speech can only be a parent-language approximation.
- **Mewari (मेवाड़ी):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches. TTS does not name this variety, so its speech can only be a parent-language approximation.
- **Mewati (मेवाती):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches. TTS does not name this variety, so its speech can only be a parent-language approximation.
- **Harauti (हाड़ौती):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches. TTS does not name this variety, so its speech can only be a parent-language approximation.
- **Malvi (मालवी):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches. TTS does not name this variety, so its speech can only be a parent-language approximation.
- **Wagdi (वागड़ी):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches. TTS does not name this variety, so its speech can only be a parent-language approximation.
- **Braj (ब्रज):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches. TTS does not name this variety, so its speech can only be a parent-language approximation.
- **Haryanvi (हरियाणवी):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches. TTS does not name this variety, so its speech can only be a parent-language approximation.
- **Bhojpuri (भोजपुरी):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches.
- **Awadhi (अवधी):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches.
- **Bundeli (बुंदेली):** Nothing was shown to work with real models in this run. Not proven (untested, mock or synthetic only): understands speech, identifies dialect, answers in correct language, answers in the dialect (text), speaks the reply, accent matches. TTS does not name this variety, so its speech can only be a parent-language approximation.

## "ki keh raho he"

- Real mode (this branch, with the intent router): NOT-TESTED — no run with a Gemini key. The router prompt lists "ki keh raho he" as a clarification, but a prompt is not proof.
- Mock mode, typed: not reproduced — the mock keyword search finds no scheme, so the fixed not-found text is returned (no PM-KISAN answer).
- Mock mode, spoken: REPRODUCED for any recording — the mock speech-to-text ignores the audio and returns the canned question “पीएम किसान योजना में साल में कितना पैसा मिलता है?”, which gets the canned formal-Hindi scheme answer.
- Real-mode guard (added in this branch): a clarification may not state numbers, amounts, URLs or phone numbers the user was not already told; otherwise the fixed “please ask again” text is returned. With a fake model this check is PASS.
- Fix status: in real mode the intent router (prompt) and the facts guard (code) address the reported reply; neither has been run against the real model here. USE_MOCKS=true must behave exactly as before (R8), so mock mode keeps its canned voice answers.

- configured worker, mock mode, typed: MOCK-ONLY — answer: “Maaf kijiye, yeh jaankari mere paas maujood adhikarik yojana dastavezon mein nahi mili, isliye main andaza nahi lagaunga. Kripya najdeeki CSC ya gram panchayat mein poochhein.” (notFound true, intent -, sources none)
- configured worker, mock voice with 1.5 s of silence: transcript “पीएम किसान योजना में साल में कितना पैसा मिलता है?”, language hi, dialect marwari; answer “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में …”
- fake worker, I-clarify-guard: PASS — Fake router answers “ki keh raho he” with a ₹6,000 sentence. Fresh session (nothing said yet): replaced by the fixed “please ask again” text. After a scheme answer that said ₹6,000: allowed (repeats an earlier fact). Whether the real model classifies the message as a clarification is NOT-TESTED here.

## Stages

| Stage | Status | Mode | Checks | Note |
|---|---|---|---|---|
| A Static checks | NOT-TESTED | static | 0 | Dependencies are not installed (node_modules/.bin lacks tsc, vitest, eslint, vite, tsx). Run `npm install` first; no static result can be claimed without the repo's own toolchain. |
| B Real-mode preflight | PARTIAL | static | 9 |  |
| C Retrieval | MOCK-ONLY | mock | 6 |  |
| D Text answers (POST /api/chat/query) | MOCK-ONLY | mock | 25 |  |
| E Dialect text | MOCK-ONLY | mock | 14 |  |
| F Speech in (POST /api/voice/query) | MOCK-ONLY | mock | 4 |  |
| G Speech out (POST /api/tts) | MOCK-ONLY | mock | 4 |  |
| H Browser end-to-end mic test (optional) | NOT-TESTED | none | 0 | AUDIT_CLIENT_URL is not set (the running client, e.g. http://localhost:5173, served against a real-mode API). |
| I Robustness and error codes | PARTIAL | fake-backend | 14 |  |
| J Latency and cost shape | FAIL | none | 9 |  |

### A. Static checks — NOT-TESTED

_Dependencies are not installed (node_modules/.bin lacks tsc, vitest, eslint, vite, tsx). Run `npm install` first; no static result can be claimed without the repo's own toolchain._

_No checks ran._

### B. Real-mode preflight — PARTIAL

| Status | Check | Result | Evidence |
|---|---|---|---|
| PASS | Environment variables validate | server/src/config/env.ts parsed the environment (it exits the process on invalid values, so reaching this line is the evidence). | server/src/config/env.ts |
| NOT-TESTED | Chat model id resolves | Real mode needs GEMINI_API_KEY; it is not set in this environment (no real model call was made). Model id "gemini-3.8-flash" was not resolved. |  |
| NOT-TESTED | Fallback model id resolves | Real mode needs GEMINI_API_KEY; it is not set in this environment (no real model call was made). Model id "gemini-3.6-flash" was not resolved. |  |
| NOT-TESTED | Speech-to-text model id resolves (text-only ping) | Real mode needs GEMINI_API_KEY; it is not set in this environment (no real model call was made). Model id "gemini-3.8-flash" was not resolved. |  |
| NOT-TESTED | Embedding model id resolves | Real mode needs GEMINI_API_KEY; it is not set in this environment (no real model call was made). Model id "gemini-embedding-2" was not resolved. |  |
| NOT-TESTED | Text-to-speech model id resolves | tts is mocked (USE_MOCKS), so no TTS call was made. |  |
| PASS | Knowledge base file exists and matches the embedding settings | 26 chunks from 6 documents (atal-pension-yojana, ayushman-bharat-pmjay, mgnrega, pm-kisan, pm-suraksha-bima-yojana, pm-ujjwala-yojana); model gemini-embedding-2, 768 dimensions. | server/data/vectorstore.json |
| PARTIAL | Index was built from the current verified scheme documents | Content matches, line endings do not: this checkout fingerprints as b5a3948317424543, the index was built from CRLF (Windows) text (94964a0a8624ab95). The server's startup check (server/src/startup.ts) compares raw fingerprints, so it logs a false "data/schemes changed since the last ingest" warning on this platform. Re-ingest on the deploy platform or normalize line endings in fingerprintDocuments. | data/schemes/*.md<br>server/data/vectorstore.json<br>server/src/modules/rag/documents.ts fingerprintDocuments |
| PARTIAL | Scheme documents marked verified (front matter) | 7 documents; 1 sample/unverified: pmay-gramin (sample: true, verified: false). Unverified documents are excluded from the index. | data/schemes/*.md front matter |

### C. Retrieval — MOCK-ONLY

- englishScheme: n=11 min 0.000 · p25 0.000 · median 0.000 · p75 0.920 · max 0.920
- nativeScheme: n=33 min 0.000 · p25 0.000 · median 0.000 · p75 0.900 · max 0.920
- nonScheme: n=10 min 0.000 · p25 0.000 · median 0.000 · p75 0.000 · max 0.000
- outsideKnowledgeBase: n=4 min 0.000 · p25 0.000 · median 0.000 · p75 0.000 · max 0.000

| Status | Check | Result | Evidence |
|---|---|---|---|
| MOCK-ONLY | Recall@4 for hi questions (raw native-script text) | 5/11 questions had their scheme in the top 4; missed: apy-pension, apy-who, pmsby-cover, ujjwala-who, mgnrega-days, mgnrega-job-card. Thresholds: PASS ≥ 0.9, PARTIAL ≥ 0.6. USE_MOCKS covers rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | data/faq/questions.json<br>server/eval/audit-goldset.json |
| MOCK-ONLY | Recall@4 for mr questions (raw native-script text) | 5/11 questions had their scheme in the top 4; missed: apy-pension, apy-who, pmsby-cover, ujjwala-who, mgnrega-days, mgnrega-job-card. Thresholds: PASS ≥ 0.9, PARTIAL ≥ 0.6. USE_MOCKS covers rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | data/faq/questions.json<br>server/eval/audit-goldset.json |
| MOCK-ONLY | Recall@4 for ta questions (raw native-script text) | 4/11 questions had their scheme in the top 4; missed: pm-kisan-register, apy-pension, apy-who, pmsby-cover, ujjwala-who, mgnrega-days, mgnrega-job-card. Thresholds: PASS ≥ 0.9, PARTIAL ≥ 0.6. USE_MOCKS covers rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | data/faq/questions.json<br>server/eval/audit-goldset.json |
| MOCK-ONLY | Recall@4 for en questions (raw English text) | 5/11 questions had their scheme in the top 4; missed: apy-pension, apy-who, pmsby-cover, ujjwala-who, mgnrega-days, mgnrega-job-card. Thresholds: PASS ≥ 0.9, PARTIAL ≥ 0.6. USE_MOCKS covers rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | data/faq/questions.json<br>server/eval/audit-goldset.json |
| MOCK-ONLY | Scheme and non-scheme scores separate | Overlap: lowest English scheme score 0.000 ≤ highest non-scheme score 0.000; no single threshold separates them, so some non-scheme messages pass retrieval (the intent router must catch them) or some scheme questions are dropped. | results.json stages.C.data |
| MOCK-ONLY | Current RAG_MIN_SCORE (0.5) on this gold set | 25/44 answerable questions score below the threshold (ta:pm-kisan-register 0.000, hi:apy-pension 0.000, mr:apy-pension 0.000, ta:apy-pension 0.000, en:apy-pension 0.000, hi:apy-who 0.000, mr:apy-who 0.000, ta:apy-who 0.000, …); 0/10 non-scheme messages pass it. Recommendation from English questions vs non-scheme: 0.900 (best balanced accuracy; groups overlap); from all languages: 0.900. The live router searches with an English query, so the English-based value is the relevant one; do not change RAG_MIN_SCORE from mock results. | results.json stages.C.data<br>server/scripts/calibrate-rag.ts recommendThreshold |

### D. Text answers (POST /api/chat/query) — MOCK-ONLY

| Status | Check | Result | Evidence |
|---|---|---|---|
| MOCK-ONLY | hi: पीएम किसान योजना में साल में कितना पैसा मिलता है? | Problems: sources not found in the index: pm-kisan/Benefits, pm-kisan/Eligibility, pm-kisan/How to apply; facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. intent (none); 3 source(s); facts numbers 2000, 6000; rupees ₹2000, ₹6000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | hi: आयुष्मान कार्ड से कितने रुपये तक का मुफ़्त इलाज मिलता है? | Problems: sources not found in the index: ayushman-bharat-pmjay/Benefits, ayushman-bharat-pmjay/Eligibility, ayushman-bharat-pmjay/How to apply; facts not in the cited passages: numbers 14555, 2011. intent (none); 3 source(s); facts numbers 14555, 2011, 5, 70; rupees ₹5; urls beneficiary.nha.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “आयुष्मान भारत पीएम-जय में हर परिवार को हर साल ₹5 लाख तक का मुफ़्त इलाज सरकारी और सूचीबद्ध निजी अस्पतालों में मिलता है। इलाज कैशलेस है, अस्पताल में कोई पैसा नहीं देना होता। पात्रता…” (notFound false, intent -, sources ayushman-bharat-pmjay\|ayushman-bharat-pmjay\|ayushman-bharat-pmjay) |
| MOCK-ONLY | hi: मनरेगा में कितने दिन का काम मिलता है? | Problems: notFound for an answerable question; no sources. intent (none); 0 source(s); facts none. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “माफ़ कीजिए, यह जानकारी मेरे पास मौजूद आधिकारिक योजना दस्तावेज़ों में नहीं मिली, इसलिए अंदाज़े से जवाब देना ठीक नहीं होगा। कृपया नज़दीकी CSC केंद्र या ग्राम पंचायत कार्यालय में पुष…” (notFound true, intent -, sources none) |
| MOCK-ONLY | mr: पीएम किसान योजनेत वर्षाला किती पैसे मिळतात? | Problems: sources not found in the index: pm-kisan/Benefits, pm-kisan/Eligibility, pm-kisan/How to apply; facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. intent (none); 3 source(s); facts numbers 2000, 6000; rupees ₹2000, ₹6000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजनेत पात्र शेतकरी कुटुंबांना दरवर्षी ₹6,000 मिळतात, जे ₹2,000 च्या तीन हप्त्यांमध्ये थेट बँक खात्यात जमा होतात. जमिनीच्या नोंदीत तुमचे नाव असणे आवश्यक आहे आणि आधार eK…” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | mr: आयुष्मान कार्डवर किती रुपयांपर्यंत मोफत उपचार मिळतात? | Problems: sources not found in the index: ayushman-bharat-pmjay/Benefits, ayushman-bharat-pmjay/Eligibility, ayushman-bharat-pmjay/How to apply; facts not in the cited passages: numbers 14555, 2011. intent (none); 3 source(s); facts numbers 14555, 2011, 5, 70; rupees ₹5; urls beneficiary.nha.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “आयुष्मान भारत पीएम-जय अंतर्गत प्रत्येक कुटुंबाला दरवर्षी ₹5 लाखांपर्यंत मोफत उपचार सरकारी आणि सूचीबद्ध खासगी रुग्णालयांमध्ये मिळतात. उपचार कॅशलेस आहेत, रुग्णालयात पैसे भरावे लागत …” (notFound false, intent -, sources ayushman-bharat-pmjay\|ayushman-bharat-pmjay\|ayushman-bharat-pmjay) |
| MOCK-ONLY | mr: मनरेगामध्ये किती दिवसांचे काम मिळते? | Problems: notFound for an answerable question; no sources. intent (none); 0 source(s); facts none. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “माफ करा, ही माहिती माझ्याकडील अधिकृत योजना कागदपत्रांमध्ये सापडली नाही, म्हणून मी अंदाज लावणार नाही. कृपया जवळच्या CSC केंद्रात किंवा ग्रामपंचायत कार्यालयात खात्री करा.” (notFound true, intent -, sources none) |
| MOCK-ONLY | ta: பிஎம் கிசான் திட்டத்தில் ஆண்டுக்கு எவ்வளவு பணம் கிடைக்கும்? | Problems: sources not found in the index: pm-kisan/Benefits, pm-kisan/Eligibility, pm-kisan/How to apply; facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. intent (none); 3 source(s); facts numbers 2000, 6000; rupees ₹2000, ₹6000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “பிஎம்-கிசான் திட்டத்தில் தகுதியுள்ள விவசாயக் குடும்பங்களுக்கு ஆண்டுக்கு ₹6,000 கிடைக்கும். இது ₹2,000 வீதம் மூன்று தவணைகளாக நேரடியாக வங்கிக் கணக்கில் செலுத்தப்படும். நில ஆவணங்களில…” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | ta: ஆயுஷ்மான் அட்டையில் எவ்வளவு ரூபாய் வரை இலவச சிகிச்சை கிடைக்கும்? | Problems: sources not found in the index: ayushman-bharat-pmjay/Benefits, ayushman-bharat-pmjay/Eligibility, ayushman-bharat-pmjay/How to apply; facts not in the cited passages: numbers 14555, 2011. intent (none); 3 source(s); facts numbers 14555, 2011, 5, 70; rupees ₹5; urls beneficiary.nha.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “ஆயுஷ்மான் பாரத் பிஎம்-ஜெய் திட்டத்தில் ஒவ்வொரு குடும்பத்துக்கும் ஆண்டுக்கு ₹5 லட்சம் வரை இலவச மருத்துவமனை சிகிச்சை, அரசு மற்றும் பட்டியலிடப்பட்ட தனியார் மருத்துவமனைகளில் கிடைக்கும…” (notFound false, intent -, sources ayushman-bharat-pmjay\|ayushman-bharat-pmjay\|ayushman-bharat-pmjay) |
| MOCK-ONLY | ta: நூறு நாள் வேலைத் திட்டத்தில் (MGNREGA) எத்தனை நாள் வேலை கிடைக்கும்? | Problems: notFound for an answerable question; no sources. intent (none); 0 source(s); facts none. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “மன்னிக்கவும், என்னிடம் உள்ள அதிகாரப்பூர்வ திட்ட ஆவணங்களில் இந்தத் தகவல் இல்லை; அதனால் நான் ஊகித்துச் சொல்ல மாட்டேன். அருகிலுள்ள பொது சேவை மையம் (CSC) அல்லது கிராம பஞ்சாயத்து அலுவல…” (notFound true, intent -, sources none) |
| MOCK-ONLY | en: How much money does PM-KISAN give in a year? | Problems: sources not found in the index: pm-kisan/Benefits, pm-kisan/Eligibility, pm-kisan/How to apply; facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. intent (none); 3 source(s); facts numbers 2000, 6000; rupees ₹2000, ₹6000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “Under PM-KISAN, eligible farmer families get ₹6,000 a year, paid as three instalments of ₹2,000 straight into their bank account. Your name must be in the land records and Aadhaar…” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | en: How much free treatment does the Ayushman card give? | Problems: sources not found in the index: ayushman-bharat-pmjay/Benefits, ayushman-bharat-pmjay/Eligibility, ayushman-bharat-pmjay/How to apply; facts not in the cited passages: numbers 14555, 2011. intent (none); 3 source(s); facts numbers 14555, 2011, 5, 70; rupees ₹5; urls beneficiary.nha.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “Ayushman Bharat PM-JAY gives free hospital treatment of up to ₹5 lakh per family per year at government and empanelled private hospitals. It is cashless: you pay nothing at the ho…” (notFound false, intent -, sources ayushman-bharat-pmjay\|ayushman-bharat-pmjay\|ayushman-bharat-pmjay) |
| MOCK-ONLY | en: How many days of work does MGNREGA give? | Problems: notFound for an answerable question; no sources. intent (none); 0 source(s); facts none. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “Sorry, I could not find this in the official scheme documents I have, so I will not guess. Please confirm at your nearest CSC or gram panchayat office.” (notFound true, intent -, sources none) |
| MOCK-ONLY | Scheme not in the index (pmay-gramin) is not answered from memory | notFound with no sources, as required. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “माफ़ कीजिए, यह जानकारी मेरे पास मौजूद आधिकारिक योजना दस्तावेज़ों में नहीं मिली, इसलिए अंदाज़े से जवाब देना ठीक नहीं होगा। कृपया नज़दीकी CSC केंद्र या ग्राम पंचायत कार्यालय में पुष…” (notFound true, intent -, sources none) |
| MOCK-ONLY | Non-scheme message “hello” gets no scheme answer | No sources returned. Expected intent smalltalk; got (none). USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “Hi! What would you like to know about a government scheme?” (notFound false, intent -, sources none) |
| MOCK-ONLY | Non-scheme message “thank you” gets no scheme answer | No sources returned. Expected intent smalltalk; got (none). USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “Sorry, I could not find this in the official scheme documents I have, so I will not guess. Please confirm at your nearest CSC or gram panchayat office.” (notFound true, intent -, sources none) |
| MOCK-ONLY | Non-scheme message “kaun ho tum” gets no scheme answer | No sources returned. Expected intent smalltalk; got (none). USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “Maaf kijiye, yeh jaankari mere paas maujood adhikarik yojana dastavezon mein nahi mili, isliye main andaza nahi lagaunga. Kripya najdeeki CSC ya gram panchayat mein poochhein.” (notFound true, intent -, sources none) |
| MOCK-ONLY | Non-scheme message “What is the weather today?” gets no scheme answer | No sources returned. Expected intent out_of_scope; got (none). USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “Sorry, I could not find this in the official scheme documents I have, so I will not guess. Please confirm at your nearest CSC or gram panchayat office.” (notFound true, intent -, sources none) |
| MOCK-ONLY | Non-scheme message “Who won the cricket match?” gets no scheme answer | No sources returned. Expected intent out_of_scope; got (none). USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “Sorry, I could not find this in the official scheme documents I have, so I will not guess. Please confirm at your nearest CSC or gram panchayat office.” (notFound true, intent -, sources none) |
| MOCK-ONLY | Non-scheme message “How do I cook rice?” gets no scheme answer | No sources returned. Expected intent out_of_scope; got (none). USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “Sorry, I could not find this in the official scheme documents I have, so I will not guess. Please confirm at your nearest CSC or gram panchayat office.” (notFound true, intent -, sources none) |
| MOCK-ONLY | Non-scheme message “How do I reach the railway station?” gets no scheme answer | No sources returned. Expected intent out_of_scope; got (none). USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “Sorry, I could not find this in the official scheme documents I have, so I will not guess. Please confirm at your nearest CSC or gram panchayat office.” (notFound true, intent -, sources none) |
| MOCK-ONLY | Non-scheme message “What is the capital of France?” gets no scheme answer | No sources returned. Expected intent out_of_scope; got (none). USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “Sorry, I could not find this in the official scheme documents I have, so I will not guess. Please confirm at your nearest CSC or gram panchayat office.” (notFound true, intent -, sources none) |
| MOCK-ONLY | “ki keh raho he” as the first message of a session | Did not return a scheme answer. Observed mode: mock. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “Maaf kijiye, yeh jaankari mere paas maujood adhikarik yojana dastavezon mein nahi mili, isliye main andaza nahi lagaunga. Kripya najdeeki CSC ya gram panchayat mein poochhein.” (notFound true, intent -, sources none) |
| MOCK-ONLY | “ki keh raho he” after a PM-KISAN answer | Problems: no Devanagari text; Roman-script words: Maaf kijiye yeh jaankari mere paas maujood adhikarik. Intent (none). USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | first: answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan)<br>then: answer: “Maaf kijiye, yeh jaankari mere paas maujood adhikarik yojana dastavezon mein nahi mili, isliye main andaza nahi lagaunga. Kripya najdeeki CSC ya gram panchayat mein poochhein.” (notFound true, intent -, sources none) |
| MOCK-ONLY | “samajh nahi aaya” as the first message of a session | Did not return a scheme answer. Observed mode: mock. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “Maaf kijiye, yeh jaankari mere paas maujood adhikarik yojana dastavezon mein nahi mili, isliye main andaza nahi lagaunga. Kripya najdeeki CSC ya gram panchayat mein poochhein.” (notFound true, intent -, sources none) |
| MOCK-ONLY | “samajh nahi aaya” after a PM-KISAN answer | Problems: no Devanagari text; Roman-script words: Maaf kijiye yeh jaankari mere paas maujood adhikarik. Intent (none). USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | first: answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan)<br>then: answer: “Maaf kijiye, yeh jaankari mere paas maujood adhikarik yojana dastavezon mein nahi mili, isliye main andaza nahi lagaunga. Kripya najdeeki CSC ya gram panchayat mein poochhein.” (notFound true, intent -, sources none) |

### E. Dialect text — MOCK-ONLY

| Status | Check | Result | Evidence |
|---|---|---|---|
| MOCK-ONLY | Marwari (मारवाड़ी) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | Dhundhari/Jaipuri (ढूंढाड़ी/जयपुरी) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | Shekhawati (शेखावाटी) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | Bagri (बागड़ी) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | Mewari (मेवाड़ी) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | Mewati (मेवाती) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | Harauti (हाड़ौती) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | Malvi (मालवी) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | Wagdi (वागड़ी) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | Braj (ब्रज) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | Haryanvi (हरियाणवी) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | Bhojpuri (भोजपुरी) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | Awadhi (अवधी) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |
| MOCK-ONLY | Bundeli (बुंदेली) with dialectHint | Dialect instruction reached a generation prompt: no. Rendered: standard (render_off). Problems: facts not in the cited passages: numbers 2000; rupees ₹2000; urls pmkisan.gov.in. USE_MOCKS covers chat, rag: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | answer: “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में सीधे बैंक खाते में आते हैं। ज़मीन के रिकॉर्ड में आपका नाम होना चाहिए और आधार से …” (notFound false, intent -, sources pm-kisan\|pm-kisan\|pm-kisan) |

### F. Speech in (POST /api/voice/query) — MOCK-ONLY

| Status | Check | Result | Evidence |
|---|---|---|---|
| MOCK-ONLY | hi: 1.5 s of silence sent to the mock voice endpoint | The mock returned a canned transcript for silence, so every spoken question gets a canned scheme answer regardless of what was said. USE_MOCKS covers voice: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | transcript “पीएम किसान योजना में साल में कितना पैसा मिलता है?”, language hi, dialect marwari; answer “पीएम-किसान योजना में पात्र किसान परिवारों को हर साल ₹6,000 मिलते हैं, जो ₹2,000 की तीन किस्तों में …” |
| MOCK-ONLY | mr: 1.5 s of silence sent to the mock voice endpoint | The mock returned a canned transcript for silence, so every spoken question gets a canned scheme answer regardless of what was said. USE_MOCKS covers voice: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | transcript “आयुष्मान कार्डवर किती रुपयांपर्यंत मोफत उपचार मिळतात?”, language mr, dialect null; answer “आयुष्मान भारत पीएम-जय अंतर्गत प्रत्येक कुटुंबाला दरवर्षी ₹5 लाखांपर्यंत मोफत उपचार सरकारी आणि सूचीब…” |
| MOCK-ONLY | ta: 1.5 s of silence sent to the mock voice endpoint | The mock returned a canned transcript for silence, so every spoken question gets a canned scheme answer regardless of what was said. USE_MOCKS covers voice: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | transcript “பிஎம் கிசான் திட்டத்தில் ஆண்டுக்கு எவ்வளவு பணம் கிடைக்கும்?”, language ta, dialect null; answer “பிஎம்-கிசான் திட்டத்தில் தகுதியுள்ள விவசாயக் குடும்பங்களுக்கு ஆண்டுக்கு ₹6,000 கிடைக்கும். இது ₹2,0…” |
| MOCK-ONLY | en: 1.5 s of silence sent to the mock voice endpoint | The mock returned a canned transcript for silence, so every spoken question gets a canned scheme answer regardless of what was said. USE_MOCKS covers voice: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | transcript “How much free hospital treatment does the Ayushman card cover?”, language en, dialect marwari; answer “Ayushman Bharat PM-JAY gives free hospital treatment of up to ₹5 lakh per family per year at govern…” |

### G. Speech out (POST /api/tts) — MOCK-ONLY

| Status | Check | Result | Evidence |
|---|---|---|---|
| MOCK-ONLY | hi: speech for a fixed sentence | audioUrl null (browser voice expected). USE_MOCKS covers tts: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | HTTP 200 |
| MOCK-ONLY | mr: speech for a fixed sentence | audioUrl null (browser voice expected). USE_MOCKS covers tts: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | HTTP 200 |
| MOCK-ONLY | ta: speech for a fixed sentence | audioUrl null (browser voice expected). USE_MOCKS covers tts: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | HTTP 200 |
| MOCK-ONLY | en: speech for a fixed sentence | audioUrl null (browser voice expected). USE_MOCKS covers tts: these results come from fixtures, not from Gemini, and prove nothing about the real pipeline. | HTTP 200 |

### H. Browser end-to-end mic test (optional) — NOT-TESTED

_AUDIT_CLIENT_URL is not set (the running client, e.g. http://localhost:5173, served against a real-mode API)._

_No checks ran._

### I. Robustness and error codes — PARTIAL

| Status | Check | Result | Evidence |
|---|---|---|---|
| PASS | Voice request without audio | Expected 400 AUDIO_REQUIRED; got 400 AUDIO_REQUIRED (controllers called directly, fake Gemini backend). | scripts/audit/fakeWorker.ts |
| PASS | Silent audio (STT returns no speech) | Expected 422 NO_SPEECH_DETECTED; got 422 NO_SPEECH_DETECTED (controllers called directly, fake Gemini backend). | scripts/audit/fakeWorker.ts |
| NOT-TESTED | Audio over the 10 MB limit | Enforced by multer inside the Express app, which could not be started here (Express app could not be started (express is not installed in the agent sandbox (npm registry blocked)); controllers and the error handler are called directly, without Express routing, multer or the per-IP rate limiter.). | server/src/middleware/upload.ts |
| NOT-TESTED | Non-audio upload | Enforced by multer inside the Express app, which could not be started here (Express app could not be started (express is not installed in the agent sandbox (npm registry blocked)); controllers and the error handler are called directly, without Express routing, multer or the per-IP rate limiter.). | server/src/middleware/upload.ts |
| PASS | Per-IP rate limit reached | Third request in the window got 429 RATE_LIMITED with Retry-After 60 s. | server/src/middleware/rateLimit.ts |
| PASS | Gemini timeout on a text question | Expected 504 AI_TIMEOUT; got 504 AI_TIMEOUT (controllers called directly, fake Gemini backend). | scripts/audit/fakeWorker.ts |
| PASS | Gemini 429 on a text question | Expected 429 AI_RATE_LIMITED; got 429 AI_RATE_LIMITED (controllers called directly, fake Gemini backend). | scripts/audit/fakeWorker.ts |
| PASS | Real mode without GEMINI_API_KEY | Expected 503 AI_NOT_CONFIGURED; got 503 AI_NOT_CONFIGURED (controllers called directly, fake Gemini backend). | scripts/audit/fakeWorker.ts |
| PASS | Server speech returns a WAV data URL (fake provider) | audioUrl data URL of 426750 chars, basis language. Proves the plumbing only: the provider is fake, so nothing here says the voice is right. | server/src/modules/tts/service.ts<br>scripts/audit/fakeWorker.ts |
| PASS | Speech basis is reported honestly for named and unnamed dialects | bhojpuri: named-dialect (expected named-dialect); braj: base-language-approximation (expected base-language-approximation) | server/src/modules/tts/service.ts<br>server/src/config/dialect-render.json |
| PASS | TTS provider error falls back to browser speech | synthesizeSpeech with a provider answering 503 returned audioUrl null (client uses browser speech), basis none. | server/src/modules/tts/service.ts |
| PASS | POST /api/tts with an unknown dialectId | Expected 400 VALIDATION_ERROR; got 400 VALIDATION_ERROR (controllers called directly, fake Gemini backend). | scripts/audit/fakeWorker.ts |
| PASS | A clarification cannot introduce facts the user was not told (fake model) | Fake router answers “ki keh raho he” with a ₹6,000 sentence. Fresh session (nothing said yet): replaced by the fixed “please ask again” text. After a scheme answer that said ₹6,000: allowed (repeats an earlier fact). Whether the real model classifies the message as a clarification is NOT-TESTED here. | server/src/modules/chat/service.ts (introducesNewFacts)<br>scripts/audit/fakeWorker.ts |
| NOT-TESTED | Friendly, localized error message in the client | The client (ChatProvider errorText) is not exercised by this server-side audit, and no client test runner exists for it. | client/src/features/chat/ChatProvider.tsx |

### J. Latency and cost shape — FAIL

| Status | Check | Result | Evidence |
|---|---|---|---|
| NOT-TESTED | text request latency (p50 / p95) | Latency is only meaningful against real Gemini calls; this run made none on this path. |  |
| NOT-TESTED | voice request latency (p50 / p95) | Latency is only meaningful against real Gemini calls; this run made none on this path. |  |
| NOT-TESTED | tts request latency (p50 / p95) | Latency is only meaningful against real Gemini calls; this run made none on this path. |  |
| PASS | Typed scheme question | 4 Gemini call(s) (understand×1, embed×1, answer×1, sms×1), 4 sequential. Within the 4-sequential-call budget. HTTP 200. Shape measured with a fake backend; real latency is in the live part of Stage J. | scripts/audit/fakeWorker.ts |
| PASS | Typed scheme question with dialectHint (bhojpuri) | 5 Gemini call(s) (understand×1, embed×1, answer×1, sms×1, reply-dialect×1), 4 sequential. Within the 4-sequential-call budget. HTTP 200. Shape measured with a fake backend; real latency is in the live part of Stage J. | scripts/audit/fakeWorker.ts |
| PASS | Typed clarification (“ki keh raho he”) | 1 Gemini call(s) (understand×1), 1 sequential. Within the 4-sequential-call budget. HTTP 200. Shape measured with a fake backend; real latency is in the live part of Stage J. | scripts/audit/fakeWorker.ts |
| FAIL | Spoken scheme question (dialect identification on) | 8 Gemini call(s) (transcribe×1, dialect-audio-only×1, dialect-transcript-only×1, dialect-audio-transcript×1, understand×1, embed×1, answer×1, sms×1), 6 sequential. FLAGGED: more than 4 sequential calls, so real latency adds up across them. HTTP 200. Shape measured with a fake backend; real latency is in the live part of Stage J. | scripts/audit/fakeWorker.ts |
| PASS | Listen (server speech, one piece) | 1 Gemini call(s) (tts×1), 1 sequential. Within the 4-sequential-call budget. HTTP 200. Shape measured with a fake backend; real latency is in the live part of Stage J. | scripts/audit/fakeWorker.ts |
| PASS | Listen on a long answer (split into pieces) | 3 Gemini call(s) (tts×3), 1 sequential. Within the 4-sequential-call budget. HTTP 200. Shape measured with a fake backend; real latency is in the live part of Stage J. | scripts/audit/fakeWorker.ts |

## NOT-TESTED

- A · Static checks (whole stage): Dependencies are not installed (node_modules/.bin lacks tsc, vitest, eslint, vite, tsx). Run `npm install` first; no static result can be claimed without the repo's own toolchain.
- H · Browser end-to-end mic test (optional) (whole stage): AUDIT_CLIENT_URL is not set (the running client, e.g. http://localhost:5173, served against a real-mode API).
- B · Chat model id resolves: Real mode needs GEMINI_API_KEY; it is not set in this environment (no real model call was made). Model id "gemini-3.8-flash" was not resolved.
- B · Fallback model id resolves: Real mode needs GEMINI_API_KEY; it is not set in this environment (no real model call was made). Model id "gemini-3.6-flash" was not resolved.
- B · Speech-to-text model id resolves (text-only ping): Real mode needs GEMINI_API_KEY; it is not set in this environment (no real model call was made). Model id "gemini-3.8-flash" was not resolved.
- B · Embedding model id resolves: Real mode needs GEMINI_API_KEY; it is not set in this environment (no real model call was made). Model id "gemini-embedding-2" was not resolved.
- B · Text-to-speech model id resolves: tts is mocked (USE_MOCKS), so no TTS call was made.
- I · Audio over the 10 MB limit: Enforced by multer inside the Express app, which could not be started here (Express app could not be started (express is not installed in the agent sandbox (npm registry blocked)); controllers and the error handler are called directly, without Express routing, multer or the per-IP rate limiter.).
- I · Non-audio upload: Enforced by multer inside the Express app, which could not be started here (Express app could not be started (express is not installed in the agent sandbox (npm registry blocked)); controllers and the error handler are called directly, without Express routing, multer or the per-IP rate limiter.).
- I · Friendly, localized error message in the client: The client (ChatProvider errorText) is not exercised by this server-side audit, and no client test runner exists for it.
- J · text request latency (p50 / p95): Latency is only meaningful against real Gemini calls; this run made none on this path.
- J · voice request latency (p50 / p95): Latency is only meaningful against real Gemini calls; this run made none on this path.
- J · tts request latency (p50 / p95): Latency is only meaningful against real Gemini calls; this run made none on this path.

## NEEDS-HUMAN

- none

Full machine-readable results: `audit/results.json`.
