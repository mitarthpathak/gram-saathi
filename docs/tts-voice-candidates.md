# TTS voice candidates

**Not generated yet.** This file is written by `npm run tts:voices -w server`, which needs a
`GEMINI_API_KEY`. The agent that built the script had no key, so the Extended Voice Library was
never queried (status: NOT-TESTED against the real API; the script was only exercised against a
fake HTTP server in the sandbox).

When generated, it lists voices from `GET /v1beta/voices` for `language_code` hi-IN, mr-IN, ta-IN,
en-IN and `region_code` IN, with id, display name, language, accent, gender, pitch and
description. They are candidates for a person to audition; see docs/RUNBOOK.md.
