import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-secret-change-me';

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
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    (req as AuthedRequest).userId = payload.sub;
    next();
  } catch {
    throw new HttpError(401, 'Session expired');
  }
}

export const uid = (req: Request) => (req as AuthedRequest).userId;

// --- tiny body validators -------------------------------------------------

export function str(v: unknown, field: string, opts: { max?: number; optional?: boolean } = {}): string {
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return '';
    throw bad(`${field} is required`);
  }
  if (typeof v !== 'string') throw bad(`${field} must be text`);
  const s = v.trim();
  if (opts.max && s.length > opts.max) throw bad(`${field} is too long`);
  return s;
}

export function num(v: unknown, field: string, opts: { min?: number; optional?: boolean } = {}): number {
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return NaN;
    throw bad(`${field} is required`);
  }
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw bad(`${field} must be a number`);
  if (opts.min !== undefined && n < opts.min) throw bad(`${field} must be at least ${opts.min}`);
  return Math.round(n * 100) / 100;
}

export function oneOf<T extends string>(v: unknown, field: string, values: readonly T[]): T {
  if (!values.includes(v as T)) throw bad(`${field} must be one of ${values.join(', ')}`);
  return v as T;
}

export function isoDate(v: unknown, field: string): string {
  const s = str(v, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw bad(`${field} must be yyyy-MM-dd`);
  return s;
}

/** Optional data-URL image, capped so a phone photo can't bloat the DB. */
export function image(v: unknown): string | null {
  if (!v) return null;
  if (typeof v !== 'string' || !v.startsWith('data:image/')) throw bad('image must be a data URL');
  if (v.length > 400_000) throw bad('image is too large');
  return v;
}
