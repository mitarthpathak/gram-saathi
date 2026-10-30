import { Router } from 'express';
import { postSmsCompress } from './controller';

export const smsRouter = Router();

smsRouter.post('/compress', postSmsCompress);
