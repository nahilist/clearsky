import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import EmbeddedPostgres from 'embedded-postgres';

// Runs against a real, throwaway Postgres (downloaded as an npm binary), not a mock.
const dir = mkdtempSync(join(tmpdir(), 'cs-pg-'));
chmodSync(dir, 0o777); // Postgres refuses to run as root, so the library drops to another user in CI sandboxes
const pgServer = new EmbeddedPostgres({ databaseDir: join(dir, 'data'), user: 'clearsky', password: 'clearsky', port: 54329, persistent: false });
type Db = typeof import('./db');
let db: Db;

const prefs = { severe: true, rainSoon: true, daily: false, quietOn: true, quietStart: 22, quietEnd: 6 };
const tok = (n: number) => `ExponentPushToken[test${String(n).padStart(8, '0')}]`;

before(async () => {
  await pgServer.initialise();
  await pgServer.start();
  await pgServer.createDatabase('clearsky');
  process.env.DATABASE_URL = 'postgres://clearsky:clearsky@localhost:54329/clearsky';
  db = await import('./db');
  await Promise.all([db.migrate(), db.migrate(), db.migrate()]); // replicas booting together
});

after(async () => {
  await db.pool.end();
  await pgServer.stop();
  rmSync(dir, { recursive: true, force: true });
});

test('migrations are idempotent and race-safe', async () => {
  const { rows } = await db.pool.query('SELECT COUNT(*)::int AS n FROM schema_migrations');
  assert.equal(rows[0].n, 2); // migrations 1 and 2
  assert.equal(await db.ping(), true);
});

test('save, update and delete a device (places replaced, cascade on delete)', async () => {
  await db.saveDevice({ token: tok(1), platform: 'ios', lang: 'en', tz: 'Asia/Kolkata', prefs, mutedUntil: 0, places: [{ lat: 19.07, lon: 72.87, name: 'Mumbai' }, { lat: 18.52, lon: 73.85, name: 'Pune' }] });
  assert.equal((await db.cellsInUse()).length, 2);
  await db.saveDevice({ token: tok(1), platform: 'ios', lang: 'en', tz: 'Asia/Kolkata', prefs, mutedUntil: 0, places: [{ lat: 19.07, lon: 72.87, name: 'Mumbai' }] });
  assert.equal((await db.cellsInUse()).length, 1);
  assert.equal(await db.removeDevice(tok(1)), true);
  assert.equal((await db.cellsInUse()).length, 0);
});

test('two places in one grid cell collapse to one row', async () => {
  await db.saveDevice({ token: tok(2), platform: 'android', lang: 'hi', tz: 'UTC', prefs, mutedUntil: 0, places: [{ lat: 19.07, lon: 72.87, name: 'A' }, { lat: 19.06, lon: 72.88, name: 'B' }] });
  const t = await db.targetsInCells(['19.1,72.9']);
  assert.equal(t.length, 1);
  assert.equal(t[0].lang, 'hi'); // saved with lang 'hi' above
  assert.deepEqual(t[0].prefs, prefs);
  await db.removeDevice(tok(2));
});

test('new prefs (rules, commute, air) round-trip through JSONB', async () => {
  const rich = { ...prefs, air: true, rules: [{ id: 'r1', kind: 'wind' as const, threshold: 45, enabled: true }], commute: { enabled: true, placeId: '19.07,72.87', startHour: 8, endHour: 10, days: [1, 2, 3, 4, 5] } };
  await db.saveDevice({ token: tok(9), platform: 'ios', lang: 'en', tz: 'Asia/Kolkata', prefs: rich, mutedUntil: 0, places: [{ lat: 19.07, lon: 72.87, name: 'Mumbai' }] });
  const t = (await db.targetsInCells(['19.1,72.9'])).find((x) => x.token === tok(9));
  assert.deepEqual(t?.prefs, rich);
  assert.equal(t?.placeId, '19.07,72.87');
  await db.removeDevice(tok(9));
});

test('dedupe: filterUnsent and markSent', async () => {
  await db.saveDevice({ token: tok(3), platform: 'ios', lang: 'en', tz: 'UTC', prefs, mutedUntil: 0, places: [] });
  const pairs = [{ token: tok(3), key: 'c:heavy_rain:2026-11-19' }, { token: tok(3), key: 'c:uv:2026-11-19' }];
  assert.equal((await db.filterUnsent(pairs)).size, 2);
  await db.markSent([{ ...pairs[0], ticket: 'tkt-1' }]);
  await db.markSent([{ ...pairs[0] }]); // repeat must not throw
  const left = await db.filterUnsent(pairs);
  assert.equal(left.size, 1);
  assert.ok(left.has(`${tok(3)}\u0000c:uv:2026-11-19`));
  assert.equal((await db.takeTickets(-1000, 10)).length, 1);
  await db.dropTickets(['tkt-1']);
  assert.equal((await db.takeTickets(-1000, 10)).length, 0);
});

test('leader lock: only one concurrent runner wins, lock frees afterwards', async () => {
  let running = 0;
  let maxRunning = 0;
  const job = async () => {
    running++;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((r) => setTimeout(r, 150));
    running--;
    return 'done';
  };
  const results = await Promise.all([1, 2, 3, 4].map(() => db.withLeaderLock(990001, job)));
  assert.equal(results.filter((r) => r.ran).length, 1);
  assert.equal(maxRunning, 1);
  assert.equal((await db.withLeaderLock(990001, job)).ran, true);
});

test('leader lock is released when the job throws', async () => {
  await assert.rejects(db.withLeaderLock(990002, async () => { throw new Error('boom'); }));
  assert.equal((await db.withLeaderLock(990002, async () => 1)).ran, true);
});
