import { useCallback } from 'react';
import { formatMoney } from '@ft/core';
import { useUser } from './auth';

export { parseAmount } from '@ft/core';

/** Formats amounts in the user's base currency unless told otherwise. */
export function useMoney() {
  const user = useUser();
  return useCallback(
    (amount: number, opts: { currency?: string; compact?: boolean; sign?: boolean } = {}) => formatMoney(amount, opts.currency ?? user.baseCurrency, opts),
    [user.baseCurrency],
  );
}

/** "RON" and "121,986.61" separately, so the number can be the big part. */
export function moneyParts(amount: number, currency: string): { currency: string; number: string; before: boolean } {
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).formatToParts(amount);
    const idx = parts.findIndex((p) => p.type === 'currency');
    const number = parts
      .filter((p) => p.type !== 'currency' && !(p.type === 'literal' && !p.value.trim()))
      .map((p) => p.value)
      .join('');
    return { currency: parts[idx]?.value ?? currency, number, before: idx <= parts.findIndex((p) => p.type === 'integer') };
  } catch {
    return { currency, number: amount.toFixed(2), before: false };
  }
}

export function formatDay(date: string, today = new Date()): string {
  const d = new Date(`${date}T00:00:00`);
  const diff = Math.round((new Date(today.toDateString()).getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: diff < 7 ? 'long' : undefined,
    day: diff < 7 ? undefined : 'numeric',
    month: diff < 7 ? undefined : 'short',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

export const percent = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

/** "↑ 5.0%" / "↓ 17%": one decimal under 10%, whole numbers above. */
export function formatPct(value: number): string {
  const abs = Math.abs(value);
  return `${value >= 0 ? '↑' : '↓'} ${abs.toFixed(abs < 10 ? 1 : 0)}%`;
}
