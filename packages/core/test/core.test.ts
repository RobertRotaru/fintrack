import { afterEach, describe, expect, it } from 'vitest';
import {
  FX_PER_EUR, NET_WORTH_RANGES, accountFlows, addMonths, balanceChange, categoryTotals, convert, daysInMonth, detectRecurring, etaFor, formatMoney, generateInsights,
  financialMood, goalPlan, habitSummary, netWorthSeries, rangeStart, totalAt, minUnit, roundFor, monthKey, monthlyReport, monthlyTotals, monthsBetween, normalize, pctChange, project, round2,
  setRates, toISODate, yearlyReport, type Goal, type Transaction, type Tx,
} from '../src';

// ---- helpers ---------------------------------------------------------------

let seq = 0;
function tx(date: string, kind: 'expense' | 'income', amount: number, category = 'Groceries', note: string | null = null): Tx {
  return { id: String(++seq), date, month: date.slice(0, 7), kind, amount, category, color: '#000', icon: 'tag', accountId: 'a', userId: 'u', note };
}
const TODAY = new Date(2026, 9, 15); // 15 Oct 2026
const noBad = (v: unknown) => !/NaN|Infinity/.test(JSON.stringify(v));

afterEach(() => setRates(FX_PER_EUR));

// ---- dates -----------------------------------------------------------------

describe('dates', () => {
  it('adds months across year boundaries in both directions', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-03', -15)).toBe('2024-12');
    expect(addMonths('2026-03', 0)).toBe('2026-03');
  });
  it('knows month lengths including leap years', () => {
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2100-02')).toBe(28);
    expect(daysInMonth('2026-12')).toBe(31);
  });
  it('monthsBetween is inclusive and empty when reversed', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthsBetween('2026-02', '2026-01')).toEqual([]);
  });
  it('formats local dates without timezone drift', () => {
    expect(toISODate(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01');
    expect(monthKey(new Date(2026, 11, 31))).toBe('2026-12');
  });
});

// ---- currency --------------------------------------------------------------

describe('currency', () => {
  it('converts via EUR and is a no-op for the same currency', () => {
    expect(convert(100, 'RON', 'RON')).toBe(100);
    expect(convert(FX_PER_EUR.RON, 'RON', 'EUR')).toBeCloseTo(1, 10);
    expect(convert(convert(123.45, 'USD', 'GBP'), 'GBP', 'USD')).toBeCloseTo(123.45, 8);
  });
  it('applies live rates and ignores invalid ones', () => {
    setRates({ RON: 5, USD: -1, GBP: Number.NaN, EUR: 2, XYZ: 3 });
    expect(convert(5, 'RON', 'EUR')).toBeCloseTo(1);
    expect(convert(1, 'EUR', 'USD')).toBe(FX_PER_EUR.USD); // negative rejected
    expect(convert(1, 'EUR', 'GBP')).toBe(FX_PER_EUR.GBP); // NaN rejected
    expect(convert(1, 'EUR', 'EUR')).toBe(1); // EUR always 1
  });
  it('rounds half-cents up like a bank would', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(0)).toBe(0);
  });
  it('rounds crypto to the satoshi and fiat to the cent', () => {
    expect(roundFor(0.123456789, 'BTC')).toBe(0.12345679);
    expect(roundFor(0.123456789, 'RON')).toBe(0.12);
    expect(minUnit('ETH')).toBe(1e-8);
    expect(minUnit('USD')).toBe(0.01);
  });
  it('formats fiat, negatives and crypto', () => {
    expect(formatMoney(-12.5, 'EUR')).toMatch(/12\.50/);
    expect(formatMoney(0.000123, 'BTC')).toBe('0.000123 BTC');
    expect(formatMoney(1, 'BTC', { sign: true })).toBe('+1.00 BTC');
    expect(formatMoney(0.49987655, 'BTC')).toBe('0.49987655 BTC');
    expect(formatMoney(-0.5, 'ETH')).toBe('-0.50 ETH');
  });
});

// ---- aggregations ----------------------------------------------------------

