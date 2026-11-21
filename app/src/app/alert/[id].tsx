import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Body, Button, Card, Label, Screen } from '../../components/ui';
import { clock } from '../../lib/format';
import { allAlerts } from '../../lib/alertsFor';
import { useAir, useForecast } from '../../lib/hooks';
import { useStore } from '../../store';
import { font, T } from '../../theme';

export default function AlertDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [placeKey, ...rest] = String(id ?? '').split('|');
  const alertKey = rest.join('|');
  const place = useStore((s) => (s.currentPlace?.id === placeKey ? s.currentPlace : s.places.find((p) => p.id === placeKey)));
  const { forecast } = useForecast(place ?? null);
  const muteFor = useStore((s) => s.muteFor);
  const aq = useAir(place ?? null);
  const lang = useStore((s) => s.lang);
  const isPro = useStore((s) => s.isPro);
  const prefs = useStore((s) => s.prefs);
  const alert = useMemo(() => (forecast ? allAlerts(forecast, aq, { lang, isPro, prefs, placeId: placeKey }).find((a) => a.key === alertKey) : undefined), [forecast, aq, lang, isPro, prefs, placeKey, alertKey]);

  return (
    <Screen tabs={false}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}>
        <Icon name="back" size={22} color={T.link} strokeWidth={2.4} />
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: T.link }}>Alerts</Text>
      </Pressable>
      {!alert ? (
        <Card>
          <Text style={{ fontFamily: font.heavy, fontSize: 22, color: T.text }}>This alert has ended</Text>
          <Body>Conditions changed since it was issued. Pull down on the Alerts tab to refresh.</Body>
        </Card>
      ) : (
        <>
          <View style={{ backgroundColor: T.alertBg, borderRadius: 28, padding: 22, gap: 8 }}>
            <Text style={{ fontFamily: font.heavy, fontSize: 12, letterSpacing: 1.2, color: T.alertFg }}>{alert.severity.toUpperCase()}{place ? ` · ${place.name.toUpperCase()}` : ''}</Text>
            <Text accessibilityRole="header" style={{ fontFamily: font.heavy, fontSize: 28, lineHeight: 32, color: T.alertFg }}>{alert.title}</Text>
            <Text style={{ fontFamily: font.semibold, fontSize: 14, color: T.alertFg }}>{alert.summary} {clock(alert.startsAt)} to {clock(alert.endsAt)}.</Text>
          </View>
          <Card>
            <Label>What to do</Label>
            {alert.actions.map((a, i) => (
              <View key={a} style={{ flexDirection: 'row', gap: 10 }}>
                <Text style={{ fontFamily: font.heavy, fontSize: 15, color: T.ok }}>{i + 1}</Text>
                <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: T.text }}>{a}</Text>
              </View>
            ))}
          </Card>
          <Card>
            <Label>Why you see this</Label>
            <Body>{alert.reason} Source: ClearSky forecast model, not an official warning. Follow local authorities for official guidance.</Body>
          </Card>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button title="Share" onPress={() => void Share.share({ message: `${alert.title} at ${place?.name ?? 'my location'}: ${alert.summary} (ClearSky)` })} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Mute 3 hours" kind="outline" onPress={() => { muteFor(3); router.back(); }} />
            </View>
          </View>
          <Body style={{ textAlign: 'center', fontSize: 12 }}>Safety alerts never carry ads and never need Pro.</Body>
        </>
      )}
    </Screen>
  );
}
