import { airAlert } from '../shared/air';
import { deriveAlerts, sortAlerts } from '../shared/alerts';
import { deriveCommuteAlert, deriveCustomAlerts } from '../shared/rules';
import type { AirQuality, Forecast, Lang, WeatherAlert } from '../shared/types';
import type { Prefs } from '../store';

/** Every alert for one place: forecast alerts, air quality, and (for Pro) custom rules and commute. */
export function allAlerts(f: Forecast, aq: AirQuality | null | undefined, ctx: { lang: Lang; isPro: boolean; prefs: Prefs; placeId: string }): WeatherAlert[] {
  const out = deriveAlerts(f, ctx.lang);
  if (ctx.isPro && ctx.prefs.rules.length) out.push(...deriveCustomAlerts(f, ctx.prefs.rules, ctx.lang));
  if (ctx.isPro && ctx.prefs.commute.enabled && ctx.prefs.commute.placeId === ctx.placeId) {
    const c = deriveCommuteAlert(f, ctx.prefs.commute, ctx.lang);
    if (c) out.push(c);
  }
  if (aq && ctx.prefs.air) {
    const a = airAlert(aq, ctx.lang);
    if (a) out.push(a);
  }
  return sortAlerts(out);
}
