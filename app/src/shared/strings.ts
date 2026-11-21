import type { Lang } from './types';

// Text that appears in alerts, pushes and advice. Kept here (not in the app) so the server can
// write notifications in the user's language. UI strings live in app/src/i18n.ts.

const en = {
  rain_soon: {
    title: (m: number) => `Rain in about ${m} min`,
    summary: (t: string) => `Rain is expected to reach this location around ${t}.`,
    actions: ['Take an umbrella or jacket.', 'Finish outdoor errands first if you can.'],
    reason: 'Short-range radar-style forecast shows rain approaching.',
  },
  heavy_rain: {
    warn: 'Flood risk: extreme rain',
    watch: 'Heavy rain expected',
    summary: (mm: number) => `About ${mm} mm may fall in the next 3 hours.`,
    actions: ['Move vehicles off underpasses and low streets.', 'Charge your phone and keep a torch ready.', 'Avoid non-essential travel during the heaviest hours.'],
    reason: (mm: number) => `Forecast rainfall of ${mm} mm in 3 hours at this place.`,
  },
  heat: {
    warn: 'Dangerous heat',
    watch: 'Heat advisory',
    summary: (v: number) => `It may feel like ${v}° in the next 12 hours.`,
    actions: ['Drink water regularly.', 'Avoid strenuous activity at midday.', 'Check on children and older relatives.'],
    reason: 'Feels-like temperature is above a safe comfort range.',
  },
  wind: {
    warn: 'Damaging winds',
    watch: 'Strong wind gusts',
    summary: (v: number) => `Gusts up to ${v} km/h are forecast.`,
    actions: ['Secure loose items outdoors.', 'Stay away from trees and hoardings.'],
    reason: 'Forecast gusts are well above normal.',
  },
  uv: {
    extreme: 'Extreme UV today',
    high: 'Very high UV today',
    summary: (v: number) => `UV index peaks at ${v}.`,
    actions: ['Use sunscreen and sunglasses.', 'Seek shade between 10 AM and 3 PM.'],
    reason: 'Peak UV is in the very high range.',
  },
  frost: {
    title: 'Freezing temperatures',
    summary: (v: number) => `Temperatures may drop to ${v}°.`,
    actions: ['Protect plants and pipes.', 'Watch for icy roads.'],
    reason: 'Forecast low is at or below freezing.',
  },
  air: {
    hazardous: 'Hazardous air quality',
    unhealthy: 'Unhealthy air quality',
    summary: (aqi: number, cat: string) => `US AQI is ${aqi}: ${cat}.`,
    actions: ['Wear an N95 mask outdoors.', 'Avoid outdoor exercise.', 'Keep windows closed.'],
    reason: 'Air pollution is at a level that can harm health.',
    cats: ['Good', 'Moderate', 'Unhealthy for sensitive groups', 'Unhealthy', 'Very unhealthy', 'Hazardous'],
  },
  custom: {
    title: { rain: (t: number) => `Your alert: rain over ${t} mm`, heat: (t: number) => `Your alert: feels above ${t}°`, cold: (t: number) => `Your alert: below ${t}°`, wind: (t: number) => `Your alert: gusts over ${t} km/h`, uv: (t: number) => `Your alert: UV above ${t}` },
    summary: { rain: (v: number) => `About ${v} mm in the next 3 hours.`, heat: (v: number) => `Feels like ${v}° in the next 12 hours.`, cold: (v: number) => `Drops to ${v}° in the next 12 hours.`, wind: (v: number) => `Gusts up to ${v} km/h.`, uv: (v: number) => `UV peaks at ${v} today.` },
    actions: ['Plan around this.'],
    reason: 'You set this alert in Custom alerts.',
  },
  commute: {
    title: 'Rain during your commute',
    summary: (a: number, b: number, pop: number) => `Up to ${pop}% chance of rain between ${a}:00 and ${b}:00.`,
    actions: ['Carry an umbrella or raincoat.', 'Consider leaving a little earlier.'],
    reason: 'This is for the commute time you set.',
  },
  advice: {
    umbrella: 'Carry an umbrella.',
    sunscreen: 'Use sunscreen, UV is high.',
    light: 'Wear light, breathable clothes.',
    jacket: 'Take a jacket, it will be cool.',
    mask: 'Air is poor, consider a mask outdoors.',
    water: 'It will feel very hot, drink plenty of water.',
    wind: 'Windy today, secure loose items.',
    clear: 'A pleasant day, no special precautions.',
  },
  briefing: { title: (p: string) => `Today in ${p}`, body: (h: number, l: number, pop: number) => `High ${h}°, low ${l}°. Rain chance ${pop}%.` },
  moon: ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'],
};

