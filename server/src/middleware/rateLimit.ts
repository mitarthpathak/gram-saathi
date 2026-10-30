import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { HttpError } from '../lib/httpError';

interface Window {
  startedAt: number;
  count: number;
}

const WINDOW_MS = 60_000;

/**
 * Per-IP limit for the endpoints that call Gemini, so a public demo URL cannot burn the API
 * quota. Fixed one-minute windows in memory: per server instance, which is enough to stop a
 * runaway script. RATE_LIMIT_PER_MINUTE=0 turns it off.
 */
export function rateLimit(limit: number = env.RATE_LIMIT_PER_MINUTE): RequestHandler {
  const windows = new Map<string, Window>();

  return (req, res, next) => {
    if (limit <= 0) return next();
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    let window = windows.get(key);
    if (!window || now - window.startedAt >= WINDOW_MS) {
      // Drop finished windows now and then so the map cannot grow without bound.
      if (windows.size > 10_000) {
        for (const [ip, old] of windows) if (now - old.startedAt >= WINDOW_MS) windows.delete(ip);
      }
      window = { startedAt: now, count: 0 };
      windows.set(key, window);
    }
    window.count += 1;
    if (window.count <= limit) return next();

    const retryAfter = Math.ceil((window.startedAt + WINDOW_MS - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    next(
      new HttpError(
        429,
        'RATE_LIMITED',
        `Too many requests: at most ${limit} per minute. Try again in ${retryAfter} s.`,
      ),
    );
  };
}
