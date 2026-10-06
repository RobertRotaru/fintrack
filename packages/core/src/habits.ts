import { DISCRETIONARY, categoryTotals, mean, monthlyTotals, stdev, sum, type Tx } from './analytics';
import { convert, round2 } from './currency';
import { addMonths, monthKey } from './dates';
import { detectRecurring } from './projections';
import type { Account, Goal, InvestmentAdvice } from './types';

/**
 * A compact, anonymised summary of a user's money habits — the only data sent
 * to the LLM for investment suggestions (no names, notes, or institutions).
 */
export interface HabitSummary {
  currency: string;
  monthsAnalyzed: number;
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;
  avgMonthlySurplus: number;
  savingsRate: number;
  incomeVariability: number;
  discretionaryShare: number;
  topExpenseCategories: { name: string; share: number; monthly: number }[];
  recurringMonthlyCosts: number;
  balances: {
    liquid: number;
    savings: number;
    investments: number;
    crypto: number;
    creditCardDebt: number;
    loans: number;
  };
  emergencyFundMonths: number;
  monthlyNet: { month: string; net: number }[];
  goals: { name: string; target: number; saved: number; deadline: string | null }[];
}

/** An AI analysis running in the background, or the last one that failed. */
export interface AiJob {
  status: 'running' | 'failed';
  error: string | null;
  startedAt: string;
}

/**
 * GET /ai/investment (and POST's 202 answer). The coach runs in the background, so no request waits on the AI:
 * while `job.status` is "running", check back every few seconds until the job is gone (the new advice is there)
 * or has failed.
 */
export interface InvestmentState {
  configured: boolean;
  summary: HabitSummary;
  advice: InvestmentAdvice | null;
  job: AiJob | null;
}

export function habitSummary(txs: Tx[], accounts: Account[], goals: Goal[], currency: string, today = new Date()): HabitSummary {
  const end = addMonths(monthKey(today), -1);
  const start = addMonths(end, -11);
  const window = txs.filter((t) => t.month >= start && t.month <= end);
  const firstMonth = window.reduce((min, t) => (t.month < min ? t.month : min), end);
  const months = monthlyTotals(window, firstMonth, end).filter((m) => m.income || m.expense);
  const income = mean(months.map((m) => m.income));
  const expense = mean(months.map((m) => m.expense));
  const totalExpense = sum(window.filter((t) => t.kind === 'expense').map((t) => t.amount));
  const discretionary = sum(window.filter((t) => t.kind === 'expense' && DISCRETIONARY.has(t.category)).map((t) => t.amount));

  const bal = { liquid: 0, savings: 0, investments: 0, crypto: 0, creditCardDebt: 0, loans: 0 };
  for (const a of accounts) {
    if (a.archived) continue;
    const v = convert(a.balance, a.currency, currency);
    if (a.type === 'debit' || a.type === 'cash') bal.liquid += v;
    else if (a.type === 'savings') bal.savings += v;
    else if (a.type === 'investment') bal.investments += v;
    else if (a.type === 'crypto') bal.crypto += v;
    else if (a.type === 'credit') bal.creditCardDebt += Math.max(0, -v);
    else if (a.type === 'loan') bal.loans += Math.abs(v);
  }

  const r = (n: number) => round2(n);
  return {
    currency,
    monthsAnalyzed: months.length,
    avgMonthlyIncome: r(income),
    avgMonthlyExpense: r(expense),
    avgMonthlySurplus: r(income - expense),
    savingsRate: income ? r((income - expense) / income) : 0,
    incomeVariability: income ? r(stdev(months.map((m) => m.income)) / income) : 0,
    discretionaryShare: totalExpense ? r(discretionary / totalExpense) : 0,
    topExpenseCategories: categoryTotals(window, 'expense')
      .slice(0, 8)
      .map((c) => ({ name: c.name, share: r(c.share), monthly: r(c.total / Math.max(months.length, 1)) })),
    recurringMonthlyCosts: r(sum(detectRecurring(txs, today).filter((x) => x.kind === 'expense').map((x) => x.amount))),
    balances: {
      liquid: r(bal.liquid),
      savings: r(bal.savings),
      investments: r(bal.investments),
      crypto: r(bal.crypto),
      creditCardDebt: r(bal.creditCardDebt),
      loans: r(bal.loans),
    },
    emergencyFundMonths: expense ? r((bal.liquid + bal.savings) / expense) : 0,
    monthlyNet: months.map((m) => ({ month: m.month, net: r(m.net) })),
    goals: goals
      .filter((g) => !g.completedAt)
      .map((g) => ({ name: g.name, target: r(convert(g.targetAmount, g.currency, currency)), saved: r(convert(g.saved, g.currency, currency)), deadline: g.deadline })),
  };
}
