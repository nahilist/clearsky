import { TEXT } from './strings';
import type { Forecast, Lang, Severity, WeatherAlert } from './types';

// Alerts here are derived from forecast data. They are NOT official government warnings.
// Relay official feeds (IMD, NWS, MeteoAlarm) separately and label them with their issuer.

/** Minutes between two local ISO strings without offsets. */
export function minutesBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 60000);
}

export const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
export const max = (xs: number[]) => (xs.length ? Math.max(...xs) : 0);
export const min = (xs: number[]) => (xs.length ? Math.min(...xs) : 0);

export function nextHours(f: Forecast, hours: number) {
  const now = f.current.time.slice(0, 13);
  const start = f.hourly.findIndex((h) => h.time.slice(0, 13) >= now);
  const i = start < 0 ? 0 : start;
  return f.hourly.slice(i, i + hours);
}

export const sev = (v: number, watch: number, warn: number): Severity | null => (v >= warn ? 'warning' : v >= watch ? 'watch' : null);

export function deriveAlerts(f: Forecast, lang: Lang = 'en'): WeatherAlert[] {
  const S = TEXT[lang];
  const out: WeatherAlert[] = [];
  const day = f.current.time.slice(0, 10);
  const h3 = nextHours(f, 3);
  const h12 = nextHours(f, 12);

  // 1. Rain starting soon (first 2 hours of the 15-minute nowcast)
  const near = f.nowcast.slice(0, 8);
  const wetNow = (near[0]?.precip ?? 0) >= 0.1;
  const firstWet = near.findIndex((p) => p.precip >= 0.2);
  if (!wetNow && firstWet > 0) {
    const mins = Math.max(5, minutesBetween(f.current.time, near[firstWet].time));
    out.push({
      key: `rain_soon:${near[firstWet].time.slice(0, 13)}`,
      kind: 'rain_soon',
      severity: 'info',
      title: S.rain_soon.title(mins),
      summary: S.rain_soon.summary(near[firstWet].time.slice(11, 16)),
      startsAt: near[firstWet].time,
      endsAt: near[near.length - 1].time,
      actions: S.rain_soon.actions,
      reason: S.rain_soon.reason,
    });
  }

  // 2. Heavy rain over the next 3 hours
  const rain3 = sum(h3.map((h) => h.precip));
  const rs = sev(rain3, 30, 60);
  if (rs && h3.length) {
    out.push({
      key: `heavy_rain:${day}`,
      kind: 'heavy_rain',
      severity: rs,
      title: rs === 'warning' ? S.heavy_rain.warn : S.heavy_rain.watch,
      summary: S.heavy_rain.summary(Math.round(rain3)),
      startsAt: h3[0].time,
      endsAt: h3[h3.length - 1].time,
      actions: S.heavy_rain.actions,
      reason: S.heavy_rain.reason(Math.round(rain3)),
    });
  }

  // 3. Heat (feels-like)
  const feelsMax = max(h12.map((h) => h.feels));
  const hs = sev(feelsMax, 41, 46);
  if (hs) {
    out.push({
      key: `heat:${day}`,
      kind: 'heat',
      severity: hs,
      title: hs === 'warning' ? S.heat.warn : S.heat.watch,
      summary: S.heat.summary(Math.round(feelsMax)),
      startsAt: h12[0]?.time ?? f.current.time,
      endsAt: h12[h12.length - 1]?.time ?? f.current.time,
      actions: S.heat.actions,
      reason: S.heat.reason,
    });
  }

  // 4. Wind gusts
  const gust = max(h12.map((h) => h.gust));
  const ws = sev(gust, 60, 90);
  if (ws) {
    out.push({
      key: `wind:${day}`,
      kind: 'wind',
      severity: ws,
      title: ws === 'warning' ? S.wind.warn : S.wind.watch,
      summary: S.wind.summary(Math.round(gust)),
      startsAt: h12[0]?.time ?? f.current.time,
      endsAt: h12[h12.length - 1]?.time ?? f.current.time,
      actions: S.wind.actions,
      reason: S.wind.reason,
    });
  }

  // 5. UV today
  const uv = f.daily[0]?.uvMax ?? 0;
  const us = sev(uv, 8, 11);
  if (us) {
    out.push({
      key: `uv:${day}`,
      kind: 'uv',
      severity: us === 'warning' ? 'watch' : 'info',
      title: uv >= 11 ? S.uv.extreme : S.uv.high,
      summary: S.uv.summary(Math.round(uv)),
      startsAt: `${day}T10:00`,
      endsAt: `${day}T15:00`,
      actions: S.uv.actions,
      reason: S.uv.reason,
    });
  }

  // 6. Frost
  const lowest = min(h12.map((h) => h.temp));
  if (h12.length && lowest <= 0) {
    out.push({
      key: `frost:${day}`,
      kind: 'frost',
      severity: 'info',
      title: S.frost.title,
      summary: S.frost.summary(Math.round(lowest)),
      startsAt: h12[0].time,
      endsAt: h12[h12.length - 1].time,
      actions: S.frost.actions,
      reason: S.frost.reason,
    });
  }

  return sortAlerts(out);
}

const rank = { warning: 0, watch: 1, info: 2 } as const;
export const sortAlerts = (xs: WeatherAlert[]) => [...xs].sort((a, b) => rank[a.severity] - rank[b.severity]);
export const isSevere = (a: WeatherAlert) => a.severity !== 'info';
