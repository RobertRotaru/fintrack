import { CURRENCIES, setRates, getRates, type FxSnapshot } from '@ft/core';
import { db, get, run } from './db';

/**
 * Live exchange rates, all free and keyless:
 * - Fiat: ExchangeRate-API open access (https://www.exchangerate-api.com/docs/free),
 *   updated daily, covers RON and MDL. Its terms require the attribution link we show in the UI.
 * - Crypto: Coinbase public exchange-rates endpoint.
 * The last good snapshot is stored in SQLite so restarts work offline.
 */

const FIAT_URL = 'https://open.er-api.com/v6/latest/EUR';
const CRYPTO_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=EUR';
const CRYPTO = ['BTC', 'ETH', 'USDT'];
const REFRESH_MS = 6 * 60 * 60 * 1000;

export const FX_ATTRIBUTION = { label: 'Rates by Exchange Rate API', url: 'https://www.exchangerate-api.com' };

db.exec(`CREATE TABLE IF NOT EXISTS fx_cache (id INTEGER PRIMARY KEY CHECK (id = 1), rates TEXT NOT NULL, updated_at TEXT NOT NULL)`);

let snapshot: FxSnapshot = { base: 'EUR', rates: getRates(), updatedAt: null, source: 'fallback' };

function apply(rates: Record<string, number>, updatedAt: string, source: FxSnapshot['source']) {
  setRates(rates);
  snapshot = { base: 'EUR', rates: getRates(), updatedAt, source };
}

// Start from the last stored snapshot, if any.
const cached = get<{ rates: string; updated_at: string }>('SELECT rates, updated_at FROM fx_cache WHERE id = 1');
if (cached) apply(JSON.parse(cached.rates), cached.updated_at, 'cached');

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export async function refreshRates(): Promise<FxSnapshot> {
  const [fiat, crypto] = await Promise.allSettled([fetchJson(FIAT_URL), fetchJson(CRYPTO_URL)]);
  const next: Record<string, number> = { ...snapshot.rates };
  let got = 0;

  if (fiat.status === 'fulfilled') {
    const body = fiat.value as { result?: string; rates?: Record<string, number> };
    if (body.result === 'success' && body.rates) {
      for (const code of CURRENCIES) if (!CRYPTO.includes(code) && body.rates[code]) (next[code] = body.rates[code]), got++;
    }
  } else console.warn('[fx] fiat rates unavailable:', fiat.reason?.message ?? fiat.reason);

  if (crypto.status === 'fulfilled') {
    const body = crypto.value as { data?: { rates?: Record<string, string> } };
    for (const code of CRYPTO) {
      const r = Number(body.data?.rates?.[code]);
      if (r > 0) (next[code] = r), got++;
    }
  } else console.warn('[fx] crypto rates unavailable:', crypto.reason?.message ?? crypto.reason);

  if (got) {
    const now = new Date().toISOString();
    apply(next, now, 'live');
    run('INSERT INTO fx_cache (id, rates, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET rates = excluded.rates, updated_at = excluded.updated_at', JSON.stringify(snapshot.rates), now);
  }
  return snapshot;
}

export function currentRates(): FxSnapshot {
  return snapshot;
}

export function startRateUpdates() {
  const tick = () => refreshRates().catch((e) => console.warn('[fx] refresh failed:', e));
  void tick();
  setInterval(tick, REFRESH_MS).unref();
}
