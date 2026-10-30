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
  `POST /api/voice/query`, which is `multipart/form-data`.
- **Languages:** `LanguageCode` = `"hi" | "mr" | "ta" | "en"`. Requests accept only these codes.
  `detectedLanguage` in responses is a plain string, because it may later carry dialect codes
  such as `"bho"`.
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

| Status | `code`                                  | When                                                   |
| ------ | --------------------------------------- | ------------------------------------------------------ |
| 400    | `VALIDATION_ERROR`                      | Body or query does not match the schema (`details`)    |
| 400    | `INVALID_JSON`                          | Malformed JSON body                                    |
| 400    | `AUDIO_REQUIRED`                        | Voice query without a non-empty `audio` file           |
| 400    | `INVALID_ANSWER`                        | Eligibility answer of the wrong type or unknown option |
| 404    | `NOT_FOUND`                             | Unknown `/api` route                                   |
| 404    | `SESSION_NOT_FOUND`                     | Eligibility answer without an active wizard session    |
| 409    | `QUESTION_MISMATCH`                     | Answer to a question other than the current one        |
| 413    | `LIMIT_FILE_SIZE` / `PAYLOAD_TOO_LARGE` | Audio over 10 MB / JSON body over 100 kB               |
| 415    | `UNSUPPORTED_MEDIA_TYPE`                | Uploaded file is not `audio/*`                         |
| 500    | `INTERNAL_ERROR`                        | Bug on the server                                      |
| 501    | `NOT_IMPLEMENTED`                       | Real (non-mock) logic not written yet                  |

The `message` is for developers (English). The UI shows its own translated text.

## Endpoints

| Method | Path                      | Purpose                                        | Type names                                               |
| ------ | ------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| GET    | `/api/health`             | Liveness and mock flag                         | `HealthResponse`                                         |
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

| Field       | Type           | Notes                                                         |
| ----------- | -------------- | ------------------------------------------------------------- |
| `text`      | string         | 1–1000 characters                                             |
| `language`  | `LanguageCode` | Optional hint from the language selector; omit to auto-detect |
| `sessionId` | string         |                                                               |

**Voice request** (`multipart/form-data`):

| Part        | Type           | Notes                                                   |
| ----------- | -------------- | ------------------------------------------------------- |
| `audio`     | file           | Required, `audio/*` (webm/opus, wav, mp4, ogg), ≤ 10 MB |
| `language`  | `LanguageCode` | Optional hint; an empty value counts as missing         |
| `sessionId` | string         | Required                                                |

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

| Field              | Type           | Notes                                                                                      |
| ------------------ | -------------- | ------------------------------------------------------------------------------------------ |
| `sessionId`        | string         | Echo of the request                                                                        |
| `transcript`       | string?        | Voice only: what the user said                                                             |
| `detectedLanguage` | string         | Language of the question; the answer, fraud warning and SMS are in this language           |
| `answer`           | string         | Grounded only in `sources`                                                                 |
| `sources`          | `Source[]`     | Citations; empty when `notFound`                                                           |
| `fraudWarning`     | string         | Always present. Static text, never generated by the model                                  |
| `smsText`          | string         | SMS-length version of the answer                                                           |
| `smsSegments`      | number         | Segments needed: GSM-7 160 chars (153 per part); Unicode 70 (67 per part). Indic = Unicode |
| `audioUrl`         | string \| null | Server-generated speech; `null` = use the browser's speech synthesis                       |
| `usedCache`        | boolean        | Served from the answer cache (same question in the same language)                          |
| `notFound`         | boolean        | The documents don't answer it; `answer` says where to ask instead (never a guess)          |

---

### `POST /api/eligibility/start`

```json
{ "sessionId": "demo-123", "language": "en" }
```

```json
{
  "question": { "id": "age", "type": "number", "text": "How old are you? (in years)" },
  "progress": { "current": 1, "total": 4 }
}
```

Starting again with the same `sessionId` resets the wizard. Questions come back in `language`.

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
  "progress": { "current": 2, "total": 4 }
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

- Answer only the current question (`409 QUESTION_MISMATCH` otherwise). Results list eligible
  schemes first. The session ends after the results (`404 SESSION_NOT_FOUND` if answered again).
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

`text` is 1–5000 characters. The result fits in 2 segments (mock: cut at a word boundary with
`...`; step 2: rewritten by Gemini). In English, prefer "Rs" to "₹": ₹ is not in GSM-7 and turns
the whole SMS into Unicode (70 instead of 160 characters).

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

`topK` is 1–10 (default 4). `score` is in [0, 1], best first.

## Changelog

| Version | Change                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1       | Initial contract. Additions to the original brief: optional eligibility `progress`, the standard error body, `/api/rag/search` (internal). |
