import { createServer, type Server } from 'node:http';
import express from 'express';
import type { AuthToken, CreateAuthTokenParameters } from '@google/genai';
import type { LiveTokenRequest } from '@gram-saathi/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler';
import { createLiveRouter } from '../src/modules/live/routes';
import { createLiveToken, type LiveTokenServiceDeps } from '../src/modules/live/service';

const request: LiveTokenRequest = {
  sessionId: 'test-session',
  language: 'hi',
  dialectHint: 'braj',
};
const token: AuthToken = {
  name: 'ephemeral-test-token',
  expireTime: '2026-10-31T10:10:00.000Z',
  newSessionExpireTime: '2026-10-31T10:01:00.000Z',
};

function serviceDeps(overrides: Partial<LiveTokenServiceDeps> = {}) {
  let params: CreateAuthTokenParameters | undefined;
  let createCalls = 0;
  const deps: LiveTokenServiceDeps = {
    isMocked: () => false,
    apiKey: 'test-key-not-returned',
    model: 'gemini-test-live',
    voice: 'Kore',
    tokenTtlSeconds: 600,
    timeoutMs: 15_000,
    createClient: () => ({
      authTokens: {
        async create(input) {
          createCalls++;
          params = input;
          return token;
        },
      },
    }),
    getDialectExamples: () => ['consented example'],
    now: () => new Date('2026-10-31T10:00:00.000Z'),
    ...overrides,
  };
  return { deps, getParams: () => params, getCreateCalls: () => createCalls };
}

describe('Gemini Live token service', () => {
  it('returns the token response shape without exposing the API key', async () => {
    const fake = serviceDeps();
    const response = await createLiveToken(request, fake.deps);

    expect(response).toEqual({
      token: token.name,
      model: 'gemini-test-live',
      expiresAt: token.expireTime,
      newSessionExpiresAt: token.newSessionExpireTime,
      mock: false,
    });
    expect(JSON.stringify(response)).not.toContain('test-key-not-returned');
  });

  it('locks model, audio, voice, transcriptions, tool, and system instruction', async () => {
    const fake = serviceDeps();
    await createLiveToken(request, fake.deps);
    const config = fake.getParams()?.config;
    const constraints = config?.liveConnectConstraints;
    const liveConfig = constraints?.config;

    expect(constraints?.model).toBe('gemini-test-live');
    expect(config?.uses).toBe(1);
    expect(config?.expireTime).toBe('2026-10-31T10:10:00.000Z');
    expect(config?.newSessionExpireTime).toBe('2026-10-31T10:01:00.000Z');
    expect(liveConfig?.responseModalities).toEqual(['AUDIO']);
    expect(liveConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName).toBe('Kore');
    expect(liveConfig?.inputAudioTranscription).toEqual({});
    expect(liveConfig?.outputAudioTranscription).toEqual({});
    const tool = liveConfig?.tools?.[0];
    const functionDeclaration =
      tool && 'functionDeclarations' in tool ? tool.functionDeclarations?.[0] : undefined;
    expect(functionDeclaration?.name).toBe('ask_gram_saathi');
    expect(functionDeclaration?.parameters?.required).toEqual(['question']);
    expect(functionDeclaration?.response?.required).toEqual(['answer']);
    expect(String(liveConfig?.systemInstruction).toLowerCase()).toContain(
      'must call ask_gram_saathi',
    );
    expect(String(liveConfig?.systemInstruction)).toContain('consented example');
    expect(JSON.stringify(fake.getParams())).not.toContain('test-key-not-returned');
  });

  it('returns mock token without constructing a Gemini client', async () => {
    const fake = serviceDeps({
      isMocked: () => true,
      createClient: () => {
        throw new Error('must not call Gemini in mock mode');
      },
    });
    const response = await createLiveToken(request, fake.deps);
    expect(response).toMatchObject({ token: 'mock', model: 'mock', mock: true });
    expect(fake.getCreateCalls()).toBe(0);
  });

  it('uses the normal Gemini not-configured error when the key is missing', async () => {
    const fake = serviceDeps({ apiKey: undefined });
    await expect(createLiveToken(request, fake.deps)).rejects.toMatchObject({
      status: 503,
      code: 'AI_NOT_CONFIGURED',
    });
    expect(fake.getCreateCalls()).toBe(0);
  });
});

describe('POST /api/live/token', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve())),
    );
    server = undefined;
  });

  it('returns a validation error for an invalid request body', async () => {
    const app = express();
    app.use(express.json());
    app.use(
      '/api/live',
      createLiveRouter(async () => token as never),
    );
    app.use(errorHandler);
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server did not bind a TCP port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/live/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: ' ' }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
