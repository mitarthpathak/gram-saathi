import type { SmsCompressRequest, SmsCompressResponse } from '@gram-saathi/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { languageCodeSchema } from '../../lib/validation';
import { compressForSms } from './service';

const compressBody = z.object({
  text: z.string().trim().min(1).max(5000),
  language: languageCodeSchema,
});

/** POST /api/sms/compress */
export async function postSmsCompress(
  req: Request,
  res: Response<SmsCompressResponse>,
): Promise<void> {
  const body: SmsCompressRequest = compressBody.parse(req.body);
  res.json(await compressForSms(body));
}
