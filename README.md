# Fintrack

Personal & family finance tracker. Web first (React), with the backend and business
logic structured so a mobile app (React Native / Expo, separate project) can reuse them.

## Structure

```
finance-tracker/
├─ packages/core/   Shared, dependency-free TypeScript: types, default categories,
│                   banks by country, currency, reports, insights, projections,
│                   goal plans, habit summary. Reuse it as-is in the mobile app.
├─ server/          REST API — Express 5 + SQLite (node:sqlite), JWT auth,
│                   family sharing, Claude-powered investing coach.
└─ web/             React 19 + Vite + Tailwind 4 + Recharts + TanStack Query.
                    Type: Bricolage Grotesque (headings, figures) + Figtree (body).
```

## Run it

Requires Node 22.13+ (uses the built-in `node:sqlite`).

```bash
npm install
cp server/.env.example server/.env   # then set JWT_SECRET and (optionally) ANTHROPIC_API_KEY
npm run dev                          # API on :4000, web on :5173
```

Open http://localhost:5173, create an account, and either add your first account or
click **Load a year of demo data** on the home screen.

The SQLite database lives in `server/data/finance.db` (override with `DB_FILE`).

### Local test account

Used during development against the local dev server only:

- email: `dev@fintrack.test`
- password: `fintrack-dev-2026`
- partner (joined to the same family): `partner@fintrack.test`, same password

## Features

| # | Feature | Where |
|---|---------|-------|
| 1 | Accounts (debit, credit, savings, loan, investment, crypto, cash) with banks per country (16 countries + global neobanks/brokers/exchanges) and personalisation — suggested name, brand colour, icon, card image, live card preview | `AccountForm.tsx`, `core/institutions.ts` |
| 2 | Expenses / income with 23 + 11 default categories (needs → wants → obligations, 50/30/20-style) and custom categories | `core/defaults.ts`, Settings |
| 3 | Monthly & yearly reports — KPIs, category donut, spending pace, weekday, stacked category bars, YoY tables | `pages/Reports.tsx` |
| 4 | Family — create/join with an invite code, share selected accounts & goals, member breakdown | `pages/Family.tsx`, `routes/household.ts` |
| 5 | Projections — weighted averages + dampened trend, recurring-payment detection, 6-month net worth outlook | `core/projections.ts` |
| 6 | Quick add in **2 steps** from home: type amount → tap category (account & date pre-filled; `N` opens it anywhere) | `components/QuickAdd.tsx` |
| 7 | AI investing coach — anonymised habit summary → Claude → structured suggestions | `routes/ai.ts`, `pages/Invest.tsx` |
| 8 | Goals — saving plans (relaxed/balanced/ambitious/deadline), weekly & monthly amounts, ETA from real pace, custom calculator | `core/goals.ts`, `pages/Goals.tsx` |
| 9 | Insights — spending pace, category movers, income & savings-rate changes, streaks, recurring bills, unusual spends, weekend habits, wants vs needs… | `core/insights.ts` |

Also: transfers between accounts (card repayments, moving money to savings) that change
balances without counting as spending; light/dark theme; responsive mobile layout.

## API

All routes are under `/api`, JSON in/out, `Authorization: Bearer <token>` except auth.

| Method | Path | |
|---|---|---|
| GET | `/fx` | live exchange rates (public) |
| POST | `/auth/register`, `/auth/login` | returns `{ token, user }` |
| GET/PATCH | `/auth/me` | profile, base currency, country |
| GET/POST/PATCH/DELETE | `/accounts[/:id]` | balances computed server-side |
| GET/POST/PATCH/DELETE | `/categories[/:id]` | delete archives if in use |
| GET/POST/PATCH/DELETE | `/transactions[/:id]` | `?from&to&accountId` |
| GET/POST/DELETE | `/transfers[/:id]` | |
| GET/POST/PATCH/DELETE | `/goals[/:id]`, `POST /goals/:id/contributions` | |
| GET/POST/PATCH | `/household`, `POST /household/join`, `/leave`, `/invite-code`, `DELETE /household/members/:id` | |
| GET/POST | `/ai/investment` | latest advice / generate new |
| POST | `/demo` | seeds 13 months of sample data into an empty profile |

## Notes & next steps

- **FX**: live rates, free and keyless — fiat from [ExchangeRate-API open access](https://www.exchangerate-api.com/docs/free)
  (daily, attribution required and shown in Settings), crypto from Coinbase's public rates endpoint.
  The server refreshes every 6 h (`server/src/fx.ts`), caches the last good set in SQLite, and falls back to
  the static table in `core/currency.ts` if both sources are unreachable. Clients load them from `GET /api/fx`.
- **Mobile**: point the Expo app at the same API and import `@ft/core` for all analytics.
- **Later**: post-goal LLM buying suggestions; bank sync (PSD2/open banking); budgets per category; push notifications.
