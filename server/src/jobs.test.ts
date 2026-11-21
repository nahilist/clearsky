import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import EmbeddedPostgres from 'embedded-postgres';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';

// End to end: real Postgres, fake weather + air upstream, stubbed Expo push. Checks what each device receives.
const dir = mkdtempSync(join(tmpdir(), 'cs-jobs-'));
chmodSync(dir, 0o777);
const pgServer = new EmbeddedPostgres({ databaseDir: join(dir, 'data'), user: 'clearsky', password: 'clearsky', port: 54331, persistent: false });
let upstream: http.Server;
let db: typeof import('./db');
let jobs: typeof import('./jobs');
const sent: ExpoPushMessage[] = [];

const tok = (c: string) => `ExponentPushToken[${c.repeat(10)}]`;
const base = { severe: true, rainSoon: true, daily: false, quietOn: false, quietStart: 22, quietEnd: 6 };
const place = [{ lat: 19.07, lon: 72.87, name: 'Mumbai' }];

function forecastJson() {
  const hours = Array.from({ length: 48 }, (_, i) => `2026-11-${19 + Math.floor((15 + i) / 24)}T${String((15 + i) % 24).padStart(2, '0')}:00`);
  const fill = (v: number) => hours.map(() => v);
  return {
    timezone: 'Asia/Kolkata',
    current: { time: '2026-11-19T15:00', temperature_2m: 30, apparent_temperature: 33, weather_code: 3, wind_speed_10m: 20, wind_gusts_10m: 65, relative_humidity_2m: 70, surface_pressure: 1008, is_day: 1 },
    hourly: { time: hours, temperature_2m: fill(30), apparent_temperature: fill(33), precipitation_probability: hours.map((t) => (['17', '18'].includes(t.slice(11, 13)) ? 80 : 10)), precipitation: fill(1), weather_code: fill(3), wind_speed_10m: fill(20), wind_gusts_10m: fill(65), uv_index: fill(3), is_day: fill(1) },
    daily: { time: ['2026-11-19'], weather_code: [3], temperature_2m_max: [33], temperature_2m_min: [26], precipitation_probability_max: [80], precipitation_sum: [24], uv_index_max: [5], sunrise: ['2026-11-19T06:30'], sunset: ['2026-11-19T18:00'] },
    minutely_15: { time: ['2026-11-19T15:00'], precipitation: [0] },
  };
}

before(async () => {
  upstream = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url?.startsWith('/v1/air-quality')) res.end(JSON.stringify({ current: { time: '2026-11-19T15:00', us_aqi: 170, pm2_5: 80, pm10: 120 } }));
    else res.end(JSON.stringify(forecastJson()));
  });
  await new Promise<void>((r) => upstream.listen(9191, r));
  await pgServer.initialise();
  await pgServer.start();
  await pgServer.createDatabase('clearsky');
  Object.assign(process.env, { DATABASE_URL: 'postgres://clearsky:clearsky@localhost:54331/clearsky', OPEN_METEO_BASE: 'http://localhost:9191', AIR_BASE: 'http://localhost:9191' });
  Expo.prototype.sendPushNotificationsAsync = async function (msgs: ExpoPushMessage[]) {
    sent.push(...msgs);
    return msgs.map((_m, i) => ({ status: 'ok' as const, id: `t-${sent.length}-${i}` }));
  };
  db = await import('./db');
  jobs = await import('./jobs');
  await db.migrate();

  const rules = [{ id: 'r1', kind: 'rain' as const, threshold: 2, enabled: true }];
  const commute = { enabled: true, placeId: '19.07,72.87', startHour: 17, endHour: 19, days: [4] };
  await db.saveDevice({ token: tok('a'), platform: 'ios', lang: 'en', tz: 'Asia/Kolkata', prefs: { ...base, air: true, rules, commute }, mutedUntil: 0, places: place });
  await db.saveDevice({ token: tok('b'), platform: 'ios', lang: 'hi', tz: 'Asia/Kolkata', prefs: { ...base, quietOn: true, quietStart: 0, quietEnd: 24, air: true, rules, commute }, mutedUntil: 0, places: place });
  await db.saveDevice({ token: tok('c'), platform: 'android', lang: 'en', tz: 'Asia/Kolkata', prefs: { ...base, severe: false, air: true }, mutedUntil: 0, places: place });
  await db.saveDevice({ token: tok('d'), platform: 'android', lang: 'en', tz: 'Asia/Kolkata', prefs: { ...base, air: false }, mutedUntil: 0, places: place });
});

after(async () => {
  upstream.close();
  await db.pool.end();
  await pgServer.stop();
  rmSync(dir, { recursive: true, force: true });
});

const to = (c: string) => sent.filter((m) => m.to === tok(c));
const kinds = (c: string) => to(c).map((m) => String((m.data as { alertId: string }).alertId.split('|')[1]).split(':')[0]).sort();

test('each device gets exactly the alerts it asked for', async () => {
  const r = await jobs.runAlertJob();
  assert.equal(r.ran, true);
  assert.deepEqual(kinds('a'), ['air', 'commute', 'custom', 'wind']); // everything
  assert.deepEqual(kinds('b'), ['air', 'wind']); // all-day quiet hours: safety alerts pass, user-set ones are held back
  assert.deepEqual(kinds('c'), []); // severe alerts off
  assert.deepEqual(kinds('d'), ['commute'].filter(() => false).concat(['wind'])); // air off, no rules or commute
});

test('push text is in the device language', () => {
  assert.match(String(to('a').find((m) => String(m.title).includes('wind') || String(m.title).includes('Strong'))?.title), /Strong wind gusts/);
  const hi = to('b').map((m) => String(m.title));
  assert.ok(hi.every((t) => /[ऀ-ॿ]/.test(t)), `hindi titles: ${hi.join(' | ')}`);
  assert.ok(to('a').some((m) => String(m.title).startsWith('Mumbai:')));
});

test('data carries an alertId the app can open, and channels are set', () => {
  for (const m of to('a')) assert.match(String((m.data as { alertId: string }).alertId), /^19\.07,72\.87\|/);
  assert.ok(to('a').every((m) => m.channelId === 'severe'));
});

test('second run sends nothing new (deduplicated)', async () => {
  const before = sent.length;
  await jobs.runAlertJob();
  assert.equal(sent.length, before);
});

test('daily briefing is localised and includes advice', async () => {
  await db.saveDevice({ token: tok('e'), platform: 'ios', lang: 'hi', tz: 'UTC', prefs: { ...base, severe: false, rainSoon: false, daily: true, quietOn: false, air: true }, mutedUntil: 0, places: place });
  // The briefing is only sent 07:30-07:59 local time, so check the builder directly.
  const { briefing } = await import('../../app/src/shared/advice');
  const f = (await import('../../app/src/shared/weather')).normalizeOpenMeteo(forecastJson(), 19, 72);
  const b = briefing(f, { lat: 0, lon: 0, fetchedAt: 0, time: '', aqi: 170, pm25: 0, pm10: 0 }, 'Mumbai', 'hi');
  assert.match(b.title, /मुंबई|Mumbai/);
  assert.match(b.body, /अधिकतम 33°/);
  assert.match(b.body, /मास्क/); // AQI 170 puts the mask tip first
});
