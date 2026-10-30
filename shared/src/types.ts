/**
 * Gram Saathi API contract: the single source of truth for client <-> server traffic.
 *
 * Rules (see CONTRIBUTING.md):
 * - Types only. No runtime code in this package (ESLint enforces it).
 * - Change this file only in a PR that also updates docs/API_CONTRACT.md.
 */

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

/** Languages the UI supports and the API accepts as input. Adding one is a contract change. */
export type LanguageCode = 'hi' | 'mr' | 'ta' | 'en';

/** A selectable or suggested regional variety. */
export interface DialectOption {
  id: string;
  name: string;
  nativeName: string;
}

/** A dialect result returned only when the server has enough evidence to identify it. */
export interface DialectResult extends DialectOption {
  confidence: 'medium' | 'high';
}

/** A dialect available for confirmation by the user. */
export interface DialectInfo extends DialectOption {
  parentLanguage: LanguageCode;
  states: string[];
  testStatus: 'experimental' | 'tested';
}

/** GET /api/dialects */
export interface DialectsResponse {
  items: DialectInfo[];
}

/** Citation for the scheme-document chunk an answer is grounded on. */
export interface Source {
  /** Stable id: the file name in data/schemes without `.md`, e.g. "pm-kisan". */
  schemeId: string;
  schemeName: string;
  /** Heading of the document section, e.g. "Eligibility". */
  section: string;
  /** Short verbatim excerpt from that section (up to ~300 characters). */
  snippet: string;
}

/** Body of every non-2xx response. */
export interface ApiErrorBody {
  error: {
    /** Machine-readable code, e.g. "VALIDATION_ERROR", "UNCLEAR_ANSWER", "AI_UNAVAILABLE". */
    code: string;
    /** Developer-facing English message. The UI shows its own localized text. */
    message: string;
    details?: unknown;
  };
}

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok';
  /** true when the server runs with USE_MOCKS=true. */
  mocks: boolean;
}

// ---------------------------------------------------------------------------
// POST /api/chat/query (JSON) and POST /api/voice/query (multipart)
// ---------------------------------------------------------------------------

export interface ChatQueryRequest {
  text: string;
  /** Hint from the language selector. Omit to let the server detect the language. */
  language?: LanguageCode;
  /** Registry id the user confirmed or selected; skips dialect detection. */
  dialectHint?: string;
  sessionId: string;
}

/** Text fields of the multipart voice request. The recording goes in a file part named `audio`. */
export interface VoiceQueryFields {
  language?: LanguageCode;
  /** Registry id the user confirmed or selected; skips dialect detection. */
  dialectHint?: string;
  sessionId: string;
}

export interface QueryResponse {
  sessionId: string;
  /** What the user said. Present for voice queries only. */
  transcript?: string;
  /**
   * Language of the question, and of the answer, fraud warning and SMS. Always a LanguageCode
   * since contract v2 (a dialect such as Bhojpuri is reported as its base language, "hi").
   */
  detectedLanguage: LanguageCode;
  /** Confident dialect identification; null means abstained or not applicable. */
  dialect?: DialectResult | null;
  /** Up to three suggestions, sent for abstentions and medium confidence (or [] for a hint). */
  dialectCandidates?: DialectOption[];
  /** Answer in the user's language, grounded only in `sources`. */
  answer: string;
  /** The passages the answer uses. Empty when `notFound`. */
  sources: Source[];
  /** Anti-fraud reminder shown with every answer, in the user's language. */
  fraudWarning: string;
  /** SMS-length version of the answer. */
  smsText: string;
  /** SMS segments needed for `smsText` (GSM-7: 160 chars, or 153 per part; Unicode: 70, or 67 per part). */
  smsSegments: number;
  /** Server-generated speech. null means the client should use the browser's speech synthesis. */
  audioUrl: string | null;
  /** true when the answer came from the server's answer cache. */
  usedCache: boolean;
  /** true when the documents do not answer the question; `answer` then says where to ask instead. */
  notFound: boolean;
}

// ---------------------------------------------------------------------------
// POST /api/eligibility/start and POST /api/eligibility/answer
// ---------------------------------------------------------------------------

export type EligibilityQuestionType = 'number' | 'choice' | 'boolean';

export interface EligibilityQuestion {
  /** Comes from the rule data (data/eligibility): do not hard-code ids or their order. */
  id: string;
  /** Question in the session language. */
  text: string;
  type: EligibilityQuestionType;
  /** Only for "choice": labels in the session language. Answer with one of them verbatim. */
  options?: string[];
}

/** Lets the wizard show "question 2 of 4". Optional: clients must cope without it. */
export interface EligibilityProgress {
  /** 1-based position of the returned question. */
  current: number;
  /** Upper bound: questions that can no longer change any result are skipped, so it may shrink. */
  total: number;
}

export interface EligibilityStartRequest {
  sessionId: string;
  language: LanguageCode;
}

export interface EligibilityStartResponse {
  question: EligibilityQuestion;
  progress?: EligibilityProgress;
}

/**
 * A number for "number" questions, a boolean for "boolean", one of `options` for "choice".
 * Since contract v2 also free-form text for any type (e.g. a voice transcript such as
 * "do bigha zameen"), which the server reads; unreadable text gets 422 UNCLEAR_ANSWER.
 */
export type EligibilityAnswerValue = number | string | boolean;

export interface EligibilityAnswerRequest {
  sessionId: string;
  questionId: string;
  answer: EligibilityAnswerValue;
}

export interface EligibilityResult {
  schemeId: string;
  schemeName: string;
  eligible: boolean;
  /** One short sentence in the session language. */
  reason: string;
}

export type EligibilityAnswerResponse =
  | { done: false; question: EligibilityQuestion; progress?: EligibilityProgress }
  | { done: true; results: EligibilityResult[] };

// ---------------------------------------------------------------------------
// POST /api/sms/compress
// ---------------------------------------------------------------------------

export interface SmsCompressRequest {
  text: string;
  language: LanguageCode;
}

export interface SmsCompressResponse {
  sms: string;
  segments: number;
}

// ---------------------------------------------------------------------------
// GET /api/faq/top?lang=hi (offline / low-bandwidth mode)
// ---------------------------------------------------------------------------

export interface FaqTopQuery {
  /** Defaults to "hi". */
  lang?: LanguageCode;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sources: Source[];
}

export interface FaqTopResponse {
  items: FaqItem[];
}

// ---------------------------------------------------------------------------
// POST /api/tts (optional: browser speech synthesis is the default)
// ---------------------------------------------------------------------------

export interface TtsRequest {
  text: string;
  language: LanguageCode;
}

export interface TtsResponse {
  audioUrl: string | null;
}

// ---------------------------------------------------------------------------
// POST /api/rag/search: internal debug endpoint for the RAG workstream, not used by the UI
// ---------------------------------------------------------------------------

export interface RagSearchRequest {
  query: string;
  language?: LanguageCode;
  /** Defaults to 4, max 10. */
  topK?: number;
}

export interface RetrievedChunk {
  schemeId: string;
  schemeName: string;
  section: string;
  text: string;
  /** Relevance in [0, 1]; higher is better. */
  score: number;
}

export interface RagSearchResponse {
  chunks: RetrievedChunk[];
}
