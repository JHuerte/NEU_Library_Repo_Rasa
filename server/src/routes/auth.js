import { Router } from 'express';
import mongoose from 'mongoose';
import { User, College } from '../models/index.js';
import { setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { badRequest, unauthorized } from '../lib/http.js';

const router = Router();

const failures = new Map();
const MAX_FAILURES = 5;
const LOCK_MS = 10 * 60 * 1000;

router.post('/register', async (req, res) => {
  const { name, email, password, role = 'student', collegeId, department } = req.body ?? {};
  const errors = {};
  if (!name?.trim()) errors.name = 'Enter your full name.';
  if (!/^\S+@\S+\.\S+$/.test(email ?? '')) errors.email = 'Enter a valid email address.';
  if (!password || password.length < 8) errors.password = 'Use at least 8 characters.';
  if (!['student', 'faculty'].includes(role)) errors.role = 'Choose student or faculty.';
  if (collegeId && !(mongoose.isValidObjectId(collegeId) && (await College.exists({ _id: collegeId })))) errors.collegeId = 'Choose a college from the list.';
  if (Object.keys(errors).length) throw badRequest('Please fix the highlighted fields.', errors);

  if (await User.exists({ email: email.toLowerCase().trim() })) {
    throw badRequest('An account with this email already exists.', { email: 'This email is already registered. Sign in instead.' });
  }
  const user = new User({ name, email, role, college: collegeId || undefined, department });
  await user.setPassword(password);
  await user.save();
  setAuthCookie(res, user);
  res.status(201).json({ user: user.toPublic() });
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').toLowerCase().trim();
  const password = String(req.body?.password ?? '');
  const f = failures.get(email);
  if (f && f.count >= MAX_FAILURES && Date.now() - f.at < LOCK_MS) {
    throw unauthorized('Too many failed attempts. Wait 10 minutes and try again.');
  }
  const user = await User.findOne({ email });
  if (!user || !user.active || !(await user.checkPassword(password))) {
    failures.set(email, { count: (f?.count ?? 0) + 1, at: Date.now() });
    throw unauthorized('Email or password is incorrect.');
  }
  failures.delete(email);
  setAuthCookie(res, user);
  res.json({ user: user.toPublic() });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: req.user ? req.user.toPublic() : null });
});

export default router;
