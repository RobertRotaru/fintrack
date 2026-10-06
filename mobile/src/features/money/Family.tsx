import { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { balanceChange, toISODate, type Household } from '@ft/core';
import { api } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { useMoney } from '../../lib/format';
import { keys, useAccounts, useApiMutation, useFlows, useGoals, useHousehold } from '../../lib/queries';
import { fonts, useTheme } from '../../lib/theme';
import { Avatar, Button, Card, Empty, ErrorState, Input, Loading, ProgressBar, Rise, T } from '../../components/ui';

const FAMILY = [keys.household, keys.accounts, keys.goals, keys.transactions] as const;

/** Shared finances: members, what's shared, and inviting someone in. */
export function FamilySection() {
  const user = useUser();
  const money = useMoney();
  const { c } = useTheme();
  const q = useHousehold();
  const accounts = (useAccounts().data ?? []).filter((a) => a.householdId && !a.archived);
  const goals = (useGoals().data ?? []).filter((g) => g.householdId && !g.completedAt);
  const flows = useFlows();
  const leave = useApiMutation(() => api('/household/leave', { method: 'POST' }), FAMILY);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />;
  if (!q.data) return <StartFamily />;

  const h: Household = q.data;
  const overview = balanceChange(accounts, flows, toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 0)), user.baseCurrency);
  const isOwner = h.members.some((m) => m.userId === user.id && m.role === 'owner');

  const invite = () =>
    void Share.share({
      message: `Join our family on Fintrack so we can keep our shared finances together. Open Fintrack → Money → Family → Join, and enter the code ${h.inviteCode}.`,
    });

  return (
    <>
      <Rise i={0} style={{ gap: 4 }}>
        <T v="heading">{h.name}</T>
        <T v="small" tone="muted">
          {h.members.length} member{h.members.length === 1 ? '' : 's'} · {accounts.length} shared account{accounts.length === 1 ? '' : 's'}
        </T>
      </Rise>
      <Rise i={1}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
          {h.members.map((m) => (
            <View key={m.userId} style={{ alignItems: 'center', width: 72, gap: 4 }} accessible accessibilityLabel={`${m.userId === user.id ? 'You' : m.name}, ${m.role === 'owner' ? 'admin' : 'member'}`}>
              <Avatar name={m.name} url={m.avatarUrl} size={60} ring />
              <T v="small" style={{ fontFamily: fonts.sansSemiBold }} numberOfLines={1}>
                {m.userId === user.id ? 'You' : m.name.split(' ')[0]}
              </T>
              <T v="caption" tone="muted">
                {m.role === 'owner' ? 'Admin' : 'Member'}
              </T>
            </View>
          ))}
        </View>
      </Rise>
      <Rise i={2}>
        <Card style={{ gap: 6, padding: 18 }}>
          <T v="eyebrow">Shared accounts</T>
          <T v="figure" style={{ fontSize: 34 }} adjustsFontSizeToFit numberOfLines={1}>
            {money(overview.now)}
          </T>
          {overview.pct !== null ? (
            <T v="small" tone={overview.pct >= 0 ? 'good' : 'bad'} style={{ fontFamily: fonts.sansSemiBold }}>
              {overview.pct >= 0 ? '↑' : '↓'} {Math.abs(overview.pct).toFixed(1)}% <T v="small" tone="muted">this month</T>
            </T>
          ) : null}
        </Card>
      </Rise>
      {goals.length ? (
        <Rise i={3}>
          <Card style={{ gap: 14 }}>
            <T v="eyebrow">Shared goals</T>
            {goals.map((g) => (
              <View key={g.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T v="label">{g.name}</T>
                  <T v="small" tone="muted">
                    {Math.round((g.saved / g.targetAmount) * 100)}%
                  </T>
                </View>
                <ProgressBar value={g.saved / g.targetAmount} color={g.color} />
              </View>
            ))}
          </Card>
        </Rise>
      ) : null}
      <Rise i={4}>
        <Card style={{ gap: 10, padding: 18, backgroundColor: c.brandSoft, borderColor: c.brandSoft }}>
          <T v="label">Invite someone</T>
          <T v="small" tone="ink2">
            Share this code. They choose what to share; everything else stays private.
          </T>
          <T v="figure" style={{ fontSize: 26, letterSpacing: 3 }} selectable testID="invite-code">
            {h.inviteCode}
          </T>
          <Button title="Send invite" icon="users" onPress={invite} />
        </Card>
      </Rise>
      <Button
        title="Leave family"
        variant="danger"
        loading={leave.isPending}
        onPress={() =>
          Alert.alert('Leave this family?', isOwner ? 'Someone else becomes admin. Your shared accounts become private again.' : 'Your shared accounts become private again.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: () => leave.mutate(undefined) },
          ])
        }
      />
    </>
  );
}

function StartFamily() {
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [value, setValue] = useState('');
  const create = useApiMutation((name: string) => api('/household', { body: { name } }), FAMILY);
  const join = useApiMutation((code: string) => api('/household/join', { body: { code } }), FAMILY);
  const m = mode === 'join' ? join : create;

  if (!mode) {
    return (
      <Empty
        icon="users"
        title="Start a family"
        action={
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 8 }}>
            <Button title="Create a family" onPress={() => setMode('create')} />
            <Button title="I have an invite code" variant="secondary" onPress={() => setMode('join')} />
          </View>
        }
      >
        Share the accounts and goals you choose with your partner or family. Everything else stays private.
      </Empty>
    );
  }
  return (
    <Card style={{ gap: 14, padding: 18 }}>
      <Input
        label={mode === 'join' ? 'Invite code' : 'Family name'}
        value={value}
        onChangeText={setValue}
        autoCapitalize={mode === 'join' ? 'characters' : 'words'}
        placeholder={mode === 'join' ? 'ABCD-1234' : 'The Rotarus'}
        autoFocus
      />
      {m.isError ? <T tone="bad">{m.error.message}</T> : null}
      <Button title={mode === 'join' ? 'Join' : 'Create'} loading={m.isPending} disabled={!value.trim()} onPress={() => m.mutate(value.trim())} />
      <Button title="Back" variant="ghost" onPress={() => setMode(null)} />
    </Card>
  );
}
