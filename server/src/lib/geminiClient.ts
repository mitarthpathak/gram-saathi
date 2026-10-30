/**
 * The single place where the server talks to Gemini (Google Gen AI SDK, `@google/genai`).
 *
 * - generateJson(): text and/or audio in, JSON out, validated with zod. Uses the Interactions
 *   API with a JSON-schema `response_format` (https://ai.google.dev/gemini-api/docs/structured-output).
 * - embedTexts(): batched embeddings for retrieval via models.embedContent
 *   (https://ai.google.dev/gemini-api/docs/embeddings).
 *
 * Every call has a timeout and is retried with exponential backoff on 429 / 5xx / timeouts /
 * network errors. Failures surface as GeminiError, an HttpError, so routes answer with a clean
 * 429 / 503 / 504 / 502 instead of a generic 500. Prompts live in the modules that own them.
 */
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { env } from '../config/env';
import { HttpError } from './httpError';
import { withGeminiConcurrency } from './geminiScheduler';
import { logger } from './logger';
import { normalizeVector } from './vectors';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type GeminiErrorKind =
  | 'not_configured' // no API key
  | 'auth' // key rejected
  | 'rate_limited' // 429: quota or rate limit
  | 'unavailable' // 5xx
  | 'network' // could not connect
  | 'timeout'
  | 'bad_request' // other 4xx: our request is wrong
  | 'blocked' // no output (e.g. safety filters)
  | 'bad_response'; // output missing, not JSON or not matching the schema

const HTTP_BY_KIND: Record<GeminiErrorKind, [status: number, code: string]> = {
  not_configured: [503, 'AI_NOT_CONFIGURED'],
  auth: [503, 'AI_NOT_CONFIGURED'],
  rate_limited: [429, 'AI_RATE_LIMITED'],
  unavailable: [503, 'AI_UNAVAILABLE'],
  network: [503, 'AI_UNAVAILABLE'],
  timeout: [504, 'AI_TIMEOUT'],
  bad_request: [502, 'AI_ERROR'],
  blocked: [502, 'AI_ERROR'],
  bad_response: [502, 'AI_ERROR'],
};

const RETRYABLE_KINDS = new Set<GeminiErrorKind>([
  'rate_limited',
  'unavailable',
  'network',
  'timeout',
]);

export class GeminiError extends HttpError {
  readonly kind: GeminiErrorKind;
  /** HTTP status returned by Gemini, if any. */
  readonly upstreamStatus?: number;
  /** How long Gemini asked us to wait (Retry-After / RetryInfo), if it said. */
  readonly retryAfterMs?: number;

  constructor(
    kind: GeminiErrorKind,
    message: string,
    options: { upstreamStatus?: number; retryAfterMs?: number; cause?: unknown } = {},
  ) {
    const [status, code] = HTTP_BY_KIND[kind];
    super(status, code, message);
    this.name = 'GeminiError';
    this.kind = kind;
    this.upstreamStatus = options.upstreamStatus;
    this.retryAfterMs = options.retryAfterMs;
    if (options.cause !== undefined) this.cause = options.cause;
  }

  /** Worth trying again after a pause. */
  get retryable(): boolean {
    return RETRYABLE_KINDS.has(this.kind);
  }
}

// Error class names used by the SDK (not exported) and by fetch/AbortSignal.
const TIMEOUT_ERROR_NAMES = new Set([
  'APIConnectionTimeoutError',
  'RequestTimeoutError',
  'TimeoutError',
  // We only abort requests through timeouts, so an abort means "too slow".
  'AbortError',
  'APIUserAbortError',
  'RequestAbortedError',
]);
const NETWORK_ERROR_NAMES = new Set(['APIConnectionError', 'ConnectionError', 'FetchError']);
const NETWORK_ERROR_PATTERN =
  /fetch failed|ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket hang up/i;

/**
 * Maps an SDK / network error to a GeminiError. Returns undefined for anything else (e.g. a
 * bug in our own code), which callers rethrow unchanged.
 */
