import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Commute, CustomRule, Forecast, Lang, Severity, AlertKind } from './shared/types';

export type Place = { id: string; name: string; sub?: string; lat: number; lon: number };

export type Prefs = {
  severe: boolean;
  rainSoon: boolean;
  daily: boolean;
  quietOn: boolean;
  quietStart: number; // hour 0-23
  quietEnd: number;
  air: boolean;
  rules: CustomRule[]; // Pro
  commute: Commute; // Pro
};

export type HistoryItem = { id: string; placeId: string; placeName: string; title: string; kind: AlertKind; severity: Severity; at: number };

type State = {
  hydrated: boolean;
  onboarded: boolean;
  places: Place[];
  currentPlace: Place | null;
  selectedId: string | null;
  units: { temp: 'C' | 'F'; wind: 'kmh' | 'mph' };
  prefs: Prefs;
  isPro: boolean;
  pushToken: string | null;
  mutedUntil: number;
  lang: Lang;
  history: HistoryItem[];
  cache: Record<string, Forecast>;
  setLang: (l: Lang) => void;
  recordAlerts: (items: { placeId: string; placeName: string; alert: { key: string; title: string; kind: AlertKind; severity: Severity } }[]) => void;
  setHydrated: () => void;
  setOnboarded: () => void;
  addPlace: (p: Place) => void;
  removePlace: (id: string) => void;
  setCurrentPlace: (p: Place | null) => void;
  select: (id: string | null) => void;
  setUnits: (u: Partial<State['units']>) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  setPro: (v: boolean) => void;
  setPushToken: (t: string | null) => void;
  muteFor: (hours: number) => void;
  setCache: (id: string, f: Forecast) => void;
  reset: () => void;
};

const defaults = {
  onboarded: false,
  places: [] as Place[],
  currentPlace: null as Place | null,
  selectedId: null as string | null,
  units: { temp: 'C' as const, wind: 'kmh' as const },
  prefs: {
    severe: true,
    rainSoon: true,
    daily: false,
    quietOn: true,
    quietStart: 22,
    quietEnd: 6,
    air: true,
    rules: [] as CustomRule[],
    commute: { enabled: false, placeId: null, startHour: 8, endHour: 10, days: [1, 2, 3, 4, 5] } as Commute,
  },
  isPro: false,
  pushToken: null as string | null,
  mutedUntil: 0,
  lang: (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().locale.startsWith('hi') ? 'hi' : 'en') as Lang,
  history: [] as HistoryItem[],
  cache: {} as Record<string, Forecast>,
};

const MAX_CACHE = 12;

export const useStore = create<State>()(
  persist(
    (set) => ({
      hydrated: false,
      ...defaults,
      setHydrated: () => set({ hydrated: true }),
      setOnboarded: () => set({ onboarded: true }),
      addPlace: (p) => set((s) => (s.places.some((x) => x.id === p.id) ? s : { places: [...s.places, p] })),
      removePlace: (id) =>
        set((s) => {
          const { [id]: _drop, ...cache } = s.cache;
          return {
            places: s.places.filter((p) => p.id !== id),
            selectedId: s.selectedId === id ? null : s.selectedId,
            cache,
          };
        }),
      setCurrentPlace: (currentPlace) => set({ currentPlace }),
      select: (selectedId) => set({ selectedId }),
      setUnits: (u) => set((s) => ({ units: { ...s.units, ...u } })),
      setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),
      setPro: (isPro) => set({ isPro }),
      setPushToken: (pushToken) => set({ pushToken }),
      setLang: (lang) => set({ lang }),
      recordAlerts: (items) =>
        set((s) => {
          const seen = new Set(s.history.map((h) => h.id));
          const fresh: HistoryItem[] = [];
          for (const { placeId, placeName, alert } of items) {
            const id = `${placeId}|${alert.key}`;
            if (seen.has(id)) continue;
            seen.add(id);
            fresh.push({ id, placeId, placeName, title: alert.title, kind: alert.kind, severity: alert.severity, at: Date.now() });
          }
          return fresh.length ? { history: [...fresh, ...s.history].slice(0, 60) } : s;
        }),
      muteFor: (hours) => set({ mutedUntil: Date.now() + hours * 3600_000 }),
      setCache: (id, f) =>
        set((s) => {
          const entries = Object.entries({ ...s.cache, [id]: f }).sort((a, b) => b[1].fetchedAt - a[1].fetchedAt);
          return { cache: Object.fromEntries(entries.slice(0, MAX_CACHE)) };
        }),
      reset: () => set({ ...defaults }),
    }),
    {
      name: 'clearsky-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      // Older installs lack the new prefs fields; fill them from defaults instead of dropping the whole state.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, prefs: { ...current.prefs, ...(p.prefs ?? {}) }, units: { ...current.units, ...(p.units ?? {}) } };
      },
      partialize: (s) => ({
        onboarded: s.onboarded,
        places: s.places,
        currentPlace: s.currentPlace,
        selectedId: s.selectedId,
        units: s.units,
        prefs: s.prefs,
        isPro: s.isPro,
        pushToken: s.pushToken,
        mutedUntil: s.mutedUntil,
        lang: s.lang,
        history: s.history,
        cache: s.cache,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

export const placeId = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

export function useActivePlace(): Place | null {
  return useStore((s) => {
    if (s.selectedId) {
      const hit = s.places.find((p) => p.id === s.selectedId);
      if (hit) return hit;
      if (s.currentPlace?.id === s.selectedId) return s.currentPlace;
    }
    return s.currentPlace ?? s.places[0] ?? null;
  });
}
