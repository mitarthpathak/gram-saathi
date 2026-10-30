import type { RagSearchRequest, RagSearchResponse } from '@gram-saathi/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { languageCodeSchema } from '../../lib/validation';
import { searchSchemes, toRetrievedChunk } from './service';

const ragSearchBody = z.object({
  query: z.string().trim().min(1).max(1000),
  language: languageCodeSchema.optional(),
  topK: z.number().int().min(1).max(10).optional(),
});

/** POST /api/rag/search (debug): raw retrieval with scores, before the RAG_MIN_SCORE cut-off. */
export async function postRagSearch(req: Request, res: Response<RagSearchResponse>): Promise<void> {
  const body: RagSearchRequest = ragSearchBody.parse(req.body);
  const chunks = await searchSchemes(body);
  res.json({ chunks: chunks.map(toRetrievedChunk) });
}
