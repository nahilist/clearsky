import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { Stack, SplashScreen, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState, Platform, Text, View } from 'react-native';
import { Button } from '../components/ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initBilling } from '../lib/billing';
import { useDeviceLocation } from '../lib/location';
import { setupChannels, usePushLifecycle } from '../lib/push';
import { useStore } from '../store';
import { T, isIOS } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.05,
    enableAutoSessionTracking: true,
    sendDefaultPii: false,
  });
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true } },
});

// Pause fetches while offline and resume them (refetching stale data) when the network returns.
onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((st) => setOnline(st.isConnected !== false && st.isInternetReachable !== false)));

// Refetch when the app returns to the foreground.
AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));

function Boot() {
  useDeviceLocation();
  usePushLifecycle();
  useEffect(() => {
    initBilling();
    void setupChannels().catch(() => undefined);
  }, []);
  return null;
}

function Root() {
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.onboarded);
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const ready = hydrated && fontsLoaded;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return (
    <>
      <StatusBar style={isIOS ? 'light' : 'dark'} />
      {onboarded && <Boot />}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.bg }, animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }}>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="alert/[id]" />
          <Stack.Screen name="pro" options={{ presentation: 'modal' }} />
          <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
          <Stack.Screen name="widgets" />
          <Stack.Screen name="hourly" />
          <Stack.Screen name="rules" />
          <Stack.Screen name="share" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
      <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 24, color: T.text, textAlign: 'center' }}>Something went wrong</Text>
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: T.muted, textAlign: 'center' }}>The problem has been reported. Try again, and if it keeps happening restart the app.</Text>
      <View style={{ alignSelf: 'stretch' }}>
        <Button title="Try again" onPress={() => void retry()} />
      </View>
    </View>
  );
}

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Root />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
