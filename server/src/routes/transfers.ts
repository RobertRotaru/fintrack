import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { convert, round2, toISODate } from '@ft/core';
import { run } from '../db';
import { bad, forbidden, isoDate, notFound, num, str, uid } from '../http';
import { accountFor, visibleTransfers } from '../repo';

export const transfers = Router();

transfers.get('/', (req, res) => {
  res.json(visibleTransfers(uid(req)));
});

transfers.post('/', (req, res) => {
  const me = uid(req);
  const b = req.body;
  const from = accountFor(me, str(b.fromAccountId, 'From account'));
  const to = accountFor(me, str(b.toAccountId, 'To account'));
  if (!from || !to) throw bad('Unknown account');
  if (from.id === to.id) throw bad('Pick two different accounts');
  const amount = num(b.amount, 'Amount', { min: 0.01 });
  const toAmount =
    b.toAmount !== undefined && b.toAmount !== '' ? num(b.toAmount, 'Received amount', { min: 0.01 }) : round2(convert(amount, from.currency, to.currency));
  const id = randomUUID();
  run(
    'INSERT INTO transfers (id, user_id, from_account_id, to_account_id, amount, to_amount, date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    me,
    from.id,
    to.id,
    amount,
    toAmount,
    b.date ? isoDate(b.date, 'Date') : toISODate(new Date()),
    str(b.note, 'Note', { max: 200, optional: true }) || null,
  );
  res.status(201).json(visibleTransfers(me).find((x) => x.id === id));
});

transfers.delete('/:id', (req, res) => {
  const me = uid(req);
  const x = visibleTransfers(me).find((t) => t.id === req.params.id);
  if (!x) throw notFound('Transfer not found');
  if (x.userId !== me) throw forbidden('Only the person who added this can remove it');
  run('DELETE FROM transfers WHERE id = ?', x.id);
  res.status(204).end();
});
