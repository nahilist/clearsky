import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { Expo } from 'expo-server-sdk';
import Fastify from 'fastify';
import { config } from './config';
import { Prefs, deviceCount, migrate, ping, pool, removeDevice, saveDevice } from './db';
import { cacheSize, geocodeCached, getAir, getForecast, stats } from './forecast';
import { startJobs } from './jobs';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, trustProxy: config.trustProxy, bodyLimit: 16 * 1024, connectionTimeout: 15_000 });

await app.register(helmet, { global: true });
// Mobile carriers put thousands of users behind one IP (CGNAT), so per-IP limits are generous and
// cheap cached routes rely on the cache. Registrations are limited per push token instead.
await app.register(rateLimit, { max: config.rateLimitPerMin, timeWindow: '1 minute', allowList: (req) => req.url === '/healthz' || req.url === '/readyz' });

const finite = (min: number, max: number) => ({ type: 'number', minimum: min, maximum: max }) as const;

app.get('/healthz', async () => ({ ok: true }));
app.get('/readyz', async (_req, reply) => ((await ping()) ? { ok: true } : reply.code(503).send({ ok: false })));

app.get('/metrics', async (req, reply) => {
  if (process.env.METRICS_TOKEN && req.headers.authorization !== `Bearer ${process.env.METRICS_TOKEN}`) return reply.code(401).send({ error: 'unauthorized' });
  return { instance: process.env.HOSTNAME ?? 'local', devices: await deviceCount(), cacheCells: cacheSize(), ...stats, uptimeS: Math.round(process.uptime()), rssMb: Math.round(process.memoryUsage().rss / 1e6) };
});

app.get<{ Querystring: { lat: number; lon: number } }>(
  '/v1/forecast',
  { schema: { querystring: { type: 'object', required: ['lat', 'lon'], properties: { lat: finite(-90, 90), lon: finite(-180, 180) } } } },
  async (req, reply) => {
    try {
      const { forecast, stale } = await getForecast(req.query.lat, req.query.lon);
      // Let phones and any CDN in front reuse the response for 5 minutes, and serve stale for 10 more while revalidating.
      reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      if (stale) reply.header('X-ClearSky-Stale', '1');
      return forecast;
    } catch (e) {
      req.log.error({ err: String(e) }, 'forecast unavailable');
      return reply.code(503).header('Retry-After', '30').send({ error: 'forecast_unavailable' });
    }
  },
);

app.get<{ Querystring: { lat: number; lon: number } }>(
  '/v1/air',
  { schema: { querystring: { type: 'object', required: ['lat', 'lon'], properties: { lat: finite(-90, 90), lon: finite(-180, 180) } } } },
  async (req, reply) => {
    try {
      reply.header('Cache-Control', 'public, max-age=900, stale-while-revalidate=900');
      return await getAir(req.query.lat, req.query.lon);
    } catch {
      return reply.code(503).header('Retry-After', '30').send({ error: 'air_unavailable' });
    }
  },
);

app.get<{ Querystring: { q: string } }>(
  '/v1/geocode',
  { schema: { querystring: { type: 'object', required: ['q'], properties: { q: { type: 'string', minLength: 2, maxLength: 80 } } } }, config: { rateLimit: { max: 40, timeWindow: '1 minute' } } },
  async (req, reply) => {
    try {
      reply.header('Cache-Control', 'public, max-age=3600');
      return await geocodeCached(req.query.q);
    } catch {
      return reply.code(503).send({ error: 'geocode_unavailable' });
    }
  },
);

const prefsSchema = {
  type: 'object',
  required: ['severe', 'rainSoon', 'daily', 'quietOn', 'quietStart', 'quietEnd'],
  properties: {
    severe: { type: 'boolean' },
    rainSoon: { type: 'boolean' },
    daily: { type: 'boolean' },
    quietOn: { type: 'boolean' },
    quietStart: { type: 'integer', minimum: 0, maximum: 23 },
    quietEnd: { type: 'integer', minimum: 0, maximum: 23 },
    air: { type: 'boolean' },
    rules: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        required: ['id', 'kind', 'threshold', 'enabled'],
        additionalProperties: false,
        properties: { id: { type: 'string', maxLength: 24 }, kind: { enum: ['rain', 'heat', 'cold', 'wind', 'uv'] }, threshold: { type: 'number', minimum: -50, maximum: 200 }, enabled: { type: 'boolean' } },
      },
    },
    commute: {
      type: 'object',
      required: ['enabled', 'placeId', 'startHour', 'endHour', 'days'],
      additionalProperties: false,
      properties: {
        enabled: { type: 'boolean' },
        placeId: { type: ['string', 'null'], maxLength: 32 },
        startHour: { type: 'integer', minimum: 0, maximum: 23 },
        endHour: { type: 'integer', minimum: 1, maximum: 24 },
        days: { type: 'array', maxItems: 7, items: { type: 'integer', minimum: 0, maximum: 6 } },
      },
    },
  },
} as const;

type DeviceBody = {
  token: string;
  platform: 'ios' | 'android';
  tz: string;
  lang?: 'en' | 'hi';
  places: { lat: number; lon: number; name: string }[];
  prefs: Prefs;
  mutedUntil: number;
};

app.put<{ Body: DeviceBody }>(
  '/v1/devices',
  {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'platform', 'tz', 'places', 'prefs'],
        additionalProperties: false,
        properties: {
          token: { type: 'string', maxLength: 100 },
          platform: { enum: ['ios', 'android'] },
          tz: { type: 'string', maxLength: 64 },
          lang: { enum: ['en', 'hi'] },
          mutedUntil: { type: 'number' },
          prefs: prefsSchema,
          places: {
            type: 'array',
            maxItems: 12,
            items: { type: 'object', required: ['lat', 'lon', 'name'], properties: { lat: finite(-90, 90), lon: finite(-180, 180), name: { type: 'string', maxLength: 80 } } },
          },
        },
      },
    },
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
        hook: 'preHandler',
        keyGenerator: (req: { body?: unknown; ip: string }) => (req.body as { token?: string } | undefined)?.token ?? req.ip,
      },
    },
  },
  async (req, reply) => {
    if (!Expo.isExpoPushToken(req.body.token)) return reply.code(400).send({ error: 'invalid_token' });
    await saveDevice({ ...req.body, lang: req.body.lang ?? 'en', mutedUntil: req.body.mutedUntil ?? 0 });
    return reply.code(204).send();
  },
);

app.delete<{ Querystring: { token: string } }>(
  '/v1/devices',
  { schema: { querystring: { type: 'object', required: ['token'], properties: { token: { type: 'string', maxLength: 100 } } } } },
  async (req, reply) => {
    await removeDevice(req.query.token);
    return reply.code(204).send();
  },
);

await migrate();
const stopJobs = config.jobsEnabled ? startJobs() : () => undefined;

const shutdown = async (sig: string) => {
  app.log.info({ sig }, 'shutting down');
  stopJobs();
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (e) => app.log.error({ err: String(e) }, 'unhandledRejection'));

await app.listen({ port: config.port, host: '0.0.0.0' });
