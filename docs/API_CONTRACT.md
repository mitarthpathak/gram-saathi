# API contract

The single source of truth for how the client and the server talk. The TypeScript types live in
[`shared/src/types.ts`](../shared/src/types.ts); this page explains them with examples.

> **Changing the contract:** only in a dedicated PR that updates **both** this file and
> `shared/src/types.ts`, plus the server stub, the mocks (`server/src/mocks`, `client/src/mocks`)
> and `client/src/lib/api.ts`. Get a review from every workstream that uses the endpoint. See
> [CONTRIBUTING.md](../CONTRIBUTING.md#the-api-contract-rule).

## Conventions

- **Base URL:** `/api` on the server (default `http://localhost:4000`). In dev the client calls
  `/api` on the Vite server, which proxies to Express.
- **Format:** JSON request and response bodies (`Content-Type: application/json`), except
  `POST /api/voice/query` and `POST /api/dialect/transcribe`, which use `multipart/form-data`.
- **Languages:** `LanguageCode` = `"hi" | "mr" | "ta" | "en"`. Requests accept only these codes.
  `detectedLanguage` in responses is always one of these answer languages. Regional varieties are
  reported separately in the optional dialect fields.
- **Sessions:** `sessionId` is an anonymous id (1–100 characters) that the client creates once and
  stores in localStorage. There are no accounts and no auth.
- **Mock mode:** with `USE_MOCKS=true` (the default) every endpoint returns realistic Hindi,
  Marathi, Tamil or English mock data and makes no AI calls. `GET /api/health` reports it. Modules
  without mocks that are not implemented yet answer `501 NOT_IMPLEMENTED`.

### Errors

Every non-2xx response has the same body (`ApiErrorBody`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "path": "text", "message": "Too small: expected string to have >=1 characters" }]
  }
}
```

| Status | `code`                                  | When                                                                      |
| ------ | --------------------------------------- | ------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`                      | Body or query does not match the schema (`details`)                       |
| 400    | `INVALID_JSON`                          | Malformed JSON body                                                       |
| 400    | `AUDIO_REQUIRED`                        | Voice query or contributor transcription without a non-empty `audio` file |
| 400    | `INVALID_ANSWER`                        | Eligibility answer of the wrong type, out of range or an unknown option   |
| 404    | `NOT_FOUND`                             | Unknown `/api` route                                                      |
| 404    | `SESSION_NOT_FOUND`                     | Eligibility answer without an active wizard session                       |
| 409    | `QUESTION_MISMATCH`                     | Answer to a question other than the current one                           |
| 413    | `LIMIT_FILE_SIZE` / `PAYLOAD_TOO_LARGE` | Audio over 10 MB / JSON body over 100 kB                                  |
| 415    | `UNSUPPORTED_MEDIA_TYPE`                | Uploaded file is not `audio/*`                                            |
| 422    | `NO_SPEECH_DETECTED`                    | Voice query or contributor transcription: no speech recognised            |
| 422    | `UNCLEAR_ANSWER`                        | Eligibility: a free-form answer could not be understood                   |
| 429    | `RATE_LIMITED`                          | Too many requests from this IP (`Retry-After` header)                     |
| 429    | `AI_RATE_LIMITED`                       | Gemini quota or rate limit, still hit after retries                       |
| 500    | `INTERNAL_ERROR`                        | Bug on the server                                                         |
| 501    | `NOT_IMPLEMENTED`                       | Reserved for features not built yet (none since v2)                       |
| 502    | `AI_ERROR`                              | Gemini rejected the request or returned unusable output                   |
| 503    | `AI_NOT_CONFIGURED`                     | `GEMINI_API_KEY` missing or rejected                                      |
| 503    | `AI_UNAVAILABLE`                        | Gemini unreachable or overloaded, after retries                           |
| 503    | `KNOWLEDGE_BASE_MISSING`                | No knowledge base: run `npm run ingest -w server`                         |
| 503    | `FAQ_NOT_READY`                         | No pre-generated FAQ: run `npm run prewarm -w server`                     |
| 504    | `AI_TIMEOUT`                            | Gemini did not answer in time                                             |

