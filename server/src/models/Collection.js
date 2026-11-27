import mongoose from 'mongoose';

const collectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    subtypes: [{ type: String, trim: true }],
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const RepoCollection = mongoose.model('RepoCollection', collectionSchema, 'collections');
