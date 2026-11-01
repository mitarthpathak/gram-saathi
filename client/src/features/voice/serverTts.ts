import type { LanguageCode, TtsBasis } from '@gram-saathi/shared';
import { api, ApiError } from '@/lib/api';
import { config } from '@/lib/config';
import { storage } from '@/lib/storage';

const CACHE_LIMIT = 20;
// The server gives Gemini TTS up to TTS_TIMEOUT_MS (15 s by default) per piece, with one retry, and
// long answers are split into pieces synthesized in parallel. A shorter client deadline would turn
// most server speech into the browser voice.
const REQUEST_TIMEOUT_MS = 20_000;
const LOW_BANDWIDTH_KEY = 'gs:lowBandwidth';

/** Server audio plus what it is based on (POST /api/tts `basis`; older servers omit it). */
export interface ServerSpeech {
  audioUrl: string;
  basis?: TtsBasis;
}

export interface ServerSpeechOptions {
  /** Registry dialect id: send it only when `text` is dialect-worded (answerStyle.rendered). */
  dialectId?: string | null;
  signal?: AbortSignal;
}

const audioCache = new Map<string, ServerSpeech | null>();
const inFlight = new Map<string, Promise<ServerSpeech | null>>();
let serverUnavailable = false;

/** Fetch server-generated speech. Failures are always returned as null for browser fallback. */
export async function fetchServerSpeech(
  text: string,
  language: LanguageCode,
  options: ServerSpeechOptions = {},
): Promise<ServerSpeech | null> {
  const { dialectId, signal } = options;
  if (config.useMocks || storage.get(LOW_BANDWIDTH_KEY) === 'true' || signal?.aborted) return null;
  if (serverUnavailable) return null;

  const key = JSON.stringify([language, dialectId ?? null, text]);
  if (audioCache.has(key)) {
    const cached = audioCache.get(key) ?? null;
    audioCache.delete(key);
    audioCache.set(key, cached);
    return cached;
  }
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = fetchAndCache(key, text, language, dialectId ?? null, signal);
  inFlight.set(key, request);
  try {
    return await request;
  } finally {
    if (inFlight.get(key) === request) inFlight.delete(key);
  }
}

/** Audio URL only: the shape callers had before `basis` existed. */
export async function fetchServerTts(
  text: string,
  language: LanguageCode,
  signal?: AbortSignal,
): Promise<string | null> {
  return (await fetchServerSpeech(text, language, { signal }))?.audioUrl ?? null;
}

async function fetchAndCache(
  key: string,
  text: string,
  language: LanguageCode,
  dialectId: string | null,
  signal?: AbortSignal,
): Promise<ServerSpeech | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('TTS request timed out')), REQUEST_TIMEOUT_MS);
      if (signal) {
        abortListener = () => reject(new Error('TTS request aborted'));
        signal.addEventListener('abort', abortListener, { once: true });
      }
    });
    const response = await Promise.race([
      api.tts({ text, language, ...(dialectId ? { dialectId } : {}) }),
      timeout,
    ]);
    if (!response.audioUrl) {
      // A server that reports `basis` answers null per request (an answer over the audio size cap,
      // one provider timeout): try again for other texts. An older server without `basis` answers
      // null because it has no server speech at all, so stop asking for this session.
      if (response.basis === undefined) serverUnavailable = true;
      cache(key, null);
      return null;
    }
    const speech: ServerSpeech = {
      audioUrl: response.audioUrl,
      ...(response.basis ? { basis: response.basis } : {}),
    };
    cache(key, speech);
    return speech;
  } catch (error) {
    if (error instanceof ApiError && !isRetryable(error.status)) serverUnavailable = true;
    return null;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (signal && abortListener) signal.removeEventListener('abort', abortListener);
  }
}

function isRetryable(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function cache(key: string, speech: ServerSpeech | null): void {
  audioCache.delete(key);
  audioCache.set(key, speech);
  if (audioCache.size > CACHE_LIMIT) audioCache.delete(audioCache.keys().next().value!);
}
