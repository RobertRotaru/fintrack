import { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { COUNTRIES, CURRENCIES, type User } from '@ft/core';
import { api } from '../lib/api';
import { useAuth, useUser } from '../lib/auth';
import { keys, useApiMutation } from '../lib/queries';
import { fonts, useTheme } from '../lib/theme';
import { Divider, Row, T } from '../components/ui';

/** Chooses the main currency or the country, saved straight to the profile. */
export default function Pick() {
  const { kind } = useLocalSearchParams<{ kind: 'currency' | 'country' }>();
  const user = useUser();
  const { setUser } = useAuth();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const save = useApiMutation((body: Partial<User>) => api<User>('/auth/me', { method: 'PATCH', body }), [keys.transactions, keys.accounts]);

  const items = useMemo(() => {
    const all =
      kind === 'country'
        ? COUNTRIES.map((x) => ({ value: x.code, label: `${x.flag}  ${x.name}`, sub: x.currency }))
        : CURRENCIES.map((x) => ({ value: x, label: x, sub: '' }));
    const s = search.trim().toLowerCase();
    return s ? all.filter((i) => `${i.value} ${i.label}`.toLowerCase().includes(s)) : all;
  }, [kind, search]);
  const current = kind === 'country' ? user.country : user.baseCurrency;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 18 }}>
      <View style={{ paddingHorizontal: 20, gap: 12, paddingBottom: 10 }}>
        <T v="display">{kind === 'country' ? 'Country' : 'Main currency'}</T>
        <T v="small" tone="muted">
          {kind === 'country' ? 'Used for new accounts and bank lists.' : 'Reports and totals convert everything into this.'}
        </T>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search"
          placeholderTextColor={c.muted}
          accessibilityLabel="Search"
          style={{ minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 14, fontFamily: fonts.sans, fontSize: 15, color: c.ink }}
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.value}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        renderItem={({ item }) => (
          <Row
            accessibilityRole="button"
            accessibilityState={{ selected: item.value === current }}
            onPress={async () => {
              setUser(await save.mutateAsync(kind === 'country' ? { country: item.value } : { baseCurrency: item.value }));
              router.back();
            }}
          >
            <T style={{ flex: 1 }}>{item.label}</T>
            {item.sub ? <T tone="muted">{item.sub}</T> : null}
            {item.value === current ? <Check size={18} color={c.brandFg} /> : null}
          </Row>
        )}
      />
    </View>
  );
}
