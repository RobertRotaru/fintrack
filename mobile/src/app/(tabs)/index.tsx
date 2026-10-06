import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import {
  balanceChange, financialMood, generateInsights, goalPlan, monthKey, monthlyReport, netWorthSeries, pctChange, project, toISODate,
  type Account, type Insight,
} from '@ft/core';
import { api } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { moneyParts, useMoney } from '../../lib/format';
import { useCountUp } from '../../lib/motion';
import { keys, useAccounts, useApiMutation, useFlows, useGoals, useRefreshAll, useTransactions, useTxs } from '../../lib/queries';
import { fonts, useTheme } from '../../lib/theme';
import { NetWorthChart, TrendSpark } from '../../components/charts';
import { Landscape } from '../../components/illustrations';
import { TxRow } from '../../components/TxRow';
import { Avatar, Button, Card, Delta, Divider, Empty, ErrorState, IconTile, Loading, ProgressBar, Rise, Screen, SectionHeader, T } from '../../components/ui';

const thirtyDaysAgo = (d = new Date()) => toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 30));

const TONE = { good: 'emerald', bad: 'peach', neutral: 'cobalt' } as const;
const INSIGHT_ROUTE: Record<Insight['group'], string> = { spending: '/money?tab=spending', income: '/insights?tab=reports', saving: '/plan', habits: '/insights' };

