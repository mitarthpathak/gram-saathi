import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { rateLimit } from './middleware/rateLimit';
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
  // Behind Vercel's edge or a reverse proxy: take the client IP from X-Forwarded-For.
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestLogger);
  app.use(cors({ origin: env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()) }));
  app.use(express.json({ limit: '100kb' }));

  // One router per module. Paths must match docs/API_CONTRACT.md.
  app.use('/api/health', healthRouter);
  // Endpoints that can call Gemini share one per-IP budget.
  const aiLimit = rateLimit();
  app.use('/api/voice', aiLimit, voiceRouter);
  app.use('/api/chat', aiLimit, chatRouter);
  app.use('/api/rag', aiLimit, ragRouter);
  app.use('/api/eligibility', aiLimit, eligibilityRouter);
  app.use('/api/sms', aiLimit, smsRouter);
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
