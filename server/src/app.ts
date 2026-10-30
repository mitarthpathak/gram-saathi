/**
 * The Express app as a default export: what Vercel runs as a function (vercel.json
 * services.server.entrypoint, and the file `vercel dev` finds by name). No app.listen() here;
 * `npm run dev` and `npm start` use index.ts instead.
 */
import './config/env';
import type { Express } from 'express';
import { createApp } from './createApp';
import { logger } from './lib/logger';
import { initServices } from './startup';

// Load the data and log warnings once per instance. Requests also load data on first use, so
// they never wait for this.
initServices({ checkSources: false }).catch((error: unknown) => {
  logger.error('Startup checks failed', error);
});

const app: Express = createApp();
export default app;
