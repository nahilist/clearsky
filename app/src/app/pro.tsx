import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { Icon } from '../components/Icon';
import { Body, Button, Label, Notice, Screen, Skeleton } from '../components/ui';
import { billingConfigured, buy, restore, usePackages } from '../lib/billing';
import { useStore } from '../store';
import { font, T } from '../theme';

const PERKS = ['Unlimited saved places', 'Custom alerts: your own rain, heat, cold, wind and UV limits', 'Commute warnings before you leave', 'Minute-by-minute rain for the next 6 hours', 'Safety alerts stay free and ad-free for everyone'];

export default function Pro() {
  const isPro = useStore((s) => s.isPro);
  const { packages, loading, error } = usePackages();
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen: PurchasesPackage | undefined = packages.find((p) => p.identifier === sel) ?? packages.find((p) => p.packageType === 'ANNUAL') ?? packages[0];

  const purchase = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      if ((await buy(chosen)) === 'ok') router.back();
    } catch {
      Alert.alert('Purchase failed', 'You were not charged. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    setBusy(true);
    try {
      const ok = await restore();
      Alert.alert(ok ? 'Restored' : 'Nothing to restore', ok ? 'Pro is active again.' : 'We could not find a Pro subscription on this account.');
      if (ok) router.back();
    } catch {
      Alert.alert('Restore failed', 'Please try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tabs={false}>
      <View style={{ alignItems: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.chip, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={18} color={T.text} strokeWidth={2.4} />
        </Pressable>
      </View>
      <Label>ClearSky Pro</Label>
      <Text accessibilityRole="header" style={{ fontFamily: font.heavy, fontSize: 34, lineHeight: 38, letterSpacing: -1, color: T.text }}>Sharper forecasts. Still no ads.</Text>
      <Body>Safety alerts stay free forever. Pro adds the extras.</Body>
      <View style={{ gap: 10, paddingVertical: 6 }}>
        {PERKS.map((p) => (
          <View key={p} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="check" size={18} color={T.ok} strokeWidth={2.6} />
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 15, color: T.text }}>{p}</Text>
          </View>
        ))}
      </View>

      {isPro && <Notice>Pro is active on this account. Thank you.</Notice>}
      {!billingConfigured && <Notice tone="error">Billing is not configured in this build. Set the RevenueCat keys to enable purchases.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {loading && <Skeleton h={72} />}
      {packages.map((p) => {
        const on = p.identifier === chosen?.identifier;
        return (
          <Pressable
            key={p.identifier}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => setSel(p.identifier)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 22, minHeight: 64, backgroundColor: on ? T.accent : T.card, borderWidth: 1, borderColor: on ? T.accent : T.border }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 16, color: on ? T.onAccent : T.text }}>{p.product.title.replace(/\s*\(.*\)$/, '')}</Text>
              {p.product.introPrice ? <Text style={{ fontFamily: font.medium, fontSize: 13, color: on ? T.onAccent : T.muted }}>{p.product.introPrice.periodNumberOfUnits} {p.product.introPrice.periodUnit.toLowerCase()} free trial</Text> : null}
            </View>
            <Text style={{ fontFamily: font.heavy, fontSize: 18, color: on ? T.onAccent : T.text }}>{p.product.priceString}</Text>
          </Pressable>
        );
      })}
      <Button title={isPro ? 'You are on Pro' : chosen?.product.introPrice ? 'Start free trial' : 'Subscribe'} onPress={() => void purchase()} loading={busy} disabled={isPro || !chosen} />
      <Button title="Restore purchases" kind="outline" onPress={() => void doRestore()} disabled={!billingConfigured || busy} />
      <Body style={{ fontSize: 12, textAlign: 'center' }}>
        Payment is charged to your store account. Subscriptions renew automatically unless cancelled at least 24 hours before the period ends. Manage or cancel any time in your App Store or Google Play subscription settings.
      </Body>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
        <Text onPress={() => void Linking.openURL('https://example.com/terms')} style={{ fontFamily: font.semibold, fontSize: 12, color: T.link, padding: 8 }}>Terms</Text>
        <Text onPress={() => void Linking.openURL('https://example.com/privacy')} style={{ fontFamily: font.semibold, fontSize: 12, color: T.link, padding: 8 }}>Privacy</Text>
      </View>
    </Screen>
  );
}
