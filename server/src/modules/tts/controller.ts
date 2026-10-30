import type { TtsRequest, TtsResponse } from '@gram-saathi/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { languageCodeSchema } from '../../lib/validation';
import { synthesizeSpeech } from './service';

const ttsBody = z.object({
  text: z.string().trim().min(1).max(2000),
  language: languageCodeSchema,
});

/** POST /api/tts */
export async function postTts(req: Request, res: Response<TtsResponse>): Promise<void> {
  const body: TtsRequest = ttsBody.parse(req.body);
  res.json(await synthesizeSpeech(body));
}
