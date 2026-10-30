import { Router } from 'express';
import { postRagSearch } from './controller';

/** Internal debug endpoint: lets the RAG workstream test retrieval without the UI. */
export const ragRouter = Router();

ragRouter.post('/search', postRagSearch);
