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
├─ backend         REST API — Java 21 · Spring Boot 4 · PostgreSQL 17 (Flyway migrations),
│                  Spring Security with JWT sessions, family sharing, live FX,
│                  Claude-powered investing coach (Anthropic Java SDK).
├─ packages/core   Shared, dependency-free TypeScript — the brains.
│                  Reports, insights, projections, goal plans, habit summaries,
│                  default categories, banks by country, currency conversion.
├─ web             React 19 · Vite · Tailwind CSS 4 · Recharts · TanStack Query.
└─ tests/contract  Black-box HTTP tests for every API endpoint.
```

The analytics live in `packages/core` rather than in the UI, so the upcoming mobile app uses the exact same logic and
the same API. `packages/core` is also the single source of truth for reference data: the backend's `reference.json`
(countries, currencies, banks, default categories) is generated from it with `npm run export:backend-data`, and a test
fails if the two drift apart.

**Data.** Money is stored as exact decimals (`NUMERIC(24, 8)` — cents for fiat, satoshis for crypto) and rounded half
away from zero, exactly like the web app. Ids are UUIDs, dates are real `DATE`s and timestamps `TIMESTAMPTZ`; the
schema is versioned with Flyway (`backend/src/main/resources/db/migration`).

**Tested** at four levels:

- **Backend** — 28 JUnit tests on a real PostgreSQL (embedded, no Docker needed): validation, money rounding and JSON
  output, sessions and sign-in throttling, a golden test proving the Java habit summary matches `@ft/core`
  exactly, a demo-data parity test against the old server, and an import of a real database from the old
  SQLite backend whose every API response must match what the old API returned.
- **API contract** — 108 black-box HTTP tests (`tests/contract`): validation and boundary values, permissions,
  family-sharing isolation, crypto precision, consistency and error shapes, run against a live backend.
- **Core & web** — 86 Vitest tests for the analytics and for every page's loading, empty and error states and its
  interactive details (range filters, report tabs, spending drill-down, theme switching, family invites).
- **End to end** — 28 headless-Chrome checks for page transitions, offline behaviour and failure recovery.

CI (GitHub Actions) runs all four on every pull request, the contract and end-to-end suites against PostgreSQL 17.

**Design notes**

- **Principle:** hierarchy → narrative → data. Each page leads with one sentence and one number, explains what changed, and only then shows the detail.
- **Type:** Newsreader, an editorial serif, for headlines; Inter for interface text and figures, with tabular numbers wherever amounts line up. Both are self-hosted variable fonts, so there are no third-party font requests.
- **Colour:** light is warm ivory with deep forest ink, sage, emerald, peach, sky and a little cobalt; dark is deep blue-black with emerald, electric mint, cobalt, violet and warm orange. One forest/emerald accent marks primary actions, and only the most important element on a page gets a soft glow. Good and bad states always come with an arrow, icon or label, never colour alone.
- **Illustration:** small SVG landscapes drawn with theme tokens, so the same scene is a morning in light mode and a dusk in dark mode. They move gently: the sun breathes, clouds drift, trees sway, and a slow wash of colour drifts behind every page.
- **Motion:** a 220ms fade-and-rise between pages that animates only opacity and transform, after which each page's sections and cards rise in one after another. Charts mount just after the transition and draw themselves in; the headline net worth counts up, and change figures carry a small sparkline (this month against the same point last month) that draws itself. Everything is switched off for anyone who prefers reduced motion.
- **States:** page-shaped loading skeletons (shown only if loading takes over 150ms), friendly empty states, and distinct error screens for server errors, being offline, a missing page, or a page that failed to download.
- **Responsive:** on desktop, a slim icon sidebar that opens over the page on hover or keyboard focus (main sections, a “More” group and Settings; touch screens keep it open); multi-column layouts collapse on tablets; on phones, bottom navigation with a central add button.

**Data & privacy**

- Family members only see what is explicitly shared, and only the person who added a transaction can edit or delete it.
- Passwords are stored as bcrypt hashes; sessions are signed tokens that expire after 30 days, and repeated failed sign-ins are throttled.
- The AI coach receives aggregates only — averages, category shares and balance totals. No names, notes or bank details.
- Exchange rates come from [ExchangeRate-API](https://www.exchangerate-api.com) (fiat, daily) and Coinbase (crypto), cached in the database with an offline fallback.

## Run it locally

You need **Java 21**, **Node 22** and **PostgreSQL** (Docker is the easiest way to get it). The same commands work
in bash, PowerShell and cmd.

```bash
cp .env.example .env     # (Windows cmd: copy .env.example .env) database, JWT secret, optional Anthropic API key
npm run db:up            # PostgreSQL 17 in Docker (or point DB_URL at your own)
npm install
npm run dev              # API on :4000 (Spring Boot), web on :5173 — sign up, then "Load a year of demo data"
```

The API creates its tables on first start. Optional settings: `ANTHROPIC_API_KEY` enables the AI coach,
`CORS_ORIGIN` restricts browser origins, `FX_ENABLED=false` skips live exchange rates.

```bash
npm test                 # Vitest: core and web
npm run test:backend     # JUnit on an embedded PostgreSQL (or set TEST_DB_URL to use your own)
npm run test:contract    # API contract tests, with the backend running
npm run typecheck
E2E_EMAIL=… E2E_PASSWORD=… CHROME_PATH=/path/to/chrome npm run e2e   # with both dev servers running
```

In a container, add `CHROME_ARGS=--no-sandbox` to the end-to-end run. PostgreSQL refuses to run as root, so as root
use `TEST_DB_URL=jdbc:postgresql://localhost:5432/postgres` for the backend tests.

