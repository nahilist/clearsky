import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { briefing } from '../../app/src/shared/advice';
import { deriveAlerts, sortAlerts } from '../../app/src/shared/alerts';
import { airAlert } from '../../app/src/shared/air';
import { deriveCommuteAlert, deriveCustomAlerts } from '../../app/src/shared/rules';
import type { AirQuality, WeatherAlert } from '../../app/src/shared/types';
import { config } from './config';
import { cellsInUse, dropTickets, filterUnsent, housekeeping, markSent, removeDevice, takeTickets, targetsInCells, withLeaderLock } from './db';
import { getAir, getForecast } from './forecast';

const expo = new Expo({ accessToken: config.expoAccessToken });
const log = (level: 'info' | 'error', msg: string, extra?: object) => console.log(JSON.stringify({ level, msg, ...extra, t: new Date().toISOString() }));

const LOCK_ALERTS = 727101;
const LOCK_RECEIPTS = 727102;
const LOCK_HOUSEKEEPING = 727103;
const CELL_BATCH = 300;

export function localParts(tz: string, now = new Date()): { hour: number; minute: number; date: string } {
  try {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
    return { hour: Number(p.hour) % 24, minute: Number(p.minute), date: `${p.year}-${p.month}-${p.day}` };
  } catch {
    return { hour: now.getUTCHours(), minute: now.getUTCMinutes(), date: now.toISOString().slice(0, 10) };
  }
}

export const inQuiet = (hour: number, start: number, end: number) => (start === end ? false : start < end ? hour >= start && hour < end : hour >= start || hour < end);
const channelFor = (a: WeatherAlert) => (a.kind === 'rain_soon' ? 'rain' : 'severe');
// Alerts the user configured themselves respect quiet hours; official-style safety alerts do not.
const USER_SET = new Set(['custom', 'commute']);

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

type Msg = ExpoPushMessage & { _token: string; _key: string };

async function processBatch(cells: { cell: string; lat: number; lon: number }[]): Promise<number> {
  const forecasts = new Map<string, Awaited<ReturnType<typeof getForecast>>['forecast']>();
  await mapLimit(cells, config.alertConcurrency, async (c) => {
    try {
      forecasts.set(c.cell, (await getForecast(c.lat, c.lon)).forecast);
    } catch (e) {
      log('error', 'forecast failed', { cell: c.cell, err: String(e) });
    }
  });

  const targets = await targetsInCells(cells.map((c) => c.cell));

  // Air quality is only fetched for cells where at least one device wants it.
  const airCells = [...new Set(targets.filter((t) => t.prefs.air !== false && (t.prefs.severe || t.prefs.daily)).map((t) => t.cell))];
  const airByCell = new Map<string, AirQuality>();
  const byCell = new Map(cells.map((c) => [c.cell, c]));
  await mapLimit(airCells, config.alertConcurrency, async (cell) => {
    const c = byCell.get(cell);
    if (!c) return;
    try {
      airByCell.set(cell, await getAir(c.lat, c.lon));
    } catch {
      // Air data is optional; skip this cell for this tick.
    }
  });

  const candidates: Msg[] = [];
  for (const t of targets) {
    const f = forecasts.get(t.cell);
    if (!f || !Expo.isExpoPushToken(t.token)) continue;
    const aq = t.prefs.air !== false ? airByCell.get(t.cell) : undefined;
    const local = localParts(t.tz);
    const muted = t.mutedUntil > Date.now();
    const quiet = t.prefs.quietOn && inQuiet(local.hour, t.prefs.quietStart, t.prefs.quietEnd);

    const all = [...deriveAlerts(f, t.lang)];
    if (t.prefs.rules?.length) all.push(...deriveCustomAlerts(f, t.prefs.rules, t.lang));
    if (t.prefs.commute?.enabled && t.prefs.commute.placeId === t.placeId) {
      const c = deriveCommuteAlert(f, t.prefs.commute, t.lang);
      if (c) all.push(c);
    }
    const air = aq ? airAlert(aq, t.lang) : null;
    if (air) all.push(air);

    for (const a of sortAlerts(all)) {
      const severe = a.severity !== 'info';
      const wanted = severe ? t.prefs.severe : a.kind === 'rain_soon' ? t.prefs.rainSoon : false;
      const passesQuiet = severe && !USER_SET.has(a.kind); // severe safety alerts always pass quiet hours and mute
      if (!wanted || (!passesQuiet && (quiet || muted))) continue;
      candidates.push({
        to: t.token,
        title: `${t.placeName}: ${a.title}`,
        body: a.summary,
        sound: severe ? 'default' : null,
        priority: severe ? 'high' : 'default',
        channelId: channelFor(a),
        data: { alertId: `${t.placeId}|${a.key}` },
        _token: t.token,
        _key: `${t.cell}:${a.key}`,
      });
    }
    const day = f.daily[0];
    if (t.prefs.daily && day && local.hour === 7 && local.minute >= 30) {
      const b = briefing(f, aq, t.placeName, t.lang);
      candidates.push({
        to: t.token,
        title: b.title,
        body: b.body,
        sound: null,
        channelId: 'daily',
        _token: t.token,
        _key: `${t.cell}:daily:${local.date}`,
      });
    }
  }

  const fresh = await filterUnsent(candidates.map((m) => ({ token: m._token, key: m._key })));
  const messages = candidates.filter((m) => fresh.has(`${m._token}\u0000${m._key}`));

  let queued = 0;
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      const sent: { token: string; key: string; ticket?: string }[] = [];
      for (let i = 0; i < tickets.length; i++) {
        const t = tickets[i];
        const m = chunk[i] as Msg;
        if (t.status === 'ok') sent.push({ token: m._token, key: m._key, ticket: t.id });
        else if (t.details?.error === 'DeviceNotRegistered') await removeDevice(m._token);
        else log('error', 'ticket error', { err: t.message });
      }
      await markSent(sent);
      queued += sent.length;
    } catch (e) {
      log('error', 'push chunk failed', { err: String(e) });
    }
  }
  return queued;
}