describe('aggregations', () => {
  it('pctChange handles zero baselines and negatives', () => {
    expect(pctChange(0, 0)).toBe(0);
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(-50, -100)).toBe(50);
  });
  it('monthlyTotals fills empty months and never divides by zero', () => {
    const m = monthlyTotals([tx('2026-01-10', 'expense', 50)], '2025-12', '2026-01');
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ income: 0, expense: 0, savingsRate: 0 });
    expect(m[1]).toMatchObject({ expense: 50, net: -50, savingsRate: 0 });
  });
  it('category shares add up to 100%', () => {
    const c = categoryTotals([tx('2026-01-01', 'expense', 30, 'A'), tx('2026-01-02', 'expense', 70, 'B'), tx('2026-01-03', 'income', 999, 'S')], 'expense');
    expect(c.map((x) => x.name)).toEqual(['B', 'A']);
    expect(c.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
  });
  it('normalize converts each transaction from its own currency', () => {
    const t: Transaction = {
      id: '1', accountId: 'a', userId: 'u', kind: 'expense', amount: FX_PER_EUR.RON, currency: 'RON', categoryId: 'c',
      categoryName: 'X', categoryColor: '#000', categoryIcon: 'tag', date: '2026-01-01', note: null, createdAt: '',
    };
    expect(normalize([t], 'EUR')[0].amount).toBeCloseTo(1);
  });
});

describe('monthlyReport', () => {
  it('handles a leap-February vs January comparison', () => {
    const r = monthlyReport([tx('2024-01-31', 'expense', 10), tx('2024-02-29', 'expense', 20)], '2024-02', TODAY);
    expect(r.dailyCumulative).toHaveLength(31);
    expect(r.dailyCumulative[28].current).toBe(20); // day 29
    expect(r.dailyCumulative[29].current).toBeNull(); // day 30 doesn't exist in Feb
    expect(r.dailyCumulative[30].previous).toBe(10);
  });
  it('stops the current month line at today', () => {
    const r = monthlyReport([tx('2026-10-01', 'expense', 10)], '2026-10', TODAY);
    expect(r.dailyCumulative[14].current).toBe(10);
    expect(r.dailyCumulative[15].current).toBeNull();
  });
  it('is all zeros for an empty month', () => {
    const r = monthlyReport([], '2026-05', TODAY);
    expect(r).toMatchObject({ income: 0, expense: 0, net: 0, savingsRate: 0, transactionCount: 0 });
    expect(noBad(r)).toBe(true);
  });
});

describe('yearlyReport', () => {
  it('compares only months tracked in both years and skips the month in progress', () => {
    const data = [
      tx('2025-11-05', 'expense', 100),
      tx('2026-01-05', 'expense', 200),
      tx('2026-10-05', 'expense', 10), // in progress
      tx('2025-10-05', 'expense', 999),
    ];
    const r = yearlyReport(data, 2026, TODAY);
    expect(r.comparable.months).toBe(0);
    expect(r.worstMonth?.month ?? r.bestMonth?.month).not.toBe('2026-10');
  });
  it('picks best and worst from complete months only', () => {
    const r = yearlyReport([tx('2026-01-01', 'income', 100), tx('2026-02-01', 'expense', 50), tx('2026-10-01', 'expense', 9999)], 2026, TODAY);
    expect(r.bestMonth?.month).toBe('2026-01');
    expect(r.worstMonth?.month).toBe('2026-02');
  });
});

// ---- projections -----------------------------------------------------------

describe('projections', () => {
  it('copes with no data at all', () => {
    const p = project([], 6, TODAY);
    expect(p.basisMonths).toBe(0);
    expect(p.future).toHaveLength(7);
    expect(noBad(p)).toBe(true);
  });
  it('detects a monthly rent but not frequent groceries', () => {
    const data: Tx[] = [];
    for (let i = 1; i <= 6; i++) {
      const m = addMonths('2026-10', -i);
      data.push(tx(`${m}-01`, 'expense', 1000, 'Housing', 'Rent'));
      for (let d = 2; d < 28; d += 3) data.push(tx(`${m}-${String(d).padStart(2, '0')}`, 'expense', 40 + d, 'Groceries'));
    }
    const rec = detectRecurring(data, TODAY);
    expect(rec.map((r) => r.category)).toEqual(['Housing']);
    expect(rec[0]).toMatchObject({ amount: 1000, day: 1, monthsSeen: 6 });
  });
  it("doesn't double count a recurring bill that already landed this month", () => {
    const data: Tx[] = [];
    for (let i = 0; i <= 6; i++) data.push(tx(`${addMonths('2026-10', -i)}-01`, 'expense', 1000, 'Housing', 'Rent'));
    const p = project(data, 3, TODAY);
    expect(p.currentMonth.projectedExpense).toBeCloseTo(1000);
  });
  it('never projects negative spending from a falling trend', () => {
    const data = [6, 5, 4, 3, 2, 1].map((i, k) => tx(`${addMonths('2026-10', -(k + 1))}-10`, 'expense', i === 1 ? 1 : 1000 * i, 'Shopping'));
    expect(project(data, 6, TODAY).categories.every((c) => c.projected >= 0)).toBe(true);
  });
});

// ---- goals -----------------------------------------------------------------

