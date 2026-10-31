import { afterEach, describe, expect, it, vi } from 'vitest';

describe('mock mode answerStyle', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('marks mock answers as standard language', async () => {
    vi.stubEnv('USE_MOCKS', 'true');
    vi.resetModules();
    const { answerQuestion } = await import('../src/modules/chat/service.js');
    const plain = await answerQuestion({
      text: 'पीएम किसान योजना में साल में कितना पैसा मिलता है?',
      language: 'hi',
      sessionId: 'mock',
    });
    expect(plain.answerStyle).toEqual({
      language: 'hi',
      dialectId: null,
      rendered: 'standard',
      reason: 'no_dialect',
    });
    const hinted = await answerQuestion({
      text: 'पीएम किसान योजना में साल में कितना पैसा मिलता है?',
      language: 'hi',
      dialectHint: 'braj',
      sessionId: 'mock',
    });
    expect(hinted.answerStyle).toEqual({
      language: 'hi',
      dialectId: 'braj',
      rendered: 'standard',
      reason: 'render_off',
    });
    expect(hinted.answer).toBe(plain.answer);
  });
});
