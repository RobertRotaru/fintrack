import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { DEFAULT_CATEGORIES, FX_PER_EUR, addDays, addMonths, daysInMonth, institutionsFor, monthKey, toISODate } from '@ft/core';
import { all, get, run, tx } from '../db';
import { HttpError, uid } from '../http';

/**
 * Fills an empty profile with ~13 months of realistic activity so reports,
 * insights and projections have something to show. Only allowed when the user
 * has no transactions yet.
 */
export const demo = Router();

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

demo.post('/', (req, res) => {
  const me = uid(req);
  if (get('SELECT 1 FROM transactions WHERE user_id = ? LIMIT 1', me) || get('SELECT 1 FROM accounts WHERE owner_id = ? LIMIT 1', me)) {
    throw new HttpError(409, 'Demo data can only be loaded into an empty profile.');
  }
  const user = get('SELECT * FROM users WHERE id = ?', me)!;
  const currency = user.base_currency as string;
  const country = user.country as string;
  const k = FX_PER_EUR[currency] ?? 1; // amounts below are in EUR
  const rand = rng(42);
  const between = (a: number, b: number) => Math.round((a + rand() * (b - a)) * k * 100) / 100;
  // Use the user's active categories; recreate any default the demo needs that
  // was deleted or archived, instead of failing on a missing category.
  const cats = new Map(all('SELECT id, kind, name FROM categories WHERE user_id = ? AND archived = 0', me).map((c) => [`${c.kind}:${c.name}`, c.id as string]));
  const cat = (kind: string, name: string) => {
    const key = `${kind}:${name}`;
    let id = cats.get(key);
    if (!id) {
      const def = DEFAULT_CATEGORIES.find((c) => c.kind === kind && c.name === name)!;
      id = randomUUID();
      run('INSERT INTO categories (id, user_id, kind, name, icon, color, is_default) VALUES (?, ?, ?, ?, ?, ?, 1)', id, me, kind, name, def.icon, def.color);
      cats.set(key, id);
    }
    return id;
  };

  const banks = institutionsFor(country, 'debit');
  const main = banks[0];
  const accountIds: Record<string, string> = {};
  const addAccount = (key: string, type: string, name: string, instId: string | null, color: string, icon: string, initial: number, acctCurrency = currency, creditLimit: number | null = null) => {
    const id = randomUUID();
    run(
      `INSERT INTO accounts (id, owner_id, type, name, institution_id, institution_name, country, currency, color, icon, initial_balance, credit_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, me, type, name, instId, banks.concat(institutionsFor(country)).find((b) => b.id === instId)?.name ?? null,
      country, acctCurrency, color, icon, initial, creditLimit,
    );
    accountIds[key] = id;
  };

  const today = new Date();
  const start = addMonths(monthKey(today), -12);
  const txs: [string, string, number, string, string, string | null][] = [];
  const creditSpent = new Map<string, number>();
  const add = (acct: string, kind: 'expense' | 'income', amount: number, category: string, date: string, note: string | null = null) => {
    if (date > toISODate(today)) return;
    if (acct === 'credit') creditSpent.set(date.slice(0, 7), (creditSpent.get(date.slice(0, 7)) ?? 0) + amount);
    txs.push([accountIds[acct], kind, amount, cat(kind, category), date, note]);
  };

  const transfer = (from: string, to: string, amount: number, date: string, note: string) => {
    if (date > toISODate(today)) return;
    run(
      'INSERT INTO transfers (id, user_id, from_account_id, to_account_id, amount, to_amount, date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      randomUUID(), me, accountIds[from], accountIds[to], amount, amount, date, note,
    );
  };

  tx(() => {
    addAccount('main', 'debit', 'Everyday', main?.id ?? null, main?.color ?? '#6366f1', 'wallet', Math.round(1800 * k));
    addAccount('credit', 'credit', 'Rewards card', main?.id ?? null, '#0f172a', 'wallet-cards', 0, currency, Math.round(3000 * k));
    addAccount('savings', 'savings', 'Rainy day fund', main?.id ?? null, '#10b981', 'piggy-bank', Math.round(6500 * k));
    addAccount('invest', 'investment', 'Index portfolio', 'trading212', '#1B9CFC', 'trending-up', Math.round(4200 * k));
    addAccount('cash', 'cash', 'Wallet cash', null, '#84cc16', 'banknote', Math.round(80 * k));

    for (let m = start, i = 0; m <= monthKey(today); m = addMonths(m, 1), i++) {
      const dim = daysInMonth(m);
      const d = (day: number) => `${m}-${String(Math.min(day, dim)).padStart(2, '0')}`;
      const anyDay = () => d(1 + Math.floor(rand() * dim));
      const month = Number(m.slice(5, 7));
      const recent = i >= 10; // last ~3 months drift a bit to give insights something to find

      add('main', 'income', Math.round((i >= 7 ? 3450 : 3200) * k), 'Salary', d(10), 'Monthly salary');
      if (month === 12 || month === 6) add('main', 'income', Math.round(1500 * k), 'Bonus', d(20), 'Performance bonus');
      if (rand() < 0.45) add('main', 'income', between(250, 900), 'Freelance', anyDay(), 'Side project');
      add('savings', 'income', between(12, 18), 'Interest', d(28), 'Savings interest');
      if (rand() < 0.15) add('main', 'income', between(20, 120), 'Refunds', anyDay(), 'Return');

      add('main', 'expense', Math.round(900 * k), 'Housing', d(1), 'Rent');
      const winter = [1, 2, 11, 12].includes(month);
      add('main', 'expense', between(winter ? 140 : 70, winter ? 190 : 100), 'Utilities', d(18), 'Electricity & gas');
      add('main', 'expense', Math.round(35 * k), 'Internet & Phone', d(15), 'Internet & mobile');
      add('credit', 'expense', Math.round(13.99 * k * 100) / 100, 'Subscriptions', d(5), 'Netflix');
      add('credit', 'expense', Math.round(10.99 * k * 100) / 100, 'Subscriptions', d(12), 'Spotify');
      add('main', 'expense', Math.round(40 * k), 'Sports & Fitness', d(3), 'Gym membership');
      add('main', 'expense', Math.round(55 * k), 'Insurance', d(25), 'Health insurance');

      for (let n = 0; n < 6 + Math.floor(rand() * 4); n++) add(rand() < 0.7 ? 'main' : 'credit', 'expense', between(25, 110), 'Groceries', anyDay());
      for (let n = 0; n < (recent ? 9 : 5) + Math.floor(rand() * 4); n++) add('credit', 'expense', between(14, recent ? 70 : 50), 'Dining Out', anyDay());
      for (let n = 0; n < 8 + Math.floor(rand() * 8); n++) add('cash', 'expense', between(2.5, 6), 'Coffee & Snacks', anyDay());
      for (let n = 0; n < 6; n++) add('main', 'expense', between(2, 14), 'Transport', anyDay());
      for (let n = 0; n < 2 + Math.floor(rand() * 2); n++) add('credit', 'expense', between(50, 75), 'Fuel', anyDay());
      for (let n = 0; n < 2 + Math.floor(rand() * 3); n++) add('credit', 'expense', between(20, 160), 'Shopping', anyDay());
      for (let n = 0; n < 1 + Math.floor(rand() * 3); n++) add('credit', 'expense', between(12, 60), 'Entertainment', anyDay());
      if (rand() < 0.4) add('main', 'expense', between(20, 140), 'Health', anyDay(), 'Pharmacy');
      if (rand() < 0.5) add('main', 'expense', between(15, 45), 'Personal Care', anyDay(), 'Haircut');
      if ([7, 8].includes(month)) add('credit', 'expense', between(700, 1400), 'Travel', d(5), 'Summer holiday');
      if (month === 12) for (let n = 0; n < 4; n++) add('credit', 'expense', between(30, 150), 'Gifts & Donations', d(10 + n * 3), 'Christmas gifts');
      if (rand() < 0.2) add('main', 'expense', between(80, 250), 'Taxes & Fees', anyDay());

      // Money moved between accounts: pay off last month's card, top up savings, invest, withdraw cash.
      const prevSpent = creditSpent.get(addMonths(m, -1));
      if (prevSpent) transfer('main', 'credit', Math.round(prevSpent * 100) / 100, d(3), 'Card repayment');
      transfer('main', 'savings', Math.round(400 * k), d(11), 'Monthly saving');
      transfer('main', 'invest', Math.round(300 * k), d(11), 'Monthly investment');
      transfer('main', 'cash', Math.round(100 * k), d(2), 'ATM withdrawal');
    }

    for (const [account, kind, amount, category, date, note] of txs) {
      run(
        'INSERT INTO transactions (id, account_id, user_id, kind, amount, category_id, date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        randomUUID(), account, me, kind, amount, category, date, note,
      );
    }

    const goal = (name: string, target: number, deadline: string | null, icon: string, color: string, contributions: number[]) => {
      const id = randomUUID();
      run('INSERT INTO goals (id, user_id, name, target_amount, currency, deadline, icon, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        id, me, name, Math.round(target * k), currency, deadline, icon, color);
      contributions.forEach((amount, idx) => {
        run('INSERT INTO goal_contributions (id, goal_id, user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, NULL)',
          randomUUID(), id, me, Math.round(amount * k), toISODate(addDays(today, -30 * (contributions.length - idx))));
      });
    };
    goal('PlayStation 5', 550, null, 'gamepad-2', '#3b82f6', [120, 100, 90]);
    goal('New car', 18000, toISODate(addDays(today, 540)), 'car', '#ef4444', [3000, 400, 450, 500, 400, 500]);
    goal('Japan trip', 4000, toISODate(addDays(today, 300)), 'plane', '#ec4899', [500, 250, 250]);
  });

  res.status(201).json({ ok: true, transactions: txs.length });
});