const hi: typeof en = {
  rain_soon: {
    title: (m) => `लगभग ${m} मिनट में बारिश`,
    summary: (t) => `${t} के आसपास यहाँ बारिश पहुँचने की संभावना है।`,
    actions: ['छाता या जैकेट साथ रखें।', 'हो सके तो बाहर के काम पहले निपटा लें।'],
    reason: 'कम अवधि के पूर्वानुमान में बारिश पास आती दिख रही है।',
  },
  heavy_rain: {
    warn: 'बाढ़ का खतरा: अत्यधिक बारिश',
    watch: 'भारी बारिश की संभावना',
    summary: (mm) => `अगले 3 घंटे में लगभग ${mm} मिमी बारिश हो सकती है।`,
    actions: ['गाड़ियाँ अंडरपास और निचली सड़कों से हटा लें।', 'फ़ोन चार्ज रखें और टॉर्च तैयार रखें।', 'सबसे तेज़ बारिश के समय गैर-ज़रूरी यात्रा से बचें।'],
    reason: (mm) => `इस जगह 3 घंटे में ${mm} मिमी बारिश का पूर्वानुमान है।`,
  },
  heat: {
    warn: 'खतरनाक गर्मी',
    watch: 'गर्मी की चेतावनी',
    summary: (v) => `अगले 12 घंटे में तापमान ${v}° जैसा महसूस हो सकता है।`,
    actions: ['नियमित रूप से पानी पिएँ।', 'दोपहर में भारी मेहनत से बचें।', 'बच्चों और बुज़ुर्गों का ध्यान रखें।'],
    reason: 'महसूस होने वाला तापमान सामान्य आराम की सीमा से ऊपर है।',
  },
  wind: {
    warn: 'विनाशकारी हवाएँ',
    watch: 'तेज़ हवा के झोंके',
    summary: (v) => `${v} किमी/घंटा तक के झोंकों का पूर्वानुमान है।`,
    actions: ['बाहर रखा ढीला सामान सुरक्षित कर लें।', 'पेड़ों और होर्डिंग से दूर रहें।'],
    reason: 'पूर्वानुमानित झोंके सामान्य से काफ़ी ज़्यादा हैं।',
  },
  uv: {
    extreme: 'आज बेहद ज़्यादा UV',
    high: 'आज बहुत ज़्यादा UV',
    summary: (v) => `UV इंडेक्स ${v} तक पहुँचेगा।`,
    actions: ['सनस्क्रीन और धूप का चश्मा लगाएँ।', 'सुबह 10 से दोपहर 3 बजे के बीच छाँव में रहें।'],
    reason: 'अधिकतम UV बहुत ज़्यादा श्रेणी में है।',
  },
  frost: {
    title: 'जमाने वाला तापमान',
    summary: (v) => `तापमान ${v}° तक गिर सकता है।`,
    actions: ['पौधों और पाइपों को बचाएँ।', 'सड़कों पर फिसलन से सावधान रहें।'],
    reason: 'अनुमानित न्यूनतम तापमान शून्य या उससे कम है।',
  },
  air: {
    hazardous: 'हवा बेहद खराब (खतरनाक)',
    unhealthy: 'हवा की गुणवत्ता खराब',
    summary: (aqi, cat) => `US AQI ${aqi}: ${cat}।`,
    actions: ['बाहर निकलते समय N95 मास्क पहनें।', 'बाहर की कसरत टालें।', 'खिड़कियाँ बंद रखें।'],
    reason: 'वायु प्रदूषण का स्तर स्वास्थ्य के लिए हानिकारक है।',
    cats: ['अच्छा', 'मध्यम', 'संवेदनशील लोगों के लिए खराब', 'खराब', 'बहुत खराब', 'खतरनाक'],
  },
  custom: {
    title: { rain: (t) => `आपका अलर्ट: बारिश ${t} मिमी से अधिक`, heat: (t) => `आपका अलर्ट: ${t}° से अधिक गर्मी`, cold: (t) => `आपका अलर्ट: ${t}° से कम तापमान`, wind: (t) => `आपका अलर्ट: झोंके ${t} किमी/घंटा से अधिक`, uv: (t) => `आपका अलर्ट: UV ${t} से अधिक` },
    summary: { rain: (v) => `अगले 3 घंटे में लगभग ${v} मिमी।`, heat: (v) => `अगले 12 घंटे में ${v}° जैसा महसूस होगा।`, cold: (v) => `अगले 12 घंटे में ${v}° तक गिरेगा।`, wind: (v) => `झोंके ${v} किमी/घंटा तक।`, uv: (v) => `आज UV ${v} तक।` },
    actions: ['इसके अनुसार योजना बनाएँ।'],
    reason: 'यह अलर्ट आपने "कस्टम अलर्ट" में सेट किया है।',
  },
  commute: {
    title: 'आपके सफ़र के समय बारिश',
    summary: (a, b, pop) => `${a}:00 से ${b}:00 के बीच बारिश की संभावना ${pop}% तक।`,
    actions: ['छाता या रेनकोट रखें।', 'थोड़ा पहले निकलने पर विचार करें।'],
    reason: 'यह अलर्ट आपके तय सफ़र के समय के लिए है।',
  },
  advice: {
    umbrella: 'छाता साथ रखें।',
    sunscreen: 'UV ज़्यादा है, सनस्क्रीन लगाएँ।',
    light: 'हल्के, सूती कपड़े पहनें।',
    jacket: 'जैकेट साथ रखें, ठंड रहेगी।',
    mask: 'हवा खराब है, बाहर मास्क पहनें।',
    water: 'बहुत गर्मी लगेगी, खूब पानी पिएँ।',
    wind: 'आज तेज़ हवा है, ढीला सामान संभालें।',
    clear: 'आज मौसम सुहाना है, कोई खास सावधानी नहीं।',
  },
  briefing: { title: (p) => `आज ${p} में`, body: (h, l, pop) => `अधिकतम ${h}°, न्यूनतम ${l}°। बारिश की संभावना ${pop}%।` },
  moon: ['अमावस्या', 'शुक्ल पक्ष (पतला चाँद)', 'अर्ध चंद्र (शुक्ल)', 'शुक्ल पक्ष (बढ़ता चाँद)', 'पूर्णिमा', 'कृष्ण पक्ष (घटता चाँद)', 'अर्ध चंद्र (कृष्ण)', 'कृष्ण पक्ष (पतला चाँद)'],
};

export const TEXT: Record<Lang, typeof en> = { en, hi };
export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'hi';
