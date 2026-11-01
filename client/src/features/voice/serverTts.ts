import type { LanguageCode } from '@gram-saathi/shared';
import { api, ApiError } from '@/lib/api';
import { config } from '@/lib/config';
import { storage } from '@/lib/storage';

const CACHE_LIMIT = 20;
const REQUEST_TIMEOUT_MS = 6000;
const LOW_BANDWIDTH_KEY = 'gs:lowBandwidth';
const audioCache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();
let serverUnavailable = false;

/** Fetch server-generated speech. Failures are always returned as null for browser fallback. */
export async function fetchServerTts(
  text: string,
  language: LanguageCode,
  signal?: AbortSignal,
): Promise<string | null> {
  if (config.useMocks || storage.get(LOW_BANDWIDTH_KEY) === 'true' || signal?.aborted) return null;
  if (serverUnavailable) return null;

  const key = JSON.stringify([language, text]);
  if (audioCache.has(key)) {
    const cached = audioCache.get(key) ?? null;
    audioCache.delete(key);
    audioCache.set(key, cached);
    return cached;
  }
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = fetchAndCache(key, text, language, signal);
  inFlight.set(key, request);
  try {
    return await request;
  } finally {
    if (inFlight.get(key) === request) inFlight.delete(key);
  }
}

async function fetchAndCache(
  key: string,
  text: string,
  language: LanguageCode,
  signal?: AbortSignal,
): Promise<string | null> {
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
    const response = await Promise.race([api.tts({ text, language }), timeout]);
    const audioUrl = response.audioUrl;
    if (!audioUrl) {
      serverUnavailable = true;
      cache(key, null);
      return null;
    }
    cache(key, audioUrl);
    return audioUrl;
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

function cache(key: string, audioUrl: string | null): void {
  audioCache.delete(key);
  audioCache.set(key, audioUrl);
  if (audioCache.size > CACHE_LIMIT) audioCache.delete(audioCache.keys().next().value!);
}
