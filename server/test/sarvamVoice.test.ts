import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  globalThis.fetch = originalFetch;
});

async function loadProviders(options: { mocks?: string; stt?: string; tts?: string } = {}) {
  vi.stubEnv('USE_MOCKS', options.mocks ?? 'none');
  vi.stubEnv('STT_PROVIDER', options.stt ?? 'sarvam');
  vi.stubEnv('TTS_PROVIDER', options.tts ?? 'sarvam');
  vi.stubEnv('SARVAM_API_KEY', 'test-key');
  vi.stubEnv('SARVAM_TIMEOUT_MS', '1000');
  vi.resetModules();
  return {
    voice: await import('../src/modules/voice/service.js'),
    tts: await import('../src/modules/tts/service.js'),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Sarvam voice providers', () => {
  it('transcribes audio and sends Saaras multipart fields', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(form.get('model')).toBe('saaras:v3');
      expect(form.get('mode')).toBe('transcribe');
      expect(form.get('language_code')).toBe('mr-IN');
      expect(form.get('file')).toBeInstanceOf(Blob);
      expect(new Headers(init?.headers).get('api-subscription-key')).toBe('test-key');
      return jsonResponse({ transcript: 'नमस्कार', language_code: 'mr-IN' });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { voice } = await loadProviders();
    await expect(
      voice.transcribe({
        audio: Buffer.from([1, 2]),
        mimeType: 'audio/webm;codecs=opus',
        language: 'mr',
      }),
    ).resolves.toMatchObject({
      transcript: 'नमस्कार',
      detectedLanguage: 'mr',
      script: 'Devanagari',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps empty transcripts to NO_SPEECH_DETECTED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ transcript: '', language_code: 'hi-IN' })),
    );
    const { voice } = await loadProviders();
    await expect(
      voice.transcribe({ audio: Buffer.from([1]), mimeType: 'audio/mp4', language: 'hi' }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'NO_SPEECH_DETECTED',
    });
  });

  it('maps authentication failures without exposing response bodies', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ secret: 'do not surface' }, 401));
    vi.stubGlobal('fetch', fetchMock);
    const { voice } = await loadProviders();
    await expect(
      voice.transcribe({ audio: Buffer.from([1]), mimeType: 'audio/wav', language: 'hi' }),
    ).rejects.toMatchObject({
      status: 503,
      code: 'AI_NOT_CONFIGURED',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503])('retries transient HTTP %s errors twice', async (status) => {
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ++attempts < 3
          ? jsonResponse({}, status)
          : jsonResponse({ transcript: 'hello', language_code: 'en-IN' }),
      ),
    );
    const { voice } = await loadProviders();
    await expect(
      voice.transcribe({ audio: Buffer.from([1]), mimeType: 'audio/wav', language: 'en' }),
    ).resolves.toMatchObject({
      transcript: 'hello',
      detectedLanguage: 'en',
    });
    expect(attempts).toBe(3);
  });

  it.each([
    [429, 'AI_RATE_LIMITED'],
    [503, 'AI_UNAVAILABLE'],
  ] as const)('returns an AI error after exhausting HTTP %s retries', async (status, code) => {
    const fetchMock = vi.fn(async () => jsonResponse({}, status));
    vi.stubGlobal('fetch', fetchMock);
    const { voice } = await loadProviders();
    await expect(
      voice.transcribe({ audio: Buffer.from([1]), mimeType: 'audio/wav', language: 'hi' }),
    ).rejects.toMatchObject({ code });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns Bulbul audio as a WAV data URL and caches the result', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ audios: ['d2F2'] }));
    vi.stubGlobal('fetch', fetchMock);
    const { tts } = await loadProviders();
    const request = { text: 'नमस्ते', language: 'hi' as const };
    await expect(tts.synthesizeSpeech(request)).resolves.toEqual({
      audioUrl: 'data:audio/wav;base64,d2F2',
    });
    await tts.synthesizeSpeech(request);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null for overlong text and when the provider is none', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { tts } = await loadProviders();
    await expect(tts.synthesizeSpeech({ text: 'x'.repeat(2501), language: 'hi' })).resolves.toEqual(
      { audioUrl: null },
    );
    const noProvider = await loadProviders({ tts: 'none' });
    await expect(
      noProvider.tts.synthesizeSpeech({ text: 'hello', language: 'en' }),
    ).resolves.toEqual({ audioUrl: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when Bulbul fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, 401)),
    );
    const { tts } = await loadProviders();
    await expect(tts.synthesizeSpeech({ text: 'नमस्ते', language: 'hi' })).resolves.toEqual({
      audioUrl: null,
    });
  });

  it('never calls fetch when voice and TTS mocks are enabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { voice, tts } = await loadProviders({ mocks: 'true' });
    await voice.transcribe({ audio: Buffer.from([1]), mimeType: 'audio/wav', language: 'hi' });
    await expect(tts.synthesizeSpeech({ text: 'hello', language: 'hi' })).resolves.toEqual({
      audioUrl: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