export default function HomeScreen() {
  const user = useUser();
  const money = useMoney();
  const { c } = useTheme();
  const accountsQ = useAccounts();
  const txQ = useTransactions();
  const { data: goals = [] } = useGoals();
  const { txs } = useTxs();
  const flows = useFlows();
  const refreshAll = useRefreshAll();
  const [refreshing, setRefreshing] = useState(false);
  const seed = useApiMutation(() => api('/demo', { method: 'POST' }), [keys.accounts, keys.transactions, keys.goals, keys.transfers, keys.categories]);

  const thisMonth = monthKey(new Date());
  const report = useMemo(() => monthlyReport(txs, thisMonth), [txs, thisMonth]);
  const insights = useMemo(() => generateInsights(txs, user.baseCurrency).slice(0, 2), [txs, user.baseCurrency]);
  const projection = useMemo(() => project(txs, 1), [txs]);
  const active = useMemo(() => (accountsQ.data ?? []).filter((a) => !a.archived), [accountsQ.data]);

  const refresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  if (accountsQ.isPending || txQ.isPending) return <Screen><Loading /></Screen>;
  if (accountsQ.isError || txQ.isError) {
    return (
      <Screen>
        <ErrorState message={(accountsQ.error ?? txQ.error)!.message} onRetry={() => void refresh()} />
      </Screen>
    );
  }

  const firstName = user.name.split(' ')[0];
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View>
        <T tone="ink2">
          Welcome back, <T style={{ fontFamily: fonts.sansSemiBold }}>{firstName}</T>
        </T>
        <T v="small" tone="muted">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </T>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Your profile and settings" onPress={() => router.push('/profile')} hitSlop={6}>
        <Avatar name={user.name} url={user.avatarUrl} size={44} ring />
      </Pressable>
    </View>
  );

  if (!active.length) {
    return (
      <Screen>
        {header}
        <T v="title" style={{ marginTop: 12 }}>
          Welcome to Fintrack.
        </T>
        <Empty
          icon="wallet"
          title="Let’s set up your money"
          action={
            <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 8 }}>
              <Button title="Add your first account" icon="wallet" onPress={() => router.push('/account-new')} />
              <Button title="Load a year of demo data" variant="secondary" loading={seed.isPending} onPress={() => seed.mutate(undefined)} />
            </View>
          }
        >
          Add the accounts you use — bank cards, savings, loans, investments or crypto. Or load demo data to look around.
        </Empty>
      </Screen>
    );
  }

  const since = thirtyDaysAgo();
  const worth = balanceChange(active, flows, since, user.baseCurrency);
  const daily = report.dailyCumulative;
  const prevToDate = daily[new Date().getDate() - 1]?.previous ?? 0;
  const pace = prevToDate ? pctChange(report.expense, prevToDate) : null;
  const mood = financialMood({ hasData: true, netWorthPct: worth.pct, spendingPace: pace, savingsRate: report.income ? report.savingsRate : null });
  const sixMonths = netWorthSeries(active, flows, user.baseCurrency, '6M');
  const sixMonthChange = sixMonths.length ? sixMonths.at(-1)!.value - sixMonths[0]!.value : 0;

  const savingAccounts = active.filter((a) => a.type === 'savings');
  const investAccounts = active.filter((a) => a.type === 'investment' || a.type === 'crypto');
  const saving = balanceChange(savingAccounts, flows, since, user.baseCurrency);
  const investing = balanceChange(investAccounts, flows, since, user.baseCurrency);
  const spendNow = daily.flatMap((d) => (d.current === null ? [] : [d.current]));
  const spendPrev = daily.slice(0, Math.max(spendNow.length, 2)).map((d) => d.previous);
  const line = (accts: Account[]) => netWorthSeries(accts, flows, user.baseCurrency, '1M').map((p) => p.value);
  const openGoals = goals.filter((g) => !g.completedAt).slice(0, 2);
  const accountName = new Map(active.map((a) => [a.id, a.name]));

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      {header}

      {/* How am I doing? Net worth first, closing on the mood line over the landscape. */}
      <Rise i={0}>
        <Card lifted padded={false} style={{ borderRadius: 26, overflow: 'hidden' }}>
          <View style={{ padding: 20, paddingBottom: 16, gap: 10 }}>
            <T v="eyebrow">Total net worth</T>
            <HeroAmount amount={worth.now} currency={user.baseCurrency} />
            <T v="small" tone="muted">
              <T v="small" tone={worth.pct === null || worth.pct >= 0 ? 'good' : 'bad'} style={{ fontFamily: fonts.sansSemiBold }}>
                {worth.pct === null ? '—' : `${worth.pct >= 0 ? '↑' : '↓'} ${Math.abs(worth.pct).toFixed(1)}%`}
              </T>{' '}
              in 30 days · {money(sixMonthChange, { sign: true, compact: Math.abs(sixMonthChange) >= 100000 })} in 6 months
            </T>
            <NetWorthChart accounts={active} flows={flows} currency={user.baseCurrency} />
          </View>
          <View style={{ height: 118 }}>
            <Landscape style={{ position: 'absolute', inset: 0 }} fadeFrom={c.surface} />
            <View style={{ paddingHorizontal: 20, paddingTop: 4, maxWidth: 270 }} testID="home-mood">
              <T v="display" style={{ fontSize: 24, lineHeight: 26 }} accessibilityRole="header">
                {mood.headline}
              </T>
              <T v="small" tone="ink2" style={{ marginTop: 4 }}>
                {mood.subline}
              </T>
            </View>
          </View>
        </Card>
      </Rise>

      {/* What changed? */}
      <Rise i={1}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }} style={{ marginRight: -20 }}>
          <Glance label="Spent this month" value={money(report.expense, { compact: report.expense >= 100000 })} onPress={() => router.navigate('/money?tab=spending')}>
            <TrendSpark value={pace} inverse current={spendNow} previous={spendPrev} width={46} height={20} compact />
          </Glance>
          <Glance label="Saving" value={savingAccounts.length ? money(saving.now, { compact: saving.now >= 1000000 }) : '—'} onPress={() => router.navigate('/money')}>
            {savingAccounts.length ? <TrendSpark value={saving.pct} current={line(savingAccounts)} width={46} height={20} compact /> : <T v="caption" tone="muted">No savings account yet</T>}
          </Glance>
          <Glance label="Investing" value={investAccounts.length ? money(investing.now, { compact: investing.now >= 1000000 }) : '—'} onPress={() => router.navigate(investAccounts.length ? '/money' : '/plan?tab=invest')}>
            {investAccounts.length ? <TrendSpark value={investing.pct} current={line(investAccounts)} width={46} height={20} compact /> : <T v="caption" tone="muted">Not investing yet</T>}
          </Glance>
        </ScrollView>
      </Rise>

      {/* What should I pay attention to? */}
      {insights.length ? (
        <Rise i={2} style={{ gap: 10 }}>
          <SectionHeader title="Needs your attention" action="All" onAction={() => router.navigate('/insights')} />
          {insights.map((i) => (
            <Pressable key={i.id} accessibilityRole="link" onPress={() => router.navigate(INSIGHT_ROUTE[i.group] as never)}>
              <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <IconTile icon={i.icon} color={c[TONE[i.tone]]} size={38} />
                <View style={{ flex: 1 }}>
                  <T v="label">{i.title}</T>
                  <T v="small" tone="muted" style={{ marginTop: 3 }}>
                    {i.detail}
                  </T>
                </View>
              </Card>
            </Pressable>
          ))}
        </Rise>
      ) : null}

      {/* This month */}
      <Rise i={3} style={{ gap: 10 }}>
        <SectionHeader title="This month" action="Spending" onAction={() => router.navigate('/money?tab=spending')} />
        <Card style={{ padding: 18 }}>
          <T v="eyebrow">Spent so far</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <T v="figure" style={{ fontSize: 28 }}>
              {money(report.expense)}
            </T>
            <Delta value={pace} inverse />
          </View>
          <View style={{ marginTop: 14 }}>
            <ProgressBar value={report.prev.expense ? report.expense / report.prev.expense : 0} height={10} color={report.expense > report.prev.expense ? c.expense : c.emerald} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <T v="caption" tone="muted">
              {Math.round(projection.currentMonth.progress * 100)}% of the month gone
            </T>
            <T v="caption" tone="muted">
              Last month {money(report.prev.expense, { compact: report.prev.expense >= 100000 })}
            </T>
          </View>
          <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.lineSoft, gap: 10 }}>
            <Line label="Came in" value={money(report.income)} />
            <Line label="Expected by month end" value={money(projection.currentMonth.projectedExpense)} />
            <Line label="Left this month" value={money(report.net, { sign: true })} bad={report.net < 0} />
          </View>
        </Card>
      </Rise>

      {/* What can I do about it? */}
      {openGoals.length ? (
        <Rise i={4} style={{ gap: 10 }}>
          <SectionHeader title="Keep moving" action="Goals" onAction={() => router.navigate('/plan')} />
          <Card style={{ gap: 16 }}>
            {openGoals.map((g) => {
              const plan = goalPlan(g, projection.avgMonthlyNet);
              return (
                <Pressable key={g.id} accessibilityRole="link" accessibilityLabel={`${g.name}, ${Math.round(plan.progress * 100)}%`} onPress={() => router.navigate('/plan')} style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <IconTile icon={g.icon} color={g.color} size={32} />
                    <T v="label" style={{ flex: 1 }} numberOfLines={1}>
                      {g.name}
                    </T>
                    <T v="label" style={{ fontVariant: ['tabular-nums'] }}>
                      {Math.round(plan.progress * 100)}%
                    </T>
                  </View>
                  <ProgressBar value={plan.progress} color={g.color} />
                  <T v="caption" tone="muted">
                    {money(g.saved, { currency: g.currency, compact: true })} of {money(g.targetAmount, { currency: g.currency, compact: true })}
                  </T>
                </Pressable>
              );
            })}
          </Card>
        </Rise>
      ) : null}

      {/* Recent activity */}
      <Rise i={5} style={{ gap: 10 }}>
        <SectionHeader title="Recent activity" action="All" onAction={() => router.navigate('/money?tab=activity')} />
        <Card padded={false} style={{ paddingVertical: 4, overflow: 'hidden' }}>
          {(txQ.data ?? []).length ? (
            (txQ.data ?? []).slice(0, 4).map((t, i) => (
              <View key={t.id}>
                {i > 0 ? <Divider /> : null}
                <TxRow tx={t} accountName={accountName.get(t.accountId)} />
              </View>
            ))
          ) : (
            <T v="small" tone="muted" style={{ padding: 20, textAlign: 'center' }}>
              Nothing yet — tap + to log your first purchase.
            </T>
          )}
        </Card>
      </Rise>
    </Screen>
  );
}

