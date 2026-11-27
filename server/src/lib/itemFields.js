import mongoose from 'mongoose';
import { ACCESS_LEVELS, DOC_TYPES } from '../constants.js';
import { College, RepoCollection } from '../models/index.js';

const splitList = (v) => {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  const s = String(v ?? '').trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try { return JSON.parse(s).map((x) => String(x).trim()).filter(Boolean); } catch { }
  }
  return s.split(/[;\n]|,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);
};

export async function parseItemFields(body = {}, { partial = false } = {}) {
  const fields = {};
  const errors = {};
  const has = (k) => body[k] !== undefined;
  const need = (k) => !partial || has(k);

  if (need('title')) {
    if (!String(body.title ?? '').trim()) errors.title = 'Enter the title.';
    else fields.title = String(body.title).trim();
  }
  if (need('authors')) {
    const authors = String(body.authors ?? '').includes(';') || String(body.authors ?? '').includes('\n') || Array.isArray(body.authors)
      ? splitList(body.authors)
      : [String(body.authors ?? '').trim()].filter(Boolean);
    if (!authors.length) errors.authors = 'Add at least one author.';
    else fields.authors = authors.map((name) => ({ name }));
  }
  if (need('year')) {
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) errors.year = 'Enter a valid year.';
    else fields.year = year;
  }
  if (need('documentType')) {
    if (!DOC_TYPES.includes(body.documentType)) errors.documentType = 'Choose a document type.';
    else fields.documentType = body.documentType;
  }
  if (need('collectionId')) {
    const ok = mongoose.isValidObjectId(body.collectionId) && (await RepoCollection.exists({ _id: body.collectionId }));
    if (!ok) errors.collectionId = 'Choose a collection.';
    else fields.repoCollection = body.collectionId;
  }
  if (need('collegeId')) {
    const ok = mongoose.isValidObjectId(body.collegeId) && (await College.exists({ _id: body.collegeId }));
    if (!ok) errors.collegeId = 'Choose a college or office.';
    else fields.college = body.collegeId;
  }
  if (has('accessLevel') || !partial) {
    const level = body.accessLevel ?? 'open';
    if (!ACCESS_LEVELS[level]) errors.accessLevel = 'Choose an access level.';
    else fields.accessLevel = level;
  }
  if (has('embargoUntil')) {
    const d = body.embargoUntil ? new Date(body.embargoUntil) : null;
    if (d && Number.isNaN(d.getTime())) errors.embargoUntil = 'Enter a valid date.';
    else fields.embargoUntil = d ?? undefined;
  }
  for (const k of ['abstract', 'adviser', 'department', 'subject', 'language', 'publisher', 'rights']) {
    if (has(k)) fields[k] = String(body[k] ?? '').trim();
  }
  if (has('keywords')) fields.keywords = splitList(body.keywords);
  if (has('extra') && body.extra && typeof body.extra === 'object') fields.extra = body.extra;
  if (fields.accessLevel && fields.accessLevel !== 'embargo') fields.embargoUntil = undefined;

  return { fields, errors };
}
