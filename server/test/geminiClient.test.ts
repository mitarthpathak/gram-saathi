import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  classifyGeminiError,
  GeminiError,
  generateJson,
  setGeminiBackend,
  withRetries,
} from '../src/lib/geminiClient';
import { fakeGemini } from './fakeGemini';

afterEach(() => setGeminiBackend(undefined));

describe('classifyGeminiError', () => {
  it('maps API errors to typed kinds with HTTP status and retry hints', () => {
    const limited = classifyGeminiError({ status: 429, message: '{"retryDelay": "17s"}' });
    expect(limited).toMatchObject({
      kind: 'rate_limited',
      status: 429,
      code: 'AI_RATE_LIMITED',
      retryAfterMs: 17_000,
      retryable: true,
    });
    expect(classifyGeminiError({ status: 503, message: 'overloaded' })).toMatchObject({
      kind: 'unavailable',
      status: 503,
      retryable: true,
    });
    expect(classifyGeminiError({ status: 400, message: 'bad' })).toMatchObject({
      kind: 'bad_request',
      status: 502,
      retryable: false,
    });
    expect(classifyGeminiError({ status: 403, message: 'denied' })).toMatchObject({
      kind: 'auth',
      code: 'AI_NOT_CONFIGURED',
    });
    expect(
      classifyGeminiError({ name: 'APIConnectionTimeoutError', message: 'slow' }),
    ).toMatchObject({ kind: 'timeout', status: 504 });
  });

  it('leaves errors that are not from the API alone', () => {
    expect(classifyGeminiError(new TypeError('bug in our code'))).toBeUndefined();
  });
});

describe('withRetries', () => {
  const sleep = vi.fn(async () => {});

  it('retries transient errors with growing waits, then succeeds', async () => {
    sleep.mockClear();
    let attempts = 0;
    const result = await withRetries(
      async () => {
        attempts++;
        if (attempts < 3) throw { status: 503, message: 'overloaded' };
        return 'ok';
      },
      { label: 'test', maxRetries: 3, sleep },
    );
    expect(result).toBe('ok');
    expect(sleep).toHaveBeenCalledTimes(2);
    const [[first], [second]] = sleep.mock.calls as unknown as [[number], [number]];
    expect(second).toBeGreaterThan(first * 0.9);
  });

  it('waits at least as long as a 429 asks', async () => {
    sleep.mockClear();
    let attempts = 0;
    await withRetries(
      async () => {
        if (attempts++ === 0) throw { status: 429, message: '"retryDelay": "7s"' };
        return 'ok';
      },
      { label: 'test', maxRetries: 2, sleep },
    );
    expect(sleep).toHaveBeenCalledWith(7000);
  });

  it('gives up after maxRetries and does not retry client errors or bugs', async () => {
    const unavailable = () => Promise.reject({ status: 503, message: 'down' });
    await expect(
      withRetries(unavailable, { label: 't', maxRetries: 1, sleep }),
    ).rejects.toBeInstanceOf(GeminiError);

    sleep.mockClear();
    await expect(
      withRetries(() => Promise.reject({ status: 400, message: 'bad' }), {
        label: 't',
        maxRetries: 3,
        sleep,
      }),
    ).rejects.toMatchObject({ kind: 'bad_request' });
    await expect(
      withRetries(() => Promise.reject(new TypeError('bug')), { label: 't', maxRetries: 3, sleep }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('generateJson', () => {
  const schema = z.object({ answer: z.string() });

  it('parses JSON (even inside a Markdown fence) and validates it', async () => {
    setGeminiBackend(fakeGemini(() => '```json\n{"answer": "हाँ"}\n```'));
    expect(await generateJson({ label: 't', input: 'q', schema })).toEqual({ answer: 'हाँ' });
  });

  it('sends the schema to the model as JSON Schema', async () => {
    const fake = fakeGemini(() => ({ answer: 'ok' }));
    setGeminiBackend(fake);
    await generateJson({ label: 't', input: 'q', schema });
    expect(fake.calls[0].jsonSchema).toMatchObject({ type: 'object', required: ['answer'] });
    expect(fake.calls[0].jsonSchema).not.toHaveProperty('$schema');
  });

  it('rejects output that does not match the schema', async () => {
    setGeminiBackend(fakeGemini(() => ({ wrong: true })));
    await expect(generateJson({ label: 't', input: 'q', schema })).rejects.toMatchObject({
      kind: 'bad_response',
      code: 'AI_ERROR',
    });
  });

  it('does not include malformed model output in error messages', async () => {
    const transcript = 'private transcript fixture';
    setGeminiBackend(fakeGemini(() => transcript));
    try {
      await generateJson({ label: 't', input: 'q', schema });
      throw new Error('expected invalid JSON to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(transcript);
      expect((error as Error).message).toContain('Gemini returned invalid JSON');
    }
  });

  it('reports a missing API key as 503 AI_NOT_CONFIGURED', async () => {
    await expect(generateJson({ label: 't', input: 'q', schema })).rejects.toMatchObject({
      status: 503,
      code: 'AI_NOT_CONFIGURED',
    });
  });
});
