import { categoryTotals, mean, median, monthlyTotals, sum, type Tx } from './analytics';
import { addMonths, daysInMonth, monthKey } from './dates';
import type { TxKind } from './types';

export interface RecurringItem {
  kind: TxKind;
  category: string;
  color: string;
  icon: string;
  note: string | null;
  amount: number;
  /** Typical day of month it lands on. */
  day: number;
  monthsSeen: number;
}

export interface CategoryProjection {
  kind: TxKind;
  name: string;
  color: string;
  icon: string;
  average: number;
  projected: number;
  trend: 'up' | 'down' | 'flat';
  recurring: boolean;
}

export interface ProjectedMonth {
  month: string;
  income: number;
  expense: number;
  net: number;
  cumulativeNet: number;
  projected: boolean;
}

export interface Projection {
  basisMonths: number;
  confidence: 'low' | 'medium' | 'high';
  history: ProjectedMonth[];
  future: ProjectedMonth[];
  categories: CategoryProjection[];
  recurring: RecurringItem[];
  currentMonth: {
    month: string;
    incomeSoFar: number;
    expenseSoFar: number;
    projectedIncome: number;
    projectedExpense: number;
    progress: number; // fraction of the month elapsed
  };
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;
  avgMonthlyNet: number;
}

/** Least-squares slope of ys over x = 0..n-1. */
function slope(ys: number[]): number {
  const n = ys.length;
  if (n < 3) return 0;
  const xm = (n - 1) / 2;
  const ym = mean(ys);
  let num = 0;
  let den = 0;
  ys.forEach((y, x) => {
    num += (x - xm) * (y - ym);
    den += (x - xm) ** 2;
  });
  return den ? num / den : 0;
}

/** Recent months weigh more: weights 1..n. */
function weightedMean(ys: number[]): number {
  if (!ys.length) return 0;
  let w = 0;
  let total = 0;
  ys.forEach((y, i) => {
    total += y * (i + 1);
    w += i + 1;
  });
  return total / w;
}

/**
 * Detects transactions that repeat monthly with a stable amount (rent, salary,
 * subscriptions): same kind + category + note-or-amount bucket seen in 3+ of the
 * last 6 complete months.
 */