export function classifyGeminiError(error: unknown): GeminiError | undefined {
  if (error instanceof GeminiError) return error;
  if (typeof error !== 'object' || error === null) return undefined;

  const { name, message, status, statusCode, headers } = error as Record<string, unknown>;
  const errorName = typeof name === 'string' ? name : '';
  const text = typeof message === 'string' ? message : '';
  const upstreamStatus =
    typeof status === 'number' ? status : typeof statusCode === 'number' ? statusCode : undefined;
  const options = { upstreamStatus, cause: error };

  if (TIMEOUT_ERROR_NAMES.has(errorName) || upstreamStatus === 408) {
    return new GeminiError('timeout', `Gemini did not answer in time (${text})`, options);
  }
  if (upstreamStatus === 429) {
    return new GeminiError('rate_limited', 'Gemini rate limit or quota exceeded', {
      ...options,
      retryAfterMs: parseRetryAfter(headers, text),
    });
  }
  if (
    upstreamStatus === 401 ||
    upstreamStatus === 403 ||
    /API_KEY_INVALID|API key not valid/i.test(text)
  ) {
    return new GeminiError('auth', 'Gemini rejected the API key: check GEMINI_API_KEY', options);
  }
  if (upstreamStatus !== undefined && upstreamStatus >= 500) {
    return new GeminiError('unavailable', `Gemini is unavailable (${upstreamStatus})`, {
      ...options,
      retryAfterMs: parseRetryAfter(headers, text),
    });
  }
  if (upstreamStatus !== undefined && upstreamStatus >= 400) {
    return new GeminiError(
      'bad_request',
      `Gemini rejected the request (${upstreamStatus}): ${text.slice(0, 300)}`,
      options,
    );
  }
  if (NETWORK_ERROR_NAMES.has(errorName) || NETWORK_ERROR_PATTERN.test(text)) {
    return new GeminiError('network', `Could not reach Gemini: ${text}`, options);
  }
  return undefined;
}

function parseRetryAfter(headers: unknown, message: string): number | undefined {
  let header: unknown;
  if (headers instanceof Headers) header = headers.get('retry-after');
  else if (typeof headers === 'object' && headers !== null) {
    header = (headers as Record<string, unknown>)['retry-after'];
  }
  const seconds = Number(header);
  if (header != null && Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  // Gemini 429 bodies carry google.rpc.RetryInfo, e.g. "retryDelay": "17s".
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(message);
  return match ? Number(match[1]) * 1000 : undefined;
}

// ---------------------------------------------------------------------------
// Retries
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Short name for logs, e.g. "answer". */
  label: string;
  /** Defaults to GEMINI_MAX_RETRIES. */
  maxRetries?: number;
  baseDelayMs?: number;
  /** Longest single wait; scripts can afford longer waits than live requests. */
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `fn`, retrying transient Gemini failures with exponential backoff plus jitter, and
 * honouring the wait Gemini asks for on 429s. A malformed response gets one extra try.
 */
export async function withRetries<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const maxRetries = options.maxRetries ?? env.GEMINI_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 20_000;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (raw) {
      const error = classifyGeminiError(raw);
      if (!error) throw raw;
      const allowed =
        error.kind === 'bad_response' ? Math.min(1, maxRetries) : error.retryable ? maxRetries : 0;
      if (attempt >= allowed) throw error;

      const backoff = baseDelayMs * 2 ** attempt * (0.5 + Math.random() / 2);
      const delay = Math.min(maxDelayMs, Math.max(backoff, error.retryAfterMs ?? 0));
      logger.warn(
        `Gemini ${options.label}: ${error.kind} (${error.message.slice(0, 160)}); ` +
          `retry ${attempt + 1}/${allowed} in ${Math.round(delay)} ms`,
      );
      await sleep(delay);
    }
  }
}

// ---------------------------------------------------------------------------
// Backend: the raw API calls, replaceable by a fake in tests
// ---------------------------------------------------------------------------

export type GeminiInputPart =
  | { type: 'text'; text: string }
  /** `data` is base64. */
  | { type: 'audio'; data: string; mimeType: string };

export interface GenerateRequest {
  model: string;
  system?: string;
  input: string | GeminiInputPart[];
  /** JSON Schema for the response (Gemini supports a subset). */
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface GenerateResult {
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number; thoughtTokens?: number };
}

export interface EmbedRequest {
  model: string;
  texts: string[];
  /** Only for models that take a task type (gemini-embedding-001). */
  taskType?: string;
  dimensions: number;
  timeoutMs: number;
}

export interface GeminiBackend {
  generate(request: GenerateRequest): Promise<GenerateResult>;
  embed(request: EmbedRequest): Promise<number[][]>;
}

