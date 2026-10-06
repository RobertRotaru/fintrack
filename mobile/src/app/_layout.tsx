import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Only the weights the design uses (the package index would bundle every one).
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader/400Regular';
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader/500Medium';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { LockProvider, useLock } from '../lib/lock';
import { ThemeProvider, useTheme } from '../lib/theme';
import { LockScreen } from '../components/LockScreen';
import { OfflineScreen } from '../components/OfflineScreen';

void SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Newsreader_400Regular, Newsreader_500Medium, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <LockProvider>
                <Shell ready={fontsLoaded} />
              </LockProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell({ ready }: { ready: boolean }) {
  const { user, loading, offline } = useAuth();
  const { locked } = useLock();
  const { c, scheme } = useTheme();
  const show = ready && !loading;

  useEffect(() => {
    if (show) void SplashScreen.hideAsync().catch(() => {});
  }, [show]);

  if (!show) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (offline && !user) return <OfflineScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="quick-add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="profile" />
          <Stack.Screen name="account-new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="goal-new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="goal-add-money" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pick" options={{ presentation: 'modal' }} />
          <Stack.Screen name="categories" />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      {user && locked ? <LockScreen /> : null}
    </View>
  );
}
