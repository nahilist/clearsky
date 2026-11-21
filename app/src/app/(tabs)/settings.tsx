import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Switch, Text, View } from 'react-native';
import { Body, Button, Card, Chip, Label, Notice, Screen, Title } from '../../components/ui';
import { deleteDevice } from '../../lib/api';
import { useT } from '../../i18n';
import { enablePush } from '../../lib/push';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import { font, T } from '../../theme';

// Replace these before submitting to the stores.
const PRIVACY_URL = 'https://example.com/privacy';
const TERMS_URL = 'https://example.com/terms';
const SUPPORT_URL = 'mailto:support@example.com';

function Row({ title, sub, value, onValue, disabled }: { title: string; sub?: string; value: boolean; onValue: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: T.text }}>{title}</Text>
        {sub ? <Text style={{ fontFamily: font.regular, fontSize: 12, color: T.muted }}>{sub}</Text> : null}
      </View>
      <Switch accessibilityLabel={title} value={value} onValueChange={onValue} disabled={disabled} trackColor={{ true: T.ok, false: T.border }} thumbColor="#fff" />
    </View>
  );
}

function Link({ title, onPress, value }: { title: string; onPress: () => void; value?: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 15, color: T.text }}>{title}</Text>
      {value ? <Text style={{ fontFamily: font.medium, fontSize: 14, color: T.link }}>{value}</Text> : null}
    </Pressable>
  );
}

export default function Settings() {
  const s = useStore();
  const t = useT();
  const [note, setNote] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const toggleAlerts = async (key: 'severe' | 'rainSoon' | 'daily' | 'air', v: boolean) => {
    if (v && !s.pushToken) {
      const token = await enablePush();
      if (!token) {
        setNote('Notifications are not available. Allow them in system settings, and use a real device.');
        return;
      }
    }
    setNote(null);
    s.setPrefs({ [key]: v });
  };

  const wipe = () =>
    Alert.alert('Delete my data', 'This removes your places, preferences and notification registration from this device and our server.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (s.pushToken) await deleteDevice(s.pushToken).catch(() => undefined);
          s.reset();
        },
      },
    ]);

  return (
    <Screen>
      <Title>{t('settings.title')}</Title>

      <Label>Account</Label>
      <Card>
        {userEmail ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: T.text }}>Signed in as</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 14, color: T.muted }}>{userEmail}</Text>
            <View style={{ marginTop: 4 }}>
              <Button
                kind="outline"
                title="Sign Out"
                onPress={async () => {
                  await supabase.auth.signOut();
                  setUserEmail(null);
                }}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: T.text }}>Cloud Backup & Sync</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: T.muted }}>
              Sign in with Supabase to sync your saved places and custom alert rules across devices.
            </Text>
            <View style={{ marginTop: 4 }}>
              <Button
                title="Sign In / Create Account"
                onPress={() => router.push('/auth')}
              />
            </View>
          </View>
        )}
      </Card>

      <Label>{t('settings.language')}</Label>
      <Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip title="English" on={s.lang === 'en'} onPress={() => s.setLang('en')} />
          <Chip title="हिन्दी" on={s.lang === 'hi'} onPress={() => s.setLang('hi')} />
        </View>
      </Card>
      <Label>{t('settings.alerts')}</Label>
      <Card>
        <Row title={t('settings.severe')} sub={t('settings.severeSub')} value={s.prefs.severe} onValue={(v) => void toggleAlerts('severe', v)} />
        <Row title={t('settings.rainSoon')} sub={t('settings.rainSoonSub')} value={s.prefs.rainSoon} onValue={(v) => void toggleAlerts('rainSoon', v)} />
        <Row title={t('settings.daily')} sub={t('settings.dailySub')} value={s.prefs.daily} onValue={(v) => void toggleAlerts('daily', v)} />
        <Row title={t('settings.air')} sub={t('settings.airSub')} value={s.prefs.air} onValue={(v) => void toggleAlerts('air', v)} />
        <Row title={t('settings.quiet')} sub={t('settings.quietSub', { a: s.prefs.quietStart, b: s.prefs.quietEnd })} value={s.prefs.quietOn} onValue={(v) => s.setPrefs({ quietOn: v })} />
      </Card>
      {note && <Notice tone="error">{note}</Notice>}

      <Label>{t('settings.units')}</Label>
      <Card>
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: T.text }}>{t('settings.temp')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip title="°C" on={s.units.temp === 'C'} onPress={() => s.setUnits({ temp: 'C' })} />
          <Chip title="°F" on={s.units.temp === 'F'} onPress={() => s.setUnits({ temp: 'F' })} />
        </View>
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: T.text }}>{t('settings.windSpeed')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip title="km/h" on={s.units.wind === 'kmh'} onPress={() => s.setUnits({ wind: 'kmh' })} />
          <Chip title="mph" on={s.units.wind === 'mph'} onPress={() => s.setUnits({ wind: 'mph' })} />
        </View>
      </Card>

      <Label>{t('settings.pro')}</Label>
      <Card onPress={() => router.push('/pro')} label="ClearSky Pro">
        <Text style={{ fontFamily: font.bold, fontSize: 16, color: T.text }}>{s.isPro ? t('settings.proOn') : t('settings.proGet')}</Text>
        <Body>{s.isPro ? t('settings.proManage') : t('settings.proSell')}</Body>
      </Card>

      <Label>{t('settings.about')}</Label>
      <Card>
        <Link title={t('settings.widgets')} onPress={() => router.push('/widgets')} />
        <Link title={t('settings.privacy')} onPress={() => void Linking.openURL(PRIVACY_URL)} />
        <Link title={t('settings.terms')} onPress={() => void Linking.openURL(TERMS_URL)} />
        <Link title={t('settings.support')} onPress={() => void Linking.openURL(SUPPORT_URL)} />
        <Link title={t('settings.location')} value="System settings" onPress={() => void Linking.openSettings()} />
        <Link title={t('settings.delete')} onPress={wipe} />
      </Card>
      <Body style={{ textAlign: 'center', fontSize: 12 }}>Weather data by Open-Meteo.com (CC BY 4.0). Radar by RainViewer.</Body>
    </Screen>
  );
}