/** The headline figure: counts up on arrival, currency label small, number large. */
function HeroAmount({ amount, currency }: { amount: number; currency: string }) {
  const shown = useCountUp(amount);
  const final = moneyParts(amount, currency);
  const { number, before } = moneyParts(shown, currency);
  const label = (
    <T tone="muted" style={{ fontFamily: fonts.sansMedium, fontSize: 16 }}>
      {final.currency}
    </T>
  );
  return (
    <View accessible accessibilityLabel={`${final.number} ${final.currency}`} testID="net-worth" style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
      {before ? label : null}
      <T v="figure" adjustsFontSizeToFit numberOfLines={1} style={{ fontSize: 42, lineHeight: 48, flexShrink: 1 }}>
        {number}
      </T>
      {!before ? label : null}
    </View>
  );
}

function Glance({ label, value, children, onPress }: { label: string; value: string; children: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} onPress={onPress}>
      <Card style={{ width: 172, gap: 6, padding: 14 }}>
        <T v="caption" tone="ink2" style={{ fontFamily: fonts.sansMedium }}>
          {label}
        </T>
        <T v="figure" style={{ fontSize: 19 }} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </T>
        {children}
      </Card>
    </Pressable>
  );
}

function Line({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <T v="small" tone="ink2">
        {label}
      </T>
      <T v="small" tone={bad ? 'bad' : 'ink'} style={{ fontFamily: fonts.sansSemiBold, fontVariant: ['tabular-nums'] }}>
        {value}
      </T>
    </View>
  );
}
