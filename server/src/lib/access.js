import { STAFF_ROLES } from '../constants.js';
import { AccessRequest } from '../models/index.js';

export const isStaff = (user) => Boolean(user && STAFF_ROLES.includes(user.role));

const idOf = (v) => String(v?._id ?? v ?? '');
export const isOwner = (item, user) => Boolean(user && idOf(item.submittedBy) === idOf(user._id ?? user.id));

export function canViewRecord(item, user) {
  if (item.status === 'published') return true;
  return isStaff(user) || isOwner(item, user);
}

export async function downloadAccess(item, user) {
  if (isStaff(user) || isOwner(item, user)) return { ok: true };
  if (item.status !== 'published') return { ok: false, reason: 'not_published' };

  switch (item.accessLevel) {
    case 'open':
      return { ok: true };
    case 'institutional':
      return user ? { ok: true } : { ok: false, reason: 'sign_in' };
    case 'embargo':
      if (item.embargoUntil && item.embargoUntil <= new Date()) return { ok: true };
      return { ok: false, reason: 'embargo', until: item.embargoUntil };
    case 'restricted': {
      if (!user) return { ok: false, reason: 'sign_in' };
      const req = await AccessRequest.findOne({ item: item._id, user: user._id }).sort({ createdAt: -1 });
      if (req?.status === 'approved') return { ok: true };
      if (req?.status === 'pending') return { ok: false, reason: 'pending' };
      return { ok: false, reason: 'request', denied: req?.status === 'denied' };
    }
    default:
      return { ok: false, reason: 'metadata_only' };
  }
}
