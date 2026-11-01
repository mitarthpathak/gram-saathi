/**
 * How the audit reaches the API. Preferred: the real Express app on an ephemeral local port
 * (real routing, multer, rate limiter, JSON parser). Fallback, when the Express app cannot be
 * created: the same controllers and error handler called directly, which still exercises request
 * validation, the services and the error-code mapping, but not routing, multer or rate limiting.
 */
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { ApiErrorBody, HealthResponse, QueryResponse, TtsResponse } from '@gram-saathi/shared';
import type { Request, Response } from 'express';
import { errorHandler } from '../../src/middleware/errorHandler';
import { postChatQuery } from '../../src/modules/chat/controller';
import { getHealth } from '../../src/modules/health/controller';
import { postTts } from '../../src/modules/tts/controller';
import { postVoiceQuery } from '../../src/modules/voice/controller';

export interface ApiResult<T> {
  status: number;
  body: T | ApiErrorBody | undefined;
  ms: number;
  headers: Record<string, string>;
}

export interface AudioUpload {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
}

export interface Transport {
  kind: 'http' | 'in-process';
  note: string;
  health(): Promise<ApiResult<HealthResponse>>;
  chat(body: Record<string, unknown>): Promise<ApiResult<QueryResponse>>;
  voice(
    fields: Record<string, string>,
    audio: AudioUpload | null,
  ): Promise<ApiResult<QueryResponse>>;
  tts(body: Record<string, unknown>): Promise<ApiResult<TtsResponse>>;
  close(): Promise<void>;
}

export function isErrorBody(body: unknown): body is ApiErrorBody {
  return typeof body === 'object' && body !== null && 'error' in body;
}

export function errorCode(result: ApiResult<unknown>): string | undefined {
  return isErrorBody(result.body) ? result.body.error.code : undefined;
}

export async function openTransport(prefer: 'http' | 'in-process' = 'http'): Promise<Transport> {
  if (prefer === 'http') {
    try {
      return await openHttp();
    } catch (error) {
      const transport = openInProcess();
      transport.note =
        `Express app could not be started (${error instanceof Error ? error.message : String(error)}); ` +
        'controllers and the error handler are called directly, without Express routing, multer ' +
        'or the per-IP rate limiter.';
      return transport;
    }
  }
  return openInProcess();
}

async function openHttp(): Promise<Transport> {
  const { createApp } = await import('../../src/createApp.js');
  const server = createApp().listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
    const startedAt = Date.now();
    const response = await fetch(`${base}${path}`, init);
    const text = await response.text();
    let body: T | ApiErrorBody | undefined;
    try {
      body = text ? (JSON.parse(text) as T | ApiErrorBody) : undefined;
    } catch {
      body = undefined;
    }
    return {
      status: response.status,
      body,
      ms: Date.now() - startedAt,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }
  const json = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    kind: 'http',
    note: `real Express app on ${base}`,
    health: () => call<HealthResponse>('/api/health'),
    chat: (body) => call<QueryResponse>('/api/chat/query', json(body)),
    tts: (body) => call<TtsResponse>('/api/tts', json(body)),
    voice: (fields, audio) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) form.append(key, value);
      if (audio) {
        form.append(
          'audio',
          new Blob([new Uint8Array(audio.bytes)], { type: audio.mimeType }),
          audio.fileName,
        );
      }
      return call<QueryResponse>('/api/voice/query', { method: 'POST', body: form });
    },
    close: async () => {
      server.close();
      await once(server, 'close').catch(() => undefined);
    },
  };
}

interface CapturedResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
}

function openInProcess(): Transport {
  type Handler = (req: Request, res: Response) => unknown;

  async function invoke<T>(handler: Handler, req: Partial<Request>): Promise<ApiResult<T>> {
    const captured: CapturedResponse = { statusCode: 200, body: undefined, headers: {} };
    const res = {
      get statusCode() {
        return captured.statusCode;
      },
      status(code: number) {
        captured.statusCode = code;
        return this;
      },
      json(body: unknown) {
        captured.body = body;
        return this;
      },
      setHeader(name: string, value: string) {
        captured.headers[name.toLowerCase()] = String(value);
        return this;
      },
    } as unknown as Response;
    const request = {
      method: 'POST',
      originalUrl: '(in-process)',
      ip: '127.0.0.1',
      headers: {},
      ...req,
    } as Request;
    const startedAt = Date.now();
    try {
      await handler(request, res);
    } catch (error) {
      errorHandler(error, request, res, () => undefined);
    }
    return {
      status: captured.statusCode,
      body: captured.body as T | ApiErrorBody | undefined,
      ms: Date.now() - startedAt,
      headers: captured.headers,
    };
  }

  return {
    kind: 'in-process',
    note: 'controllers and the error handler called directly (no Express routing, multer or rate limiter)',
    health: () => invoke<HealthResponse>(getHealth, { method: 'GET', originalUrl: '/api/health' }),
    chat: (body) => invoke<QueryResponse>(postChatQuery, { body, originalUrl: '/api/chat/query' }),
    tts: (body) => invoke<TtsResponse>(postTts, { body, originalUrl: '/api/tts' }),
    voice: (fields, audio) =>
      invoke<QueryResponse>(postVoiceQuery, {
        body: fields,
        originalUrl: '/api/voice/query',
        file: audio
          ? ({
              buffer: audio.bytes,
              size: audio.bytes.length,
              mimetype: audio.mimeType,
              originalname: audio.fileName,
            } as unknown as Request['file'])
          : undefined,
      }),
    close: async () => undefined,
  };
}