export async function runAlertJob(): Promise<{ ran: boolean; cells: number; queued: number }> {
  const r = await withLeaderLock(LOCK_ALERTS, async () => {
    const cells = await cellsInUse();
    let queued = 0;
    for (let i = 0; i < cells.length; i += CELL_BATCH) queued += await processBatch(cells.slice(i, i + CELL_BATCH));
    log('info', 'alert job done', { cells: cells.length, queued });
    return { cells: cells.length, queued };
  });
  return { ran: r.ran, cells: r.value?.cells ?? 0, queued: r.value?.queued ?? 0 };
}

/** Receipts arrive ~15 min after sending; this removes tokens that Apple or Google rejected. */
export async function runReceiptJob(): Promise<void> {
  await withLeaderLock(LOCK_RECEIPTS, async () => {
    const rows = await takeTickets(15 * 60_000, 1000);
    if (!rows.length) return;
    const byId = new Map(rows.map((r) => [r.id, r.token]));
    for (const ids of expo.chunkPushNotificationReceiptIds(rows.map((r) => r.id))) {
      try {
        const receipts = await expo.getPushNotificationReceiptsAsync(ids);
        for (const [id, r] of Object.entries(receipts)) {
          if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered') {
            const token = byId.get(id);
            if (token) await removeDevice(token);
          }
        }
        await dropTickets(ids);
      } catch (e) {
        log('error', 'receipt chunk failed', { err: String(e) });
      }
    }
  });
}

export function startJobs(): () => void {
  const safe = (name: string, fn: () => Promise<unknown>) => () => {
    fn().catch((e) => log('error', `${name} crashed`, { err: String(e) }));
  };
  const a = setInterval(safe('alerts', runAlertJob), config.alertJobEveryMs);
  const r = setInterval(safe('receipts', runReceiptJob), 20 * 60_000);
  const h = setInterval(safe('housekeeping', () => withLeaderLock(LOCK_HOUSEKEEPING, housekeeping)), 6 * 3600_000);
  return () => [a, r, h].forEach(clearInterval);
}
