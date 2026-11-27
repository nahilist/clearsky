import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerDevice } from './api';
import { useStore } from '../store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function setupChannels() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('severe', {
      name: 'Severe weather',
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F5B83D',
    });
    await Notifications.setNotificationChannelAsync('rain', {
      name: 'Rain starting soon',
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync('daily', {
      name: 'Daily briefing',
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.LOW,
    });
  } catch {
    // Expo Go on Android (SDK 53+) does not support remote notification channels.
  }
}

/** Asks for permission (once) and returns the Expo push token, or null if unavailable. */
export async function enablePush(): Promise<string | null> {
  if (!Device.isDevice) return null;
  await setupChannels().catch(() => undefined);
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId || String(projectId).startsWith('REPLACE')) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    useStore.getState().setPushToken(data);
    return data;
  } catch {
    return null;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Debounced: tells the server which places and preferences belong to this device. */
export function syncDevice() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const s = useStore.getState();
    if (!s.pushToken) return;
    const all = s.currentPlace ? [s.currentPlace, ...s.places] : s.places;
    try {
      await registerDevice({
        token: s.pushToken,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        lang: s.lang,
        places: all.map((p) => ({ lat: p.lat, lon: p.lon, name: p.name })),
        // Custom rules and commute alerts are Pro features; the server only receives them for Pro users.
        prefs: { ...s.prefs, rules: s.isPro ? s.prefs.rules : [], commute: { ...s.prefs.commute, enabled: s.isPro && s.prefs.commute.enabled } },
        mutedUntil: s.mutedUntil,
      });
    } catch {
      // Retried on the next change or app start.
    }
  }, 1500);
}

/** Keeps the server in sync and opens the alert when a notification is tapped. */
export function usePushLifecycle() {
  const token = useStore((s) => s.pushToken);
  const places = useStore((s) => s.places);
  const current = useStore((s) => s.currentPlace);
  const prefs = useStore((s) => s.prefs);
  const muted = useStore((s) => s.mutedUntil);
  const lang = useStore((s) => s.lang);
  const isPro = useStore((s) => s.isPro);
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (token) syncDevice();
  }, [token, places, current, prefs, muted, lang, isPro]);

  useEffect(() => {
    const data = last?.notification.request.content.data as { alertId?: string } | undefined;
    if (data?.alertId) router.push({ pathname: '/alert/[id]', params: { id: data.alertId } });
  }, [last]);
}
