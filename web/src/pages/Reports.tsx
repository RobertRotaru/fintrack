import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight, ChevronLeft, ChevronRight, Table2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ResponsiveContainer } from '../components/ResponsiveChart';
import {
  ACCOUNT_TYPES, addMonths, convert, monthKey, monthLabel, monthlyReport, monthlyTotals, pctChange, yearlyReport, type CategoryComparison, type TxKind,
} from '@ft/core';
import { useUser } from '../lib/auth';
import { useMoney, percent, formatDay } from '../lib/format';
import { Icon } from '../lib/icons';
import { useAccounts, useFlows, useTxs } from '../lib/queries';
import { CategoryDonut, ChartTooltip, Legend, NetWorthChart, SERIES, axisProps } from '../components/charts';
import { Card, CardHeader, Delta, Empty, IconBadge, IconButton, PageHeader, Segmented, Trend, clsx } from '../components/ui';
import { loadGate } from '../components/states';

type Mode = 'month' | 'year';
export type ReportTab = 'overview' | 'spending' | 'income' | 'networth';
const TABS: { value: ReportTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'spending', label: 'Spending' },
  { value: 'income', label: 'Income' },
  { value: 'networth', label: 'Net worth' },
];
const isTab = (t: string | null): t is ReportTab => TABS.some((x) => x.value === t);

export function Reports() {
  const txsQ = useTxs();
  const { txs } = txsQ;
  const [params, setParams] = useSearchParams();
  const tab: ReportTab = isTab(params.get('tab')) ? (params.get('tab') as ReportTab) : 'overview';
  const setTab = (t: ReportTab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState(monthKey(new Date()));
  const [year, setYear] = useState(new Date().getFullYear());
  const now = monthKey(new Date());

  const label = mode === 'month' ? monthLabel(month, 'long') : String(year);
  const canNext = mode === 'month' ? month < now : year < new Date().getFullYear();
  const step = (dir: 1 | -1) => (mode === 'month' ? setMonth((m) => addMonths(m, dir)) : setYear((y) => y + dir));

  const gate = loadGate([txsQ], 'charts');
  if (gate) return gate;

  const periodControls = (
    <div className="flex flex-wrap items-center gap-2">
      {tab !== 'overview' && (
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'month', label: 'Monthly' },
            { value: 'year', label: 'Yearly' },
          ]}
        />
      )}
      <div className="flex items-center rounded-full border border-line bg-surface shadow-[var(--shadow)]">
        <IconButton label="Previous period" onClick={() => step(-1)} className="rounded-full">
          <ChevronLeft className="size-4" />
        </IconButton>
        <span className="min-w-32 text-center text-sm font-semibold">{label}</span>
        <IconButton label="Next period" onClick={() => step(1)} disabled={!canNext} className="rounded-full disabled:opacity-30">
          <ChevronRight className="size-4" />
        </IconButton>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Reports" subtitle="Where your money came from, where it went, and what it adds up to." />
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-line">
        <div role="tablist" aria-label="Report" className="-mb-px flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={clsx(
                'border-b-2 pb-3 text-sm font-medium transition cursor-pointer',
                tab === t.value ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'networth' && txs.length > 0 && <div className="pb-3">{periodControls}</div>}
      </div>
      {tab === 'networth' ? (
        <NetWorthReport />
      ) : !txs.length ? (
        <Card>
          <Empty icon="bar-chart" title="No data to report yet">Reports fill in as you add income and expenses.</Empty>
        </Card>
      ) : tab === 'overview' ? (
        <Overview month={month} />
      ) : mode === 'month' ? (
        <MonthReport month={month} kind={tab === 'income' ? 'income' : 'expense'} />
      ) : (
        <YearReport year={year} kind={tab === 'income' ? 'income' : 'expense'} />
      )}
    </div>
  );
}

