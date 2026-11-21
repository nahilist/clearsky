import pg from 'pg';
import { gridKey } from '../../app/src/shared/weather';
import { config } from './config';

import type { Commute, CustomRule, Lang } from '../../app/src/shared/types';

export type Prefs = { severe: boolean; rainSoon: boolean; daily: boolean; quietOn: boolean; quietStart: number; quietEnd: number; air?: boolean; rules?: CustomRule[]; commute?: Commute };
export type Target = { token: string; tz: string; lang: Lang; prefs: Prefs; mutedUntil: number; cell: string; lat: number; lon: number; placeName: string; placeId: string };

// bigint columns come back as strings; epoch milliseconds fit safely in a JS number.
pg.types.setTypeParser(20, (v) => Number(v));

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: config.pgPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
});
pool.on('error', (e) => console.error(JSON.stringify({ level: 'error', msg: 'pg pool error', err: String(e) })));

const MIGRATIONS: { id: number; sql: string }[] = [
  {
    id: 1,
    sql: `
CREATE TABLE devices (
  token TEXT PRIMARY KEY, platform TEXT NOT NULL, tz TEXT NOT NULL,
  prefs JSONB NOT NULL, muted_until BIGINT NOT NULL DEFAULT 0, updated_at BIGINT NOT NULL
);
CREATE TABLE places (
  token TEXT NOT NULL REFERENCES devices(token) ON DELETE CASCADE,
  cell TEXT NOT NULL, lat DOUBLE PRECISION NOT NULL, lon DOUBLE PRECISION NOT NULL, name TEXT NOT NULL,
  PRIMARY KEY (token, cell)
);
CREATE INDEX places_cell ON places(cell);
CREATE TABLE sent (token TEXT NOT NULL, key TEXT NOT NULL, at BIGINT NOT NULL, PRIMARY KEY (token, key));
CREATE INDEX sent_at ON sent(at);
CREATE TABLE tickets (id TEXT PRIMARY KEY, token TEXT NOT NULL, at BIGINT NOT NULL);
CREATE INDEX tickets_at ON tickets(at);`,
  },
  { id: 2, sql: `ALTER TABLE devices ADD COLUMN lang TEXT NOT NULL DEFAULT 'en';` },
];

/** Runs pending migrations. Safe to call from several replicas at once (advisory lock). */
export async function migrate(): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(727001)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (id INT PRIMARY KEY, at BIGINT NOT NULL)');
    const done = new Set((await c.query<{ id: number }>('SELECT id FROM schema_migrations')).rows.map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await c.query('BEGIN');
      try {
        await c.query(m.sql);
        await c.query('INSERT INTO schema_migrations (id, at) VALUES ($1, $2)', [m.id, Date.now()]);
        await c.query('COMMIT');
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await c.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined);
    c.release();
  }
}

