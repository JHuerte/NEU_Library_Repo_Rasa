import { Router } from 'express';
import mongoose from 'mongoose';
import { Item } from '../models/index.js';
import { requireRole } from '../middleware/auth.js';
import { SUBMITTER_ROLES } from '../constants.js';
import { parseItemFields } from '../lib/itemFields.js';
import { recordFromUpload, deleteStoredFile, uploadSingle } from '../lib/storage.js';
import { submit } from '../lib/workflow.js';
import { itemDetail, ITEM_POPULATE } from '../lib/serialize.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';
import { config } from '../config.js';

const router = Router();
router.use(requireRole(...SUBMITTER_ROLES));

const upload = (req, res, next) =>
  uploadSingle(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `The file is larger than ${config.maxUploadMb} MB.` : err.message;
    next(badRequest(msg));
  });

router.get('/mine', async (req, res) => {
  const items = await Item.find({ submittedBy: req.user._id }).sort({ updatedAt: -1 }).populate(ITEM_POPULATE);
  res.json({ items: items.map((it) => itemDetail(it, { includeWorkflow: true })) });
});

router.post('/', upload, async (req, res) => {
  let stored;
  try {
    if (req.body.license !== 'true') throw badRequest('Accept the deposit license to submit.', { license: 'Required' });
    if (!req.file) throw badRequest('Upload the full-text PDF.', { file: 'Required' });
    const { fields, errors } = await parseItemFields(req.body);
    if (Object.keys(errors).length) throw badRequest('Please fix the highlighted fields.', errors);

    stored = await recordFromUpload(req.file, 1);
    const item = new Item({
      ...fields,
      publisher: config.institution,
      rights: fields.accessLevel === 'open' ? 'CC BY-NC 4.0' : `© ${fields.year} the author(s). All rights reserved.`,
      submittedBy: req.user._id,
      files: [stored],
    });
    if (item.authors[0] && !item.authors.some((a) => a.user)) item.authors[0].user = req.user._id;
    await submit(item, req.user);
    await item.save();
    await item.populate(ITEM_POPULATE);
    res.status(201).json({ item: itemDetail(item, { includeWorkflow: true }) });
  } catch (err) {
    await deleteStoredFile(stored);
    throw err;
  }
});

router.put('/:id', upload, async (req, res) => {
  let stored;
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
    const item = await Item.findById(req.params.id);
    if (!item) throw notFound();
    if (String(item.submittedBy) !== String(req.user._id)) throw forbidden('Only the person who submitted this item can change it.');
    if (item.status !== 'returned') throw badRequest('Only submissions returned for changes can be edited.');

    const { fields, errors } = await parseItemFields(req.body, { partial: true });
    if (Object.keys(errors).length) throw badRequest('Please fix the highlighted fields.', errors);
    Object.assign(item, fields);
    if (req.file) {
      stored = await recordFromUpload(req.file, (item.files.at(-1)?.version ?? 0) + 1);
      item.files.push(stored);
    }

    await submit(item, req.user, { resubmission: true });
    await item.save();
    await item.populate(ITEM_POPULATE);
    res.json({ item: itemDetail(item, { includeWorkflow: true }) });
  } catch (err) {
    await deleteStoredFile(stored);
    throw err;
  }
});

export default router;
