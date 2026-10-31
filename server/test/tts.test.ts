import { describe, expect, it, vi } from 'vitest';
import { synthesizeSpeech } from '../src/modules/tts/service';

const request = { text: 'नमस्ते', language: 'hi' as const };

describe('optional Gemini TTS', () => {
  it('returns a WAV data URL when the provider returns audio', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ output_audio: { data: 'AQID' } }), { status: 200 }));
    const result = await synthesizeSpeech(request, { fetcher, model: 'configured-model', apiKey: 'test-key' });
    expect(result.audioUrl).toBe('data:audio/wav;base64,AQID');
    const [, init] = fetcher.mock.calls[0];
    expect(init?.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
    expect(String(init?.body)).toContain('नमस्ते');
  });

  it('returns no audio on timeout', async () => {
    const fetcher: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
    expect(await synthesizeSpeech(request, { fetcher, model: 'configured-model', apiKey: 'test-key', timeoutMs: 5 })).toEqual({ audioUrl: null });
  });

  it('returns no audio on provider errors or malformed audio response', async () => {
    const providerError: typeof fetch = async () => new Response('unavailable', { status: 503 });
    const malformed: typeof fetch = async () => new Response(JSON.stringify({ output_audio: { data: '' } }), { status: 200 });
    expect(await synthesizeSpeech(request, { fetcher: providerError, model: 'configured-model', apiKey: 'test-key' })).toEqual({ audioUrl: null });
    expect(await synthesizeSpeech(request, { fetcher: malformed, model: 'configured-model', apiKey: 'test-key' })).toEqual({ audioUrl: null });
  });

  it('returns no audio when no provider is configured or TTS is mocked', async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(await synthesizeSpeech(request, { fetcher, model: '', apiKey: 'test-key' })).toEqual({ audioUrl: null });
    expect(await synthesizeSpeech(request, { fetcher, model: 'configured-model', apiKey: 'test-key', mocked: true })).toEqual({ audioUrl: null });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
