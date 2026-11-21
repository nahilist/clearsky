import { TEXT } from './strings';
import type { AirQuality, Forecast, Lang } from './types';

/** Short, practical tips for today, most important first. Always returns at least one line. */
export function dailyAdvice(f: Forecast, aq: AirQuality | null | undefined, lang: Lang = 'en'): string[] {
  const A = TEXT[lang].advice;
  const d = f.daily[0];
  if (!d) return [A.clear];
  const tips: string[] = [];
  if (aq && aq.aqi >= 151) tips.push(A.mask);
  if (d.pop >= 50 || d.precip >= 2) tips.push(A.umbrella);
  const feelsMax = Math.max(...f.hourly.slice(0, 24).map((h) => h.feels), d.max);
  if (feelsMax >= 38) tips.push(A.water);
  if (d.uvMax >= 6) tips.push(A.sunscreen);
  if (d.max >= 32 && feelsMax < 38) tips.push(A.light);
  if (d.min <= 12) tips.push(A.jacket);
  if (Math.max(...f.hourly.slice(0, 24).map((h) => h.gust), 0) >= 45) tips.push(A.wind);
  return tips.length ? tips.slice(0, 4) : [A.clear];
}

export function briefing(f: Forecast, aq: AirQuality | null | undefined, place: string, lang: Lang = 'en') {
  const B = TEXT[lang].briefing;
  const d = f.daily[0];
  return { title: B.title(place), body: `${B.body(Math.round(d.max), Math.round(d.min), d.pop)} ${dailyAdvice(f, aq, lang)[0]}` };
}
