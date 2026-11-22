# ClearSky

One Expo / React Native codebase for iOS and Android, plus a small caching API.
iOS ships the dark glass look, Android ships Material 3 (chosen at runtime in `app/src/theme.ts` and `app/src/components/TabBar.tsx`).

```
app/      Expo SDK 58, expo-router, TypeScript
server/   Fastify + Postgres API (forecast cache, geocoding proxy, push alerts)
supabase/ PostgreSQL schema, triggers & Row Level Security (RLS)
```

## Engineering & Product Documentation

Comprehensive MVP and production architecture documentation is available in the [`docs/`](./docs) directory:
* 📄 **[Product Requirements Document (PRD)](./docs/PRD.md)** — Vision, user personas, MVP vs. Production scope, functional specifications, and KPI metrics.
* 🏛️ **[System Architecture](./docs/ARCHITECTURE.md)** — Monorepo structure, system topology, weather request sequence, Supabase sync, and advisory lock worker.
* 🛡️ **[Security Architecture](./docs/SECURITY.md)** — STRIDE threat model, Row Level Security (RLS), JWT validation, CGNAT rate limiting, and spatial grid quantization.
* 🗄️ **[Database Schema](./docs/DATABASE_SCHEMA.md)** — Full ERD diagrams, Supabase auth tables, Fastify push worker tables, and data pruning lifecycle.
* 🚀 **[Deployment & DevOps Runbook](./docs/DEPLOYMENT_DEVOPS.md)** — EAS Build mobile guide, multi-stage Dockerfile, Docker Compose stack, CI/CD pipeline, and incident response.


## What is built

| Screen | Notes |
|---|---|
| Onboarding | Welcome, location and notification priming |
| Today | Hero, daily advice, 12-hour strip (tap for 48 h charts), minute-by-minute rain, AQI card, UV / rain / wind / humidity, 10-day list, sun and moon card, share |
| Hourly | 48-hour temperature, rain and wind charts |
| Radar | Map with RainViewer rain tiles, past and forecast frames |
| Alerts | Forecast alerts, air quality, your custom rules, commute warnings, plus a local alert history |
| Custom alerts (Pro) | Rain, heat, cold, wind and UV thresholds; commute window with place and days |
| Share | Forecast card rendered to an image and shared via the system sheet |
| Places | Search, add, remove, free limit of 3 saved places |
| ClearSky Pro | RevenueCat paywall. Pro unlocks unlimited places, custom alerts, commute warnings and 6 h rain (free is 2 h) |
| Settings | Language (English / Hindi), alert toggles incl. AQI, quiet hours, units, delete my data |
| Widgets | Preview and instructions only |

The 10 features of this release: Hindi + English, AQI card and alert, custom alert rules, commute alerts, smart daily advice, 48 h charts, minute-by-minute rain, sun and moon, share card, alert history.

Caveats: UI translation covers Today, Hourly, Alerts, Rules, Share, Settings and the tab bar. Radar, onboarding, Pro, Places and Widgets screens are still English only. Alert and push text is fully localised. Pro gating of rules and commute is enforced by the client (rules are only sent to the server for Pro users); a modified client could bypass it, so validate entitlement server-side with RevenueCat webhooks before relying on it for revenue. The share card, charts and new screens have been type-checked and bundled but not run on a device.

Product rules enforced in code: severe alerts are never gated by Pro, never carry ads, and always pass quiet hours.

## Run it

```bash
# API (needs Node 20+ and a Postgres; DATABASE_URL defaults to localhost)
cd server && npm ci && npm run dev          # http://localhost:8080

# App
cd app && npm ci
cp .env.example .env                         # EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8080
npx expo start                               # Expo Go works for Today, Places, Alerts, Settings
```

Leave `EXPO_PUBLIC_API_URL` empty and the app calls Open-Meteo directly (development only).
Radar, push notifications and purchases need a development build: `npx eas build -p ios --profile development` (or `android`).

## Before you ship (placeholders to replace)

1. `app/app.json`: `bundleIdentifier`, Android `package`, `extra.eas.projectId` (run `eas init`), Google Maps Android key, Sentry org.
2. `app/src/app/(tabs)/settings.tsx` and `pro.tsx`: privacy, terms and support URLs. Both stores require a real privacy policy.
3. RevenueCat: create products, an entitlement named `pro`, a current offering; put the public SDK keys in `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY`.
4. Push: `eas credentials` for APNs and FCM v1; set `EXPO_ACCESS_TOKEN` on the server.
5. `app/eas.json`: your real API URLs.
6. Weather data licence: see "Data licences" below.

## Scale and reliability

