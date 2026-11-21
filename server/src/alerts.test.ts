import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveAlerts } from '../../app/src/shared/alerts';
import type { Forecast } from '../../app/src/shared/types';
import { gridKey, normalizeOpenMeteo } from '../../app/src/shared/weather';

function base(over: Partial<{ precip: number; feels: number; gust: number; temp: number; uv: number; nowcast: number[] }> = {}): Forecast {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    time: `2026-11-19T${String(i % 24).padStart(2, '0')}:00`,
    temp: over.temp ?? 28,
    feels: over.feels ?? 30,
    pop: 20,
    precip: over.precip ?? 0,
    code: 1,
    wind: 10,
    gust: over.gust ?? 20,
    uv: 3,
    isDay: true,
  }));
  return {
    lat: 19,
    lon: 72,
    tz: 'Asia/Kolkata',
    fetchedAt: 0,
    current: { time: '2026-11-19T10:00', temp: 28, feels: 30, code: 1, wind: 10, gust: 20, humidity: 60, pressure: 1010, isDay: true },
    hourly,
    nowcast: (over.nowcast ?? [0, 0, 0, 0, 0, 0, 0, 0]).map((precip, i) => ({ time: `2026-11-19T10:${String(i * 15 % 60).padStart(2, '0')}`.replace(/T10:(\d\d)$/, (_m, mm) => `T${String(10 + Math.floor((i * 15) / 60))}:${mm}`), precip })),
    daily: [{ date: '2026-11-19', max: 30, min: 24, pop: 20, precip: 0, code: 1, uvMax: over.uv ?? 4, sunrise: '2026-11-19T06:30', sunset: '2026-11-19T18:00' }],
  };
}

test('calm day has no alerts', () => {
  assert.deepEqual(deriveAlerts(base()), []);
});

test('36 mm in 3 h is a watch, 72 mm is a warning', () => {
  assert.equal(deriveAlerts(base({ precip: 12 })).find((a) => a.kind === 'heavy_rain')?.severity, 'watch');
  assert.equal(deriveAlerts(base({ precip: 24 })).find((a) => a.kind === 'heavy_rain')?.severity, 'warning');
});

test('rain soon fires only when it is dry now and wet later', () => {
  const soon = deriveAlerts(base({ nowcast: [0, 0, 0.5, 1, 1, 1, 1, 1] })).find((a) => a.kind === 'rain_soon');
  assert.ok(soon);
  assert.match(soon.title, /Rain in about \d+ min/);
  assert.equal(deriveAlerts(base({ nowcast: [1, 1, 1, 1, 1, 1, 1, 1] })).some((a) => a.kind === 'rain_soon'), false);
});

test('heat, wind and UV thresholds', () => {
  assert.equal(deriveAlerts(base({ feels: 43 })).find((a) => a.kind === 'heat')?.severity, 'watch');
  assert.equal(deriveAlerts(base({ feels: 47 })).find((a) => a.kind === 'heat')?.severity, 'warning');
  assert.equal(deriveAlerts(base({ gust: 65 })).find((a) => a.kind === 'wind')?.severity, 'watch');
  assert.ok(deriveAlerts(base({ uv: 9 })).some((a) => a.kind === 'uv'));
});

test('alerts are sorted most severe first', () => {
  const a = deriveAlerts(base({ precip: 24, uv: 9 }));
  assert.equal(a[0].severity, 'warning');
});

test('nearby coordinates share a grid cell', () => {
  assert.equal(gridKey(19.0712, 72.8741).key, gridKey(19.0612, 72.8512).key);
  assert.notEqual(gridKey(19.07, 72.87).key, gridKey(19.27, 72.87).key);
});

test('normalizer tolerates null values from upstream', () => {
  const raw = {
    timezone: 'UTC',
    current: { time: '2026-11-19T10:00', temperature_2m: null, weather_code: 0, is_day: 1 },
    hourly: { time: ['2026-11-19T10:00'], temperature_2m: [null], apparent_temperature: [null], precipitation_probability: [null], precipitation: [null], weather_code: [0], wind_speed_10m: [null], wind_gusts_10m: [null], uv_index: [null], is_day: [1] },
    daily: { time: ['2026-11-19'], weather_code: [0], temperature_2m_max: [null], temperature_2m_min: [null], precipitation_probability_max: [null], precipitation_sum: [null], uv_index_max: [null], sunrise: ['x'], sunset: ['y'] },
  };
  const f = normalizeOpenMeteo(raw, 1, 2);
  assert.equal(f.current.temp, 0);
  assert.equal(f.hourly[0].precip, 0);
  assert.deepEqual(f.nowcast, []);
});
