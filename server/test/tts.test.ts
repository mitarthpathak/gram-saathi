import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  classifyGeminiError,
  extractSpeechAudio,
  setGeminiBackend,
  speechRequestBody,
  synthesizeViaRest,
  type SpeechRequest,
  type SpeechResult,
} from '../src/lib/geminiClient';
import { concatPcm, encodeWav, parseWav } from '../src/lib/wav';
import { MESSAGES } from '../src/modules/chat/messages';
import { getDialectRegistry } from '../src/modules/dialect/registry';
import { dialectRenderEntry } from '../src/modules/dialect/renderConfig';
import {
  isServerSpeechConfigured,
  planSpeech,
  resetTtsState,
  synthesizeSpeech,
  type TtsSettings,
} from '../src/modules/tts/service';
import { cleanTextForSpeech, splitForSpeech } from '../src/modules/tts/speechText';
import { chooseVoice, getTtsVoices } from '../src/modules/tts/voices';

const voices = getTtsVoices();
const settings: Partial<TtsSettings> = {
  mocked: false,
  apiKey: 'test-key',
  model: 'tts-lite',
  dialectModel: 'tts-flash',
  sampleRate: 16_000,
  timeoutMs: 1_000,
  maxChars: 600,
  style: '',
  maxRetries: 0,
  maxDataUrlChars: 3_000_000,
  voices,
};

function wav(ms = 100, sampleRate = 16_000): Buffer {
  const samples = Math.round((sampleRate * ms) / 1000);
  return encodeWav({
    sampleRate,
    channels: 1,
    bitsPerSample: 16,
    data: Buffer.alloc(samples * 2, 7),
  });
}

function httpError(status: number): Error {
  return Object.assign(new Error(`TTS HTTP ${status}`), { status });
}

/** Installs a fake Gemini backend whose speech call runs `speak`; returns the requests it saw. */
function fakeSpeech(
  speak: (request: SpeechRequest) => Promise<SpeechResult> = async () => ({
    audio: wav(),
    mimeType: 'audio/wav',
  }),
): SpeechRequest[] {
  const calls: SpeechRequest[] = [];
  setGeminiBackend({
    generate: async () => {
      throw new Error('generate is not used by TTS');
    },
    embed: async () => {
      throw new Error('embed is not used by TTS');
    },
    synthesize: async (request) => {
      calls.push(request);
      return speak(request);
    },
  });
  return calls;
}

function decode(audioUrl: string | null): Buffer {
  expect(audioUrl).toMatch(/^data:audio\/wav;base64,/);
  return Buffer.from(String(audioUrl).split(',')[1], 'base64');
}

const hindi = MESSAGES.hi.fraudWarning;

beforeEach(() => resetTtsState());
afterEach(() => setGeminiBackend(undefined));

