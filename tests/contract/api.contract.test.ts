/**
 * API contract tests: black-box HTTP tests for every endpoint's behaviour —
 * validation, permissions, family sharing, money precision and error shapes.
 * They run against a live server (the Spring Boot backend), so the same suite
 * guards the API whatever it is implemented in.
 *
 *   API_URL     base URL of a running backend (default http://localhost:4000)
 *   JWT_SECRET  the backend's signing secret (default: the dev secret)
 *
 * Run with `npm run test:contract` while the backend is up.
 */
import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';

const base = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const SECRET = process.env.JWT_SECRET ?? 'dev-only-secret-change-me-32-chars-min';
// Every run uses fresh emails, so the suite can run repeatedly against one database.
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const email = (name: string) => `${RUN}-${name}`;

type Res = { status: number; body: any };
async function call(method: string, path: string, body?: unknown, token?: string, raw?: { body: string; type?: string }): Promise<Res> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload: string | undefined;
  if (raw) {
    payload = raw.body;
    if (raw.type) headers['content-type'] = raw.type;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(base + path, { method, headers, body: payload });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  return { status: res.status, body: parsed };
}
const get = (p: string, t?: string) => call('GET', p, undefined, t);
const post = (p: string, b: unknown, t?: string) => call('POST', p, b, t);
const patch = (p: string, b: unknown, t?: string) => call('PATCH', p, b, t);
const del = (p: string, t?: string) => call('DELETE', p, undefined, t);

let n = 0;
async function register(name = 'User', extra: Record<string, unknown> = {}) {
  const r = await post('/api/auth/register', { name, email: email(`user${++n}@test.dev`), password: 'password123', country: 'RO', ...extra });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return { token: r.body.token as string, user: r.body.user };
}
async function account(token: string, extra: Record<string, unknown> = {}) {
  const r = await post('/api/accounts', { type: 'debit', name: 'Main', country: 'RO', currency: 'RON', color: '#6366f1', icon: 'wallet', initialBalance: 1000, ...extra }, token);
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body;
}
async function category(token: string, kind = 'expense', name = 'Groceries') {
  const cats = (await get('/api/categories', token)).body as any[];
  return cats.find((c) => c.kind === kind && c.name === name);
}

// ---------------------------------------------------------------------------