const goal = (over: Partial<Goal> = {}): Pick<Goal, 'targetAmount' | 'saved' | 'deadline' | 'contributions'> => ({
  targetAmount: 1200,
  saved: 0,
  deadline: null,
  contributions: [],
  ...over,
});

describe('goals', () => {
  it('builds surplus-based plans that get faster with more saving', () => {
    const p = goalPlan(goal(), 400, TODAY);
    expect(p.plans.map((x) => x.id)).toEqual(['relaxed', 'balanced', 'ambitious']);
    expect(p.plans[0].months).toBeGreaterThan(p.plans[2].months);
    expect(p.plans[1].monthly).toBeCloseTo(200);
  });
  it('falls back to fixed timeframes without a surplus', () => {
    const p = goalPlan(goal(), -300, TODAY);
    expect(p.plans.map((x) => x.months)).toEqual([24, 12, 6]);
  });
  it('a finished goal has nothing left to plan', () => {
    const p = goalPlan(goal({ saved: 1500 }), 400, TODAY);
    expect(p).toMatchObject({ done: true, remaining: 0, progress: 1 });
    expect(p.plans).toEqual([]);
  });
  it('a past deadline is reported as overdue instead of an absurd monthly amount', () => {
    const p = goalPlan(goal({ deadline: '2026-01-01' }), 400, TODAY);
    expect(p.overdue).toBe(true);
    expect(p.required).toBeNull();
    expect(p.plans.find((x) => x.id === 'deadline')).toBeUndefined();
    expect(noBad(p)).toBe(true);
  });
  it('deadline plan lands exactly on the deadline', () => {
    const p = goalPlan(goal({ deadline: '2027-10-15' }), 400, TODAY);
    const d = p.plans.find((x) => x.id === 'deadline')!;
    expect(d.eta).toBe('2027-10-15');
    expect(d.meetsDeadline).toBe(true);
    expect(d.monthly).toBeCloseTo(100, 0);
  });
  it('etaFor rejects non-positive amounts', () => {
    expect(etaFor(100, 0, 'monthly', TODAY)).toBeNull();
    expect(etaFor(100, -5, 'weekly', TODAY)).toBeNull();
    expect(etaFor(0, 10, 'weekly', TODAY)).toBe('2026-10-15');
    expect(etaFor(100, 10, 'weekly', TODAY)).toBe('2026-12-24'); // 10 weeks
  });
  it('net withdrawals give no ETA rather than a negative one', () => {
    const p = goalPlan(goal({ saved: 100, contributions: [{ id: '1', goalId: 'g', userId: 'u', amount: -50, date: '2026-10-01', note: null }] }), 0, TODAY);
    expect(p.actualPace?.eta).toBeNull();
  });
});

// ---- insights & habits -----------------------------------------------------

describe('insights', () => {
  it('returns nothing for no data and never prints NaN', () => {
    expect(generateInsights([], 'EUR', TODAY)).toEqual([]);
    expect(noBad(generateInsights([tx('2026-10-01', 'expense', 5)], 'EUR', TODAY))).toBe(true);
  });
  it('flags a category that jumped month over month', () => {
    const data = [tx('2026-08-10', 'expense', 100, 'Dining Out'), tx('2026-09-10', 'expense', 300, 'Dining Out'), tx('2026-09-11', 'expense', 100, 'Groceries'), tx('2026-08-11', 'expense', 100, 'Groceries')];
    const ids = generateInsights(data, 'EUR', TODAY).map((i) => i.id);
    expect(ids).toContain('cat-up-Dining Out');
  });
});

describe('habitSummary', () => {
  it('is safe with no accounts or history', () => {
    const s = habitSummary([], [], [], 'EUR', TODAY);
    expect(s.monthsAnalyzed).toBe(0);
    expect(s.emergencyFundMonths).toBe(0);
    expect(noBad(s)).toBe(true);
  });
});

// ---- net worth history & narrative -----------------------------------------

