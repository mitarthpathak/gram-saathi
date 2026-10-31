import { once } from 'node:events';
import { Blob } from 'node:buffer';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/createApp';
import { setGeminiBackend } from '../src/lib/geminiClient';
import { fakeGemini } from './fakeGemini';

afterEach(() => setGeminiBackend(undefined));

describe('POST /api/dialect/transcribe', () => {
  it('returns the exact transcript and stable script category', async () => {
    const transcript = 'verbatim transcript fixture';
    setGeminiBackend(
      fakeGemini(() => ({
        transcript,
        detectedLanguage: 'hi',
        script: 'Devanagari and Latin',
      })),
    );
    const { server, origin } = await startServer();
    try {
      const form = audioForm();
      const response = await fetch(`${origin}/api/dialect/transcribe`, {
        method: 'POST',
        body: form,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ transcript, script: 'mixed' });
    } finally {
      server.close();
      await once(server, 'close');
    }
  });

  it('uses the voice endpoint no-speech error code', async () => {
    setGeminiBackend(
      fakeGemini(() => ({ transcript: '', detectedLanguage: 'hi', script: 'Devanagari' })),
    );
    const { server, origin } = await startServer();
    try {
      const response = await fetch(`${origin}/api/dialect/transcribe`, {
        method: 'POST',
        body: audioForm(),
      });
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ error: { code: 'NO_SPEECH_DETECTED' } });
    } finally {
      server.close();
      await once(server, 'close');
    }
  });
});

function audioForm(): FormData {
  const form = new FormData();
  form.append('audio', new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }), 'clip.wav');
  return form;
}

async function startServer(): Promise<{
  server: ReturnType<ReturnType<typeof createApp>['listen']>;
  origin: string;
}> {
  const server = createApp().listen(0);
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  return { server, origin: `http://127.0.0.1:${address.port}` };
}
