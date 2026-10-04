<div align="center">

# Fintrack

**You’re in a good place.**

A personal & family finance tracker that tells the story of your money first and shows the data second:
accounts from your actual banks, two-tap expense entry, reports that explain themselves, goals with real ETAs,
and an AI coach that reads your habits.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/home-light.jpg" alt="Fintrack home, light theme"></td>
    <td width="50%"><img src="docs/screenshots/home-dark.jpg" alt="Fintrack home, dark theme"></td>
  </tr>
</table>

</div>

---

## Highlights

|  |  |
|---|---|
| 🌿 **A home page that tells a story** | It answers *how am I doing?* (“You’re in a good place.” — chosen honestly from your net-worth trend, spending pace and savings rate), then *what changed?*, *what needs your attention?* and *what can I do about it?* |
| 📈 **Net worth over time** | Your balance history is rebuilt from your transactions and transfers, drawn as one smooth curve with 1M / 3M / 6M / 1Y / ALL ranges and a tooltip that shows the change since the start of the range. |
| ⚡ **Two taps to log a purchase** | Type the amount, tap a category — saved. Account and date are pre-filled, the most-used categories float to the top, and <kbd>N</kbd> opens it from anywhere. |
| 🏦 **Your real banks** | Pick a country and choose from its banks, plus global neobanks, brokers and crypto exchanges — 16 countries and 120+ institutions, each with its logo and brand colour. |
| 🧾 **Spending, at a glance and in depth** | A category donut, a six-month trend by category or in total, biggest expenses and month-on-month changes. Click any category to see its transactions. |
| 📊 **Reports that explain themselves** | Overview, Spending, Income and Net worth tabs (deep-linkable), monthly and yearly views, spending pace, weekday patterns and like-for-like year-over-year comparisons. |
| 💡 **Insights** | Thirteen kinds of observations — spending faster than last month, categories that jumped, savings-rate swings, streaks, recurring bills, unusual spends, weekend habits, wants vs needs — each with a way to act on it. |
| 🔮 **Projections** | Next months' income and spending from weighted history and trend, recurring payments detected automatically, a realistic end-of-month estimate and a six-month net-worth outlook. |
| 🎯 **Goals with a route** | Big dreams, real plans: relaxed, balanced, ambitious and on-deadline plans with weekly and monthly amounts, an ETA from your actual saving pace, and a “what if I save X” calculator. |
| 👨‍👩‍👧 **Family budgeting** | Invite a partner, family member or child with a code and a ready-to-send message, share only the accounts and goals you choose, and see the family’s shared balance and who spent what. |
| ✨ **AI investing coach** | An anonymised summary of your habits goes to Claude, which suggests readiness, a risk profile, an asset-class mix and next steps. Educational, not financial advice. |
| 🌗 **Light, dark or system** | Two complete themes from one design system — warm ivory and forest green by day, deep blue-black with emerald and mint by night. |
| 💱 **Live exchange rates** | Multi-currency accounts (including crypto) roll up into your main currency with daily rates. |

## A closer look

<table>
  <tr>
    <td colspan="2"><img src="docs/screenshots/home-story.jpg" alt="Home: money at a glance and what needs your attention"><br><sub><b>Home, continued</b> — spending, saving and investing at a glance, then observations that need your attention, each linking to where you can act.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/spending.jpg" alt="Spending"><br><sub><b>Spending</b> — the month’s total and what drove it, a category donut you can click into, and a six-month trend.</sub></td>
    <td width="50%"><img src="docs/screenshots/accounts.jpg" alt="Accounts"><br><sub><b>Accounts</b> — total balance, then each account as a refined row: institution, type, 30-day trend line and change.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/goals.jpg" alt="Goals"><br><sub><b>Goals</b> — big progress bars and plain-language time left.</sub></td>
    <td><img src="docs/screenshots/goal-plans.jpg" alt="Goal plans"><br><sub><b>Goal plans</b> — four ways to get there, each checked against your deadline and your monthly surplus.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/reports.jpg" alt="Reports overview"><br><sub><b>Reports</b> — income, spending and net change, one sentence that sums up the month, and six months side by side.</sub></td>
    <td><img src="docs/screenshots/reports-networth.jpg" alt="Net worth report"><br><sub><b>Net worth</b> — the long view, and what it’s made of.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/family.jpg" alt="Family"><br><sub><b>Family</b> — members and roles, the shared balance, shared goals and an invite flow.</sub></td>
    <td><img src="docs/screenshots/insights.jpg" alt="Insights"><br><sub><b>Insights</b> — good news, heads-ups and habits, grouped and ranked by relevance.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/projections.jpg" alt="Projections"><br><sub><b>Projections</b> — actual vs projected cash flow and where your net worth is heading.</sub></td>
    <td><img src="docs/screenshots/settings.jpg" alt="Settings"><br><sub><b>Settings</b> — profile, light / dark / system appearance, categories and exchange rates.</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/account-personalise.jpg" alt="Personalising an account"><br><sub><b>Personalisation</b> — live card preview, brand colour, icons and custom images.</sub></td>
  </tr>
</table>

### On a phone, and when things aren't perfect

