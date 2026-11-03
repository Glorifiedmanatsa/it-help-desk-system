import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from '../utils/httpError.js';
import { MAX_FILES_PER_UPLOAD } from './upload.js';

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

const multerMessages = {
  LIMIT_FILE_SIZE: () => `Each file must be ${config.maxUploadMb}MB or smaller`,
  LIMIT_FILE_COUNT: () => `You can upload at most ${MAX_FILES_PER_UPLOAD} files at once`,
  LIMIT_UNEXPECTED_FILE: () => `You can upload at most ${MAX_FILES_PER_UPLOAD} files at once`,
};

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: multerMessages[err.code]?.() ?? err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'That record already exists' });
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
