import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import type { TxKind } from '@ft/core';
import { api } from '../lib/api';
import { keys, useApiMutation, useCategories } from '../lib/queries';
import { fonts, useTheme } from '../lib/theme';
import { Card, Divider, IconTile, Loading, Screen, Segmented, T } from '../components/ui';

/** Turn categories on or off; archived ones keep their history but leave Quick add. */
export default function Categories() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useCategories();
  const [kind, setKind] = useState<TxKind>('expense');
  const toggle = useApiMutation(({ id, archived }: { id: string; archived: boolean }) => api(`/categories/${id}`, { method: 'PATCH', body: { archived } }), [keys.categories]);
  const list = (q.data ?? []).filter((x) => x.kind === kind);

  return (
    <Screen
      tabBar={false}
      header={
        <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
            <ChevronLeft size={22} color={c.brandFg} />
            <T tone="brandFg" style={{ fontFamily: fonts.sansMedium }}>
              Profile
            </T>
          </Pressable>
        </View>
      }
    >
      <T v="title">Categories</T>
      <Segmented<TxKind>
        label="Kind"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'expense', label: 'Spending' },
          { value: 'income', label: 'Income' },
        ]}
      />
      {q.isPending ? (
        <Loading />
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {list.map((cat, i) => (
            <View key={cat.id}>
              {i > 0 ? <Divider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 56, opacity: cat.archived ? 0.55 : 1 }}>
                <IconTile icon={cat.icon} color={cat.color} size={34} />
                <T style={{ flex: 1, fontFamily: fonts.sansMedium }}>{cat.name}</T>
                <Switch
                  accessibilityLabel={`${cat.name} in Quick add`}
                  value={!cat.archived}
                  onValueChange={(on) => toggle.mutate({ id: cat.id, archived: !on })}
                  trackColor={{ false: c.surface3, true: c.brand }}
                  thumbColor="#ffffff"
                  ios_backgroundColor={c.surface3}
                />
              </View>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