The `message` is for developers (English). The UI shows its own translated text. Suggested
handling: `NO_SPEECH_DETECTED` and `UNCLEAR_ANSWER` → ask the user to say it again; `AI_*` → "please
try again" (also `RATE_LIMITED`); `KNOWLEDGE_BASE_MISSING`, `FAQ_NOT_READY` and `AI_NOT_CONFIGURED` are setup problems
(the message names the fix).

## Endpoints

| Method | Path                      | Purpose                                        | Type names                                               |
| ------ | ------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| GET    | `/api/health`             | Liveness and mock flag                         | `HealthResponse`                                         |
| GET    | `/api/dialects`           | Regional varieties available for confirmation  | `DialectsResponse`                                       |
| POST   | `/api/dialect/transcribe` | Contributor recording → verbatim transcript    | multipart → `DialectTranscribeResponse`                  |
| POST   | `/api/voice/query`        | Spoken question → answer                       | `VoiceQueryFields` → `QueryResponse`                     |
| POST   | `/api/chat/query`         | Typed question → answer                        | `ChatQueryRequest` → `QueryResponse`                     |
| POST   | `/api/eligibility/start`  | Start the eligibility wizard                   | `EligibilityStartRequest` → `EligibilityStartResponse`   |
| POST   | `/api/eligibility/answer` | Answer one question → next question or results | `EligibilityAnswerRequest` → `EligibilityAnswerResponse` |
| POST   | `/api/sms/compress`       | Shorten text to SMS length                     | `SmsCompressRequest` → `SmsCompressResponse`             |
| GET    | `/api/faq/top?lang=hi`    | Top questions for offline / low-bandwidth mode | `FaqTopQuery` → `FaqTopResponse`                         |
| POST   | `/api/tts`                | Optional server text-to-speech                 | `TtsRequest` → `TtsResponse`                             |
| POST   | `/api/rag/search`         | Internal: debug retrieval (not used by the UI) | `RagSearchRequest` → `RagSearchResponse`                 |

---

### `GET /api/health`

```json
{ "status": "ok", "mocks": true }
```

`mocks` is `true` when any module serves mock data. The UI shows a "demo data" badge.

---

### `POST /api/chat/query` and `POST /api/voice/query` → `QueryResponse`

**Chat request** (JSON):

```json
{ "text": "How much money does PM-KISAN give?", "language": "en", "sessionId": "demo-123" }
```

| Field         | Type           | Notes                                                         |
| ------------- | -------------- | ------------------------------------------------------------- |
| `text`        | string         | 1–1000 characters                                             |
| `language`    | `LanguageCode` | Optional hint from the language selector; omit to auto-detect |
| `dialectHint` | string         | Optional confirmed registry id; skips dialect detection       |
| `sessionId`   | string         |                                                               |

**Voice request** (`multipart/form-data`):

| Part          | Type           | Notes                                                            |
| ------------- | -------------- | ---------------------------------------------------------------- |
| `audio`       | file           | Required, `audio/*` (webm/opus, wav, mp4, ogg, mp3), ≤ 10 MB     |
| `language`    | `LanguageCode` | Optional hint; an empty value counts as missing                  |
| `dialectHint` | string         | Optional confirmed registry id; an empty value counts as missing |
| `sessionId`   | string         | Required                                                         |

```bash
curl -F "audio=@question.webm;type=audio/webm" -F language=ta -F sessionId=demo-123 \
  http://localhost:4000/api/voice/query
```

**Response** (both endpoints):

