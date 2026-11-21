const int = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export const config = {
  port: int(process.env.PORT, 8080),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://clearsky:clearsky@localhost:5432/clearsky',
  pgPoolMax: int(process.env.PG_POOL_MAX, 10),
  // Free Open-Meteo is non-commercial. For a commercial app set OPEN_METEO_API_KEY (customer plan)
  // and OPEN_METEO_BASE=https://customer-api.open-meteo.com
  openMeteoBase: process.env.OPEN_METEO_BASE ?? 'https://api.open-meteo.com',
  openMeteoKey: process.env.OPEN_METEO_API_KEY ?? '',
  airBase: process.env.AIR_BASE ?? 'https://air-quality-api.open-meteo.com',
  geocodeBase: process.env.GEOCODE_BASE ?? 'https://geocoding-api.open-meteo.com',
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN,
  cacheTtlMs: int(process.env.CACHE_TTL_SECONDS, 600) * 1000,
  staleMaxMs: int(process.env.STALE_MAX_SECONDS, 3 * 3600) * 1000,
  cacheMax: int(process.env.CACHE_MAX_CELLS, 20000),
  rateLimitPerMin: int(process.env.RATE_LIMIT_PER_MIN, 600),
  alertJobEveryMs: int(process.env.ALERT_JOB_MINUTES, 10) * 60_000,
  alertConcurrency: int(process.env.ALERT_CONCURRENCY, 8),
  jobsEnabled: process.env.JOBS_ENABLED !== 'false',
  trustProxy: process.env.TRUST_PROXY !== 'false',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? '',
  supabaseJwksUrl: process.env.SUPABASE_JWKS_URL ?? '',
};
