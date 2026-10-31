import { Blob } from 'node:buffer';
import { env } from '../config/env';
import { HttpError } from './httpError';

const API_BASE = 'https://api.sarvam.ai';
const RETRIES = 2;

interface SttResponse {
  transcript?: unknown;
  language_code?: unknown;
}

interface TtsResponse {
  audios?: unknown;
}

function upstreamError(status: number): HttpError {
  if (status === 401 || status === 403) {
    return new HttpError(
      503,
      'AI_NOT_CONFIGURED',
      'Sarvam rejected the API key. Check SARVAM_API_KEY.',
    );
  }
  if (status === 429) return new HttpError(429, 'AI_RATE_LIMITED', 'Sarvam rate limit exceeded.');
  if (status >= 500)
    return new HttpError(503, 'AI_UNAVAILABLE', `Sarvam is unavailable (${status}).`);
  return new HttpError(502, 'AI_ERROR', `Sarvam rejected the request (${status}).`);
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  if (!env.SARVAM_API_KEY) {
    throw new HttpError(503, 'AI_NOT_CONFIGURED', 'SARVAM_API_KEY is not set. Add it to .env.');
  }

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.SARVAM_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: { ...init.headers, 'api-subscription-key': env.SARVAM_API_KEY },
        signal: controller.signal,
      });
      if (response.ok) return (await response.json()) as T;
      if ((response.status === 429 || response.status >= 500) && attempt < RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
        continue;
      }
      throw upstreamError(response.status);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpError(504, 'AI_TIMEOUT', 'Sarvam did not answer in time.');
      }
      throw new HttpError(503, 'AI_UNAVAILABLE', 'Could not reach Sarvam.');
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function transcribeWithSarvam(input: {
  audio: Buffer;
  mimeType: string;
  languageCode: string;
}): Promise<{ transcript: string; languageCode: string }> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(input.audio)], { type: input.mimeType }),
    'recording',
  );
  form.append('model', env.SARVAM_STT_MODEL);
  form.append('mode', 'transcribe');
  form.append('language_code', input.languageCode);
  const result = await request<SttResponse>('/speech-to-text', { method: 'POST', body: form });
  return {
    transcript: typeof result.transcript === 'string' ? result.transcript : '',
    languageCode:
      typeof result.language_code === 'string' ? result.language_code : input.languageCode,
  };
}

export async function synthesizeWithSarvam(input: {
  text: string;
  languageCode: string;
  speaker: string;
}): Promise<string> {
  const result = await request<TtsResponse>('/text-to-speech', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: input.text,
      model: env.SARVAM_TTS_MODEL,
      language_code: input.languageCode,
      speaker: input.speaker,
      output_audio_codec: 'wav',
    }),
  });
  if (!Array.isArray(result.audios) || typeof result.audios[0] !== 'string') {
    throw new HttpError(502, 'AI_ERROR', 'Sarvam returned an invalid audio response.');
  }
  return result.audios[0];
}