<table>
  <tr>
    <td width="22%" rowspan="2"><img src="docs/screenshots/mobile-home.jpg" alt="Fintrack on a phone"><br><sub><b>Phone</b> — the same story in one column, with bottom navigation and a central add button.</sub></td>
    <td width="22%" rowspan="2"><img src="docs/screenshots/mobile-home-dark.jpg" alt="Fintrack on a phone, dark theme"><br><sub><b>…and at night.</b></sub></td>
    <td width="28%"><img src="docs/screenshots/signin.jpg" alt="Sign in"><br><sub><b>Sign in</b></sub></td>
    <td width="28%"><img src="docs/screenshots/state-empty.jpg" alt="Empty state"><br><sub><b>First run</b> — every page has a helpful empty state; demo data is one click away.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/state-loading.jpg" alt="Loading skeleton"><br><sub><b>Loading</b> — page-shaped skeletons, only if loading takes longer than 150ms.</sub></td>
    <td><img src="docs/screenshots/state-error.jpg" alt="Error state"><br><sub><b>Errors</b> — a server error never looks like empty data; one tap to retry.</sub></td>
  </tr>
</table>

## How it's built

```
fintrack/
├─ packages/core   Shared, dependency-free TypeScript — the brains.
│                  Reports, insights, projections, goal plans, habit summaries,
│                  default categories, banks by country, currency conversion.
├─ server          REST API — Express 5 + SQLite (node:sqlite), JWT auth,
│                  family sharing, live FX, Claude-powered investing coach.
└─ web             React 19 · Vite · Tailwind CSS 4 · Recharts · TanStack Query.
```

The analytics live in `packages/core` rather than in the UI, so the upcoming mobile app
uses the exact same logic and the same API.

**Tested** with 192 Vitest tests — unit tests for the analytics (including net-worth history and the home page’s
headline), API integration tests (validation, boundary values, permissions, family-sharing isolation) and UI tests for
every page’s loading, empty and error states and the interactive details (range filters, report tabs, spending
drill-down, theme switching, family invites) — plus 28 headless-Chrome end-to-end checks for page transitions, offline
behaviour and failure recovery.

**Design notes**

- **Principle:** hierarchy → narrative → data. Each page leads with one sentence and one number, explains what changed, and only then shows the detail.
- **Type:** Newsreader, an editorial serif, for headlines; Inter for interface text and figures, with tabular numbers wherever amounts line up. Both are self-hosted variable fonts, so there are no third-party font requests.
- **Colour:** light is warm ivory with deep forest ink, sage, emerald, peach, sky and a little cobalt; dark is deep blue-black with emerald, electric mint, cobalt, violet and warm orange. One forest/emerald accent marks primary actions, and only the most important element on a page gets a soft glow. Good and bad states always come with an arrow, icon or label, never colour alone.
- **Illustration:** small SVG landscapes drawn with theme tokens, so the same scene is a morning in light mode and a dusk in dark mode.
- **Motion:** a 220ms fade-and-rise between pages that animates only opacity and transform; charts mount just after it and draw themselves in, so the transition stays smooth. Everything is switched off for anyone who prefers reduced motion.
- **States:** page-shaped loading skeletons (shown only if loading takes over 150ms), friendly empty states, and distinct error screens for server errors, being offline, a missing page, or a page that failed to download.
- **Responsive:** a persistent sidebar on desktop (main sections, a “More” group and Settings); multi-column layouts collapse on tablets; on phones, bottom navigation with a central add button.

**Data & privacy**

- Family members only see what is explicitly shared, and only the person who added a transaction can edit or delete it.
- The AI coach receives aggregates only — averages, category shares and balance totals. No names, notes or bank details.
- Exchange rates come from [ExchangeRate-API](https://www.exchangerate-api.com) (fiat, daily) and Coinbase (crypto), cached server-side with an offline fallback.

## Run it locally

```bash
npm install
npm run dev          # API on :4000, web on :5173 — sign up, then "Load a year of demo data"
```

Optional: `ANTHROPIC_API_KEY` enables the AI coach, `JWT_SECRET` is required in production, and `DB_FILE` picks the SQLite file.

```bash
npm test             # Vitest: core, API and UI
npm run typecheck
E2E_EMAIL=… E2E_PASSWORD=… CHROME_PATH=/path/to/chrome npm run e2e   # with both dev servers running
```

In a container, add `CHROME_ARGS=--no-sandbox` to the end-to-end run.

## Default categories

Built from the categories that recur across common budgeting frameworks (50/30/20, envelope budgeting) — fixed needs first, then variable needs, wants and obligations. All of them can be renamed, recoloured or archived, and users can add their own.

- **Expenses:** Housing · Utilities · Internet & Phone · Insurance · Groceries · Transport · Fuel · Health · Kids · Pets · Education · Dining Out · Coffee & Snacks · Shopping · Entertainment · Subscriptions · Travel · Personal Care · Sports & Fitness · Gifts & Donations · Debt Payments · Taxes & Fees · Other
- **Income:** Salary · Bonus · Freelance · Business · Investments · Interest · Rental · Benefits · Gifts · Refunds · Other

## API at a glance

All routes live under `/api` and speak JSON; everything except auth and FX needs a bearer token.

| Area | Endpoints |
|---|---|
| Auth & profile | `POST /auth/register` · `POST /auth/login` · `GET/PATCH /auth/me` |
| Money | `/accounts` · `/categories` · `/transactions` · `/transfers` (CRUD) |
| Goals | `/goals` (CRUD) · `POST /goals/:id/contributions` |
| Family | `GET/POST/PATCH /household` · `POST /household/join` · `/leave` · `/invite-code` · `DELETE /household/members/:id` |
| Intelligence | `GET/POST /ai/investment` · `GET /fx` |

## Roadmap

- [ ] Mobile app (Expo / React Native) on the same API and `@ft/core`
- [ ] Per-category monthly budgets with alerts
- [ ] Bank sync via open banking (PSD2)
- [ ] AI buying suggestions once a goal is reached
- [ ] Push notifications for insights and goal milestones
