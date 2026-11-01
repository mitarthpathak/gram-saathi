import type { TtsRequest, TtsResponse } from '@gram-saathi/shared';
import { env, isMocked } from '../../config/env';
import { logger } from '../../lib/logger';
import { synthesizeWithSarvam } from '../../lib/sarvamClient';

export interface TtsDependencies {
  fetcher?: typeof fetch;
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
  mocked?: boolean;
}

const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const sarvamAudioCache = new Map<string, string>();

/** Optional Gemini TTS. Any absent provider or provider failure returns the browser fallback form. */
export async function synthesizeSpeech(
  request: TtsRequest,
  dependencies: TtsDependencies = {},
): Promise<TtsResponse> {
  if (dependencies.mocked ?? isMocked('tts')) return { audioUrl: null };
  if (env.TTS_PROVIDER === 'none') return { audioUrl: null };
  if (env.TTS_PROVIDER === 'sarvam') {
    if (request.text.length > 2500) return { audioUrl: null };
    const languageCode =
      request.language === 'mr'
        ? 'mr-IN'
        : request.language === 'ta'
          ? 'ta-IN'
          : request.language === 'en'
          ? 'en-IN'
          : 'hi-IN';
    const key = JSON.stringify([languageCode, env.SARVAM_TTS_SPEAKER, request.text]);
    const cached = sarvamAudioCache.get(key);
    if (cached) {
      sarvamAudioCache.delete(key);
      sarvamAudioCache.set(key, cached);
      return { audioUrl: cached };
    }
    try {
      const audio = await synthesizeWithSarvam({
        text: request.text,
        languageCode,
        speaker: env.SARVAM_TTS_SPEAKER,
      });
      const audioUrl = `data:audio/wav;base64,${audio}`;
      sarvamAudioCache.set(key, audioUrl);
      if (sarvamAudioCache.size > 100) sarvamAudioCache.delete(sarvamAudioCache.keys().next().value!);
      return { audioUrl };
    } catch {
      return { audioUrl: null };
    }
  }
  const model = dependencies.model ?? env.GEMINI_TTS_MODEL;
  const apiKey = dependencies.apiKey ?? env.GEMINI_API_KEY;
  if (!model || !apiKey) return { audioUrl: null };

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    dependencies.timeoutMs ?? env.GEMINI_TTS_TIMEOUT_MS,
  );
  try {
    const response = await (dependencies.fetcher ?? fetch)(GEMINI_INTERACTIONS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: [
          {
            type: 'user_input',
            content: [
              {
                type: 'text',
                text: request.text,
                annotations: [{ type: 'speech_metadata', style: 'warm, clear, conversational' }],
              },
            ],
          },
        ],
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice: 'Kore' }] },
      }),
    });
    if (!response.ok) {
      logger.warn(`TTS provider returned HTTP ${response.status}; using browser speech`);
      return { audioUrl: null };
    }
    const payload: unknown = await response.json();
    const base64 = extractAudioBase64(payload);
    return base64 ? { audioUrl: `data:audio/wav;base64,${base64}` } : { audioUrl: null };
  } catch {
    const timedOut = controller.signal.aborted;
    logger.warn(
      timedOut
        ? 'TTS provider timed out; using browser speech'
        : 'TTS provider failed; using browser speech',
    );
    return { audioUrl: null };
  } finally {
    clearTimeout(timeout);
  }
}

function extractAudioBase64(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const object = payload as Record<string, unknown>;
  const outputAudio = object.output_audio;
  if (typeof outputAudio === 'object' && outputAudio !== null) {
    const data = (outputAudio as Record<string, unknown>).data;
    if (typeof data === 'string' && data.length > 0) return data;
  }
  if (!Array.isArray(object.steps)) return undefined;
  for (const step of object.steps) {
    if (typeof step !== 'object' || step === null) continue;
    const content = (step as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (typeof item !== 'object' || item === null) continue;
      const block = item as Record<string, unknown>;
      if (block.type === 'audio' && typeof block.data === 'string' && block.data.length > 0)
        return block.data;
    }
  }
  return undefined;
}
