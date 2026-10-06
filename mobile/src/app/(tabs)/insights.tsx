import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { addMonths, generateInsights, monthKey, monthLabel, monthlyReport, monthsBetween, type Insight } from '@ft/core';
import { useUser } from '../../lib/auth';
import { useMoney } from '../../lib/format';
import { useRefreshAll, useTxs } from '../../lib/queries';
import { fonts, useTheme } from '../../lib/theme';
import { Legend, PairBars } from '../../components/charts';
import { Card, Delta, Empty, IconTile, Loading, Rise, Screen, Segmented, T } from '../../components/ui';

type Tab = 'for-you' | 'reports';
const TONE = { good: 'emerald', bad: 'peach', neutral: 'cobalt' } as const;
const ACTION: Record<Insight['group'], { label: string; href: string }> = {
  spending: { label: 'See spending', href: '/money?tab=spending' },
  income: { label: 'See income', href: '/insights?tab=reports' },
  saving: { label: 'Open goals', href: '/plan' },
  habits: { label: 'See activity', href: '/money?tab=activity' },
};

/** Insights: what's worth knowing (For you) and the month in numbers (Reports). */
export default function InsightsScreen() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const tab: Tab = params.tab === 'reports' ? 'reports' : 'for-you';
  const refreshAll = useRefreshAll();
  const [refreshing, setRefreshing] = useState(false);
  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await refreshAll();
        setRefreshing(false);
      }}
    >
      <T v="title" accessibilityRole="header">
        Insights
      </T>
      <Segmented<Tab>
        label="Insights"
        value={tab}
        onChange={(t) => router.setParams({ tab: t })}
        options={[
          { value: 'for-you', label: 'For you' },
          { value: 'reports', label: 'Reports' },
        ]}
      />
      {tab === 'for-you' ? <ForYou /> : <Reports />}
    </Screen>
  );
}

function ForYou() {
  const user = useUser();
  const money = useMoney();
  const { c } = useTheme();
  const q = useTxs();
  const insights = useMemo(() => generateInsights(q.txs, user.baseCurrency), [q.txs, user.baseCurrency]);
  const last = addMonths(monthKey(new Date()), -1);
  const r = useMemo(() => monthlyReport(q.txs, last), [q.txs, last]);

  if (q.isPending) return <Loading />;
  if (!q.txs.length) {
    return (
      <Empty icon="lightbulb" title="No insights yet">
        Observations appear once you’ve tracked a few weeks of activity.
      </Empty>
    );
  }
  const prevRate = r.prev.income ? (r.prev.income - r.prev.expense) / r.prev.income : null;
  const points = prevRate === null || !r.income ? null : Math.round((r.savingsRate - prevRate) * 100);

  return (
    <>
      {r.income || r.expense ? (
        <Rise i={0}>
          <Card style={{ padding: 18, gap: 12 }}>
            <T v="eyebrow">{monthLabel(last, 'long')} in one line</T>
            <T v="heading" style={{ fontSize: 22, lineHeight: 28 }}>
              {r.income ? (
                <>
                  You kept <T v="heading" style={{ fontSize: 22, fontFamily: fonts.serifMedium }}>{Math.round(r.savingsRate * 100)}%</T> of what came in
                  {points !== null && points !== 0 ? ` — ${points > 0 ? 'up' : 'down'} ${Math.abs(points)} points from ${monthLabel(addMonths(last, -1), 'long')}.` : '.'}
                </>
              ) : (
                `You spent ${money(r.expense)} with nothing coming in.`
              )}
            </T>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Stat label="Came in" value={money(r.income, { compact: r.income >= 10000 })} />
              <Stat label="Went out" value={money(r.expense, { compact: r.expense >= 10000 })} />
              <Stat label="Kept" value={money(r.net, { sign: true, compact: Math.abs(r.net) >= 10000 })} tone={r.net >= 0 ? 'good' : 'bad'} />
            </View>
            <Pressable accessibilityRole="link" onPress={() => router.setParams({ tab: 'reports' })} style={{ minHeight: 36, justifyContent: 'center' }}>
              <T v="small" tone="brandFg" style={{ fontFamily: fonts.sansSemiBold }}>
                Open the {monthLabel(last, 'long')} report ›
              </T>
            </Pressable>
          </Card>
        </Rise>
      ) : null}

      <T v="heading" style={{ marginTop: 4 }}>
        Worth knowing
      </T>
      {insights.length ? (
        insights.map((i, n) => (
          <Rise key={i.id} i={n + 1}>
            <Pressable accessibilityRole="link" onPress={() => router.navigate(ACTION[i.group].href as never)}>
              <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <IconTile icon={i.icon} color={c[TONE[i.tone]]} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T v="label">{i.title}</T>
                  <T v="small" tone="muted">
                    {i.detail}
                  </T>
                  <T v="caption" tone="brandFg" style={{ fontFamily: fonts.sansSemiBold, marginTop: 4 }}>
                    {ACTION[i.group].label} ›
                  </T>
                </View>
                {i.metric ? (
                  <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: i.tone === 'bad' ? c.badSoft : i.tone === 'good' ? c.goodSoft : c.surface2 }}>
                    <T v="caption" tone={i.tone === 'bad' ? 'bad' : i.tone === 'good' ? 'good' : 'ink2'} style={{ fontFamily: fonts.sansSemiBold }}>
                      {i.metric}
                    </T>
                  </View>
                ) : null}
              </Card>
            </Pressable>
          </Rise>
        ))
      ) : (
        <T tone="muted">Nothing stands out right now. That’s a good sign.</T>
      )}
    </>
  );
}

