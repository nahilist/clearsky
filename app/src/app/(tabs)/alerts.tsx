import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { AlertBanner, Body, Card, Label, Notice, Screen, Skeleton, Title } from '../../components/ui';
import { useAlerts, useAllPlaces } from '../../lib/hooks';
import { clock } from '../../lib/format';
import { useT } from '../../i18n';
import { useStore } from '../../store';
import { font, T } from '../../theme';

export default function Alerts() {
  const t = useT();
  const history = useStore((s) => s.history);
  const places = useAllPlaces();
  const { items, loading } = useAlerts(places);
  const severe = useStore((s) => s.prefs.severe);
  const muted = useStore((s) => s.mutedUntil) > Date.now();

  return (
    <Screen>
      <Title>{t('alerts.title')}</Title>
      <Notice>{t('alerts.note')}</Notice>
      {!severe && <Notice tone="error">{t('alerts.off')}</Notice>}
      {muted && <Notice>{t('alerts.muted')}</Notice>}
      {loading && items.length === 0 && (
        <>
          <Skeleton h={76} />
          <Skeleton h={76} />
        </>
      )}
      {!loading && items.length === 0 && (
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Text style={{ fontFamily: font.heavy, fontSize: 20, color: T.text }}>{t('alerts.allClear')}</Text>
          <Body style={{ textAlign: 'center' }}>{places.length ? t('alerts.none') : t('alerts.addPlace')}</Body>
        </Card>
      )}
      {items.map(({ place, alert }) => (
        <View key={`${place.id}|${alert.key}`} style={{ gap: 6 }}>
          <AlertBanner alert={alert} place={place.name} onPress={() => router.push({ pathname: '/alert/[id]', params: { id: `${place.id}|${alert.key}` } })} />
          <Label>{`${alert.severity} · ${clock(alert.startsAt)} to ${clock(alert.endsAt)}`}</Label>
        </View>
      ))}
      <Card onPress={() => router.push('/rules')} label={t('alerts.custom')}>
        <Text style={{ fontFamily: font.bold, fontSize: 16, color: T.text }}>{t('alerts.custom')}</Text>
        <Body>{t('alerts.customSub')}</Body>
      </Card>

      <Label>{t('alerts.history')}</Label>
      {history.length === 0 ? (
        <Body>{t('alerts.noHistory')}</Body>
      ) : (
        <Card>
          {history.slice(0, 20).map((h) => (
            <View key={h.id} style={{ gap: 2, minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 14, color: T.text }}>{h.title}</Text>
              <Text style={{ fontFamily: font.regular, fontSize: 12, color: T.muted }}>{h.placeName} · {new Date(h.at).toLocaleString()}</Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
