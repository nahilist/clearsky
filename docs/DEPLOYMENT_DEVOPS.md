# Deployment, CI/CD & DevOps Runbook — ClearSky

## 1. Overview & Pipeline Architecture

ClearSky maintains a fully automated, multi-stage DevOps pipeline supporting cross-platform mobile compilation (EAS Build), containerized backend microservices (Fastify on Docker / Kubernetes), and automated code quality verification.

```mermaid
flowchart TD
    subgraph Git["GitHub Repository (nahilist/clearsky)"]
        Push["git push origin main"]
        PR["Pull Request"]
    end

    subgraph CI["GitHub Actions CI (.github/workflows/ci.yml)"]
        Lint["Lint & Typecheck (app & server)"]
        UnitTest["Unit Tests (Fastify & Shared Math)"]
        AndroidDryRun["Expo Export Dry Run (Android Bundle)"]
        WebDryRun["Server Build Verification"]
    end

    subgraph CD_Server["Server CD (.github/workflows/deploy-server.yml)"]
        DockerBuild["Docker Multi-Stage Build"]
        DockerPush["Push to Container Registry (GHCR / Docker Hub)"]
        DeployK8s["Rolling Update Deployment to Server Cluster"]
    end

    subgraph CD_Mobile["Mobile CD (.github/workflows/eas-build.yml)"]
        EASCloud["EAS Build Cloud Runner"]
        AAB["Production Android AAB (Google Play)"]
        IPA["Production iOS IPA (Apple TestFlight / App Store)"]
    end

    Push --> CI
    PR --> CI
    CI -- Paths: server/** --> CD_Server
    CI -- Release Tag: v* --> CD_Mobile
    CD_Server --> DeployK8s
    CD_Mobile --> EASCloud
    EASCloud --> AAB
    EASCloud --> IPA
```

---

## 2. CI/CD Workflows Breakdown

### 2.1 Core Continuous Integration (`ci.yml`)
* **Trigger:** Every push and pull request to `main`.
* **Path Filters:** Only triggers relevant jobs when files in `app/**`, `server/**`, or `supabase/**` change.
* **Checks:**
  1. `npm run lint` & `npm run typecheck` across both subprojects.
  2. `npm test` verifying alert engine derivation and database migrations.
  3. `npx expo export --platform android --output-dir dist-dry-run` to ensure React Native bundle compilation succeeds.

### 2.2 Server Container Deployment (`deploy-server.yml`)
* **Trigger:** Pushes to `main` modifying `server/**`.
* **Steps:**
  1. Build optimized multi-stage Docker container (`node:20-alpine`).
  2. Run security scanning on generated image.
  3. Push image tag to registry and trigger rolling restart.

### 2.3 Mobile EAS Build (`eas-build.yml`)
* **Trigger:** Release tags (`v*.*.*`) or manual `workflow_dispatch`.
* **Profile Matrix:** `preview` (internal distribution APK/Simulator) and `production` (Play Store / App Store).

---

## 3. Fastify Server Production Deployment

### 3.1 Multi-Stage Dockerfile
The backend container is built with a minimal runtime footprint ($\approx 120\text{ MB}$):
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
```

### 3.2 Production Docker Compose Stack
```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api

  api:
    build:
      context: ./server
      dockerfile: Dockerfile
    deploy:
      replicas: 3
    environment:
      - PORT=8080
      - DATABASE_URL=postgres://clearsky:secret@postgres:5432/clearsky
      - EXPO_ACCESS_TOKEN=${EXPO_ACCESS_TOKEN}
      - METRICS_TOKEN=${METRICS_TOKEN}
      - RATE_LIMIT_PER_MIN=300
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=clearsky
      - POSTGRES_USER=clearsky
      - POSTGRES_PASSWORD=secret
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## 4. Mobile Deployment with Expo Application Services (EAS)

### 4.1 EAS Build Profiles (`app/eas.json`)
```json
{
  "cli": {
    "version": ">= 14.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": { "simulator": false }
    }
  }
}
```

### 4.2 Building Production Binaries
```bash
# 1. Authenticate with EAS CLI
npx eas login

# 2. Build Android App Bundle (AAB) for Google Play
npx eas build --platform android --profile production

# 3. Build iOS Binary (IPA) for Apple App Store
npx eas build --platform ios --profile production

# 4. Optional: Run local machine build (requires Android Studio / Xcode)
npx eas build --platform android --profile development --local
```

---

## 5. Observability, Telemetry & Monitoring

### 5.1 EAS Observe (Real-time Mobile Performance)
ClearSky incorporates `expo-observe` to track cold-start responsiveness and interaction latency in production:
* **Root Monitoring:** Wrapped in `<ObserveRoot>` in `app/src/app/_layout.tsx`.
* **Interactive Marker:** `<ObserveInteractiveMarker>` mounted on the Today screen hero element.
* **Metric Reporting:** Pushes Time-To-Interactive (TTI) and frame freeze events directly to the EAS dashboard.

### 5.2 Sentry Crash Reporting
* Integrated via `@sentry/react-native/expo`.
* Captures unhandled JS exceptions and native crashes.
* **Production Build Safeguard:** `"disableAutoUpload": true` configured in `app.json` for environments without custom auth tokens.

### 5.3 Server Prometheus / Metrics Endpoint
* `GET /metrics` secured via `Bearer $METRICS_TOKEN`.
* Returns JSON payload:
  * `rssMb`: Resident set memory usage.
  * `cacheCells`: Total active weather cells in memory.
  * `devices`: Total registered push devices.
  * `uptimeS`: Server uptime in seconds.

---

## 6. Incident Response & Rollback Runbook

### Scenario A: Weather Upstream Outage (Open-Meteo 5xx)
1. **Detection:** Server metrics report sudden spike in upstream error rate; `X-ClearSky-Stale: 1` headers increase.
2. **Automated Mitigation:** Fastify cache serves stale data for up to 3 hours without dropping client connections.
3. **Manual Action:** If outage exceeds 3 hours, flip server configuration to alternate weather data provider fallback.

### Scenario B: Failed Mobile Release (Crash on Launch)
1. **Detection:** Sentry alerts report crash spike (> 1% of sessions).
2. **Mitigation:**
   * In Google Play Console: Halt staged rollout immediately.
   * In Apple App Store Connect: Reject release or pause phased rollout.
3. **Rollback:** Promote the previous known-good production build tag via `eas submit --id <previous_build_id>`.