function Reports() {
  const money = useMoney();
  const { c } = useTheme();
  const q = useTxs();
  const now = monthKey(new Date());
  const [month, setMonth] = useState(now);
  const r = useMemo(() => monthlyReport(q.txs, month), [q.txs, month]);
  const trend = useMemo(
    () => monthsBetween(addMonths(month, -5), month).map((m) => {
      const x = monthlyReport(q.txs, m);
      return { label: monthLabel(m), a: x.income, b: x.expense };
    }),
    [q.txs, month],
  );

  if (q.isPending) return <Loading />;
  if (!q.txs.length) {
    return (
      <Empty icon="bar-chart" title="No data to report yet">
        Reports fill in as you track income and spending.
      </Empty>
    );
  }

  const isCurrent = month === now;
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth((m) => addMonths(m, -1))} style={{ width: 44, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={18} color={c.ink2} />
        </Pressable>
        <T v="small" style={{ fontFamily: fonts.sansSemiBold, minWidth: 110, textAlign: 'center' }}>
          {monthLabel(month, 'long')}
        </T>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={isCurrent} onPress={() => setMonth((m) => addMonths(m, 1))} style={{ width: 44, height: 40, alignItems: 'center', justifyContent: 'center', opacity: isCurrent ? 0.3 : 1 }}>
          <ChevronRight size={18} color={c.ink2} />
        </Pressable>
      </View>

      <Rise i={0}>
        <Card padded={false} style={{ flexDirection: 'row', overflow: 'hidden' }}>
          <Metric label="Income" value={money(r.income, { compact: r.income >= 10000 })} delta={r.prev.income ? ((r.income - r.prev.income) / r.prev.income) * 100 : null} />
          <View style={{ width: 1, backgroundColor: c.lineSoft }} />
          <Metric label="Spending" value={money(r.expense, { compact: r.expense >= 10000 })} delta={r.prev.expense ? ((r.expense - r.prev.expense) / r.prev.expense) * 100 : null} inverse />
          <View style={{ width: 1, backgroundColor: c.lineSoft }} />
          <Metric label="Savings rate" value={r.income ? `${Math.round(r.savingsRate * 100)}%` : '—'} />
        </Card>
      </Rise>

      <Rise i={1}>
        <Card style={{ gap: 14, padding: 18 }}>
          <T v="label">The last six months</T>
          <Legend items={[{ label: 'Income', color: c.income }, { label: 'Spending', color: c.expense }]} />
          <PairBars rows={trend} />
        </Card>
      </Rise>

      {r.incomeByCategory.length ? (
        <Rise i={2} style={{ gap: 8 }}>
          <T v="heading">Where income came from</T>
          <Card style={{ gap: 10 }}>
            {r.incomeByCategory.slice(0, 5).map((cat) => (
              <View key={cat.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color }} />
                <T style={{ flex: 1 }}>{cat.name}</T>
                <T v="label" style={{ fontVariant: ['tabular-nums'] }}>
                  {money(cat.total)}
                </T>
              </View>
            ))}
          </Card>
        </Rise>
      ) : null}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <View style={{ flex: 1 }}>
      <T v="caption" tone="muted">
        {label}
      </T>
      <T v="figure" tone={tone ?? 'ink'} style={{ fontSize: 16 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
    </View>
  );
}

function Metric({ label, value, delta, inverse }: { label: string; value: string; delta?: number | null; inverse?: boolean }) {
  return (
    <View style={{ flex: 1, padding: 14, gap: 4 }}>
      <T v="caption" tone="muted">
        {label}
      </T>
      <T v="figure" style={{ fontSize: 17 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      {delta !== undefined ? <Delta value={delta} inverse={inverse} /> : null}
    </View>
  );
}
