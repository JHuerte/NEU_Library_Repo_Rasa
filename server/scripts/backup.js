import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../src/db.js';
import { ROOT } from '../src/config.js';

const { EJSON } = mongoose.mongo.BSON;
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(ROOT, 'backups', stamp);
await fs.mkdir(path.join(outDir, 'db'), { recursive: true });

await connectDb();
const db = mongoose.connection.db;
let docs = 0;
for (const { name } of await db.listCollections().toArray()) {
  const rows = await db.collection(name).find().toArray();
  docs += rows.length;
  await fs.writeFile(path.join(outDir, 'db', `${name}.json`), EJSON.stringify(rows, null, 1, { relaxed: false }));
}
const files = await db.collection('files.files').countDocuments().catch(() => 0);
await disconnectDb();

console.log(`Backup written to ${outDir}: ${docs} database records, including ${files} stored files.`);
