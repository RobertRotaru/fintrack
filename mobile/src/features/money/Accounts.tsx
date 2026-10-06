import { useMemo } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { ACCOUNT_TYPES, balanceChange, convert, formatMoney, netWorthSeries, toISODate, type Account } from '@ft/core';
import { api } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { useMoney } from '../../lib/format';
import { Icon } from '../../lib/icons';
import { keys, useAccounts, useApiMutation, useFlows, useHousehold } from '../../lib/queries';
import { fonts, useTheme } from '../../lib/theme';
import { TrendSpark } from '../../components/charts';
import { Button, Card, Divider, Empty, ErrorState, Loading, ProgressBar, Rise, Row, T, tint } from '../../components/ui';

const LIABILITY = new Set(['credit', 'loan']);

export function AccountsSection() {
  const user = useUser();
  const money = useMoney();
  const { c } = useTheme();
  const q = useAccounts();
  const flows = useFlows();
  const { data: household } = useHousehold();
  const archive = useApiMutation(({ id, archived }: { id: string; archived: boolean }) => api(`/accounts/${id}`, { method: 'PATCH', body: { archived } }), [keys.accounts]);
  const accounts = useMemo(() => q.data ?? [], [q.data]);
  const active = accounts.filter((a) => !a.archived);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />;
  if (!active.length) {
    return (
      <Empty icon="wallet" title="No accounts yet" action={<Button title="Add an account" onPress={() => router.push('/account-new')} />}>
        Add the places your money lives: bank cards, savings, loans, investments or crypto.
      </Empty>
    );
  }

  const base = (a: Account) => convert(a.balance, a.currency, user.baseCurrency);
  const assets = active.filter((a) => !LIABILITY.has(a.type)).reduce((s, a) => s + base(a), 0);
  const debts = active.filter((a) => LIABILITY.has(a.type)).reduce((s, a) => s + base(a), 0);
  const monthAgo = toISODate(new Date(Date.now() - 30 * 86_400_000));
  const total = balanceChange(active, flows, monthAgo, user.baseCurrency);
  const totalLine = netWorthSeries(active, flows, user.baseCurrency, '1M').map((p) => p.value);
  const owner = (a: Account) => (a.ownerId === user.id ? null : (household?.members.find((m) => m.userId === a.ownerId)?.name.split(' ')[0] ?? 'Family'));

  const manage = (a: Account) =>
    Alert.alert(a.name, `${formatMoney(a.balance, a.currency)} · ${a.institutionName ?? ACCOUNT_TYPES.find((t) => t.type === a.type)?.label}`, [
      { text: 'See activity', onPress: () => router.navigate({ pathname: '/money', params: { tab: 'activity', account: a.id } }) },
      ...(a.ownerId === user.id ? [{ text: 'Archive', style: 'destructive' as const, onPress: () => archive.mutate({ id: a.id, archived: true }) }] : []),
      { text: 'Close', style: 'cancel' },
    ]);

  return (
    <>
      <Rise i={0} style={{ gap: 12 }}>
        <View>
          <T v="eyebrow">Total balance</T>
          <T v="figure" style={{ fontSize: 40, lineHeight: 46, marginTop: 6 }} adjustsFontSizeToFit numberOfLines={1} testID="accounts-total">
            {money(assets + debts)}
          </T>
        </View>
        <TrendSpark value={total.pct} suffix="in the last 30 days" current={totalLine} width={96} height={36} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T v="small" tone="muted">
              Assets
            </T>
            <T v="figure" style={{ fontSize: 19 }} numberOfLines={1} adjustsFontSizeToFit>
              {money(assets)}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T v="small" tone="muted">
              Debts
            </T>
            <T v="figure" tone={debts < 0 ? 'bad' : 'ink'} style={{ fontSize: 19 }} numberOfLines={1} adjustsFontSizeToFit>
              {money(debts)}
            </T>
          </View>
        </View>
      </Rise>

      {ACCOUNT_TYPES.map(({ type, label }, gi) => {
        const group = active.filter((a) => a.type === type);
        if (!group.length) return null;
        const sum = group.reduce((s, a) => s + base(a), 0);
        return (
          <Rise key={type} i={gi + 1} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <T v="heading" style={{ fontSize: 22 }}>
                {label}
              </T>
              <T v="small" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
                {money(sum)}
              </T>
            </View>
            <Card padded={false} style={{ overflow: 'hidden' }}>
              {group.map((a, i) => (
                <View key={a.id}>
                  {i > 0 ? <Divider /> : null}
                  <AccountRow account={a} owner={owner(a)} flows={flows} onPress={() => manage(a)} />
                </View>
              ))}
            </Card>
          </Rise>
        );
      })}

      {accounts.some((a) => a.archived) ? (
        <T v="caption" tone="muted" style={{ textAlign: 'center' }}>
          {accounts.filter((a) => a.archived).length} archived account(s) are kept with their history.
        </T>
      ) : null}
      {archive.isError ? <T tone="bad">{archive.error.message}</T> : null}
      <View style={{ height: 1, backgroundColor: c.bg }} />
    </>
  );
}

function AccountRow({ account: a, owner, flows, onPress }: { account: Account; owner: string | null; flows: ReturnType<typeof useFlows>; onPress: () => void }) {
  const change = useMemo(() => balanceChange([a], flows, toISODate(new Date(Date.now() - 30 * 86_400_000)), a.currency), [a, flows]);
  const liability = LIABILITY.has(a.type);
  const used = a.type === 'credit' && a.creditLimit ? Math.min(1, Math.abs(Math.min(0, a.balance)) / a.creditLimit) : null;
  const { c } = useTheme();
  return (
    <Row onPress={onPress} accessibilityRole="button" accessibilityLabel={`${a.name}, ${formatMoney(a.balance, a.currency)}`} style={{ minHeight: 66 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: a.color, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={a.icon} size={19} color="#fff" strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T v="label" numberOfLines={1} style={{ flexShrink: 1 }}>
            {a.name}
          </T>
          {a.householdId ? (
            <View style={{ borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: c.brandSoft }}>
              <T v="caption" tone="brandFg" style={{ fontFamily: fonts.sansSemiBold, fontSize: 10 }}>
                {owner ?? 'Shared'}
              </T>
            </View>
          ) : null}
        </View>
        {used !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 64 }}>
              <ProgressBar value={used} height={5} color={c.peach} />
            </View>
            <T v="caption" tone="muted">
              {Math.round(used * 100)}% of limit
            </T>
          </View>
        ) : (
          <T v="caption" tone="muted" numberOfLines={1}>
            {a.institutionName ?? ACCOUNT_TYPES.find((t) => t.type === a.type)?.label} · {a.currency}
          </T>
        )}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <T v="label" tone={a.balance < 0 ? 'bad' : 'ink'} style={{ fontVariant: ['tabular-nums'] }}>
          {formatMoney(a.balance, a.currency)}
        </T>
        {change.pct !== null ? (
          <T v="caption" tone={(liability ? change.pct < 0 : change.pct > 0) ? 'good' : Math.abs(change.pct) < 0.05 ? 'muted' : 'bad'} style={{ fontFamily: fonts.sansSemiBold, backgroundColor: tint(c.surface, 0) }}>
            {change.pct >= 0 ? '↑' : '↓'} {Math.abs(change.pct).toFixed(Math.abs(change.pct) < 10 ? 1 : 0)}%
          </T>
        ) : null}
      </View>
    </Row>
  );
}
