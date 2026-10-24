import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from '../utils/httpError.js';

export const MAX_FILES_PER_UPLOAD = 5;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const JPEG = { mimes: ['image/jpeg', 'image/pjpeg'], magic: [[0xff, 0xd8, 0xff]] };

// Extension, declared MIME type and the file's leading bytes must all agree.
const FILE_TYPES = {
  '.pdf': { mimes: ['application/pdf'], magic: [[0x25, 0x50, 0x44, 0x46]] },
  '.png': { mimes: ['image/png'], magic: [[0x89, 0x50, 0x4e, 0x47]] },
  '.jpg': JPEG,
  '.jpeg': JPEG,
  // Some Windows browsers report .docx as zip/octet-stream; the signature check still applies.
  '.docx': { mimes: [DOCX_MIME, 'application/zip', 'application/octet-stream'], magic: [[0x50, 0x4b, 0x03, 0x04]] },
};

const typeFor = (filename) => FILE_TYPES[path.extname(filename).toLowerCase()];

fs.mkdirSync(config.uploadDir, { recursive: true });

export const uploadAttachments = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: MAX_FILES_PER_UPLOAD },
  fileFilter: (req, file, cb) => {
    const type = typeFor(file.originalname);
    if (!type || !type.mimes.includes(file.mimetype)) {
      return cb(new HttpError(400, `"${file.originalname}" is not allowed. Upload PDF, PNG, JPG or DOCX files.`));
    }
    cb(null, true);
  },
}).array('attachments', MAX_FILES_PER_UPLOAD);

export async function removeFiles(files = []) {
  await Promise.all(files.map((file) => fs.promises.rm(file.path, { force: true })));
}

async function hasExpectedSignature(file) {
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const { buffer } = await handle.read(Buffer.alloc(8), 0, 8, 0);
    return typeFor(file.originalname).magic.some((sig) => sig.every((byte, i) => buffer[i] === byte));
  } finally {
    await handle.close();
  }
}

// Rejects files whose content doesn't match their extension (e.g. a renamed .exe).
export async function verifyFileSignatures(files = []) {
  for (const file of files) {
    if (!(await hasExpectedSignature(file))) {
      await removeFiles(files);
      throw new HttpError(400, `"${file.originalname}" does not look like a valid ${path.extname(file.originalname)} file.`);
    }
  }
}

export const resolveStoredFile = (storedName) => {
  const fullPath = path.resolve(config.uploadDir, storedName);
  if (path.dirname(fullPath) !== config.uploadDir) throw new HttpError(404, 'File not found');
  return fullPath;
};
