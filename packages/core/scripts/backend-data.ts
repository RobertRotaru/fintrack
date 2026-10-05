/**
 * Data the Java backend shares with @ft/core, generated from this package so
 * there is one source of truth:
 *
 *  - reference.json  currencies (fallback FX, decimals), countries, banks,
 *                    default categories and the discretionary set
 *  - habit-summary.json  a golden fixture: inputs and the exact output of
 *                    habitSummary(), which the backend's Java port must match
 *
 * Regenerate with `npm run export:backend-data`; core tests fail if the
 * committed files drift from what this module produces.
 */
import {
  COUNTRIES, CURRENCIES, DEFAULT_CATEGORIES, DISCRETIONARY, FX_PER_EUR, GLOBAL_INSTITUTIONS, INSTITUTIONS_BY_COUNTRY,
  decimalsFor, habitSummary, normalize, setRates, toISODate, addDays,
  type Account, type Goal, type Institution, type Transaction,
} from '../src';

export const REFERENCE_PATH = 'backend/src/main/resources/reference.json';
export const GOLDEN_PATH = 'backend/src/test/resources/golden/habit-summary.json';

const inst = (i: Institution) => ({ id: i.id, name: i.name, color: i.color, types: i.types });

export function buildReference() {
  return {
    $comment: 'Generated from @ft/core by `npm run export:backend-data` — do not edit by hand.',
    currencies: CURRENCIES.map((code) => ({ code, perEur: FX_PER_EUR[code], decimals: decimalsFor(code) })),
    countries: COUNTRIES.map(({ code, name, currency }) => ({ code, name, currency })),
    defaultCategories: DEFAULT_CATEGORIES,
    institutionsByCountry: Object.fromEntries(Object.entries(INSTITUTIONS_BY_COUNTRY).map(([c, list]) => [c, list.map(inst)])),
    globalInstitutions: GLOBAL_INSTITUTIONS.map(inst),
    discretionaryCategories: [...DISCRETIONARY],
  };
}

/** Deterministic, varied inputs: mixed currencies, bills with and without notes, every account type. */
export function buildGolden() {
  setRates(FX_PER_EUR);
  let seed = 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296), seed / 4294967296);
  const today = new Date(2026, 9, 15, 12, 0, 0); // 15 Oct 2026
  const base = 'RON';
  const cats: [string, 'expense' | 'income', number, number, string | null, number][] = [
    // name, kind, min, max, note, times per month
    ['Salary', 'income', 9000, 9000, 'Monthly salary', 1],
    ['Freelance', 'income', 800, 3000, null, 0.4],
    ['Housing', 'expense', 2500, 2500, 'Rent', 1],
    ['Subscriptions', 'expense', 59.99, 59.99, 'Netflix', 1],
    ['Utilities', 'expense', 300, 420, 'Electricity', 1],
    ['Groceries', 'expense', 60, 400, null, 7],
    ['Dining Out', 'expense', 40, 220, null, 4],
    ['Coffee & Snacks', 'expense', 9, 25, null, 10],
    ['Travel', 'expense', 1500, 5000, null, 0.15],
    ['Insurance', 'expense', 180, 180, null, 1],
  ];
  const transactions: Transaction[] = [];
  let id = 0;
  for (let m = 13; m >= 0; m--) {
    const month = new Date(today.getFullYear(), today.getMonth() - m, 1);
    for (const [name, kind, min, max, note, times] of cats) {
      const n = times >= 1 ? times : rand() < times ? 1 : 0;
      for (let k = 0; k < n; k++) {
        const day = Math.min(28, 1 + Math.floor(rand() * 28));
        const date = toISODate(new Date(month.getFullYear(), month.getMonth(), day));
        if (date > toISODate(today)) continue;
        // Some spending happens on a EUR card, converted at the fallback rates.
        const eur = kind === 'expense' && name === 'Dining Out' && rand() < 0.3;
        const amount = Math.round((min + rand() * (max - min)) * 100) / 100;
        transactions.push({
          id: `t${++id}`, accountId: eur ? 'eur' : 'main', userId: 'u', kind, amount: eur ? Math.round((amount / FX_PER_EUR.RON) * 100) / 100 : amount,
          currency: eur ? 'EUR' : 'RON', categoryId: name, categoryName: name, categoryColor: '#000000', categoryIcon: 'tag', date, note, createdAt: date,
        });
      }
    }
  }
  const acc = (id: string, type: Account['type'], currency: string, balance: number, archived = false): Account => ({
    id, ownerId: 'u', householdId: null, type, name: id, institutionId: null, institutionName: null, country: 'RO', currency,
    color: '#000000', icon: 'wallet', image: null, initialBalance: balance, creditLimit: null, archived, createdAt: '', balance,
  });
  const accounts = [
    acc('main', 'debit', 'RON', 12500.4), acc('eur', 'debit', 'EUR', 320.15), acc('cash', 'cash', 'RON', 230),
    acc('save', 'savings', 'RON', 41000), acc('inv', 'investment', 'EUR', 5200), acc('btc', 'crypto', 'BTC', 0.0123),
    acc('card', 'credit', 'RON', -1840.33), acc('loan', 'loan', 'RON', -56000), acc('old', 'savings', 'RON', 999, true),
  ];
  const goal = (id: string, target: number, currency: string, saved: number, deadline: string | null, completedAt: string | null): Goal => ({
    id, userId: 'u', householdId: null, name: id, targetAmount: target, currency, deadline, icon: 'target', color: '#000000',
    image: null, createdAt: '', completedAt, saved, contributions: [],
  });
  const goals = [
    goal('Car', 60000, 'RON', 20400, toISODate(addDays(today, 700)), null),
    goal('Trip', 3000, 'EUR', 450.5, null, null),
    goal('Bike', 1200, 'RON', 1200, null, '2026-05-01T10:00:00.000Z'),
  ];
  const expected = habitSummary(normalize(transactions, base), accounts, goals, base, today);
  return { $comment: 'Generated from @ft/core by `npm run export:backend-data` — do not edit by hand.', today: toISODate(today), baseCurrency: base, rates: FX_PER_EUR, transactions, accounts, goals, expected };
}

export const serialize = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
