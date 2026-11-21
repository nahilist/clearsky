// Pure TypeScript, no React Native imports: this folder is shared by the app and the server.

export type Hour = {
  time: string; // local ISO "YYYY-MM-DDTHH:mm"
  temp: number;
  feels: number;
  pop: number; // precipitation probability %
  precip: number; // mm
  code: number; // WMO weather code
  wind: number; // km/h
  gust: number; // km/h
  uv: number;
  isDay: boolean;
};

export type Day = {
  date: string; // YYYY-MM-DD
  max: number;
  min: number;
  pop: number;
  precip: number;
  code: number;
  uvMax: number;
  sunrise: string;
  sunset: string;
};

export type Forecast = {
  lat: number;
  lon: number;
  tz: string;
  fetchedAt: number; // epoch ms
  current: {
    time: string;
    temp: number;
    feels: number;
    code: number;
    wind: number;
    gust: number;
    humidity: number;
    pressure: number;
    isDay: boolean;
  };
  hourly: Hour[]; // next 48 hours
  nowcast: { time: string; precip: number }[]; // 15-minute steps, next 2 hours
  daily: Day[]; // 10 days
};

export type Severity = 'info' | 'watch' | 'warning';

export type AlertKind = 'rain_soon' | 'heavy_rain' | 'heat' | 'wind' | 'uv' | 'frost' | 'air' | 'custom' | 'commute';

export type WeatherAlert = {
  key: string; // stable dedupe key, e.g. "heavy_rain:2026-11-18"
  kind: AlertKind;
  severity: Severity;
  title: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  actions: string[];
  reason: string;
};

export type Lang = 'en' | 'hi';

export type CustomRuleKind = 'rain' | 'heat' | 'cold' | 'wind' | 'uv';

/** rain: mm in next 3 h | heat: feels-like max in next 12 h | cold: min temp in next 12 h | wind: gust km/h | uv: today's peak */
export type CustomRule = { id: string; kind: CustomRuleKind; threshold: number; enabled: boolean };

export type Commute = {
  enabled: boolean;
  placeId: string | null;
  startHour: number; // 0-23, local
  endHour: number; // exclusive
  days: number[]; // 0 = Sunday ... 6 = Saturday
};

export type AirQuality = {
  lat: number;
  lon: number;
  fetchedAt: number;
  time: string;
  aqi: number; // US AQI
  pm25: number;
  pm10: number;
};
