import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/index.js';
import { forbidden, unauthorized } from '../lib/http.js';

const COOKIE = 'neu_token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function setAuthCookie(res, user) {
  const token = jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: MAX_AGE_MS });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE);
}

export async function loadUser(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { sub } = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(sub);
      if (user?.active) req.user = user;
    } catch {
      clearAuthCookie(res);
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) throw unauthorized();
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) throw unauthorized();
  if (!roles.includes(req.user.role)) throw forbidden();
  next();
};
