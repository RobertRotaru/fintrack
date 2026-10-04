import { useMemo } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Repeat } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { convert, monthLabel, project } from '@ft/core';
import { useUser } from '../lib/auth';
import { useMoney } from '../lib/format';
import { useAccounts, useTxs } from '../lib/queries';
import { ChartTooltip, Legend, SERIES, axisProps } from '../components/charts';
import { Card, CardHeader, Empty, IconBadge, PageHeader, ProgressBar, clsx } from '../components/ui';
import { loadGate } from '../components/states';

const HORIZON = 6;

export function Projections() {
  const user = useUser();
  const money = useMoney();
  const txsQ = useTxs();
  const accountsQ = useAccounts();
  const { txs } = txsQ;
  const accounts = accountsQ.data ?? [];
  const p = useMemo(() => project(txs, HORIZON), [txs]);

  const gate = loadGate([txsQ, accountsQ], 'charts');
  if (gate) return gate;
  if (p.basisMonths < 1) {
    return (
      <div>
        <PageHeader title="Projections" />
        <Card>
          <Empty icon="trending-up" title="Not enough history yet">
            Projections learn from complete months. Keep tracking and they'll appear after your first full month.
          </Empty>
        </Card>
      </div>
    );
  }

  const netWorth = accounts.filter((a) => !a.archived).reduce((s, a) => s + convert(a.balance, a.currency, user.baseCurrency), 0);
  const nextMonth = p.future[1];

  // History solid, projection dashed; the two meet at the last actual month.
  const lastHist = p.history[p.history.length - 1];
  const flow = [
    ...p.history.map((m) => ({ label: monthLabel(m.month), income: m.income, expense: m.expense })),
    ...p.future.map((m) => ({ label: monthLabel(m.month), incomeP: m.income, expenseP: m.expense })),
  ];
  if (lastHist) Object.assign(flow[p.history.length - 1], { incomeP: lastHist.income, expenseP: lastHist.expense });

  // Projected net worth: today's balance rolled forward by each projected month's net.
  // Only the not-yet-happened part of the current month counts.
  const remainingThisMonth = p.future[0].net - (p.currentMonth.incomeSoFar - p.currentMonth.expenseSoFar);
  let running = netWorth + remainingThisMonth;
  const worth = [{ label: 'Now', value: netWorth }];
  worth.push({ label: monthLabel(p.future[0].month) + ' end', value: running });
  for (const m of p.future.slice(1)) {
    running += m.net;
    worth.push({ label: monthLabel(m.month), value: running });
  }
  const finalWorth = worth[worth.length - 1].value;

  const expenses = p.categories.filter((c) => c.kind === 'expense');
  const incomes = p.categories.filter((c) => c.kind === 'income');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projections"
        subtitle={`Based on your last ${p.basisMonths} complete month${p.basisMonths > 1 ? 's' : ''} — recent months weigh more, recurring bills stay fixed.`}
        action={
          <span
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-semibold',
              p.confidence === 'high' ? 'bg-good-soft text-good' : p.confidence === 'medium' ? 'bg-brand-soft text-brand-fg' : 'bg-surface-2 text-muted',
            )}
          >
            {p.confidence === 'high' ? 'High' : p.confidence === 'medium' ? 'Medium' : 'Low'} confidence
          </span>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-muted">Expected income / mo</p>
          <p className="font-display mt-1 text-xl font-bold num">{money(nextMonth.income)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-muted">Expected spending / mo</p>
          <p className="font-display mt-1 text-xl font-bold num">{money(nextMonth.expense)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-muted">Expected to save / mo</p>
          <p className={clsx('font-display mt-1 text-xl font-bold num', nextMonth.net < 0 && 'text-bad')}>{money(nextMonth.net, { sign: true })}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-muted">Net worth in {HORIZON} months</p>
          <p className="font-display mt-1 text-xl font-bold num">{money(finalWorth)}</p>
          <p className={clsx('text-xs font-medium num', finalWorth >= netWorth ? 'text-good' : 'text-bad')}>{money(finalWorth - netWorth, { sign: true })}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Income & spending outlook" subtitle="Solid = actual · dashed = projected" />
          <Legend
            items={[
              { label: 'Income', color: SERIES.income },
              { label: 'Expenses', color: SERIES.expense },
            ]}
          />
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={flow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={SERIES.grid} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={72} tickFormatter={(v) => money(v, { compact: true })} />
                <Tooltip content={<ChartTooltip format={(n) => money(n)} />} />
                <Line dataKey="income" name="Income" stroke={SERIES.income} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                <Line dataKey="expense" name="Expenses" stroke={SERIES.expense} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                <Line dataKey="incomeP" name="Income (projected)" stroke={SERIES.income} strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line dataKey="expenseP" name="Expenses (projected)" stroke={SERIES.expense} strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Projected net worth" subtitle={`If the next ${HORIZON} months follow your habits`} />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={worth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="worthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES.net} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={SERIES.net} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={SERIES.grid} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={72} domain={['auto', 'auto']} tickFormatter={(v) => money(v, { compact: true })} />
                <Tooltip content={<ChartTooltip format={(n) => money(n)} />} />
                <ReferenceLine y={netWorth} stroke="var(--muted)" strokeDasharray="3 3" />
                <Area dataKey="value" name="Net worth" stroke={SERIES.net} strokeWidth={2} fill="url(#worthFill)" dot={{ r: 3, fill: SERIES.net }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title={`${monthLabel(p.currentMonth.month, 'long')} so far`} subtitle={`${Math.round(p.currentMonth.progress * 100)}% of the month has passed`} />
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            { l: 'Income', so: p.currentMonth.incomeSoFar, exp: p.currentMonth.projectedIncome, c: SERIES.income, I: ArrowDownRight },
            { l: 'Spending', so: p.currentMonth.expenseSoFar, exp: p.currentMonth.projectedExpense, c: SERIES.expense, I: ArrowUpRight },
          ].map(({ l, so, exp, c, I }) => (
            <div key={l}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  <I className="size-4" style={{ color: c }} /> {l}
                </span>
                <span className="num">
                  <b>{money(so)}</b> <span className="text-muted">of ~{money(exp)} expected</span>
                </span>
              </div>
              <ProgressBar value={exp ? so / exp : 0} color={c} />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Next month by category" subtitle="Average of recent months vs what we expect next" />
          <ul className="divide-y divide-line">
            {[...expenses.slice(0, 10), ...incomes.slice(0, 4)].map((c) => (
              <li key={`${c.kind}-${c.name}`} className="flex items-center gap-3 py-2.5">
                <IconBadge icon={c.icon} color={c.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {c.name}
                    {c.recurring && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                        <Repeat className="size-2.5" /> fixed
                      </span>
                    )}
                    {c.kind === 'income' && <span className="rounded bg-good-soft px-1.5 py-0.5 text-[10px] font-semibold text-good">income</span>}
                  </p>
                  <p className="text-xs text-muted num">avg {money(c.average)}</p>
                </div>
                <TrendArrow trend={c.trend} kind={c.kind} />
                <span className="w-24 text-right text-sm font-semibold num">{money(c.projected)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Recurring money" subtitle="Detected from payments that repeat every month" />
          {p.recurring.length ? (
            <ul className="divide-y divide-line">
              {p.recurring.map((r, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <IconBadge icon={r.icon} color={r.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.note || r.category}</p>
                    <p className="text-xs text-muted">
                      around day {r.day} · seen {r.monthsSeen} of 6 months
                    </p>
                  </div>
                  <span className={clsx('text-sm font-semibold num', r.kind === 'income' && 'text-good')}>
                    {money(r.kind === 'income' ? r.amount : -r.amount, { sign: r.kind === 'income' })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted">No recurring payments detected yet. Adding notes (e.g. "Rent", "Netflix") helps.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function TrendArrow({ trend, kind }: { trend: 'up' | 'down' | 'flat'; kind: 'income' | 'expense' }) {
  if (trend === 'flat') return <ArrowRight className="size-4 text-muted" aria-label="steady" />;
  const good = kind === 'income' ? trend === 'up' : trend === 'down';
  const I = trend === 'up' ? ArrowUpRight : ArrowDownRight;
  return <I className={clsx('size-4', good ? 'text-good' : 'text-bad')} aria-label={`trending ${trend}`} />;
}