The API is stateless and the database is Postgres, so you add servers instead of rewriting anything.

```
phones -> (CDN, optional) -> nginx -> api x N  -> Postgres
                                       |-> Open-Meteo (cached per ~11 km grid cell)
                                       '-> Expo push service
```

- **Stateless replicas.** `docker compose up -d --scale api=4` adds servers. Each keeps its own forecast cache, so extra replicas mean slightly more upstream calls, not different behaviour.
- **One job leader.** Alerts, push receipts and cleanup run behind Postgres advisory locks. Only one replica runs a job per tick, and if it dies another takes over on the next tick.
- **Migrations** run at start-up under a lock, so several replicas can boot at once.
- **Rate limits** are generous per IP (mobile carriers put many users behind one IP) and strict per push token for registrations.
- **Graceful degradation.** If the weather provider fails, cached forecasts are served for up to 3 hours. The app also keeps its last forecast and shows it offline.

### Measured (sandbox, real Postgres, fake weather upstream)

| Check | Result |
|---|---|
| One API process, 200 connections, 500 grid cells, 15 s | about 13,700 requests/s, p99 36 ms, 0 errors; 206k requests caused 500 upstream calls |
| 200,000 devices, 400,000 places, about 4,000 grid cells | read every alert target in 3.9 s; 5,000 dedupe checks in 10 ms; 500 concurrent registrations in 0.3 s |
| 2 replicas, 8 job ticks | each tick ran on exactly one replica; after one replica was killed the other kept serving and running the job |
| 300 registrations from one IP with different tokens | all accepted; same token repeated is limited to 20 per minute |

These are database and API numbers. In production the alert job is dominated by weather-provider calls (one per occupied cell every 10 minutes), so its duration depends on the provider, not on user count.

### Rough capacity

| Users (installs) | What you need |
|---|---|
| up to about 50,000 | 2 API replicas (1 vCPU / 1 GB each), small managed Postgres |
| 50,000 to 500,000 | 3 to 6 replicas, Postgres with a replica for backups, CDN in front, paid weather plan sized to occupied cells |
| 500,000 and more | Move the alert job to its own worker, add Redis as a shared forecast cache, shard push sending. The code is structured for this but it is not built |

### Not verified here

The Docker images and compose file were written but not built (no Docker in the sandbox). Real push delivery, real weather-provider latency, RevenueCat purchases, and the app on physical devices are untested. Run the staging checklist below before launch.

## Staging checklist (do this before the public launch)

1. `docker compose up -d --build`, then `curl localhost:8080/readyz` and `/metrics` (with `Authorization: Bearer $METRICS_TOKEN`).
2. Build the development app (`eas build --profile development`), install on one iPhone and one Android phone, point it at staging.
3. Walk through: onboarding, deny and allow location, add and remove places, airplane mode (cached forecast shows), radar play, a test push to your own token.
4. Trigger a real alert: set `quietOn` false, use a place with rain forecast, confirm one push arrives and no duplicate on the next tick.
5. RevenueCat sandbox purchase, restore, and cancel on both stores.
6. Roll out to TestFlight and Play internal testing with 20 to 50 people for a week, watch Sentry and `/metrics`.
7. Set up: Postgres backups, uptime alert on `/readyz`, Sentry alerts, a spend alert on the weather API.

## Data licences (important)

- **Open-Meteo**: the free API is for non-commercial use only. A paid app with a subscription is commercial, so buy their API plan and set `OPEN_METEO_API_KEY` and `OPEN_METEO_BASE=https://customer-api.open-meteo.com`. Keep the attribution that the app already shows. Check their current terms.
- **RainViewer**: free radar tiles have usage limits and may restrict zoom or frames. Confirm their current terms for your use, or swap in a licensed radar source in `radar.tsx`.
- **Alerts are not official warnings.** They are derived from forecast numbers and labelled that way in the UI. To relay official warnings (IMD, NWS, MeteoAlarm), add their CAP feeds to `server/src/jobs.ts` and show the issuer.

## Roadmap (not built)

- Native home and lock screen widgets (WidgetKit, Glance)
- Extra radar layers (wind, temperature, air quality), which the Pro screen should only advertise once they exist
- Official warning feeds, full UI localisation of remaining screens, analytics
- Store listing assets and screenshots

## Tests and checks

```bash
cd app && npx tsc --noEmit                    # passes; both iOS and Android bundles export
cd server && npx tsc --noEmit && npm test     # 25 tests: alert logic, new features, and real throwaway Postgres (migrations, dedupe, leader lock, per-device alert job, Hindi push)
DATABASE_URL=... npx tsx server/src/scale.ts   # 200k-device scale check
```