function createSdkBackend(apiKey: string): GeminiBackend {
  const ai = new GoogleGenAI({ apiKey });
  const thinkingLevel = env.GEMINI_THINKING_LEVEL;

  return {
    async generate(request) {
      const interaction = await ai.interactions.create(
        {
          model: request.model,
          input:
            typeof request.input === 'string'
              ? request.input
              : request.input.map((part) =>
                  part.type === 'text'
                    ? { type: 'text' as const, text: part.text }
                    : { type: 'audio' as const, data: part.data, mime_type: part.mimeType },
                ),
          system_instruction: request.system,
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: request.jsonSchema,
          },
          generation_config: {
            max_output_tokens: request.maxOutputTokens,
            ...(thinkingLevel !== 'default' && { thinking_level: thinkingLevel }),
          },
          // We never read interactions back, so don't keep users' questions server-side.
          store: false,
        },
        // withRetries() owns backoff, so the SDK must not retry on its own.
        { timeout_ms: request.timeoutMs, retries: { strategy: 'none' } },
      );

      if (interaction.status !== 'completed') {
        throw new GeminiError(
          'bad_response',
          `Gemini interaction ended with status "${interaction.status}"`,
        );
      }
      const text = interaction.output_text ?? '';
      if (!text.trim()) {
        throw new GeminiError('blocked', 'Gemini returned no text (it may have been blocked)');
      }
      return {
        text,
        usage: {
          inputTokens: interaction.usage?.total_input_tokens,
          outputTokens: interaction.usage?.total_output_tokens,
          thoughtTokens: interaction.usage?.total_thought_tokens,
        },
      };
    },

    async embed(request) {
      const response = await ai.models.embedContent({
        model: request.model,
        // One Content per text gives one embedding per text; a plain list of strings would be
        // aggregated into a single embedding by gemini-embedding-2.
        contents: request.texts.map((text) => ({ parts: [{ text }] })),
        config: {
          outputDimensionality: request.dimensions,
          ...(request.taskType && { taskType: request.taskType }),
          httpOptions: { timeout: request.timeoutMs },
        },
      });
      const vectors = (response.embeddings ?? []).map((embedding) => embedding.values ?? []);
      if (vectors.length !== request.texts.length || vectors.some((v) => v.length === 0)) {
        throw new GeminiError(
          'bad_response',
          `Expected ${request.texts.length} embeddings, got ${vectors.length}`,
        );
      }
      return vectors;
    },
  };
}

let backend: GeminiBackend | undefined;

/** True when an API key is set (or a fake backend is installed). */
export function isGeminiConfigured(): boolean {
  return backend !== undefined || Boolean(env.GEMINI_API_KEY);
}

/** For tests: install a fake backend, or pass undefined to go back to the real SDK. */
export function setGeminiBackend(fake: GeminiBackend | undefined): void {
  backend = fake;
}

function getBackend(): GeminiBackend {
  if (backend) return backend;
  if (!env.GEMINI_API_KEY) {
    throw new GeminiError(
      'not_configured',
      'GEMINI_API_KEY is not set: add it to .env, or run with USE_MOCKS=true.',
    );
  }
  backend = createSdkBackend(env.GEMINI_API_KEY);
  return backend;
}

// ---------------------------------------------------------------------------
// Structured generation
// ---------------------------------------------------------------------------

export interface GenerateJsonOptions<T> {
  /** Short name for logs, e.g. "answer". */
  label: string;
  system?: string;
  input: string | GeminiInputPart[];
  /** Shape of the expected JSON. Sent to Gemini as a JSON Schema and used to validate. */
  schema: z.ZodType<T>;
  /** Defaults to GEMINI_CHAT_MODEL. */
  model?: string;
  /** Includes thinking tokens on some models, so keep it generous. Default 2048. */
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  /** Cancels a queued call when its caller no longer needs the result. */
  signal?: AbortSignal;
}

