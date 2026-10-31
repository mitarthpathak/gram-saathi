# Decisions

## Conversation routing

- **Decision:** Every live typed message and every voice transcript goes through the same intent-understanding step. Only `scheme_question` may retrieve passages; its query is requested in English and skips legacy query translation.
- **Alternatives considered:** Keep a deterministic greeting classifier in front of RAG; translate non-English input in the RAG module; continue retrieving for all messages.
- **Why:** The model must distinguish clarifications and social messages before retrieval. The explicit English query prevents duplicate translation and improves search consistency.

## Session history and caching

- **Decision:** Live chat uses process-local six-turn history capped at 500 LRU sessions. The old answer cache remains on the mocked chat path; live turns are not served from the answer cache.
- **Alternatives considered:** Cache live results by question; cache only grounded answers; move memory into shared storage.
- **Why:** A repeated utterance can be a clarification whose meaning depends on the previous assistant answer. Caching before intent understanding can return a scheme result for a clarification. Shared durable memory is outside this demo's scope.

## Dialect confidence

- **Decision:** A user-confirmed dialect is always passed as a hint. Automatic dialect output is passed only when the existing repo classifier marks it high confidence; medium results and abstentions do not override language understanding.
- **Alternatives considered:** Pass medium-confidence labels; disable all automatic dialect hints.
- **Why:** The classifier's confidence is not calibrated for production. A user confirmation is stronger evidence, and the repo already treats medium confidence conservatively.

## Server-side TTS

- **Decision:** Gemini TTS is implemented against the current official speech-generation API, and is enabled only when `GEMINI_TTS_MODEL` and `GEMINI_API_KEY` are configured. Bhashini/Dhruva remains unimplemented until the owner's callback URL, auth header and selected pipeline are confirmed.
- **Alternatives considered:** Hardcode a public example endpoint or model/service id; implement only browser speech.
- **Why:** The current Gemini docs provide the Interactions request and WAV output format. Bhashini's official docs say its compute endpoint and auth header come from an account-specific pipeline config, and an account's selected service/pipeline is required; there is no safe universal endpoint, service id or credential default. The adapter must be verified against an owner's account before it is wired.
- **References checked 2026-10-31:** [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation); [Bhashini pipeline compute](https://dibd-bhashini.gitbook.io/bhashini-apis/pipeline-compute-call); [Bhashini available models](https://dibd-bhashini.gitbook.io/bhashini-apis/available-models-for-usage).

## Scheme data

- **Decision:** Do not modify scheme data unless an official government source is fetched and its details can be verified. Preserve any unverified or sample-marked text and list it for human review.
- **Alternatives considered:** Fill gaps from prior knowledge; infer details from third-party summaries.
- **Why:** Eligibility, amounts, dates and links affect citizens and must be traceable to official sources.
