import { Router } from 'express';
import { Faq } from '../models/index.js';
import { badRequest } from '../lib/http.js';
import { classify } from '../lib/chat.js';

const router = Router();

router.post('/', async (req, res) => {
  const text = String(req.body?.message ?? '').trim().slice(0, 500);
  if (!text) throw badRequest('Type a question.');
  const faqs = await Faq.find({}, 'slug keywords').lean();
  res.json(await classify(text, faqs));
});

export default router;
