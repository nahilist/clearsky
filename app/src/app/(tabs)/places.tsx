import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Body, Card, Label, Notice, Screen, Title } from '../../components/ui';
import { GeoResult, geocode } from '../../lib/api';
import { useFmt } from '../../lib/format';
import { useAllForecasts } from '../../lib/hooks';
import { supabase } from '../../lib/supabase';
import { deleteUserPlace, saveUserPlace } from '../../lib/supabaseSync';
import { describeCode } from '../../shared/weather';
import { useStore } from '../../store';
import { FREE_PLACES, font, T } from '../../theme';

export default function Places() {
  const fmt = useFmt();
  const places = useStore((s) => s.places);
  const current = useStore((s) => s.currentPlace);
  const isPro = useStore((s) => s.isPro);
  const { addPlace, removePlace, select } = useStore.getState();
  const all = current ? [current, ...places] : places;
  const data = useAllForecasts(all);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onQueryChange = (text: string) => {
    setQ(text);
    if (text.trim().length < 2) {
      setResults([]);
      setErr(null);
      setBusy(false);
    }
  };

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      setBusy(true);
      geocode(q)
        .then((r) => { setResults(r); setErr(null); })
        .catch(() => setErr('Search failed. Check your connection.'))
        .finally(() => setBusy(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const limitReached = !isPro && places.length >= FREE_PLACES;

  const add = (r: GeoResult) => {
    if (limitReached) {
      router.push('/pro');
      return;
    }
    const place = { id: r.id, name: r.name, sub: r.sub, lat: r.lat, lon: r.lon };
    addPlace(place);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void saveUserPlace(data.session.user.id, place).catch(() => undefined);
    });
    select(r.id);
    setQ('');
    router.navigate('/');
  };

  const remove = (id: string) => {
    removePlace(id);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void deleteUserPlace(data.session.user.id, id).catch(() => undefined);
    });
  };

  return (
    <Screen>
      <Title>Places</Title>
      <View style={{ minHeight: 52, borderRadius: 26, backgroundColor: T.chip, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
        <Icon name="search" size={20} color={T.muted} />
        <TextInput
          accessibilityLabel="Search city or pin code"
          value={q}
          onChangeText={onQueryChange}
          placeholder="Search city or pin code"
          placeholderTextColor={T.muted}
          autoCorrect={false}
          style={{ flex: 1, minHeight: 48, fontFamily: font.regular, fontSize: 16, color: T.text }}
          returnKeyType="search"
        />
        {busy && <ActivityIndicator color={T.link} />}
      </View>
      {err && <Notice tone="error">{err}</Notice>}
      {results.map((r) => (
        <Card key={r.id} onPress={() => add(r)} label={`Add ${r.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 16, color: T.text }}>{r.name}</Text>
            <Body style={{ fontSize: 13, lineHeight: 18 }}>{r.sub}</Body>
          </View>
          <Icon name="plus" size={20} color={T.link} />
        </Card>
      ))}

      {all.map(({ id, name, sub }, i) => {
        const f = data[i]?.forecast;
        const isCurrent = current?.id === id && i === 0;
        return (
          <Card
            key={id}
            label={`Open ${name}`}
            onPress={() => { select(id); router.navigate('/'); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: isCurrent ? T.cardStrong : T.card }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 18, color: isCurrent ? '#fff' : T.text }}>{name}</Text>
              <Text style={{ fontFamily: font.regular, fontSize: 13, color: isCurrent ? 'rgba(255,255,255,0.85)' : T.muted }}>
                {isCurrent ? 'Current location' : sub ?? ''}{f ? ` · ${describeCode(f.current.code, f.current.isDay).label}` : ''}
              </Text>
            </View>
            <Text style={{ fontFamily: font.bold, fontSize: 34, letterSpacing: -1, color: isCurrent ? '#fff' : T.text }}>{f ? fmt.temp(f.current.temp) : '–'}</Text>
            {!isCurrent && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${name}`} hitSlop={10} onPress={() => remove(id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={18} color={T.muted} />
              </Pressable>
            )}
          </Card>
        );
      })}
      {all.length === 0 && <Body style={{ paddingHorizontal: 4 }}>No places yet. Search above to add one.</Body>}
      <Label>{isPro ? 'Unlimited places with Pro' : `${places.length} of ${FREE_PLACES} free places used`}</Label>
      {limitReached && (
        <Card onPress={() => router.push('/pro')} label="Get ClearSky Pro">
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: T.text }}>Need more places?</Text>
          <Body>ClearSky Pro removes the limit. Safety alerts stay free.</Body>
        </Card>
      )}
    </Screen>
  );
}
