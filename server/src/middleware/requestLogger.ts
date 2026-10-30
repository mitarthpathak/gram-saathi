import type { RequestHandler } from 'express';
import { logger } from '../lib/logger';

/** Logs one line per request once the response is sent: method, path, status, duration. */
export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = performance.now();
  res.on('finish', () => {
    const ms = Math.round(performance.now() - startedAt);
    logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms} ms)`);
  });
  next();
};
