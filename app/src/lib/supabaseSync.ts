import { supabase, isSupabaseConfigured } from './supabase';
import type { Place } from '../store';
import type { CustomRule, Lang } from '../shared/types';

export async function fetchUserPlaces(userId: string): Promise<Place[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('user_places')
    .select('id, name, sub, lat, lon')
    .eq('user_id', userId);

  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    sub: r.sub ?? undefined,
    lat: r.lat,
    lon: r.lon,
  }));
}

export async function saveUserPlace(userId: string, place: Place): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('user_places').upsert({
    id: place.id,
    user_id: userId,
    name: place.name,
    sub: place.sub ?? null,
    lat: place.lat,
    lon: place.lon,
  });
}

export async function deleteUserPlace(userId: string, placeId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('user_places').delete().match({ user_id: userId, id: placeId });
}

export async function fetchUserRules(userId: string): Promise<CustomRule[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('user_rules')
    .select('id, kind, threshold, enabled')
    .eq('user_id', userId);

  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    kind: r.kind as CustomRule['kind'],
    threshold: Number(r.threshold),
    enabled: Boolean(r.enabled),
  }));
}

export async function syncUserRules(userId: string, rules: CustomRule[]): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('user_rules').delete().eq('user_id', userId);
  if (rules.length === 0) return;
  const rows = rules.map((r) => ({
    id: r.id,
    user_id: userId,
    kind: r.kind,
    threshold: r.threshold,
    enabled: r.enabled,
  }));
  await supabase.from('user_rules').insert(rows);
}

export async function updateUserProfile(
  userId: string,
  profile: { lang?: Lang; isPro?: boolean; tempUnit?: 'C' | 'F'; windUnit?: 'kmh' | 'mph' }
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (profile.lang !== undefined) updates.lang = profile.lang;
  if (profile.isPro !== undefined) updates.is_pro = profile.isPro;
  if (profile.tempUnit !== undefined) updates.temp_unit = profile.tempUnit;
  if (profile.windUnit !== undefined) updates.wind_unit = profile.windUnit;

  await supabase.from('profiles').update(updates).eq('id', userId);
}
