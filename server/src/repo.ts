import { roundFor } from '@ft/core';
import type { Account, Category, Goal, GoalContribution, Household, Transaction, Transfer, User } from '@ft/core';
import { all, get, type Row } from './db';

export const toUser = (r: Row): User => ({
  id: r.id as string,
  email: r.email as string,
  name: r.name as string,
  baseCurrency: r.base_currency as string,
  country: r.country as string,
  createdAt: r.created_at as string,
});

export const toAccount = (r: Row): Account => ({
  id: r.id as string,
  ownerId: r.owner_id as string,
  householdId: (r.household_id as string) ?? null,
  type: r.type as Account['type'],
  name: r.name as string,
  institutionId: (r.institution_id as string) ?? null,
  institutionName: (r.institution_name as string) ?? null,
  country: r.country as string,
  currency: r.currency as string,
  color: r.color as string,
  icon: r.icon as string,
  image: (r.image as string) ?? null,
  initialBalance: r.initial_balance as number,
  creditLimit: (r.credit_limit as number) ?? null,
  archived: !!r.archived,
  createdAt: r.created_at as string,
  balance: roundFor((r.initial_balance as number) + ((r.flow as number) ?? 0), r.currency as string),
});

export const toCategory = (r: Row): Category => ({
  id: r.id as string,
  userId: r.user_id as string,
  kind: r.kind as Category['kind'],
  name: r.name as string,
  icon: r.icon as string,
  color: r.color as string,
  isDefault: !!r.is_default,
  archived: !!r.archived,
});

export const toTransaction = (r: Row): Transaction => ({
  id: r.id as string,
  accountId: r.account_id as string,
  userId: r.user_id as string,
  kind: r.kind as Transaction['kind'],
  amount: r.amount as number,
  currency: r.currency as string,
  categoryId: r.category_id as string,
  categoryName: r.category_name as string,
  categoryColor: r.category_color as string,
  categoryIcon: r.category_icon as string,
  date: r.date as string,
  note: (r.note as string) ?? null,
  createdAt: r.created_at as string,
});

export const toContribution = (r: Row): GoalContribution => ({
  id: r.id as string,
  goalId: r.goal_id as string,
  userId: r.user_id as string,
  amount: r.amount as number,
  date: r.date as string,
  note: (r.note as string) ?? null,
});

export function householdIdOf(userId: string): string | null {
  return get<{ household_id: string }>('SELECT household_id FROM household_members WHERE user_id = ?', userId)?.household_id ?? null;
}

/** Accounts a user may see: their own, plus any shared into their household. */
const VISIBLE_ACCOUNTS = `(a.owner_id = ? OR (a.household_id IS NOT NULL AND a.household_id = ?))`;

export function visibleAccounts(userId: string): Account[] {
  const hh = householdIdOf(userId);
  return all(
    `SELECT a.*, COALESCE((SELECT SUM(CASE WHEN t.kind = 'income' THEN t.amount ELSE -t.amount END)
        FROM transactions t WHERE t.account_id = a.id), 0)
      + COALESCE((SELECT SUM(x.to_amount) FROM transfers x WHERE x.to_account_id = a.id), 0)
      - COALESCE((SELECT SUM(x.amount) FROM transfers x WHERE x.from_account_id = a.id), 0) AS flow
     FROM accounts a WHERE ${VISIBLE_ACCOUNTS} ORDER BY a.archived, a.created_at`,
    userId,
    hh,
  ).map(toAccount);
}

export function accountFor(userId: string, accountId: string): Account | undefined {
  const hh = householdIdOf(userId);
  const r = get(`SELECT a.*, 0 AS flow FROM accounts a WHERE a.id = ? AND ${VISIBLE_ACCOUNTS}`, accountId, userId, hh);
  return r ? toAccount(r) : undefined;
}

const TX_SELECT = `SELECT t.*, a.currency, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
  FROM transactions t JOIN accounts a ON a.id = t.account_id JOIN categories c ON c.id = t.category_id`;

export function visibleTransactions(userId: string, filter: { from?: string; to?: string; accountId?: string } = {}): Transaction[] {
  const hh = householdIdOf(userId);
  const where = [VISIBLE_ACCOUNTS];
  const params: unknown[] = [userId, hh];
  if (filter.from) (where.push('t.date >= ?'), params.push(filter.from));
  if (filter.to) (where.push('t.date <= ?'), params.push(filter.to));
  if (filter.accountId) (where.push('t.account_id = ?'), params.push(filter.accountId));
  return all(`${TX_SELECT} WHERE ${where.join(' AND ')} ORDER BY t.date DESC, t.created_at DESC`, ...params).map(toTransaction);
}

export function transactionById(id: string): Transaction | undefined {
  const r = get(`${TX_SELECT} WHERE t.id = ?`, id);
  return r ? toTransaction(r) : undefined;
}

export function visibleTransfers(userId: string): Transfer[] {
  const hh = householdIdOf(userId);
  return all(
    `SELECT x.* FROM transfers x
     JOIN accounts a ON a.id = x.from_account_id JOIN accounts b ON b.id = x.to_account_id
     WHERE (a.owner_id = ? OR (a.household_id IS NOT NULL AND a.household_id = ?))
        OR (b.owner_id = ? OR (b.household_id IS NOT NULL AND b.household_id = ?))
     ORDER BY x.date DESC, x.created_at DESC`,
    userId,
    hh,
    userId,
    hh,
  ).map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    fromAccountId: r.from_account_id as string,
    toAccountId: r.to_account_id as string,
    amount: r.amount as number,
    toAmount: r.to_amount as number,
    date: r.date as string,
    note: (r.note as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

export function visibleGoals(userId: string): Goal[] {
  const hh = householdIdOf(userId);
  const goals = all(
    `SELECT * FROM goals WHERE user_id = ? OR (household_id IS NOT NULL AND household_id = ?) ORDER BY completed_at IS NOT NULL, created_at`,
    userId,
    hh,
  );
  return goals.map((g) => {
    const contributions = all('SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY date DESC', g.id).map(toContribution);
    return {
      id: g.id as string,
      userId: g.user_id as string,
      householdId: (g.household_id as string) ?? null,
      name: g.name as string,
      targetAmount: g.target_amount as number,
      currency: g.currency as string,
      deadline: (g.deadline as string) ?? null,
      icon: g.icon as string,
      color: g.color as string,
      image: (g.image as string) ?? null,
      createdAt: g.created_at as string,
      completedAt: (g.completed_at as string) ?? null,
      saved: roundFor(contributions.reduce((s, c) => s + c.amount, 0), g.currency as string),
      contributions,
    };
  });
}

export function householdFor(userId: string): Household | null {
  const hh = householdIdOf(userId);
  if (!hh) return null;
  const h = get('SELECT * FROM households WHERE id = ?', hh)!;
  const members = all(
    `SELECT m.user_id, m.role, m.joined_at, u.name, u.email FROM household_members m JOIN users u ON u.id = m.user_id
     WHERE m.household_id = ? ORDER BY m.joined_at`,
    hh,
  );
  return {
    id: h.id as string,
    name: h.name as string,
    inviteCode: h.invite_code as string,
    createdBy: h.created_by as string,
    createdAt: h.created_at as string,
    members: members.map((m) => ({
      userId: m.user_id as string,
      name: m.name as string,
      email: m.email as string,
      role: m.role as 'owner' | 'member',
      joinedAt: m.joined_at as string,
    })),
  };
}
