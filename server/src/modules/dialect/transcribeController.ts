import type { DialectTranscribeResponse, LanguageCode } from '@gram-saathi/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/httpError';
import { languageCodeSchema, optionalFormField } from '../../lib/validation';
import { contributorScript, transcribe } from '../voice/service';

const transcribeFields = z.object({ language: optionalFormField(languageCodeSchema) });

/** POST /api/dialect/transcribe (multipart: `audio`, optional `language`) */
export async function postDialectTranscribe(
  req: Request,
  res: Response<DialectTranscribeResponse>,
): Promise<void> {
  const fields = transcribeFields.parse(req.body) as { language?: LanguageCode };
  if (!req.file || req.file.size === 0) {
    throw new HttpError(400, 'AUDIO_REQUIRED', 'Send a non-empty audio file in the "audio" field.');
  }
  const result = await transcribe({ audio: req.file.buffer, mimeType: req.file.mimetype, ...fields });
  res.json({ transcript: result.transcript, script: contributorScript(result.script) });
}
