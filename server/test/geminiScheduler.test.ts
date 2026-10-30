import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { geminiConcurrencyState, withGeminiConcurrency } from '../src/lib/geminiScheduler';

describe('Gemini answer-priority concurrency queue', () => {
  it('reserves one slot for answer work when classifier requests fill their limit', async () => {
    const started: string[] = [];
    const releases: Array<() => void> = [];
    const hold = (name: string) =>
      withGeminiConcurrency('dialect', () => {
        started.push(name);
        return new Promise<void>((resolve) => releases.push(resolve));
      });

    const dialectJobs = Array.from({ length: env.GEMINI_MAX_CONCURRENT_CALLS }, (_, index) =>
      hold(`dialect-${index}`),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(started).toHaveLength(env.GEMINI_MAX_CONCURRENT_CALLS - 1);
    expect(geminiConcurrencyState().queuedDialect).toBe(1);

    const answerJob = withGeminiConcurrency('answer', () => {
      started.push('answer');
      return new Promise<void>((resolve) => releases.push(resolve));
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(started.at(-1)).toBe('answer');
    expect(geminiConcurrencyState().active).toBe(env.GEMINI_MAX_CONCURRENT_CALLS);

    for (const release of releases.splice(0)) release();
    await new Promise<void>((resolve) => setImmediate(resolve));
    for (const release of releases.splice(0)) release();
    await Promise.all([...dialectJobs, answerJob]);
    expect(geminiConcurrencyState().active).toBe(0);
    expect(geminiConcurrencyState().queuedDialect).toBe(0);
  });
});
