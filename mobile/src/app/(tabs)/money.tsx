import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useRefreshAll } from '../../lib/queries';
import { Button, Screen, Segmented, T } from '../../components/ui';
import { AccountsSection } from '../../features/money/Accounts';
import { ActivitySection } from '../../features/money/Activity';
import { SpendingSection } from '../../features/money/Spending';
import { FamilySection } from '../../features/money/Family';

type Tab = 'accounts' | 'activity' | 'spending' | 'family';
const TABS: { value: Tab; label: string }[] = [
  { value: 'accounts', label: 'Accounts' },
  { value: 'activity', label: 'Activity' },
  { value: 'spending', label: 'Spending' },
  { value: 'family', label: 'Family' },
];

/** Money: where it is (Accounts), what moved (Activity), where it went (Spending), and who shares it (Family). */
export default function MoneyScreen() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const tab: Tab = TABS.some((t) => t.value === params.tab) ? params.tab! : 'accounts';
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
          Money
        </T>
        {tab === 'accounts' ? <Button title="Account" icon="wallet" variant="primary" onPress={() => router.push('/account-new')} style={{ minHeight: 40, paddingHorizontal: 14 }} /> : null}
      </View>
      <Segmented<Tab> label="Money" value={tab} onChange={(t) => router.setParams({ tab: t })} options={TABS} />
      {tab === 'accounts' ? <AccountsSection /> : tab === 'activity' ? <ActivitySection /> : tab === 'spending' ? <SpendingSection /> : <FamilySection />}
    </Screen>
  );
}
