import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { COUNTRIES, CURRENCIES, decimalsFor, findInstitution, type AccountType } from '@ft/core';
import { get, run } from '../db';
import { HttpError, bad, forbidden, hexColor, iconName, image, notFound, num, oneOf, str, uid } from '../http';
import { accountFor, householdIdOf, visibleAccounts } from '../repo';

export const accounts = Router();
const TYPES: AccountType[] = ['debit', 'credit', 'savings', 'loan', 'investment', 'crypto', 'cash'];
const COUNTRY_CODES = COUNTRIES.map((c) => c.code);

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
  if (institutionId && !inst) throw bad('Unknown bank or provider');
  const type = oneOf(b.type, 'Type', TYPES);
  const currency = oneOf(b.currency, 'Currency', CURRENCIES);
  const limit = num(b.creditLimit, 'Credit limit', { optional: true, min: 0 });
  const id = randomUUID();
  run(
    `INSERT INTO accounts (id, owner_id, household_id, type, name, institution_id, institution_name, country, currency,
       color, icon, image, initial_balance, credit_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    me,
    sharedHousehold(me, b.shared),
    type,
    str(b.name, 'Name', { max: 60 }),
    institutionId,
    inst?.name ?? (str(b.institutionName, 'Institution', { max: 80, optional: true }) || null),
    oneOf(b.country, 'Country', COUNTRY_CODES),
    currency,
    hexColor(b.color),
    iconName(b.icon),
    image(b.image),
    num(b.initialBalance ?? 0, 'Opening balance', { decimals: decimalsFor(currency) }),
    type === 'credit' && !Number.isNaN(limit) ? limit : null,
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
  if (b.color !== undefined) set('color', hexColor(b.color));
  if (b.icon !== undefined) set('icon', iconName(b.icon));
  if (b.image !== undefined) set('image', image(b.image));
  if (b.initialBalance !== undefined) set('initial_balance', num(b.initialBalance, 'Opening balance', { decimals: decimalsFor(acc.currency) }));
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
  // Deleting transfers would silently change the other account's balance.
  const transfers = get<{ n: number }>('SELECT COUNT(*) AS n FROM transfers WHERE from_account_id = ? OR to_account_id = ?', acc.id, acc.id)!.n;
  if (transfers) {
    throw new HttpError(409, `This account has ${transfers} transfer${transfers > 1 ? 's' : ''} with other accounts. Archive it instead, or delete those transfers first.`);
  }
  run('DELETE FROM accounts WHERE id = ?', acc.id);
  res.status(204).end();
});
