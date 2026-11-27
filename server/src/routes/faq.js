import { Router } from 'express';
import mongoose from 'mongoose';
import { Faq } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/http.js';

const router = Router();

const toJson = (f) => ({
  id: String(f._id), slug: f.slug, question: f.question, keywords: f.keywords, answer: f.answer,
  related: f.related, links: f.links, isSamplePolicy: f.isSamplePolicy, order: f.order,
});

router.get('/', async (req, res) => {
  const faqs = await Faq.find().sort({ order: 1, question: 1 });
  res.json({ faqs: faqs.map(toJson) });
});

const editors = requireRole('librarian', 'admin');

function parse(body = {}) {
  const errors = {};
  if (!body.question?.trim()) errors.question = 'Enter the question.';
  if (!body.answer?.trim()) errors.answer = 'Enter the answer.';
  const keywords = (Array.isArray(body.keywords) ? body.keywords : String(body.keywords ?? '').split(','))
    .map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (!keywords.length) errors.keywords = 'Add at least one keyword people might type.';
  if (Object.keys(errors).length) throw badRequest('Please fix the highlighted fields.', errors);
  return {
    question: body.question.trim(),
    answer: body.answer.trim(),
    keywords,
    related: Array.isArray(body.related) ? body.related : [],
    links: Array.isArray(body.links) ? body.links : [],
    isSamplePolicy: Boolean(body.isSamplePolicy),
    order: Number(body.order) || 0,
  };
}

router.post('/', editors, async (req, res) => {
  const data = parse(req.body);
  const slug = data.question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const faq = await Faq.create({ ...data, slug: (await Faq.exists({ slug })) ? `${slug}-${Date.now()}` : slug });
  res.status(201).json({ faq: toJson(faq) });
});

router.put('/:id', editors, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const faq = await Faq.findByIdAndUpdate(req.params.id, parse(req.body), { new: true });
  if (!faq) throw notFound();
  res.json({ faq: toJson(faq) });
});

router.delete('/:id', editors, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const faq = await Faq.findByIdAndDelete(req.params.id);
  if (!faq) throw notFound();
  res.json({ ok: true });
});

export default router;
