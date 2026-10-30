import type { FaqTopQuery, FaqTopResponse } from '@gram-saathi/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { languageCodeSchema } from '../../lib/validation';
import { getTopFaqs } from './service';

const topQuery = z.object({
  lang: languageCodeSchema.optional(),
});

/** GET /api/faq/top?lang=hi */
export async function getTopFaq(req: Request, res: Response<FaqTopResponse>): Promise<void> {
  const { lang = 'hi' }: FaqTopQuery = topQuery.parse(req.query);
  res.json({ items: await getTopFaqs(lang) });
}
