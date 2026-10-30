import { Router } from 'express';
import { postChatQuery } from './controller';

export const chatRouter = Router();

chatRouter.post('/query', postChatQuery);
