import { router } from 'expo-router';
import { Pressable, Switch, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Body, Button, Card, Chip, Label, Notice, Screen, Title } from '../components/ui';
import { useT, type Key } from '../i18n';
import { useAllPlaces } from '../lib/hooks';
import { MAX_RULES, RULE_LIMITS } from '../shared/rules';
import type { CustomRule, CustomRuleKind } from '../shared/types';
import { supabase } from '../lib/supabase';
import { syncUserRules } from '../lib/supabaseSync';
import { useStore } from '../store';
import { font, T } from '../theme';

const KINDS: CustomRuleKind[] = ['rain', 'heat', 'cold', 'wind', 'uv'];
const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_HI = ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'];

function Stepper({ value, unit, onChange, min, max, step, label }: { value: number; unit: string; onChange: (v: number) => void; min: number; max: number; step: number; label: string }) {
  const btn = { width: 44, height: 44, borderRadius: 22, backgroundColor: T.chip, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} -`} onPress={() => onChange(Math.max(min, value - step))} style={btn}>
        <Text style={{ fontFamily: font.bold, fontSize: 20, color: T.text }}>−</Text>
      </Pressable>
      <Text style={{ minWidth: 62, textAlign: 'center', fontFamily: font.bold, fontSize: 16, color: T.text }}>{value}{unit}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} +`} onPress={() => onChange(Math.min(max, value + step))} style={btn}>
        <Text style={{ fontFamily: font.bold, fontSize: 20, color: T.text }}>+</Text>
      </Pressable>
    </View>
  );
}

export default function Rules() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const isPro = useStore((s) => s.isPro);
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const places = useAllPlaces();
  const rules = prefs.rules;
  const commute = prefs.commute;

  const setRule = (kind: CustomRuleKind, patch: Partial<CustomRule>) => {
    let next: CustomRule[];
    const cur = rules.find((r) => r.kind === kind);
    if (cur) next = rules.map((r) => (r.kind === kind ? { ...r, ...patch } : r));
    else if (rules.length < MAX_RULES) next = [...rules, { id: kind, kind, threshold: RULE_LIMITS[kind].def, enabled: true, ...patch }];
    else return;
    setPrefs({ rules: next });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void syncUserRules(data.session.user.id, next).catch(() => undefined);
    });
  };
  const setCommute = (patch: Partial<typeof commute>) => setPrefs({ commute: { ...commute, ...patch } });
  const hour = (h: number) => `${String(h).padStart(2, '0')}:00`;

  return (
    <Screen tabs={false}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
        <Icon name="back" size={22} color={T.link} strokeWidth={2.4} />
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: T.link }}>{t('tab.alerts')}</Text>
      </Pressable>
      <Title>{t('rules.title')}</Title>

      {!isPro && (
        <Card style={{ gap: 12 }}>
          <Body>{t('rules.pro')}</Body>
          <Button title={t('rules.getPro')} onPress={() => router.push('/pro')} />
        </Card>
      )}

      <View style={{ gap: 12, opacity: isPro ? 1 : 0.5 }} pointerEvents={isPro ? 'auto' : 'none'}>
        {KINDS.map((k) => {
          const lim = RULE_LIMITS[k];
          const r = rules.find((x) => x.kind === k);
          return (
            <Card key={k} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 15, color: T.text }}>{t(`rules.${k}` as Key)}</Text>
                <Switch accessibilityLabel={t(`rules.${k}` as Key)} value={!!r?.enabled} onValueChange={(v) => setRule(k, { enabled: v })} />
              </View>
              {r?.enabled && (
                <Stepper value={r.threshold} unit={lim.unit ? ` ${lim.unit}` : ''} min={lim.min} max={lim.max} step={lim.step} label={t(`rules.${k}` as Key)} onChange={(v) => setRule(k, { threshold: v })} />
              )}
            </Card>
          );
        })}

        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 16, color: T.text }}>{t('rules.commute')}</Text>
              <Body style={{ fontSize: 13, lineHeight: 18 }}>{t('rules.commuteSub')}</Body>
            </View>
            <Switch accessibilityLabel={t('rules.commute')} value={commute.enabled} onValueChange={(v) => setCommute({ enabled: v, placeId: commute.placeId ?? places[0]?.id ?? null })} />
          </View>
          {commute.enabled && (
            places.length === 0 ? (
              <Notice>{t('rules.noPlace')}</Notice>
            ) : (
              <>
                <Label>{t('rules.place')}</Label>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {places.map((p) => (
                    <Chip key={p.id} title={p.name} on={commute.placeId === p.id} onPress={() => setCommute({ placeId: p.id })} />
                  ))}
                </View>
                <Label>{t('rules.from')}</Label>
                <Stepper value={commute.startHour} unit=":00" min={0} max={22} step={1} label={t('rules.from')} onChange={(v) => setCommute({ startHour: v, endHour: Math.max(commute.endHour, v + 1) })} />
                <Label>{t('rules.to')}</Label>
                <Stepper value={commute.endHour} unit=":00" min={commute.startHour + 1} max={23} step={1} label={t('rules.to')} onChange={(v) => setCommute({ endHour: v })} />
                <Label>{t('rules.days')}</Label>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {DAYS.map((d) => (
                    <Chip
                      key={d}
                      title={(lang === 'hi' ? DAY_HI : DAY_EN)[d]}
                      on={commute.days.includes(d)}
                      onPress={() => setCommute({ days: commute.days.includes(d) ? commute.days.filter((x) => x !== d) : [...commute.days, d].sort() })}
                    />
                  ))}
                </View>
                <Text style={{ fontFamily: font.regular, fontSize: 12, color: T.muted }}>{hour(commute.startHour)} – {hour(commute.endHour)}</Text>
              </>
            )
          )}
        </Card>
      </View>
    </Screen>
  );
}