describe('POST /api/tts service', () => {
  it('returns WAV audio with basis "language" on success', async () => {
    const calls = fakeSpeech();
    const result = await synthesizeSpeech({ text: hindi, language: 'hi' }, settings);
    expect(result.basis).toBe('language');
    expect(parseWav(decode(result.audioUrl))?.sampleRate).toBe(16_000);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ model: 'tts-lite', voice: 'Kore', sampleRate: 16_000 });
  });

  it('passes the answer text unchanged, with no instruction added and no style by default', async () => {
    const calls = fakeSpeech();
    await synthesizeSpeech({ text: hindi, language: 'hi' }, settings);
    expect(calls[0].text).toBe(hindi);
    expect(calls[0].style).toBeUndefined();

    resetTtsState();
    await synthesizeSpeech(
      { text: MESSAGES.ta.greeting, language: 'ta' },
      { ...settings, style: 'calm' },
    );
    // The style travels separately (speech_metadata), never inside the text.
    expect(calls[1].text).toBe(MESSAGES.ta.greeting);
    expect(calls[1].style).toBe('calm');
  });

  it('returns no audio when the provider times out', async () => {
    fakeSpeech(() => new Promise<SpeechResult>(() => {}));
    const started = Date.now();
    const result = await synthesizeSpeech(
      { text: hindi, language: 'hi' },
      { ...settings, timeoutMs: 30 },
    );
    expect(result).toEqual({ audioUrl: null, basis: 'none' });
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('returns no audio on 429 and on provider errors', async () => {
    fakeSpeech(async () => {
      throw httpError(429);
    });
    expect(await synthesizeSpeech({ text: hindi, language: 'hi' }, settings)).toEqual({
      audioUrl: null,
      basis: 'none',
    });
    fakeSpeech(async () => {
      throw httpError(503);
    });
    expect(await synthesizeSpeech({ text: hindi, language: 'hi' }, settings)).toEqual({
      audioUrl: null,
      basis: 'none',
    });
  });

  it('drops audio over the payload cap', async () => {
    fakeSpeech(async () => ({ audio: wav(1_000), mimeType: 'audio/wav' }));
    const result = await synthesizeSpeech(
      { text: hindi, language: 'hi' },
      { ...settings, maxDataUrlChars: 10_000 },
    );
    expect(result).toEqual({ audioUrl: null, basis: 'none' });
  });

  it('makes no provider call when mocked, without a key, or with model "none"', async () => {
    const calls = fakeSpeech();
    for (const override of [{ mocked: true }, { apiKey: '' }, { model: 'none' }]) {
      expect(
        await synthesizeSpeech({ text: hindi, language: 'hi' }, { ...settings, ...override }),
      ).toEqual({ audioUrl: null, basis: 'none' });
    }
    expect(calls).toHaveLength(0);
    expect(isServerSpeechConfigured({ mocked: false, apiKey: 'k', model: 'none' })).toBe(false);
    expect(isServerSpeechConfigured({ mocked: false, apiKey: 'k', model: 'tts-lite' })).toBe(true);
  });

  it('uses the dialect model for dialect text and reports the basis honestly', async () => {
    const calls = fakeSpeech();
    const bhojpuri = await synthesizeSpeech(
      { text: hindi, language: 'hi', dialectId: 'bhojpuri' },
      settings,
    );
    expect(calls[0].model).toBe('tts-flash');
    expect(bhojpuri.basis).toBe('named-dialect');

    resetTtsState();
    const braj = await synthesizeSpeech(
      { text: hindi, language: 'hi', dialectId: 'braj' },
      settings,
    );
    expect(calls[1].model).toBe('tts-flash');
    expect(braj.basis).toBe('base-language-approximation');

    resetTtsState();
    await synthesizeSpeech(
      { text: hindi, language: 'hi', dialectId: 'braj' },
      { ...settings, dialectModel: 'none' },
    );
    expect(calls[2].model).toBe('tts-lite');
  });

  it('ignores a dialect of another language', () => {
    const plan = planSpeech({ language: 'ta', dialectId: 'bhojpuri' }, settings as TtsSettings);
    expect(plan).toMatchObject({ dialectId: null, model: 'tts-lite', basis: 'language' });
  });

  it('marks exactly the registry dialects the TTS language table names as named-dialect', () => {
    for (const entry of getDialectRegistry()) {
      const { basis } = planSpeech(
        { language: 'hi', dialectId: entry.id },
        settings as TtsSettings,
      );
      const named = ['bhojpuri', 'awadhi'].includes(entry.id);
      expect(dialectRenderEntry(entry.id).ttsNamedLanguage).toBe(named);
      expect(basis).toBe(named ? 'named-dialect' : 'base-language-approximation');
    }
  });

  it('falls back to 24000 Hz once when the API rejects the configured rate, and remembers it', async () => {
    const calls = fakeSpeech(async (request) => {
      if (request.sampleRate !== 24_000) throw httpError(400);
      return { audio: wav(100, 24_000), mimeType: 'audio/wav' };
    });
    const first = await synthesizeSpeech({ text: hindi, language: 'hi' }, settings);
    expect(parseWav(decode(first.audioUrl))?.sampleRate).toBe(24_000);
    await synthesizeSpeech({ text: MESSAGES.hi.greeting, language: 'hi' }, settings);
    expect(calls.map((call) => call.sampleRate)).toEqual([16_000, 24_000, 24_000]);
  });

  it('does not remember a rate when the fallback rate fails too', async () => {
    const calls = fakeSpeech(async () => {
      throw httpError(400);
    });
    expect((await synthesizeSpeech({ text: hindi, language: 'hi' }, settings)).audioUrl).toBeNull();
    expect(
      (await synthesizeSpeech({ text: MESSAGES.hi.greeting, language: 'hi' }, settings)).audioUrl,
    ).toBeNull();
    expect(calls.map((call) => call.sampleRate)).toEqual([16_000, 24_000, 16_000, 24_000]);
  });

  it('splits long answers at sentence boundaries and joins the audio into one WAV', async () => {
    const pieceBytes = wav(100).length - 44;
    const calls = fakeSpeech();
    const result = await synthesizeSpeech(
      { text: hindi, language: 'hi' },
      { ...settings, maxChars: 100 },
    );
    expect(calls.length).toBeGreaterThan(1);
    expect(calls.every((call) => call.text.length <= 100)).toBe(true);
    expect(calls.map((call) => call.text).join(' ')).toBe(hindi);
    const audio = parseWav(decode(result.audioUrl));
    const gapBytes = 16_000 * 0.25 * 2;
    expect(audio?.data.length).toBe(calls.length * pieceBytes + (calls.length - 1) * gapBytes);
  });

  it('caches audio by text, voice, model and rate', async () => {
    const calls = fakeSpeech();
    const first = await synthesizeSpeech({ text: hindi, language: 'hi' }, settings);
    const second = await synthesizeSpeech({ text: hindi, language: 'hi' }, settings);
    expect(second).toEqual(first);
    expect(calls).toHaveLength(1);
    await synthesizeSpeech({ text: hindi, language: 'hi' }, { ...settings, model: 'other-tts' });
    expect(calls).toHaveLength(2);
  });

  it('strips Markdown and emoji before synthesis, and skips text that is only emoji', async () => {
    const calls = fakeSpeech();
    await synthesizeSpeech(
      { text: `**ज़रूरी:** ${MESSAGES.hi.greeting} 🙏🏽`, language: 'hi' },
      settings,
    );
    expect(calls[0].text).toBe(`ज़रूरी: ${MESSAGES.hi.greeting}`);
    expect(await synthesizeSpeech({ text: '🙏 👍', language: 'hi' }, settings)).toEqual({
      audioUrl: null,
      basis: 'none',
    });
    expect(calls).toHaveLength(1);
  });

  it('wraps raw 16-bit PCM in a WAV header and refuses other headerless encodings', async () => {
    fakeSpeech(async () => ({ audio: Buffer.alloc(3_200, 1), mimeType: 'audio/l16' }));
    const pcm = await synthesizeSpeech({ text: hindi, language: 'hi' }, settings);
    expect(parseWav(decode(pcm.audioUrl))).toMatchObject({
      sampleRate: 16_000,
      channels: 1,
      bitsPerSample: 16,
    });

    resetTtsState();
    fakeSpeech(async () => ({ audio: Buffer.alloc(3_200, 1), mimeType: 'audio/mulaw' }));
    expect(await synthesizeSpeech({ text: hindi, language: 'hi' }, settings)).toEqual({
      audioUrl: null,
      basis: 'none',
    });
  });
});

