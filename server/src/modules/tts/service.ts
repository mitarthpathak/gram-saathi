import type { TtsRequest, TtsResponse } from '@gram-saathi/shared';
import { env, isMocked } from '../../config/env';
import { synthesizeWithSarvam } from '../../lib/sarvamClient';

const CACHE_LIMIT = 100;
const audioCache = new Map<string, string>();

/** Optional: the client speaks answers with the browser's speechSynthesis by default. */
export async function synthesizeSpeech(request: TtsRequest): Promise<TtsResponse> {
  // null tells the client to fall back to browser speech.
  if (isMocked('tts')) return { audioUrl: null };
  if (env.TTS_PROVIDER !== 'sarvam' || request.text.length > 2500) return { audioUrl: null };
  const languageCode =
    request.language === 'mr'
      ? 'mr-IN'
      : request.language === 'ta'
        ? 'ta-IN'
        : request.language === 'en'
          ? 'en-IN'
          : 'hi-IN';
  const key = JSON.stringify([languageCode, env.SARVAM_TTS_SPEAKER, request.text]);
  const cached = audioCache.get(key);
  if (cached) {
    audioCache.delete(key);
    audioCache.set(key, cached);
    return { audioUrl: cached };
  }
  try {
    const audio = await synthesizeWithSarvam({
      text: request.text,
      languageCode,
      speaker: env.SARVAM_TTS_SPEAKER,
    });
    const audioUrl = `data:audio/wav;base64,${audio}`;
    audioCache.set(key, audioUrl);
    if (audioCache.size > CACHE_LIMIT) audioCache.delete(audioCache.keys().next().value!);
    return { audioUrl };
  } catch {
    return { audioUrl: null };
  }
}
