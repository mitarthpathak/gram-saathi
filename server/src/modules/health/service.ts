import type { HealthResponse } from '@gram-saathi/shared';
import { env, isMocked } from '../../config/env';

export function getHealthStatus(): HealthResponse {
  // `mocks` is true when any module serves mock data, so the UI can show a "demo data" badge.
  return {
    status: 'ok',
    mocks: env.USE_MOCKS.size > 0,
    dialectConfigured: !isMocked('dialect') && Boolean(env.GEMINI_API_KEY),
    ttsConfigured:
      !isMocked('tts') && Boolean(env.GEMINI_API_KEY && env.GEMINI_TTS_MODEL),
  };
}
