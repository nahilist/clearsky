# Product Requirements Document (PRD) — ClearSky

## 1. Executive Summary & Vision

**ClearSky** is an ad-free, hyper-local, privacy-conscious weather application engineered with modern cross-platform mobile standards (Expo React Native, SDK 58) and a high-performance backend caching architecture.

### Problem Statement
Traditional weather applications are burdened with intrusive ads, background tracking of sensitive personal location data, bloated SDKs that drain battery life, and confusing user interfaces. Furthermore, most weather apps treat critical severe weather alerts as an afterthought or lock them behind expensive paywalls.

### Vision
To provide users with instantaneous, hyper-accurate, and localized weather insights with zero advertising, extreme privacy preservation, bilingual language support (English and Hindi), and server-backed life-safety alerts that are **never** monetized or blocked by quiet hours.

---

## 2. User Personas

| Persona | Description | Primary Needs | Pain Points with Existing Apps |
|---|---|---|---|
| **Daily Commuter (Priya, 28)** | Commutes daily between Delhi and Noida by metro and two-wheeler. | Timely rain and extreme weather notifications before morning/evening commute windows. | Ads blocking radar view; delayed storm alerts; battery drain. |
| **Outdoor Worker / Farmer (Ramesh, 45)** | Works outdoors in agriculture/construction. Prefers Hindi interface. | Minute-by-minute rain nowcast, UV index, heat stress advice, and air quality (AQI). | English-only interfaces; complex scientific jargon without actionable daily advice. |
| **Frequent Traveler (Alex, 34)** | Travels frequently across different cities for work. | Multiple saved places, cloud backup across iOS and Android devices, offline availability. | Lost saved locations when switching phones; slow loading overseas. |

---

## 3. Product Scope: MVP vs. Production

```mermaid
flowchart LR
    subgraph MVP["Phase 1: MVP (Completed)"]
        A1["Live Forecast (Open-Meteo)"]
        A2["Minute-by-minute Rain & AQI"]
        A3["Bilingual UI (Hindi + English)"]
        A4["Local Place Management (Max 3)"]
        A5["Basic Offline Cache (12h)"]
    end

    subgraph PROD["Phase 2: Full Production (Current)"]
        B1["Supabase Cloud Auth & Multi-Device Sync"]
        B2["Fastify Weather Caching Proxy & Grid Aggregation"]
        B3["Custom Alert Engine (Rain, Heat, Cold, UV, Wind)"]
        B4["Commute Time Weather Window Alerts"]
        B5["EAS Observe (TTI & Real-time Startup Metrics)"]
        B6["RevenueCat In-App Purchases (ClearSky Pro)"]
        B7["Multi-Stage Production CI/CD Pipeline"]
    end

    subgraph FUTURE["Phase 3: Scale (Roadmap)"]
        C1["Native Home & Lock Screen Widgets"]
        C2["Multi-layer Weather Radar (Wind, AQI, Temps)"]
        C3["Official CAP Feeds (IMD, NWS, MeteoAlarm)"]
        C4["Redis Distributed Tiered Cache"]
    end

    MVP --> PROD --> FUTURE
```

---

## 4. Detailed Functional Specifications

### 4.1 Today Screen (Core Experience)
* **Hero Section:** Current temperature, feels-like, weather condition icon, day/night variant, wind speed, humidity, and atmospheric pressure.
* **Smart Daily Advice:** Dynamic advisory generated algorithmically based on forecasted condition thresholds (e.g., umbrella advice, sun protection, hydration warnings, AQI precautions).
* **12-Hour Hourly Strip:** Fast horizontal scroll of hourly predictions with interactive tap navigating to full 48-hour deep-dive charts.
* **Nowcast (Minute-by-Minute Rain):** 15-minute interval precipitation intensity graph for the next 2 hours.
* **AQI (Air Quality Index):** Color-coded air quality card displaying US AQI standards alongside PM2.5 and PM10 particulates.
* **Sun & Moon Cycle:** Exact sunrise, sunset, solar progress bar, and astronomical lunar phase calculation.
* **Shareable Forecast Card:** Renders the forecast into an aesthetically styled snapshot image using `react-native-view-shot` and invokes the native OS share sheet.

### 4.2 Places & Geocoding
* **Search:** Debounced live geocoding query against Open-Meteo geocoding index with fallback handling.
* **Free vs. Pro Limits:** Free users can save up to 3 cities. ClearSky Pro unlocks unlimited saved places.
* **Cloud Sync:** For authenticated users, all saved places synchronize automatically to Supabase PostgreSQL table `public.user_places`.

### 4.3 Alert & Custom Rules Engine
* **Core Life-Safety Rules (Always Free):**
  * Severe Weather (Heavy rain > 36mm/3h, extreme gale winds > 65km/h).
  * Rain Starting Soon (Precipitation starting within 45 minutes).
  * Hazardous AQI (> 150 Unhealthy).
  * *Constraint:* Life-safety alerts bypass quiet hours and are never gated behind subscriptions.
* **Custom Pro Rules:**
  * User-configurable thresholds for rain intensity, extreme heat, cold frost, wind gusts, and UV peak.
  * Commute Alert Window: User chooses specific commute start/end hours and days of the week for targeted route warnings.

### 4.4 Supabase Authentication & Sync
* **Auth Modes:** Email + Password sign-in / registration with session persistence via `@react-native-async-storage/async-storage`.
* **State Reconciliation:** Upon login, cloud records are merged with local Zustand state, ensuring offline continuity.

### 4.5 RevenueCat In-App Purchases (Pro Tier)
* Native integration via `react-native-purchases`.
* Entitlement key: `pro`.
* Unlocks: Unlimited saved locations, custom alert rules, commute alerts, and extended 6-hour rain radar forecast.

---

## 5. Non-Functional Requirements (NFR)

* **Performance & Launch Time:**
  * Cold launch Time-To-Interactive (TTI) $\le 1.8$ seconds on median Android devices.
  * Measured in production via `expo-observe` native instrumentation.
* **Network & Offline Resilience:**
  * Stale-While-Revalidate caching architecture: app presents cached forecast immediately if offline or provider times out.
  * Upstream API failures fallback to locally stored snapshot for up to 12 hours.
* **Security & Privacy:**
  * Exact user GPS coordinates are never stored permanently on backend servers; coordinates are rounded to an $\sim 11\text{ km}$ grid cell before query execution.
  * Zero third-party ad SDKs or user tracking telemetry.
* **Internationalization:**
  * 100% string coverage for Hindi (`hi`) and English (`en`) across alerts, forecast descriptions, and settings.

---

## 6. Success Metrics & Key Performance Indicators (KPIs)

| Metric | Target | Measurement Tool |
|---|---|---|
| **App Crash-Free Sessions** | $\ge 99.8\%$ | Sentry / EAS Observe |
| **P95 Cold Start TTI** | $< 2.0\text{ s}$ | EAS Observe |
| **API Response Latency (P99)** | $< 50\text{ ms}$ | Fastify `/metrics` + Prometheus |
| **Cache Hit Ratio (Backend)** | $\ge 85\%$ | Fastify LRU Cache Stats |
| **Free-to-Pro Conversion** | $4.5\% - 7\%$ | RevenueCat Analytics |
