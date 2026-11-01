import { Router } from 'express';
import { createPostLiveToken, type LiveTokenIssuer } from './controller';

export function createLiveRouter(issuer?: LiveTokenIssuer): Router {
  const router = Router();
  router.post('/token', createPostLiveToken(issuer));
  return router;
}

export const liveRouter = createLiveRouter();
