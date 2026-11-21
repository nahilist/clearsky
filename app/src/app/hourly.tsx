import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BarChart, LineChart } from '../components/Charts';
import { Icon } from '../components/Icon';
import { Body, Card, Chip, Label, Screen, Title } from '../components/ui';
import { hourLabel, toTemp, toWind } from '../lib/format';
import { useForecast } from '../lib/hooks';
import { useT } from '../i18n';
import { nextHours } from '../shared/alerts';
import { useActivePlace, useStore } from '../store';
import { font, T } from '../theme';

type Mode = 'temp' | 'rain' | 'wind';

export default function Hourly() {
  const t = useT();
  const place = useActivePlace();
  const units = useStore((s) => s.units);
  const { forecast: f } = useForecast(place);
  const [mode, setMode] = useState<Mode>('temp');
  const hours = f ? nextHours(f, 48) : [];
  const labels = hours.map((h) => hourLabel(h.time));

  const series = {
    temp: hours.map((h) => toTemp(h.temp, units.temp)),
    rain: hours.map((h) => Math.round(h.precip * 10) / 10),
    wind: hours.map((h) => toWind(h.gust, units.wind)),
  };
  const v = series[mode];
  const unit = mode === 'temp' ? '°' : mode === 'rain' ? ' mm' : units.wind === 'mph' ? ' mph' : ' km/h';

  return (
    <Screen tabs={false}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}>
        <Icon name="back" size={22} color={T.link} strokeWidth={2.4} />
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: T.link }}>{place?.name ?? ''}</Text>
      </Pressable>
      <Title>{t('hourly.title')}</Title>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip title={t('hourly.temp')} on={mode === 'temp'} onPress={() => setMode('temp')} />
        <Chip title={t('hourly.rain')} on={mode === 'rain'} onPress={() => setMode('rain')} />
        <Chip title={t('hourly.wind')} on={mode === 'wind'} onPress={() => setMode('wind')} />
      </View>
      {!f || v.length < 2 ? (
        <Body>…</Body>
      ) : (
        <>
          <Card>
            {mode === 'rain' ? <BarChart values={v} labels={labels} unit=" mm" height={200} /> : <LineChart values={v} labels={labels} unit={mode === 'temp' ? '°' : ''} height={200} color={mode === 'temp' ? T.accent : T.primary} />}
          </Card>
          <Card>
            <Label>{mode === 'rain' ? t('hourly.total') : t('hourly.high')}</Label>
            <Text style={{ fontFamily: font.heavy, fontSize: 28, color: T.text }}>
              {mode === 'rain' ? `${Math.round(v.reduce((a, b) => a + b, 0) * 10) / 10}${unit}` : `${Math.max(...v)}${unit}`}
            </Text>
            {mode !== 'rain' && (
              <>
                <Label>{mode === 'wind' ? t('hourly.peak') : t('hourly.low')}</Label>
                <Text style={{ fontFamily: font.heavy, fontSize: 28, color: T.text }}>{mode === 'wind' ? `${Math.max(...v)}${unit}` : `${Math.min(...v)}${unit}`}</Text>
              </>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
