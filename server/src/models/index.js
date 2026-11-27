import mongoose from 'mongoose';

export { User } from './User.js';
export { College } from './College.js';
export { RepoCollection } from './Collection.js';
export { Item } from './Item.js';

const { ObjectId } = mongoose.Schema.Types;

const accessLogSchema = new mongoose.Schema({
  item: { type: ObjectId, ref: 'Item' },
  user: { type: ObjectId, ref: 'User' },
  action: { type: String, enum: ['view', 'download', 'search'], required: true },
  query: String,
  at: { type: Date, default: Date.now },
});
accessLogSchema.index({ action: 1, at: -1 });
export const AccessLog = mongoose.model('AccessLog', accessLogSchema);

const accessRequestSchema = new mongoose.Schema(
  {
    item: { type: ObjectId, ref: 'Item', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
    decidedBy: { type: ObjectId, ref: 'User' },
    decidedAt: Date,
  },
  { timestamps: true },
);
accessRequestSchema.index({ item: 1, user: 1 });
export const AccessRequest = mongoose.model('AccessRequest', accessRequestSchema);

const faqSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    question: { type: String, required: true },
    keywords: [String],
    answer: { type: String, required: true },
    related: [String],
    links: [{ label: String, to: String }],
    isSamplePolicy: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const Faq = mongoose.model('Faq', faqSchema);

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = mongoose.model('Counter', counterSchema);
