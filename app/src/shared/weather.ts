import type { AirQuality, Forecast } from './types';

export const OPEN_METEO_PARAMS = {
  current:
    'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,surface_pressure,is_day',
  hourly:
    'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index,is_day',
  daily:
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max,sunrise,sunset',
  minutely_15: 'precipitation',
  forecast_days: '10',
  forecast_hours: '48',
  forecast_minutely_15: '24',
  timezone: 'auto',
} as const;

export function openMeteoQuery(lat: number, lon: number): string {
  const q = new URLSearchParams({ latitude: String(lat), longitude: String(lon) });
  for (const [k, v] of Object.entries(OPEN_METEO_PARAMS)) q.set(k, v);
  return q.toString();
}

type Arr = (number | null)[];
const n = (v: number | null | undefined, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function normalizeOpenMeteo(raw: any, lat: number, lon: number): Forecast {
  const c = raw.current;
  const h = raw.hourly;
  const d = raw.daily;
  const m = raw.minutely_15;
  const hourly = (h.time as string[]).map((time, i) => ({
    time,
    temp: n((h.temperature_2m as Arr)[i]),
    feels: n((h.apparent_temperature as Arr)[i]),
    pop: n((h.precipitation_probability as Arr)[i]),
    precip: n((h.precipitation as Arr)[i]),
    code: n((h.weather_code as Arr)[i]),
    wind: n((h.wind_speed_10m as Arr)[i]),
    gust: n((h.wind_gusts_10m as Arr)[i]),
    uv: n((h.uv_index as Arr)[i]),
    isDay: n((h.is_day as Arr)[i]) === 1,
  }));
  const daily = (d.time as string[]).map((date, i) => ({
    date,
    max: n((d.temperature_2m_max as Arr)[i]),
    min: n((d.temperature_2m_min as Arr)[i]),
    pop: n((d.precipitation_probability_max as Arr)[i]),
    precip: n((d.precipitation_sum as Arr)[i]),
    code: n((d.weather_code as Arr)[i]),
    uvMax: n((d.uv_index_max as Arr)[i]),
    sunrise: (d.sunrise as string[])[i] ?? '',
    sunset: (d.sunset as string[])[i] ?? '',
  }));
  const nowcast = m?.time
    ? (m.time as string[]).map((time, i) => ({ time, precip: n((m.precipitation as Arr)[i]) }))
    : [];
  return {
    lat,
    lon,
    tz: raw.timezone ?? 'UTC',
    fetchedAt: Date.now(),
    current: {
      time: c.time,
      temp: n(c.temperature_2m),
      feels: n(c.apparent_temperature),
      code: n(c.weather_code),
      wind: n(c.wind_speed_10m),
      gust: n(c.wind_gusts_10m),
      humidity: n(c.relative_humidity_2m),
      pressure: n(c.surface_pressure),
      isDay: n(c.is_day) === 1,
    },
    hourly,
    nowcast,
    daily,
  };
}

export type Glyph = 'sun' | 'moon' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

export function describeCode(code: number, isDay = true): { label: string; glyph: Glyph } {
  if (code === 0) return { label: isDay ? 'Clear' : 'Clear night', glyph: isDay ? 'sun' : 'moon' };
  if (code === 1) return { label: 'Mostly clear', glyph: isDay ? 'sun' : 'moon' };
  if (code === 2) return { label: 'Partly cloudy', glyph: 'partly' };
  if (code === 3) return { label: 'Overcast', glyph: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Fog', glyph: 'fog' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', glyph: 'drizzle' };
  if (code >= 61 && code <= 67) return { label: 'Rain', glyph: 'rain' };
  if (code >= 71 && code <= 77) return { label: 'Snow', glyph: 'snow' };
  if (code >= 80 && code <= 82) return { label: 'Showers', glyph: 'rain' };
  if (code === 85 || code === 86) return { label: 'Snow showers', glyph: 'snow' };
  if (code >= 95) return { label: 'Thunderstorm', glyph: 'storm' };
  return { label: 'Cloudy', glyph: 'cloud' };
}

/** Round to a ~11 km grid so nearby users share one cache entry. */
export function gridKey(lat: number, lon: number, step = 0.1): { lat: number; lon: number; key: string } {
  const r = (v: number) => Math.round(v / step) * step;
  const la = Number(r(lat).toFixed(2));
  const lo = Number(r(lon).toFixed(2));
  return { lat: la, lon: lo, key: `${la},${lo}` };
}

export function airQuery(lat: number, lon: number): string {
  const q = new URLSearchParams({ latitude: String(lat), longitude: String(lon), current: 'us_aqi,pm2_5,pm10', timezone: 'auto' });
  return q.toString();
}

export function normalizeAir(raw: any, lat: number, lon: number): AirQuality {
  const c = raw?.current ?? {};
  return { lat, lon, fetchedAt: Date.now(), time: String(c.time ?? ''), aqi: n(c.us_aqi), pm25: n(c.pm2_5), pm10: n(c.pm10) };
}
