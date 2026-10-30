import express from 'express';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler';
import { rateLimit } from '../src/middleware/rateLimit';

async function hit(limit: number, times: number) {
  const app = express();
  app.use('/api/x', rateLimit(limit), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  try {
    const responses = [];
    for (let i = 0; i < times; i++) responses.push(await fetch(`http://127.0.0.1:${port}/api/x`));
    return responses;
  } finally {
    server.close();
  }
}

describe('rateLimit', () => {
  it('lets the first requests through, then answers 429 RATE_LIMITED with Retry-After', async () => {
    const responses = await hit(2, 3);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 429]);
    const last = responses[2];
    expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await last.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });

  it('is off with a limit of 0', async () => {
    const responses = await hit(0, 5);
    expect(responses.every((r) => r.status === 200)).toBe(true);
  });
});
