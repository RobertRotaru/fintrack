import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Database, Plus, Wallet } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { convert, generateInsights, pctChange, goalPlan, inMonth, monthKey, monthLabel, monthlyReport, project, type Transaction } from '@ft/core';
import { api } from '../lib/api';
import { useUser } from '../lib/auth';
import { greeting, useMoney } from '../lib/format';
import { Icon } from '../lib/icons';
import { useAccounts, useApiMutation, useGoals, useTransactions, useTxs, keys } from '../lib/queries';
import { AccountCard } from '../components/AccountCard';
import { ChartTooltip, SERIES } from '../components/charts';
import { QuickAdd } from '../components/QuickAdd';
import { TransactionForm, TransactionList } from '../components/Transactions';
import { Button, Card, CardHeader, Delta, Empty, Modal, ProgressBar, Spinner, clsx } from '../components/ui';
import { InsightCard } from './Insights';

export function Home() {
  const user = useUser();
  const money = useMoney();
  const navigate = useNavigate();
  const { data: accounts, isLoading } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const { data: goals = [] } = useGoals();
  const { txs } = useTxs();
  const [editing, setEditing] = useState<Transaction | null>(null);

  const seed = useApiMutation(() => api('/demo', { method: 'POST' }), [keys.accounts, keys.transactions, keys.goals, keys.transfers, keys.categories]);

  const thisMonth = monthKey(new Date());
  const report = useMemo(() => monthlyReport(txs, thisMonth), [txs, thisMonth]);
  const insights = useMemo(() => generateInsights(txs, user.baseCurrency).slice(0, 3), [txs, user.baseCurrency]);
  const projection = useMemo(() => project(txs, 1), [txs]);

  if (isLoading) return <Spinner />;

  const active = (accounts ?? []).filter((a) => !a.archived);
  const netWorth = active.reduce((s, a) => s + convert(a.balance, a.currency, user.baseCurrency), 0);
  const daily = report.dailyCumulative;
  const prevToDate = daily[new Date().getDate() - 1]?.previous ?? 0;
  const pace = prevToDate ? pctChange(report.expense, prevToDate) : null;

  if (!active.length) {
    return (
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting()}, {user.name.split(' ')[0]} 👋
        </h1>
        <Card className="mt-8">
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
                  } catch (e) {
                    toast.error((e as Error).message);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* Hero: net worth + month */}
        <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(120%_120%_at_100%_0%,#a5b4fc_0%,#6366f1_45%,#3730a3_100%)] p-6 text-white shadow-xl shadow-brand/20">
          <p className="text-sm font-medium text-white/70">Net worth</p>
          <p className="mt-1 font-display text-4xl font-extrabold tracking-tight num">{money(netWorth)}</p>
          <p className="mt-1 text-xs text-white/60">across {active.length} account{active.length > 1 ? 's' : ''}</p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { l: 'Income', v: report.income, i: ArrowDownRight },
              { l: 'Spent', v: report.expense, i: ArrowUpRight },
              { l: 'Left', v: report.net, i: Wallet },
            ].map(({ l, v, i: I }) => (
              <div key={l} className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                <p className="flex items-center gap-1 text-[11px] font-medium text-white/70">
                  <I className="size-3.5" /> {l}
                </p>
                <p className="mt-0.5 text-base font-bold num truncate">{money(v, { compact: Math.abs(v) >= 100000 })}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 h-24 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" hide />
                <Tooltip content={<ChartTooltip format={(n) => money(n)} labelFormatter={(d) => `Day ${d}`} />} />
                <Area type="monotone" dataKey="previous" name="Last month" stroke="#ffffff66" strokeDasharray="4 4" strokeWidth={1.5} fill="none" isAnimationActive={false} />
                <Area type="monotone" dataKey="current" name="This month" stroke="#fff" strokeWidth={2} fill="url(#heroFill)" connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-white/60">Cumulative spending in {monthLabel(thisMonth, 'long')} — dashed line is last month.</p>
        </div>

        {/* Quick add */}
        <Card>
          <CardHeader title="Quick add" subtitle="Type an amount, tap a category. Done." />
          <QuickAdd autoFocus={false} />
        </Card>
      </div>

      {/* Accounts strip */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Accounts</h2>
          <Link to="/accounts" className="flex items-center gap-1 text-sm font-medium text-brand">
            Manage <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {active.map((a) => (
            <div key={a.id} className="w-64 shrink-0 snap-start">
              <AccountCard account={a} compact onClick={() => navigate(`/transactions?account=${a.id}`)} />
            </div>
          ))}
          <button
            onClick={() => navigate('/accounts?new=1')}
            className="flex aspect-[1.75] w-40 shrink-0 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line text-sm font-medium text-muted hover:border-brand hover:text-brand cursor-pointer"
          >
            <Plus className="size-5" /> New account
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <Link to="/transactions" className="flex items-center gap-1 text-sm font-medium text-brand">
                All <ArrowRight className="size-4" />
              </Link>
            }
          />
          {transactions.length ? (
            <TransactionList txs={transactions} limit={8} onSelect={setEditing} />
          ) : (
            <p className="py-8 text-center text-sm text-muted">Nothing yet — add your first expense above.</p>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="This month" subtitle={`${Math.round(projection.currentMonth.progress * 100)}% of the month gone`} />
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-2">Spent so far</span>
                <span className="flex items-center gap-2 font-semibold num">
                  {money(report.expense)}
                  {pace !== null && <Delta value={pace} inverse />}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-2">Expected by month end</span>
                <span className="font-semibold num">{money(projection.currentMonth.projectedExpense)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-2">Last month total</span>
                <span className="font-semibold num text-muted">{money(report.prev.expense)}</span>
              </div>
              <ProgressBar
                value={report.prev.expense ? report.expense / report.prev.expense : 0}
                color={report.expense > report.prev.expense ? SERIES.expense : 'var(--brand)'}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Insights"
              action={
                <Link to="/insights" className="flex items-center gap-1 text-sm font-medium text-brand">
                  All <ArrowRight className="size-4" />
                </Link>
              }
            />
            {insights.length ? (
              <div className="space-y-2">
                {insights.map((i) => (
                  <InsightCard key={i.id} insight={i} compact />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Insights appear once you've tracked a few weeks of activity.</p>
            )}
          </Card>

          {goals.filter((g) => !g.completedAt).length > 0 && (
            <Card>
              <CardHeader
                title="Goals"
                action={
                  <Link to="/goals" className="flex items-center gap-1 text-sm font-medium text-brand">
                    All <ArrowRight className="size-4" />
                  </Link>
                }
              />
              <div className="space-y-4">
                {goals
                  .filter((g) => !g.completedAt)
                  .slice(0, 3)
                  .map((g) => {
                    const plan = goalPlan(g, projection.avgMonthlyNet);
                    return (
                      <Link to="/goals" key={g.id} className="block">
                        <div className="mb-1.5 flex items-center gap-2 text-sm">
                          <Icon name={g.icon} className="size-4" style={{ color: g.color }} />
                          <span className="flex-1 font-medium">{g.name}</span>
                          <span className="text-xs text-muted num">
                            {money(g.saved, { currency: g.currency, compact: true })} / {money(g.targetAmount, { currency: g.currency, compact: true })}
                          </span>
                        </div>
                        <ProgressBar value={plan.progress} color={g.color} />
                      </Link>
                    );
                  })}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit transaction">
        {editing && <TransactionForm tx={editing} onDone={() => setEditing(null)} />}
      </Modal>

      <p className={clsx('text-center text-xs text-muted', inMonth(txs, thisMonth).length ? '' : 'hidden')}>
        Tip: press <kbd className="rounded border border-line px-1">N</kbd> anywhere to add a transaction.
      </p>
    </div>
  );
}
