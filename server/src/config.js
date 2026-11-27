import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const isProd = process.env.NODE_ENV === 'production';
if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/neu_library',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-do-not-use-in-production',
  dataDir: path.resolve(ROOT, process.env.DATA_DIR || 'data'),
  handlePrefix: process.env.HANDLE_PREFIX || '20.500.12345',
  institution: 'NEU',
  repositoryName: 'NEU Library Repository',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 200,
  rasaUrl: (process.env.RASA_URL ?? (process.env.VERCEL ? '' : 'http://localhost:5005')).replace(/\/$/, ''),
};
