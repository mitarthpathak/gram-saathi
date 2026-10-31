import type { LiveTokenRequest, LiveTokenResponse } from '@gram-saathi/shared';
import type { RequestHandler, Response } from 'express';
import { z } from 'zod';
import { languageCodeSchema, sessionIdSchema } from '../../lib/validation';
import { isDialectId } from '../dialect/registry';
import { createLiveToken } from './service';

const dialectHintSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isDialectId, 'Unknown dialect registry id');

export const liveTokenRequestSchema = z.object({
  sessionId: sessionIdSchema,
  language: languageCodeSchema.optional(),
  dialectHint: dialectHintSchema.optional(),
});

export type LiveTokenIssuer = (request: LiveTokenRequest) => Promise<LiveTokenResponse>;

/** POST /api/live/token */
export function createPostLiveToken(issuer: LiveTokenIssuer = createLiveToken): RequestHandler {
  return async (req, res: Response<LiveTokenResponse>) => {
    const body = liveTokenRequestSchema.parse(req.body) satisfies LiveTokenRequest;
    res.json(await issuer(body));
  };
}

export const postLiveToken = createPostLiveToken();
