import { useStore } from '../store';

export const toTemp = (c: number, unit: 'C' | 'F') => Math.round(unit === 'F' ? (c * 9) / 5 + 32 : c);
export const toWind = (kmh: number, unit: 'kmh' | 'mph') => Math.round(unit === 'mph' ? kmh * 0.621371 : kmh);

export function useFmt() {
  const units = useStore((s) => s.units);
  return {
    temp: (c: number) => `${toTemp(c, units.temp)}°`,
    wind: (k: number) => `${toWind(k, units.wind)} ${units.wind === 'mph' ? 'mph' : 'km/h'}`,
  };
}

export function hourLabel(iso: string): string {
  const h = Number(iso.slice(11, 13));
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
}

export function clock(iso: string): string {
  const h = Number(iso.slice(11, 13));
  return `${h % 12 || 12}:${iso.slice(14, 16)} ${h < 12 ? 'AM' : 'PM'}`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function weekday(date: string, todayIso: string): string {
  if (date === todayIso.slice(0, 10)) return 'Today';
  return DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
}
