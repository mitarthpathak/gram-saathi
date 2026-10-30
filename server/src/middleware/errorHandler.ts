import type { ApiErrorBody } from '@gram-saathi/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';

/** 404 for unknown /api routes, in the standard error shape. */
export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiErrorBody = {
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` },
  };
  res.status(404).json(body);
};

/** Turns every error into `ApiErrorBody` JSON. Registered last in createApp.ts. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const { status, body } = toErrorResponse(err);
  if (status === 500) {
    // A bug: log the stack.
    logger.error(`${req.method} ${req.originalUrl} failed`, err);
  } else if (status > 501) {
    // Expected outages (AI unavailable, knowledge base missing...): one line is enough.
    logger.warn(`${req.method} ${req.originalUrl}: ${body.error.code} ${body.error.message}`);
  }
  res.status(status).json(body);
};

function toErrorResponse(err: unknown): { status: number; body: ApiErrorBody } {
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return reply(400, 'VALIDATION_ERROR', 'Request validation failed', details);
  }
  if (err instanceof HttpError) {
    return reply(err.status, err.code, err.message, err.details);
  }
  if (err instanceof multer.MulterError) {
    return reply(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, err.code, err.message);
  }
  if (isClientError(err)) {
    // Raised by express.json() for malformed or oversized bodies.
    const code =
      err.type === 'entity.parse.failed'
        ? 'INVALID_JSON'
        : err.type === 'entity.too.large'
          ? 'PAYLOAD_TOO_LARGE'
          : 'BAD_REQUEST';
    return reply(err.status, code, err.message);
  }
  return reply(500, 'INTERNAL_ERROR', 'Something went wrong');
}

function reply(status: number, code: string, message: string, details?: unknown) {
  return { status, body: { error: { code, message, details } } };
}

function isClientError(err: unknown): err is { status: number; type?: string; message: string } {
  return (
    err instanceof Error &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  );
}
