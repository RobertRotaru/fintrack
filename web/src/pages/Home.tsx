import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowRight, ChevronRight, Database, PiggyBank, Plus, ReceiptText, TrendingUp } from 'lucide-react';
import {
  balanceChange, convert, financialMood, generateInsights, goalPlan, inMonth, monthKey, monthLabel, monthlyReport, pctChange, project, toISODate,
  type Account, type Insight, type Transaction,
} from '@ft/core';
import { api } from '../lib/api';
import { useUser } from '../lib/auth';
import { greeting, moneyParts, useMoney } from '../lib/format';
import { Icon } from '../lib/icons';
import { useAccounts, useApiMutation, useFlows, useGoals, useTransactions, useTxs, keys } from '../lib/queries';
import { InstitutionLogo } from '../components/AccountCard';
import { NetWorthChart, SERIES } from '../components/charts';
import { Landscape } from '../components/illustrations';
import { QuickAdd } from '../components/QuickAdd';
import { TransactionForm, TransactionList } from '../components/Transactions';
import { Button, Card, Delta, Empty, Modal, ProgressBar, SectionTitle, Trend, clsx } from '../components/ui';
import { loadGate } from '../components/states';

// A rolling 30-day window: early in a month, "month to date" would mostly measure
// whether payday has happened yet.
const thirtyDaysAgo = (d = new Date()) => toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 30));

/** Where an observation leads: the page that lets you act on it. */
const INSIGHT_ACTION: Record<Insight['group'], { to: string; label: string }> = {
  spending: { to: '/spending', label: 'See spending' },
  income: { to: '/reports?tab=income', label: 'See income' },
  saving: { to: '/goals', label: 'Open goals' },
  habits: { to: '/insights', label: 'Learn more' },
};

