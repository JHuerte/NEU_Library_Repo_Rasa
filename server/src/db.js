import mongoose from 'mongoose';
import { config } from './config.js';

let connecting = null;

export async function connectDb(uri = config.mongoUri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connecting) {
    mongoose.set('strictQuery', true);
    connecting = mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 }).catch((err) => {
      connecting = null;
      console.error(`Could not connect to MongoDB at ${uri.replace(/\/\/[^@]*@/, '//***@')}.`);
      console.error('Start the development database with `npm run db`, or set MONGODB_URI in .env.');
      throw err;
    });
  }
  await connecting;
  return mongoose.connection;
}

export function disconnectDb() {
  connecting = null;
  return mongoose.disconnect();
}
