import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const isProduction = env.NODE_ENV === 'production';

for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!env[key]) {
    throw new Error(`Missing required environment variable ${key}. Copy server/.env.example to server/.env.`);
  }
}
if (isProduction && env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}

const clientUrls = (env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const config = {
  env: env.NODE_ENV || 'development',
  isProduction,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT) || 4000,
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',
  clientUrls,
  clientUrl: clientUrls[0],
  uploadDir: path.resolve(serverRoot, env.UPLOAD_DIR || 'uploads'),
  maxUploadMb: Number(env.MAX_UPLOAD_MB) || 5,
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT) || 587,
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'IT Help Desk <helpdesk@example.com>',
  },
};
