# System Architecture & Technical Design — ClearSky

## 1. System Overview

ClearSky is an ad-free, hyper-local, privacy-centric weather intelligence platform built as a high-performance monorepo. The platform combines a cross-platform mobile application (React Native / Expo SDK 58), a stateless server proxy with cell-quantized in-memory caching (Fastify + Node.js 20), an event-driven background push alert engine, and a managed PostgreSQL database with Row Level Security (Supabase).

```mermaid
flowchart TD
    subgraph Clients["Mobile Client Tier (Expo SDK 58)"]
        iOS["iOS Client (Dark Glass UI)"]
        Android["Android Client (Material 3 UI)"]
    end

    subgraph CDN["Edge & CDN Tier (Optional)"]
        Cloudflare["Cloudflare / Fastly CDN (stale-while-revalidate)"]
    end

    subgraph LoadBalancer["Reverse Proxy & Balancing"]
        Nginx["Nginx Reverse Proxy / SSL Termination"]
    end

    subgraph ServerCluster["Stateless Server Cluster (Fastify + TypeScript)"]
        API1["Fastify API Node 1 (In-Memory Grid Cache)"]
        API2["Fastify API Node 2 (In-Memory Grid Cache)"]
        Worker["Job Leader (Advisory Lock 727101)"]
    end

    subgraph Persistence["Database Tier (PostgreSQL / Supabase)"]
        PG["PostgreSQL (devices, places, sent, tickets)"]
        SupaAuth["Supabase Auth & RLS (profiles, user_places, user_rules)"]
    end

    subgraph External["External Services & APIs"]
        OpenMeteo["Open-Meteo Weather & Geocoding API"]
        RainViewer["RainViewer Global Radar Tile API"]
        ExpoPush["Expo Push Notification Service (APNs / FCM)"]
        RevenueCat["RevenueCat In-App Purchases (Pro Entitlements)"]
    end

    iOS --> CDN
    Android --> CDN
    CDN --> Nginx
    Nginx --> API1
    Nginx --> API2
    API1 -.-> Worker
    API2 -.-> Worker

    API1 --> OpenMeteo
    API2 --> OpenMeteo
    API1 --> PG
    API2 --> PG
    Worker --> PG
    Worker --> OpenMeteo
    Worker --> ExpoPush

    Clients --> SupaAuth
    Clients --> RainViewer
    Clients --> RevenueCat
```

---

## 2. Monorepo Structure

```
clearsky-v3/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Lint, unit tests, TypeScript check, export dry-run
│       ├── deploy-server.yml      # Docker build & container registry deployment
│       └── eas-build.yml          # Automated EAS Cloud build triggers
├── app/                           # Mobile Application (Expo SDK 58)
│   ├── src/
│   │   ├── app/                   # File-based routing (expo-router)
│   │   │   ├── (tabs)/            # Tab navigation (today, hourly, radar, places, alerts, settings)
│   │   │   ├── auth.tsx           # Supabase Email/Password login & signup
│   │   │   ├── rules.tsx          # Custom alert rules editor (Pro)
│   │   │   ├── pro.tsx            # RevenueCat subscription paywall
│   │   │   └── _layout.tsx        # Root layout, theme provider, Expo Observe & Sentry init
│   │   ├── components/            # Platform-adaptive UI components (Glass vs. Material 3)
│   │   ├── lib/                   # Client-side API, push tokens, Supabase sync, storage
│   │   └── shared/                # Code shared with backend (types, grid math, alert rules)
│   ├── app.json                   # Expo application config & native permissions
│   └── eas.json                   # Expo Application Services build profiles
├── server/                        # Backend API & Alert Worker (Fastify + TypeScript)
│   ├── src/
│   │   ├── main.ts                # Fastify server entrypoint & HTTP endpoints
│   │   ├── forecast.ts            # Cell-based caching proxy for weather data
│   │   ├── jobs.ts                # Distributed background workers (alerts, receipts, cleanup)
│   │   ├── db.ts                  # PostgreSQL connection pool & transactional migrations
│   │   ├── supabase.ts            # Supabase server context & JWT verification
│   │   └── config.ts              # Strongly-typed environment configuration
│   ├── Dockerfile                 # Multi-stage production container build
│   └── docker-compose.yml         # Local & staging orchestration with Nginx & Postgres
├── supabase/
│   └── schema.sql                 # Cloud database schema, triggers & RLS policies
└── docs/                          # Engineering & operational documentation
    ├── PRD.md
    ├── ARCHITECTURE.md
    ├── SECURITY.md
    ├── DATABASE_SCHEMA.md
    └── DEPLOYMENT_DEVOPS.md
```

---

## 3. End-to-End Weather Data Flow & Cell Quantization

To protect user location privacy and eliminate redundant weather provider requests, ClearSky groups geographic coordinates into **quantized spatial grid cells** ($\sim 11\text{ km} \times 11\text{ km}$):

$$\text{grid\_lat} = \text{round}(\text{lat} \times 10) / 10, \quad \text{grid\_lon} = \text{round}(\text{lon} \times 10) / 10$$

