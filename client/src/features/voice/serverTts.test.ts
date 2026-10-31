import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class TestApiError extends Error {
    readonly status: number;

    constructor(status: number) {
      super(`HTTP ${status}`);
      this.status = status;
    }
  }

  return {
    api: { tts: vi.fn() },
    config: { useMocks: false },
    storage: { get: vi.fn(() => null as string | null) },
    TestApiError,
  };
});

vi.mock('@/lib/api', () => ({ api: mocks.api, ApiError: mocks.TestApiError }));
vi.mock('@/lib/config', () => ({ config: mocks.config }));
vi.mock('@/lib/storage', () => ({ storage: mocks.storage }));

async function loadFetcher() {
  vi.resetModules();
  return (await import('./serverTts')).fetchServerTts;
}

beforeEach(() => {
  mocks.api.tts.mockReset();
  mocks.config.useMocks = false;
  mocks.storage.get.mockReturnValue(null);
});

describe('fetchServerTts', () => {
  it('caches by language and text and de-dupes concurrent requests', async () => {
    let resolveRequest!: (value: { audioUrl: string }) => void;
    mocks.api.tts.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const fetchServerTts = await loadFetcher();
    const first = fetchServerTts('नमस्ते', 'hi');
    const duplicate = fetchServerTts('नमस्ते', 'hi');
    expect(mocks.api.tts).toHaveBeenCalledTimes(1);
    resolveRequest({ audioUrl: 'data:audio/wav;base64,abc' });
    await expect(Promise.all([first, duplicate])).resolves.toEqual([
      'data:audio/wav;base64,abc',
      'data:audio/wav;base64,abc',
    ]);
    await expect(fetchServerTts('नमस्ते', 'hi')).resolves.toBe('data:audio/wav;base64,abc');
    await fetchServerTts('नमस्ते', 'mr');
    expect(mocks.api.tts).toHaveBeenCalledTimes(2);
  });

  it('stops contacting the server after it returns a null audio URL', async () => {
    mocks.api.tts.mockResolvedValue({ audioUrl: null });
    const fetchServerTts = await loadFetcher();
    await expect(fetchServerTts('first', 'hi')).resolves.toBeNull();
    await expect(fetchServerTts('different text', 'en')).resolves.toBeNull();
    expect(mocks.api.tts).toHaveBeenCalledTimes(1);
  });

  it('marks the server unavailable after a non-retryable API error', async () => {
    mocks.api.tts.mockRejectedValue(new mocks.TestApiError(401));
    const fetchServerTts = await loadFetcher();
    await expect(fetchServerTts('first', 'hi')).resolves.toBeNull();
    await expect(fetchServerTts('second', 'hi')).resolves.toBeNull();
    expect(mocks.api.tts).toHaveBeenCalledTimes(1);
  });

  it('does not mark transient API failures unavailable', async () => {
    mocks.api.tts.mockRejectedValueOnce(new mocks.TestApiError(503));
    mocks.api.tts.mockResolvedValue({ audioUrl: 'https://example.test/voice.wav' });
    const fetchServerTts = await loadFetcher();
    await expect(fetchServerTts('first', 'hi')).resolves.toBeNull();
    await expect(fetchServerTts('second', 'hi')).resolves.toBe('https://example.test/voice.wav');
    expect(mocks.api.tts).toHaveBeenCalledTimes(2);
  });

  it('skips the API when browser mocks or low-bandwidth mode is enabled', async () => {
    const fetchServerTts = await loadFetcher();
    mocks.config.useMocks = true;
    await expect(fetchServerTts('mocked', 'hi')).resolves.toBeNull();
    mocks.config.useMocks = false;
    mocks.storage.get.mockReturnValue('true');
    await expect(fetchServerTts('low data', 'hi')).resolves.toBeNull();
    expect(mocks.api.tts).not.toHaveBeenCalled();
  });
});
