import type { Lang } from './shared/types';
import { useStore } from './store';

// UI strings. Text inside alerts, pushes and advice lives in shared/strings.ts so the server can use it too.
const en = {
  'tab.today': 'Today', 'tab.radar': 'Radar', 'tab.alerts': 'Alerts', 'tab.places': 'Places', 'tab.settings': 'Settings',
  'today.noAds': 'No ads in alerts', 'today.next12': 'Next 12 hours', 'today.rain': 'Rain chance', 'today.uv': 'UV index', 'today.wind': 'Wind',
  'today.humidity': 'Humidity', 'today.tenDay': '10-day forecast', 'today.feels': 'Feels like', 'today.advice': 'Today\'s advice',
  'today.hourly': 'Hourly details', 'today.share': 'Share forecast', 'today.widgets': 'Add a home screen widget', 'today.little': 'Little rain today',
  'today.rainMm': '{n} mm today', 'today.uvVery': 'Very high at midday', 'today.uvHigh': 'High at midday', 'today.uvLow': 'Moderate or lower', 'today.gusts': 'Gusts {v}',
  'today.sunset': 'Sunset {t}', 'today.now': 'Now',
  'air.title': 'Air quality', 'air.pm25': 'PM2.5 {v} µg/m³', 'air.scale': 'US AQI scale',
  'rainnow.title': 'Rain, minute by minute', 'rainnow.none': 'No rain expected', 'rainnow.peak': 'Heaviest {v} mm/15 min', 'rainnow.pro': 'See the next 6 hours with Pro', 'rainnow.h2': 'Next 2 hours', 'rainnow.h6': 'Next 6 hours',
  'sun.title': 'Sun and moon', 'sun.rise': 'Sunrise', 'sun.set': 'Sunset', 'sun.daylight': 'Daylight', 'sun.golden': 'Golden hour', 'sun.moon': 'Moon', 'sun.lit': '{n}% lit',
  'alerts.title': 'Alerts', 'alerts.note': 'Alerts are generated from forecast data for your places. They are not official government warnings. Severe alerts are always free and never carry ads.',
  'alerts.allClear': 'All clear', 'alerts.none': 'No alerts for your places right now.', 'alerts.addPlace': 'Add a place to start getting alerts.',
  'alerts.history': 'Recent alerts', 'alerts.custom': 'Custom alerts and commute', 'alerts.customSub': 'Set your own thresholds and get warned on your commute.',
  'alerts.off': 'Severe weather notifications are off. Turn them on in Settings.', 'alerts.muted': 'Banners are muted for a few hours. Severe notifications still arrive.',
  'alerts.noHistory': 'Nothing yet. Alerts you receive will be listed here.',
  'hourly.title': 'Next 48 hours', 'hourly.temp': 'Temperature', 'hourly.rain': 'Rain', 'hourly.wind': 'Wind', 'hourly.high': 'High', 'hourly.low': 'Low', 'hourly.total': 'Total', 'hourly.peak': 'Peak',
  'rules.title': 'Custom alerts', 'rules.pro': 'Custom alerts and commute warnings are part of ClearSky Pro. Safety alerts stay free.', 'rules.getPro': 'Get ClearSky Pro',
  'rules.rain': 'Rain in next 3 h above', 'rules.heat': 'Feels-like (12 h) above', 'rules.cold': 'Temperature (12 h) below', 'rules.wind': 'Wind gusts above', 'rules.uv': 'UV index above',
  'rules.commute': 'Commute alert', 'rules.commuteSub': 'Warns you when rain is likely during your commute.', 'rules.place': 'Place', 'rules.from': 'Leave at', 'rules.to': 'Arrive by', 'rules.days': 'Days',
  'rules.noPlace': 'Add a place first.',
  'share.title': 'Share forecast', 'share.button': 'Share image', 'share.error': 'Could not share the image on this device.', 'share.from': 'ClearSky forecast',
  'settings.title': 'Settings', 'settings.alerts': 'Alerts', 'settings.severe': 'Severe weather', 'settings.severeSub': 'Always free. Never behind Pro.', 'settings.rainSoon': 'Rain starting soon',
  'settings.rainSoonSub': 'Minutes before it reaches you', 'settings.daily': 'Daily briefing', 'settings.dailySub': 'Advice for the day at 7:30 AM', 'settings.air': 'Air quality alerts',
  'settings.airSub': 'When the air becomes unhealthy', 'settings.quiet': 'Quiet hours', 'settings.quietSub': '{a}:00 to {b}:00. Severe alerts still pass.', 'settings.units': 'Units',
  'settings.temp': 'Temperature', 'settings.windSpeed': 'Wind speed', 'settings.language': 'Language', 'settings.pro': 'ClearSky Pro', 'settings.proOn': 'Pro is active', 'settings.proGet': 'Get ClearSky Pro',
  'settings.proManage': 'Manage or restore your subscription.', 'settings.proSell': 'Unlimited places, custom alerts, commute warnings and 6-hour rain. Cancel anytime.', 'settings.about': 'About',
  'settings.widgets': 'Home screen widgets', 'settings.privacy': 'Privacy policy', 'settings.terms': 'Terms of use', 'settings.support': 'Contact support', 'settings.location': 'Location access',
  'settings.delete': 'Delete my data',
};

