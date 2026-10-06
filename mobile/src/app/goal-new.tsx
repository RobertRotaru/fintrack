import { useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { GOAL_ICONS, PERSONAL_COLORS, addMonths, monthKey, monthLabel } from '@ft/core';
import { api } from '../lib/api';
import { useUser } from '../lib/auth';
import { parseAmount } from '../lib/format';
import { Icon } from '../lib/icons';
import { keys, useApiMutation, useHousehold } from '../lib/queries';
import { fonts, useTheme } from '../lib/theme';
import { Chips, FormSheet } from '../components/FormSheet';
import { Button, Input, T, tint } from '../components/ui';

const COLORS = ['#2e9a68', '#3e63d6', '#8a6cd1', '#e8679b', '#ee9a6c', '#0ea5e9', PERSONAL_COLORS[10]!];
const WHEN = ['none', '6', '12', '24'] as const;

/** A new goal: what for, how much, and (optionally) by when. */
export default function NewGoal() {
  const user = useUser();
  const { c } = useTheme();
  const { data: household } = useHousehold();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [icon, setIcon] = useState('target');
  const [color, setColor] = useState(COLORS[0]!);
  const [when, setWhen] = useState<(typeof WHEN)[number]>('12');
  const [shared, setShared] = useState(false);
  const create = useApiMutation((body: Record<string, unknown>) => api('/goals', { body }), [keys.goals]);
  const amount = parseAmount(target);
  const initial = parseAmount(saved);
  const valid = name.trim() && amount && !Number.isNaN(amount) && amount > 0 && !Number.isNaN(initial ?? 0);
  const deadline = (months: string) => `${addMonths(monthKey(new Date()), Number(months))}-01`;

  const submit = async () => {
    try {
      await create.mutateAsync({
        name: name.trim(),
        currency: user.baseCurrency,
        targetAmount: amount,
        initialSaved: initial ?? 0,
        deadline: when === 'none' ? null : deadline(when),
        icon,
        color,
        shared,
      });
      router.back();
    } catch (e) {
      Alert.alert('Couldn’t create the goal', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <FormSheet title="New goal" subtitle="A trip, a safety net, a new laptop.">
      <Input label="What are you saving for?" value={name} onChangeText={setName} placeholder="Emergency fund" maxLength={60} />
      <Input label={`Target (${user.baseCurrency})`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="10.000" />
      <Input label="Already saved (optional)" value={saved} onChangeText={setSaved} keyboardType="decimal-pad" placeholder="0" />
      <Chips
        label="By when"
        value={when}
        onChange={setWhen}
        options={WHEN.map((w) => ({ value: w, label: w === 'none' ? 'No deadline' : monthLabel(addMonths(monthKey(new Date()), Number(w)), 'long') }))}
      />
      <View style={{ gap: 6 }}>
        <T v="small" tone="ink2">
          Icon and colour
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GOAL_ICONS.slice(0, 12).map((name) => (
            <Pressable key={name} accessibilityRole="radio" accessibilityLabel={name} accessibilityState={{ checked: icon === name }} onPress={() => setIcon(name)} style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: icon === name ? color : tint(color, 0.14) }}>
              <Icon name={name} size={20} color={icon === name ? '#fff' : color} />
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          {COLORS.map((col) => (
            <Pressable key={col} accessibilityRole="radio" accessibilityLabel={`Colour ${col}`} accessibilityState={{ checked: color === col }} onPress={() => setColor(col)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: col, borderWidth: 3, borderColor: color === col ? c.ink : 'transparent' }} />
          ))}
        </View>
      </View>
      {household ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <T style={{ flex: 1, fontFamily: fonts.sansMedium }}>Share with {household.name}</T>
          <Switch accessibilityLabel={`Share with ${household.name}`} value={shared} onValueChange={setShared} trackColor={{ false: c.surface3, true: c.brand }} thumbColor="#fff" ios_backgroundColor={c.surface3} />
        </View>
      ) : null}
      <Button title="Create goal" onPress={submit} loading={create.isPending} disabled={!valid} />
    </FormSheet>
  );
}
