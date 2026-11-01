import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/evalHarness.test.ts'],
    env: { NODE_ENV: 'development' },
  },
});
