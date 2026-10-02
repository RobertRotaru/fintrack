import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Table2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  addMonths, monthKey, monthLabel, monthlyReport, pctChange, yearlyReport, type CategoryComparison, type TxKind,
} from '@ft/core';
import { useMoney, percent, formatDay } from '../lib/format';
import { Icon } from '../lib/icons';
import { useTxs } from '../lib/queries';
import { CategoryDonut, ChartTooltip, Legend, SERIES, axisProps } from '../components/charts';
import { Card, CardHeader, Delta, Empty, IconBadge, IconButton, PageHeader, Segmented, Spinner, clsx } from '../components/ui';

type Mode = 'month' | 'year';

export function Reports() {
  const { txs, isLoading } = useTxs();
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState(monthKey(new Date()));
  const [year, setYear] = useState(new Date().getFullYear());
  const now = monthKey(new Date());

  const label = mode === 'month' ? monthLabel(month, 'long') : String(year);
  const canNext = mode === 'month' ? month < now : year < new Date().getFullYear();
  const step = (dir: 1 | -1) => (mode === 'month' ? setMonth((m) => addMonths(m, dir)) : setYear((y) => y + dir));

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Where your money came from and where it went."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<Mode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'month', label: 'Monthly' },
                { value: 'year', label: 'Yearly' },
              ]}
            />
            <div className="flex items-center rounded-xl border border-line bg-surface">
              <IconButton label="Previous period" onClick={() => step(-1)}>
                <ChevronLeft className="size-4" />
              </IconButton>
              <span className="min-w-32 text-center text-sm font-semibold">{label}</span>
              <IconButton label="Next period" onClick={() => step(1)} disabled={!canNext} className="disabled:opacity-30">
                <ChevronRight className="size-4" />
              </IconButton>
            </div>
          </div>
        }
      />
      {!txs.length ? (
        <Card>
          <Empty icon="bar-chart" title="No data to report yet">Reports fill in as you add income and expenses.</Empty>
        </Card>
      ) : mode === 'month' ? (
        <MonthReport month={month} />
      ) : (
        <YearReport year={year} />
      )}
    </div>
  );
}

function Kpi({ label, value, change, inverse, hint }: { label: string; value: string; change?: number | null; inverse?: boolean; hint?: string }) {
  return (
    <Card className="!p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-xl sm:text-2xl font-bold tracking-tight num truncate">{value}</p>
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

function MonthReport({ month }: { month: string }) {
  const money = useMoney();
  const { txs } = useTxs();
  const [kind, setKind] = useState<TxKind>('expense');
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
          <CardHeader
            title={kind === 'expense' ? 'Spending by category' : 'Income by source'}
            action={
              <Segmented<TxKind>
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'expense', label: 'Spent' },
                  { value: 'income', label: 'Earned' },
                ]}
              />
            }
          />
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

function YearReport({ year }: { year: number }) {
  const money = useMoney();
  const { txs } = useTxs();
  const [kind, setKind] = useState<TxKind>('expense');
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
          action={
            <Segmented<TxKind>
              value={kind}
              onChange={setKind}
              options={[
                { value: 'expense', label: 'Spent' },
                { value: 'income', label: 'Earned' },
              ]}
            />
          }
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
