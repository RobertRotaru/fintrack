import { useId, useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ResponsiveContainer } from './ResponsiveChart';
import { NET_WORTH_RANGES, netWorthSeries, parseDate, type CategoryTotal, type Flow, type NetWorthRange } from '@ft/core';
import { Icon } from '../lib/icons';
import { useMoney, percent } from '../lib/format';
import { Segmented, Trend, clsx } from './ui';

export const SERIES = {
  income: 'var(--income)',
  expense: 'var(--expense)',
  net: 'var(--net)',
  grid: 'var(--grid)',
  muted: 'var(--muted)',
};

/** Expressive but restrained categorical palette, in theme tokens. */
export const PALETTE = ['var(--emerald)', 'var(--peach)', 'var(--cobalt)', 'var(--sun)', 'var(--violet)', 'var(--sky)', 'var(--sage)'];

export const axisProps = {
  axisLine: false,
  tickLine: false,
  tickMargin: 10,
} as const;

type Payload = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> };

/** Shared tooltip: a quiet card — label on top, one row per series with a colour key. */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  format,
}: {
  active?: boolean;
  payload?: Payload[];
  label?: string | number;
  labelFormatter?: (l: string | number) => ReactNode;
  format: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-2xl border border-line bg-surface/95 px-3.5 py-2.5 text-xs shadow-[var(--shadow-lg)] backdrop-blur">
      {label !== undefined && <p className="mb-1.5 font-medium text-muted">{labelFormatter ? labelFormatter(label) : label}</p>}
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p) => (
          <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-2 py-0.5">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="text-ink-2">{p.name}</span>
            <span className="ml-auto pl-4 font-semibold text-ink num">{format(Number(p.value))}</span>
          </div>
        ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-ink-2">
          <span className="size-2 rounded-full" style={{ background: i.color }} />
          {i.label}
          {i.value && <span className="font-semibold text-ink num">{i.value}</span>}
        </span>
      ))}
    </div>
  );
}

const compactNumber = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

const RANGE_LABEL: Record<NetWorthRange, string> = { '1M': 'the last month', '3M': 'the last 3 months', '6M': 'the last 6 months', '1Y': 'the last year', ALL: 'all time' };

/**
 * The signature chart: net worth as a smooth organic curve over a soft
 * gradient, with recessive axes and a range switcher.
 */
export function NetWorthChart({
  accounts,
  flows,
  currency,
  height = 260,
  initialRange = '6M',
  showSummary = true,
}: {
  accounts: { id: string; currency: string; balance: number }[];
  flows: Flow[];
  currency: string;
  height?: number;
  initialRange?: NetWorthRange;
  showSummary?: boolean;
}) {
  const money = useMoney();
  const gid = useId().replace(/:/g, '');
  const [range, setRange] = useState<NetWorthRange>(initialRange);
  const series = useMemo(() => netWorthSeries(accounts, flows, currency, range), [accounts, flows, currency, range]);
  const first = series[0]?.value ?? 0;
  const last = series.at(-1)?.value ?? 0;
  const change = last - first;
  const pct = Math.abs(first) > 0.005 ? (change / Math.abs(first)) * 100 : null;
  const short = range === '1M' || range === '3M';
  const fmtTick = (d: string) => parseDate(d).toLocaleDateString(undefined, short ? { day: 'numeric', month: 'short' } : { month: 'short', year: range === 'ALL' ? '2-digit' : undefined });
  // Longer ranges get one tick per month (at its first point) so labels never repeat.
  const ticks = short ? undefined : series.filter((p, i) => i > 0 && p.date.slice(0, 7) !== series[i - 1].date.slice(0, 7)).map((p) => p.date);
  const values = series.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.05 || 1;

  return (
    <div data-testid="net-worth-chart">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {showSummary ? (
          <p className="text-sm text-muted" data-testid="net-worth-range-summary">
            <span className={clsx('font-semibold num', change >= 0 ? 'text-good' : 'text-bad')}>
              {money(change, { sign: true })}
            </span>{' '}
            {pct !== null && <Trend value={pct} className="!text-xs" />} over {RANGE_LABEL[range]}
          </p>
        ) : (
          <span />
        )}
        <Segmented<NetWorthRange> value={range} onChange={setRange} options={NET_WORTH_RANGES.map((r) => ({ value: r, label: r }))} className="text-xs [&_button]:px-3 [&_button]:text-xs" />
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-fill)" stopOpacity={0.32} />
                <stop offset="70%" stopColor="var(--chart-fill)" stopOpacity={0.06} />
                <stop offset="100%" stopColor="var(--chart-fill)" stopOpacity={0} />
              </linearGradient>
              <filter id={`${gid}-glow`} x="-10%" y="-50%" width="120%" height="200%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="2 6" />
            <XAxis dataKey="date" {...axisProps} ticks={ticks} tickFormatter={fmtTick} minTickGap={28} />
            <YAxis {...axisProps} orientation="right" width={58} domain={[lo - pad, hi + pad]} tickFormatter={(v) => compactNumber.format(v)} tickCount={4} />
            <Tooltip
              cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 3' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-2xl border border-line bg-surface/95 px-3.5 py-2.5 text-xs shadow-[var(--shadow-lg)] backdrop-blur">
                    <p className="font-medium text-muted">{parseDate(String(label)).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <p className="mt-0.5 text-base font-semibold text-ink num">{money(Number(payload[0].value))}</p>
                    <p className={clsx('num', Number(payload[0].value) - first >= 0 ? 'text-good' : 'text-bad')}>
                      {money(Number(payload[0].value) - first, { sign: true })} since {fmtTick(series[0].date)}
                    </p>
                  </div>
                ) : null
              }
            />
            <Area
              type="basis"
              dataKey="value"
              name="Net worth"
              stroke="var(--chart-line)"
              strokeWidth={2.5}
              fill={`url(#${gid}-fill)`}
              filter={`url(#${gid}-glow)`}
              activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--surface)', fill: 'var(--chart-line)' }}
              animationDuration={700}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** A tiny trend line for rows and summaries. */
