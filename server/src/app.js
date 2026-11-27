import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { ROOT } from './config.js';
import { loadUser } from './middleware/auth.js';
import { HttpError } from './lib/http.js';
import authRoutes from './routes/auth.js';
import metaRoutes from './routes/meta.js';
import itemRoutes from './routes/items.js';
import browseRoutes from './routes/browse.js';
import submissionRoutes from './routes/submissions.js';
import reviewRoutes from './routes/review.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import faqRoutes from './routes/faq.js';
import chatRoutes from './routes/chat.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(loadUser);

  app.use('/api/auth', authRoutes);
  app.use('/api/meta', metaRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/browse', browseRoutes);
  app.use('/api/submissions', submissionRoutes);
  app.use('/api/review', reviewRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/faq', faqRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route.' }));

  const dist = path.join(ROOT, 'client', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, fields: err.details });
    if (err instanceof mongoose.Error.ValidationError) {
      const fields = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
      return res.status(400).json({ error: 'Some fields are invalid.', fields });
    }
    if (err?.code === 11000) return res.status(409).json({ error: 'That record already exists.' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body is not valid JSON.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server. Try again, and contact the library if it keeps happening.' });
  });

  return app;
}
