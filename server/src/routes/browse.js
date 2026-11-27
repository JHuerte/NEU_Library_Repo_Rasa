import { Router } from 'express';
import { Item, College, RepoCollection } from '../models/index.js';
import { badRequest } from '../lib/http.js';

const router = Router();
const published = { $match: { status: 'published' } };

router.get('/tree', async (req, res) => {
  const [rows, colleges, collections] = await Promise.all([
    Item.aggregate([
      published,
      { $group: { _id: { college: '$college', department: '$department', collection: '$repoCollection', year: '$year' }, n: { $sum: 1 } } },
    ]),
    College.find().lean(),
    RepoCollection.find().lean(),
  ]);
  const collegeName = Object.fromEntries(colleges.map((c) => [String(c._id), c.name]));
  const collName = Object.fromEntries(collections.map((c) => [String(c._id), c.name]));

  const tree = new Map();
  for (const { _id, n } of rows) {
    const cId = String(_id.college);
    if (!tree.has(cId)) tree.set(cId, { id: cId, name: collegeName[cId] ?? 'Unknown college', count: 0, departments: new Map() });
    const c = tree.get(cId);
    c.count += n;
    const dName = _id.department || 'General';
    if (!c.departments.has(dName)) c.departments.set(dName, { name: dName, count: 0, collections: new Map() });
    const d = c.departments.get(dName);
    d.count += n;
    const colId = String(_id.collection);
    if (!d.collections.has(colId)) d.collections.set(colId, { id: colId, name: collName[colId] ?? 'Unknown', count: 0, years: [] });
    const col = d.collections.get(colId);
    col.count += n;
    col.years.push({ year: _id.year, count: n });
  }
  const out = [...tree.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({
      ...c,
      departments: [...c.departments.values()].sort((a, b) => a.name.localeCompare(b.name)).map((d) => ({
        ...d,
        collections: [...d.collections.values()].map((col) => ({ ...col, years: col.years.sort((a, b) => b.year - a.year) })),
      })),
    }));
  res.json({ tree: out });
});

const GROUPINGS = {
  author: [{ $unwind: '$authors' }, { $group: { _id: '$authors.name', n: { $sum: 1 } } }],
  subject: [{ $match: { subject: { $nin: [null, ''] } } }, { $group: { _id: '$subject', n: { $sum: 1 } } }],
  year: [{ $group: { _id: '$year', n: { $sum: 1 } } }],
  type: [{ $group: { _id: '$documentType', n: { $sum: 1 } } }],
  program: [{ $match: { department: { $nin: [null, ''] } } }, { $group: { _id: '$department', n: { $sum: 1 } } }],
  collection: [
    { $group: { _id: '$repoCollection', n: { $sum: 1 } } },
    { $lookup: { from: 'collections', localField: '_id', foreignField: '_id', as: 'c' } },
    { $project: { n: 1, label: { $first: '$c.name' } } },
  ],
  college: [
    { $group: { _id: '$college', n: { $sum: 1 } } },
    { $lookup: { from: 'colleges', localField: '_id', foreignField: '_id', as: 'c' } },
    { $project: { n: 1, label: { $first: '$c.name' } } },
  ],
};

router.get('/:by', async (req, res) => {
  const stages = GROUPINGS[req.params.by];
  if (!stages) throw badRequest(`Browse by one of: ${Object.keys(GROUPINGS).join(', ')}`);
  const rows = await Item.aggregate([published, ...stages]);
  const entries = rows.map((r) => ({ value: String(r._id), label: r.label ?? String(r._id), count: r.n }));
  entries.sort((a, b) => (req.params.by === 'year' ? Number(b.value) - Number(a.value) : a.label.localeCompare(b.label)));
  res.json({ by: req.params.by, entries });
});

export default router;
