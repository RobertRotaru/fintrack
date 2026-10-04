import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import { ResponsiveContainer } from '../components/ResponsiveChart';
import { addMonths, categoryTotals, inMonth, monthKey, monthLabel, monthlyReport, pctChange } from '@ft/core';
import { formatDay, percent, useMoney } from '../lib/format';
import { useTxs } from '../lib/queries';
import { CategoryDonut, ChartTooltip, Legend, axisProps } from '../components/charts';
import { Card, Empty, IconBadge, IconButton, PageHeader, Segmented, Trend } from '../components/ui';
import { loadGate } from '../components/states';

type TrendView = 'categories' | 'total';
const TREND_MONTHS = 6;
const TREND_TOP = 5;

export function Spending() {
  const money = useMoney();
  const navigate = useNavigate();
  const txsQ = useTxs();
  const { txs } = txsQ;
  const now = monthKey(new Date());
  const [month, setMonth] = useState(now);
  const [view, setView] = useState<TrendView>('categories');
  const r = useMemo(() => monthlyReport(txs, month), [txs, month]);

  // Last six months, top categories of the whole window, one bar per category per month.
  const trend = useMemo(() => {
    const months = Array.from({ length: TREND_MONTHS }, (_, i) => addMonths(month, i - TREND_MONTHS + 1));
    const window = txs.filter((t) => t.month >= months[0] && t.month <= month);
    const top = categoryTotals(window, 'expense').slice(0, TREND_TOP);
    const rows = months.map((m) => {
      const cats = categoryTotals(inMonth(txs, m), 'expense');
      const row: Record<string, number | string> = { month: m, label: monthLabel(m), total: cats.reduce((s, c) => s + c.total, 0) };
      for (const c of top) row[c.name] = cats.find((x) => x.name === c.name)?.total ?? 0;
      return row;
    });
    return { rows, top };
  }, [txs, month]);

  const gate = loadGate([txsQ], 'charts');
  if (gate) return gate;

  const isCurrent = month === now;
  // This month compares with last month at the same day; past months compare whole months.
  const prevToDate = isCurrent ? (r.dailyCumulative[new Date().getDate() - 1]?.previous ?? 0) : r.prev.expense;
  const change = prevToDate ? pctChange(r.expense, prevToDate) : null;
  const biggest = r.expenseByCategory[0];
  const hasAny = txs.some((t) => t.kind === 'expense');

  const drill = (category?: string) => {
    const p = new URLSearchParams({ month });
    if (category) p.set('q', category);
    navigate(`/transactions?${p}`);
  };

  return (
    <div>
      <PageHeader
        title="Spending"
        subtitle="Where your money went, and how it’s changing."
        action={
          <div className="flex items-center rounded-full border border-line bg-surface shadow-[var(--shadow)]">
            <IconButton label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))} className="rounded-full">
              <ChevronLeft className="size-4" />
            </IconButton>
            <span className="min-w-32 text-center text-sm font-semibold" data-testid="spending-month">
              {monthLabel(month, 'long')}
            </span>
            <IconButton label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))} disabled={isCurrent} className="rounded-full disabled:opacity-30">
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
        }
      />

      {!hasAny ? (
        <Card>
          <Empty icon="receipt" title="No spending yet">
            Once you log a purchase, this page shows where your money goes — by category, and over time.
          </Empty>
        </Card>
      ) : (
        <div className="space-y-14">
          <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <div>
              <p className="eyebrow">Total spending</p>
              <p className="figure mt-2 text-6xl leading-none" data-testid="spending-total">
                {money(r.expense)}
              </p>
              <div className="mt-3">
                <Trend value={change} inverse suffix={isCurrent ? 'vs. last month so far' : 'vs. last month'} />
              </div>
              {biggest ? (
                <p className="mt-6 max-w-sm font-display text-2xl leading-snug text-ink-2">
                  {biggest.name} was your biggest category at <span className="text-ink">{percent(biggest.share)}</span> of spending.
                </p>
              ) : (
                <p className="mt-6 text-muted">No spending in {monthLabel(month, 'long')}.</p>
              )}
              <button onClick={() => drill()} className="group mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-fg cursor-pointer">
                See every transaction <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </button>
            </div>
            <Card className="!p-7">
              {r.expenseByCategory.length ? (
                <CategoryDonut data={r.expenseByCategory} total={r.expense} label="Spent" onSelect={drill} />
              ) : (
                <p className="py-16 text-center text-sm text-muted">Nothing recorded this month.</p>
              )}
            </Card>
          </section>

          <section>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[28px] leading-tight">Spending trend</h2>
                <p className="mt-1 text-sm text-muted">The last six months, by your biggest categories.</p>
              </div>
              <Segmented<TrendView>
                value={view}
                onChange={setView}
                options={[
                  { value: 'categories', label: 'By category' },
                  { value: 'total', label: 'Total' },
                ]}
              />
            </div>
            <Card className="!p-7">
              {view === 'categories' && <Legend items={trend.top.map((c) => ({ label: c.name, color: c.color }))} />}
              <div className="mt-4 h-72" data-testid="spending-trend" data-view={view}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend.rows} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={4} barCategoryGap="18%">
                    <CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="2 6" />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} width={76} tickFormatter={(v) => money(v, { compact: true })} tickCount={4} />
                    <Tooltip cursor={{ fill: 'var(--surface-2)', radius: 12 }} content={<ChartTooltip format={(n) => money(n)} />} />
                    {view === 'categories' ? (
                      trend.top.map((c) => <Bar key={c.name} dataKey={c.name} name={c.name} fill={c.color} radius={[6, 6, 6, 6]} maxBarSize={12} animationDuration={600} />)
                    ) : (
                      <Bar dataKey="total" name="Spent" radius={[10, 10, 10, 10]} maxBarSize={44} animationDuration={600}>
                        {trend.rows.map((row) => (
                          <Cell key={String(row.month)} fill={row.month === month ? 'var(--emerald)' : 'color-mix(in oklab, var(--sage) 70%, var(--surface))'} />
                        ))}
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>

          <section className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="mb-5 text-[28px] leading-tight">Biggest expenses</h2>
              {r.topExpenses.length ? (
                <ul className="space-y-1">
                  {r.topExpenses.map((t) => (
                    <li key={t.id} className="row-hover flex items-center gap-3 rounded-2xl px-3 py-2.5">
                      <IconBadge icon={t.icon} color={t.color} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.note || t.category}</p>
                        <p className="text-xs text-muted">
                          {t.category} · {formatDay(t.date)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold num">{money(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-sm text-muted">No expenses this month.</p>
              )}
            </div>
            <div>
              <h2 className="mb-5 text-[28px] leading-tight">Compared with last month</h2>
              <ul className="space-y-4">
                {r.expenseByCategory.slice(0, 6).map((c) => {
                  const max = Math.max(...r.expenseByCategory.slice(0, 6).map((x) => Math.max(x.total, x.previous)), 1);
                  return (
                    <li key={c.name}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="text-ink-2">{c.name}</span>
                        <span className="flex items-center gap-3">
                          <span className="font-semibold num">{money(c.total)}</span>
                          <Trend value={c.change} inverse className="!text-xs w-14 justify-end" />
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="grow-x h-2 rounded-full" style={{ width: `${(c.total / max) * 100}%`, background: c.color }} />
                        <div className="h-1 rounded-full bg-surface-3" style={{ width: `${(c.previous / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-xs text-muted">Thick bar is {monthLabel(month)}, thin bar is {monthLabel(addMonths(month, -1))}.</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