```json
{
  "sessionId": "demo-123",
  "transcript": "பிஎம் கிசான் திட்டத்தில் ஆண்டுக்கு எவ்வளவு பணம் கிடைக்கும்?",
  "detectedLanguage": "ta",
  "dialect": null,
  "dialectCandidates": [],
  "answer": "பிஎம்-கிசான் திட்டத்தில் தகுதியுள்ள விவசாயக் குடும்பங்களுக்கு ஆண்டுக்கு ₹6,000 கிடைக்கும். …",
  "sources": [
    {
      "schemeId": "pm-kisan",
      "schemeName": "PM-KISAN Samman Nidhi",
      "section": "Benefits",
      "snippet": "Eligible landholding farmer families get ₹6,000 per year, paid in three equal instalments of ₹2,000 directly into their Aadhaar-seeded bank account (DBT)."
    }
  ],
  "fraudWarning": "மோசடி எச்சரிக்கை: அரசு திட்டங்களுக்கு விண்ணப்பிக்க கட்டணம் இல்லை. …",
  "smsText": "பிஎம்-கிசான்: ஆண்டுக்கு ₹6000, 3 தவணையாக வங்கியில். நில ஆவணம், ஆதார் eKYC அவசியம். இலவசப் பதிவு: pmkisan.gov.in / CSC",
  "smsSegments": 2,
  "audioUrl": null,
  "usedCache": false,
  "notFound": false
}
```

| Field               | Type                     | Notes                                                                                                                    |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `sessionId`         | string                   | Echo of the request                                                                                                      |
| `transcript`        | string?                  | Voice only: verbatim words and spellings the user said                                                                   |
| `detectedLanguage`  | `LanguageCode`           | Language of the question; the answer, fraud warning and SMS are in this language. A dialect maps to its parent language. |
| `dialect`           | `DialectResult \| null`? | Confident dialect identification; `null` means abstained or not applicable. Optional for compatibility.                  |
| `dialectCandidates` | `DialectOption[]`?       | Up to three suggestions, best first; sent when `dialect` is null or medium confidence.                                   |
| `answer`            | string                   | Grounded only in `sources`                                                                                               |
| `sources`           | `Source[]`               | The passages the answer actually uses (`snippet` ≤ ~300 chars); empty when `notFound`                                    |
| `fraudWarning`      | string                   | Always present. Static text, never generated by the model                                                                |
| `smsText`           | string                   | SMS-length version of the answer                                                                                         |
| `smsSegments`       | number                   | Segments needed: GSM-7 160 chars (153 per part); Unicode 70 (67 per part). Indic = Unicode                               |
| `audioUrl`          | string \| null           | Server-generated speech; `null` = use the browser's speech synthesis                                                     |
| `usedCache`         | boolean                  | Served from the answer cache (same question in the same language)                                                        |
| `notFound`          | boolean                  | The documents don't answer it; `answer` says where to ask instead (never a guess)                                        |

How the server decides: the question's language comes from speech recognition (voice) or from
its script and wording (text). The best passages of the scheme documents are retrieved; if none
is similar enough (`RAG_MIN_SCORE`), or Gemini reports that the passages do not answer the
question, the response is `notFound: true` with a fixed answer telling the user to confirm at
the nearest CSC or gram panchayat office. Otherwise Gemini answers only from the passages and
reports which ones it used. A voice recording without speech gets `422 NO_SPEECH_DETECTED`.

### v3 Dialects

All v3 additions are optional so older clients remain compatible. `DialectOption` is
`{ "id": string, "name": string, "nativeName": string }`. A `DialectResult` adds
`confidence: "medium" | "high"`. `DialectInfo` adds `parentLanguage: LanguageCode`, `states`, and
`testStatus: "experimental" | "tested"`.

`GET /api/dialects` returns registry entries:

```json
{
  "items": [
    {
      "id": "braj",
      "name": "Braj",
      "nativeName": "ब्रज",
      "parentLanguage": "hi",
      "states": ["Uttar Pradesh", "Rajasthan", "Madhya Pradesh"],
      "testStatus": "experimental"
    }
  ]
}
```

The query response can include a confident result, a medium-confidence result with alternatives,
or an abstention with suggestions:

```json
{ "dialect": { "id": "braj", "name": "Braj", "nativeName": "ब्रज", "confidence": "high" } }
```

```json
{
  "dialect": { "id": "braj", "name": "Braj", "nativeName": "ब्रज", "confidence": "medium" },
  "dialectCandidates": [
    { "id": "braj", "name": "Braj", "nativeName": "ब्रज" },
    { "id": "mewati", "name": "Mewati", "nativeName": "मेवाती" }
  ]
}
```

```json
{
  "dialect": null,
  "dialectCandidates": [{ "id": "wagdi", "name": "Wagdi", "nativeName": "वागड़ी" }]
}
```

