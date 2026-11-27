import fs from 'node:fs';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { config } from '../src/config.js';

const dbPath = path.join(config.dataDir, 'db');
fs.mkdirSync(dbPath, { recursive: true });

let server;
try {
  server = await MongoMemoryServer.create({
    instance: { port: 27017, ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger' },
  });
} catch (err) {
  console.error('Could not start the development database on port 27017.');
  console.error('If MongoDB is already installed and running, skip this step and use `npm run dev:nodb`.');
  console.error(err.message);
  process.exit(1);
}

console.log(`MongoDB ready at ${server.getUri()} (data in ${dbPath})`);

const stop = async () => {
  await server.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
