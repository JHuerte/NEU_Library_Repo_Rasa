import crypto from 'node:crypto';
import mongoose from 'mongoose';
import multer from 'multer';
import { config } from '../config.js';

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'files' });
const fileId = (record) => new mongoose.Types.ObjectId(record.storedName);

export const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
export const looksLikePdf = (buffer) => buffer.subarray(0, 5).toString('latin1') === '%PDF-';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
});

export const uploadSingle = upload.single('file');

export async function saveBuffer(buffer, originalName, mimeType, version = 1) {
  const id = new mongoose.Types.ObjectId();
  await new Promise((resolve, reject) => {
    bucket()
      .openUploadStreamWithId(id, originalName, { metadata: { mimeType } })
      .on('finish', resolve)
      .on('error', reject)
      .end(buffer);
  });
  return {
    originalName,
    storedName: String(id),
    mimeType,
    size: buffer.length,
    sha256: sha256(buffer),
    version,
    uploadedAt: new Date(),
  };
}

export const recordFromUpload = (file, version = 1) => saveBuffer(file.buffer, file.originalname, file.mimetype, version);

export function openFileStream(record) {
  return bucket().openDownloadStream(fileId(record));
}

export async function readStart(record, bytes = 5) {
  const chunks = [];
  for await (const chunk of bucket().openDownloadStream(fileId(record), { start: 0, end: bytes })) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function verifyFile(record) {
  try {
    const hash = crypto.createHash('sha256');
    for await (const chunk of openFileStream(record)) hash.update(chunk);
    return { ok: hash.digest('hex') === record.sha256, missing: false };
  } catch {
    return { ok: false, missing: true };
  }
}

export async function deleteStoredFile(record) {
  if (record?.storedName) await bucket().delete(fileId(record)).catch(() => {});
}