Candidates contain at most three entries, ordered best first. A confirmed or user-selected
`dialectHint` is a registry id and tells the server to skip detection; a hint returns that dialect
with `high` confidence and `dialectCandidates: []`. `detectedLanguage` stays a
`LanguageCode`; a dialect maps to its `parentLanguage`. Unsupported languages such as Gujarati and
Punjabi have no dialect result unless a user-confirmed dialect hint applies. Their answer language
falls back to that hint's parent, then the selected language hint, then Hindi (`hi`). Voice
transcripts preserve the speaker's dialect words and spellings; they are not translated or
normalised to standard Hindi. Mock dialect values are rotating wire examples, not measured
classifications. Confidence reflects agreement across the configured classifier views; it is not a
calibrated probability or measured real-audio accuracy.

### `POST /api/dialect/transcribe` (contributor recording)

This additive endpoint uses the same 10 MB `audio/*` multipart upload limits, media-type checks,
verbatim transcription prompt, mock support, and audio error codes as `POST /api/voice/query`. It
does not require a session or create an answer. `language` may be supplied as an optional answer
language hint; it never changes the speaker's words. Empty audio returns `400 AUDIO_REQUIRED`,
unsupported media returns `415 UNSUPPORTED_MEDIA_TYPE`, oversized audio returns `413 LIMIT_FILE_SIZE`,
and no recognized speech returns `422 NO_SPEECH_DETECTED`.

```bash
curl -F "audio=@sample.webm;type=audio/webm" http://localhost:4000/api/dialect/transcribe
```

```json
{ "transcript": "<verbatim transcript in the speaker's script>", "script": "devanagari" }
```

`script` is one of `devanagari`, `roman`, `mixed`, or `other`. The transcript retains the words,
spellings, and script the speaker used; the endpoint does not translate or normalize it. Mock mode
returns a representative transcript without calling Gemini.

---

### `POST /api/eligibility/start`

```json
{ "sessionId": "demo-123", "language": "en" }
```

```json
{
  "question": { "id": "age", "type": "number", "text": "How old are you? (in years)" },
  "progress": { "current": 1, "total": 6 }
}
```

Starting again with the same `sessionId` resets the wizard. Questions come back in `language`.
Questions and rules come from `data/eligibility/` (mock mode: 4 fixed questions), so clients
must not hard-code question ids or their order.

### `POST /api/eligibility/answer`

```json
{ "sessionId": "demo-123", "questionId": "age", "answer": 35 }
```

Next question:

```json
{
  "done": false,
  "question": {
    "id": "occupation",
    "type": "choice",
    "text": "What work do you mainly do?",
    "options": ["Farmer", "Daily-wage labourer", "ASHA / Anganwadi worker", "Other"]
  },
  "progress": { "current": 2, "total": 6 }
}
```

After the last question:

```json
{
  "done": true,
  "results": [
    {
      "schemeId": "pm-kisan",
      "schemeName": "PM-KISAN Samman Nidhi",
      "eligible": true,
      "reason": "Your family owns farmland and no one pays income tax: you can get ₹6,000 a year."
    },
    {
      "schemeId": "ayushman-bharat-pmjay",
      "schemeName": "Ayushman Bharat PM-JAY",
      "eligible": false,
      "reason": "Depends on the SECC 2011 list: check your name at beneficiary.nha.gov.in or call 14555."
    }
  ]
}
```

| Question `type` | `answer` must be                                        | UI control            |
| --------------- | ------------------------------------------------------- | --------------------- |
| `number`        | a number (e.g. `35`)                                    | numeric input         |
| `boolean`       | `true` / `false`                                        | big Yes / No buttons  |
| `choice`        | one of `options`, verbatim (the label in that language) | one button per option |

**Free-form answers (v2).** For any question type `answer` may instead be what the user said, as
text (1–300 characters, e.g. a voice transcript): `"35 saal"`, `"do bigha zameen"`, `"हाँ"`,
`"main kisaan hu"`. Plain numbers, yes / no words and option labels in any of the four languages
are read without AI; anything else is read by Gemini. The eligibility decision itself never uses
AI. An answer that cannot be understood gets `422 UNCLEAR_ANSWER` and the wizard stays on the
same question.

