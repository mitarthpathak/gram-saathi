# Gemini Live voice sessions

`POST /api/live/token` mints a single-use Gemini Live ephemeral token. `GEMINI_API_KEY` remains
server-only. `USE_MOCKS=true` (or `USE_MOCKS=live`) returns a local mock token without contacting
Google.

## Configuration

| Variable                        | Default           | Purpose                                                       |
| ------------------------------- | ----------------- | ------------------------------------------------------------- |
| `GEMINI_API_KEY`                | unset             | Server-side key used to mint ephemeral tokens.                |
| `GEMINI_LIVE_MODEL`             | `gemini-3.8-live` | Live audio model, following Google's current model guide.     |
| `GEMINI_LIVE_VOICE`             | `Kore`            | Gemini prebuilt voice name.                                   |
| `GEMINI_LIVE_TOKEN_TTL_SECONDS` | `600`             | Token lifetime; allowed values are 60 through 71,999 seconds. |

Tokens can start one session (`uses: 1`). A newly issued token must start its session within 60
seconds (`newSessionExpireTime`); the connected session token expires after the configured TTL.
Gemini may close a session before that token expiry. Token issuance uses the shared
`GEMINI_TIMEOUT_MS` timeout (30 seconds by default) and does not retry, to avoid issuing extra
unused tokens.

## Locked session setup

The ephemeral token constrains model, audio response modality, prebuilt voice, input/output audio
transcription, the `ask_gram_saathi({ question })` function declaration, and the system instruction.
Because these settings are locked, the endpoint does not return `setup`. The key is never included
in the response. With a dialect hint, the server may add up to 300 token-units of consented examples
from the existing dialect exemplar store; it never creates example text.

For every scheme question, the model is instructed to call `ask_gram_saathi`. The client executes
that function by calling the existing `POST /api/chat/query`, then sends the function response back
to Gemini as `{ answer, fraudWarning? }`. The model must speak only facts from `answer` and relay the
warning. Non-scheme conversation does not require the tool.

## Client flow

1. The client posts `{ sessionId, language?, dialectHint? }` to `/api/live/token`.
2. The client connects directly to Gemini Live with the returned token as its API key, the returned
   model, and the matching locked config, using the Live API's `v1beta` connection.
3. The client streams audio and receives generated audio plus input/output transcriptions.
4. When Gemini requests `ask_gram_saathi`, the client sends the question to `/api/chat/query` and
   returns its answer and optional fraud warning through the Live tool response.

`sessionId` is required for the endpoint contract but is not sent to Gemini or stored by this
module. The endpoint currently has the shared per-IP AI rate limit; deployments should also protect
token issuance with their application authentication/session controls.

## API version and preview status

Implementation follows Google's current [ephemeral token guide](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens),
last updated 2026-09-15: it creates tokens with `authTokens.create` using API version `v1beta` and
connects using `v1beta`. The installed SDK's generated declaration still contains older wording
that says token support is `v1alpha` only; the current web guide's v1beta REST examples are used
here. Verify this if Google changes the API before enabling real traffic.

The `Kore` voice default and Live config fields follow Google's current
[Live API capabilities guide](https://ai.google.dev/gemini-api/docs/live-api/capabilities), which
shows `responseModalities: [Modality.AUDIO]`, audio transcription config, and the `speechConfig`
voice structure.

Google labels ephemeral tokens **Preview**. Their API behavior and availability can change. No
real Gemini token request is made by automated tests; test with a server key before enabling
`USE_MOCKS=false` in a deployment.
