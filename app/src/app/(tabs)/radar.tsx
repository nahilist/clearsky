import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Chip, Notice, TAB_BAR_SPACE } from '../../components/ui';
import { deriveAlerts } from '../../shared/alerts';
import { useForecast } from '../../lib/hooks';
import { useActivePlace } from '../../store';
import { font, isIOS, T } from '../../theme';

type Frame = { time: number; path: string };
type RainViewer = { host: string; radar: { past: Frame[]; nowcast: Frame[] } };

async function loadFrames(): Promise<{ host: string; frames: Frame[]; nowIndex: number }> {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!res.ok) throw new Error(`RainViewer ${res.status}`);
  const j = (await res.json()) as RainViewer;
  const frames = [...j.radar.past, ...(j.radar.nowcast ?? [])];
  return { host: j.host, frames, nowIndex: j.radar.past.length - 1 };
}

const clockOf = (t: number) => new Date(t * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function Radar() {
  const place = useActivePlace();
  const insets = useSafeAreaInsets();
  const { forecast } = useForecast(place);
  const { data, isError, refetch } = useQuery({ queryKey: ['radar-frames'], queryFn: loadFrames, staleTime: 5 * 60_000, refetchInterval: 5 * 60_000, retry: 2 });
  const [idx, setIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const frames = data?.frames ?? [];
  const current = idx ?? data?.nowIndex ?? 0;

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    timer.current = setInterval(() => setIdx((i) => (((i ?? data?.nowIndex ?? 0) + 1) % frames.length)), 700);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, frames.length, data?.nowIndex]);

  const rain = useMemo(() => (forecast ? deriveAlerts(forecast).find((a) => a.kind === 'rain_soon') : undefined), [forecast]);
  const frame = frames[current];
  const region = place ? { latitude: place.lat, longitude: place.lon, latitudeDelta: 3, longitudeDelta: 3 } : { latitude: 19.07, longitude: 72.87, latitudeDelta: 20, longitudeDelta: 20 };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={region} userInterfaceStyle={isIOS ? 'dark' : 'light'} rotateEnabled={false} pitchEnabled={false} maxZoomLevel={7} toolbarEnabled={false}>
        {frame && data && <UrlTile key={frame.path} urlTemplate={`${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`} maximumZ={7} opacity={0.75} zIndex={2} tileSize={256} />}
        {place && <Marker coordinate={{ latitude: place.lat, longitude: place.lon }} title={place.name} />}
      </MapView>

      <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, gap: 10 }}>
        <View style={[styles.panel, { paddingVertical: 12 }]}>
          <Text style={{ fontFamily: font.heavy, fontSize: 24, color: T.text }}>Radar{place ? ` · ${place.name}` : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip title="Rain" on />
        </View>
        {isError && <Notice tone="error">Radar is unavailable right now. We will retry automatically.</Notice>}
      </View>

      <View style={[styles.panel, { position: 'absolute', left: 16, right: 16, bottom: TAB_BAR_SPACE + insets.bottom, gap: 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: T.text, flex: 1 }}>{rain ? rain.title : 'No rain expected in the next 2 hours'}</Text>
          {frame && <Text style={{ fontFamily: font.bold, fontSize: 13, color: T.link }}>{clockOf(frame.time)}{current > (data?.nowIndex ?? 0) ? ' (forecast)' : ''}</Text>}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause radar' : 'Play radar'} onPress={() => (frames.length ? setPlaying((p) => !p) : void refetch())} style={styles.play}>
            <Icon name={playing ? 'pause' : 'play'} size={20} color={T.onAccent} />
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row', gap: 3 }}>
            {frames.map((f, i) => (
              <Pressable key={f.path} accessibilityLabel={`Radar at ${clockOf(f.time)}`} onPress={() => { setPlaying(false); setIdx(i); }} style={{ flex: 1, height: 28, justifyContent: 'center' }}>
                <View style={{ height: i === current ? 10 : 6, borderRadius: 4, backgroundColor: i === current ? T.accent : i <= (data?.nowIndex ?? 0) ? T.primary : T.border }} />
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: T.muted }}>Past 2 h</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: T.muted }}>Radar by RainViewer</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: T.muted }}>Next hour</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: T.bar, borderRadius: T.radius, borderWidth: 1, borderColor: T.border, padding: 16 },
  play: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
});
