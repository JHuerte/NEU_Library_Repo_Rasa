import { ABSTRACT_WORD_LIMIT, STAGES } from '../constants.js';
import { Counter } from '../models/index.js';
import { config } from '../config.js';
import { looksLikePdf, readStart, verifyFile } from './storage.js';

const stageIndex = (key) => STAGES.findIndex((s) => s.key === key);
export const stageLabel = (key) => STAGES.find((s) => s.key === key)?.label ?? key;

const APPROVERS = {
  metadata_review: ['librarian', 'admin'],
  content_verification: ['librarian', 'admin'],
  librarian_approval: ['librarian', 'admin'],
  admin_approval: ['admin'],
};

export function canApprove(item, user) {
  return item.status === 'in_review' && (APPROVERS[item.stage] ?? []).includes(user?.role);
}

export function canReturn(item, user) {
  return item.status === 'in_review' && Boolean(APPROVERS[item.stage]) && ['librarian', 'admin'].includes(user?.role);
}

function log(item, action, user, note) {
  item.history.push({ stage: item.stage, action, by: user?._id, byName: user?.name ?? 'System', note });
}

export const wordCount = (text) => (String(text).trim().match(/\S+/g) ?? []).length;

export async function validate(item) {
  const issues = [];
  if (!item.title?.trim()) issues.push('Title is missing.');
  if (!item.authors?.length) issues.push('At least one author is required.');
  if (!item.abstract?.trim()) issues.push('Abstract is missing.');
  else if (wordCount(item.abstract) > ABSTRACT_WORD_LIMIT) {
    issues.push(`Abstract has ${wordCount(item.abstract)} words; the limit is ${ABSTRACT_WORD_LIMIT}.`);
  }
  if ((item.keywords ?? []).length < 3) issues.push('Add at least 3 keywords.');
  if (item.accessLevel === 'embargo' && !(item.embargoUntil > new Date())) issues.push('Choose an embargo end date in the future.');
  const file = item.files.at(-1);
  if (!file) issues.push('Upload the full-text PDF.');
  else if (!looksLikePdf(await readStart(file))) issues.push('The uploaded file is not a valid PDF.');
  return issues;
}

export async function submit(item, user, { resubmission = false } = {}) {
  item.stage = 'submitted';
  item.status = 'in_review';
  item.submittedAt = new Date();
  log(item, resubmission ? 'resubmitted' : 'submitted', user);

  item.stage = 'validation';
  const issues = await validate(item);
  item.issues = issues;
  if (issues.length) {
    item.status = 'returned';
    log(item, 'returned', null, `Automatic checks found problems: ${issues.join(' ')}`);
  } else {
    log(item, 'validated', null, 'Automatic checks passed.');
    item.stage = 'metadata_review';
  }
  return item;
}

async function nextHandle() {
  const c = await Counter.findOneAndUpdate({ _id: 'handle' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `${config.handlePrefix}/${c.seq}`;
}

async function publish(item) {
  item.stage = 'indexing';
  log(item, 'indexed', null, 'Added to the search index.');

  item.stage = 'preservation';
  for (const f of item.files) {
    const r = await verifyFile(f);
    f.fixityOk = r.ok;
    f.lastFixityCheck = new Date();
    if (!r.ok) throw new Error(`File ${f.originalName} failed its integrity check; publication stopped.`);
  }
  log(item, 'preserved', null, 'File checksums verified and stored.');

  item.stage = 'published';
  item.status = 'published';
  item.publishedAt = new Date();
  if (!item.handle) item.handle = await nextHandle();
  log(item, 'published', null, `Published as hdl:${item.handle}`);
}

export async function approve(item, user, note) {
  const from = item.stage;
  log(item, 'approved', user, note || `${stageLabel(from)} complete.`);
  item.issues = [];
  if (from === 'admin_approval') await publish(item);
  else item.stage = STAGES[stageIndex(from) + 1].key;
  return item;
}

export function returnToAuthor(item, user, note) {
  item.status = 'returned';
  log(item, 'returned', user, note);
  return item;
}
