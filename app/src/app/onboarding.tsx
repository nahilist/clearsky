import * as Location from 'expo-location';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Body, Button, Label, Notice, Screen } from '../components/ui';
import { enablePush } from '../lib/push';
import { useStore } from '../store';
import { font, T } from '../theme';

type Step = 0 | 1 | 2;

const COPY: { label: string; title: string; body: string; icon: 'today' | 'places' | 'alerts' }[] = [
  { label: 'Welcome', title: 'Forecasts first. Ads never in alerts.', body: 'ClearSky shows the weather you need, fast, and keeps safety alerts free for everyone.', icon: 'today' },
  { label: 'Step 1 of 2', title: 'Weather where you are', body: 'Your location is used to show the forecast and rain alerts for your area. It is not sold or shared.', icon: 'places' },
  { label: 'Step 2 of 2', title: 'Get alerts before it rains', body: 'We notify you about severe weather and rain starting soon. You choose what to receive and can set quiet hours.', icon: 'alerts' },
];

export default function Onboarding() {
  const [step, setStep] = useState<Step>(0);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const finish = useStore((s) => s.setOnboarded);
  const setPrefs = useStore((s) => s.setPrefs);
  const c = COPY[step];

  const next = () => (step < 2 ? setStep((step + 1) as Step) : finish());

  const askLocation = async () => {
    setBusy(true);
    try {
      const r = await Location.requestForegroundPermissionsAsync();
      if (r.status !== 'granted') setNote('No problem. You can search for a city instead and turn location on later in Settings.');
      next();
    } finally {
      setBusy(false);
    }
  };

  const askNotifications = async () => {
    setBusy(true);
    try {
      const token = await enablePush();
      if (!token) {
        setPrefs({ severe: false, rainSoon: false });
        setNote('Alerts are off for now. You can turn them on any time in Settings.');
      }
      finish();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tabs={false} scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={c.icon} size={40} color={T.onAccent} strokeWidth={2.2} />
        </View>
        <Label>{c.label}</Label>
        <Text accessibilityRole="header" style={{ fontFamily: font.heavy, fontSize: 34, lineHeight: 38, letterSpacing: -1, color: T.text }}>{c.title}</Text>
        <Body>{c.body}</Body>
        {note && <Notice>{note}</Notice>}
      </View>
      <View style={{ gap: 10 }}>
        {step === 0 && <Button title="Get started" onPress={next} />}
        {step === 1 && (
          <>
            <Button title="Use my location" onPress={() => void askLocation()} loading={busy} />
            <Button title="Not now" kind="outline" onPress={next} disabled={busy} />
          </>
        )}
        {step === 2 && (
          <>
            <Button title="Turn on alerts" onPress={() => void askNotifications()} loading={busy} />
            <Button title="Not now" kind="outline" onPress={() => { setPrefs({ severe: false, rainSoon: false }); finish(); }} disabled={busy} />
          </>
        )}
      </View>
    </Screen>
  );
}
