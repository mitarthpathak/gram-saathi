import type { RagSearchRequest, RagSearchResponse } from '@gram-saathi/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { languageCodeSchema } from '../../lib/validation';
import { searchSchemes } from './service';

const ragSearchBody = z.object({
  query: z.string().trim().min(1).max(1000),
  language: languageCodeSchema.optional(),
  topK: z.number().int().min(1).max(10).optional(),
});

/** POST /api/rag/search (debug) */
export async function postRagSearch(req: Request, res: Response<RagSearchResponse>): Promise<void> {
  const body: RagSearchRequest = ragSearchBody.parse(req.body);
  res.json({ chunks: await searchSchemes(body) });
}
