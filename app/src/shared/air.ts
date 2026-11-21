import { TEXT } from './strings';
import type { AirQuality, Lang, WeatherAlert } from './types';

/** US AQI bands. Open-Meteo reports the US scale; India's NAQI uses different breakpoints. */
export function aqiBand(aqi: number): { index: number; color: string } {
  if (aqi <= 50) return { index: 0, color: '#34C98B' };
  if (aqi <= 100) return { index: 1, color: '#F5B83D' };
  if (aqi <= 150) return { index: 2, color: '#F28C28' };
  if (aqi <= 200) return { index: 3, color: '#E5484D' };
  if (aqi <= 300) return { index: 4, color: '#A855F7' };
  return { index: 5, color: '#9F1239' };
}

export const aqiCategory = (aqi: number, lang: Lang = 'en') => TEXT[lang].air.cats[aqiBand(aqi).index];

export function airAlert(aq: AirQuality, lang: Lang = 'en'): WeatherAlert | null {
  if (aq.aqi < 151) return null;
  const S = TEXT[lang].air;
  const day = aq.time.slice(0, 10);
  const aqi = Math.round(aq.aqi);
  return {
    key: `air:${day}:${aqi >= 201 ? 'hazard' : 'bad'}`,
    kind: 'air',
    severity: aqi >= 201 ? 'warning' : 'watch',
    title: aqi >= 201 ? S.hazardous : S.unhealthy,
    summary: S.summary(aqi, aqiCategory(aqi, lang)),
    startsAt: aq.time,
    endsAt: aq.time,
    actions: S.actions,
    reason: S.reason,
  };
}