describe('speech text preparation', () => {
  it('leaves plain answers, numbers, URLs and Indic joiners untouched', () => {
    for (const text of [
      hindi,
      MESSAGES.mr.notFound,
      MESSAGES.ta.fraudWarning,
      'क्‍ष 1.5 pmkisan.gov.in',
    ]) {
      expect(cleanTextForSpeech(text)).toBe(text);
    }
  });

  it('removes Markdown markers but keeps link targets', () => {
    expect(
      cleanTextForSpeech(
        '## Steps\n- Go to the **CSC**\n- See [the portal](https://pmkisan.gov.in/)',
      ),
    ).toBe('Steps Go to the CSC See the portal https://pmkisan.gov.in/');
  });

  it('splits only where a sentence or clause ends', () => {
    const pieces = splitForSpeech(MESSAGES.en.fraudWarning, 80);
    expect(pieces.every((piece) => piece.length <= 80)).toBe(true);
    expect(pieces.join(' ')).toBe(MESSAGES.en.fraudWarning);
    expect(pieces.some((piece) => piece.endsWith('.gov'))).toBe(false);
    expect(splitForSpeech('short', 80)).toEqual(['short']);
  });
});

describe('voices config', () => {
  it('has a voice for every language and only registry dialects', () => {
    const ids = new Set(getDialectRegistry().map((entry) => entry.id));
    for (const id of Object.keys(voices.dialects)) expect(ids.has(id)).toBe(true);
    for (const language of ['hi', 'mr', 'ta', 'en'] as const) {
      expect(chooseVoice(language, null, voices).voice).toBeTruthy();
    }
  });

  it('prefers a dialect voice and a voiceId over a prebuilt name', () => {
    const custom = {
      languages: voices.languages,
      dialects: {
        braj: { voice: 'Kore', voiceId: 'voice_owner_made', status: 'auditioned' as const },
      },
    };
    expect(chooseVoice('hi', 'braj', custom)).toMatchObject({
      voice: 'voice_owner_made',
      source: 'dialects.braj',
    });
    expect(chooseVoice('hi', 'awadhi', custom).source).toBe('languages.hi');
  });
});

