import { TEXT } from './strings';
import type { Lang } from './types';

const SYNODIC = 29.530588853;
const NEW_MOON_JD = 2451550.1; // 6 Jan 2000

export function moonPhase(date: string, lang: Lang = 'en'): { fraction: number; illumination: number; name: string } {
  const jd = Date.parse(`${date}T12:00:00Z`) / 86400000 + 2440587.5;
  const fraction = (((jd - NEW_MOON_JD) / SYNODIC) % 1 + 1) % 1;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  return { fraction, illumination, name: TEXT[lang].moon[Math.round(fraction * 8) % 8] };
}

const mins = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Golden hour is approximated as the first and last hour of sunlight. */
export function sunTimes(sunrise: string, sunset: string) {
  const a = mins(sunrise);
  const b = mins(sunset);
  const len = Math.max(0, b - a);
  return { daylight: `${Math.floor(len / 60)} h ${len % 60} min`, morningGolden: `${hhmm(a)} to ${hhmm(a + 60)}`, eveningGolden: `${hhmm(b - 60)} to ${hhmm(b)}` };
}
