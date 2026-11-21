import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { useStore } from '../store';

export const ENTITLEMENT = 'pro';
const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
});

export const billingConfigured = !!KEY;
let started = false;

function apply(info: CustomerInfo) {
  useStore.getState().setPro(!!info.entitlements.active[ENTITLEMENT]);
}

export function initBilling() {
  if (started || !KEY) return;
  started = true;
  Purchases.configure({ apiKey: KEY });
  Purchases.addCustomerInfoUpdateListener(apply);
  Purchases.getCustomerInfo().then(apply).catch(() => undefined);
}

export function usePackages() {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(billingConfigured);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!billingConfigured) return;
    Purchases.getOfferings()
      .then((o) => setPackages(o.current?.availablePackages ?? []))
      .catch(() => setError('Could not load plans. Check your connection and try again.'))
      .finally(() => setLoading(false));
  }, []);
  return { packages, loading, error };
}

export async function buy(pkg: PurchasesPackage): Promise<'ok' | 'cancelled'> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    apply(customerInfo);
    return 'ok';
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    throw e;
  }
}

export async function restore(): Promise<boolean> {
  const info = await Purchases.restorePurchases();
  apply(info);
  return !!info.entitlements.active[ENTITLEMENT];
}