### Weather Request Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as Mobile App (Client)
    participant Edge as Fastify Server Cache
    participant Ext as Open-Meteo API
    participant Store as Local Device Storage

    User->>Edge: GET /v1/forecast?lat=28.6139&lon=77.2090
    Note over Edge: Quantize: lat=28.6, lon=77.2<br/>Cache Key: 28.6,77.2
    alt Valid Cache Entry Exists (TTL < 5 min)
        Edge-->>User: 200 OK (Forecast JSON) + Cache-Control: max-age=300
    else Stale Cache Exists (TTL 5-15 min)
        Edge-->>User: 200 OK (Stale Forecast) + X-ClearSky-Stale: 1
        Edge->>Ext: Background Fetch (Revalidate)
        Ext-->>Edge: Fresh Forecast Payload
        Edge->>Edge: Update In-Memory Cache
    else No Cache or Expired (> 15 min)
        Edge->>Ext: GET /v1/forecast (Upstream Call)
        alt Upstream Succeeds
            Ext-->>Edge: Fresh Forecast Payload
            Edge->>Edge: Store in Memory (5 min fresh, 15 min stale)
            Edge-->>User: 200 OK (Forecast JSON)
        else Upstream Unavailable (503/Timeout)
            Edge-->>User: 503 Service Unavailable (Retry-After: 30)
            Note over User: Fallback to Offline Cache
            User->>Store: Load Last Cached Forecast (AsyncStorage)
            Store-->>User: Display Offline Forecast Banner
        end
    end
```

---

## 4. Supabase Cloud Authentication & Cross-Device Sync

ClearSky supports hybrid offline-first operation. Unauthenticated users store saved places and settings locally in Zustand (`AsyncStorage`). When a user signs in, their local data seamlessly syncs with the cloud.

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant App as Mobile App (Zustand + AsyncStorage)
    participant SupaAuth as Supabase Auth (GoTrue)
    participant SupaDB as Supabase Database (PostgreSQL + RLS)

    User->>App: Tap "Sign In" (email, password)
    App->>SupaAuth: signInWithPassword(email, password)
    SupaAuth-->>App: Session Object (JWT access_token + refresh_token)
    App->>App: Store Session securely in AsyncStorage
    
    rect rgb(240, 248, 255)
        Note over App,SupaDB: Bi-Directional State Synchronization
        App->>SupaDB: SELECT * FROM public.user_places WHERE auth.uid() = user_id
        SupaDB-->>App: Remote Saved Places
        App->>SupaDB: SELECT * FROM public.user_rules WHERE auth.uid() = user_id
        SupaDB-->>App: Remote Alert Rules
        App->>App: Merge Remote with Local Zustand Store (De-duplicate by ID)
        App->>SupaDB: UPSERT Local Unsynced Places / Rules
        SupaDB-->>App: 200 OK (Synced)
    end
```

---

## 5. Background Alert Worker Architecture & Distributed Locking

The Fastify server cluster runs continuous background jobs without requiring a separate message broker like Celery or BullMQ. Instead, it leverages **PostgreSQL Advisory Locks** to ensure only one node in the cluster acts as the active job leader per tick.

```mermaid
flowchart TD
    subgraph Scheduling["Timer Tick (Every 10 Minutes)"]
        T1["Server Replica 1 Tick"]
        T2["Server Replica 2 Tick"]
        T3["Server Replica N Tick"]
    end

    subgraph LockAcquisition["Postgres Advisory Lock (pg_advisory_lock 727101)"]
        L1{"Try Acquire Lock"}
    end

    subgraph LeaderExecution["Leader Execution Flow"]
        P1["1. Query Distinct Occupied Cells (places table)"]
        P2["2. Batch Fetch Forecasts for Unique Cells (Open-Meteo)"]
        P3["3. Retrieve Registered Targets in Batch Cells"]
        P4["4. Evaluate Alert Engine: Safety, Custom Rules, Commute, AQI"]
        P5["5. Check Quiet Hours & Mute Preferences"]
        P6["6. Deduplicate against 'sent' table (Key + Day/Hour)"]
        P7["7. Send Push Messages via Expo Push SDK (FCM / APNs)"]
        P8["8. Record Sent Message Keys & Save Push Tickets"]
    end

    subgraph SecondaryFollowers["Standby Replicas"]
        S1["Lock Busy -> Skip Tick, Remain Responsive for API Traffic"]
    end

    T1 --> L1
    T2 --> L1
    T3 --> L1
    L1 -- Acquired --> LeaderExecution
    L1 -- Denied --> S1

    LeaderExecution --> ReleaseLock["Release Advisory Lock"]
```

### Advisory Lock IDs
* `727001`: Database Schema Migration lock (prevents race conditions during multi-container startup).
* `727101`: Alert Processing Leader lock (runs every 10 minutes).
* `727102`: Push Receipt Reconciliation lock (polls Expo ticket status every 15 minutes).
* `727103`: Database Housekeeping lock (prunes old records nightly).

---

## 6. High Availability & Fault Tolerance Principles

1. **Zero Downtime Deploys:** Replicas handle HTTP requests independently. Database migrations execute inside transactional migrations guarded by advisory lock `727001`.
2. **Provider Circuit Breaking:** If Open-Meteo returns errors or times out, the server serves stale cached data for up to 3 hours, tagging the response header `X-ClearSky-Stale: 1`.
3. **Graceful Push Handling:** If an Expo push token returns `DeviceNotRegistered`, the worker removes the stale token from the database immediately, keeping the active target index lean.
