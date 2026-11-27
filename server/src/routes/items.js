import { Router } from 'express';
import mongoose from 'mongoose';
import { Item, AccessLog, AccessRequest } from '../models/index.js';
import { itemSummary, itemDetail, ITEM_POPULATE } from '../lib/serialize.js';
import { canViewRecord, downloadAccess, isOwner, isStaff } from '../lib/access.js';
import { pipeline } from 'node:stream/promises';
import { openFileStream } from '../lib/storage.js';
import { badRequest, escapeRegex, notFound, toArray, unauthorized } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const PAGE_SIZE = 20;
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const validIds = (list) => toArray(list).filter((v) => mongoose.isValidObjectId(v));

function buildFilters(q) {
  const base = { status: 'published' };
  const and = [];
  const term = String(q.q ?? '').trim();
  if (term) {
    const field = q.field ?? 'all';
    if (field === 'all') base.$text = { $search: term };
    else {
      const path = { title: 'title', author: 'authors.name', keyword: 'keywords', subject: 'subject' }[field] ?? 'title';
      and.push({ [path]: new RegExp(escapeRegex(term), 'i') });
    }
  }
  if (q.author) and.push({ 'authors.name': new RegExp(escapeRegex(q.author), 'i') });
  if (q.subject) and.push({ subject: new RegExp(escapeRegex(q.subject), 'i') });
  if (q.department) and.push({ department: q.department });
  const from = Number(q.yearFrom);
  const to = Number(q.yearTo);
  if (from) and.push({ year: { $gte: from } });
  if (to) and.push({ year: { $lte: to } });
  if (q.collection && mongoose.isValidObjectId(q.collection)) and.push({ repoCollection: oid(q.collection) });
  if (and.length) base.$and = and;

  const facets = [];
  const types = toArray(q.type);
  const access = toArray(q.access);
  const colleges = validIds(q.college);
  if (types.length) facets.push({ documentType: { $in: types } });
  if (access.length) facets.push({ accessLevel: { $in: access } });
  if (colleges.length) facets.push({ college: { $in: colleges.map(oid) } });
  const full = facets.length ? { ...base, $and: [...(base.$and ?? []), ...facets] } : base;
  return { base, full, term };
}

router.get('/search', async (req, res) => {
  const { base, full, term } = buildFilters(req.query);
  const page = Math.max(1, Number(req.query.page) || 1);
  const sortByScore = Boolean(base.$text) && req.query.sort !== 'newest';
  const sort = sortByScore ? { score: { $meta: 'textScore' } } : req.query.sort === 'oldest' ? { year: 1 } : { year: -1, publishedAt: -1 };

  const [items, total, facetAgg] = await Promise.all([
    Item.find(full).sort(sort).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).populate(ITEM_POPULATE),
    Item.countDocuments(full),
    Item.aggregate([
      { $match: base },
      {
        $facet: {
          type: [{ $group: { _id: '$documentType', n: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          access: [{ $group: { _id: '$accessLevel', n: { $sum: 1 } } }],
          college: [
            { $group: { _id: '$college', n: { $sum: 1 } } },
            { $lookup: { from: 'colleges', localField: '_id', foreignField: '_id', as: 'c' } },
            { $project: { n: 1, name: { $first: '$c.name' } } },
            { $sort: { name: 1 } },
          ],
        },
      },
    ]),
  ]);

  if (term && page === 1) AccessLog.create({ action: 'search', query: term.toLowerCase(), user: req.user?._id }).catch(() => {});

  const f = facetAgg[0];
  res.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    items: items.map(itemSummary),
    facets: {
      type: f.type.map((x) => ({ value: x._id, label: x._id, count: x.n })),
      access: f.access.map((x) => ({ value: x._id, count: x.n })),
      college: f.college.map((x) => ({ value: String(x._id), label: x.name, count: x.n })),
    },
  });
});

router.get('/recent', async (req, res) => {
  const items = await Item.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(6).populate(ITEM_POPULATE);
  res.json({ items: items.map(itemSummary) });
});

router.get('/by-handle/:prefix/:number', async (req, res) => {
  const item = await Item.findOne({ handle: `${req.params.prefix}/${req.params.number}`, status: 'published' }).select('_id');
  if (!item) throw notFound('No item has this handle.');
  res.json({ id: String(item._id) });
});

async function findItem(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Item not found.');
  const item = await Item.findById(id).populate([...ITEM_POPULATE, { path: 'submittedBy', select: 'name role email' }]);
  if (!item) throw notFound('Item not found.');
  return item;
}

router.get('/:id', async (req, res) => {
  const item = await findItem(req.params.id);
  if (!canViewRecord(item, req.user)) throw notFound('Item not found.');
  const staffOrOwner = isStaff(req.user) || isOwner(item, req.user);

  if (item.status === 'published' && !staffOrOwner) {
    await Item.updateOne({ _id: item._id }, { $inc: { views: 1 } });
    item.views += 1;
    AccessLog.create({ item: item._id, user: req.user?._id, action: 'view' }).catch(() => {});
  }
  const access = await downloadAccess(item, req.user);
  res.json({ item: itemDetail(item, { includeWorkflow: staffOrOwner }), access });
});

router.get('/:id/files/:fileId', async (req, res) => {
  const item = await findItem(req.params.id);
  if (!canViewRecord(item, req.user)) throw notFound('Item not found.');
  const file = item.files.id(req.params.fileId);
  if (!file) throw notFound('File not found.');
  const access = await downloadAccess(item, req.user);
  if (!access.ok) {
    const messages = {
      sign_in: 'Sign in with your NEU account to download this file.',
      request: 'This file is restricted. Request access from the item page.',
      pending: 'Your access request is still being reviewed.',
      embargo: 'This file is under embargo.',
      metadata_only: 'Only the catalog record is available online.',
    };
    return res.status(access.reason === 'sign_in' ? 401 : 403).json({ error: messages[access.reason] ?? 'You cannot download this file.' });
  }
  if (item.status === 'published' && !isStaff(req.user)) {
    await Item.updateOne({ _id: item._id }, { $inc: { downloads: 1 } });
    AccessLog.create({ item: item._id, user: req.user?._id, action: 'download' }).catch(() => {});
  }
  const inline = req.query.inline === '1' && file.mimeType === 'application/pdf';
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
  res.setHeader('Content-Length', file.size);
  await pipeline(openFileStream(file), res);
});

router.post('/:id/access-requests', requireAuth, async (req, res) => {
  if (!req.user) throw unauthorized();
  const item = await findItem(req.params.id);
  if (item.status !== 'published' || item.accessLevel !== 'restricted') throw badRequest('This item does not take access requests.');
  const reason = String(req.body?.reason ?? '').trim();
  if (reason.length < 10) throw badRequest('Tell the library briefly why you need access (at least 10 characters).', { reason: 'Add a short reason.' });
  const pending = await AccessRequest.findOne({ item: item._id, user: req.user._id, status: 'pending' });
  if (pending) throw badRequest('You already have a pending request for this item.');
  const r = await AccessRequest.create({ item: item._id, user: req.user._id, reason });
  res.status(201).json({ request: { id: String(r._id), status: r.status } });
});

export default router;