export async function ping(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function saveDevice(d: { token: string; platform: string; tz: string; lang: Lang; prefs: Prefs; mutedUntil: number; places: { lat: number; lon: number; name: string }[] }): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(
      `INSERT INTO devices (token, platform, tz, prefs, muted_until, updated_at, lang) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (token) DO UPDATE SET platform=$2, tz=$3, prefs=$4, muted_until=$5, updated_at=$6, lang=$7`,
      [d.token, d.platform, d.tz, JSON.stringify(d.prefs), d.mutedUntil, Date.now(), d.lang],
    );
    await c.query('DELETE FROM places WHERE token = $1', [d.token]);
    const seen = new Map<string, { cell: string; lat: number; lon: number; name: string }>();
    for (const p of d.places) {
      const g = gridKey(p.lat, p.lon);
      if (!seen.has(g.key)) seen.set(g.key, { cell: g.key, lat: p.lat, lon: p.lon, name: p.name.slice(0, 80) });
    }
    const rows = [...seen.values()];
    if (rows.length) {
      await c.query(
        `INSERT INTO places (token, cell, lat, lon, name)
         SELECT $1, * FROM unnest($2::text[], $3::float8[], $4::float8[], $5::text[])`,
        [d.token, rows.map((r) => r.cell), rows.map((r) => r.lat), rows.map((r) => r.lon), rows.map((r) => r.name)],
      );
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

export async function removeDevice(token: string): Promise<boolean> {
  return ((await pool.query('DELETE FROM devices WHERE token = $1', [token])).rowCount ?? 0) > 0;
}

export async function cellsInUse(): Promise<{ cell: string; lat: number; lon: number }[]> {
  return (await pool.query<{ cell: string; lat: number; lon: number }>('SELECT cell, MIN(lat) AS lat, MIN(lon) AS lon FROM places GROUP BY cell')).rows;
}

export async function targetsInCells(cells: string[]): Promise<Target[]> {
  if (!cells.length) return [];
  const { rows } = await pool.query<{ token: string; tz: string; lang: Lang; prefs: Prefs; muted: number; cell: string; lat: number; lon: number; name: string }>(
    `SELECT d.token, d.tz, d.lang, d.prefs, d.muted_until AS muted, p.cell, p.lat, p.lon, p.name
       FROM places p JOIN devices d ON d.token = p.token WHERE p.cell = ANY($1::text[])`,
    [cells],
  );
  return rows.map((r) => ({
    token: r.token,
    tz: r.tz,
    lang: r.lang === 'hi' ? 'hi' : 'en',
    prefs: r.prefs,
    mutedUntil: r.muted,
    cell: r.cell,
    lat: r.lat,
    lon: r.lon,
    placeName: r.name,
    placeId: `${r.lat.toFixed(2)},${r.lon.toFixed(2)}`,
  }));
}

/** Returns the (token, key) pairs that have NOT been sent yet, in one round trip. */
export async function filterUnsent(pairs: { token: string; key: string }[]): Promise<Set<string>> {
  if (!pairs.length) return new Set();
  const { rows } = await pool.query<{ token: string; key: string }>(
    `SELECT t.token, t.key FROM unnest($1::text[], $2::text[]) AS t(token, key)
      WHERE NOT EXISTS (SELECT 1 FROM sent s WHERE s.token = t.token AND s.key = t.key)`,
    [pairs.map((p) => p.token), pairs.map((p) => p.key)],
  );
  return new Set(rows.map((r) => `${r.token}\u0000${r.key}`));
}

export async function markSent(pairs: { token: string; key: string; ticket?: string }[]): Promise<void> {
  if (!pairs.length) return;
  const now = Date.now();
  await pool.query(
    `INSERT INTO sent (token, key, at) SELECT t, k, $3 FROM unnest($1::text[], $2::text[]) AS x(t, k) ON CONFLICT DO NOTHING`,
    [pairs.map((p) => p.token), pairs.map((p) => p.key), now],
  );
  const tix = pairs.filter((p) => p.ticket);
  if (tix.length) {
    await pool.query(
      `INSERT INTO tickets (id, token, at) SELECT i, t, $3 FROM unnest($1::text[], $2::text[]) AS x(i, t) ON CONFLICT DO NOTHING`,
      [tix.map((p) => p.ticket), tix.map((p) => p.token), now],
    );
  }
}

export async function takeTickets(olderThanMs: number, limit: number): Promise<{ id: string; token: string }[]> {
  return (await pool.query<{ id: string; token: string }>('SELECT id, token FROM tickets WHERE at < $1 ORDER BY at LIMIT $2', [Date.now() - olderThanMs, limit])).rows;
}

export async function dropTickets(ids: string[]): Promise<void> {
  if (ids.length) await pool.query('DELETE FROM tickets WHERE id = ANY($1::text[])', [ids]);
}

export async function housekeeping(): Promise<void> {
  const now = Date.now();
  await pool.query('DELETE FROM sent WHERE at < $1', [now - 3 * 24 * 3600_000]);
  await pool.query('DELETE FROM tickets WHERE at < $1', [now - 2 * 24 * 3600_000]);
  // Devices that have not synced in 120 days are treated as uninstalled.
  await pool.query('DELETE FROM devices WHERE updated_at < $1', [now - 120 * 24 * 3600_000]);
}

export async function deviceCount(): Promise<number> {
  return Number((await pool.query<{ n: number }>('SELECT COUNT(*)::bigint AS n FROM devices')).rows[0].n);
}

/**
 * Runs fn only if this process wins a cluster-wide lock. With many API replicas, exactly one
 * runs a given job at a time. The lock is tied to the connection, so a crashed leader frees it.
 */
export async function withLeaderLock<T>(lockId: number, fn: () => Promise<T>): Promise<{ ran: boolean; value?: T }> {
  const c = await pool.connect();
  try {
    const got = (await c.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [lockId])).rows[0].ok;
    if (!got) return { ran: false };
    try {
      return { ran: true, value: await fn() };
    } finally {
      await c.query('SELECT pg_advisory_unlock($1)', [lockId]).catch(() => undefined);
    }
  } finally {
    c.release();
  }
}
