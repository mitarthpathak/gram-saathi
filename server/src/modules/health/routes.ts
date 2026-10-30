import { Router } from 'express';
import { getHealth } from './controller';

export const healthRouter = Router();

healthRouter.get('/', getHealth);
