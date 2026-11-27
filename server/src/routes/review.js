import { Router } from 'express';
import mongoose from 'mongoose';
import { Item, AccessRequest } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { STAGES } from '../constants.js';
import { parseItemFields } from '../lib/itemFields.js';
import { approve, canApprove, canReturn, returnToAuthor, stageLabel } from '../lib/workflow.js';
import { itemDetail, ITEM_POPULATE } from '../lib/serialize.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';

const router = Router();
router.use(requireRole('librarian', 'admin'));

const POPULATE = [...ITEM_POPULATE, { path: 'submittedBy', select: 'name role email' }];

async function load(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const item = await Item.findById(id).populate(POPULATE);
  if (!item) throw notFound();
  return item;
}

const FIELD_LABELS = { repoCollection: 'collection', documentType: 'document type', accessLevel: 'access level', embargoUntil: 'embargo date', department: 'program' };

function comparable(key, value) {
  if (key === 'authors') return (value ?? []).map((a) => a.name);
  if (key === 'repoCollection' || key === 'college') return String(value?._id ?? value ?? '');
  if (key === 'embargoUntil') return value ? new Date(value).toISOString() : null;
  if (key === 'keywords') return [...(value ?? [])];
  return value ?? '';
}

const withActions = (item, user) => ({
  ...itemDetail(item, { includeWorkflow: true }),
  canApprove: canApprove(item, user),
  canReturn: canReturn(item, user),
});

router.get('/queue', async (req, res) => {
  const status = ['in_review', 'returned'].includes(req.query.status) ? [req.query.status] : ['in_review', 'returned'];
  const filter = { status: { $in: status } };
  if (req.query.stage) filter.stage = req.query.stage;
  const [items, counts, pendingRequests] = await Promise.all([
    Item.find(filter).sort({ submittedAt: 1 }).populate(POPULATE),
    Item.aggregate([{ $match: { status: 'in_review' } }, { $group: { _id: '$stage', n: { $sum: 1 } } }]),
    AccessRequest.countDocuments({ status: 'pending' }),
  ]);
  const byStage = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  res.json({
    items: items.map((it) => withActions(it, req.user)),
    stageCounts: STAGES.map((s) => ({ ...s, count: byStage[s.key] ?? 0 })),
    returnedCount: await Item.countDocuments({ status: 'returned' }),
    pendingRequests,
  });
});

router.get('/items/:id', async (req, res) => {
  res.json({ item: withActions(await load(req.params.id), req.user) });
});

router.patch('/items/:id', async (req, res) => {
  const item = await load(req.params.id);
  const { fields, errors } = await parseItemFields(req.body, { partial: true });
  if (Object.keys(errors).length) throw badRequest('Please fix the highlighted fields.', errors);
  const changed = Object.keys(fields).filter((k) => JSON.stringify(comparable(k, item.get(k))) !== JSON.stringify(comparable(k, fields[k])));
  Object.assign(item, fields);
  if (changed.length) {
    const note = `Updated ${changed.map((k) => FIELD_LABELS[k] ?? k).join(', ')}.`;
    item.history.push({ stage: item.stage, action: 'edited', by: req.user._id, byName: req.user.name, note });
  }
  await item.save();
  await item.populate(POPULATE);
  res.json({ item: withActions(item, req.user) });
});

router.post('/items/:id/approve', async (req, res) => {
  const item = await load(req.params.id);
  if (!canApprove(item, req.user)) {
    throw forbidden(item.stage === 'admin_approval' ? 'Final approval needs a repository administrator.' : `This item cannot be approved at the ${stageLabel(item.stage)} stage.`);
  }
  await approve(item, req.user, String(req.body?.note ?? '').trim());
  await item.save();
  await item.populate(POPULATE);
  res.json({ item: withActions(item, req.user) });
});

router.post('/items/:id/return', async (req, res) => {
  const item = await load(req.params.id);
  if (!canReturn(item, req.user)) throw forbidden('This item cannot be returned right now.');
  const note = String(req.body?.note ?? '').trim();
  if (note.length < 5) throw badRequest('Tell the author what to change.', { note: 'Required' });
  returnToAuthor(item, req.user, note);
  await item.save();
  await item.populate(POPULATE);
  res.json({ item: withActions(item, req.user) });
});

router.get('/access-requests', async (req, res) => {
  const status = req.query.status ?? 'pending';
  const rows = await AccessRequest.find(status === 'all' ? {} : { status })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate({ path: 'item', select: 'title handle' })
    .populate({ path: 'user', select: 'name email role' });
  res.json({
    requests: rows.map((r) => ({
      id: String(r._id),
      status: r.status,
      reason: r.reason,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
      item: r.item && { id: String(r.item._id), title: r.item.title, handle: r.item.handle },
      user: r.user && { name: r.user.name, email: r.user.email, role: r.user.role },
    })),
  });
});

router.post('/access-requests/:id', async (req, res) => {
  const decision = req.body?.decision;
  if (!['approved', 'denied'].includes(decision)) throw badRequest('Decision must be approved or denied.');
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const r = await AccessRequest.findById(req.params.id);
  if (!r) throw notFound();
  Object.assign(r, { status: decision, decidedBy: req.user._id, decidedAt: new Date() });
  await r.save();
  res.json({ request: { id: String(r._id), status: r.status } });
});

export default router;
