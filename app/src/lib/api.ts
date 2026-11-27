import { airQuery, normalizeAir, normalizeOpenMeteo, openMeteoQuery } from '../shared/weather';
import type { AirQuality, Forecast, Lang } from '../shared/types';
import type { Prefs } from '../store';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

async function getJson<T>(url: string, init?: RequestInit, timeoutMs = 12000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, headers: { Accept: 'application/json', ...init?.headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (__DEV__) console.warn('[API error]', url, err);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Production goes through our caching API. With no API URL set (local dev) it calls Open-Meteo directly. */
export async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  if (API_URL) {
    return getJson<Forecast>(`${API_URL}/v1/forecast?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
  }
  const raw = await getJson<unknown>(`https://api.open-meteo.com/v1/forecast?${openMeteoQuery(lat, lon)}`);
  return normalizeOpenMeteo(raw, lat, lon);
}

export async function fetchAir(lat: number, lon: number): Promise<AirQuality> {
  if (API_URL) return getJson<AirQuality>(`${API_URL}/v1/air?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
  const raw = await getJson<unknown>(`https://air-quality-api.open-meteo.com/v1/air-quality?${airQuery(lat, lon)}`);
  return normalizeAir(raw, lat, lon);
}

export type GeoResult = { id: string; name: string; sub: string; lat: number; lon: number };

export async function geocode(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  type Raw = { results?: { id: number; name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] };
  const url = API_URL
    ? `${API_URL}/v1/geocode?q=${encodeURIComponent(q)}`
    : `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
  const data = await getJson<Raw>(url);
  return (data.results ?? []).map((r) => ({
    id: `${r.latitude.toFixed(2)},${r.longitude.toFixed(2)}`,
    name: r.name,
    sub: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export type DeviceRegistration = {
  token: string;
  platform: 'ios' | 'android';
  tz: string;
  lang: Lang;
  places: { lat: number; lon: number; name: string }[];
  prefs: Prefs;
  mutedUntil: number;
};

export async function registerDevice(reg: DeviceRegistration): Promise<void> {
  if (!API_URL) return;
  await getJson(`${API_URL}/v1/devices`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reg),
  });
}

export async function deleteDevice(token: string): Promise<void> {
  if (!API_URL) return;
  await getJson(`${API_URL}/v1/devices?token=${encodeURIComponent(token)}`, { method: 'DELETE' });
}
