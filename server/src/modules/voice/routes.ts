import { Router } from 'express';
import { uploadAudio } from '../../middleware/upload';
import { postVoiceQuery } from './controller';

export const voiceRouter = Router();

voiceRouter.post('/query', uploadAudio, postVoiceQuery);
