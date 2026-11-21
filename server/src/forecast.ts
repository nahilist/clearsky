import { LRUCache } from 'lru-cache';
import { airQuery, gridKey, normalizeAir, normalizeOpenMeteo, openMeteoQuery } from '../../app/src/shared/weather';
import type { AirQuality, Forecast } from '../../app/src/shared/types';
import { config } from './config';

type Entry = { value: Forecast; at: number };

const cache = new LRUCache<string, Entry>({ max: config.cacheMax });
const inflight = new Map<string, Promise<Forecast>>();

export const stats = { hits: 0, misses: 0, stale: 0, upstreamErrors: 0, upstreamCalls: 0 };

async function upstream(lat: number, lon: number): Promise<Forecast> {
  const key = config.openMeteoKey ? `&apikey=${encodeURIComponent(config.openMeteoKey)}` : '';
  const url = `${config.openMeteoBase}/v1/forecast?${openMeteoQuery(lat, lon)}${key}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10_000);
  stats.upstreamCalls++;
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    return normalizeOpenMeteo(await res.json(), lat, lon);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Forecast for the ~11 km grid cell around (lat, lon).
 * - fresh cache hit: no upstream call
 * - concurrent misses for one cell share a single upstream request
 * - upstream failure: serve stale data for up to STALE_MAX instead of failing
 */
export async function getForecast(lat: number, lon: number): Promise<{ forecast: Forecast; stale: boolean }> {
  const cell = gridKey(lat, lon);
  const hit = cache.get(cell.key);
  const now = Date.now();
  if (hit && now - hit.at < config.cacheTtlMs) {
    stats.hits++;
    return { forecast: hit.value, stale: false };
  }
  stats.misses++;
  let p = inflight.get(cell.key);
  if (!p) {
    p = upstream(cell.lat, cell.lon)
      .then((f) => {
        cache.set(cell.key, { value: f, at: Date.now() });
        return f;
      })
      .finally(() => inflight.delete(cell.key));
    inflight.set(cell.key, p);
  }
  try {
    return { forecast: await p, stale: false };
  } catch (e) {
    stats.upstreamErrors++;
    if (hit && now - hit.at < config.staleMaxMs) {
      stats.stale++;
      return { forecast: hit.value, stale: true };
    }
    throw e;
  }
}

export const cacheSize = () => cache.size;

export async function geocode(q: string): Promise<unknown> {
  const url = `${config.geocodeBase}/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`geocode ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Small cache so repeated searches ("mum", "mumb", "mumba") do not hit upstream every time.
const geoCache = new LRUCache<string, { v: unknown; at: number }>({ max: 5000 });
export async function geocodeCached(q: string): Promise<unknown> {
  const k = q.trim().toLowerCase();
  const hit = geoCache.get(k);
  if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.v;
  const v = await geocode(k);
  geoCache.set(k, { v, at: Date.now() });
  return v;
}

// Air quality changes slowly, so it is cached longer than the forecast and fetched on demand.
const airCache = new LRUCache<string, { value: AirQuality; at: number }>({ max: config.cacheMax });
const airInflight = new Map<string, Promise<AirQuality>>();
const AIR_TTL = 30 * 60_000;

export async function getAir(lat: number, lon: number): Promise<AirQuality> {
  const cell = gridKey(lat, lon);
  const hit = airCache.get(cell.key);
  if (hit && Date.now() - hit.at < AIR_TTL) return hit.value;
  let p = airInflight.get(cell.key);
  if (!p) {
    p = (async () => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 10_000);
      try {
        const res = await fetch(`${config.airBase}/v1/air-quality?${airQuery(cell.lat, cell.lon)}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(`air ${res.status}`);
        const v = normalizeAir(await res.json(), cell.lat, cell.lon);
        airCache.set(cell.key, { value: v, at: Date.now() });
        return v;
      } finally {
        clearTimeout(timer);
      }
    })().finally(() => airInflight.delete(cell.key));
    airInflight.set(cell.key, p);
  }
  try {
    return await p;
  } catch (e) {
    if (hit && Date.now() - hit.at < config.staleMaxMs) return hit.value;
    throw e;
  }
}
