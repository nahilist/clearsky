import { Platform } from 'react-native';

const dark = {
  mode: 'dark' as const,
  bg: '#0B1B3A',
  bgGradient: ['#0B1B3A', '#12306B'] as [string, string],
  card: 'rgba(255,255,255,0.10)',
  cardStrong: '#1E4FA8',
  border: 'rgba(255,255,255,0.16)',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.78)',
  accent: '#F5B83D',
  onAccent: '#0B1B3A',
  primary: '#2F80ED',
  onPrimary: '#FFFFFF',
  ok: '#34C98B',
  alertBg: '#F5B83D',
  alertFg: '#0B1B3A',
  bar: 'rgba(11,27,58,0.92)',
  chip: 'rgba(255,255,255,0.14)',
  chipOn: '#F5B83D',
  chipOnText: '#0B1B3A',
  link: '#9CC3FF',
  radius: 24,
};

const light = {
  mode: 'light' as const,
  bg: '#F6F9FC',
  bgGradient: ['#F6F9FC', '#F6F9FC'] as [string, string],
  card: '#FFFFFF',
  cardStrong: '#1B5FD1',
  border: '#D5DEEA',
  text: '#0F172A',
  muted: '#475569',
  accent: '#F5B83D',
  onAccent: '#3D2A00',
  primary: '#1B5FD1',
  onPrimary: '#FFFFFF',
  ok: '#1E8E5A',
  alertBg: '#FFE7B0',
  alertFg: '#3D2A00',
  bar: '#E7EEF8',
  chip: '#E7EEF8',
  chipOn: '#C7DBFF',
  chipOnText: '#0B2A66',
  link: '#1B5FD1',
  radius: 24,
};

/** iOS ships the dark glass look, Android ships Material 3 on a light sky. */
export const T = Platform.OS === 'ios' ? dark : light;
export const isIOS = Platform.OS === 'ios';

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
};

export const FREE_PLACES = 3;