export function Sparkline({ values, width = 96, height = 32, color, className }: { values: number[]; width?: number; height?: number; color?: string; className?: string }) {
  const gid = useId().replace(/:/g, '');
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 3 - ((v - lo) / span) * (height - 6)] as const);
  // Smooth with midpoint quadratic curves.
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    d += ` Q${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`;
  }
  d += ` T${pts.at(-1)![0]},${pts.at(-1)![1]}`;
  const stroke = color ?? (values.at(-1)! >= values[0] ? 'var(--good)' : 'var(--bad)');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinecap="round" />
    </svg>
  );
}

/**
 * Donut of category shares with the category list beside it as the legend
 * (names, amounts and shares) — identity never relies on colour alone.
 */
export function CategoryDonut({ data, total, label, max = 7, onSelect }: { data: CategoryTotal[]; total: number; label: string; max?: number; onSelect?: (name: string) => void }) {
  const money = useMoney();
  const [hover, setHover] = useState<string | null>(null);
  const top = data.slice(0, max);
  const rest = data.slice(max);
  const rows = rest.length
    ? [...top, { name: 'Everything else', color: '#94a3b8', icon: 'circle-dashed', total: rest.reduce((s, c) => s + c.total, 0), count: 0, share: rest.reduce((s, c) => s + c.share, 0) }]
    : top;
  const focus = rows.find((r) => r.name === hover);
  return (
    <div className="grid gap-8 sm:grid-cols-[220px_1fr] items-center">
      <div className="relative mx-auto size-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="total"
              nameKey="name"
              innerRadius={76}
              outerRadius={104}
              paddingAngle={rows.length > 1 ? 2.5 : 0}
              cornerRadius={8}
              stroke="none"
              isAnimationActive={false}
              onMouseEnter={(d: { name?: string }) => setHover(d.name ?? null)}
              onMouseLeave={() => setHover(null)}
            >
              {rows.map((r) => (
                <Cell key={r.name} fill={r.color} opacity={hover && hover !== r.name ? 0.35 : 1} style={{ transition: 'opacity 160ms' }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted">{focus ? focus.name : label}</span>
          <span className="figure max-w-[140px] truncate text-xl">{money(focus ? focus.total : total, { compact: (focus?.total ?? total) >= 10000 })}</span>
          {focus && <span className="text-xs text-muted num">{percent(focus.share)}</span>}
        </div>
      </div>
      <ul className="space-y-1">
        {rows.map((r) => {
          const Row = onSelect && r.name !== 'Everything else' ? 'button' : 'div';
          return (
            <li key={r.name}>
              <Row
                {...(Row === 'button' ? { type: 'button' as const, onClick: () => onSelect!(r.name) } : {})}
                onMouseEnter={() => setHover(r.name)}
                onMouseLeave={() => setHover(null)}
                className={clsx('flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm transition', hover === r.name && 'bg-surface-2', Row === 'button' && 'cursor-pointer')}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <Icon name={r.icon} className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-ink-2">{r.name}</span>
                <span className="text-xs text-muted num">{percent(r.share)}</span>
                <span className="w-24 text-right font-semibold num">{money(r.total)}</span>
              </Row>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
