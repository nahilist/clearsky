// Manual scale check: DATABASE_URL=... DEVICES=200000 npx tsx src/scale.ts
import { cellsInUse, filterUnsent, markSent, migrate, pool, targetsInCells } from './db';

const N = Number(process.env.DEVICES ?? 200000);
const t0 = Date.now();
const lap = (l: string, since: number) => console.log(`${l}: ${Date.now() - since} ms`);

await migrate();
await pool.query('TRUNCATE devices CASCADE; TRUNCATE sent');
// 200k devices, 2 places each, spread over ~4,000 grid cells (a large country's worth of cities)
const s = Date.now();
await pool.query(
  `INSERT INTO devices (token, platform, tz, prefs, muted_until, updated_at)
   SELECT 'ExponentPushToken[' || g || ']', 'ios', 'Asia/Kolkata',
          '{"severe":true,"rainSoon":true,"daily":false,"quietOn":true,"quietStart":22,"quietEnd":6}', 0, 0 FROM generate_series(1, $1) g`, [N]);
await pool.query(
  `INSERT INTO places (token, cell, lat, lon, name)
   SELECT 'ExponentPushToken[' || g || ']', (8 + (c % 60) * 0.1)::numeric(5,1) || ',' || (68 + (c / 60) * 0.1)::numeric(5,1), 8 + (c % 60) * 0.1, 68 + (c / 60) * 0.1, 'Place'
   FROM generate_series(1, $1) g, LATERAL (SELECT ((g * 7919 + k * 104729) % 4000) AS c FROM generate_series(1,2) k) x
   ON CONFLICT DO NOTHING`, [N]);
lap(`seed ${N} devices`, s);
console.log('places:', (await pool.query('SELECT COUNT(*) FROM places')).rows[0].count);

let t = Date.now();
const cells = await cellsInUse();
lap(`cellsInUse (${cells.length} cells)`, t);

t = Date.now();
let targets = 0;
for (let i = 0; i < cells.length; i += 300) targets += (await targetsInCells(cells.slice(i, i + 300).map((c) => c.cell))).length;
lap(`targetsInCells for all cells in batches of 300 (${targets} rows)`, t);

const pairs = Array.from({ length: 5000 }, (_, i) => ({ token: `ExponentPushToken[${i + 1}]`, key: `c:heavy_rain:2026-11-19` }));
t = Date.now();
const fresh = await filterUnsent(pairs);
lap(`filterUnsent 5000 pairs (${fresh.size} fresh)`, t);
t = Date.now();
await markSent(pairs.map((p) => ({ ...p, ticket: `tk-${p.token}` })));
lap('markSent 5000', t);

// concurrent registrations: 50 parallel PUT /v1/devices equivalents
const { saveDevice } = await import('./db');
t = Date.now();
await Promise.all(Array.from({ length: 500 }, (_, i) => saveDevice({ token: `ExponentPushToken[new${i}]`, platform: 'android', lang: 'en', tz: 'UTC', prefs: { severe: true, rainSoon: true, daily: false, quietOn: true, quietStart: 22, quietEnd: 6 }, mutedUntil: 0, places: [{ lat: 19.07 + (i % 9) * 0.1, lon: 72.87, name: 'M' }] })));
lap('500 concurrent device registrations', t);
lap('total', t0);
await pool.end();