const hi: typeof en = {
  'tab.today': 'आज', 'tab.radar': 'रडार', 'tab.alerts': 'अलर्ट', 'tab.places': 'जगहें', 'tab.settings': 'सेटिंग्स',
  'today.noAds': 'अलर्ट में कोई विज्ञापन नहीं', 'today.next12': 'अगले 12 घंटे', 'today.rain': 'बारिश की संभावना', 'today.uv': 'UV इंडेक्स', 'today.wind': 'हवा',
  'today.humidity': 'नमी', 'today.tenDay': '10 दिन का पूर्वानुमान', 'today.feels': 'महसूस होता है', 'today.advice': 'आज की सलाह',
  'today.hourly': 'घंटे-दर-घंटे', 'today.share': 'पूर्वानुमान शेयर करें', 'today.widgets': 'होम स्क्रीन विजेट जोड़ें', 'today.little': 'आज कम बारिश',
  'today.rainMm': 'आज {n} मिमी', 'today.uvVery': 'दोपहर में बहुत ज़्यादा', 'today.uvHigh': 'दोपहर में ज़्यादा', 'today.uvLow': 'मध्यम या कम', 'today.gusts': 'झोंके {v}',
  'today.sunset': 'सूर्यास्त {t}', 'today.now': 'अभी',
  'air.title': 'हवा की गुणवत्ता', 'air.pm25': 'PM2.5 {v} µg/m³', 'air.scale': 'US AQI पैमाना',
  'rainnow.title': 'मिनट-दर-मिनट बारिश', 'rainnow.none': 'बारिश की उम्मीद नहीं', 'rainnow.peak': 'सबसे तेज़ {v} मिमी/15 मिनट', 'rainnow.pro': 'अगले 6 घंटे Pro में देखें', 'rainnow.h2': 'अगले 2 घंटे', 'rainnow.h6': 'अगले 6 घंटे',
  'sun.title': 'सूरज और चाँद', 'sun.rise': 'सूर्योदय', 'sun.set': 'सूर्यास्त', 'sun.daylight': 'दिन की लंबाई', 'sun.golden': 'गोल्डन आवर', 'sun.moon': 'चाँद', 'sun.lit': '{n}% रोशन',
  'alerts.title': 'अलर्ट', 'alerts.note': 'अलर्ट आपकी जगहों के पूर्वानुमान से बनते हैं। ये सरकारी चेतावनी नहीं हैं। गंभीर अलर्ट हमेशा मुफ़्त हैं और उनमें कभी विज्ञापन नहीं आते।',
  'alerts.allClear': 'सब ठीक है', 'alerts.none': 'अभी आपकी जगहों के लिए कोई अलर्ट नहीं।', 'alerts.addPlace': 'अलर्ट पाने के लिए कोई जगह जोड़ें।',
  'alerts.history': 'हाल के अलर्ट', 'alerts.custom': 'कस्टम अलर्ट और सफ़र', 'alerts.customSub': 'अपनी सीमाएँ तय करें और सफ़र के समय चेतावनी पाएँ।',
  'alerts.off': 'गंभीर मौसम की सूचनाएँ बंद हैं। सेटिंग्स में चालू करें।', 'alerts.muted': 'कुछ घंटों के लिए बैनर म्यूट हैं। गंभीर सूचनाएँ फिर भी आएँगी।',
  'alerts.noHistory': 'अभी कुछ नहीं। आपको मिले अलर्ट यहाँ दिखेंगे।',
  'hourly.title': 'अगले 48 घंटे', 'hourly.temp': 'तापमान', 'hourly.rain': 'बारिश', 'hourly.wind': 'हवा', 'hourly.high': 'अधिकतम', 'hourly.low': 'न्यूनतम', 'hourly.total': 'कुल', 'hourly.peak': 'सबसे ज़्यादा',
  'rules.title': 'कस्टम अलर्ट', 'rules.pro': 'कस्टम अलर्ट और सफ़र की चेतावनी ClearSky Pro का हिस्सा हैं। सुरक्षा अलर्ट मुफ़्त रहते हैं।', 'rules.getPro': 'ClearSky Pro लें',
  'rules.rain': 'अगले 3 घंटे में बारिश इससे ज़्यादा', 'rules.heat': 'महसूस तापमान (12 घंटे) इससे ज़्यादा', 'rules.cold': 'तापमान (12 घंटे) इससे कम', 'rules.wind': 'हवा के झोंके इससे ज़्यादा', 'rules.uv': 'UV इंडेक्स इससे ज़्यादा',
  'rules.commute': 'सफ़र का अलर्ट', 'rules.commuteSub': 'सफ़र के समय बारिश की संभावना हो तो चेतावनी देता है।', 'rules.place': 'जगह', 'rules.from': 'निकलने का समय', 'rules.to': 'पहुँचने का समय', 'rules.days': 'दिन',
  'rules.noPlace': 'पहले कोई जगह जोड़ें।',
  'share.title': 'पूर्वानुमान शेयर करें', 'share.button': 'इमेज शेयर करें', 'share.error': 'इस डिवाइस पर इमेज शेयर नहीं हो सकी।', 'share.from': 'ClearSky पूर्वानुमान',
  'settings.title': 'सेटिंग्स', 'settings.alerts': 'अलर्ट', 'settings.severe': 'गंभीर मौसम', 'settings.severeSub': 'हमेशा मुफ़्त। Pro के पीछे कभी नहीं।', 'settings.rainSoon': 'बारिश जल्द शुरू होगी',
  'settings.rainSoonSub': 'आप तक पहुँचने से कुछ मिनट पहले', 'settings.daily': 'रोज़ की ब्रीफ़िंग', 'settings.dailySub': 'सुबह 7:30 बजे दिन की सलाह', 'settings.air': 'हवा की गुणवत्ता के अलर्ट',
  'settings.airSub': 'जब हवा हानिकारक हो जाए', 'settings.quiet': 'शांत समय', 'settings.quietSub': '{a}:00 से {b}:00। गंभीर अलर्ट फिर भी आएँगे।', 'settings.units': 'इकाइयाँ',
  'settings.temp': 'तापमान', 'settings.windSpeed': 'हवा की गति', 'settings.language': 'भाषा', 'settings.pro': 'ClearSky Pro', 'settings.proOn': 'Pro चालू है', 'settings.proGet': 'ClearSky Pro लें',
  'settings.proManage': 'अपनी सदस्यता संभालें या बहाल करें।', 'settings.proSell': 'असीमित जगहें, कस्टम अलर्ट, सफ़र की चेतावनी और 6 घंटे की बारिश। कभी भी रद्द करें।', 'settings.about': 'के बारे में',
  'settings.widgets': 'होम स्क्रीन विजेट', 'settings.privacy': 'गोपनीयता नीति', 'settings.terms': 'उपयोग की शर्तें', 'settings.support': 'सहायता से संपर्क', 'settings.location': 'लोकेशन की अनुमति',
  'settings.delete': 'मेरा डेटा हटाएँ',
};

export type Key = keyof typeof en;
const DICT: Record<Lang, typeof en> = { en, hi };

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s = DICT[lang][key] ?? en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export function useT() {
  const lang = useStore((s) => s.lang);
  return (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars);
}
