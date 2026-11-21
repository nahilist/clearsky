import { router } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';
import { Icon, WeatherGlyph } from '../components/Icon';
import { Body, Card, Label, Screen, Title } from '../components/ui';
import { useFmt } from '../lib/format';
import { useForecast } from '../lib/hooks';
import { describeCode } from '../shared/weather';
import { deriveAlerts } from '../shared/alerts';
import { useActivePlace } from '../store';
import { font, T } from '../theme';

// Previews only. Native home-screen widgets (WidgetKit on iOS, Glance on Android)
// need native modules and ship in a later release. See the README roadmap.
export default function Widgets() {
  const place = useActivePlace();
  const fmt = useFmt();
  const { forecast: f } = useForecast(place);
  const rain = f ? deriveAlerts(f).find((a) => a.kind === 'rain_soon') : undefined;
  const steps = Platform.OS === 'ios' ? ['Touch and hold the Home Screen.', 'Tap the + button and search for ClearSky.', 'Choose a size and tap Add Widget.'] : ['Touch and hold an empty spot on the home screen.', 'Tap Widgets and find ClearSky.', 'Drag a size onto your home screen.'];

  return (
    <Screen tabs={false}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}>
        <Icon name="back" size={22} color={T.link} strokeWidth={2.4} />
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: T.link }}>Back</Text>
      </Pressable>
      <Title>Widgets</Title>
      <Label>Preview</Label>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, aspectRatio: 1, borderRadius: 28, backgroundColor: T.cardStrong, padding: 16, justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 13, color: '#fff' }}>{place?.name ?? 'Your place'}</Text>
          <View>
            <Text style={{ fontFamily: font.heavy, fontSize: 44, letterSpacing: -2, color: '#fff' }}>{f ? fmt.temp(f.current.temp) : '--'}</Text>
            <Text style={{ fontFamily: font.bold, fontSize: 12, color: T.accent }}>{rain?.title ?? (f ? describeCode(f.current.code, f.current.isDay).label : '')}</Text>
          </View>
        </View>
        <View style={{ flex: 1, aspectRatio: 1, borderRadius: 28, backgroundColor: T.alertBg, padding: 16, justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: font.heavy, fontSize: 11, letterSpacing: 1, color: T.alertFg }}>ALERT</Text>
          <Text style={{ fontFamily: font.heavy, fontSize: 17, lineHeight: 21, color: T.alertFg }}>Severe alerts show here. Tap for steps.</Text>
        </View>
      </View>
      {f && (
        <Card>
          <Label>Next 6 hours</Label>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {f.hourly.slice(0, 6).map((h) => (
              <View key={h.time} style={{ alignItems: 'center', gap: 6 }}>
                <WeatherGlyph glyph={describeCode(h.code, h.isDay).glyph} size={24} />
                <Text style={{ fontFamily: font.bold, fontSize: 14, color: T.text }}>{fmt.temp(h.temp)}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}
      <Card>
        <Label>Coming in a later release</Label>
        <Body>Home screen and lock screen widgets need native code, so they are not in this version. Every size will be free when they ship.</Body>
      </Card>
      <Card>
        <Label>How adding a widget works</Label>
        {steps.map((s, i) => (
          <Text key={s} style={{ fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: T.text }}>{i + 1}. {s}</Text>
        ))}
      </Card>
    </Screen>
  );
}