- Answer only the current question (`409 QUESTION_MISMATCH` otherwise). Results list eligible
  schemes first. The session ends after the results (`404 SESSION_NOT_FOUND` if answered again).
- Questions that can no longer change any result are skipped, so `progress.total` may go down
  between steps (it is an upper bound).
- `progress` is **optional**: clients must work without it (show "Question N" without a total).
- Wizard state is kept in server memory: after a restart the client gets `SESSION_NOT_FOUND`
  and simply starts again.

---

### `POST /api/sms/compress`

```json
{ "text": "Under PM-KISAN, eligible farmer families get Rs 6,000 a year …", "language": "en" }
```

```json
{ "sms": "Under PM-KISAN, eligible farmer families get Rs 6,000 a year, …", "segments": 2 }
```

`text` is 1–5000 characters. The result fits in `SMS_MAX_SEGMENTS` segments (default 2). Text that
already fits is returned as it is; longer text is rewritten by Gemini under a character budget,
and if that fails or is still too long the server keeps the whole sentences that fit (mock mode
always does the sentence cut). English SMS use "Rs" instead of "₹" and plain punctuation: ₹ is
not in GSM-7 and turns the whole SMS into Unicode (70 instead of 160 characters).

---

### `GET /api/faq/top?lang=hi`

`lang` is an optional `LanguageCode` (default `hi`).

```json
{
  "items": [
    {
      "id": "faq-1",
      "question": "How much money does PM-KISAN give?",
      "answer": "₹6,000 a year, in three instalments of ₹2,000, sent directly to the farmer’s bank account.",
      "sources": [
        {
          "schemeId": "pm-kisan",
          "schemeName": "PM-KISAN Samman Nidhi",
          "section": "Benefits",
          "snippet": "Eligible landholding farmer families get ₹6,000 per year, …"
        }
      ]
    }
  ]
}
```

Small on purpose: low-bandwidth clients download the whole list and keep it for offline use.
The answers are generated ahead of time from `data/faq/questions.json` by
`npm run prewarm -w server` (`503 FAQ_NOT_READY` until then) and also seed the answer cache.

---

### `POST /api/tts`

```json
{ "text": "नमस्ते", "language": "hi" }
```

```json
{ "audioUrl": null }
```

Optional. `null` tells the client to use the browser's speech synthesis, which is the default.
A future implementation returns the URL of a generated audio file. `text` is 1–2000 characters.

---

### `POST /api/rag/search` (internal)

For the RAG workstream to test retrieval with curl. The UI does not call it.

```json
{ "query": "ayushman card", "language": "en", "topK": 1 }
```

```json
{
  "chunks": [
    {
      "schemeId": "ayushman-bharat-pmjay",
      "schemeName": "Ayushman Bharat PM-JAY",
      "section": "Benefits",
      "score": 0.9,
      "text": "PM-JAY gives health cover of up to ₹5 lakh per family per year for secondary and tertiary hospital care. …"
    }
  ]
}
```

`topK` is 1–10 (default `RAG_TOP_K`). `score` is the cosine similarity, best first, before the
`RAG_MIN_SCORE` filter that the answer pipeline applies.

## Changelog

| Version | Change                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Initial contract. Additions to the original brief: optional eligibility `progress`, the standard error body, `/api/rag/search` (internal).                                                                                                                                                                                                                                                  |
| 2       | No type changes. Eligibility answers may be free-form text (`422 UNCLEAR_ANSWER` if unreadable); questions come from data and may be skipped, so `progress.total` can shrink. `detectedLanguage` is always a `LanguageCode`. New error codes: `NO_SPEECH_DETECTED`, `UNCLEAR_ANSWER`, `AI_*`, `KNOWLEDGE_BASE_MISSING`, `FAQ_NOT_READY`, `RATE_LIMITED` (per-IP limit on the AI endpoints). |
| 3       | Add optional dialect results and candidates, dialect hints, and `GET /api/dialects`. Dialect ids map to parent answer languages; voice transcripts remain verbatim.                                                                                                                                                                                                                         |
