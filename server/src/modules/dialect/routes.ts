import { Router } from 'express';
import { getDialects } from './controller';
import { postDialectTranscribe } from './transcribeController';
import { uploadAudio } from '../../middleware/upload';

export const dialectRouter = Router();

dialectRouter.get('/', getDialects);

export const dialectTranscribeRouter = Router();
dialectTranscribeRouter.post('/transcribe', uploadAudio, postDialectTranscribe);
