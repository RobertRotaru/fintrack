import { useMemo } from 'react';
import { View } from 'react-native';
import { monthLabel, project } from '@ft/core';
import { useMoney } from '../../lib/format';
import { useTxs } from '../../lib/queries';
import { useTheme } from '../../lib/theme';
import { Legend, PairBars } from '../../components/charts';
import { Card, Divider, Empty, IconTile, Loading, Rise, T } from '../../components/ui';

/** The next six months from your history: income, spending, what's left, and the bills that repeat. */
export function ProjectionsSection() {
  const money = useMoney();
  const { c } = useTheme();
  const q = useTxs();
  const p = useMemo(() => project(q.txs, 6), [q.txs]);

  if (q.isPending) return <Loading />;
  if (p.basisMonths < 2) {
    return (
      <Empty icon="trending-up" title="Not enough history yet">
        After two months of activity, Fintrack projects your next six from your own habits.
      </Empty>
    );
  }

  const end = p.future.at(-1);
  return (
    <>
      <Rise i={0} style={{ gap: 6 }}>
        <T v="eyebrow">In 6 months, at this pace</T>
        <T v="figure" tone={(end?.cumulativeNet ?? 0) >= 0 ? 'good' : 'bad'} style={{ fontSize: 38, lineHeight: 44 }} adjustsFontSizeToFit numberOfLines={1}>
          {money(end?.cumulativeNet ?? 0, { sign: true })}
        </T>
        <T v="small" tone="muted">
          About {money(p.avgMonthlyNet, { sign: true })} a month, from {p.basisMonths} months of history ({p.confidence} confidence).
        </T>
      </Rise>

      <Rise i={1}>
        <Card style={{ gap: 14, padding: 18 }}>
          <Legend items={[{ label: 'Income', color: c.income }, { label: 'Spending', color: c.expense }]} />
          <PairBars rows={[...p.history.slice(-2), ...p.future].map((m) => ({ label: monthLabel(m.month), a: m.income, b: m.expense, muted: !m.projected }))} />
          <T v="caption" tone="muted">
            Faded bars are past months; the rest are projected.
          </T>
        </Card>
      </Rise>

      {p.recurring.length ? (
        <Rise i={2} style={{ gap: 10 }}>
          <T v="heading">Repeats every month</T>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {p.recurring.slice(0, 8).map((r, i) => (
              <View key={`${r.category}-${r.day}`}>
                {i > 0 ? <Divider /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 56 }}>
                  <IconTile icon={r.icon} color={r.color} size={34} />
                  <View style={{ flex: 1 }}>
                    <T v="label" numberOfLines={1}>
                      {r.note || r.category}
                    </T>
                    <T v="caption" tone="muted">
                      Around day {r.day} · seen {r.monthsSeen} months
                    </T>
                  </View>
                  <T v="label" tone={r.kind === 'income' ? 'good' : 'ink'} style={{ fontVariant: ['tabular-nums'] }}>
                    {money(r.kind === 'income' ? r.amount : -r.amount, { sign: r.kind === 'income' })}
                  </T>
                </View>
              </View>
            ))}
          </Card>
        </Rise>
      ) : null}
    </>
  );
}