/** The editorial summary: three numbers, one sentence, one chart. */
function Overview({ month }: { month: string }) {
  const money = useMoney();
  const { txs } = useTxs();
  const r = useMemo(() => monthlyReport(txs, month), [txs, month]);
  const six = useMemo(() => monthlyTotals(txs, addMonths(month, -5), month).map((m) => ({ ...m, label: monthLabel(m.month) })), [txs, month]);
  const prevLabel = monthLabel(addMonths(month, -1), 'long');
  const sentence =
    r.income > 0
      ? r.net >= 0
        ? `You kept ${percent(r.savingsRate)} of what came in during ${monthLabel(month, 'long')}.`
        : `You spent ${money(-r.net)} more than came in during ${monthLabel(month, 'long')}.`
      : r.expense > 0
        ? `No income recorded in ${monthLabel(month, 'long')} yet.`
        : `A quiet ${monthLabel(month, 'long')} — nothing recorded.`;
  const metrics = [
    { label: 'Total income', value: r.income, change: pctChange(r.income, r.prev.income), inverse: false },
    { label: 'Total spending', value: r.expense, change: pctChange(r.expense, r.prev.expense), inverse: true },
    { label: 'Net change', value: r.net, change: null, inverse: false },
  ];
  // A percentage of a net figure is meaningless when it changes sign, so net change compares amounts.
  const netDiff = r.net - r.prev.net;
  return (
    <div className="space-y-12">
      <section>
        <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-[28px] leading-tight">Monthly overview</h2>
          <span className="text-sm text-muted">{monthLabel(month, 'long')}</span>
        </div>
        <div className="grid gap-px overflow-hidden rounded-[24px] border border-line bg-line sm:grid-cols-3" data-testid="overview-metrics">
          {metrics.map((m) => (
            <div key={m.label} className="bg-surface p-6 sm:p-7">
              <p className="text-sm font-medium text-ink-2">{m.label}</p>
              <p className={clsx('figure mt-2 truncate text-4xl leading-none', m.label === 'Net change' && m.value < 0 && 'text-bad')}>
                {money(m.value, { sign: m.label === 'Net change' })}
              </p>
              <div className="mt-2">
                {m.label === 'Net change' ? (
                  <span className="text-sm text-muted">
                    <span className={clsx('font-medium num', netDiff >= 0 ? 'text-good' : 'text-bad')}>{money(netDiff, { sign: true })}</span> vs. {prevLabel}
                  </span>
                ) : (
                  <Trend value={m.change} inverse={m.inverse} suffix={`vs. ${prevLabel}`} />
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-2xl font-display text-[26px] leading-snug text-ink-2" data-testid="overview-sentence">
          {sentence}
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="!p-7">
          <CardHeader title="Income and spending" subtitle="The last six months" />
          <Legend
            items={[
              { label: 'Income', color: 'var(--emerald)' },
              { label: 'Spending', color: 'var(--cobalt)' },
            ]}
          />
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={six} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={6} barCategoryGap="26%">
                <CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="2 6" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={76} tickFormatter={(v) => money(v, { compact: true })} tickCount={4} />
                <Tooltip cursor={{ fill: 'var(--surface-2)', radius: 12 }} content={<ChartTooltip format={(n) => money(n)} />} />
                <Bar dataKey="income" name="Income" fill="var(--emerald)" radius={[8, 8, 8, 8]} maxBarSize={22} />
                <Bar dataKey="expense" name="Spending" fill="var(--cobalt)" radius={[8, 8, 8, 8]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="!p-7">
          <CardHeader title="Savings rate" subtitle="Share of income you kept" />
          <p className="figure text-5xl">{r.income ? percent(r.savingsRate) : '—'}</p>
          <p className="mt-1 text-sm text-muted">{r.prev.income ? `${percent(r.prev.savingsRate)} in ${prevLabel}` : 'Nothing to compare yet'}</p>
          <ul className="mt-6 space-y-3">
            {six.slice(-4).map((m) => (
              <li key={m.month} className="flex items-center gap-3 text-sm">
                <span className="w-10 text-muted">{m.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div className="grow-x h-full rounded-full bg-emerald" style={{ width: `${Math.max(0, Math.min(100, m.savingsRate * 100))}%` }} />
                </div>
                <span className="w-10 text-right font-medium num">{m.income ? percent(m.savingsRate) : '—'}</span>
              </li>
            ))}
          </ul>
          <Link to="/insights" className="group mt-6 inline-flex items-center gap-1 text-sm font-medium text-brand-fg">
            What’s behind it <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </Link>
        </Card>
      </section>
    </div>
  );
}

/** Net worth over time, and what it's made of. */
function NetWorthReport() {
  const user = useUser();
  const money = useMoney();
  const accountsQ = useAccounts();
  const flows = useFlows();
  const gate = loadGate([accountsQ], 'charts');
  if (gate) return gate;
  const active = (accountsQ.data ?? []).filter((a) => !a.archived);
  if (!active.length) {
    return (
      <Card>
        <Empty icon="wallet" title="No accounts yet">Add the accounts you use and your net worth history appears here.</Empty>
      </Card>
    );
  }
  const base = (n: number, c: string) => convert(n, c, user.baseCurrency);
  const groups = ACCOUNT_TYPES.map((t) => ({ ...t, total: active.filter((a) => a.type === t.type).reduce((s, a) => s + base(a.balance, a.currency), 0) })).filter((g) => g.total !== 0);
  const assets = groups.filter((g) => g.total > 0).reduce((s, g) => s + g.total, 0);
  return (
    <div className="space-y-10">
      <Card className="!p-7 glow">
        <p className="eyebrow">Net worth</p>
        <p className="figure mt-2 text-5xl leading-none">{money(active.reduce((s, a) => s + base(a.balance, a.currency), 0))}</p>
        <div className="mt-6">
          <NetWorthChart accounts={active} flows={flows} currency={user.baseCurrency} height={320} initialRange="1Y" />
        </div>
      </Card>
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="!p-7">
          <CardHeader title="What it’s made of" subtitle="By account type, at today’s rates" />
          <ul className="space-y-4">
            {groups.map((g) => (
              <li key={g.type}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-ink-2">
                    <Icon name={g.icon} className="size-4 text-muted" /> {g.label}
                  </span>
                  <span className={clsx('font-semibold num', g.total < 0 && 'text-bad')}>{money(g.total)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                  <div className="grow-x h-full rounded-full" style={{ width: `${assets ? Math.min(100, (Math.abs(g.total) / assets) * 100) : 0}%`, background: g.total < 0 ? 'var(--bad)' : 'var(--emerald)' }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="!p-7">
          <CardHeader title="Where it’s heading" subtitle="A six-month outlook from your real income and spending." />
          <Link to="/projections" className="group inline-flex items-center gap-1 text-sm font-medium text-brand-fg">
            Open projections <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </Link>
        </Card>
      </section>
    </div>
  );
}

function Kpi({ label, value, change, inverse, hint }: { label: string; value: string; change?: number | null; inverse?: boolean; hint?: string }) {
  return (
    <Card className="!p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 figure text-xl sm:text-2xl  tracking-tight num truncate">{value}</p>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
        {change !== undefined && <Delta value={change} inverse={inverse} />}
        {hint}
      </div>
    </Card>
  );
}

function CategoryTable({ rows, previousLabel, kind, compare = true }: { rows: CategoryComparison[]; previousLabel: string; kind: TxKind; compare?: boolean }) {
  const money = useMoney();
  const max = Math.max(...rows.map((r) => Math.max(r.total, r.previous)), 1);
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">No {kind === 'expense' ? 'spending' : 'income'} in this period.</p>;
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="px-2 pb-2 font-medium">Category</th>
            <th className="px-2 pb-2 font-medium hidden sm:table-cell w-1/3" />
            <th className="px-2 pb-2 font-medium text-right">Amount</th>
            {compare && <th className="px-2 pb-2 font-medium text-right hidden md:table-cell">{previousLabel}</th>}
            {compare && <th className="px-2 pb-2 font-medium text-right">Change</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-line">
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-2.5">
                  <IconBadge icon={r.icon} color={r.color} size="sm" />
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted">
                      {r.count} transaction{r.count === 1 ? '' : 's'} · {percent(r.share)}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-2 py-2.5 hidden sm:table-cell">
                <div className="space-y-1">
                  <div className="h-2 rounded-full" style={{ width: `${(r.total / max) * 100}%`, background: r.color }} />
                  {compare && <div className="h-1 rounded-full bg-surface-3" style={{ width: `${(r.previous / max) * 100}%` }} />}
                </div>
              </td>
              <td className="px-2 py-2.5 text-right font-semibold num">{money(r.total)}</td>
              {compare && <td className="px-2 py-2.5 text-right text-muted num hidden md:table-cell">{money(r.previous)}</td>}
              {compare && (
                <td className="px-2 py-2.5 text-right">
                  <Delta value={r.change} inverse={kind === 'expense'} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthReport({ month, kind }: { month: string; kind: TxKind }) {
  const money = useMoney();
  const { txs } = useTxs();
  const r = useMemo(() => monthlyReport(txs, month), [txs, month]);
  const prevLabel = monthLabel(addMonths(month, -1), 'short');
  const byCategory = kind === 'expense' ? r.expenseByCategory : r.incomeByCategory;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Income" value={money(r.income)} change={pctChange(r.income, r.prev.income)} hint={`vs ${prevLabel}`} />
        <Kpi label="Expenses" value={money(r.expense)} change={pctChange(r.expense, r.prev.expense)} inverse hint={`vs ${prevLabel}`} />
        <Kpi label="Net" value={money(r.net, { sign: true })} hint={`${money(r.prev.net, { sign: true })} in ${prevLabel}`} />
        <Kpi label="Savings rate" value={percent(r.savingsRate)} hint={`${percent(r.prev.savingsRate)} in ${prevLabel}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={kind === 'expense' ? 'Spending by category' : 'Income by source'} />
          {byCategory.length ? (
            <CategoryDonut data={byCategory} total={kind === 'expense' ? r.expense : r.income} label={kind === 'expense' ? 'Spent' : 'Earned'} />
          ) : (
            <p className="py-12 text-center text-sm text-muted">Nothing recorded.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Spending pace" subtitle="Cumulative spending through the month" />
          <Legend
            items={[
              { label: monthLabel(month, 'short'), color: SERIES.expense, value: money(r.expense) },
              { label: prevLabel, color: SERIES.muted, value: money(r.prev.expense) },
            ]}
          />
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={r.dailyCumulative} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={SERIES.grid} />
                <XAxis dataKey="day" {...axisProps} interval={4} />
                <YAxis {...axisProps} width={72} tickFormatter={(v) => money(v, { compact: true })} />
                <Tooltip content={<ChartTooltip format={(n) => money(n)} labelFormatter={(d) => `Day ${d}`} />} />
                <Line dataKey="previous" name={prevLabel} stroke={SERIES.muted} strokeDasharray="4 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="current" name={monthLabel(month, 'short')} stroke={SERIES.expense} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title={kind === 'expense' ? 'Categories vs last month' : 'Income vs last month'} subtitle="Thick bar is this month, thin grey bar is last month" />
        <CategoryTable rows={byCategory} previousLabel={prevLabel} kind={kind} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="By day of week" subtitle="Total spent on each weekday this month" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.weekday} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={SERIES.grid} />
                <XAxis dataKey="day" {...axisProps} />
                <YAxis {...axisProps} width={72} tickFormatter={(v) => money(v, { compact: true })} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTooltip format={(n) => money(n)} />} />
                <Bar dataKey="total" name="Spent" fill={SERIES.expense} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Biggest expenses" />
          {r.topExpenses.length ? (
            <ul className="space-y-1">
              {r.topExpenses.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                  <span className="w-4 text-xs font-bold text-muted">{i + 1}</span>
                  <IconBadge icon={t.icon} color={t.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.note || t.category}</p>
                    <p className="text-xs text-muted">
                      {t.category} · {formatDay(t.date)}
                    </p>
                  </div>
                  <span className="text-sm font-bold num">{money(t.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted">No expenses this month.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function YearReport({ year, kind }: { year: number; kind: TxKind }) {
  const money = useMoney();
  const { txs } = useTxs();
  const [showTable, setShowTable] = useState(false);
  const r = useMemo(() => yearlyReport(txs, year), [txs, year]);
  const months = r.months.map((m) => ({ ...m, label: monthLabel(m.month) }));
  const stackKeys = Object.keys(r.categoryMonthly[0] ?? {}).filter((k) => k !== 'month');
  const colorOf = (name: string) => r.expenseByCategory.find((c) => c.name === name)?.color ?? '#94a3b8';
  const stacked = r.categoryMonthly.map((row) => ({ ...row, label: monthLabel(row.month as string) }));
  const byCategory = kind === 'expense' ? r.expenseByCategory : r.incomeByCategory;
  const c = r.comparable;
  const yoy = c.months > 0;
  const yoyHint = !yoy ? `no ${year - 1} data to compare` : c.months === 12 ? `vs ${year - 1}` : `vs same ${c.months} month${c.months > 1 ? 's' : ''} of ${year - 1}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Income" value={money(r.income)} change={yoy ? pctChange(c.current.income, c.previous.income) : undefined} hint={yoyHint} />
        <Kpi label="Expenses" value={money(r.expense)} change={yoy ? pctChange(c.current.expense, c.previous.expense) : undefined} inverse hint={yoyHint} />
        <Kpi label="Saved" value={money(r.net, { sign: true })} hint={r.prevYear.income || r.prevYear.expense ? `${money(r.prevYear.net, { sign: true })} in ${year - 1}` : undefined} />
        <Kpi label="Savings rate" value={percent(r.savingsRate)} hint={`avg ${money(r.avgMonthlyExpense, { compact: true })}/mo spent`} />
      </div>

      <Card>
        <CardHeader
          title="Income vs expenses"
          subtitle="Month by month"
          action={
            <IconButton label={showTable ? 'Show chart' : 'Show table'} onClick={() => setShowTable((s) => !s)}>
              <Table2 className="size-4" />
            </IconButton>
          }
        />
        <Legend
          items={[
            { label: 'Income', color: SERIES.income, value: money(r.income, { compact: true }) },
            { label: 'Expenses', color: SERIES.expense, value: money(r.expense, { compact: true }) },
          ]}
        />
        {showTable ? (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 font-medium text-right">Income</th>
                <th className="pb-2 font-medium text-right">Expenses</th>
                <th className="pb-2 font-medium text-right">Net</th>
                <th className="pb-2 font-medium text-right">Saved</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month} className="border-t border-line num">
                  <td className="py-2">{monthLabel(m.month, 'long')}</td>
                  <td className="py-2 text-right">{money(m.income)}</td>
                  <td className="py-2 text-right">{money(m.expense)}</td>
                  <td className={clsx('py-2 text-right font-semibold', m.net < 0 && 'text-bad')}>{money(m.net, { sign: true })}</td>
                  <td className="py-2 text-right text-muted">{m.income ? percent(m.savingsRate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={SERIES.grid} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={72} tickFormatter={(v) => money(v, { compact: true })} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTooltip format={(n) => money(n)} />} />
                <Bar dataKey="income" name="Income" fill={SERIES.income} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="expense" name="Expenses" fill={SERIES.expense} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Where the money went" subtitle="Monthly spending, top categories stacked" />
          <Legend items={stackKeys.map((k) => ({ label: k, color: colorOf(k) }))} />
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stacked} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={SERIES.grid} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={72} tickFormatter={(v) => money(v, { compact: true })} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTooltip format={(n) => money(n)} />} />
                {stackKeys.map((k, i) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    stackId="s"
                    fill={colorOf(k)}
                    stroke="var(--surface)"
                    strokeWidth={1}
                    radius={i === stackKeys.length - 1 ? [4, 4, 0, 0] : 0}
                    maxBarSize={28}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Highlights" />
          <div className="space-y-3">
            {r.bestMonth && (
              <Highlight icon="trending-up" tone="good" title="Best month" detail={`${monthLabel(r.bestMonth.month, 'long')} — saved ${money(r.bestMonth.net)}`} />
            )}
            {r.worstMonth && (
              <Highlight icon="trending-down" tone="bad" title="Toughest month" detail={`${monthLabel(r.worstMonth.month, 'long')} — net ${money(r.worstMonth.net, { sign: true })}`} />
            )}
            {r.expenseByCategory[0] && (
              <Highlight
                icon={r.expenseByCategory[0].icon}
                tone="neutral"
                title="Biggest category"
                detail={`${r.expenseByCategory[0].name} — ${money(r.expenseByCategory[0].total)} (${percent(r.expenseByCategory[0].share)})`}
              />
            )}
            {r.incomeByCategory[0] && (
              <Highlight icon={r.incomeByCategory[0].icon} tone="neutral" title="Main income" detail={`${r.incomeByCategory[0].name} — ${money(r.incomeByCategory[0].total)}`} />
            )}
          </div>
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium text-muted">Net saved per month</p>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" {...axisProps} interval={1} />
                  <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTooltip format={(n) => money(n, { sign: true })} />} />
                  <Bar dataKey="net" name="Net" fill={SERIES.net} radius={[3, 3, 3, 3]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={`Categories in ${year}`}
          subtitle={yoy ? `Change compares the same months of ${year - 1}` : undefined}
        />
        <CategoryTable rows={byCategory} previousLabel={c.months === 12 ? String(year - 1) : `${year - 1} (same mo.)`} kind={kind} compare={yoy} />
      </Card>
    </div>
  );
}

function Highlight({ icon, tone, title, detail }: { icon: string; tone: 'good' | 'bad' | 'neutral'; title: string; detail: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={clsx('flex size-9 items-center justify-center rounded-xl', tone === 'good' ? 'bg-good-soft text-good' : tone === 'bad' ? 'bg-bad-soft text-bad' : 'bg-surface-2 text-ink-2')}>
        <Icon name={icon} className="size-4" />
      </span>
      <div>
        <p className="text-xs text-muted">{title}</p>
        <p className="text-sm font-semibold">{detail}</p>
      </div>
    </div>
  );
}
