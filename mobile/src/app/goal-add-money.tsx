import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { goalPlan } from '@ft/core';
import { api } from '../lib/api';
import { parseAmount, useMoney } from '../lib/format';
import { keys, useApiMutation, useGoals } from '../lib/queries';
import { FormSheet } from '../components/FormSheet';
import { Button, Input, ProgressBar, T } from '../components/ui';

/** Puts money towards a goal. */
export default function AddMoney() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const money = useMoney();
  const goal = useGoals().data?.find((g) => g.id === id);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const add = useApiMutation((body: { amount: number; note?: string }) => api(`/goals/${id}/contributions`, { body }), [keys.goals]);
  const value = parseAmount(amount);
  const valid = value !== null && !Number.isNaN(value) && value > 0;

  if (!goal) return <FormSheet title="Add money">{null}</FormSheet>;
  const plan = goalPlan(goal, 0);
  const after = Math.min(1, (goal.saved + (valid ? value! : 0)) / goal.targetAmount);

  return (
    <FormSheet title={`Add to ${goal.name}`} subtitle={`${money(goal.saved, { currency: goal.currency })} of ${money(goal.targetAmount, { currency: goal.currency })} saved`}>
      <View style={{ gap: 8 }}>
        <ProgressBar value={after} color={goal.color} height={10} />
        <T v="caption" tone="muted">
          {Math.round(plan.progress * 100)}% now{valid ? ` → ${Math.round(after * 100)}% after this` : ''}
        </T>
      </View>
      <Input label={`Amount (${goal.currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="250" autoFocus />
      <Input label="Note (optional)" value={note} onChangeText={setNote} maxLength={120} />
      <Button
        title="Add money"
        disabled={!valid}
        loading={add.isPending}
        onPress={async () => {
          try {
            await add.mutateAsync({ amount: value!, note: note.trim() || undefined });
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            router.back();
          } catch (e) {
            Alert.alert('Couldn’t add money', e instanceof Error ? e.message : 'Please try again.');
          }
        }}
      />
    </FormSheet>
  );
}
