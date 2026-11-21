import Svg, { Circle, Path } from 'react-native-svg';
import type { Glyph } from '../shared/weather';

const PATHS = {
  today: ['M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5'],
  radar: [],
  alerts: ['M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20h4'],
  places: ['M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11Z'],
  settings: ['M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1'],
  back: ['m15 5-7 7 7 7'],
  close: ['M6 6l12 12M18 6 6 18'],
  plus: ['M12 5v14M5 12h14'],
  search: ['m20 20-4-4'],
  warn: ['M12 3 2 21h20L12 3Z', 'M12 10v5M12 18v.01'],
  check: ['m5 12 5 5 9-10'],
  play: ['M7 4l13 8-13 8Z'],
  pause: ['M8 5v14M16 5v14'],
  locate: ['M12 2v4M12 18v4M2 12h4M18 12h4'],
  chevron: ['m9 5 7 7-7 7'],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, color = '#fff', strokeWidth = 2 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {name === 'today' && <Circle cx="12" cy="12" r="4" />}
      {name === 'radar' && (
        <>
          <Circle cx="12" cy="12" r="9" />
          <Circle cx="12" cy="12" r="4" />
        </>
      )}
      {name === 'places' && <Circle cx="12" cy="10" r="2" />}
      {name === 'search' && <Circle cx="11" cy="11" r="7" />}
      {name === 'settings' && <Circle cx="12" cy="12" r="3" />}
      {name === 'locate' && <Circle cx="12" cy="12" r="3" />}
      {PATHS[name].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}

const SUN = '#F5B83D';

/** Weather glyph drawn from simple shapes so it stays crisp at any size. */
export function WeatherGlyph({ glyph, size = 40 }: { glyph: Glyph; size?: number }) {
  const cloud = 'M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a4.75 4.75 0 0 1 .5 9.5Z';
  const cloudFill = '#DCE6F5';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {(glyph === 'sun' || glyph === 'partly') && <Circle cx={glyph === 'sun' ? 12 : 9} cy={glyph === 'sun' ? 12 : 9} r={glyph === 'sun' ? 5 : 4} fill={SUN} />}
      {glyph === 'moon' && <Path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" fill="#CFE0FF" />}
      {(['partly', 'cloud', 'fog', 'drizzle', 'rain', 'snow', 'storm'] as Glyph[]).includes(glyph) && (
        <Path d={cloud} fill={glyph === 'storm' ? '#9FB0C9' : cloudFill} />
      )}
      {glyph === 'fog' && <Path d="M5 21h14M8 23h8" stroke="#DCE6F5" strokeWidth={1.6} strokeLinecap="round" />}
      {(glyph === 'drizzle' || glyph === 'rain') && <Path d="M9 20l-1 2M13 20l-1 2M17 20l-1 2" stroke="#4EA1FF" strokeWidth={1.8} strokeLinecap="round" />}
      {glyph === 'snow' && <Path d="M9 21h.01M13 22h.01M17 21h.01" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />}
      {glyph === 'storm' && <Path d="M13 15l-3 4h3l-1 3 4-5h-3l1-2Z" fill={SUN} />}
    </Svg>
  );
}
