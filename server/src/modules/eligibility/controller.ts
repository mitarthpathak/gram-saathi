import type {
  EligibilityAnswerRequest,
  EligibilityAnswerResponse,
  EligibilityStartRequest,
  EligibilityStartResponse,
} from '@gram-saathi/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { languageCodeSchema, sessionIdSchema } from '../../lib/validation';
import { answerEligibility, startEligibility } from './service';

const startBody = z.object({
  sessionId: sessionIdSchema,
  language: languageCodeSchema,
});

const answerBody = z.object({
  sessionId: sessionIdSchema,
  questionId: z.string().trim().min(1).max(50),
  answer: z.union([z.number(), z.boolean(), z.string().trim().min(1).max(100)]),
});

/** POST /api/eligibility/start */
export async function postEligibilityStart(
  req: Request,
  res: Response<EligibilityStartResponse>,
): Promise<void> {
  const body: EligibilityStartRequest = startBody.parse(req.body);
  res.json(await startEligibility(body));
}

/** POST /api/eligibility/answer */
export async function postEligibilityAnswer(
  req: Request,
  res: Response<EligibilityAnswerResponse>,
): Promise<void> {
  const body: EligibilityAnswerRequest = answerBody.parse(req.body);
  res.json(await answerEligibility(body));
}
