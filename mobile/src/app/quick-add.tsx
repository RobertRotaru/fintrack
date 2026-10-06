import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';
import { addDays, decimalsFor, formatMoney, toISODate, type TxKind } from '@ft/core';
import { parseAmount } from '../lib/format';
import { useAccounts, useCategories, useCreateTransaction, useDeleteTransaction, useTransactions, useUpdateTransaction } from '../lib/queries';
import { storage } from '../lib/storage';
import { fonts, useTheme } from '../lib/theme';
import { Icon } from '../lib/icons';
import { Button, Segmented, T, tint } from '../components/ui';

/** The decimal separator people type on this phone: "," in Romania, "." in the UK. */
const DECIMAL = (1.5).toLocaleString().includes(',') ? ',' : '.';
const LAST_ACCOUNT = 'ft.lastAccount';

const dayLabel = (offset: number) => (offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : addDays(new Date(), -offset).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }));

/**
 * The 2-tap entry: type an amount, tap a category — saved.
 * With `?id=` it edits an existing transaction instead (pick, then Save).
 */
export default function QuickAdd() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = useTransactions().data?.find((t) => t.id === id);
  const accounts = (useAccounts().data ?? []).filter((a) => !a.archived);
  const categories = useCategories().data ?? [];
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();

  const [kind, setKind] = useState<TxKind>(editing?.kind ?? 'expense');
  const [amount, setAmount] = useState(editing ? editing.amount.toFixed(decimalsFor(editing.currency)).replace('.', DECIMAL) : '');
  const [accountId, setAccountId] = useState<string | null>(editing?.accountId ?? null);
  const [dayOffset, setDayOffset] = useState(editing ? Math.max(0, Math.round((Date.now() - new Date(`${editing.date}T12:00:00`).getTime()) / 86_400_000)) : 0);
  const [note, setNote] = useState(editing?.note ?? '');
  const [noteOpen, setNoteOpen] = useState(!!editing?.note);
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null);
  const [picking, setPicking] = useState<'account' | 'day' | null>(null);

  // Opened before the transaction loaded (e.g. from a link): fill the form once it arrives.
  const filled = useRef(editing?.id ?? null);
  useEffect(() => {
    if (!editing || filled.current === editing.id) return;
    filled.current = editing.id;
    setKind(editing.kind);
    setAmount(editing.amount.toFixed(decimalsFor(editing.currency)).replace('.', DECIMAL));
    setAccountId(editing.accountId);
    setDayOffset(Math.max(0, Math.round((Date.now() - new Date(`${editing.date}T12:00:00`).getTime()) / 86_400_000)));
    setNote(editing.note ?? '');
    setNoteOpen(!!editing.note);
    setCategoryId(editing.categoryId);
  }, [editing]);

  // Default to the last account used, if it still exists.
  useEffect(() => {
    if (editing || accountId || !accounts.length) return;
    void storage.get(LAST_ACCOUNT).then((last) => setAccountId(accounts.find((a) => a.id === last)?.id ?? accounts.find((a) => a.type === 'debit')?.id ?? accounts[0]!.id));
  }, [accounts, accountId, editing]);

  const account = accounts.find((a) => a.id === accountId);
  const value = parseAmount(amount);
  const valid = value !== null && !Number.isNaN(value) && value > 0;
  const visible = useMemo(() => categories.filter((cat) => cat.kind === kind && (!cat.archived || cat.id === categoryId)), [categories, kind, categoryId]);
  const busy = create.isPending || update.isPending;

  const press = (key: string) => {
    void Haptics.selectionAsync().catch(() => {});
    setAmount((a) => {
      if (key === 'del') return a.slice(0, -1);
      if (key === DECIMAL) return a.includes(DECIMAL) ? a : `${a || '0'}${DECIMAL}`;
      const [, frac] = a.split(DECIMAL);
      if (frac !== undefined && frac.length >= decimalsFor(account?.currency ?? 'RON')) return a;
      if (a.replace(DECIMAL, '').length >= 10) return a;
      return a === '0' ? key : a + key;
    });
  };

  const save = async (catId: string) => {
    if (!valid || !account) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    const body = { accountId: account.id, kind, amount: value!, categoryId: catId, date: toISODate(addDays(new Date(), -dayOffset)), note: note.trim() || undefined };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...body, note: note.trim() });
      else await create.mutateAsync(body);
      await storage.set(LAST_ACCOUNT, account.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete this transaction?', 'It can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await remove.mutateAsync(editing!.id);
          router.back();
        },
      },
    ]);

  const chip = (label: string, onPress: () => void, opts: { dashed?: boolean; leading?: React.ReactNode } = {}) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 38, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderStyle: opts.dashed ? 'dashed' : 'solid', borderColor: opts.dashed ? c.lineStrong : c.line, backgroundColor: opts.dashed ? 'transparent' : c.surface }}
    >
      {opts.leading}
      <T v="small" tone={opts.dashed ? 'muted' : 'ink'} style={{ fontFamily: fonts.sansMedium }}>
        {label}
      </T>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 14, paddingBottom: insets.bottom + 10 }}>
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.lineStrong }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T v="display" accessibilityRole="header">
            {editing ? 'Edit' : 'Quick add'}
          </T>
          <View style={{ width: 190 }}>
            <Segmented<TxKind>
              label="Kind"
              value={kind}
              onChange={(k) => {
                setKind(k);
                setCategoryId(null);
              }}
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
            />
          </View>
        </View>

        <View accessible accessibilityLabel={`Amount ${amount || 0} ${account?.currency ?? ''}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: valid ? c.brand : c.line }}>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 32, color: kind === 'expense' ? c.expense : c.income }}>{kind === 'expense' ? '−' : '+'}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1, fontFamily: fonts.sansBold, fontSize: 46, letterSpacing: -1, color: amount ? c.ink : c.surface3, fontVariant: ['tabular-nums'] }}>
            {amount || `0${DECIMAL}00`}
          </Text>
          <T v="label" tone="muted">
            {account?.currency}
          </T>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {account
            ? chip(account.name, () => setPicking(picking === 'account' ? null : 'account'), {
                leading: <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: account.color, alignItems: 'center', justifyContent: 'center' }}><Icon name={account.icon} size={12} color="#fff" /></View>,
              })
            : null}
          {chip(dayLabel(dayOffset), () => setPicking(picking === 'day' ? null : 'day'))}
          {noteOpen ? null : chip('+ Note', () => setNoteOpen(true), { dashed: true })}
        </View>

        {picking === 'account' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {accounts.map((a) => chip(`${a.name} · ${formatMoney(a.balance, a.currency, { compact: true })}`, () => (setAccountId(a.id), setPicking(null))))}
          </ScrollView>
        ) : null}
        {picking === 'day' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {Array.from({ length: 14 }, (_, i) => chip(dayLabel(i), () => (setDayOffset(i), setPicking(null))))}
          </ScrollView>
        ) : null}
        {noteOpen ? (
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (optional)"
            placeholderTextColor={c.muted}
            maxLength={200}
            accessibilityLabel="Note"
            style={{ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 12, fontFamily: fonts.sans, fontSize: 15, color: c.ink }}
          />
        ) : null}

        <T v="small" tone="muted">
          {editing ? 'Choose a category, then save.' : valid ? 'Tap a category to save.' : 'Type an amount, then tap a category.'}
        </T>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 }}>
        {visible.map((cat) => {
          const on = cat.id === categoryId;
          return (
            <Pressable
              key={cat.id}
              accessibilityRole="button"
              accessibilityLabel={editing ? cat.name : `Save as ${cat.name}`}
              accessibilityState={{ selected: on, disabled: busy }}
              disabled={busy}
              onPress={() => (editing ? setCategoryId(cat.id) : void save(cat.id))}
              style={({ pressed }) => ({ width: '25%', alignItems: 'center', gap: 6, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{ width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? cat.color : tint(cat.color, 0.16) }}>
                <Icon name={cat.icon} size={22} color={on ? '#fff' : cat.color} strokeWidth={1.9} />
              </View>
              <T v="caption" tone={on ? 'ink' : 'ink2'} numberOfLines={1} style={{ fontFamily: on ? fonts.sansSemiBold : fonts.sansMedium, maxWidth: 82 }}>
                {cat.name}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: 14, gap: 10 }}>
        {editing ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Delete" variant="danger" onPress={confirmDelete} loading={remove.isPending} style={{ flex: 1 }} />
            <Button title="Save" onPress={() => categoryId && void save(categoryId)} loading={busy} disabled={!valid || !categoryId} style={{ flex: 2 }} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, borderRadius: 22, backgroundColor: c.surface3 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', DECIMAL, '0', 'del'].map((k) => (
            <Pressable
              key={k}
              accessibilityRole="keyboardkey"
              accessibilityLabel={k === 'del' ? 'Delete' : k === DECIMAL ? 'Decimal separator' : k}
              onPress={() => press(k)}
              onLongPress={k === 'del' ? () => setAmount('') : undefined}
              style={({ pressed }) => ({ width: '31.6%', minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.surface2 : c.surface })}
            >
              {k === 'del' ? <Delete size={22} color={c.ink} /> : <Text style={{ fontFamily: fonts.sansMedium, fontSize: 22, color: c.ink }}>{k}</Text>}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
