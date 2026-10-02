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

auth.post('/login', async (req, res) => {
  const email = str(req.body.email, 'Email').toLowerCase();
  const password = str(req.body.password, 'Password');
  const row = get('SELECT * FROM users WHERE email = ?', email);
  if (!row || !(await bcrypt.compare(password, row.password_hash as string))) throw new HttpError(401, 'Wrong email or password');
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
  if (b.name !== undefined) run('UPDATE users SET name = ? WHERE id = ?', str(b.name, 'Name', { max: 80 }), me);
  if (b.country !== undefined) run('UPDATE users SET country = ? WHERE id = ?', oneOf(b.country, 'Country', countryCodes), me);
  if (b.baseCurrency !== undefined) run('UPDATE users SET base_currency = ? WHERE id = ?', oneOf(b.baseCurrency, 'Currency', CURRENCIES), me);
  res.json(toUser(get('SELECT * FROM users WHERE id = ?', me)!));
});
