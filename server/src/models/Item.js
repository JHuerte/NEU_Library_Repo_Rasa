import mongoose from 'mongoose';
import { ACCESS_LEVELS, ITEM_STATUSES, STAGE_KEYS } from '../constants.js';

const { ObjectId } = mongoose.Schema.Types;

const fileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  storedName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  sha256: { type: String, required: true },
  version: { type: Number, default: 1 },
  uploadedAt: { type: Date, default: Date.now },
  lastFixityCheck: Date,
  fixityOk: Boolean,
});

const historySchema = new mongoose.Schema(
  {
    stage: { type: String, enum: STAGE_KEYS },
    action: { type: String, required: true },
    by: { type: ObjectId, ref: 'User' },
    byName: String,
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const itemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    abstract: { type: String, default: '' },
    authors: [{ name: { type: String, required: true, trim: true }, user: { type: ObjectId, ref: 'User' } }],
    adviser: { type: String, trim: true },
    year: { type: Number, required: true },
    documentType: { type: String, required: true },
    subject: { type: String, trim: true },
    keywords: [{ type: String, trim: true }],
    language: { type: String, default: 'English' },
    publisher: { type: String, default: 'NEU' },
    rights: { type: String },

    repoCollection: { type: ObjectId, ref: 'RepoCollection', required: true },
    college: { type: ObjectId, ref: 'College', required: true },
    department: { type: String, trim: true },
    extra: { type: Map, of: String, default: {} },

    accessLevel: { type: String, enum: Object.keys(ACCESS_LEVELS), default: 'open' },
    embargoUntil: Date,

    files: [fileSchema],
    handle: { type: String, unique: true, sparse: true },

    status: { type: String, enum: ITEM_STATUSES, default: 'in_review' },
    stage: { type: String, enum: STAGE_KEYS, default: 'submitted' },
    issues: [String],
    history: [historySchema],
    submittedBy: { type: ObjectId, ref: 'User' },
    submittedAt: Date,
    publishedAt: Date,

    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
  },
  { timestamps: true },
);

itemSchema.index(
  { title: 'text', abstract: 'text', keywords: 'text', subject: 'text', 'authors.name': 'text' },
  { name: 'item_text', weights: { title: 10, keywords: 6, 'authors.name': 6, subject: 4, abstract: 1 } },
);
itemSchema.index({ status: 1, publishedAt: -1 });
itemSchema.index({ status: 1, stage: 1 });
itemSchema.index({ submittedBy: 1 });

export const Item = mongoose.model('Item', itemSchema);
