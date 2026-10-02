import type { ReactNode } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryTotal } from '@ft/core';
import { Icon } from '../lib/icons';
import { useMoney, percent } from '../lib/format';

export const SERIES = {
  income: 'var(--income)',
  expense: 'var(--expense)',
  net: 'var(--net)',
  grid: 'var(--grid)',
  muted: 'var(--muted)',
};

export const axisProps = {
  axisLine: false,
  tickLine: false,
  tickMargin: 8,
} as const;

type Payload = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> };

/** Shared tooltip: label on top, one row per series with a colour key. */
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
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl">
      {label !== undefined && <p className="mb-1 font-semibold text-ink">{labelFormatter ? labelFormatter(label) : label}</p>}
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p) => (
          <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-2 py-0.5">
            <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
            <span className="text-ink-2">{p.name}</span>
            <span className="ml-auto pl-4 font-semibold text-ink num">{format(Number(p.value))}</span>
          </div>
        ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-ink-2">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
          {i.value && <span className="font-semibold text-ink num">{i.value}</span>}
        </span>
      ))}
    </div>
  );
}

/**
 * Donut of category shares with the category list beside it as the legend
 * (names, amounts and shares) — identity never relies on colour alone.
 */
export function CategoryDonut({ data, total, label, max = 7 }: { data: CategoryTotal[]; total: number; label: string; max?: number }) {
  const money = useMoney();
  const top = data.slice(0, max);
  const rest = data.slice(max);
  const rows = rest.length
    ? [...top, { name: 'Everything else', color: '#94a3b8', icon: 'circle-dashed', total: rest.reduce((s, c) => s + c.total, 0), count: 0, share: rest.reduce((s, c) => s + c.share, 0) }]
    : top;
  return (
    <div className="grid gap-6 sm:grid-cols-[200px_1fr] items-center">
      <div className="relative mx-auto size-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="total" nameKey="name" innerRadius={68} outerRadius={96} paddingAngle={rows.length > 1 ? 2 : 0} cornerRadius={4} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.name} fill={r.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip format={(n) => money(n)} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted">{label}</span>
          <span className="text-lg font-bold num">{money(total, { compact: total >= 100000 })}</span>
        </div>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 text-sm">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${r.color}22`, color: r.color }}>
              <Icon name={r.icon} className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-ink-2">{r.name}</span>
            <span className="text-xs text-muted num">{percent(r.share)}</span>
            <span className="w-24 text-right font-semibold num">{money(r.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
