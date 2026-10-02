import { convert } from './currency';
import { addMonths, daysInMonth, monthKey, monthsBetween, parseDate } from './dates';
import type { Transaction, TxKind } from './types';

/** A transaction converted to the user's base currency, ready for analysis. */
export interface Tx {
  id: string;
  date: string;
  month: string;
  kind: TxKind;
  amount: number;
  category: string;
  color: string;
  icon: string;
  accountId: string;
  userId: string;
  note: string | null;
}

export function normalize(txs: Transaction[], baseCurrency: string): Tx[] {
  return txs.map((t) => ({
    id: t.id,
    date: t.date,
    month: monthKey(t.date),
    kind: t.kind,
    amount: convert(t.amount, t.currency, baseCurrency),
    category: t.categoryName,
    color: t.categoryColor,
    icon: t.categoryIcon,
    accountId: t.accountId,
    userId: t.userId,
    note: t.note,
  }));
}

export const DISCRETIONARY = new Set([
  'Dining Out',
  'Coffee & Snacks',
  'Shopping',
  'Entertainment',
  'Subscriptions',
  'Travel',
  'Personal Care',
  'Sports & Fitness',
  'Gifts & Donations',
]);

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ---------------------------------------------------------------------------
// Aggregations

export interface MonthTotals {
  month: string;
  income: number;
  expense: number;
  net: number;
  savingsRate: number; // 0..1, may be negative
}

export function monthlyTotals(txs: Tx[], fromKey: string, toKey: string): MonthTotals[] {
  const map = new Map<string, { income: number; expense: number }>();
  for (const k of monthsBetween(fromKey, toKey)) map.set(k, { income: 0, expense: 0 });
  for (const t of txs) {
    const bucket = map.get(t.month);
    if (bucket) bucket[t.kind] += t.amount;
  }
  return [...map.entries()].map(([month, { income, expense }]) => ({
    month,
    income,
    expense,
    net: income - expense,
    savingsRate: income > 0 ? (income - expense) / income : 0,
  }));
}

export interface CategoryTotal {
  name: string;
  color: string;
  icon: string;
  total: number;
  count: number;
  share: number;
}

export function categoryTotals(txs: Tx[], kind: TxKind): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const t of txs) {
    if (t.kind !== kind) continue;
    const c = map.get(t.category) ?? { name: t.category, color: t.color, icon: t.icon, total: 0, count: 0, share: 0 };
    c.total += t.amount;
    c.count += 1;
    map.set(t.category, c);
  }
  const all = [...map.values()].sort((a, b) => b.total - a.total);
  const total = sum(all.map((c) => c.total));
  for (const c of all) c.share = total ? c.total / total : 0;
  return all;
}

export const inMonth = (txs: Tx[], key: string) => txs.filter((t) => t.month === key);
export const inYear = (txs: Tx[], year: number) => txs.filter((t) => t.date.startsWith(String(year)));
export const totalOf = (txs: Tx[], kind: TxKind) => sum(txs.filter((t) => t.kind === kind).map((t) => t.amount));

/** First month with data, or `fallback` when there is none. */
export function firstMonth(txs: Tx[], fallback: string): string {
  let min = fallback;
  for (const t of txs) if (t.month < min) min = t.month;
  return min;
}

// ---------------------------------------------------------------------------
// Monthly report

export interface CategoryComparison extends CategoryTotal {
  previous: number;
  change: number | null;
}

export interface MonthlyReport {
  month: string;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  prev: MonthTotals;
  expenseByCategory: CategoryComparison[];
  incomeByCategory: CategoryComparison[];
  /** Cumulative expense per day for this and the previous month. */
  dailyCumulative: { day: number; current: number | null; previous: number }[];
  weekday: { day: string; total: number; avg: number }[];
  topExpenses: Tx[];
  transactionCount: number;
}

