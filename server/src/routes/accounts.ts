import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { CURRENCIES, findInstitution, type AccountType } from '@ft/core';
import { run } from '../db';
import { forbidden, image, notFound, num, oneOf, str, uid } from '../http';
import { accountFor, householdIdOf, visibleAccounts } from '../repo';

export const accounts = Router();
const TYPES: AccountType[] = ['debit', 'credit', 'savings', 'loan', 'investment', 'crypto', 'cash'];

accounts.get('/', (req, res) => {
  res.json(visibleAccounts(uid(req)));
});

function sharedHousehold(userId: string, shared: unknown): string | null {
  if (!shared) return null;
  const hh = householdIdOf(userId);
  if (!hh) throw forbidden('Join or create a family first to share accounts');
  return hh;
}

accounts.post('/', (req, res) => {
  const me = uid(req);
  const b = req.body;
  const institutionId = b.institutionId ? str(b.institutionId, 'Institution', { max: 60 }) : null;
  const inst = findInstitution(institutionId);
  const id = randomUUID();
  run(
    `INSERT INTO accounts (id, owner_id, household_id, type, name, institution_id, institution_name, country, currency,
       color, icon, image, initial_balance, credit_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    me,
    sharedHousehold(me, b.shared),
    oneOf(b.type, 'Type', TYPES),
    str(b.name, 'Name', { max: 60 }),
    institutionId,
    inst?.name ?? (str(b.institutionName, 'Institution', { max: 80, optional: true }) || null),
    str(b.country, 'Country', { max: 2 }),
    oneOf(b.currency, 'Currency', CURRENCIES),
    str(b.color, 'Colour', { max: 20 }),
    str(b.icon, 'Icon', { max: 40 }),
    image(b.image),
    num(b.initialBalance ?? 0, 'Opening balance'),
    Number.isNaN(num(b.creditLimit, 'Credit limit', { optional: true, min: 0 })) ? null : num(b.creditLimit, 'Credit limit'),
  );
  res.status(201).json(visibleAccounts(me).find((a) => a.id === id));
});

accounts.patch('/:id', (req, res) => {
  const me = uid(req);
  const acc = accountFor(me, req.params.id);
  if (!acc) throw notFound('Account not found');
  if (acc.ownerId !== me) throw forbidden('Only the owner can edit this account');
  const b = req.body;
  const sets: string[] = [];
  const params: unknown[] = [];
  const set = (col: string, v: unknown) => (sets.push(`${col} = ?`), params.push(v));
  if (b.name !== undefined) set('name', str(b.name, 'Name', { max: 60 }));
  if (b.color !== undefined) set('color', str(b.color, 'Colour', { max: 20 }));
  if (b.icon !== undefined) set('icon', str(b.icon, 'Icon', { max: 40 }));
  if (b.image !== undefined) set('image', image(b.image));
  if (b.initialBalance !== undefined) set('initial_balance', num(b.initialBalance, 'Opening balance'));
  if (b.creditLimit !== undefined) set('credit_limit', b.creditLimit === null ? null : num(b.creditLimit, 'Credit limit', { min: 0 }));
  if (b.archived !== undefined) set('archived', b.archived ? 1 : 0);
  if (b.shared !== undefined) set('household_id', sharedHousehold(me, b.shared));
  if (sets.length) run(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`, ...params, acc.id);
  res.json(visibleAccounts(me).find((a) => a.id === acc.id));
});

accounts.delete('/:id', (req, res) => {
  const me = uid(req);
  const acc = accountFor(me, req.params.id);
  if (!acc) throw notFound('Account not found');
  if (acc.ownerId !== me) throw forbidden('Only the owner can delete this account');
  run('DELETE FROM accounts WHERE id = ?', acc.id);
  res.status(204).end();
});
