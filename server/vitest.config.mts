import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Tests never read .env (see src/config/env.ts) and never call Gemini: they install a fake
    // backend. Everything else they rely on is fixed here.
    env: {
      NODE_ENV: 'test',
      USE_MOCKS: 'false',
      GEMINI_API_KEY: '',
      GEMINI_MAX_RETRIES: '0',
      RAG_TOP_K: '4',
      RAG_MIN_SCORE: '0.5',
      RAG_TRANSLATE_QUERY: 'false',
      SMS_MAX_SEGMENTS: '2',
      CACHE_MAX_ENTRIES: '100',
    },
  },
});
