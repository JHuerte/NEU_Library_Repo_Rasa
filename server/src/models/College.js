import mongoose from 'mongoose';

const collegeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, trim: true },
    departments: [{ type: String, trim: true }],
  },
  { timestamps: true },
);

export const College = mongoose.model('College', collegeSchema);
