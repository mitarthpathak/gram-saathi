import type {
  ApiErrorBody,
  ChatQueryRequest,
  DialectsResponse,
  EligibilityAnswerRequest,
  EligibilityAnswerResponse,
  EligibilityStartRequest,
  EligibilityStartResponse,
  FaqTopResponse,
  HealthResponse,
  LanguageCode,
  QueryResponse,
  SmsCompressRequest,
  SmsCompressResponse,
  TtsRequest,
  TtsResponse,
  VoiceQueryFields,
} from '@gram-saathi/shared';
import { config } from './config';

export interface VoiceQueryRequest extends VoiceQueryFields {
  audio: Blob;
}

/** Every endpoint in docs/API_CONTRACT.md. Implemented by the HTTP client and by src/mocks. */
export interface Api {
  health(): Promise<HealthResponse>;
  chatQuery(request: ChatQueryRequest): Promise<QueryResponse>;
  voiceQuery(request: VoiceQueryRequest): Promise<QueryResponse>;
  eligibilityStart(request: EligibilityStartRequest): Promise<EligibilityStartResponse>;
  eligibilityAnswer(request: EligibilityAnswerRequest): Promise<EligibilityAnswerResponse>;
  smsCompress(request: SmsCompressRequest): Promise<SmsCompressResponse>;
  faqTop(lang: LanguageCode): Promise<FaqTopResponse>;
  tts(request: TtsRequest): Promise<TtsResponse>;
  dialects(): Promise<DialectsResponse>;
}

/** Thrown for non-2xx responses (status = HTTP status) and network failures (status 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, init);
  } catch (cause) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server', cause);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? response.statusText,
      error?.details,
    );
  }
  return body as T;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const httpApi: Api = {
  health: () => request<HealthResponse>('/api/health'),
  chatQuery: (body) => postJson<QueryResponse>('/api/chat/query', body),
  voiceQuery: ({ audio, language, dialectHint, sessionId }) => {
    const form = new FormData();
    form.append('audio', audio, `question.${audio.type.includes('wav') ? 'wav' : 'webm'}`);
    if (language) form.append('language', language);
    if (dialectHint) form.append('dialectHint', dialectHint);
    form.append('sessionId', sessionId);
    return request<QueryResponse>('/api/voice/query', { method: 'POST', body: form });
  },
  eligibilityStart: (body) => postJson<EligibilityStartResponse>('/api/eligibility/start', body),
  eligibilityAnswer: (body) => postJson<EligibilityAnswerResponse>('/api/eligibility/answer', body),
  smsCompress: (body) => postJson<SmsCompressResponse>('/api/sms/compress', body),
  faqTop: (lang) => request<FaqTopResponse>(`/api/faq/top?lang=${encodeURIComponent(lang)}`),
  tts: (body) => postJson<TtsResponse>('/api/tts', body),
  dialects: () => request<DialectsResponse>('/api/dialects'),
};

let mockApi: Promise<Api> | undefined;

function backend(): Promise<Api> {
  if (!config.useMocks) return Promise.resolve(httpApi);
  // Loaded on demand, so mock data stays out of the bundle unless mocks are on.
  mockApi ??= import('../mocks').then((module) => module.mockApi);
  return mockApi;
}

/** Typed API client. Calls the server, or src/mocks when VITE_USE_MOCKS=true. */
export const api: Api = {
  health: () => backend().then((b) => b.health()),
  chatQuery: (body) => backend().then((b) => b.chatQuery(body)),
  voiceQuery: (body) => backend().then((b) => b.voiceQuery(body)),
  eligibilityStart: (body) => backend().then((b) => b.eligibilityStart(body)),
  eligibilityAnswer: (body) => backend().then((b) => b.eligibilityAnswer(body)),
  smsCompress: (body) => backend().then((b) => b.smsCompress(body)),
  faqTop: (lang) => backend().then((b) => b.faqTop(lang)),
  tts: (body) => backend().then((b) => b.tts(body)),
  dialects: () => backend().then((b) => b.dialects()),
};
