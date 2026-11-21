import type React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { Icon, WeatherGlyph } from '../components/Icon';
import { Button, Notice, Screen, Title } from '../components/ui';
import { useT } from '../i18n';
import { useFmt, weekday } from '../lib/format';
import { useForecast } from '../lib/hooks';
import { describeCode } from '../shared/weather';
import { useActivePlace } from '../store';
import { font, T } from '../theme';

export default function Share() {
  const t = useT();
  const place = useActivePlace();
  const fmt = useFmt();
  const { forecast: f } = useForecast(place);
  const ref = useRef<React.ComponentRef<typeof ViewShot>>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const send = async () => {
    setBusy(true);
    setErr(false);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('unavailable');
      const uri = await ref.current?.capture?.();
      if (!uri) throw new Error('capture');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('share.title') });
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };

  const desc = f ? describeCode(f.current.code, f.current.isDay) : null;
  return (
    <Screen tabs={false}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
        <Icon name="back" size={22} color={T.link} strokeWidth={2.4} />
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: T.link }}>{place?.name ?? ''}</Text>
      </Pressable>
      <Title>{t('share.title')}</Title>
      {f && desc && place && (
        <ViewShot ref={ref} options={{ format: 'png', quality: 1 }} style={{ borderRadius: 28, overflow: 'hidden' }}>
          <LinearGradient colors={['#0B1B3A', '#1B4FA8', '#2F80ED']} style={{ padding: 24, gap: 6 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 16, color: '#DCE8FF' }}>{place.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontFamily: font.heavy, fontSize: 84, letterSpacing: -4, color: '#FFFFFF', includeFontPadding: false }}>{fmt.temp(f.current.temp)}</Text>
              <WeatherGlyph glyph={desc.glyph} size={60} />
            </View>
            <Text style={{ fontFamily: font.semibold, fontSize: 20, color: '#FFFFFF' }}>{desc.label}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 15, color: '#DCE8FF' }}>H {fmt.temp(f.daily[0].max)} · L {fmt.temp(f.daily[0].min)} · {f.daily[0].pop}%</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
              {f.daily.slice(1, 6).map((d) => (
                <View key={d.date} style={{ alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 12, color: '#DCE8FF' }}>{weekday(d.date, f.current.time)}</Text>
                  <WeatherGlyph glyph={describeCode(d.code).glyph} size={26} />
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#FFFFFF' }}>{fmt.temp(d.max)}</Text>
                </View>
              ))}
            </View>
            <Text style={{ marginTop: 16, fontFamily: font.bold, fontSize: 12, color: '#F5B83D' }}>{t('share.from')}</Text>
          </LinearGradient>
        </ViewShot>
      )}
      {err && <Notice tone="error">{t('share.error')}</Notice>}
      <Button title={t('share.button')} onPress={() => void send()} loading={busy} disabled={!f} />
    </Screen>
  );
}
