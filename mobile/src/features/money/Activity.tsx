import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { formatDay } from '../../lib/format';
import { useAccounts, useTransactions } from '../../lib/queries';
import { fonts, useTheme } from '../../lib/theme';
import { TxRow } from '../../components/TxRow';
import { Button, Card, Divider, Empty, ErrorState, Loading, T } from '../../components/ui';

const PAGE = 60;

/** Every transaction, newest first, grouped by day; search by note or category, filter by account. */
export function ActivitySection() {
  const { c } = useTheme();
  const { account: accountParam } = useLocalSearchParams<{ account?: string }>();
  const q = useTransactions();
  const accounts = useAccounts().data ?? [];
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter((t) => (!accountParam || t.accountId === accountParam) && (!s || `${t.note ?? ''} ${t.categoryName}`.toLowerCase().includes(s)));
  }, [q.data, search, accountParam]);

  const days = useMemo(() => {
    const out: { date: string; items: typeof filtered }[] = [];
    for (const t of filtered.slice(0, limit)) {
      const last = out.at(-1);
      if (last?.date === t.date) last.items.push(t);
      else out.push({ date: t.date, items: [t] });
    }
    return out;
  }, [filtered, limit]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />;
  if (!q.data.length) {
    return (
      <Empty icon="receipt" title="No transactions yet" action={<Button title="Add a transaction" onPress={() => router.push('/quick-add')} />}>
        Everything you spend and earn shows up here.
      </Empty>
    );
  }

  return (
    <>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search notes and categories"
        placeholderTextColor={c.muted}
        accessibilityLabel="Search transactions"
        clearButtonMode="while-editing"
        style={{ minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 14, fontFamily: fonts.sans, fontSize: 15, color: c.ink }}
      />
      {accountParam ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show all accounts"
            onPress={() => router.setParams({ account: undefined })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: c.brandSoft }}
          >
            <T v="small" tone="brandFg" style={{ fontFamily: fonts.sansSemiBold }}>
              {accountName.get(accountParam) ?? 'Account'} ✕
            </T>
          </Pressable>
        </ScrollView>
      ) : null}
      {days.length ? (
        days.map((d) => (
          <View key={d.date} style={{ gap: 6 }}>
            <T v="eyebrow" style={{ marginLeft: 4 }}>
              {formatDay(d.date)}
            </T>
            <Card padded={false} style={{ overflow: 'hidden' }}>
              {d.items.map((t, i) => (
                <View key={t.id}>
                  {i > 0 ? <Divider /> : null}
                  <TxRow tx={t} accountName={accountName.get(t.accountId)} />
                </View>
              ))}
            </Card>
          </View>
        ))
      ) : (
        <T tone="muted" style={{ textAlign: 'center', paddingVertical: 24 }}>
          Nothing matches “{search}”.
        </T>
      )}
      {filtered.length > limit ? <Button title="Show more" variant="secondary" onPress={() => setLimit((l) => l + PAGE)} /> : null}
    </>
  );
}
