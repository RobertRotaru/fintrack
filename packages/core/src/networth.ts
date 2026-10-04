import type { Account, Transaction, Transfer } from './types';
import { convert } from './currency';
import { addDays, parseDate, toISODate } from './dates';

/**
 * Balance history, reconstructed backwards from today's balances: an account's
 * balance at the end of a day is its current balance minus every flow that
 * landed after that day. Transfers between two of your own accounts move money
 * around without changing net worth (beyond FX differences).
 */

export type NetWorthRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export const NET_WORTH_RANGES: NetWorthRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];

export interface Flow {
  accountId: string;
  date: string; // yyyy-MM-dd
  /** In the account's own currency. */
  amount: number;
}

export interface NetWorthPoint {
  date: string;
  value: number;
}

type BalanceAccount = Pick<Account, 'id' | 'currency' | 'balance'>;

export function accountFlows(transactions: Pick<Transaction, 'accountId' | 'date' | 'kind' | 'amount'>[], transfers: Pick<Transfer, 'fromAccountId' | 'toAccountId' | 'date' | 'amount' | 'toAmount'>[] = []): Flow[] {
  const out: Flow[] = [];
  for (const t of transactions) out.push({ accountId: t.accountId, date: t.date, amount: t.kind === 'income' ? t.amount : -t.amount });
  for (const x of transfers) {
    out.push({ accountId: x.fromAccountId, date: x.date, amount: -x.amount });
    out.push({ accountId: x.toAccountId, date: x.date, amount: x.toAmount });
  }
  return out;
}

/** Total of the given accounts (in `base`) at the end of `date`. */
export function totalAt(accounts: BalanceAccount[], flows: Flow[], date: string, base: string): number {
  const ids = new Map(accounts.map((a) => [a.id, a]));
  let total = 0;
  for (const a of accounts) total += convert(a.balance, a.currency, base);
  for (const f of flows) {
    const a = ids.get(f.accountId);
    if (a && f.date > date) total -= convert(f.amount, a.currency, base);
  }
  return total;
}

export interface BalanceChange {
  now: number;
  then: number;
  change: number;
  /** Percentage change, or null when there was nothing to compare against. */
  pct: number | null;
}

/** How a set of accounts moved since the end of `since` (e.g. the last day of last month). */
export function balanceChange(accounts: BalanceAccount[], flows: Flow[], since: string, base: string): BalanceChange {
  const now = accounts.reduce((s, a) => s + convert(a.balance, a.currency, base), 0);
  const then = totalAt(accounts, flows, since, base);
  const change = now - then;
  return { now, then, change, pct: Math.abs(then) < 0.005 ? null : (change / Math.abs(then)) * 100 };
}

/** First day shown for a range; ALL starts at the earliest flow (at least a month back). */
export function rangeStart(range: NetWorthRange, flows: Flow[], today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Same day N months back, clamped so 31 March → 28/29 February, not 3 March.
  const back = (months: number) => {
    const last = new Date(d.getFullYear(), d.getMonth() - months + 1, 0).getDate();
    return toISODate(new Date(d.getFullYear(), d.getMonth() - months, Math.min(d.getDate(), last)));
  };
  if (range === '1M') return back(1);
  if (range === '3M') return back(3);
  if (range === '6M') return back(6);
  if (range === '1Y') return back(12);
  const earliest = flows.reduce((min, f) => (f.date < min ? f.date : min), toISODate(d));
  const monthAgo = back(1);
  return earliest < monthAgo ? toISODate(addDays(parseDate(earliest), -1)) : monthAgo;
}

/**
 * Net worth over a range, ending today. Daily points up to three months,
 * weekly up to a year, then monthly — enough detail for a smooth curve
 * without thousands of points.
 */
export function netWorthSeries(accounts: BalanceAccount[], flows: Flow[], base: string, range: NetWorthRange, today = new Date()): NetWorthPoint[] {
  const end = toISODate(today);
  const start = rangeStart(range, flows, today);
  const days = Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86_400_000);
  const step = days <= 100 ? 1 : days <= 400 ? 7 : 30;

  const dates: string[] = [];
  for (let i = days; i > 0; i -= step) dates.push(toISODate(addDays(parseDate(end), -i)));
  dates.push(end);

  // One sweep, newest first: undo flows as we walk back past their dates.
  const cur = new Map(accounts.map((a) => [a.id, a]));
  const sorted = flows.filter((f) => cur.has(f.accountId)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  let value = accounts.reduce((s, a) => s + convert(a.balance, a.currency, base), 0);
  let i = 0;
  const out: NetWorthPoint[] = [];
  for (let k = dates.length - 1; k >= 0; k--) {
    const date = dates[k];
    while (i < sorted.length && sorted[i].date > date) {
      const f = sorted[i++];
      value -= convert(f.amount, cur.get(f.accountId)!.currency, base);
    }
    out.push({ date, value: Math.round(value * 100) / 100 });
  }
  return out.reverse();
}

// ---------------------------------------------------------------------------
// The home page's opening line.

export interface Mood {
  tone: 'great' | 'good' | 'watch' | 'steady' | 'new';
  headline: string;
  subline: string;
}

/**
 * Turns the month's numbers into one honest, human sentence. Encouraging when
 * things are on track; calm and specific when they aren't.
 *
 * @param netWorthPct  net-worth change this month, in % (null = no baseline)
 * @param spendingPace spending vs last month at the same point, in % (null = no baseline)
 * @param savingsRate  this month's income kept, 0..1 (null = no income yet)
 */
export function financialMood({ hasData, netWorthPct, spendingPace, savingsRate }: { hasData: boolean; netWorthPct: number | null; spendingPace: number | null; savingsRate: number | null }): Mood {
  if (!hasData) return { tone: 'new', headline: 'Let’s set up your money.', subline: 'Add an account and Fintrack will start telling your story.' };
  const growing = (netWorthPct ?? 0) >= 0;
  const spendingUp = spendingPace !== null && spendingPace > 10;
  const spendingDown = spendingPace !== null && spendingPace < -5;
  if (growing && !spendingUp) {
    if ((savingsRate ?? 0) >= 0.2 || spendingDown) return { tone: 'great', headline: 'You’re in a good place.', subline: 'Your financial life is on track. Keep going.' };
    return { tone: 'good', headline: 'You’re in a good place.', subline: 'Your net worth is growing and spending is steady. Keep going.' };
  }
  if (growing && spendingUp) return { tone: 'watch', headline: 'You’re doing well.', subline: 'Spending is running a little ahead of last month — worth a quick look.' };
  if (spendingUp) return { tone: 'steady', headline: 'Let’s steady things.', subline: 'Spending is ahead of last month and your net worth dipped. A few small changes will help.' };
  return { tone: 'steady', headline: 'A quieter month.', subline: 'Your net worth dipped a little. Nothing that can’t be turned around.' };
}
