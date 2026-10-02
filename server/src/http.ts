import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { roundTo } from '@ft/core';
import { get } from './db';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-secret-change-me';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const bad = (msg: string) => new HttpError(400, msg);
export const notFound = (what = 'Not found') => new HttpError(404, what);
export const forbidden = (msg = 'Not allowed') => new HttpError(403, msg);

export interface AuthedRequest extends Request {
  userId: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Not signed in');
  let sub: string;
  try {
    sub = (jwt.verify(token, JWT_SECRET) as { sub: string }).sub;
  } catch {
    throw new HttpError(401, 'Session expired');
  }
  // A well-signed token for a user that no longer exists is not a session.
  if (!get('SELECT 1 FROM users WHERE id = ?', sub)) throw new HttpError(401, 'Session expired');
  (req as AuthedRequest).userId = sub;
  next();
}

export const uid = (req: Request) => (req as AuthedRequest).userId;

// --- tiny body validators -------------------------------------------------

/** Largest absolute amount accepted anywhere (balances, transactions, goals). */
export const MAX_AMOUNT = 1_000_000_000_000;

export function str(v: unknown, field: string, opts: { max?: number; optional?: boolean } = {}): string {
  if (v !== undefined && v !== null && typeof v !== 'string') throw bad(`${field} must be text`);
  // Trim before the emptiness check so "   " counts as missing.
  const s = (v ?? '').trim();
  if (!s) {
    if (opts.optional) return '';
    throw bad(`${field} is required`);
  }
  if (opts.max && s.length > opts.max) throw bad(`${field} is too long`);
  return s;
}

export function num(v: unknown, field: string, opts: { min?: number; max?: number; optional?: boolean; decimals?: number } = {}): number {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
    if (opts.optional) return NaN;
    throw bad(`${field} is required`);
  }
  // Numbers, or plain decimal strings — not booleans, hex, or "1e9".
  if (typeof v !== 'number' && !(typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()))) throw bad(`${field} must be a number`);
  const n = Number(v);
  if (!Number.isFinite(n)) throw bad(`${field} must be a number`);
  if (opts.min !== undefined && n < opts.min) throw bad(`${field} must be at least ${opts.min}`);
  const max = opts.max ?? MAX_AMOUNT;
  if (n > max) throw bad(`${field} is too large`);
  if (n < -MAX_AMOUNT) throw bad(`${field} is too small`);
  return roundTo(n, opts.decimals ?? 2);
}

export function oneOf<T extends string>(v: unknown, field: string, values: readonly T[]): T {
  if (!values.includes(v as T)) throw bad(`${field} must be one of ${values.join(', ')}`);
  return v as T;
}

/** A real calendar date (rejects 2026-02-30) within a sane range. */
export function isoDate(v: unknown, field: string): string {
  const s = str(v, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw bad(`${field} must be yyyy-MM-dd`);
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw bad(`${field} is not a real date`);
  if (y < 1970 || y > 2100) throw bad(`${field} must be between 1970 and 2100`);
  return s;
}

/** #rgb or #rrggbb — colours end up in inline styles, so nothing else gets through. */
export function hexColor(v: unknown, field = 'Colour'): string {
  const s = str(v, field, { max: 7 });
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) throw bad(`${field} must be a hex colour like #6366f1`);
  return s.toLowerCase();
}

/** Icon names are kebab-case identifiers from the client's icon set. */
export function iconName(v: unknown): string {
  const s = str(v, 'Icon', { max: 40 });
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) throw bad('Icon must be an icon name');
  return s;
}

/** Optional data-URL image, capped so a phone photo can't bloat the DB. */
export function image(v: unknown): string | null {
  if (!v) return null;
  if (typeof v !== 'string' || !v.startsWith('data:image/')) throw bad('image must be a data URL');
  if (v.length > 400_000) throw bad('image is too large');
  return v;
}
