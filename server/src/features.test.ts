import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveAlerts } from '../../app/src/shared/alerts';
import { dailyAdvice } from '../../app/src/shared/advice';
import { aqiBand, aqiCategory, airAlert } from '../../app/src/shared/air';
import { deriveCommuteAlert, deriveCustomAlerts } from '../../app/src/shared/rules';
import { moonPhase, sunTimes } from '../../app/src/shared/sun';
import type { AirQuality, Commute, Forecast } from '../../app/src/shared/types';

// 2026-11-19 is a Thursday (getUTCDay() = 4).
function fc(over: { hour?: number; precip?: number; pop?: number; feels?: number; temp?: number; gust?: number; uv?: number; max?: number; min?: number } = {}): Forecast {
  const start = over.hour ?? 10;
  const hourly = Array.from({ length: 48 }, (_, i) => {
    const h = (start + i) % 24;
    const dayOffset = Math.floor((start + i) / 24);
    return {
      time: `2026-11-${19 + dayOffset}T${String(h).padStart(2, '0')}:00`,
      temp: over.temp ?? 28, feels: over.feels ?? 30, pop: over.pop ?? 10, precip: over.precip ?? 0, code: 1, wind: 10, gust: over.gust ?? 20, uv: 3, isDay: true,
    };
  });
  return {
    lat: 19, lon: 72, tz: 'Asia/Kolkata', fetchedAt: 0,
    current: { time: `2026-11-19T${String(start).padStart(2, '0')}:00`, temp: 28, feels: 30, code: 1, wind: 10, gust: 20, humidity: 60, pressure: 1010, isDay: true },
    hourly, nowcast: [],
    daily: [{ date: '2026-11-19', max: over.max ?? 30, min: over.min ?? 24, pop: over.pop ?? 10, precip: (over.precip ?? 0) * 3, code: 1, uvMax: over.uv ?? 4, sunrise: '2026-11-19T06:30', sunset: '2026-11-19T18:00' }],
  };
}
const aq = (aqi: number): AirQuality => ({ lat: 0, lon: 0, fetchedAt: 0, time: '2026-11-19T10:00', aqi, pm25: 0, pm10: 0 });

test('custom rules fire only when enabled and over the threshold', () => {
  const rules = [{ id: 'a', kind: 'wind' as const, threshold: 40, enabled: true }, { id: 'b', kind: 'wind' as const, threshold: 40, enabled: false }];
  assert.equal(deriveCustomAlerts(fc({ gust: 50 }), rules).length, 1);
  assert.equal(deriveCustomAlerts(fc({ gust: 30 }), rules).length, 0);
  assert.equal(deriveCustomAlerts(fc({ temp: 5 }), [{ id: 'c', kind: 'cold', threshold: 8, enabled: true }]).length, 1);
  assert.equal(deriveCustomAlerts(fc({ precip: 4 }), [{ id: 'd', kind: 'rain', threshold: 10, enabled: true }]).length, 1);
  assert.match(deriveCustomAlerts(fc({ gust: 50 }), rules)[0].key, /^custom:a:2026-11-19$/);
});

test('commute alert: right day, inside the lead window, rain likely', () => {
  const c: Commute = { enabled: true, placeId: 'x', startHour: 17, endHour: 19, days: [4] };
  assert.ok(deriveCommuteAlert(fc({ hour: 15, pop: 80 }), c)); // 2 h before
  assert.equal(deriveCommuteAlert(fc({ hour: 10, pop: 80 }), c), null); // too early
  assert.equal(deriveCommuteAlert(fc({ hour: 20, pop: 80 }), c), null); // window over
  assert.equal(deriveCommuteAlert(fc({ hour: 15, pop: 80 }), { ...c, days: [1, 2] }), null); // not a commute day
  assert.equal(deriveCommuteAlert(fc({ hour: 15, pop: 10 }), c), null); // dry
  assert.equal(deriveCommuteAlert(fc({ hour: 15, pop: 80 }), { ...c, enabled: false }), null);
});

test('air quality bands and alerts', () => {
  assert.equal(aqiBand(40).index, 0);
  assert.equal(aqiBand(155).index, 3);
  assert.equal(aqiBand(420).index, 5);
  assert.equal(airAlert(aq(120)), null);
  assert.equal(airAlert(aq(170))?.severity, 'watch');
  assert.equal(airAlert(aq(260))?.severity, 'warning');
  assert.equal(aqiCategory(170, 'hi'), 'खराब');
});

test('advice is practical and never empty', () => {
  assert.deepEqual(dailyAdvice(fc(), null), ['A pleasant day, no special precautions.']);
  const wet = dailyAdvice(fc({ pop: 80, precip: 2, uv: 9, max: 34 }), aq(180));
  assert.equal(wet[0], 'Air is poor, consider a mask outdoors.');
  assert.ok(wet.includes('Carry an umbrella.'));
  assert.ok(wet.length <= 4);
});

test('hindi alerts use the same keys and different text', () => {
  const f = fc({ precip: 12 });
  const en = deriveAlerts(f, 'en');
  const hi = deriveAlerts(f, 'hi');
  assert.deepEqual(en.map((a) => a.key), hi.map((a) => a.key));
  assert.notEqual(en[0].title, hi[0].title);
  assert.match(hi[0].title, /[ऀ-ॿ]/);
});

test('moon phase is right on known dates and sun times add up', () => {
  assert.equal(moonPhase('2000-01-06').name, 'New moon');
  assert.equal(moonPhase('2026-11-24', 'en').name, 'Full moon'); // full moon 24 Nov 2026
  assert.equal(moonPhase('2026-12-09', 'en').name, 'New moon'); // new moon 9 Dec 2026
  assert.ok(moonPhase('2026-11-24').illumination > 0.95);
  const s = sunTimes('2026-11-19T06:30', '2026-11-19T18:00');
  assert.equal(s.daylight, '11 h 30 min');
  assert.equal(s.eveningGolden, '17:00 to 18:00');
});