export function detectRecurring(txs: Tx[], today = new Date()): RecurringItem[] {
  const end = addMonths(monthKey(today), -1);
  const start = addMonths(end, -5);
  const window = txs.filter((t) => t.month >= start && t.month <= end);
  const windowMonths = new Set(window.map((t) => t.month)).size || 1;
  const perCategory = new Map<string, number>();
  for (const t of window) perCategory.set(`${t.kind}|${t.category}`, (perCategory.get(`${t.kind}|${t.category}`) ?? 0) + 1);
  const groups = new Map<string, Tx[]>();
  for (const t of window) {
    // Without a note to identify the payee, only trust amount-matching in
    // low-frequency categories — otherwise groceries look like a "bill".
    if (!t.note?.trim() && (perCategory.get(`${t.kind}|${t.category}`) ?? 0) / windowMonths > 2) continue;
    // Bucket amounts to ~5% so "49.99" and "51.20" still group together.
    const bucket = Math.round(Math.log(Math.max(t.amount, 1)) / Math.log(1.05));
    const key = `${t.kind}|${t.category}|${(t.note ?? '').trim().toLowerCase() || bucket}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const out: RecurringItem[] = [];
  for (const items of groups.values()) {
    const months = new Set(items.map((t) => t.month));
    if (months.size < 3) continue;
    // One hit per month — more than ~1.5 per month is a habit, not a bill.
    if (items.length > months.size * 1.5) continue;
    const amounts = items.map((t) => t.amount);
    if (mean(amounts) && (Math.max(...amounts) - Math.min(...amounts)) / mean(amounts) > 0.25) continue;
    const first = items[0];
    out.push({
      kind: first.kind,
      category: first.category,
      color: first.color,
      icon: first.icon,
      note: first.note,
      amount: median(amounts),
      day: Math.round(median(items.map((t) => Number(t.date.slice(8, 10))))),
      monthsSeen: months.size,
    });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

export function project(txs: Tx[], monthsAhead = 6, today = new Date()): Projection {
  const thisMonth = monthKey(today);
  const lastComplete = addMonths(thisMonth, -1);
  const earliest = txs.reduce((min, t) => (t.month < min ? t.month : min), thisMonth);
  const basisStart = [addMonths(lastComplete, -5), earliest].sort().pop()!;
  const basisMonths = basisStart <= lastComplete ? monthsBetweenCount(basisStart, lastComplete) : 0;

  const basisTxs = txs.filter((t) => t.month >= basisStart && t.month <= lastComplete);
  const recurring = detectRecurring(txs, today);

  const categories: CategoryProjection[] = [];
  for (const kind of ['expense', 'income'] as TxKind[]) {
    for (const cat of categoryTotals(basisTxs, kind)) {
      const series = basisMonths
        ? monthlyTotals(
            basisTxs.filter((t) => t.kind === kind && t.category === cat.name),
            basisStart,
            lastComplete,
          ).map((m) => m[kind])
        : [];
      const avg = weightedMean(series);
      const s = slope(series);
      const isRecurring = recurring.some((r) => r.kind === kind && r.category === cat.name);
      // Dampen the trend so a single spike doesn't run away; recurring costs stay flat.
      const projected = Math.max(0, isRecurring ? avg : avg + s * 0.5);
      const rel = avg ? s / avg : 0;
      categories.push({
        kind,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        average: mean(series),
        projected,
        trend: rel > 0.05 ? 'up' : rel < -0.05 ? 'down' : 'flat',
        recurring: isRecurring,
      });
    }
  }

  const projIncome = sum(categories.filter((c) => c.kind === 'income').map((c) => c.projected));
  const projExpense = sum(categories.filter((c) => c.kind === 'expense').map((c) => c.projected));

  // Current month: what has happened, plus the variable part pro-rated over the
  // remaining days, plus recurring items that haven't landed yet this month.
  const progress = Math.min(1, today.getDate() / daysInMonth(thisMonth));
  const curTxs = txs.filter((t) => t.month === thisMonth);
  const [cur] = monthlyTotals(curTxs, thisMonth, thisMonth);
  const remainder = (kind: TxKind, monthly: number) => {
    const fixed = recurring.filter((r) => r.kind === kind);
    const variable = Math.max(0, monthly - sum(fixed.map((r) => r.amount)));
    const pendingFixed = fixed.filter(
      (r) => !curTxs.some((t) => t.kind === kind && t.category === r.category && Math.abs(t.amount - r.amount) <= r.amount * 0.25),
    );
    return variable * (1 - progress) + sum(pendingFixed.map((r) => r.amount));
  };
  const currentMonth = {
    month: thisMonth,
    incomeSoFar: cur.income,
    expenseSoFar: cur.expense,
    projectedIncome: cur.income + remainder('income', projIncome),
    projectedExpense: cur.expense + remainder('expense', projExpense),
    progress,
  };

  const history: ProjectedMonth[] = [];
  let cumulative = 0;
  if (basisMonths) {
    for (const m of monthlyTotals(txs, basisStart, lastComplete)) {
      cumulative += m.net;
      history.push({ month: m.month, income: m.income, expense: m.expense, net: m.net, cumulativeNet: cumulative, projected: false });
    }
  }
  const future: ProjectedMonth[] = [];
  const curNet = currentMonth.projectedIncome - currentMonth.projectedExpense;
  cumulative += curNet;
  future.push({
    month: thisMonth,
    income: currentMonth.projectedIncome,
    expense: currentMonth.projectedExpense,
    net: curNet,
    cumulativeNet: cumulative,
    projected: true,
  });
  for (let i = 1; i <= monthsAhead; i++) {
    cumulative += projIncome - projExpense;
    future.push({
      month: addMonths(thisMonth, i),
      income: projIncome,
      expense: projExpense,
      net: projIncome - projExpense,
      cumulativeNet: cumulative,
      projected: true,
    });
  }

  const basisTotals = basisMonths ? monthlyTotals(basisTxs, basisStart, lastComplete) : [];
  return {
    basisMonths,
    confidence: basisMonths >= 5 ? 'high' : basisMonths >= 2 ? 'medium' : 'low',
    history,
    future,
    categories: categories.sort((a, b) => b.projected - a.projected),
    recurring,
    currentMonth,
    avgMonthlyIncome: mean(basisTotals.map((m) => m.income)),
    avgMonthlyExpense: mean(basisTotals.map((m) => m.expense)),
    avgMonthlyNet: mean(basisTotals.map((m) => m.net)),
  };
}

function monthsBetweenCount(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}
