import { Router } from 'express';
import mongoose from 'mongoose';
import { User, RepoCollection, College, Item, AccessLog } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants.js';
import { badRequest, escapeRegex, notFound } from '../lib/http.js';

const router = Router();
router.use(requireRole('admin'));

router.get('/users', async (req, res) => {
  const filter = {};
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  if (ROLES.includes(req.query.role)) filter.role = req.query.role;
  const users = await User.find(filter).sort({ name: 1 }).limit(200).populate('college', 'name');
  res.json({ users: users.map((u) => ({ ...u.toPublic(), college: u.college?.name ?? null, createdAt: u.createdAt })) });
});

router.patch('/users/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const user = await User.findById(req.params.id);
  if (!user) throw notFound();
  const { role, active } = req.body ?? {};
  const self = String(user._id) === String(req.user._id);
  if (role !== undefined) {
    if (!ROLES.includes(role)) throw badRequest('Unknown role.');
    if (self && role !== 'admin') throw badRequest('You cannot remove your own administrator role.');
    user.role = role;
  }
  if (active !== undefined) {
    if (self && !active) throw badRequest('You cannot deactivate your own account.');
    user.active = Boolean(active);
  }
  await user.save();
  res.json({ user: user.toPublic() });
});

router.post('/collections', async (req, res) => {
  const { name, description = '', subtypes = [] } = req.body ?? {};
  if (!name?.trim()) throw badRequest('Enter a collection name.');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const order = (await RepoCollection.countDocuments()) + 1;
  const c = await RepoCollection.create({ name: name.trim(), slug, description, subtypes, order });
  res.status(201).json({ collection: c });
});

router.patch('/collections/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const c = await RepoCollection.findById(req.params.id);
  if (!c) throw notFound();
  for (const k of ['name', 'description', 'subtypes', 'order']) if (req.body?.[k] !== undefined) c[k] = req.body[k];
  await c.save();
  res.json({ collection: c });
});

router.post('/colleges', async (req, res) => {
  const { name, code, departments = [] } = req.body ?? {};
  if (!name?.trim()) throw badRequest('Enter a college name.');
  const c = await College.create({ name: name.trim(), code, departments });
  res.status(201).json({ college: c });
});

router.patch('/colleges/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const c = await College.findById(req.params.id);
  if (!c) throw notFound();
  for (const k of ['name', 'code', 'departments']) if (req.body?.[k] !== undefined) c[k] = req.body[k];
  await c.save();
  res.json({ college: c });
});

router.get('/activity', async (req, res) => {
  const [events, logs] = await Promise.all([
    Item.aggregate([
      { $unwind: '$history' }, { $sort: { 'history.at': -1 } }, { $limit: 40 },
      { $project: { title: 1, h: '$history' } },
    ]),
    AccessLog.find({ action: 'download' }).sort({ at: -1 }).limit(20).populate('item', 'title').populate('user', 'name'),
  ]);
  res.json({
    workflow: events.map((e) => ({ itemId: String(e._id), title: e.title, action: e.h.action, stage: e.h.stage, by: e.h.byName, note: e.h.note, at: e.h.at })),
    downloads: logs.map((l) => ({ title: l.item?.title, by: l.user?.name ?? 'Guest', at: l.at })),
  });
});

export default router;