/** Asks Gemini for JSON matching `schema`, validates it and returns the typed result. */
export async function generateJson<T>(options: GenerateJsonOptions<T>): Promise<T> {
  const client = getBackend();
  const model = options.model ?? env.GEMINI_CHAT_MODEL;
  const jsonSchema = toGeminiJsonSchema(options.schema);

  return withRetries(
    async () => {
      const startedAt = Date.now();
      const { text, usage } = await withGeminiConcurrency(
        options.label.startsWith('dialect-') ? 'dialect' : 'answer',
        () =>
          client.generate({
            model,
            system: options.system,
            input: options.input,
            jsonSchema,
            maxOutputTokens: options.maxOutputTokens ?? 2048,
            timeoutMs: options.timeoutMs ?? env.GEMINI_TIMEOUT_MS,
          }),
        options.signal,
      );
      const result = options.schema.safeParse(parseJsonOutput(text));
      if (!result.success) {
        throw new GeminiError(
          'bad_response',
          `Gemini ${options.label} output does not match the schema: ${z.prettifyError(result.error)}`,
        );
      }
      logger.debug(
        `gemini ${options.label}: ${model}, ${Date.now() - startedAt} ms, tokens in ` +
          `${usage?.inputTokens ?? '?'} / out ${usage?.outputTokens ?? '?'} / thinking ${usage?.thoughtTokens ?? 0}`,
      );
      return result.data;
    },
    { label: options.label, maxRetries: options.maxRetries },
  );
}

/** zod -> the JSON Schema subset Gemini accepts in `response_format`. */
export function toGeminiJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _dialect, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
  return jsonSchema;
}

function parseJsonOutput(text: string): unknown {
  // JSON mode returns bare JSON; tolerate a markdown fence anyway.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    // Model output may contain a transcript. Keep it out of error messages and retry logs.
    throw new GeminiError('bad_response', 'Gemini returned invalid JSON');
  }
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

export type EmbeddingKind = 'query' | 'document';

export interface EmbedOptions {
  kind: EmbeddingKind;
  /** Per-text document titles (same order as `texts`), e.g. "PM-KISAN: Eligibility". */
  titles?: string[];
  /** Defaults to GEMINI_EMBED_MODEL. Queries must use the model the store was built with. */
  model?: string;
  /** Defaults to GEMINI_EMBED_DIMENSIONS. */
  dimensions?: number;
  batchSize?: number;
  maxRetries?: number;
  maxDelayMs?: number;
  /** Called after each batch, e.g. for progress output. */
  onBatch?: (done: number, total: number) => void;
}

/** Embeds `texts` in batches. Vectors are L2-normalized, so cosine = dot product. */
export async function embedTexts(texts: string[], options: EmbedOptions): Promise<Float32Array[]> {
  const client = getBackend();
  const model = options.model ?? env.GEMINI_EMBED_MODEL;
  const dimensions = options.dimensions ?? env.GEMINI_EMBED_DIMENSIONS;
  const batchSize = options.batchSize ?? 50;
  const taskType = usesTaskTypeParameter(model)
    ? options.kind === 'query'
      ? 'RETRIEVAL_QUERY'
      : 'RETRIEVAL_DOCUMENT'
    : undefined;
  const prepared = texts.map((text, i) =>
    formatForEmbedding(text, options.kind, model, options.titles?.[i]),
  );

  const vectors: Float32Array[] = [];
  for (let start = 0; start < prepared.length; start += batchSize) {
    const batch = prepared.slice(start, start + batchSize);
    const values = await withRetries(
      () =>
        withGeminiConcurrency('answer', () =>
          client.embed({
            model,
            texts: batch,
            taskType,
            dimensions,
            timeoutMs: env.GEMINI_TIMEOUT_MS,
          }),
        ),
      { label: 'embed', maxRetries: options.maxRetries, maxDelayMs: options.maxDelayMs },
    );
    vectors.push(...values.map(normalizeVector));
    options.onBatch?.(Math.min(start + batchSize, prepared.length), prepared.length);
  }
  return vectors;
}

/** gemini-embedding-001 takes `taskType`; gemini-embedding-2 rejects it (task goes in the text). */
export function usesTaskTypeParameter(model: string): boolean {
  return !model.includes('gemini-embedding-2');
}

/** Formats text as the embeddings docs recommend for retrieval with each model family. */
export function formatForEmbedding(
  text: string,
  kind: EmbeddingKind,
  model: string,
  title?: string,
): string {
  if (usesTaskTypeParameter(model)) {
    return kind === 'document' && title ? `${title}\n\n${text}` : text;
  }
  return kind === 'query'
    ? `task: question answering | query: ${text}`
    : `title: ${title ?? 'none'} | text: ${text}`;
}
