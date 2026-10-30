// Must be the first import: it loads .env and validates the environment.
import { describeMocks, env } from './config/env';
import { createApp } from './app';
import { logger } from './lib/logger';
import { initServices } from './startup';

async function start(): Promise<void> {
  await initServices();
  const server = createApp().listen(env.PORT, (error) => {
    if (error) {
      logger.error(`Could not start the API on port ${env.PORT}`, error);
      process.exit(1);
    }
    logger.info(`API ready on http://localhost:${env.PORT} (mocks: ${describeMocks()})`);
  });

  // Close cleanly on Ctrl+C, `tsx watch` restarts and platform shutdowns.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}

start().catch((error: unknown) => {
  logger.error('Could not start the API', error);
  process.exit(1);
});
