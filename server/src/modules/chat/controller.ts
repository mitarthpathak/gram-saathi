import type { ChatQueryRequest, QueryResponse } from '@gram-saathi/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { languageCodeSchema, sessionIdSchema } from '../../lib/validation';
import { answerQuestion } from './service';

const chatQueryBody = z.object({
  text: z.string().trim().min(1).max(1000),
  language: languageCodeSchema.optional(),
  sessionId: sessionIdSchema,
});

/** POST /api/chat/query */
export async function postChatQuery(req: Request, res: Response<QueryResponse>): Promise<void> {
  const body: ChatQueryRequest = chatQueryBody.parse(req.body);
  res.json(await answerQuestion(body));
}
