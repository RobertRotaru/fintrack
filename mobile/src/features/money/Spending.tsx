import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { addMonths, monthKey, monthLabel, monthlyReport, pctChange } from '@ft/core';
import { percent, useMoney } from '../../lib/format';
import { useTxs } from '../../lib/queries';
import { fonts, useTheme } from '../../lib/theme';
import { Donut, TrendSpark } from '../../components/charts';
import { Card, Divider, Empty, ErrorState, Loading, ProgressBar, Rise, T } from '../../components/ui';

/** Where the money went this month, and how it compares with last month. */
export function SpendingSection() {
  const { c } = useTheme();
  const money = useMoney();
  const q = useTxs();
  const now = monthKey(new Date());
  const [month, setMonth] = useState(now);
  const r = useMemo(() => monthlyReport(q.txs, month), [q.txs, month]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />;
  if (!q.txs.some((t) => t.kind === 'expense')) {
    return (
      <Empty icon="receipt" title="No spending yet">
        Once you log a purchase, this shows where your money goes, by category and over time.
      </Empty>
    );
  }

  const isCurrent = month === now;
  const soFar = r.dailyCumulative.flatMap((d) => (d.current === null ? [] : [d.current]));
  const prevToDate = isCurrent ? (r.dailyCumulative[new Date().getDate() - 1]?.previous ?? 0) : r.prev.expense;
  const change = prevToDate ? pctChange(r.expense, prevToDate) : null;
  const biggest = r.expenseByCategory[0];
  const top = r.expenseByCategory.slice(0, 6);
  const max = Math.max(1, ...top.map((x) => Math.max(x.total, x.previous)));

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth((m) => addMonths(m, -1))} style={{ width: 44, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={18} color={c.ink2} />
        </Pressable>
        <T v="small" style={{ fontFamily: fonts.sansSemiBold, minWidth: 110, textAlign: 'center' }}>
          {monthLabel(month, 'long')}
        </T>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" accessibilityState={{ disabled: isCurrent }} disabled={isCurrent} onPress={() => setMonth((m) => addMonths(m, 1))} style={{ width: 44, height: 40, alignItems: 'center', justifyContent: 'center', opacity: isCurrent ? 0.3 : 1 }}>
          <ChevronRight size={18} color={c.ink2} />
        </Pressable>
      </View>

      <Rise i={0} style={{ gap: 10 }}>
        <T v="eyebrow">Total spending</T>
        <T v="figure" style={{ fontSize: 42, lineHeight: 48 }} adjustsFontSizeToFit numberOfLines={1} testID="spending-total">
          {money(r.expense)}
        </T>
        <TrendSpark
          value={change}
          inverse
          suffix={isCurrent ? 'vs. this point last month' : 'vs. last month'}
          current={soFar}
          previous={r.dailyCumulative.slice(0, Math.max(soFar.length, 2)).map((d) => d.previous)}
          width={96}
          height={36}
        />
        {biggest ? (
          <T v="heading" tone="ink2" style={{ fontSize: 21, lineHeight: 27, marginTop: 4 }}>
            {biggest.name} was your biggest category at <T v="heading" style={{ fontSize: 21 }}>{percent(biggest.share)}</T> of spending.
          </T>
        ) : (
          <T tone="muted">No spending in {monthLabel(month, 'long')}.</T>
        )}
      </Rise>

      {r.expenseByCategory.length ? (
        <Rise i={1}>
          <Card style={{ gap: 4, padding: 18 }}>
            <Donut data={r.expenseByCategory.slice(0, 8)} total={money(r.expense, { compact: r.expense >= 10000 })} label="Spent" />
            <View style={{ marginTop: 10 }}>
              {r.expenseByCategory.slice(0, 8).map((cat, i) => (
                <View key={cat.name}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color }} />
                    <T style={{ flex: 1 }} numberOfLines={1}>
                      {cat.name}
                    </T>
                    <T v="caption" tone="muted" style={{ width: 36, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                      {percent(cat.share)}
                    </T>
                    <T v="label" style={{ minWidth: 96, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                      {money(cat.total)}
                    </T>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </Rise>
      ) : null}

      {top.length ? (
        <Rise i={2} style={{ gap: 12 }}>
          <T v="heading">Compared with last month</T>
          {top.map((cat) => (
            <View key={cat.name} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T v="small" tone="ink2">
                  {cat.name}
                </T>
                <T v="small" style={{ fontFamily: fonts.sansSemiBold, fontVariant: ['tabular-nums'] }}>
                  {money(cat.total)}
                </T>
              </View>
              <View style={{ width: `${(cat.total / max) * 100}%` }}>
                <ProgressBar value={1} color={cat.color} height={8} />
              </View>
              <View style={{ width: `${Math.max(1, (cat.previous / max) * 100)}%`, height: 4, borderRadius: 2, backgroundColor: c.surface3 }} />
            </View>
          ))}
          <T v="caption" tone="muted">
            Thick bar is {monthLabel(month)}, thin bar is {monthLabel(addMonths(month, -1))}.
          </T>
        </Rise>
      ) : null}
    </>
  );
}
