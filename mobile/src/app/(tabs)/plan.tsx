import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useRefreshAll } from '../../lib/queries';
import { Button, Screen, Segmented, T } from '../../components/ui';
import { GoalsSection } from '../../features/plan/Goals';
import { ProjectionsSection } from '../../features/plan/Projections';
import { InvestSection } from '../../features/plan/Invest';

type Tab = 'goals' | 'projections' | 'invest';
const TABS: { value: Tab; label: string }[] = [
  { value: 'goals', label: 'Goals' },
  { value: 'projections', label: 'Projections' },
  { value: 'invest', label: 'Invest' },
];

/** Plan: where your money is heading — goals, the months ahead, and investing. */
export default function PlanScreen() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const tab: Tab = TABS.some((t) => t.value === params.tab) ? params.tab! : 'goals';
  const refreshAll = useRefreshAll();
  const [refreshing, setRefreshing] = useState(false);
  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await refreshAll();
        setRefreshing(false);
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T v="title" accessibilityRole="header">
          Plan
        </T>
        {tab === 'goals' ? <Button title="Goal" icon="target" onPress={() => router.push('/goal-new')} style={{ minHeight: 40, paddingHorizontal: 14 }} /> : null}
      </View>
      <Segmented<Tab> label="Plan" value={tab} onChange={(t) => router.setParams({ tab: t })} options={TABS} />
      {tab === 'goals' ? <GoalsSection /> : tab === 'projections' ? <ProjectionsSection /> : <InvestSection />}
    </Screen>
  );
}
