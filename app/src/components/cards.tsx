import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { clock } from '../lib/format';
import { aqiBand, aqiCategory } from '../shared/air';
import { moonPhase, sunTimes } from '../shared/sun';
import type { AirQuality, Day, Forecast } from '../shared/types';
import { useStore } from '../store';
import { useT } from '../i18n';
import { font, T } from '../theme';
import { BarChart } from './Charts';
import { Body, Card, Label } from './ui';

export function AirCard({ aq }: { aq: AirQuality }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const band = aqiBand(aq.aqi);
  const aqi = Math.round(aq.aqi);
  return (
    <Card>
      <Label>{t('air.title')}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ minWidth: 72, height: 72, borderRadius: 36, backgroundColor: band.color, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={{ fontFamily: font.heavy, fontSize: 28, color: '#0B1B3A' }} accessibilityLabel={`AQI ${aqi}`}>{aqi}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 17, color: T.text }}>{aqiCategory(aq.aqi, lang)}</Text>
          <Body style={{ fontSize: 13, lineHeight: 18 }}>{t('air.pm25', { v: Math.round(aq.pm25) })}</Body>
          <Body style={{ fontSize: 12, lineHeight: 16 }}>{t('air.scale')}</Body>
        </View>
      </View>
    </Card>
  );
}

export function AdviceCard({ tips }: { tips: string[] }) {
  const t = useT();
  return (
    <Card>
      <Label>{t('today.advice')}</Label>
      {tips.map((tip) => (
        <View key={tip} style={{ flexDirection: 'row', gap: 10 }}>
          <Text style={{ color: T.ok, fontFamily: font.heavy, fontSize: 15 }}>•</Text>
          <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 15, lineHeight: 22, color: T.text }}>{tip}</Text>
        </View>
      ))}
    </Card>
  );
}

/** 15-minute rain bars. Two hours are free; six hours is a Pro feature. */
export function RainNow({ f }: { f: Forecast }) {
  const t = useT();
  const isPro = useStore((s) => s.isPro);
  const steps = f.nowcast.slice(0, isPro ? 24 : 8);
  if (steps.length < 2) return null;
  const vals = steps.map((s) => s.precip);
  const peak = Math.max(...vals);
  const dry = peak < 0.1;
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Label>{t('rainnow.title')}</Label>
        <Text style={{ fontFamily: font.semibold, fontSize: 12, color: T.muted }}>{isPro ? t('rainnow.h6') : t('rainnow.h2')}</Text>
      </View>
      {dry ? (
        <Body>{t('rainnow.none')}</Body>
      ) : (
        <>
          <BarChart values={vals} labels={steps.map((s) => s.time.slice(11, 16))} height={110} unit="" labelEvery={isPro ? 8 : 2} />
          <Body style={{ fontSize: 13, lineHeight: 18 }}>{t('rainnow.peak', { v: Math.round(peak * 10) / 10 })}</Body>
        </>
      )}
      {!isPro && (
        <Pressable accessibilityRole="link" onPress={() => router.push('/pro')} style={{ minHeight: 40, justifyContent: 'center' }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 13, color: T.link }}>{t('rainnow.pro')}</Text>
        </Pressable>
      )}
    </Card>
  );
}

function SunMoonRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ fontFamily: font.regular, fontSize: 14, color: T.muted }}>{k}</Text>
      <Text style={{ fontFamily: font.semibold, fontSize: 14, color: T.text, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );
}

export function SunMoonCard({ day }: { day: Day }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const sun = sunTimes(day.sunrise, day.sunset);
  const moon = moonPhase(day.date, lang);
  return (
    <Card>
      <Label>{t('sun.title')}</Label>
      <SunMoonRow k={t('sun.rise')} v={clock(day.sunrise)} />
      <SunMoonRow k={t('sun.set')} v={clock(day.sunset)} />
      <SunMoonRow k={t('sun.daylight')} v={sun.daylight} />
      <SunMoonRow k={`${t('sun.golden')} (AM)`} v={sun.morningGolden} />
      <SunMoonRow k={`${t('sun.golden')} (PM)`} v={sun.eveningGolden} />
      <SunMoonRow k={t('sun.moon')} v={`${moon.name} · ${t('sun.lit', { n: Math.round(moon.illumination * 100) })}`} />
    </Card>
  );
}
