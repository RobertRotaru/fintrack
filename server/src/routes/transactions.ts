import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { toISODate } from '@ft/core';
import { get, run } from '../db';
import { bad, forbidden, isoDate, notFound, num, oneOf, str, uid } from '../http';
import { accountFor, transactionById, visibleTransactions } from '../repo';

export const transactions = Router();

transactions.get('/', (req, res) => {
  const q = req.query;
  res.json(
    visibleTransactions(uid(req), {
      from: typeof q.from === 'string' ? q.from : undefined,
      to: typeof q.to === 'string' ? q.to : undefined,
      accountId: typeof q.accountId === 'string' ? q.accountId : undefined,
    }),
  );
});

function checkCategory(userId: string, categoryId: unknown, kind: string) {
  const id = str(categoryId, 'Category');
  const cat = get('SELECT kind FROM categories WHERE id = ? AND user_id = ?', id, userId);
  if (!cat) throw bad('Unknown category');
  if (cat.kind !== kind) throw bad(`That category is for ${cat.kind}s`);
  return id;
}

transactions.post('/', (req, res) => {
  const me = uid(req);
  const b = req.body;
  const acc = accountFor(me, str(b.accountId, 'Account'));
  if (!acc) throw bad('Unknown account');
  const kind = oneOf(b.kind, 'Kind', ['expense', 'income'] as const);
  const id = randomUUID();
  run(
    'INSERT INTO transactions (id, account_id, user_id, kind, amount, category_id, date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    acc.id,
    me,
    kind,
    num(b.amount, 'Amount', { min: 0.01 }),
    checkCategory(me, b.categoryId, kind),
    b.date ? isoDate(b.date, 'Date') : toISODate(new Date()),
    str(b.note, 'Note', { max: 200, optional: true }) || null,
  );
  res.status(201).json(transactionById(id));
});

function editable(userId: string, id: string) {
  const t = transactionById(id);
  if (!t || !accountFor(userId, t.accountId)) throw notFound('Transaction not found');
  if (t.userId !== userId) throw forbidden('Only the person who added this can change it');
  return t;
}

transactions.patch('/:id', (req, res) => {
  const me = uid(req);
  const t = editable(me, req.params.id);
  const b = req.body;
  const kind = b.kind !== undefined ? oneOf(b.kind, 'Kind', ['expense', 'income'] as const) : t.kind;
  const accountId = b.accountId !== undefined ? accountFor(me, str(b.accountId, 'Account'))?.id : t.accountId;
  if (!accountId) throw bad('Unknown account');
  run(
    'UPDATE transactions SET account_id = ?, kind = ?, amount = ?, category_id = ?, date = ?, note = ? WHERE id = ?',
    accountId,
    kind,
    b.amount !== undefined ? num(b.amount, 'Amount', { min: 0.01 }) : t.amount,
    b.categoryId !== undefined || b.kind !== undefined ? checkCategory(me, b.categoryId ?? t.categoryId, kind) : t.categoryId,
    b.date !== undefined ? isoDate(b.date, 'Date') : t.date,
    b.note !== undefined ? str(b.note, 'Note', { max: 200, optional: true }) || null : t.note,
    t.id,
  );
  res.json(transactionById(t.id));
});

transactions.delete('/:id', (req, res) => {
  const t = editable(uid(req), req.params.id);
  run('DELETE FROM transactions WHERE id = ?', t.id);
  res.status(204).end();
});
