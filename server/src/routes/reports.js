import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { Item, AccessLog, User } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { verifyFile } from '../lib/storage.js';
import { itemSummary, ITEM_POPULATE } from '../lib/serialize.js';
import { ROOT } from '../config.js';

const router = Router();
router.use(requireRole('admin'));

const published = { status: 'published' };

async function lastBackup() {
  try {
    const dirs = (await fs.readdir(path.join(ROOT, 'backups'))).sort();
    return dirs.at(-1) ?? null;
  } catch {
    return null;
  }
}

router.get('/summary', async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearAgo = new Date(now.getTime() - 365 * 864e5);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 864e5);

  const [
    total, byAccess, byCollection, byCollege, submissionsByYear, growth,
    topDownloaded, topViewed, topSearches, contributors, activeContributors,
    inReview, returned, approvedThisMonth, turnaround, everReturned, submittedTotal,
    downloadTotals, files, users,
  ] = await Promise.all([
    Item.countDocuments(published),
    Item.aggregate([{ $match: published }, { $group: { _id: '$accessLevel', n: { $sum: 1 } } }]),
    Item.aggregate([
      { $match: published }, { $group: { _id: '$repoCollection', n: { $sum: 1 } } },
      { $lookup: { from: 'collections', localField: '_id', foreignField: '_id', as: 'c' } },
      { $project: { n: 1, label: { $first: '$c.name' } } }, { $sort: { n: -1 } },
    ]),
    Item.aggregate([
      { $match: published }, { $group: { _id: '$college', n: { $sum: 1 } } },
      { $lookup: { from: 'colleges', localField: '_id', foreignField: '_id', as: 'c' } },
      { $project: { n: 1, label: { $first: '$c.name' } } }, { $sort: { n: -1 } },
    ]),
    Item.aggregate([
      { $match: { submittedAt: { $ne: null } } },
      { $group: { _id: { $year: '$submittedAt' }, n: { $sum: 1 } } }, { $sort: { _id: 1 } },
    ]),
    Item.aggregate([
      { $match: { ...published, publishedAt: { $gte: yearAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$publishedAt' } }, n: { $sum: 1 } } }, { $sort: { _id: 1 } },
    ]),
    Item.find(published).sort({ downloads: -1 }).limit(5).populate(ITEM_POPULATE),
    Item.find(published).sort({ views: -1 }).limit(5).populate(ITEM_POPULATE),
    AccessLog.aggregate([
      { $match: { action: 'search', at: { $gte: ninetyDaysAgo } } },
      { $group: { _id: '$query', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 10 },
    ]),
    Item.distinct('authors.name', published),
    Item.distinct('submittedBy', { submittedAt: { $gte: yearAgo } }),
    Item.countDocuments({ status: 'in_review' }),
    Item.countDocuments({ status: 'returned' }),
    Item.countDocuments({ ...published, publishedAt: { $gte: monthStart } }),
    Item.aggregate([
      { $match: { ...published, publishedAt: { $gte: yearAgo }, submittedAt: { $ne: null } } },
      { $project: { days: { $divide: [{ $subtract: ['$publishedAt', '$submittedAt'] }, 864e5] } } },
      { $sort: { days: 1 } },
    ]),
    Item.countDocuments({ 'history.action': 'returned' }),
    Item.countDocuments({ submittedAt: { $ne: null } }),
    Item.aggregate([{ $match: published }, { $group: { _id: '$accessLevel', downloads: { $sum: '$downloads' }, views: { $sum: '$views' } } }]),
    Item.aggregate([
      { $unwind: '$files' },
      {
        $group: {
          _id: null, count: { $sum: 1 }, bytes: { $sum: '$files.size' },
          failed: { $sum: { $cond: [{ $eq: ['$files.fixityOk', false] }, 1, 0] } },
          lastCheck: { $max: '$files.lastFixityCheck' }, oldestCheck: { $min: '$files.lastFixityCheck' },
          types: { $push: '$files.mimeType' },
        },
      },
    ]),
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
  ]);

  const median = turnaround.length ? turnaround[Math.floor(turnaround.length / 2)].days : null;
  const f = files[0] ?? { count: 0, bytes: 0, failed: 0, types: [] };
  const formats = {};
  for (const t of f.types) formats[t] = (formats[t] ?? 0) + 1;
  const atRisk = Object.entries(formats).filter(([t]) => !['application/pdf', 'video/mp4', 'image/tiff', 'image/png', 'image/jpeg', 'audio/flac'].includes(t));

  res.json({
    generatedAt: now,
    totals: {
      items: total,
      byAccess: Object.fromEntries(byAccess.map((r) => [r._id, r.n])),
      contributors: contributors.length,
      activeContributors: activeContributors.filter(Boolean).length,
    },
    byCollection: byCollection.map((r) => ({ label: r.label, count: r.n })),
    byCollege: byCollege.map((r) => ({ label: r.label, count: r.n })),
    submissionsByYear: submissionsByYear.map((r) => ({ year: r._id, count: r.n })),
    growth: growth.map((r) => ({ month: r._id, count: r.n })),
    topDownloaded: topDownloaded.map(itemSummary),
    topViewed: topViewed.map(itemSummary),
    topSearches: topSearches.map((r) => ({ query: r._id, count: r.n })),
    usageByAccess: Object.fromEntries(downloadTotals.map((r) => [r._id, { downloads: r.downloads, views: r.views }])),
    workflow: {
      inReview,
      returned,
      approvedThisMonth,
      medianDaysToPublish: median == null ? null : Math.round(median * 10) / 10,
      returnRate: submittedTotal ? Math.round((everReturned / submittedTotal) * 100) : 0,
    },
    preservation: {
      files: f.count,
      bytes: f.bytes,
      failedFixity: f.failed,
      lastFixityCheck: f.lastCheck ?? null,
      oldestFixityCheck: f.oldestCheck ?? null,
      formats,
      formatsAtRisk: atRisk.map(([type, count]) => ({ type, count })),
      lastBackup: await lastBackup(),
    },
    users: Object.fromEntries(users.map((r) => [r._id, r.n])),
  });
});

router.post('/fixity', async (req, res) => {
  const items = await Item.find({ 'files.0': { $exists: true } });
  let checked = 0;
  const failed = [];
  for (const item of items) {
    for (const file of item.files) {
      const r = await verifyFile(file);
      file.fixityOk = r.ok;
      file.lastFixityCheck = new Date();
      checked += 1;
      if (!r.ok) failed.push({ itemId: String(item._id), title: item.title, file: file.originalName, problem: r.missing ? 'File is missing' : 'Checksum does not match' });
    }
    await item.save();
  }
  res.json({ checked, ok: checked - failed.length, failed });
});

export default router;
