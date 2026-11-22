<div align="center">

# ⛅ ClearSky

**Privacy-First, Hyper-Local Weather Intelligence Platform**

[![CI Pipeline](https://github.com/nahilist/clearsky/actions/workflows/ci.yml/badge.svg)](https://github.com/nahilist/clearsky/actions/workflows/ci.yml)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2058-blue.svg)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-blue.svg)](https://reactnative.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-v5.x-black.svg)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20RLS-3ECF8E.svg)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

*An enterprise-grade, ad-free mobile weather application and distributed caching proxy engineered for sub-second cold starts, zero-tracking location privacy, and life-safety alert reliability.*

</div>

---

## 🏛️ System Architecture Topology

ClearSky decouples the high-churn mobile client from upstream weather APIs through a stateless caching proxy layer backed by distributed PostgreSQL advisory locks.

```mermaid
flowchart TD
    subgraph ClientTier["Mobile Client Tier (Expo SDK 58 / React Native)"]
        iOS["iOS App (Dark Glass UI / blur effects)"]
        Android["Android App (Material 3 Dynamic Theming)"]
    end

    subgraph EdgeTier["Edge & Reverse Proxy Tier"]
        CDN["Global Edge CDN (stale-while-revalidate)"]
        Nginx["Nginx Reverse Proxy (SSL Termination / HTTP/2)"]
    end

    subgraph ServiceTier["Stateless Service Tier (Fastify + Node.js 20 LTS)"]
        API1["Fastify Replica 1 (Spatial In-Memory Grid Cache)"]
        API2["Fastify Replica 2 (Spatial In-Memory Grid Cache)"]
        Worker["Job Leader (pg_advisory_lock 727101)"]
    end

    subgraph DataTier["Data & Cloud Synchronization Tier"]
        DB["PostgreSQL (devices, places, sent, tickets)"]
        Supa["Supabase Cloud (Auth GoTrue, RLS, user_places, user_rules)"]
    end

    subgraph UpstreamTier["External Upstream APIs"]
        Meteo["Open-Meteo Weather & Geocoding API"]
        Radar["RainViewer Global Radar Layer"]
        ExpoPush["Expo Push Notification Service (APNs / FCM v1)"]
        RC["RevenueCat (In-App Purchases / Pro Entitlement)"]
    end

    iOS --> CDN
    Android --> CDN
    CDN --> Nginx
    Nginx --> API1
    Nginx --> API2
    API1 -.-> Worker
    API2 -.-> Worker

    API1 --> DB
    API2 --> DB
    Worker --> DB
    Worker --> Meteo
    Worker --> ExpoPush

    API1 --> Meteo
    API2 --> Meteo

    ClientTier --> Supa
    ClientTier --> Radar
    ClientTier --> RC
```

---

## 💎 Core Engineering Principles & Architectural Differentiators

### 1. Spatial Grid Quantization ($\sim 11\text{ km}$ Cell Hashing)
Standard weather applications persist and transmit fine-grained GPS coordinates (`28.613939, 77.209021`), enabling movement profiling. ClearSky quantizes all coordinates mathematically before network transit:
$$\text{grid\_lat} = \frac{\lfloor \text{lat} \times 10 + 0.5 \rfloor}{10}, \quad \text{grid\_lon} = \frac{\lfloor \text{lon} \times 10 + 0.5 \rfloor}{10}$$
* **Zero Location Tracking:** The backend cannot reconstruct individual user movement or discern home/work addresses.
* **$95\%+$ Cache Compression:** Thousands of devices in the same city cluster into identical grid keys (e.g. `28.6,77.2`), dramatically collapsing upstream API requests.

### 2. Distributed Leader Election via PostgreSQL Advisory Locks
Unlike legacy architectures that depend on standalone orchestration daemons or distributed key-value stores (e.g. Redis, ZooKeeper), ClearSky implements high-availability background workers using **PostgreSQL Transaction-Independent Advisory Locks**:
* `727001`: Multi-replica safe schema migrations on boot.
* `727101`: Periodic alert derivation job (10-minute cadence).
* `727102`: Push delivery receipt reconciliation (15-minute cadence).
* `727103`: Database housekeeping and pruning (daily).
* *Fault-Tolerance:* If a leader replica crashes mid-execution, PostgreSQL automatically releases the lock, allowing standby replicas to elect a new leader on the subsequent tick without intervention.

### 3. CGNAT-Resilient Rate Limiting
Mobile telecom operators assign tens of thousands of subscribers to shared Carrier-Grade NAT (CGNAT) IPs. Strict IP rate limiting indiscriminately throttles legitimate users. ClearSky applies **Tiered Contextual Throttling**:
* **Read Endpoints (`/v1/forecast`, `/v1/air`):** High per-IP threshold backed by `stale-while-revalidate` HTTP cache headers.
* **Write Endpoints (`/v1/devices`):** Throttled strictly **per Push Token** (`max: 20/min/token`), neutralizing IP-based denial of service without blocking cellular subnets.

### 4. Non-Monetized Life-Safety Guarantee
Severe weather alerts (thunderstorms, gale winds $>65\text{ km/h}$, flash flood rainfall $>36\text{ mm}/3\text{h}$, and hazardous AQI $>150$) are **strictly non-monetized**, never gate-kept behind Pro paywalls, and **bypass user quiet hours**.

---

## 📂 Repository Monorepo Structure

```
clearsky-v3/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Multi-stage CI: lint, typecheck, unit tests, Android dry-run
│       ├── deploy-server.yml      # Automated Docker build & GHCR container deployment
│       └── eas-build.yml          # Expo Application Services (EAS) cloud compilation triggers
├── app/                           # Cross-Platform Client (Expo SDK 58 / React Native 0.76+)
│   ├── src/
│   │   ├── app/                   # File-based routing (expo-router v4)
│   │   │   ├── (tabs)/            # Tab views (Today, Hourly, Radar, Places, Alerts, Settings)
│   │   │   ├── auth.tsx           # Supabase email/password auth flow
│   │   │   ├── rules.tsx          # Custom weather rule editor (Pro tier)
│   │   │   ├── pro.tsx            # RevenueCat paywall & purchase restoration
│   │   │   └── _layout.tsx        # Root navigation stack, theme context, Observe & Sentry
│   │   ├── components/            # Adaptive UI primitives (iOS Dark Glass vs. Android Material 3)
│   │   ├── lib/                   # Push registration, Supabase sync engine, offline storage
│   │   └── shared/                # Shared business logic with backend (grid math, alerts)
│   ├── app.json                   # Native permissions, icons, Sentry & EAS plugins
│   └── eas.json                   # Build profiles (development, preview, production)
├── server/                        # Backend Service & Alert Worker (Fastify + TypeScript)
│   ├── src/
│   │   ├── main.ts                # Fastify HTTP gateway, routes, rate-limiters, healthz
│   │   ├── forecast.ts            # Spatial grid in-memory cache proxy for Open-Meteo
│   │   ├── jobs.ts                # Background worker (alert evaluation & push dispatch)
│   │   ├── db.ts                  # PostgreSQL pool & transactional migrations with advisory locks
│   │   ├── supabase.ts            # Supabase server context & JWT verification
│   │   └── scale.ts               # 200,000-device simulation benchmark script
│   ├── Dockerfile                 # Hardened multi-stage Node.js 20 production container
│   └── docker-compose.yml         # Container orchestration with Nginx & PostgreSQL
├── supabase/
│   └── schema.sql                 # Production SQL schema: RLS, triggers, indexes, user sync
└── docs/                          # Comprehensive Enterprise Documentation Suite
    ├── PRD.md                     # Product Requirements Document & KPI Matrix
    ├── ARCHITECTURE.md            # Detailed Architecture & Sequence Diagrams
    ├── SECURITY.md                # STRIDE Threat Model & Security Posture
    ├── DATABASE_SCHEMA.md         # Full Entity-Relationship Model & Data Dictionaries
    └── DEPLOYMENT_DEVOPS.md       # CI/CD Workflows, Runbooks & Disaster Recovery
```

---

## 🛠️ Complete Technology Stack

| Domain | Technology / Library | Architecture Role |
|---|---|---|
| **Mobile Runtime** | React Native `0.76.x` / Expo SDK `58.0.0` | Cross-platform native application framework |
| **Routing & Navigation** | Expo Router `v4` | Typed file-based navigation |
| **State & Persistence** | Zustand + AsyncStorage | Reactive client state with automatic local caching |
| **Cloud Sync & Auth** | Supabase GoTrue + Postgres RLS | Multi-device account synchronization & defense-in-depth isolation |
| **Performance & APM** | Expo Observe (`expo-observe`) + Sentry | Production Time-To-Interactive (TTI) tracking & crash diagnostics |
| **Monetization** | RevenueCat (`react-native-purchases`) | In-app purchase verification for ClearSky Pro |
| **Radar Layer** | `react-native-maps` + RainViewer API | Real-time interactive rain radar tile map |
| **Backend Runtime** | Node.js `20 LTS` / TypeScript `5.x` | Stateless API and alert worker microservice |
| **HTTP Web Engine** | Fastify `v5.x` | High-throughput asynchronous HTTP gateway |
| **Database** | PostgreSQL `16` (via `pg`) | Relational persistence with distributed advisory locks |
| **Push Notification Engine**| `expo-server-sdk` | APNs & FCM push payload dispatch with receipt validation |
| **DevOps & Containers** | Docker (Alpine Multi-Stage) + Nginx | Containerized microservice deployment |
| **Build Infrastructure** | Expo Application Services (EAS) | Remote cloud compilation of native `.aab` and `.ipa` binaries |

---

## 📖 Engineering & Product Documentation

Deep-dive architecture specifications and runbooks are available in [`docs/`](./docs):

| Document | Direct Link | Content Summary |
|---|---|---|
| **Product Requirements Document** | [PRD.md](./docs/PRD.md) | Vision, user personas, MVP vs. Production feature matrix, functional specifications, and target KPIs. |
| **System Architecture** | [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Detailed topology, end-to-end weather request sequence, Supabase sync sequence, and distributed worker execution. |
| **Security Architecture** | [SECURITY.md](./docs/SECURITY.md) | STRIDE threat model, Row Level Security (RLS) enforcement, JWT validation, and spatial grid quantization. |
| **Database Schema** | [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) | Entity-Relationship Diagram (ERD), full column constraints, advisory lock keys, and data pruning policies. |
| **Deployment & DevOps** | [DEPLOYMENT_DEVOPS.md](./docs/DEPLOYMENT_DEVOPS.md) | EAS Build mobile guide, multi-stage Docker deployment, GitHub Actions workflows, and incident runbooks. |

---

## 🚀 Local Development Quickstart

### Prerequisites
* **Node.js**: `20.x` or later (`node -v`)
* **npm**: `10.x` or later
* **PostgreSQL**: `16.x` (or Docker running locally)
* **EAS CLI** (for mobile builds): `npm install -g eas-cli`

### 1. Backend Service Setup
```bash
# Clone the repository
git clone https://github.com/nahilist/clearsky.git
cd clearsky/server

# Install dependencies
npm ci

# Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials:
# DATABASE_URL=postgres://postgres:postgres@localhost:5432/clearsky

# Start development server with hot-reload (runs on http://localhost:8080)
npm run dev
```

### 2. Database Initialization
Migrations run automatically on server boot under advisory lock `727001`. For Supabase cloud auth and synchronization, execute `supabase/schema.sql` in your Supabase project SQL Editor.

### 3. Mobile App Setup
```bash
cd ../app

# Install dependencies with legacy peer dependencies resolution
npm ci

# Configure environment
cp .env.example .env
# Set your local Fastify API address:
# EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:8080
# EXPO_PUBLIC_SUPABASE_URL=https://<YOUR_PROJECT>.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=<YOUR_ANON_KEY>

# Start the Expo development server
npx expo start
```
*Note: In development, pressing `a` opens Android emulator; `i` opens iOS simulator. For physical devices, run inside the Expo Go app.*

---

## ⚡ Empirical Performance & Scale Benchmarks

The Fastify server and PostgreSQL alert pipeline have been empirically validated in synthetic stress tests:

| Benchmark Scenario | Load Characteristics | Measured Outcome |
|---|---|---|
| **Single API Replica Throughput** | 200 concurrent keep-alive connections, 500 spatial grid cells, 15s duration | **13,700 requests/sec**, p99 latency **36 ms**, 0 errors. 206k total requests resulted in only 500 upstream provider queries. |
| **Target Evaluation Scale Check** | 200,000 active devices, 400,000 saved places, ~4,000 active grid cells | Read entire target index in **3.9 s**; deduplicated 5,000 alerts in **10 ms**; handled 500 concurrent registrations in **0.3 s**. |
| **Leader Lock Failover** | 2 API replicas, 8 job ticks with primary process killed mid-cycle | Standby replica automatically acquired lock `727101` on the immediate next tick with zero missed alert cycles. |
| **Cellular CGNAT Resilience** | 300 rapid device registrations originating from identical IP address | All unique push tokens accepted; repeated registration of same token throttled safely at 20/min. |

---

## 🚢 Production Deployment

### Containerized Server (Docker & Docker Compose)
```bash
# Production multi-stage build & launch with 3 stateless API replicas
docker compose up -d --build --scale api=3

# Verify container health
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
curl -H "Authorization: Bearer $METRICS_TOKEN" http://localhost:8080/metrics
```

### Mobile App Releases (EAS Build)
```bash
# Authenticate with EAS
npx eas login

# Build Android Production App Bundle (AAB for Google Play)
npx eas build --platform android --profile production

# Build iOS Production Archive (IPA for TestFlight / App Store)
npx eas build --platform ios --profile production
```

---

## 🛡️ Security, Privacy & Incident Response

* **Security Inquiries:** Review our [Security Architecture](./docs/SECURITY.md) for vulnerability reporting guidelines and threat models.
* **Probes & Metrics:** Continuous uptime monitoring is available via `/readyz` (database connectivity probe) and `/metrics` (Prometheus-compatible JSON).
* **Rollback Protocol:** In the event of a critical client defect, immediately halt rollout in Google Play Console / App Store Connect and submit the previous stable artifact via EAS CLI:
  ```bash
  npx eas submit --platform android --id <PREVIOUS_STABLE_BUILD_ID>
  ```

---

## 📜 Data Licensing & Attribution

* **Weather Intelligence:** Powered by [Open-Meteo](https://open-meteo.com/) under Creative Commons Attribution 4.0 International (CC BY 4.0). Commercial production deployments require an Open-Meteo commercial subscription key (`OPEN_METEO_API_KEY`).
* **Radar Imagery:** Radar tiles provided by [RainViewer](https://www.rainviewer.com/api.html). Free tiers are subject to rate thresholds and frame depth limitations.
* **Open Source License:** ClearSky source code is distributed under the [MIT License](./LICENSE).
