import { Router } from 'express';
import { getTopFaq } from './controller';

export const faqRouter = Router();

faqRouter.get('/top', getTopFaq);
