import { useId, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import { NET_WORTH_RANGES, netWorthSeries, type CategoryTotal, type Flow, type NetWorthRange } from '@ft/core';
import { formatPct } from '../lib/format';
import { fonts, useTheme } from '../lib/theme';
import { Segmented, T } from './ui';

/** A smooth path through points, using midpoint quadratic curves (as on the web). */
export function smoothPath(pts: (readonly [number, number])[]): string {
  if (!pts.length) return '';
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    d += ` Q${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`;
  }
  const last = pts.at(-1)!;
  return `${d} T${last[0]},${last[1]}`;
}

/** Scales series into a box sharing one vertical range; `len` points span the full width. */
export function scale(series: number[][], width: number, height: number, len: number, pad = 3) {
  const all = series.flat();
  const lo = Math.min(...all);
  const span = Math.max(...all) - lo || 1;
  return (vals: number[]) => vals.map((v, i) => [(i / Math.max(1, len - 1)) * width, height - pad - ((v - lo) / span) * (height - pad * 2)] as const);
}

/**
 * A change figure with the shape behind it: this period (solid) and, when
 * given, the one it's compared with (dashed), then the percentage.
 */
export function TrendSpark({
  value,
  inverse,
  suffix,
  current,
  previous,
  width = 76,
  height = 30,
  compact,
}: {
  value: number | null;
  inverse?: boolean;
  suffix?: string;
  current: number[];
  previous?: number[];
  width?: number;
  height?: number;
  /** Just the line and the percentage, for tight spaces. */
  compact?: boolean;
}) {
  const { c } = useTheme();
  const gid = useId().replace(/:/g, '');
  const flat = value === null || !Number.isFinite(value) || Math.abs(value) < 0.05;
  const good = inverse ? (value ?? 0) < 0 : (value ?? 0) > 0;
  const stroke = flat ? c.muted : good ? c.good : c.bad;
  const len = Math.max(current.length, previous?.length ?? 0);
  const chart = current.length >= 2 && len >= 2;
  const toPts = scale([current, previous ?? []].filter((s) => s.length), width, height, len);
  const cur = chart ? toPts(current) : [];
  const prev = chart && previous && previous.length >= 2 ? toPts(previous) : [];
  const end = cur.at(-1);
  const line = smoothPath(cur);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 6 : 12 }}>
      {chart && end ? (
        <View aria-hidden>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={stroke} stopOpacity={0.25} />
              <Stop offset="1" stopColor={stroke} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {prev.length ? <Path d={smoothPath(prev)} fill="none" stroke={c.lineStrong} strokeWidth={1.5} strokeDasharray="2 3" strokeLinecap="round" /> : null}
          {!compact ? <Path d={`${line} L${end[0]},${height} L0,${height} Z`} fill={`url(#${gid})`} /> : null}
          <Path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
          <Circle cx={end[0]} cy={end[1]} r={2.6} fill={stroke} />
        </Svg>
        </View>
      ) : null}
      <View>
        <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: compact ? 12 : 14, color: stroke, fontVariant: ['tabular-nums'] }}>{value === null || !Number.isFinite(value) ? '—' : formatPct(value)}</Text>
        {suffix && !compact ? (
          <T v="caption" tone="muted">
            {suffix}
          </T>
        ) : null}
      </View>
    </View>
  );
}

const RANGE_LABEL: Record<NetWorthRange, string> = { '1M': '1M', '3M': '3M', '6M': '6M', '1Y': '1Y', ALL: 'All' };

/** Net worth over time, with range filters: the same series as the web chart. */
export function NetWorthChart({
  accounts,
  flows,
  currency,
  height = 104,
  initialRange = '6M',
}: {
  accounts: { id: string; currency: string; balance: number }[];
  flows: Flow[];
  currency: string;
  height?: number;
  initialRange?: NetWorthRange;
}) {
  const { c } = useTheme();
  const [range, setRange] = useState<NetWorthRange>(initialRange);
  const [width, setWidth] = useState(0);
  const series = useMemo(() => netWorthSeries(accounts, flows, currency, range), [accounts, flows, currency, range]);
  const values = series.map((p) => p.value);
  const pts = width && values.length > 1 ? scale([values], width, height, values.length, 8)(values) : [];
  const line = smoothPath(pts);
  const end = pts.at(-1);

  return (
    <View style={{ gap: 10 }} testID="net-worth-chart">
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }} accessibilityLabel={`Net worth chart, ${RANGE_LABEL[range]}`}>
        {width > 0 && end ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.chartFill} stopOpacity={0.3} />
                <Stop offset="0.7" stopColor={c.chartFill} stopOpacity={0.06} />
                <Stop offset="1" stopColor={c.chartFill} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line x1={0} x2={width} y1={height / 3} y2={height / 3} stroke={c.grid} strokeDasharray="2 6" />
            <Line x1={0} x2={width} y1={(height * 2) / 3} y2={(height * 2) / 3} stroke={c.grid} strokeDasharray="2 6" />
            <Path d={`${line} L${end[0]},${height} L0,${height} Z`} fill="url(#nw-fill)" />
            <Path d={line} fill="none" stroke={c.chartLine} strokeWidth={2.5} strokeLinecap="round" />
            <Circle cx={end[0]} cy={end[1]} r={4} fill={c.chartLine} />
          </Svg>
        ) : null}
      </View>
      <Segmented<NetWorthRange> label="Range" value={range} onChange={setRange} options={NET_WORTH_RANGES.map((r) => ({ value: r, label: RANGE_LABEL[r] }))} />
    </View>
  );
}

/** Spending by category as a ring, biggest first; the centre shows the total. */
export function Donut({ data, total, label, size = 176 }: { data: CategoryTotal[]; total: string; label: string; size?: number }) {
  const { c } = useTheme();
  const r = size / 2 - 14;
  const circ = 2 * Math.PI * r;
  const sum = data.reduce((s, d) => s + d.total, 0) || 1;
  const gap = data.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.surface2} strokeWidth={22} />
        {data.map((d) => {
          const len = Math.max(0, (d.total / sum) * circ - gap);
          const el = <Circle key={d.name} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={22} strokeDasharray={`${len} ${circ}`} strokeDashoffset={-offset} strokeLinecap="butt" />;
          offset += (d.total / sum) * circ;
          return el;
        })}
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <T v="caption" tone="muted">
          {label}
        </T>
        <T v="figure" style={{ fontSize: 18 }}>
          {total}
        </T>
      </View>
    </View>
  );
}

/** Paired monthly bars (income vs spending), for reports and projections. */
export function PairBars({ rows, height = 140 }: { rows: { label: string; a: number; b: number; muted?: boolean }[]; height?: number }) {
  const { c } = useTheme();
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: height + 22 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height, opacity: r.muted ? 0.5 : 1 }}>
            <View style={{ width: 9, borderRadius: 5, height: Math.max(3, (r.a / max) * height), backgroundColor: c.income }} />
            <View style={{ width: 9, borderRadius: 5, height: Math.max(3, (r.b / max) * height), backgroundColor: c.expense }} />
          </View>
          <T v="caption" tone="muted">
            {r.label}
          </T>
        </View>
      ))}
    </View>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      {items.map((i) => (
        <Pressable key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessible={false}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: i.color }} />
          <T v="caption" tone="ink2">
            {i.label}
          </T>
        </Pressable>
      ))}
    </View>
  );
}
