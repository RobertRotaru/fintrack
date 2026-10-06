import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { ACCOUNT_TYPES, CURRENCIES, PERSONAL_COLORS, countryByCode, type AccountType } from '@ft/core';
import { api } from '../lib/api';
import { useUser } from '../lib/auth';
import { parseAmount } from '../lib/format';
import { keys, useApiMutation, useHousehold } from '../lib/queries';
import { fonts, useTheme } from '../lib/theme';
import { Chips, FormSheet } from '../components/FormSheet';
import { Button, Input, T } from '../components/ui';

/** Adds an account: what kind, what it's called, its currency and today's balance. */
export default function NewAccount() {
  const user = useUser();
  const { c } = useTheme();
  const { data: household } = useHousehold();
  const [type, setType] = useState<AccountType>('debit');
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [currency, setCurrency] = useState(countryByCode(user.country)?.currency ?? user.baseCurrency);
  const [balance, setBalance] = useState('');
  const [limit, setLimit] = useState('');
  const [shared, setShared] = useState(false);
  const create = useApiMutation((body: Record<string, unknown>) => api('/accounts', { body }), [keys.accounts]);
  const meta = ACCOUNT_TYPES.find((t) => t.type === type)!;
  const opening = parseAmount(balance, true);
  const credit = parseAmount(limit);
  const valid = name.trim() && !Number.isNaN(opening ?? 0) && (type !== 'credit' || !Number.isNaN(credit ?? 0));

  const submit = async () => {
    try {
      await create.mutateAsync({
        type,
        name: name.trim(),
        institutionName: bank.trim() || undefined,
        country: user.country,
        currency,
        color: PERSONAL_COLORS[ACCOUNT_TYPES.indexOf(meta) * 3 % PERSONAL_COLORS.length],
        icon: meta.icon,
        initialBalance: opening ?? 0,
        creditLimit: type === 'credit' ? (credit ?? undefined) : undefined,
        shared,
      });
      router.back();
    } catch (e) {
      Alert.alert('Couldn’t add the account', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const popular = Array.from(new Set([currency, user.baseCurrency, 'EUR', 'USD', 'RON', 'GBP', 'BTC'])).filter((x) => CURRENCIES.includes(x));

  return (
    <FormSheet title="New account" subtitle={meta.description}>
      <Chips<AccountType> label="Type" value={type} onChange={setType} options={ACCOUNT_TYPES.map((t) => ({ value: t.type, label: t.label }))} />
      <Input label="Name" value={name} onChangeText={setName} placeholder={type === 'savings' ? 'Rainy day fund' : 'Everyday'} maxLength={60} />
      <Input label="Bank or provider (optional)" value={bank} onChangeText={setBank} placeholder="Banca Transilvania" maxLength={80} />
      <Chips label="Currency" value={currency} onChange={setCurrency} options={popular.map((x) => ({ value: x, label: x }))} />
      <Input
        label={type === 'credit' || type === 'loan' ? 'Amount owed today' : 'Balance today'}
        value={balance}
        onChangeText={setBalance}
        keyboardType="decimal-pad"
        placeholder="0"
        hint={type === 'credit' || type === 'loan' ? 'Enter what you owe as a negative number, e.g. -1.250,00' : undefined}
      />
      {type === 'credit' ? <Input label="Credit limit" value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder="5.000" /> : null}
      {household ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: fonts.sansMedium }}>Share with {household.name}</T>
            <T v="caption" tone="muted">
              Family members see its balance and transactions.
            </T>
          </View>
          <Switch accessibilityLabel={`Share with ${household.name}`} value={shared} onValueChange={setShared} trackColor={{ false: c.surface3, true: c.brand }} thumbColor="#fff" ios_backgroundColor={c.surface3} />
        </View>
      ) : null}
      <Button title="Add account" onPress={submit} loading={create.isPending} disabled={!valid} />
    </FormSheet>
  );
}
