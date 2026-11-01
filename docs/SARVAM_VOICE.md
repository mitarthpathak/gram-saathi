# Sarvam voice providers

Sarvam integration is opt-in. Defaults remain `STT_PROVIDER=gemini` and `TTS_PROVIDER=none`, so
the existing Gemini transcription and browser speech behavior are unchanged. `USE_MOCKS=true`
continues to bypass provider calls.

## Configuration

Set these in the git-ignored repository `.env` file (never commit the API key):

| Variable             | Default     | Purpose                             |
| -------------------- | ----------- | ----------------------------------- |
| `STT_PROVIDER`       | `gemini`    | `gemini` or `sarvam`                |
| `TTS_PROVIDER`       | `none`      | `none` or `sarvam`                  |
| `SARVAM_API_KEY`     | empty       | Server-only Sarvam subscription key |
| `SARVAM_STT_MODEL`   | `saaras:v3` | Saaras model identifier             |
| `SARVAM_TTS_MODEL`   | `bulbul:v3` | Bulbul model identifier             |
| `SARVAM_TTS_SPEAKER` | `shubh`     | Bulbul v3 speaker (lowercase)       |
| `SARVAM_TIMEOUT_MS`  | `30000`     | Per-request timeout                 |

If Sarvam is selected without a key, the server responds with `503 AI_NOT_CONFIGURED`. Saaras
receives the selected language as `hi-IN`, `mr-IN`, `ta-IN`, or `en-IN`; dialect choices use their
registry parent language. Braj and Wagdi are not listed as distinct Saaras languages in Sarvam's
published language list, so this integration handles them as Hindi (`hi-IN`).

## Manual test with a real key

1. Copy `.env.example` to `.env`; set `USE_MOCKS=false`, `STT_PROVIDER=sarvam`,
   `TTS_PROVIDER=sarvam`, and `SARVAM_API_KEY` to a valid server-side key.
2. Install/prepare the normal Gemini knowledge base needed for the downstream voice answer, then
   run `npm run dev`.
3. Send a short browser recording (or a WAV file) to `POST /api/dialect/transcribe` as multipart
   field `audio`, with optional form field `language=hi`, `mr`, `ta`, or `en`. Confirm the returned
   transcript and script.
4. Send text to `POST /api/tts`, for example `{"text":"नमस्ते","language":"hi"}`. A successful
   response has `audioUrl` beginning `data:audio/wav;base64,`; disable Sarvam or make the text longer
   than the limit to confirm the response falls back to `audioUrl: null`.
5. To check speech attached to a full answer, submit a recording to `POST /api/voice/query` with a
   valid `sessionId`; the response includes the same `audioUrl` when synthesis succeeds.

Keep `.env` local. Never put `SARVAM_API_KEY` in a `VITE_*` variable or include it in a bug report.

## Limits and behavior

- Saaras REST accepts recordings up to 30 seconds. Sarvam lists WAV, MP3, AAC, AIFF, OGG, OPUS,
  FLAC, MP4/M4A, AMR, WMA, WebM, and PCM formats. Browser WebM/Opus and MP4/AAC recordings are
  listed as supported; the API recommends 16 kHz audio.
- Bulbul v3 REST accepts at most 2,500 text characters. Longer text and any TTS error return
  `audioUrl: null`, allowing browser speech fallback.
- STT retries 429 and 5xx responses at most twice. TTS responses are cached in memory (up to 100
  language/speaker/text entries) and the cache clears on server restart.
- Voice answers still use the existing answer pipeline. If synthesis fails, the recognized query
  and answer are returned normally.

Official references: [Saaras REST transcribe](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe),
[Bulbul REST convert](https://docs.sarvam.ai/api-reference/text-to-speech/convert), and the
[Saaras language list](https://docs.sarvam.ai/api/getting-started/models/saaras).
