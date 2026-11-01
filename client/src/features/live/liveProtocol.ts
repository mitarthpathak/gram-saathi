export const LIVE_INPUT_RATE = 16_000;
export const LIVE_OUTPUT_RATE = 24_000;

export type LiveEvent =
  | { type: 'setupComplete' }
  | { type: 'inputTranscription'; text: string; finished: boolean }
  | { type: 'outputTranscription'; text: string; finished: boolean }
  | { type: 'audio'; data: string; mimeType: string }
  | { type: 'toolCall'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'interrupted' }
  | { type: 'turnComplete' }
  | { type: 'goAway'; timeLeft?: string }
  | { type: 'error'; message?: string };

/** Parse one raw server message. The API may bundle captions, audio, and turn flags together. */
export function parseLiveMessage(raw: unknown): LiveEvent[] {
  let message: Record<string, unknown>;
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    message = value as Record<string, unknown>;
  } catch {
    return [];
  }

  const events: LiveEvent[] = [];
  if (message.setupComplete) events.push({ type: 'setupComplete' });

  const toolCall = asRecord(message.toolCall);
  const functionCalls = Array.isArray(toolCall?.functionCalls) ? toolCall.functionCalls : [];
  for (const call of functionCalls) {
    const item = asRecord(call);
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') continue;
    events.push({
      type: 'toolCall',
      id: item.id,
      name: item.name,
      args: asRecord(item.args) ?? {},
    });
  }

  const serverContent = asRecord(message.serverContent);
  const modelTurn = asRecord(serverContent?.modelTurn);
  const parts = Array.isArray(modelTurn?.parts) ? modelTurn.parts : [];
  for (const part of parts) {
    const inlineData = asRecord(asRecord(part)?.inlineData);
    if (typeof inlineData?.data === 'string') {
      events.push({
        type: 'audio',
        data: inlineData.data,
        mimeType:
          typeof inlineData.mimeType === 'string' ? inlineData.mimeType : 'audio/pcm;rate=24000',
      });
    }
  }

  const input = asRecord(serverContent?.inputTranscription);
  if (typeof input?.text === 'string') {
    events.push({
      type: 'inputTranscription',
      text: input.text,
      finished: input.finished === true,
    });
  }
  const output = asRecord(serverContent?.outputTranscription);
  if (typeof output?.text === 'string') {
    events.push({
      type: 'outputTranscription',
      text: output.text,
      finished: output.finished === true,
    });
  }
  if (serverContent?.interrupted === true) events.push({ type: 'interrupted' });
  if (serverContent?.turnComplete === true) events.push({ type: 'turnComplete' });

  const goAway = asRecord(message.goAway);
  if (goAway) {
    events.push({
      type: 'goAway',
      ...(typeof goAway.timeLeft === 'string' ? { timeLeft: goAway.timeLeft } : {}),
    });
  }
  const error = asRecord(message.error);
  if (error)
    events.push({
      type: 'error',
      ...(typeof error.message === 'string' ? { message: error.message } : {}),
    });
  return events;
}

/** Convert mono Float32 audio into little-endian PCM16 at 16 kHz. */
export function convertToPcm16(samples: Float32Array, sampleRate = LIVE_INPUT_RATE): ArrayBuffer {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0)
    throw new RangeError('Invalid audio sample rate');
  const outputLength = Math.max(0, Math.floor((samples.length * LIVE_INPUT_RATE) / sampleRate));
  const pcm = new Int16Array(outputLength);
  const ratio = sampleRate / LIVE_INPUT_RATE;
  for (let index = 0; index < outputLength; index++) {
    const position = index * ratio;
    const left = Math.min(Math.floor(position), samples.length - 1);
    const right = Math.min(left + 1, samples.length - 1);
    const fraction = position - left;
    const sample = Math.max(
      -1,
      Math.min(1, samples[left] + (samples[right] - samples[left]) * fraction),
    );
    pcm[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return pcm.buffer;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
