import { Pressable, Text, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Home, Lightbulb, Plus, Target, Wallet, type LucideIcon } from 'lucide-react-native';
import { fonts, useTheme } from '../../lib/theme';

const TABS: { name: string; label: string; icon: LucideIcon }[] = [
  { name: 'index', label: 'Home', icon: Home },
  { name: 'money', label: 'Money', icon: Wallet },
  { name: 'plan', label: 'Plan', icon: Target },
  { name: 'insights', label: 'Insights', icon: Lightbulb },
];

type TabBarProps = { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (name: string) => void } };

/** Home · Money · + · Plan · Insights, with the + raised in the middle to open Quick add. */
function TabBar({ state, navigation }: TabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const active = state.routes[state.index]?.name;
  const item = (t: (typeof TABS)[number]) => {
    const on = active === t.name;
    const I = t.icon;
    return (
      <Pressable
        key={t.name}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={t.label}
        onPress={() => {
          if (!on) void Haptics.selectionAsync().catch(() => {});
          navigation.navigate(t.name);
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 48 }}
      >
        <I size={23} color={on ? c.brandFg : c.muted} strokeWidth={on ? 2.2 : 1.8} />
        <Text style={{ fontFamily: on ? fonts.sansSemiBold : fonts.sansMedium, fontSize: 11, color: on ? c.brandFg : c.muted }}>{t.label}</Text>
      </Pressable>
    );
  };
  return (
    <View
      accessibilityRole="tablist"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingTop: 6,
        paddingBottom: Math.max(insets.bottom, 10),
        backgroundColor: c.tabBar,
        borderTopWidth: 1,
        borderTopColor: c.line,
      }}
    >
      {TABS.slice(0, 2).map(item)}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push('/quick-add');
          }}
          style={({ pressed }) => ({
            width: 58,
            height: 58,
            marginTop: -30,
            borderRadius: 20,
            backgroundColor: c.brand,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.94 : 1 }],
            boxShadow: `0 12px 24px -8px ${c.brandGlow}`,
          })}
        >
          <Plus size={28} color={c.brandInk} strokeWidth={2.5} />
        </Pressable>
      </View>
      {TABS.slice(2).map(item)}
    </View>
  );
}

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }} tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}