describe('robustness', () => {
  it('health and fx are public', async () => {
    expect((await get('/api/health')).body).toEqual({ ok: true });
    const fx = await get('/api/fx');
    expect(fx.status).toBe(200);
    expect(fx.body.rates.EUR).toBe(1);
  });
  it('malformed JSON is a 400, not a crash', async () => {
    const r = await call('POST', '/api/auth/login', undefined, undefined, { body: '{"email":', type: 'application/json' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBeTruthy();
  });
  it('a request without a body is a 400, not a crash', async () => {
    expect((await call('POST', '/api/auth/login')).status).toBe(400);
    expect((await call('POST', '/api/auth/register', undefined, undefined, { body: 'email=a', type: 'application/x-www-form-urlencoded' })).status).toBe(400);
  });
  it('oversized payloads are rejected cleanly', async () => {
    const r = await call('POST', '/api/auth/login', undefined, undefined, { body: JSON.stringify({ email: 'x'.repeat(2_000_000) }), type: 'application/json' });
    expect(r.status).toBe(413);
  });
  it('unknown API routes return a JSON 404', async () => {
    const r = await get('/api/nope');
    expect(r.status).toBe(404);
    expect(r.body.error).toBeTruthy();
  });
});

describe('auth', () => {
  it('registers, seeds default categories and never leaks the password hash', async () => {
    const { token, user } = await register('Ana');
    expect(user).not.toHaveProperty('password_hash');
    expect(user).toMatchObject({ name: 'Ana', country: 'RO', baseCurrency: 'RON' });
    const cats = (await get('/api/categories', token)).body;
    expect(cats.filter((c: any) => c.kind === 'expense')).toHaveLength(23);
    expect(cats.filter((c: any) => c.kind === 'income')).toHaveLength(11);
    const me = await get('/api/auth/me', token);
    expect(me.body).not.toHaveProperty('password_hash');
  });
  it('rejects duplicate emails regardless of case', async () => {
    await post('/api/auth/register', { name: 'A', email: email('Dup@Test.dev'), password: 'password123' });
    const r = await post('/api/auth/register', { name: 'B', email: email('dup@test.DEV'), password: 'password123' });
    expect(r.status).toBe(409);
  });
  it.each([
    ['invalid email', { email: 'not-an-email' }],
    ['email with spaces', { email: 'a b@test.dev' }],
    ['numeric email', { email: 12345 }],
    ['7-char password', { password: '1234567' }],
    ['missing name', { name: undefined }],
    ['whitespace-only name', { name: '    ' }],
    ['81-char name', { name: 'x'.repeat(81) }],
    ['unknown country', { country: 'XX' }],
    ['unknown currency', { baseCurrency: 'DOGE' }],
    ['password too long', { password: 'p'.repeat(201) }],
  ])('rejects %s', async (_label, over) => {
    const r = await post('/api/auth/register', { name: 'Ok', email: email(`v${++n}@test.dev`), password: 'password123', ...over });
    expect(r.status).toBe(400);
  });
  it('accepts boundary values: 8-char password, 80-char name', async () => {
    const r = await post('/api/auth/register', { name: 'x'.repeat(80), email: email(`b${++n}@test.dev`), password: '12345678' });
    expect(r.status).toBe(201);
  });
  it('trims and lowercases the email', async () => {
    const r = await post('/api/auth/register', { name: 'T', email: `  ${email(`Trim${++n}@Test.dev`)}  `, password: 'password123' });
    expect(r.status).toBe(201);
    expect(r.body.user.email).toBe(email(`trim${n}@test.dev`).toLowerCase());
  });
  it('gives the same answer for a wrong password and an unknown email', async () => {
    await post('/api/auth/register', { name: 'L', email: email('login@test.dev'), password: 'password123' });
    const wrong = await post('/api/auth/login', { email: email('login@test.dev'), password: 'nope-nope' });
    const unknown = await post('/api/auth/login', { email: email('ghost@test.dev'), password: 'nope-nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
    expect((await post('/api/auth/login', { email: email('LOGIN@test.dev'), password: 'password123' })).status).toBe(200);
  });
  it('throttles repeated failed logins', async () => {
    await post('/api/auth/register', { name: 'R', email: email('brute@test.dev'), password: 'password123' });
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await post('/api/auth/login', { email: email('brute@test.dev'), password: `guess-${i}` })).status;
    expect(last).toBe(429);
  });
  it('rejects missing, garbage, foreign-signed and expired tokens', async () => {
    const { user } = await register();
    expect((await get('/api/accounts')).status).toBe(401);
    expect((await get('/api/accounts', 'garbage')).status).toBe(401);
    expect((await get('/api/accounts', jwt.sign({ sub: user.id }, 'some-other-secret'))).status).toBe(401);
    const secret = SECRET;
    expect((await get('/api/accounts', jwt.sign({ sub: user.id }, secret, { expiresIn: -10 }))).status).toBe(401);
  });
  it('rejects a valid token for a user that no longer exists', async () => {
    const secret = SECRET;
    const r = await get('/api/accounts', jwt.sign({ sub: 'no-such-user' }, secret));
    expect(r.status).toBe(401);
  });
  it('validates profile updates', async () => {
    const { token } = await register();
    expect((await patch('/api/auth/me', { baseCurrency: 'XXX' }, token)).status).toBe(400);
    expect((await patch('/api/auth/me', { name: '' }, token)).status).toBe(400);
    expect((await patch('/api/auth/me', { name: '   ' }, token)).status).toBe(400);
    const ok = await patch('/api/auth/me', { baseCurrency: 'EUR', country: 'DE', name: 'Renamed' }, token);
    expect(ok.body).toMatchObject({ baseCurrency: 'EUR', country: 'DE', name: 'Renamed' });
  });
  it('stores hostile strings literally (no SQL injection)', async () => {
    const { token } = await register("Robert'); DROP TABLE users; --");
    expect((await get('/api/auth/me', token)).body.name).toBe("Robert'); DROP TABLE users; --");
    expect((await get('/api/health')).status).toBe(200);
  });
});

describe('accounts', () => {
  it('creates an account whose balance starts at the opening balance', async () => {
    const { token } = await register();
    const a = await account(token, { institutionId: 'ro-bt', type: 'credit', creditLimit: 5000, initialBalance: -200 });
    expect(a).toMatchObject({ balance: -200, institutionName: 'Banca Transilvania', creditLimit: 5000 });
  });
  it.each([
    ['unknown type', { type: 'savingz' }],
    ['unknown currency', { currency: 'ABC' }],
    ['unknown country', { country: 'ZZ' }],
    ['empty name', { name: '' }],
    ['whitespace name', { name: '   ' }],
    ['61-char name', { name: 'x'.repeat(61) }],
    ['non-hex colour', { color: 'red;background:url(x)' }],
    ['icon with markup', { icon: '<script>' }],
    ['non-numeric balance', { initialBalance: 'abc' }],
    ['absurd balance', { initialBalance: 1e15 }],
    ['negative credit limit', { type: 'credit', creditLimit: -1 }],
    ['unknown institution', { institutionId: 'bank-of-nowhere' }],
    ['non-data-url image', { image: 'https://evil.example/x.png' }],
    ['oversized image', { image: `data:image/png;base64,${'A'.repeat(400_001)}` }],
  ])('rejects %s', async (_label, over) => {
    const { token } = await register();
    const r = await post('/api/accounts', { type: 'debit', name: 'Main', country: 'RO', currency: 'RON', color: '#6366f1', icon: 'wallet', ...over }, token);
    expect(r.status).toBe(400);
  });
  it('cannot share without a family', async () => {
    const { token } = await register();
    const r = await post('/api/accounts', { type: 'debit', name: 'M', country: 'RO', currency: 'RON', color: '#000000', icon: 'wallet', shared: true }, token);
    expect(r.status).toBe(403);
  });
  it("hides other users' accounts entirely", async () => {
    const a = await register();
    const b = await register();
    const acc = await account(a.token);
    expect((await get('/api/accounts', b.token)).body).toEqual([]);
    expect((await patch(`/api/accounts/${acc.id}`, { name: 'Hacked' }, b.token)).status).toBe(404);
    expect((await del(`/api/accounts/${acc.id}`, b.token)).status).toBe(404);
  });
  it('validates edits', async () => {
    const { token } = await register();
    const acc = await account(token);
    expect((await patch(`/api/accounts/${acc.id}`, { name: '' }, token)).status).toBe(400);
    expect((await patch(`/api/accounts/${acc.id}`, { color: 'blue' }, token)).status).toBe(400);
    expect((await patch(`/api/accounts/${acc.id}`, { initialBalance: 'x' }, token)).status).toBe(400);
    expect((await patch(`/api/accounts/${acc.id}`, { archived: true }, token)).body.archived).toBe(true);
  });
  it('deleting an account removes its transactions', async () => {
    const { token } = await register();
    const acc = await account(token);
    const cat = await category(token);
    await post('/api/transactions', { accountId: acc.id, kind: 'expense', amount: 10, categoryId: cat.id }, token);
    expect((await del(`/api/accounts/${acc.id}`, token)).status).toBe(204);
    expect((await get('/api/transactions', token)).body).toEqual([]);
  });
  it("won't silently change another account's balance by deleting transfer history", async () => {
    const { token } = await register();
    const a = await account(token, { name: 'A' });
    const b = await account(token, { name: 'B', initialBalance: 0 });
    await post('/api/transfers', { fromAccountId: a.id, toAccountId: b.id, amount: 300 }, token);
    const r = await del(`/api/accounts/${a.id}`, token);
    expect(r.status).toBe(409);
    const bAfter = (await get('/api/accounts', token)).body.find((x: any) => x.id === b.id);
    expect(bAfter.balance).toBe(300);
  });
});

describe('categories', () => {
  it('adds custom categories and blocks duplicates case-insensitively', async () => {
    const { token } = await register();
    expect((await post('/api/categories', { kind: 'expense', name: 'Car Wash', icon: 'car', color: '#123456' }, token)).status).toBe(201);
    expect((await post('/api/categories', { kind: 'expense', name: 'car wash' }, token)).status).toBe(400);
    // Same name is fine for the other kind.
    expect((await post('/api/categories', { kind: 'income', name: 'Car Wash' }, token)).status).toBe(201);
  });
  it.each([
    ['empty name', { name: '' }],
    ['whitespace name', { name: '  ' }],
    ['41-char name', { name: 'x'.repeat(41) }],
    ['bad kind', { kind: 'transfer' }],
    ['bad colour', { color: 'javascript:alert(1)' }],
  ])('rejects %s', async (_l, over) => {
    const { token } = await register();
    expect((await post('/api/categories', { kind: 'expense', name: 'X', ...over }, token)).status).toBe(400);
  });
  it('cannot rename into an existing name', async () => {
    const { token } = await register();
    const g = await category(token, 'expense', 'Groceries');
    expect((await patch(`/api/categories/${g.id}`, { name: 'dining out' }, token)).status).toBe(400);
  });
  it('archives used categories and deletes unused ones', async () => {
    const { token } = await register();
    const acc = await account(token);
    const used = await category(token, 'expense', 'Groceries');
    const unused = await category(token, 'expense', 'Pets');
    await post('/api/transactions', { accountId: acc.id, kind: 'expense', amount: 5, categoryId: used.id }, token);
    await del(`/api/categories/${used.id}`, token);
    await del(`/api/categories/${unused.id}`, token);
    const cats = (await get('/api/categories', token)).body;
    expect(cats.find((c: any) => c.id === used.id)?.archived).toBe(true);
    expect(cats.find((c: any) => c.id === unused.id)).toBeUndefined();
    // History keeps its label.
    expect((await get('/api/transactions', token)).body[0].categoryName).toBe('Groceries');
  });
  it("won't record new transactions in an archived category", async () => {
    const { token } = await register();
    const acc = await account(token);
    const c = await category(token, 'expense', 'Pets');
    await patch(`/api/categories/${c.id}`, { archived: true }, token);
    expect((await post('/api/transactions', { accountId: acc.id, kind: 'expense', amount: 5, categoryId: c.id }, token)).status).toBe(400);
  });
  it("can't touch someone else's categories", async () => {
    const a = await register();
    const b = await register();
    const c = await category(a.token);
    expect((await patch(`/api/categories/${c.id}`, { name: 'Mine' }, b.token)).status).toBe(404);
    expect((await del(`/api/categories/${c.id}`, b.token)).status).toBe(404);
  });
});

describe('transactions', () => {
  it('updates balances on create, edit and delete', async () => {
    const { token } = await register();
    const acc = await account(token, { initialBalance: 1000 });
    const food = await category(token);
    const salary = await category(token, 'income', 'Salary');
    const t1 = (await post('/api/transactions', { accountId: acc.id, kind: 'expense', amount: 100.5, categoryId: food.id }, token)).body;
    await post('/api/transactions', { accountId: acc.id, kind: 'income', amount: 50, categoryId: salary.id }, token);
    const bal = async () => (await get('/api/accounts', token)).body[0].balance;
    expect(await bal()).toBe(949.5);
    await patch(`/api/transactions/${t1.id}`, { amount: 200 }, token);
    expect(await bal()).toBe(850);
    await del(`/api/transactions/${t1.id}`, token);
    expect(await bal()).toBe(1050);
  });
  it('defaults the date to today and keeps the exact amount', async () => {
    const { token } = await register();
    const acc = await account(token);
    const t = (await post('/api/transactions', { accountId: acc.id, kind: 'expense', amount: 0.01, categoryId: (await category(token)).id }, token)).body;
    expect(t.amount).toBe(0.01);
    expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it.each([
    ['zero amount', { amount: 0 }],
    ['negative amount', { amount: -5 }],
    ['sub-cent amount', { amount: 0.004 }],
    ['absurd amount', { amount: 1e13 }],
    ['text amount', { amount: 'ten' }],
    ['impossible date', { date: '2026-02-30' }],
    ['month 13', { date: '2026-13-01' }],
    ['wrong date format', { date: '01/02/2026' }],
    ['ancient date', { date: '1899-12-31' }],
    ['far-future date', { date: '2200-01-01' }],
    ['201-char note', { note: 'x'.repeat(201) }],
    ['bad kind', { kind: 'refund' }],
  ])('rejects %s', async (_l, over) => {
    const { token } = await register();
    const acc = await account(token);
    const r = await post('/api/transactions', { accountId: acc.id, kind: 'expense', amount: 10, categoryId: (await category(token)).id, ...over }, token);
    expect(r.status).toBe(400);
  });
  it('accepts a 200-char note and a leap day', async () => {
    const { token } = await register();
    const acc = await account(token);
    const r = await post('/api/transactions', { accountId: acc.id, kind: 'expense', amount: 1, categoryId: (await category(token)).id, note: 'x'.repeat(200), date: '2024-02-29' }, token);
    expect(r.status).toBe(201);
  });
  it('rejects a category of the wrong kind and other users’ accounts or categories', async () => {
    const a = await register();
    const b = await register();
    const accA = await account(a.token);
    const accB = await account(b.token);
    const salary = await category(a.token, 'income', 'Salary');
    expect((await post('/api/transactions', { accountId: accA.id, kind: 'expense', amount: 1, categoryId: salary.id }, a.token)).status).toBe(400);
    expect((await post('/api/transactions', { accountId: accB.id, kind: 'expense', amount: 1, categoryId: (await category(a.token)).id }, a.token)).status).toBe(400);
    expect((await post('/api/transactions', { accountId: accA.id, kind: 'expense', amount: 1, categoryId: (await category(b.token)).id }, a.token)).status).toBe(400);
  });
  it('switching kind requires a matching category', async () => {
    const { token } = await register();
    const acc = await account(token);
    const t = (await post('/api/transactions', { accountId: acc.id, kind: 'expense', amount: 1, categoryId: (await category(token)).id }, token)).body;
    expect((await patch(`/api/transactions/${t.id}`, { kind: 'income' }, token)).status).toBe(400);
    const salary = await category(token, 'income', 'Salary');
    expect((await patch(`/api/transactions/${t.id}`, { kind: 'income', categoryId: salary.id }, token)).status).toBe(200);
  });
  it('validates edits the same way as creation', async () => {
    const { token } = await register();
    const acc = await account(token);
    const t = (await post('/api/transactions', { accountId: acc.id, kind: 'expense', amount: 1, categoryId: (await category(token)).id }, token)).body;
    expect((await patch(`/api/transactions/${t.id}`, { amount: 0 }, token)).status).toBe(400);
    expect((await patch(`/api/transactions/${t.id}`, { date: '2026-02-31' }, token)).status).toBe(400);
    expect((await patch(`/api/transactions/${t.id}`, { accountId: 'nope' }, token)).status).toBe(400);
  });
  it('filters by date range and account, and validates filters', async () => {
    const { token } = await register();
    const a1 = await account(token, { name: 'A1' });
    const a2 = await account(token, { name: 'A2' });
    const c = (await category(token)).id;
    for (const [acc, date] of [[a1, '2026-01-10'], [a1, '2026-02-10'], [a2, '2026-02-15']] as const) {
      await post('/api/transactions', { accountId: acc.id, kind: 'expense', amount: 1, categoryId: c, date }, token);
    }
    expect((await get('/api/transactions?from=2026-02-01&to=2026-02-28', token)).body).toHaveLength(2);
    expect((await get(`/api/transactions?accountId=${a1.id}`, token)).body).toHaveLength(2);
    expect((await get('/api/transactions?from=garbage', token)).status).toBe(400);
  });
  it('404s for unknown transactions', async () => {
    const { token } = await register();
    expect((await del('/api/transactions/nope', token)).status).toBe(404);
    expect((await patch('/api/transactions/nope', { amount: 1 }, token)).status).toBe(404);
  });
});

describe('transfers', () => {
  it('moves money between accounts without counting as spending', async () => {
    const { token } = await register();
    const a = await account(token, { name: 'A', initialBalance: 1000 });
    const b = await account(token, { name: 'B', initialBalance: 0 });
    const r = await post('/api/transfers', { fromAccountId: a.id, toAccountId: b.id, amount: 250, note: 'Savings' }, token);
    expect(r.status).toBe(201);
    const accs = (await get('/api/accounts', token)).body;
    expect(accs.find((x: any) => x.id === a.id).balance).toBe(750);
    expect(accs.find((x: any) => x.id === b.id).balance).toBe(250);
    expect((await get('/api/transactions', token)).body).toEqual([]);
  });
  it('converts across currencies when no received amount is given', async () => {
    const { token } = await register();
    const ron = await account(token, { currency: 'RON' });
    const eur = await account(token, { currency: 'EUR', initialBalance: 0 });
    const t = (await post('/api/transfers', { fromAccountId: ron.id, toAccountId: eur.id, amount: 100 }, token)).body;
    expect(t.toAmount).toBeGreaterThan(10);
    expect(t.toAmount).toBeLessThan(30);
  });
  it.each([
    ['same account', (a: string) => ({ fromAccountId: a, toAccountId: a, amount: 1 })],
    ['zero amount', (a: string, b: string) => ({ fromAccountId: a, toAccountId: b, amount: 0 })],
    ['unknown account', (a: string) => ({ fromAccountId: a, toAccountId: 'ghost', amount: 1 })],
    ['impossible date', (a: string, b: string) => ({ fromAccountId: a, toAccountId: b, amount: 1, date: '2026-04-31' })],
    ['negative received amount', (a: string, b: string) => ({ fromAccountId: a, toAccountId: b, amount: 1, toAmount: -1 })],
  ])('rejects %s', async (_l, build) => {
    const { token } = await register();
    const a = await account(token);
    const b = await account(token);
    expect((await post('/api/transfers', build(a.id, b.id), token)).status).toBe(400);
  });
  it("can't move money out of someone else's account", async () => {
    const a = await register();
    const b = await register();
    const accA = await account(a.token);
    const accB = await account(b.token);
    expect((await post('/api/transfers', { fromAccountId: accA.id, toAccountId: accB.id, amount: 1 }, b.token)).status).toBe(400);
    expect((await del('/api/transfers/nope', a.token)).status).toBe(404);
  });
});

describe('goals', () => {
  it('creates goals and tracks contributions', async () => {
    const { token } = await register();
    const g = (await post('/api/goals', { name: 'PS5', targetAmount: 550, currency: 'RON', initialSaved: 100 }, token)).body;
    expect(g).toMatchObject({ saved: 100, completedAt: null });
    const after = (await post(`/api/goals/${g.id}/contributions`, { amount: 450 }, token)).body;
    expect(after.saved).toBe(550);
    expect(after.completedAt).not.toBeNull();
  });
  it('starting with the full amount completes the goal immediately', async () => {
    const { token } = await register();
    const g = (await post('/api/goals', { name: 'Done', targetAmount: 100, currency: 'RON', initialSaved: 100 }, token)).body;
    expect(g.completedAt).not.toBeNull();
  });
  it("can't withdraw more than was saved", async () => {
    const { token } = await register();
    const g = (await post('/api/goals', { name: 'G', targetAmount: 1000, currency: 'RON', initialSaved: 100 }, token)).body;
    expect((await post(`/api/goals/${g.id}/contributions`, { amount: -150 }, token)).status).toBe(400);
    expect((await post(`/api/goals/${g.id}/contributions`, { amount: -100 }, token)).body.saved).toBe(0);
  });
  it('withdrawing below the target reopens an auto-completed goal', async () => {
    const { token } = await register();
    const g = (await post('/api/goals', { name: 'G', targetAmount: 100, currency: 'RON' }, token)).body;
    await post(`/api/goals/${g.id}/contributions`, { amount: 100 }, token);
    const after = (await post(`/api/goals/${g.id}/contributions`, { amount: -20 }, token)).body;
    expect(after.completedAt).toBeNull();
  });
  it.each([
    ['zero target', { targetAmount: 0 }],
    ['absurd target', { targetAmount: 1e15 }],
    ['empty name', { name: '' }],
    ['impossible deadline', { deadline: '2026-06-31' }],
    ['bad currency', { currency: 'ZZZ' }],
    ['negative already saved', { initialSaved: -5 }],
    ['bad colour', { color: 'nope' }],
  ])('rejects %s', async (_l, over) => {
    const { token } = await register();
    expect((await post('/api/goals', { name: 'G', targetAmount: 100, currency: 'RON', ...over }, token)).status).toBe(400);
  });
  it('rejects zero contributions and hides goals from strangers', async () => {
    const a = await register();
    const b = await register();
    const g = (await post('/api/goals', { name: 'G', targetAmount: 100, currency: 'RON' }, a.token)).body;
    expect((await post(`/api/goals/${g.id}/contributions`, { amount: 0 }, a.token)).status).toBe(400);
    expect((await post(`/api/goals/${g.id}/contributions`, { amount: 5 }, b.token)).status).toBe(404);
    expect((await get('/api/goals', b.token)).body).toEqual([]);
  });
});

describe('family', () => {
  it('runs the whole sharing lifecycle with correct permissions', async () => {
    const owner = await register('Robert');
    const partner = await register('Ana');
    const outsider = await register('Eve');

    expect((await post('/api/household', { name: '' }, owner.token)).status).toBe(400);
    const h = (await post('/api/household', { name: 'Home' }, owner.token)).body;
    expect((await post('/api/household', { name: 'Again' }, owner.token)).status).toBe(409);

    // Join: code is case/dash-insensitive; garbage is rejected.
    expect((await post('/api/household/join', { code: 'ZZZZ-ZZZZ' }, partner.token)).status).toBe(400);
    const joined = await post('/api/household/join', { code: h.inviteCode.toLowerCase().replace('-', '') }, partner.token);
    expect(joined.body.members).toHaveLength(2);
    expect((await post('/api/household/join', { code: h.inviteCode }, partner.token)).status).toBe(409);

    const sharedAcc = await account(owner.token, { name: 'Shared', shared: true });
    const privateAcc = await account(owner.token, { name: 'Private' });
    const cat = await category(owner.token);
    await post('/api/transactions', { accountId: privateAcc.id, kind: 'expense', amount: 9, categoryId: cat.id, note: 'secret' }, owner.token);
    const ownerTx = (await post('/api/transactions', { accountId: sharedAcc.id, kind: 'expense', amount: 10, categoryId: cat.id }, owner.token)).body;

    // Partner sees only the shared account and its activity.
    expect((await get('/api/accounts', partner.token)).body.map((a: any) => a.name)).toEqual(['Shared']);
    expect((await get('/api/transactions', partner.token)).body.every((t: any) => t.note !== 'secret')).toBe(true);
    const partnerTx = await post('/api/transactions', { accountId: sharedAcc.id, kind: 'expense', amount: 20, categoryId: (await category(partner.token)).id }, partner.token);
    expect(partnerTx.status).toBe(201);
    expect((await post('/api/transactions', { accountId: privateAcc.id, kind: 'expense', amount: 1, categoryId: (await category(partner.token)).id }, partner.token)).status).toBe(400);

    // Neither can edit the other's records; partner can't edit the account itself.
    expect((await patch(`/api/transactions/${ownerTx.id}`, { amount: 1 }, partner.token)).status).toBe(403);
    expect((await del(`/api/transactions/${partnerTx.body.id}`, owner.token)).status).toBe(403);
    expect((await patch(`/api/accounts/${sharedAcc.id}`, { name: 'Mine now' }, partner.token)).status).toBe(403);
    expect((await del(`/api/accounts/${sharedAcc.id}`, partner.token)).status).toBe(403);

    // Shared goals: partner contributes but can't edit.
    const goal = (await post('/api/goals', { name: 'Holiday', targetAmount: 1000, currency: 'RON', shared: true }, owner.token)).body;
    expect((await post(`/api/goals/${goal.id}/contributions`, { amount: 50 }, partner.token)).status).toBe(201);
    expect((await patch(`/api/goals/${goal.id}`, { name: 'x' }, partner.token)).status).toBe(403);

    // Outsider sees nothing.
    expect((await get('/api/accounts', outsider.token)).body).toEqual([]);
    expect((await get('/api/goals', outsider.token)).body).toEqual([]);

    // Owner-only actions.
    expect((await post('/api/household/invite-code', {}, partner.token)).status).toBe(403);
    expect((await del(`/api/household/members/${owner.user.id}`, partner.token)).status).toBe(403);
    expect((await del(`/api/household/members/${owner.user.id}`, owner.token)).status).toBe(400);
    const newCode = (await post('/api/household/invite-code', {}, owner.token)).body.inviteCode;
    expect(newCode).not.toBe(h.inviteCode);
    expect((await post('/api/household/join', { code: h.inviteCode }, outsider.token)).status).toBe(400);

    // Owner leaves: partner becomes owner, owner loses access to shared data.
    await post('/api/household/leave', {}, owner.token);
    const after = (await get('/api/household', partner.token)).body;
    expect(after.members).toHaveLength(1);
    expect(after.members[0].role).toBe('owner');
    expect((await get('/api/accounts', partner.token)).body).toEqual([]); // owner's account was un-shared
    expect((await get('/api/household', owner.token)).body).toBeNull();

    // Last member leaving deletes the family.
    await post('/api/household/leave', {}, partner.token);
    expect((await get('/api/household', partner.token)).body).toBeNull();
    expect((await post('/api/household/leave', {}, partner.token)).status).toBe(404);
  });
});

describe('crypto precision', () => {
  it('keeps satoshi-level amounts on crypto accounts', async () => {
    const { token } = await register();
    const btc = await account(token, { type: 'crypto', currency: 'BTC', initialBalance: 0.5, institutionId: 'binance' });
    const t = await post('/api/transactions', { accountId: btc.id, kind: 'expense', amount: 0.00012345, categoryId: (await category(token)).id }, token);
    expect(t.status).toBe(201);
    expect(t.body.amount).toBe(0.00012345);
    const bal = (await get('/api/accounts', token)).body[0].balance;
    expect(bal).toBe(0.49987655);
  });
  it('still rounds fiat to cents and rejects sub-satoshi crypto', async () => {
    const { token } = await register();
    const btc = await account(token, { type: 'crypto', currency: 'BTC', institutionId: 'binance' });
    const c = (await category(token)).id;
    expect((await post('/api/transactions', { accountId: btc.id, kind: 'expense', amount: 0.000000001, categoryId: c }, token)).status).toBe(400);
    const ron = await account(token);
    expect((await post('/api/transactions', { accountId: ron.id, kind: 'expense', amount: 1.005, categoryId: c }, token)).body.amount).toBe(1.01);
  });
  it('converts a fiat transfer into a crypto account without rounding it to zero', async () => {
    const { token } = await register();
    const eur = await account(token, { currency: 'EUR' });
    const btc = await account(token, { type: 'crypto', currency: 'BTC', institutionId: 'binance', initialBalance: 0 });
    const t = (await post('/api/transfers', { fromAccountId: eur.id, toAccountId: btc.id, amount: 10 }, token)).body;
    expect(t.toAmount).toBeGreaterThan(0);
    expect(t.toAmount).toBeLessThan(0.01);
  });
});

describe('consistency', () => {
  it('profile edits are all-or-nothing', async () => {
    const { token } = await register('Before');
    expect((await patch('/api/auth/me', { name: 'After', baseCurrency: 'NOPE' }, token)).status).toBe(400);
    expect((await get('/api/auth/me', token)).body.name).toBe('Before');
  });
  it('category edits are all-or-nothing', async () => {
    const { token } = await register();
    const c = await category(token, 'expense', 'Pets');
    expect((await patch(`/api/categories/${c.id}`, { name: 'Animals', color: 'nope' }, token)).status).toBe(400);
    expect((await category(token, 'expense', 'Pets'))?.id).toBe(c.id);
  });
  it("won't restore an archived category over an active one with the same name", async () => {
    const { token } = await register();
    const old = (await post('/api/categories', { kind: 'expense', name: 'Hobby' }, token)).body;
    await patch(`/api/categories/${old.id}`, { archived: true }, token);
    await post('/api/categories', { kind: 'expense', name: 'Hobby' }, token);
    expect((await patch(`/api/categories/${old.id}`, { archived: false }, token)).status).toBe(400);
  });
  it("can't remove a deposit that later withdrawals depend on", async () => {
    const { token } = await register();
    const g = (await post('/api/goals', { name: 'G', targetAmount: 1000, currency: 'RON' }, token)).body;
    const dep = (await post(`/api/goals/${g.id}/contributions`, { amount: 100 }, token)).body.contributions[0];
    await post(`/api/goals/${g.id}/contributions`, { amount: -80 }, token);
    expect((await del(`/api/goals/${g.id}/contributions/${dep.id}`, token)).status).toBe(400);
  });
  it('raising the target reopens a completed goal', async () => {
    const { token } = await register();
    const g = (await post('/api/goals', { name: 'G', targetAmount: 100, currency: 'RON', initialSaved: 100 }, token)).body;
    expect(g.completedAt).not.toBeNull();
    expect((await patch(`/api/goals/${g.id}`, { targetAmount: 200 }, token)).body.completedAt).toBeNull();
  });
  it('an invalid starting amount creates no goal at all', async () => {
    const { token } = await register();
    await post('/api/goals', { name: 'G', targetAmount: 100, currency: 'RON', initialSaved: 'lots' }, token);
    expect((await get('/api/goals', token)).body).toEqual([]);
  });
});

describe('demo & ai', () => {
  it('seeds demo data even after default categories were deleted or archived', async () => {
    const { token } = await register();
    for (const name of ['Housing', 'Other', 'Dining Out']) {
      const c = await category(token, 'expense', name);
      await del(`/api/categories/${c.id}`, token);
    }
    const salary = await category(token, 'income', 'Salary');
    await patch(`/api/categories/${salary.id}`, { archived: true }, token);
    expect((await post('/api/demo', {}, token)).status).toBe(201);
  });
  it('seeds demo data once, only into an empty profile', async () => {
    const { token } = await register();
    const r = await post('/api/demo', {}, token);
    expect(r.status).toBe(201);
    expect(r.body.transactions).toBeGreaterThan(300);
    expect((await post('/api/demo', {}, token)).status).toBe(409);
    const accs = (await get('/api/accounts', token)).body;
    expect(accs.length).toBe(5);
    expect(accs.every((a: any) => Number.isFinite(a.balance))).toBe(true);
  });
  it('investment summary works with no data, and analysis needs history', async () => {
    const { token } = await register();
    const s = await get('/api/ai/investment', token);
    expect(s.status).toBe(200);
    expect(s.body.summary.monthsAnalyzed).toBe(0);
    expect(s.body.advice).toBeNull();
    expect((await post('/api/ai/investment', {}, token)).status).toBe(400);
  });
});

describe('profile', () => {
  // A minimal WebP header: enough for the storage's "is this really an image" check.
  const WEBP = new Uint8Array([82, 73, 70, 70, 20, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 32, 1, 2, 3, 4]);
  const putFile = (url: string, type: string, body: Uint8Array) =>
    fetch(url.startsWith('http') ? url : base + url, { method: 'PUT', headers: { 'Content-Type': type }, body });

  it('bio is saved with the profile and capped at 280 characters', async () => {
    const { token } = await register();
    expect((await get('/api/auth/me', token)).body).toMatchObject({ bio: '', avatarUrl: null });
    expect((await patch('/api/auth/me', { bio: ' Saving for a sailboat. ' }, token)).body.bio).toBe('Saving for a sailboat.');
    expect((await patch('/api/auth/me', { bio: 'x'.repeat(281) }, token)).status).toBe(400);
  });

  it('a photo goes to storage with a signed link; the profile keeps only its URL', async () => {
    const { token } = await register();
    const ticket = await post('/api/me/avatar/uploads', { contentType: 'image/webp', size: WEBP.length }, token);
    expect(ticket.status).toBe(201);
    const { key, upload } = ticket.body;
    expect(upload.method).toBe('PUT');
    // Not uploaded yet, wrong type, tampered link: all refused.
    expect((await call('PUT', '/api/me/avatar', { key }, token)).status).toBe(400);
    expect((await putFile(upload.url, 'image/png', WEBP)).status).toBe(400);
    expect((await putFile(upload.url.replace(/sig=[0-9a-f]+/, 'sig=00'), 'image/webp', WEBP)).status).toBe(403);
    // The signed link works without a session, exactly as a browser sends it.
    expect((await putFile(upload.url, 'image/webp', WEBP)).status).toBe(200);
    const me = await call('PUT', '/api/me/avatar', { key }, token);
    expect(me.status).toBe(200);
    const served = await fetch(base + me.body.avatarUrl);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/webp');
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(WEBP);
    // Removing it deletes the object too.
    expect((await del('/api/me/avatar', token)).body.avatarUrl).toBeNull();
    expect((await fetch(base + me.body.avatarUrl)).status).toBe(404);
  });

  it('photo endpoints need a session and only accept images', async () => {
    const { token } = await register();
    expect((await post('/api/me/avatar/uploads', { contentType: 'image/webp' })).status).toBe(401);
    expect((await post('/api/me/avatar/uploads', { contentType: 'image/svg+xml' }, token)).status).toBe(400);
    expect((await post('/api/me/avatar/uploads', { contentType: 'image/webp', size: 5_000_000 }, token)).status).toBe(400);
  });
});
