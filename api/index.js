import { createApp } from '../server/src/app.js';
import { connectDb } from '../server/src/db.js';

const app = createApp();

export default async function handler(req, res) {
  try {
    await connectDb();
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'The repository database is not reachable right now. Try again in a minute.' }));
    return;
  }
  return app(req, res);
}
