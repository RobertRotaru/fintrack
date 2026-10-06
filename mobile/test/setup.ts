/* Native modules the screens touch, replaced with in-memory fakes. */

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
    __store: store,
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-router', () => {
  const router = { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), replace: jest.fn() };
  return { router, useRouter: () => router, useLocalSearchParams: jest.fn(() => ({})), Link: 'Link' };
});

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { hostUri: '192.168.1.20:8081' } } }));

// Entrance animations off: assertions see the final layout immediately.
jest.mock('react-native-reanimated', () => {
  const RN = jest.requireActual('react-native');
  const anim = { delay: () => anim, duration: () => anim };
  return {
    __esModule: true,
    default: { View: RN.View },
    FadeInDown: anim,
    Easing: { inOut: () => () => 0, sin: () => 0 },
    useReducedMotion: () => true,
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
  };
});
