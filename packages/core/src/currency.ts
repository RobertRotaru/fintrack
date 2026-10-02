/**
 * Offline fallback rates (units per 1 EUR). The live rates fetched by the server
 * (see server/src/fx.ts) replace these via `setRates`; these only apply until the
 * first successful fetch, or when every rate source is unreachable.
 */
export const FX_PER_EUR: Record<string, number> = {
  EUR: 1,
  RON: 4.97,
  MDL: 19.6,
  USD: 1.08,
  GBP: 0.85,
  PLN: 4.3,
  HUF: 395,
  BGN: 1.956,
  CHF: 0.95,
  CAD: 1.47,
  BTC: 0.000016,
  ETH: 0.00038,
  USDT: 1.08,
};

export const CURRENCIES = Object.keys(FX_PER_EUR);

/** Rates `convert` uses right now: the fallback table overlaid with live rates. */
let rates: Record<string, number> = { ...FX_PER_EUR };

export interface FxSnapshot {
  base: 'EUR';
  rates: Record<string, number>;
  /** ISO time the rates were fetched, null when only the fallback table is in use. */
  updatedAt: string | null;
  source: 'live' | 'cached' | 'fallback';
}

export function setRates(live: Record<string, number>) {
  const next = { ...FX_PER_EUR };
  for (const code of CURRENCIES) {
    const r = live[code];
    if (typeof r === 'number' && Number.isFinite(r) && r > 0) next[code] = r;
  }
  next.EUR = 1;
  rates = next;
}

export function getRates(): Record<string, number> {
  return rates;
}

export function convert(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const CRYPTO = new Set(['BTC', 'ETH']);

export function formatMoney(amount: number, currency: string, opts: { compact?: boolean; sign?: boolean } = {}): string {
  if (CRYPTO.has(currency)) {
    return `${opts.sign && amount > 0 ? '+' : ''}${amount.toFixed(6)} ${currency}`;
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: opts.compact ? 'compact' : 'standard',
      maximumFractionDigits: opts.compact ? 1 : 2,
      minimumFractionDigits: opts.compact ? 0 : 2,
      signDisplay: opts.sign ? 'exceptZero' : 'auto',
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
