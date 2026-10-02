import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { COUNTRIES, CURRENCIES, DEFAULT_CATEGORIES } from '@ft/core';
import { get, run, tx } from '../db';
import { HttpError, bad, oneOf, requireAuth, signToken, str, uid } from '../http';
import { toUser } from '../repo';

export const auth = Router();

export function seedDefaultCategories(userId: string) {
  for (const c of DEFAULT_CATEGORIES) {
    run(
      'INSERT INTO categories (id, user_id, kind, name, icon, color, is_default) VALUES (?, ?, ?, ?, ?, ?, 1)',
      randomUUID(),
      userId,
      c.kind,
      c.name,
      c.icon,
      c.color,
    );
  }
}

const countryCodes = COUNTRIES.map((c) => c.code);

auth.post('/register', async (req, res) => {
  const email = str(req.body.email, 'Email', { max: 200 }).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Enter a valid email');
  const name = str(req.body.name, 'Name', { max: 80 });
  const password = str(req.body.password, 'Password', { max: 200 });
  if (password.length < 8) throw bad('Password must be at least 8 characters');
  const country = oneOf(req.body.country ?? 'RO', 'Country', countryCodes);
  const baseCurrency = oneOf(
    req.body.baseCurrency ?? COUNTRIES.find((c) => c.code === country)!.currency,
    'Currency',
    CURRENCIES,
  );
  if (get('SELECT 1 FROM users WHERE email = ?', email)) throw new HttpError(409, 'An account with this email already exists');

  const id = randomUUID();
  const hash = await bcrypt.hash(password, 10);
  tx(() => {
    run('INSERT INTO users (id, email, name, password_hash, base_currency, country) VALUES (?, ?, ?, ?, ?, ?)', id, email, name, hash, baseCurrency, country);
    seedDefaultCategories(id);
  });
  res.status(201).json({ token: signToken(id), user: toUser(get('SELECT * FROM users WHERE id = ?', id)!) });
});

// Brute-force guard: per email+IP, at most MAX_FAILS failed logins per window.
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; first: number }>();

auth.post('/login', async (req, res) => {
  const email = str(req.body.email, 'Email', { max: 200 }).toLowerCase();
  const password = str(req.body.password, 'Password', { max: 200 });
  const key = `${req.ip}|${email}`;
  const now = Date.now();
  const f = failures.get(key);
  if (f && now - f.first > WINDOW_MS) failures.delete(key);
  else if (f && f.count >= MAX_FAILS) {
    const minutes = Math.ceil((WINDOW_MS - (now - f.first)) / 60_000);
    throw new HttpError(429, `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  const row = get('SELECT * FROM users WHERE email = ?', email);
  if (!row || !(await bcrypt.compare(password, row.password_hash as string))) {
    if (failures.size > 10_000) for (const [k, v] of failures) if (now - v.first > WINDOW_MS) failures.delete(k);
    const cur = failures.get(key) ?? { count: 0, first: now };
    cur.count++;
    failures.set(key, cur);
    throw new HttpError(401, 'Wrong email or password');
  }
  failures.delete(key);
  res.json({ token: signToken(row.id as string), user: toUser(row) });
});

auth.get('/me', requireAuth, (req, res) => {
  const row = get('SELECT * FROM users WHERE id = ?', uid(req));
  if (!row) throw new HttpError(401, 'Account no longer exists');
  res.json(toUser(row));
});

auth.patch('/me', requireAuth, (req, res) => {
  const me = uid(req);
  const b = req.body;
  // Validate every field first so a bad one doesn't leave the others half-saved.
  const name = b.name !== undefined ? str(b.name, 'Name', { max: 80 }) : undefined;
  const country = b.country !== undefined ? oneOf(b.country, 'Country', countryCodes) : undefined;
  const currency = b.baseCurrency !== undefined ? oneOf(b.baseCurrency, 'Currency', CURRENCIES) : undefined;
  tx(() => {
    if (name !== undefined) run('UPDATE users SET name = ? WHERE id = ?', name, me);
    if (country !== undefined) run('UPDATE users SET country = ? WHERE id = ?', country, me);
    if (currency !== undefined) run('UPDATE users SET base_currency = ? WHERE id = ?', currency, me);
  });
  res.json(toUser(get('SELECT * FROM users WHERE id = ?', me)!));
});
