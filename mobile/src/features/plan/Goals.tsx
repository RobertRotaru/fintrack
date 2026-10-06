import { useMemo } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { convert, goalPlan, monthLabel, monthKey, project } from '@ft/core';
import { api } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { useMoney } from '../../lib/format';
import { keys, useApiMutation, useGoals, useHousehold, useTxs } from '../../lib/queries';
import { fonts, useTheme } from '../../lib/theme';
import { PathScene } from '../../components/illustrations';
import { Button, Card, Empty, ErrorState, IconTile, Loading, ProgressBar, Rise, T } from '../../components/ui';

export function GoalsSection() {
  const user = useUser();
  const money = useMoney();
  const { c } = useTheme();
  const q = useGoals();
  const { txs } = useTxs();
  const { data: household } = useHousehold();
  const projection = useMemo(() => project(txs, 1), [txs]);
  const complete = useApiMutation(({ id, completed }: { id: string; completed: boolean }) => api(`/goals/${id}`, { method: 'PATCH', body: { completed } }), [keys.goals]);
  const remove = useApiMutation((id: string) => api(`/goals/${id}`, { method: 'DELETE' }), [keys.goals]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />;
  const open = q.data.filter((g) => !g.completedAt);
  const done = q.data.filter((g) => g.completedAt);

  if (!open.length && !done.length) {
    return (
      <Empty icon="target" title="What are you saving for?" action={<Button title="Set a goal" onPress={() => router.push('/goal-new')} />}>
        A trip, a safety net, a new laptop. Set a target and Fintrack shows how to get there.
      </Empty>
    );
  }

  const saved = open.reduce((s, g) => s + convert(g.saved, g.currency, user.baseCurrency), 0);
  const etas = open
    .map((g) => goalPlan(g, projection.avgMonthlyNet).actualPace?.eta)
    .filter((e): e is string => !!e)
    .sort();
  const owner = (userId: string) => household?.members.find((m) => m.userId === userId)?.name.split(' ')[0];

  const manage = (id: string, name: string, isDone: boolean) =>
    Alert.alert(name, undefined, [
      { text: isDone ? 'Reopen goal' : 'Mark as reached', onPress: () => complete.mutate({ id, completed: !isDone }) },
      {
        text: 'Delete goal',
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Delete “${name}”?`, 'Its savings history goes with it.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(id) },
          ]),
      },
      { text: 'Close', style: 'cancel' },
    ]);

  return (
    <>
      <Rise i={0}>
        <Card padded={false} style={{ overflow: 'hidden', borderRadius: 24, minHeight: 168 }}>
          <PathScene style={{ position: 'absolute', inset: 0 }} />
          <View style={{ padding: 20, gap: 6 }}>
            <T v="figure" style={{ fontSize: 30 }} adjustsFontSizeToFit numberOfLines={1}>
              {money(saved)}
            </T>
            <T v="small" tone="ink2" style={{ maxWidth: 210 }}>
              saved across {open.length} goal{open.length === 1 ? '' : 's'}.{etas[0] ? ` At this pace, the next one lands in ${monthLabel(monthKey(etas[0]), 'long')}.` : ''}
            </T>
          </View>
        </Card>
      </Rise>

      {open.map((g, i) => {
        const plan = goalPlan(g, projection.avgMonthlyNet);
        const status = plan.overdue
          ? { text: 'Past its deadline', tone: 'bad' as const }
          : plan.required && plan.actualPace && plan.actualPace.monthly >= plan.required.monthly
            ? { text: 'On track', tone: 'good' as const }
            : null;
        const detail = [g.householdId ? `Shared${g.userId !== user.id && owner(g.userId) ? ` by ${owner(g.userId)}` : ''}` : null, g.deadline ? `by ${new Date(g.deadline).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}` : 'No deadline']
          .filter(Boolean)
          .join(' · ');
        return (
          <Rise key={g.id} i={i + 1}>
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon={g.icon} color={g.color} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="label" numberOfLines={1} onPress={() => manage(g.id, g.name, false)}>
                    {g.name}
                  </T>
                  <T v="caption" tone={status?.tone ?? 'muted'}>
                    {status ? `${status.text} · ` : ''}
                    {detail}
                  </T>
                </View>
                <T v="label" style={{ fontVariant: ['tabular-nums'] }}>
                  {Math.round(plan.progress * 100)}%
                </T>
              </View>
              <ProgressBar value={plan.progress} color={g.color} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T v="small" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
                  {money(g.saved, { currency: g.currency })} of {money(g.targetAmount, { currency: g.currency })}
                </T>
                <Button title="Add money" variant="secondary" icon="hand-coins" onPress={() => router.push({ pathname: '/goal-add-money', params: { id: g.id } })} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 999 }} />
              </View>
              {plan.required && !plan.done ? (
                <T v="caption" tone="muted">
                  Save {money(plan.required.monthly, { currency: g.currency })} a month to make it in time.
                </T>
              ) : null}
            </Card>
          </Rise>
        );
      })}

      {done.length ? (
        <View style={{ gap: 8 }}>
          <T v="eyebrow">Reached</T>
          {done.map((g) => (
            <Card key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.goodSoft, borderColor: c.goodSoft }}>
              <IconTile icon={g.icon} color={g.color} size={34} />
              <T v="label" style={{ flex: 1 }} onPress={() => manage(g.id, g.name, true)}>
                {g.name}
              </T>
              <T v="small" tone="good" style={{ fontFamily: fonts.sansSemiBold }}>
                {money(g.targetAmount, { currency: g.currency, compact: true })} ✓
              </T>
            </Card>
          ))}
        </View>
      ) : null}
    </>
  );
}
