import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { ObserveInteractiveMarker } from '../../lib/observe';
import { WeatherGlyph } from '../../components/Icon';
import { AlertBanner, Body, Button, Card, Label, Notice, Screen, Skeleton } from '../../components/ui';
import { clock, hourLabel, useFmt, weekday } from '../../lib/format';
import { useAir, useForecast } from '../../lib/hooks';
import { useDeviceLocation } from '../../lib/location';
import { AdviceCard, AirCard, RainNow, SunMoonCard } from '../../components/cards';
import { allAlerts } from '../../lib/alertsFor';
import { useT } from '../../i18n';
import { dailyAdvice } from '../../shared/advice';
import { describeCode } from '../../shared/weather';
import { useActivePlace, useStore } from '../../store';
import { font, isIOS, T } from '../../theme';

export default function Today() {
  const place = useActivePlace();
  const fmt = useFmt();
  const t = useT();
  const lang = useStore((s) => s.lang);
  const isPro = useStore((s) => s.isPro);
  const prefs = useStore((s) => s.prefs);
  const aq = useAir(place);
  const { forecast: f, isLoading, isError, error, isFetching, isCached, refetch } = useForecast(place);
  const { status, locate } = useDeviceLocation();
  const mutedUntil = useStore((s) => s.mutedUntil);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const muted = mutedUntil > now;

  if (!place) {
    return (
      <Screen>
        <Card style={{ gap: 14, marginTop: 40 }}>
          <Label>Welcome to ClearSky</Label>
          <Text style={{ fontFamily: font.heavy, fontSize: 26, color: T.text }}>Where do you want the forecast?</Text>
          <Body>{status === 'denied' ? 'Location is off. Allow it in Settings, or search for a city instead.' : 'Allow location for rain alerts at your door, or search for a city.'}</Body>
          {status === 'denied' ? <Button title="Open system settings" onPress={() => void Linking.openSettings()} /> : <Button title="Use my location" onPress={() => void locate()} loading={status === 'loading'} />}
          <Button title="Search for a city" kind="outline" onPress={() => router.push('/places')} />
        </Card>
      </Screen>
    );
  }

  if (!f) {
    return (
      <Screen refreshing={isFetching} onRefresh={() => void refetch()}>
        <Skeleton h={28} w="50%" />
        <Skeleton h={120} w="60%" />
        <Skeleton h={150} />
        <Skeleton h={90} />
        {isError && !isLoading && (
          <Notice tone="error">
            Can&apos;t load the forecast. Pull down to try again.
            {__DEV__ && error ? `\n(${error instanceof Error ? error.message : String(error)})` : ''}
          </Notice>
        )}
      </Screen>
    );
  }

  const desc = describeCode(f.current.code, f.current.isDay);
  const day = f.daily[0];
  const nowIdx = Math.max(0, f.hourly.findIndex((h) => h.time.slice(0, 13) >= f.current.time.slice(0, 13)));
  const hours = f.hourly.slice(nowIdx, nowIdx + 12);
  const top = allAlerts(f, aq, { lang, isPro, prefs, placeId: place.id });
  const tips = dailyAdvice(f, aq, lang);
  const severe = top.find((a) => a.severity !== 'info');
  const rain = top.find((a) => a.kind === 'rain_soon');
  const ageMin = Math.round((now - f.fetchedAt) / 60000);

  return (
    <Screen refreshing={isFetching && !isLoading} onRefresh={() => void refetch()}>
      <ObserveInteractiveMarker params={{ hasForecast: true }} />
      <View style={{ paddingHorizontal: 4, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 15, color: T.muted }}>{place.name}{place.sub ? `, ${place.sub.split(',')[0]}` : ''}</Text>
          <View style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: T.chip }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 12, color: T.text }}>{t('today.noAds')}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text accessibilityLabel={`${fmt.temp(f.current.temp)} ${desc.label}`} style={{ fontFamily: font.heavy, fontSize: isIOS ? 104 : 92, letterSpacing: -5, color: T.text, includeFontPadding: false }}>
            {fmt.temp(f.current.temp)}
          </Text>
          <WeatherGlyph glyph={desc.glyph} size={64} />
        </View>
        <Text style={{ fontFamily: font.semibold, fontSize: 20, color: T.text }}>{desc.label} · {t('today.feels')} {fmt.temp(f.current.feels)}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 15, color: T.muted }}>
          H {fmt.temp(day.max)} · L {fmt.temp(day.min)}
          {rain ? ` · ${rain.title}` : ''}
        </Text>
      </View>

      {(isError || isCached || ageMin > 30) && (
        <Notice tone={isError ? 'error' : 'info'}>{isError ? `Offline. Showing the forecast from ${ageMin} min ago.` : `Updated ${ageMin} min ago.`}</Notice>
      )}

      {severe && !muted && <AlertBanner alert={severe} onPress={() => router.push({ pathname: '/alert/[id]', params: { id: `${place.id}|${severe.key}` } })} />}

      <Card onPress={() => router.push('/hourly')} label={t('today.hourly')}>
        <Label>{t('today.next12')}</Label>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {hours.filter((_, i) => i % 2 === 0).map((h, i) => (
            <View key={h.time} style={{ alignItems: 'center', gap: 6, width: 48 }}>
              <Text style={{ fontFamily: font.regular, fontSize: 12, color: T.muted }}>{i === 0 ? t('today.now') : hourLabel(h.time)}</Text>
              <WeatherGlyph glyph={describeCode(h.code, h.isDay).glyph} size={26} />
              <Text style={{ fontFamily: font.bold, fontSize: 15, color: T.text }}>{fmt.temp(h.temp)}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 11, color: T.link }}>{h.pop}%</Text>
            </View>
          ))}
        </View>
      </Card>

      {tips.length > 0 && <AdviceCard tips={tips} />}
      <RainNow f={f} />
      {aq && <AirCard aq={aq} />}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1 }}>
          <Label>{t('today.rain')}</Label>
          <Text style={{ fontFamily: font.bold, fontSize: 30, color: T.text }}>{day.pop}%</Text>
          <Body style={{ fontSize: 13, lineHeight: 18 }}>{day.precip >= 1 ? t('today.rainMm', { n: Math.round(day.precip) }) : t('today.little')}</Body>
        </Card>
        <Card style={{ flex: 1 }}>
          <Label>{t('today.uv')}</Label>
          <Text style={{ fontFamily: font.bold, fontSize: 30, color: T.text }}>{Math.round(day.uvMax)}</Text>
          <Body style={{ fontSize: 13, lineHeight: 18 }}>{day.uvMax >= 8 ? t('today.uvVery') : day.uvMax >= 6 ? t('today.uvHigh') : t('today.uvLow')}</Body>
        </Card>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1 }}>
          <Label>{t('today.wind')}</Label>
          <Text style={{ fontFamily: font.bold, fontSize: 22, color: T.text }}>{fmt.wind(f.current.wind)}</Text>
          <Body style={{ fontSize: 13, lineHeight: 18 }}>{t('today.gusts', { v: fmt.wind(f.current.gust) })}</Body>
        </Card>
        <Card style={{ flex: 1 }}>
          <Label>{t('today.humidity')}</Label>
          <Text style={{ fontFamily: font.bold, fontSize: 22, color: T.text }}>{Math.round(f.current.humidity)}%</Text>
          <Body style={{ fontSize: 13, lineHeight: 18 }}>{t('today.sunset', { t: clock(day.sunset) })}</Body>
        </Card>
      </View>

      <Card>
        <Label>{t('today.tenDay')}</Label>
        {f.daily.map((d) => (
          <View key={d.date} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 }}>
            <Text style={{ width: 52, fontFamily: font.semibold, fontSize: 15, color: T.text }}>{weekday(d.date, f.current.time)}</Text>
            <WeatherGlyph glyph={describeCode(d.code).glyph} size={28} />
            <Text style={{ width: 44, fontFamily: font.medium, fontSize: 13, color: T.link }}>{d.pop}%</Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontFamily: font.regular, fontSize: 15, color: T.muted }}>{fmt.temp(d.min)}</Text>
            <Text style={{ width: 44, textAlign: 'right', fontFamily: font.bold, fontSize: 15, color: T.text }}>{fmt.temp(d.max)}</Text>
          </View>
        ))}
      </Card>
      <SunMoonCard day={day} />
      <Footer />
    </Screen>
  );
}

function Footer() {
  const t = useT();
  const link = { fontFamily: font.semibold, fontSize: 13, color: T.link, padding: 8 } as const;
  return (
    <View style={{ alignItems: 'center', paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Text onPress={() => router.push('/hourly')} accessibilityRole="link" style={link}>{t('today.hourly')}</Text>
        <Text onPress={() => router.push('/share')} accessibilityRole="link" style={link}>{t('today.share')}</Text>
        <Text onPress={() => router.push('/widgets')} accessibilityRole="link" style={link}>{t('today.widgets')}</Text>
      </View>
      <Text style={{ fontFamily: font.regular, fontSize: 11, color: T.muted }}>Forecast data by Open-Meteo.com</Text>
    </View>
  );
}