function compareCategories(current: Tx[], previous: Tx[], kind: TxKind): CategoryComparison[] {
  const prev = new Map(categoryTotals(previous, kind).map((c) => [c.name, c.total]));
  return categoryTotals(current, kind).map((c) => ({
    ...c,
    previous: prev.get(c.name) ?? 0,
    change: pctChange(c.total, prev.get(c.name) ?? 0),
  }));
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function weekdaySpending(txs: Tx[]) {
  const totals = new Array(7).fill(0);
  const days = new Array(7).fill(0).map(() => new Set<string>());
  for (const t of txs) {
    if (t.kind !== 'expense') continue;
    const idx = (parseDate(t.date).getDay() + 6) % 7;
    totals[idx] += t.amount;
    days[idx].add(t.date);
  }
  return WEEKDAYS.map((day, i) => ({ day, total: totals[i], avg: days[i].size ? totals[i] / days[i].size : 0 }));
}

export function monthlyReport(all: Tx[], key: string, today = new Date()): MonthlyReport {
  const current = inMonth(all, key);
  const prevKey = addMonths(key, -1);
  const previous = inMonth(all, prevKey);
  const [cur] = monthlyTotals(current, key, key);
  const [prev] = monthlyTotals(previous, prevKey, prevKey);

  const dim = Math.max(daysInMonth(key), daysInMonth(prevKey));
  const isCurrentMonth = key === monthKey(today);
  const curDaily = new Array(dim + 1).fill(0);
  const prevDaily = new Array(dim + 1).fill(0);
  for (const t of current) if (t.kind === 'expense') curDaily[Number(t.date.slice(8, 10))] += t.amount;
  for (const t of previous) if (t.kind === 'expense') prevDaily[Number(t.date.slice(8, 10))] += t.amount;
  const dailyCumulative: MonthlyReport['dailyCumulative'] = [];
  let c = 0;
  let p = 0;
  for (let day = 1; day <= dim; day++) {
    c += curDaily[day];
    p += prevDaily[day];
    const beyond = day > daysInMonth(key) || (isCurrentMonth && day > today.getDate());
    dailyCumulative.push({ day, current: beyond ? null : c, previous: p });
  }

  return {
    month: key,
    income: cur.income,
    expense: cur.expense,
    net: cur.net,
    savingsRate: cur.savingsRate,
    prev,
    expenseByCategory: compareCategories(current, previous, 'expense'),
    incomeByCategory: compareCategories(current, previous, 'income'),
    dailyCumulative,
    weekday: weekdaySpending(current),
    topExpenses: current.filter((t) => t.kind === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5),
    transactionCount: current.length,
  };
}

// ---------------------------------------------------------------------------
// Yearly report

export interface YearlyReport {
  year: number;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  months: MonthTotals[];
  expenseByCategory: CategoryComparison[];
  incomeByCategory: CategoryComparison[];
  /** Expense per category per month — for the stacked chart and heatmap. */
  categoryMonthly: { month: string; [category: string]: number | string }[];
  bestMonth: MonthTotals | null;
  worstMonth: MonthTotals | null;
  avgMonthlyExpense: number;
  prevYear: { income: number; expense: number; net: number };
  /** Totals restricted to calendar months tracked in both years. */
  comparable: {
    months: number;
    current: { income: number; expense: number };
    previous: { income: number; expense: number };
  };
}

export function yearlyReport(all: Tx[], year: number, today = new Date()): YearlyReport {
  const current = inYear(all, year);
  const previous = inYear(all, year - 1);
  const months = monthlyTotals(current, `${year}-01`, `${year}-12`);
  const income = totalOf(current, 'income');
  const expense = totalOf(current, 'expense');

  // Year-over-year only compares calendar months tracked in both years, so a
  // partial first year (or the year in progress) doesn't skew the change.
  const mm = (t: Tx) => t.month.slice(5);
  const inProgress = monthKey(today);
  const shared = new Set(
    current.filter((t) => t.month !== inProgress).map(mm).filter((m) => previous.some((p) => mm(p) === m)),
  );
  const curComparable = current.filter((t) => shared.has(mm(t)));
  const prevComparable = previous.filter((t) => shared.has(mm(t)));

  // Amounts show the whole year; the change is like-for-like over shared months.
  const yoy = (kind: TxKind) => {
    const curMap = new Map(categoryTotals(curComparable, kind).map((c) => [c.name, c.total]));
    return compareCategories(current, prevComparable, kind).map((c) => ({
      ...c,
      change: shared.size ? pctChange(curMap.get(c.name) ?? 0, c.previous) : null,
    }));
  };
  const expenseByCategory = yoy('expense');
  const top = expenseByCategory.slice(0, 6).map((c) => c.name);
  const categoryMonthly = months.map(({ month }) => {
    const row: { month: string; [k: string]: number | string } = { month };
    for (const name of top) row[name] = 0;
    row.Other = 0;
    for (const t of current) {
      if (t.month !== month || t.kind !== 'expense') continue;
      const keyName = top.includes(t.category) ? t.category : 'Other';
      row[keyName] = (row[keyName] as number) + t.amount;
    }
    return row;
  });

  const elapsed = months.filter((m) => m.month <= monthKey(today) && (m.income || m.expense));
  // The month in progress isn't a fair contender for best/worst.
  const complete = elapsed.filter((m) => m.month < monthKey(today));
  const sorted = [...(complete.length ? complete : elapsed)].sort((a, b) => b.net - a.net);

  return {
    year,
    income,
    expense,
    net: income - expense,
    savingsRate: income > 0 ? (income - expense) / income : 0,
    months,
    expenseByCategory,
    incomeByCategory: yoy('income'),
    categoryMonthly,
    bestMonth: sorted[0] ?? null,
    worstMonth: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    avgMonthlyExpense: elapsed.length ? expense / elapsed.length : 0,
    prevYear: {
      income: totalOf(previous, 'income'),
      expense: totalOf(previous, 'expense'),
      net: totalOf(previous, 'income') - totalOf(previous, 'expense'),
    },
    comparable: {
      months: shared.size,
      current: { income: totalOf(curComparable, 'income'), expense: totalOf(curComparable, 'expense') },
      previous: { income: totalOf(prevComparable, 'income'), expense: totalOf(prevComparable, 'expense') },
    },
  };
}
