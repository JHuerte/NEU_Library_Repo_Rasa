import { Router } from 'express';
import { College, RepoCollection, Item } from '../models/index.js';
import { ACCESS_LEVELS, DOC_TYPES, STAGES, ABSTRACT_WORD_LIMIT } from '../constants.js';
import { config } from '../config.js';

const router = Router();

router.get('/', async (req, res) => {
  const [colleges, collections, counts] = await Promise.all([
    College.find().sort({ name: 1 }).lean(),
    RepoCollection.find().sort({ order: 1, name: 1 }).lean(),
    Item.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$repoCollection', n: { $sum: 1 } } }]),
  ]);
  const countBy = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.json({
    repositoryName: config.repositoryName,
    institution: config.institution,
    handlePrefix: config.handlePrefix,
    abstractWordLimit: ABSTRACT_WORD_LIMIT,
    maxUploadMb: config.maxUploadMb,
    accessLevels: ACCESS_LEVELS,
    stages: STAGES,
    docTypes: DOC_TYPES,
    colleges: colleges.map((c) => ({ id: String(c._id), name: c.name, code: c.code, departments: c.departments })),
    collections: collections.map((c) => ({
      id: String(c._id), name: c.name, slug: c.slug, description: c.description, subtypes: c.subtypes, itemCount: countBy[String(c._id)] ?? 0,
    })),
  });
});

router.get('/stats', async (req, res) => {
  const [total, open, authors, collections] = await Promise.all([
    Item.countDocuments({ status: 'published' }),
    Item.countDocuments({ status: 'published', accessLevel: 'open' }),
    Item.distinct('authors.name', { status: 'published' }),
    RepoCollection.countDocuments(),
  ]);
  res.json({ total, open, contributors: authors.length, collections });
});

export default router;
