import type { ReactNode } from 'react';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type * as ExpoObserve from 'expo-observe';

type ObserveMod = typeof ExpoObserve;

let mod: ObserveMod | null = null;
try {
  if (requireOptionalNativeModule('ExpoAppMetrics')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-observe') as ObserveMod;
  }
} catch {
  mod = null;
}

const noop = () => undefined;

export const Observe: Pick<ObserveMod['Observe'], 'configure'> = mod?.Observe ?? {
  configure: noop,
};

export function ObserveRoot({ children }: { children: ReactNode }) {
  if (mod?.ObserveRoot) {
    const Root = mod.ObserveRoot;
    return <Root>{children}</Root>;
  }
  return <>{children}</>;
}

export function useObserve(): { markInteractive: () => void } {
  if (mod?.useObserve) {
    return mod.useObserve();
  }
  return { markInteractive: noop };
}

export function ObserveInteractiveMarker(props: ExpoObserve.ObserveInteractiveMarkerProps) {
  if (mod?.ObserveInteractiveMarker) {
    const Marker = mod.ObserveInteractiveMarker;
    return <Marker {...props} />;
  }
  return null;
}
