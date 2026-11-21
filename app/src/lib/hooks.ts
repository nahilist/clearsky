import { useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { AirQuality, Forecast, WeatherAlert } from '../shared/types';
import { Place, useStore } from '../store';
import { fetchAir, fetchForecast } from './api';
import { allAlerts } from './alertsFor';

const STALE = 5 * 60_000;

function opts(place: Place) {
  return {
    queryKey: ['forecast', place.lat.toFixed(2), place.lon.toFixed(2)],
    queryFn: async (): Promise<Forecast> => {
      const f = await fetchForecast(place.lat, place.lon);
      useStore.getState().setCache(place.id, f);
      return f;
    },
    staleTime: STALE,
    gcTime: 24 * 3600_000,
    retry: 2,
    retryDelay: (n: number) => Math.min(1000 * 2 ** n, 8000),
    refetchOnReconnect: true,
  };
}

const airOpts = (place: Place) => ({
  queryKey: ['air', place.lat.toFixed(2), place.lon.toFixed(2)],
  queryFn: (): Promise<AirQuality> => fetchAir(place.lat, place.lon),
  staleTime: 15 * 60_000,
  gcTime: 6 * 3600_000,
  retry: 1,
});

export function useForecast(place: Place | null) {
  const cached = useStore((s) => (place ? s.cache[place.id] : undefined));
  const q = useQuery({
    ...opts(place ?? { id: 'none', name: '', lat: 0, lon: 0 }),
    enabled: !!place,
    placeholderData: cached,
  });
  return { ...q, forecast: q.data, isCached: !!q.data && q.isPlaceholderData };
}

export function useAir(place: Place | null) {
  const enabled = useStore((s) => s.prefs.air) && !!place;
  const q = useQuery({ ...airOpts(place ?? { id: 'none', name: '', lat: 0, lon: 0 }), enabled });
  return q.data ?? null;
}

export function useAllForecasts(places: Place[]) {
  const cache = useStore((s) => s.cache);
  const results = useQueries({
    queries: places.map((p) => ({ ...opts(p), placeholderData: cache[p.id] })),
  });
  return places.map((place, i) => ({ place, forecast: results[i].data, loading: results[i].isLoading }));
}

export type PlaceAlert = { place: Place; alert: WeatherAlert };

export function useAlerts(places: Place[]): { items: PlaceAlert[]; loading: boolean } {
  const all = useAllForecasts(places);
  const airOn = useStore((s) => s.prefs.air);
  const air = useQueries({ queries: places.map((p) => ({ ...airOpts(p), enabled: airOn })) });
  const lang = useStore((s) => s.lang);
  const isPro = useStore((s) => s.isPro);
  const prefs = useStore((s) => s.prefs);
  const recordAlerts = useStore((s) => s.recordAlerts);
  const loading = all.some((a) => a.loading);

  const stamp = all.map((a) => a.forecast?.fetchedAt ?? 0).join(',') + '|' + air.map((a) => a.data?.fetchedAt ?? 0).join(',');
  const items = useMemo(() => {
    const out: PlaceAlert[] = [];
    all.forEach(({ place, forecast }, i) => {
      if (!forecast) return;
      for (const alert of allAlerts(forecast, air[i]?.data, { lang, isPro, prefs, placeId: place.id })) out.push({ place, alert });
    });
    const rank = { warning: 0, watch: 1, info: 2 } as const;
    return out.sort((a, b) => rank[a.alert.severity] - rank[b.alert.severity]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, lang, isPro, prefs]);

  // Keep a local log so people can look back at what was flagged.
  useEffect(() => {
    if (items.length) recordAlerts(items.map(({ place, alert }) => ({ placeId: place.id, placeName: place.name, alert })));
  }, [items, recordAlerts]);

  return { items, loading };
}

/** Current location + saved places, de-duplicated. */
export function useAllPlaces(): Place[] {
  const places = useStore((s) => s.places);
  const current = useStore((s) => s.currentPlace);
  return useMemo(() => (current ? [current, ...places.filter((p) => p.id !== current.id)] : places), [places, current]);
}