describe('Gemini speech request (REST)', () => {
  const request: SpeechRequest = {
    model: 'tts-lite',
    text: hindi,
    voice: 'Kore',
    sampleRate: 16_000,
    timeoutMs: 1_000,
  };

  it('builds the documented body, with style only when set', () => {
    const body = speechRequestBody(request) as {
      input: Array<{ type: string; content: Array<Record<string, unknown>> }>;
      response_format: unknown;
      generation_config: unknown;
    };
    expect(body.input[0].type).toBe('user_input');
    expect(body.input[0].content[0]).toEqual({ type: 'text', text: hindi });
    expect(body.response_format).toEqual({
      type: 'audio',
      mime_type: 'audio/wav',
      sample_rate: 16_000,
    });
    expect(body.generation_config).toEqual({ speech_config: [{ voice: 'Kore' }] });
    const styled = speechRequestBody({ ...request, style: 'calm' }) as typeof body;
    expect(styled.input[0].content[0].annotations).toEqual([
      { type: 'speech_metadata', style: 'calm' },
    ]);
  });

  it('reads audio from the REST steps shape and the SDK output_audio shape', () => {
    expect(
      extractSpeechAudio({
        steps: [
          {
            type: 'model_output',
            content: [{ type: 'audio', data: 'AQID', mime_type: 'audio/wav' }],
          },
        ],
      }),
    ).toEqual({ data: 'AQID', mimeType: 'audio/wav' });
    expect(extractSpeechAudio({ output_audio: { data: 'AQID' } })).toEqual({
      data: 'AQID',
      mimeType: undefined,
    });
    expect(extractSpeechAudio({ steps: [] })).toBeUndefined();
  });

  it('sends the key in a header and maps HTTP errors to Gemini error kinds', async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const ok: typeof fetch = async (url, init) => {
      seen = { url: String(url), init };
      return new Response(
        JSON.stringify({
          status: 'completed',
          steps: [
            { type: 'model_output', content: [{ type: 'audio', data: wav().toString('base64') }] },
          ],
        }),
        { status: 200 },
      );
    };
    const result = await synthesizeViaRest('test-key', request, ok);
    expect(seen?.url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(seen?.init?.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
    expect(JSON.parse(String(seen?.init?.body)).input[0].content[0].text).toBe(hindi);
    expect(parseWav(result.audio)?.sampleRate).toBe(16_000);

    for (const [status, kind] of [
      [429, 'rate_limited'],
      [503, 'unavailable'],
      [400, 'bad_request'],
      [403, 'auth'],
    ] as const) {
      const failing: typeof fetch = async () => new Response('{}', { status });
      const error = await synthesizeViaRest('test-key', request, failing).catch(
        (caught: unknown) => caught,
      );
      expect(classifyGeminiError(error)?.kind).toBe(kind);
    }
    const empty: typeof fetch = async () =>
      new Response(JSON.stringify({ status: 'completed', steps: [] }));
    const blocked = await synthesizeViaRest('test-key', request, empty).catch(
      (caught: unknown) => caught,
    );
    expect(classifyGeminiError(blocked)?.kind).toBe('blocked');
  });
});

describe('WAV helpers', () => {
  it('round-trips and concatenates PCM', () => {
    const clip = parseWav(wav(50));
    expect(clip).toBeDefined();
    const joined = concatPcm([clip!, clip!], 100);
    expect(joined?.data.length).toBe(clip!.data.length * 2 + 16_000 * 0.1 * 2);
    expect(concatPcm([clip!, { ...clip!, sampleRate: 24_000 }])).toBeUndefined();
    expect(parseWav(Buffer.from('not a wav'))).toBeUndefined();
  });
});
