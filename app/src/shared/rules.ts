import { max, min, nextHours, sum } from './alerts';
import { TEXT } from './strings';
import type { Commute, CustomRule, CustomRuleKind, Forecast, Lang, WeatherAlert } from './types';

export const RULE_LIMITS: Record<CustomRuleKind, { min: number; max: number; step: number; def: number; unit: string }> = {
  rain: { min: 1, max: 100, step: 1, def: 10, unit: 'mm' },
  heat: { min: 30, max: 55, step: 1, def: 40, unit: '°' },
  cold: { min: -20, max: 25, step: 1, def: 8, unit: '°' },
  wind: { min: 20, max: 120, step: 5, def: 50, unit: 'km/h' },
  uv: { min: 3, max: 12, step: 1, def: 8, unit: '' },
};

export const MAX_RULES = 6;

/** Evaluates user-defined thresholds against one forecast. Custom alerts are "watch" level so they push. */
export function deriveCustomAlerts(f: Forecast, rules: CustomRule[], lang: Lang = 'en'): WeatherAlert[] {
  const S = TEXT[lang].custom;
  const day = f.current.time.slice(0, 10);
  const h3 = nextHours(f, 3);
  const h12 = nextHours(f, 12);
  const out: WeatherAlert[] = [];
  for (const r of rules) {
    if (!r.enabled) continue;
    let value: number | null = null;
    let hit = false;
    if (r.kind === 'rain') {
      value = sum(h3.map((h) => h.precip));
      hit = value >= r.threshold;
    } else if (r.kind === 'heat') {
      value = max(h12.map((h) => h.feels));
      hit = h12.length > 0 && value >= r.threshold;
    } else if (r.kind === 'cold') {
      value = min(h12.map((h) => h.temp));
      hit = h12.length > 0 && value <= r.threshold;
    } else if (r.kind === 'wind') {
      value = max(h12.map((h) => h.gust));
      hit = value >= r.threshold;
    } else {
      value = f.daily[0]?.uvMax ?? 0;
      hit = value >= r.threshold;
    }
    if (!hit || value === null) continue;
    const v = Math.round(value);
    const title = S.title[r.kind](r.threshold);
    out.push({
      key: `custom:${r.id}:${day}`,
      kind: 'custom',
      severity: 'watch',
      title,
      summary: S.summary[r.kind](v),
      startsAt: h12[0]?.time ?? f.current.time,
      endsAt: h12[h12.length - 1]?.time ?? f.current.time,
      actions: S.actions,
      reason: S.reason,
    });
  }
  return out;
}

const dow = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/**
 * Warns up to 3 hours before the user's commute window starts, and while it is under way,
 * if rain is likely during the window.
 */
export function deriveCommuteAlert(f: Forecast, c: Commute, lang: Lang = 'en'): WeatherAlert | null {
  if (!c.enabled || c.days.length === 0) return null;
  const date = f.current.time.slice(0, 10);
  if (!c.days.includes(dow(date))) return null;
  const nowHour = Number(f.current.time.slice(11, 13));
  if (nowHour < c.startHour - 3 || nowHour >= c.endHour) return null;
  const window = f.hourly.filter((h) => h.time.slice(0, 10) === date && Number(h.time.slice(11, 13)) >= c.startHour && Number(h.time.slice(11, 13)) < c.endHour);
  if (!window.length) return null;
  const pop = max(window.map((h) => h.pop));
  const mm = sum(window.map((h) => h.precip));
  if (pop < 50 && mm < 1) return null;
  const S = TEXT[lang].commute;
  return {
    key: `commute:${date}`,
    kind: 'commute',
    severity: 'watch',
    title: S.title,
    summary: S.summary(c.startHour, c.endHour, Math.round(pop)),
    startsAt: window[0].time,
    endsAt: window[window.length - 1].time,
    actions: S.actions,
    reason: S.reason,
  };
}
