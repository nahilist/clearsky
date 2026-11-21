import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT, type Key } from '../i18n';
import { font, isIOS, T } from '../theme';
import { Icon, IconName } from './Icon';

const LABELS: Record<string, { label: Key; icon: IconName }> = {
  index: { label: 'tab.today', icon: 'today' },
  radar: { label: 'tab.radar', icon: 'radar' },
  alerts: { label: 'tab.alerts', icon: 'alerts' },
  places: { label: 'tab.places', icon: 'places' },
  settings: { label: 'tab.settings', icon: 'settings' },
};

/** iOS: floating glass pill. Android: Material 3 bar with a pill indicator. */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const items = state.routes.map((route, index) => {
    const meta = LABELS[route.name];
    const focused = state.index === index;
    const onPress = () => {
      if (isIOS) void Haptics.selectionAsync();
      if (!focused) navigateToTab(route.key);
    };
    const color = isIOS ? (focused ? T.accent : T.muted) : focused ? T.chipOnText : T.muted;
    return (
      <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={t(meta.label)} accessibilityState={{ selected: focused }} onPress={onPress} style={styles.item}>
        {isIOS ? (
          <Icon name={meta.icon} size={24} color={color} />
        ) : (
          <View style={[styles.indicator, focused && { backgroundColor: T.chipOn }]}>
            <Icon name={meta.icon} size={22} color={color} />
          </View>
        )}
        <Text style={{ fontFamily: focused ? font.bold : font.medium, fontSize: 11, color: isIOS ? color : focused ? T.text : T.muted }}>{t(meta.label)}</Text>
      </Pressable>
    );
  });

  if (isIOS) {
    return (
      <View pointerEvents="box-none" style={[styles.iosWrap, { bottom: Math.max(insets.bottom, 12) }]}>
        <BlurView intensity={40} tint="dark" style={styles.iosBar}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bar }]} />
          {items}
        </BlurView>
      </View>
    );
  }
  return <View style={[styles.androidBar, { paddingBottom: insets.bottom, height: 80 + insets.bottom }]}>{items}</View>;
}

const styles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 56 },
  iosWrap: { position: 'absolute', left: 16, right: 16 },
  iosBar: { flexDirection: 'row', height: 64, borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  androidBar: { flexDirection: 'row', backgroundColor: T.bar, paddingTop: 12 },
  indicator: { width: 64, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
