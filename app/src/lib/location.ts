import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { placeId, useStore } from '../store';

export type LocStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'error';

export function useDeviceLocation() {
  const setCurrentPlace = useStore((s) => s.setCurrentPlace);
  const [status, setStatus] = useState<LocStatus>('idle');

  const locate = useCallback(async () => {
    setStatus('loading');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setStatus('denied');
        return;
      }
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const { latitude: lat, longitude: lon } = pos.coords;
      let name = 'Current location';
      let sub: string | undefined;
      try {
        const [g] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (g) {
          name = g.city ?? g.district ?? g.subregion ?? g.region ?? name;
          sub = [g.region, g.country].filter(Boolean).join(', ') || undefined;
        }
      } catch {
        // Reverse geocoding is best effort; the forecast does not depend on it.
      }
      setCurrentPlace({ id: placeId(lat, lon), name, sub, lat, lon });
      setStatus('granted');
    } catch {
      setStatus('error');
    }
  }, [setCurrentPlace]);

  useEffect(() => {
    void locate();
  }, [locate]);

  return { status, locate };
}
