# Eligibility rules

> **SAMPLE RULES: VERIFY AGAINST OFFICIAL SOURCE.** The four scheme files here were written for
> the hackathon from public summaries, are simplified, and have `"verified": false`. Before
> anyone relies on a result, check every condition and reason against the official guidelines
> linked in `source`, fix what is wrong and set `"verified": true`. The server logs a warning at
> startup for every unverified file.

When `USE_MOCKS` does not include `eligibility`, the wizard behind `POST /api/eligibility/start`
and `POST /api/eligibility/answer` runs on these files. The decision is **deterministic**: plain
comparisons in `server/src/modules/eligibility/engine.ts`, never an AI model, so the same answers
always give the same result. Gemini is used for two things only:

1. translating a question, option or reason that has no reviewed text in the user's language;
2. reading a free-form (spoken) answer as a value: "do bigha zameen" → acres,
   "main kisaan hu" → `farmer`, "पैंतीस साल" → 35.

## Files

| File              | Contents                                                      |
| ----------------- | ------------------------------------------------------------- |
| `questions.json`  | The questions, in the order they are asked                    |
| `<schemeId>.json` | One scheme: its conditions and reasons (file name = schemeId) |

## Questions (`questions.json`)

```json
{
  "id": "age",
  "type": "number",
  "min": 0,
  "max": 120,
  "unit": "years",
  "unitWords": ["years", "साल"],
  "text": { "en": "How old are you? (in years)", "hi": "आपकी उम्र कितनी है? (साल में)" }
}
```

| Field       | Notes                                                                            |
| ----------- | -------------------------------------------------------------------------------- |
| `id`        | Used in conditions and sent to the client as `question.id`                       |
| `type`      | `number`, `boolean` or `choice` (the contract's question types)                  |
| `text`      | `en` required; `hi`, `mr`, `ta` optional (missing ones are machine-translated)   |
| `options`   | `choice` only: `{ "value": "farmer", "label": { "en": "Farmer", ... } }`         |
| `min`/`max` | `number` only: allowed range (answers outside it get `400 INVALID_ANSWER`)       |
| `unit`      | `number` only: the unit the value is stored in; the AI converts to it            |
| `unitWords` | `number` only: words accepted after a bare number without an AI call ("2 acres") |
| `parseHint` | Extra instructions for reading free-form answers, e.g. unit conversions          |

A scheme file may also define its own `questions` (same format); they are asked after these.

## Scheme rules (`<schemeId>.json`)

```json
{
  "schemeId": "atal-pension-yojana",
  "verified": false,
  "source": "https://www.pfrda.org.in",
  "schemeName": { "en": "Atal Pension Yojana", "hi": "अटल पेंशन योजना" },
  "eligibleIf": {
    "all": [
      {
        "question": "age",
        "op": "between",
        "value": [18, 40],
        "reason": { "en": "Only for ages 18 to 40." }
      },
      { "question": "hasBankAccount", "op": "==", "value": true }
    ]
  },
  "reasons": {
    "eligible": { "en": "You can join at your bank or post office." },
    "notEligible": { "en": "Optional fallback when no failing condition has a reason." }
  }
}
```

Conditions nest freely:

| Condition                                                 | True when                                 |
| --------------------------------------------------------- | ----------------------------------------- |
| `{ "all": [ ... ] }`                                      | every part is true                        |
| `{ "any": [ ... ] }`                                      | at least one part is true                 |
| `{ "not": { ... } }`                                      | the part is false                         |
| `{ "question": "q", "op": "==", "value": v }`             | also `!=`; for number, boolean and choice |
| `{ "question": "q", "op": ">=", "value": 70 }`            | also `<`, `<=`, `>`; numbers only         |
| `{ "question": "q", "op": "between", "value": [18, 40] }` | inclusive range                           |
| `{ "question": "q", "op": "in", "value": ["asha"] }`      | answer is one of the values               |

Any condition can carry a `reason`: it is shown when that condition is what makes the scheme
fail. Use `$comment` anywhere for notes; it is ignored.

## How the wizard runs

- Conditions use three-valued logic (true / false / not known yet). The wizard asks the first
  question that can still change some scheme's result and skips the rest, so `progress.total`
  can shrink as answers come in.
- Results list eligible schemes first. The reason is the scheme's `eligible` text, or the
  `reason` of the condition that failed, or the scheme's `notEligible` text, or a default
  "please confirm at your nearest CSC or gram panchayat office".
- Exact answers (a number, `true`/`false`, an option label in any language) and plain yes / no
  words in the four languages need no AI. Anything else goes to Gemini; an answer it cannot read
  gets `422 UNCLEAR_ANSWER` and the client asks again.

## Adding or changing a scheme

1. Copy a scheme file to `<schemeId>.json` and edit it. Add any new question to
   `questions.json` (or to the scheme's own `questions`).
2. Write reviewed `hi`, `mr` and `ta` texts if you can: machine translation is the fallback.
3. Run `npm test -w server`: a test loads and validates every file in this folder, and the
   server refuses to start with a broken rule file (the error names the file and the problem).
