import type { TtsRequest, TtsResponse } from '@gram-saathi/shared';
import { isMocked } from '../../config/env';
import { NotImplementedError } from '../../lib/httpError';

/** Optional: the client speaks answers with the browser's speechSynthesis by default. */
export async function synthesizeSpeech(_request: TtsRequest): Promise<TtsResponse> {
  // null tells the client to fall back to browser speech.
  if (isMocked('tts')) return { audioUrl: null };
  // TODO(step-2) (optional): Gemini TTS or Google Cloud TTS for voices phones often lack
  //   (e.g. Marathi). Save the audio file, serve it statically and return its URL.
  throw new NotImplementedError('tts.synthesizeSpeech');
}
