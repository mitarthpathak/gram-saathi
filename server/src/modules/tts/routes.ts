import { Router } from 'express';
import { postTts } from './controller';

export const ttsRouter = Router();

ttsRouter.post('/', postTts);