## Deploying

### DigitalOcean App Platform

`.do/app.yaml` describes the whole app: the web app at `/`, the API at `/api` (built from `backend/Dockerfile`) and a
managed PostgreSQL database, all on one domain and redeployed on every push to `main`.

1. In DigitalOcean, **Apps → Create App → Import from app spec**, and upload `.do/app.yaml` (or run
   `doctl apps create --spec .do/app.yaml`). Allow DigitalOcean to access the GitHub repository when asked.
2. Under the **api** component's environment variables, set `JWT_SECRET` to a random string of at least 32
   characters (and `ANTHROPIC_API_KEY` to enable the AI coach). The database variables are already wired up.
3. Deploy. To use your own domain, add it under **Settings → Domains**; HTTPS is set up automatically.

The API needs 1 GB of memory; the spec uses the smallest instance that has it, plus a dev database — roughly
$12 + $7 a month. For backups and failover, point the spec at a managed production cluster instead.

### Anywhere else

```bash
docker compose --profile full up --build    # PostgreSQL + the API, with JWT_SECRET from .env
```

Or build the jar yourself (`npm run build`) and run it with `SPRING_PROFILES_ACTIVE=prod`,
`DB_URL`, `DB_USER`, `DB_PASSWORD` and a `JWT_SECRET` of at least 32 characters — in production the API refuses to
start without one. `/actuator/health` (with liveness and readiness probes) is there for load balancers. Serve the web
app's static build (`npm run build -w web`) from any CDN or web server, with `/api` proxied to the backend.

### Moving over from the SQLite version

Earlier versions of Fintrack stored everything in a SQLite file (`server/data/finance.db`). Import it into an empty
PostgreSQL database once:

```bash
npm run build            # builds the web app and backend/build/libs/fintrack-backend-1.0.0.jar
java -jar backend/build/libs/fintrack-backend-1.0.0.jar --import-sqlite=/path/to/finance.db
```

Everyone keeps their account, password and history: ids, balances, family sharing, goals, AI reports and cached
exchange rates all carry over, amounts become exact decimals, and nothing is written unless every row imports.
Sessions signed with an old `JWT_SECRET` shorter than 32 characters end, so people sign in again once.

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
