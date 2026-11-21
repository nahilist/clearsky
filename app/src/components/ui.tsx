import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WeatherAlert } from '../shared/types';
import { font, isIOS, T } from '../theme';
import { Icon } from './Icon';

export const TAB_BAR_SPACE = isIOS ? 108 : 96;

export function Screen({
  children,
  refreshing,
  onRefresh,
  tabs = true,
  scroll = true,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  tabs?: boolean;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + 12, paddingBottom: (tabs ? TAB_BAR_SPACE : 24) + insets.bottom };
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {isIOS && <LinearGradient colors={T.bgGradient} style={StyleSheet.absoluteFill} />}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, pad]}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={T.text} colors={[T.primary]} /> : undefined}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, pad, { flex: 1 }]}>{children}</View>
      )}
    </View>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityRole="header" style={[styles.title, style]}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Card({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  const base = [styles.card, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

export function Button({ title, onPress, kind = 'primary', loading, disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'outline' | 'accent'; loading?: boolean; disabled?: boolean }) {
  const bg = kind === 'primary' ? T.primary : kind === 'accent' ? T.accent : 'transparent';
  const fg = kind === 'primary' ? T.onPrimary : kind === 'accent' ? T.onAccent : T.link;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, kind === 'outline' && { borderWidth: 1, borderColor: T.border }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ title, on, onPress }: { title: string; on?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress} style={[styles.chip, { backgroundColor: on ? T.chipOn : T.chip }]}>
      <Text style={{ fontFamily: font.semibold, fontSize: 13, color: on ? T.chipOnText : T.text }}>{title}</Text>
    </Pressable>
  );
}

export function AlertBanner({ alert, place, onPress }: { alert: WeatherAlert; place?: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${alert.title}. ${alert.summary}`}
      onPress={onPress}
      style={[styles.banner, { backgroundColor: T.alertBg }]}
    >
      <Icon name="warn" size={26} color={T.alertFg} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.heavy, fontSize: 15, color: T.alertFg }}>{alert.title}</Text>
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: T.alertFg }}>
          {place ? `${place} · ` : ''}
          {alert.summary}
        </Text>
      </View>
    </Pressable>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' }) {
  return (
    <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: tone === 'error' ? T.alertBg : T.card, borderColor: T.border }]}>
      <Text style={{ fontFamily: font.medium, fontSize: 13, color: tone === 'error' ? T.alertFg : T.muted }}>{children}</Text>
    </View>
  );
}

export function Skeleton({ h, w, r = 16 }: { h: number; w?: number | `${number}%`; r?: number }) {
  return <View style={{ height: h, width: w ?? '100%', borderRadius: r, backgroundColor: T.card, borderWidth: isIOS ? 0 : 1, borderColor: T.border, opacity: 0.7 }} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 12 },
  title: { fontFamily: font.heavy, fontSize: 32, letterSpacing: -1, color: T.text, paddingHorizontal: 4, paddingTop: 4 },
  label: { fontFamily: font.bold, fontSize: 12, letterSpacing: 1.2, color: T.accent === '#F5B83D' && isIOS ? T.accent : T.link, textTransform: 'uppercase' },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: T.muted },
  card: { backgroundColor: T.card, borderRadius: T.radius, borderWidth: 1, borderColor: T.border, padding: 16, gap: 10 },
  button: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonText: { fontFamily: font.bold, fontSize: 16 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: isIOS ? 18 : 10, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: T.radius },
  notice: { padding: 12, borderRadius: 16, borderWidth: 1 },
});
