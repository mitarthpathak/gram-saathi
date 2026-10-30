import type { QueryResponse, VoiceQueryFields } from '@gram-saathi/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/httpError';
import { languageCodeSchema, optionalFormField, sessionIdSchema } from '../../lib/validation';
import { answerVoiceQuery } from './service';

const voiceQueryFields = z.object({
  language: optionalFormField(languageCodeSchema),
  dialectHint: optionalFormField(z.string().trim().min(1).max(64)),
  sessionId: sessionIdSchema,
});

/** POST /api/voice/query (multipart: `audio` file + text fields) */
export async function postVoiceQuery(req: Request, res: Response<QueryResponse>): Promise<void> {
  const fields: VoiceQueryFields = voiceQueryFields.parse(req.body);
  if (!req.file || req.file.size === 0) {
    throw new HttpError(400, 'AUDIO_REQUIRED', 'Send a non-empty audio file in the "audio" field.');
  }
  res.json(
    await answerVoiceQuery({ ...fields, audio: req.file.buffer, mimeType: req.file.mimetype }),
  );
}
