import { Router } from 'express';
import { getDialects } from './controller';

export const dialectRouter = Router();

dialectRouter.get('/', getDialects);