describe('net worth history', () => {
  const accounts = [
    { id: 'chk', currency: 'RON', balance: 1000 },
    { id: 'sav', currency: 'RON', balance: 5000 },
    { id: 'eur', currency: 'EUR', balance: 100 },
  ];
  const flows = accountFlows(
    [
      { accountId: 'chk', date: '2026-10-10', kind: 'income', amount: 3000 },
      { accountId: 'chk', date: '2026-10-12', kind: 'expense', amount: 500 },
      { accountId: 'eur', date: '2026-09-01', kind: 'income', amount: 100 },
    ],
    [{ fromAccountId: 'chk', toAccountId: 'sav', date: '2026-10-11', amount: 1000, toAmount: 1000 }],
  );
  const eurInRon = convert(100, 'EUR', 'RON');

  it('turns transactions and transfers into signed per-account flows', () => {
    expect(flows).toHaveLength(5);
    expect(flows.filter((f) => f.accountId === 'chk').map((f) => f.amount).sort()).toEqual([-1000, -500, 3000].sort());
  });
  it('rewinds balances to the end of a past day', () => {
    expect(totalAt(accounts, flows, '2026-10-15', 'RON')).toBeCloseTo(6000 + eurInRon);
    // Before the salary and the purchase; the transfer nets to zero either way.
    expect(totalAt(accounts, flows, '2026-10-09', 'RON')).toBeCloseTo(6000 + eurInRon - 2500);
    expect(totalAt(accounts, flows, '2026-08-31', 'RON')).toBeCloseTo(6000 - 2500);
  });
  it('a transfer between own accounts does not move net worth', () => {
    const t = accountFlows([], [{ fromAccountId: 'chk', toAccountId: 'sav', date: '2026-10-11', amount: 1000, toAmount: 1000 }]);
    expect(totalAt(accounts.slice(0, 2), t, '2026-10-01', 'RON')).toBe(6000);
    // ...but it does move a single account's balance.
    expect(balanceChange([accounts[1]], t, '2026-10-01', 'RON')).toMatchObject({ now: 5000, then: 4000, change: 1000, pct: 25 });
  });
  it('reports no percentage when the starting balance was zero', () => {
    expect(balanceChange([{ id: 'x', currency: 'RON', balance: 50 }], [{ accountId: 'x', date: '2026-10-02', amount: 50 }], '2026-10-01', 'RON').pct).toBeNull();
  });
  it('series ends at today’s net worth and starts at the range start', () => {
    const s = netWorthSeries(accounts, flows, 'RON', '1M', TODAY);
    expect(s.at(-1)).toEqual({ date: '2026-10-15', value: round2(6000 + eurInRon) });
    expect(s[0].date).toBe('2026-09-15');
    expect(s[0].value).toBeCloseTo(6000 + eurInRon - 2500);
    expect(s.length).toBe(31);
    // Dates strictly increase.
    expect(s.every((p, i) => i === 0 || p.date > s[i - 1].date)).toBe(true);
  });
  it('uses coarser steps for longer ranges and never produces NaN', () => {
    for (const r of NET_WORTH_RANGES) {
      const s = netWorthSeries(accounts, flows, 'RON', r, TODAY);
      expect(noBad(s), r).toBe(true);
      expect(s.length, r).toBeLessThanOrEqual(100);
      expect(s.at(-1)!.date).toBe('2026-10-15');
    }
    expect(netWorthSeries([], [], 'RON', '1Y', TODAY).every((p) => p.value === 0)).toBe(true);
  });
  it('clamps month-end range starts and lets ALL reach the first flow', () => {
    expect(rangeStart('1M', [], new Date(2026, 2, 31))).toBe('2026-02-28');
    expect(rangeStart('1Y', [], new Date(2024, 1, 29))).toBe('2023-02-28');
    expect(rangeStart('ALL', [{ accountId: 'a', date: '2024-05-10', amount: 1 }], TODAY)).toBe('2024-05-09');
    expect(rangeStart('ALL', [], TODAY)).toBe('2026-09-15');
  });
});

describe('financial mood', () => {
  it('welcomes a new user', () => {
    expect(financialMood({ hasData: false, netWorthPct: null, spendingPace: null, savingsRate: null }).tone).toBe('new');
  });
  it('says "You’re in a good place." when growing and spending is in check', () => {
    const m = financialMood({ hasData: true, netWorthPct: 4.8, spendingPace: -12, savingsRate: 0.4 });
    expect(m).toMatchObject({ tone: 'great', headline: 'You’re in a good place.', subline: 'Your financial life is on track. Keep going.' });
    expect(financialMood({ hasData: true, netWorthPct: 1, spendingPace: 2, savingsRate: 0.05 }).tone).toBe('good');
    expect(financialMood({ hasData: true, netWorthPct: null, spendingPace: null, savingsRate: null }).tone).toBe('good');
  });
  it('flags faster spending gently, and a dip calmly', () => {
    expect(financialMood({ hasData: true, netWorthPct: 2, spendingPace: 25, savingsRate: 0.3 }).tone).toBe('watch');
    expect(financialMood({ hasData: true, netWorthPct: -3, spendingPace: 25, savingsRate: 0 }).headline).toBe('Let’s steady things.');
    expect(financialMood({ hasData: true, netWorthPct: -3, spendingPace: -10, savingsRate: 0 }).headline).toBe('A quieter month.');
  });
});
