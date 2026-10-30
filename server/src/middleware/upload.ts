import multer from 'multer';
import { HttpError } from '../lib/httpError';

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * Parses a multipart request with one file field named `audio`, kept in memory (no temp
 * files). The file ends up in `req.file`, the text fields in `req.body`.
 */
export const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 10 },
  fileFilter: (_req, file, accept) => {
    if (file.mimetype.startsWith('audio/')) {
      accept(null, true);
      return;
    }
    accept(
      new HttpError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        `Expected an audio/* file, got ${file.mimetype}`,
      ),
    );
  },
}).single('audio');