export function Home() {
  const user = useUser();
  const money = useMoney();
  const navigate = useNavigate();
  const accountsQ = useAccounts();
  const txQ = useTransactions();
  const accounts = accountsQ.data;
  const transactions = txQ.data ?? [];
  // Goals are a side panel: if they fail to load, the panel just stays hidden.
  const { data: goals = [] } = useGoals();
  const { txs } = useTxs();
  const flows = useFlows();
  const [editing, setEditing] = useState<Transaction | null>(null);

  const seed = useApiMutation(() => api('/demo', { method: 'POST' }), [keys.accounts, keys.transactions, keys.goals, keys.transfers, keys.categories]);

  const thisMonth = monthKey(new Date());
  const report = useMemo(() => monthlyReport(txs, thisMonth), [txs, thisMonth]);
  const insights = useMemo(() => generateInsights(txs, user.baseCurrency).slice(0, 3), [txs, user.baseCurrency]);
  const projection = useMemo(() => project(txs, 1), [txs]);
  const active = useMemo(() => (accounts ?? []).filter((a) => !a.archived), [accounts]);

  const gate = loadGate([accountsQ, txQ], 'dashboard');
  if (gate) return gate;

  const firstName = user.name.split(' ')[0];

  if (!active.length) {
    return (
      <div>
        <p className="text-ink-2">
          {greeting()}, {firstName} 👋
        </p>
        <h1 className="mt-2 text-5xl leading-[1.05]">Welcome to Fintrack.</h1>
        <Card className="mt-10">
          <Empty icon="wallet" title="Let's set up your money" action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => navigate('/accounts?new=1')}>
                <Plus className="size-4" /> Add your first account
              </Button>
              <Button
                variant="secondary"
                loading={seed.isPending}
                onClick={async () => {
                  try {
                    await seed.mutateAsync(undefined);
                    toast.success('Demo data loaded — explore away!');
                  } catch {
                    // The global mutation error handler already showed a toast.
                  }
                }}
              >
                <Database className="size-4" /> Load a year of demo data
              </Button>
            </div>
          }>
            Add the accounts you use — bank cards, savings, loans, investments or crypto. Or load demo data to see what the app can do.
          </Empty>
        </Card>
      </div>
    );
  }

  const since = thirtyDaysAgo();
  const worth = balanceChange(active, flows, since, user.baseCurrency);
  const daily = report.dailyCumulative;
  const prevToDate = daily[new Date().getDate() - 1]?.previous ?? 0;
  const pace = prevToDate ? pctChange(report.expense, prevToDate) : null;
  const mood = financialMood({ hasData: true, netWorthPct: worth.pct, spendingPace: pace, savingsRate: report.income ? report.savingsRate : null });

  const savingAccounts = active.filter((a) => a.type === 'savings');
  const investAccounts = active.filter((a) => a.type === 'investment' || a.type === 'crypto');
  const saving = balanceChange(savingAccounts, flows, since, user.baseCurrency);
  const investing = balanceChange(investAccounts, flows, since, user.baseCurrency);
  const openGoals = goals.filter((g) => !g.completedAt);

  return (
    <div className="space-y-16 lg:space-y-20">
      {/* 1. How am I doing? */}
      <section className="relative overflow-hidden rounded-[32px] border border-line bg-surface shadow-[var(--shadow)]" aria-labelledby="mood">
        <Landscape className="absolute inset-0 h-full w-full" />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_minmax(0,520px)] lg:items-start lg:gap-10 lg:p-12">
          <div className="max-w-md pt-2" data-testid="home-mood" data-tone={mood.tone}>
            <p className="text-[15px] text-ink-2">
              {greeting()}, {firstName} <span aria-hidden="true">👋</span>
            </p>
            <h1 id="mood" className="mt-3 text-[44px] leading-[1.02] tracking-[-0.025em] sm:text-6xl">
              {mood.headline}
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-2">{mood.subline}</p>
          </div>

          <div className="rounded-[26px] border border-line bg-surface/90 p-6 shadow-[var(--shadow-lg)] backdrop-blur-md sm:p-7 glow">
            <p className="eyebrow">Total net worth</p>
            <HeroAmount amount={worth.now} currency={user.baseCurrency} />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Trend value={worth.pct} suffix="in 30 days" />
              <span className="text-sm text-muted">
                across {active.length} account{active.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="mt-6">
              <NetWorthChart accounts={active} flows={flows} currency={user.baseCurrency} height={190} initialRange="6M" />
            </div>
            <Link to="/accounts" className="group mt-5 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm font-medium text-ink-2 transition hover:text-ink">
              View all accounts <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 2. What changed? */}
      <section aria-labelledby="glance">
        <SectionTitle title={<span id="glance">Your money at a glance.</span>} subtitle={`Spending for ${monthLabel(thisMonth, 'long')} so far; savings and investments over the last 30 days.`} />
        <div className="grid gap-px overflow-hidden rounded-[24px] border border-line bg-line sm:grid-cols-3">
          <GlanceItem
            to="/spending"
            icon={<ReceiptText className="size-5" />}
            tone="var(--peach)"
            label="Spending"
            value={money(report.expense)}
            trend={<Trend value={pace} inverse suffix="vs. last month" />}
            note={`On track for about ${money(projection.currentMonth.projectedExpense, { compact: projection.currentMonth.projectedExpense >= 100000 })} by month end.`}
          />
          <GlanceItem
            to="/accounts"
            icon={<PiggyBank className="size-5" />}
            tone="var(--emerald)"
            label="Saving"
            value={savingAccounts.length ? money(saving.now) : '—'}
            trend={savingAccounts.length ? <Trend value={saving.pct} suffix="in 30 days" /> : <span className="text-sm text-muted">No savings account yet</span>}
            note={savingAccounts.length ? `Across ${savingAccounts.length} savings account${savingAccounts.length > 1 ? 's' : ''}.` : 'Add one to watch your safety net grow.'}
          />
          <GlanceItem
            to={investAccounts.length ? '/accounts' : '/invest'}
            icon={<TrendingUp className="size-5" />}
            tone="var(--cobalt)"
            label="Investing"
            value={investAccounts.length ? money(investing.now) : '—'}
            trend={investAccounts.length ? <Trend value={investing.pct} suffix="in 30 days" /> : <span className="text-sm text-muted">Not investing yet</span>}
            note={investAccounts.length ? 'Investments and crypto, at today’s rates.' : 'The AI coach can tell you if you’re ready.'}
          />
        </div>
      </section>

      {/* 3. What should I pay attention to? */}
      <section aria-labelledby="attention" className="grid gap-10 lg:grid-cols-[1.35fr_1fr]">
        <div className="min-w-0">
          <SectionTitle
            title={<span id="attention">What needs your attention.</span>}
            subtitle={insights.length ? `${insights.length} useful ${insights.length === 1 ? 'observation' : 'observations'} from your recent activity.` : undefined}
            to="/insights"
            linkLabel="All insights"
          />
          {insights.length ? (
            <ul className="space-y-3" data-testid="attention-list">
              {insights.map((i) => (
                <li key={i.id}>
                  <Observation insight={i} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[20px] border border-dashed border-line-strong px-6 py-10 text-center text-sm text-muted">
              Nothing needs you right now. Observations appear once you’ve tracked a few weeks of activity.
            </p>
          )}
        </div>

        <div className="min-w-0">
          <SectionTitle title="This month." />
          <Card className="!p-6">
            <p className="eyebrow">Spent so far</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="figure text-3xl">{money(report.expense)}</span>
              {pace !== null && <Delta value={pace} inverse />}
            </div>
            <div className="mt-5">
              <ProgressBar
                size="lg"
                label="Spending compared with last month"
                value={report.prev.expense ? report.expense / report.prev.expense : 0}
                color={report.expense > report.prev.expense ? SERIES.expense : 'var(--emerald)'}
              />
              <div className="mt-2 flex justify-between text-xs text-muted">
                <span>{Math.round(projection.currentMonth.progress * 100)}% of the month gone</span>
                <span className="num">Last month {money(report.prev.expense)}</span>
              </div>
            </div>
            <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-2">Came in</dt>
                <dd className="font-semibold num">{money(report.income)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Expected spending by month end</dt>
                <dd className="font-semibold num">{money(projection.currentMonth.projectedExpense)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Left this month</dt>
                <dd className={clsx('font-semibold num', report.net < 0 && 'text-bad')}>{money(report.net, { sign: true })}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </section>

      {/* 4. What can I do about it? */}
      <section aria-labelledby="next" className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div className="min-w-0">
          <SectionTitle title={<span id="next">Keep moving.</span>} subtitle="Your goals, and how far you’ve come." to="/goals" linkLabel="All goals" />
          {openGoals.length ? (
            <ul className="space-y-6">
              {openGoals.slice(0, 3).map((g) => {
                const plan = goalPlan(g, projection.avgMonthlyNet);
                return (
                  <li key={g.id}>
                    <Link to="/goals" className="group block">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${g.color} 16%, var(--surface))`, color: g.color }}>
                          <Icon name={g.icon} className="size-4" />
                        </span>
                        <span className="flex-1 font-medium group-hover:underline underline-offset-4">{g.name}</span>
                        <span className="text-sm font-semibold num">{Math.round(plan.progress * 100)}%</span>
                      </div>
                      <ProgressBar value={plan.progress} color={g.color} label={`${g.name} progress`} />
                      <p className="mt-1.5 text-xs text-muted num">
                        {money(g.saved, { currency: g.currency, compact: true })} of {money(g.targetAmount, { currency: g.currency, compact: true })}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Link to="/goals" className="flex items-center justify-between rounded-[20px] border border-dashed border-line-strong px-6 py-8 text-sm text-muted transition hover:text-ink">
              Set a goal and turn your plans into progress. <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
        <Card className="!p-6">
          <h3 className="font-display text-2xl">Log a purchase</h3>
          <p className="mb-4 mt-1 text-sm text-muted">Type an amount, tap a category. Done.</p>
          <QuickAdd autoFocus={false} />
        </Card>
      </section>

      {/* Details live deeper — a short trail into them. */}
      <section className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <SectionTitle title="Recent activity." to="/transactions" linkLabel="All activity" />
          <Card className="!p-3 sm:!p-4">
            {transactions.length ? (
              <TransactionList txs={transactions} limit={6} onSelect={setEditing} />
            ) : (
              <p className="py-8 text-center text-sm text-muted">Nothing yet — log your first purchase above.</p>
            )}
          </Card>
        </div>
        <div className="min-w-0">
          <SectionTitle title="Accounts." to="/accounts" linkLabel="Manage" />
          <ul className="space-y-1">
            {active.slice(0, 5).map((a) => (
              <li key={a.id}>
                <MiniAccount account={a} onClick={() => navigate(`/transactions?account=${a.id}`)} />
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate('/accounts?new=1')}
            className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-brand-fg transition hover:bg-surface cursor-pointer"
          >
            <span className="flex size-9 items-center justify-center rounded-xl border border-dashed border-line-strong">
              <Plus className="size-4" />
            </span>
            Add an account
          </button>
        </div>
      </section>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit transaction">
        {editing && <TransactionForm tx={editing} onDone={() => setEditing(null)} />}
      </Modal>

      <p className={clsx('text-center text-xs text-muted', inMonth(txs, thisMonth).length ? '' : 'hidden')}>
        Tip: press <kbd className="rounded border border-line px-1">N</kbd> anywhere to add a transaction.
      </p>
    </div>
  );
}

function GlanceItem({ to, icon, tone, label, value, trend, note }: { to: string; icon: React.ReactNode; tone: string; label: string; value: string; trend: React.ReactNode; note: string }) {
  return (
    <Link to={to} className="group relative bg-surface p-6 transition hover:bg-surface-2/60 sm:p-7" data-testid={`glance-${label.toLowerCase()}`}>
      <div className="flex items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-2xl" style={{ background: `color-mix(in oklab, ${tone} 16%, var(--surface))`, color: tone }}>
          {icon}
        </span>
        <ChevronRight className="size-4 text-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>
      <p className="mt-5 text-sm font-medium text-ink-2">{label}</p>
      <p className="figure mt-1 truncate text-[28px] leading-tight">{value}</p>
      <div className="mt-1">{trend}</div>
      <p className="mt-3 text-xs leading-relaxed text-muted">{note}</p>
    </Link>
  );
}

const OBS_TONE = {
  good: 'var(--emerald)',
  bad: 'var(--peach)',
  neutral: 'var(--cobalt)',
} as const;

/** An insight written as an observation, with a way to act on it. */
function Observation({ insight }: { insight: Insight }) {
  const tone = OBS_TONE[insight.tone];
  const action = INSIGHT_ACTION[insight.group];
  return (
    <Link to={action.to} className="row-hover group flex items-start gap-4 rounded-[20px] border border-line bg-surface/60 p-5">
      <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `color-mix(in oklab, ${tone} 15%, var(--surface))`, color: tone }}>
        <Icon name={insight.icon} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold tracking-[-0.01em]">{insight.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{insight.detail}</p>
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-fg">
          {action.label} <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </p>
      </div>
      {insight.metric && (
        <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold num" style={{ background: `color-mix(in oklab, ${tone} 14%, var(--surface))`, color: `color-mix(in oklab, ${tone} 80%, var(--ink))` }}>
          {insight.metric}
        </span>
      )}
    </Link>
  );
}

function MiniAccount({ account: a, onClick }: { account: Account; onClick: () => void }) {
  const user = useUser();
  const money = useMoney();
  return (
    <button type="button" onClick={onClick} className="row-hover flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left cursor-pointer">
      {a.institutionId || a.institutionName ? (
        <InstitutionLogo institutionId={a.institutionId} name={a.institutionName} color={a.color} size={36} />
      ) : (
        <span className="flex size-9 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${a.color} 18%, var(--surface))`, color: a.color }}>
          <Icon name={a.icon} className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{a.name}</span>
        <span className="block truncate text-xs text-muted">{a.institutionName ?? a.type}</span>
      </span>
      <span className={clsx('text-sm font-semibold num', a.balance < 0 && 'text-bad')}>{money(convert(a.balance, a.currency, user.baseCurrency))}</span>
    </button>
  );
}

/**
 * The headline figure. Sized against its card (container query units) so a
 * long amount still fits on a phone, with the currency de-emphasised.
 */
function HeroAmount({ amount, currency }: { amount: number; currency: string }) {
  const { currency: label, number, before } = moneyParts(amount, currency);
  const cur = <span className="text-[0.4em] font-medium tracking-normal text-muted">{label}</span>;
  return (
    <div className="@container">
      <p
        className="figure mt-2 flex items-baseline gap-[0.2em] whitespace-nowrap leading-none text-[clamp(2.25rem,12cqi,3.75rem)]"
        aria-label={`${number} ${label}`}
        data-testid="net-worth"
      >
        {before && cur}
        <span>{number}</span>
        {!before && cur}
      </p>
    </div>
  );
}
