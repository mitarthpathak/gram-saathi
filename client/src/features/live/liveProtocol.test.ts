import { describe, expect, it } from 'vitest';
import { convertToPcm16, parseLiveMessage } from './liveProtocol';

describe('convertToPcm16', () => {
  it('clips samples and writes little-endian signed PCM16', () => {
    const buffer = convertToPcm16(new Float32Array([-1, 0, 1]));
    const view = new DataView(buffer);

    expect(view.getInt16(0, true)).toBe(-32_768);
    expect(view.getInt16(2, true)).toBe(0);
    expect(view.getInt16(4, true)).toBe(32_767);
  });

  it('resamples mono audio to 16 kHz', () => {
    const buffer = convertToPcm16(new Float32Array([0, 0.5, -0.5, 1]), 32_000);
    const pcm = new Int16Array(buffer);

    expect(pcm).toHaveLength(2);
    expect(Array.from(pcm)).toEqual([0, -16_384]);
  });
});

describe('parseLiveMessage', () => {
  it('parses captions, tool calls, audio, interruption, and turn completion together', () => {
    const events = parseLiveMessage(
      JSON.stringify({
        serverContent: {
          modelTurn: {
            parts: [{ inlineData: { data: 'AQI=', mimeType: 'audio/pcm;rate=24000' } }],
          },
          inputTranscription: { text: 'Hello', finished: true },
          outputTranscription: { text: 'Hi there', finished: false },
          interrupted: true,
          turnComplete: true,
        },
        toolCall: {
          functionCalls: [
            { id: 'call-1', name: 'ask_gram_saathi', args: { question: 'scheme help' } },
          ],
        },
      }),
    );

    expect(events).toEqual([
      {
        type: 'toolCall',
        id: 'call-1',
        name: 'ask_gram_saathi',
        args: { question: 'scheme help' },
      },
      { type: 'audio', data: 'AQI=', mimeType: 'audio/pcm;rate=24000' },
      { type: 'inputTranscription', text: 'Hello', finished: true },
      { type: 'outputTranscription', text: 'Hi there', finished: false },
      { type: 'interrupted' },
      { type: 'turnComplete' },
    ]);
  });

  it('ignores malformed JSON and tolerates unknown messages', () => {
    expect(parseLiveMessage('{')).toEqual([]);
    expect(parseLiveMessage({ unexpected: true })).toEqual([]);
  });
});
