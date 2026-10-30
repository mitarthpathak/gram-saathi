import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { chatRouter } from './modules/chat/routes';
import { eligibilityRouter } from './modules/eligibility/routes';
import { faqRouter } from './modules/faq/routes';
import { healthRouter } from './modules/health/routes';
import { ragRouter } from './modules/rag/routes';
import { smsRouter } from './modules/sms/routes';
import { ttsRouter } from './modules/tts/routes';
import { voiceRouter } from './modules/voice/routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestLogger);
  app.use(cors({ origin: env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()) }));
  app.use(express.json({ limit: '100kb' }));

  // One router per module. Paths must match docs/API_CONTRACT.md.
  app.use('/api/health', healthRouter);
  app.use('/api/voice', voiceRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/rag', ragRouter);
  app.use('/api/eligibility', eligibilityRouter);
  app.use('/api/sms', smsRouter);
  app.use('/api/tts', ttsRouter);
  app.use('/api/faq', faqRouter);
  app.use('/api', notFoundHandler);

  app.get('/', (_req, res) => {
    res.json({ name: 'gram-saathi-api', health: '/api/health', docs: 'docs/API_CONTRACT.md' });
  });

  // TODO(step-3): optionally serve client/dist here for a single-service deploy.

  app.use(errorHandler);
  return app;
}
