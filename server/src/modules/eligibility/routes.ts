import { Router } from 'express';
import { postEligibilityAnswer, postEligibilityStart } from './controller';

export const eligibilityRouter = Router();

eligibilityRouter.post('/start', postEligibilityStart);
eligibilityRouter.post('/answer', postEligibilityAnswer);
