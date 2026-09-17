# WeatherGPT — Production Deployment & Operations Runbook

This document provides step-by-step instructions for provisioning, configuring, building, and deploying **WeatherGPT** in production environments.

---

## 1. Architectural Overview

WeatherGPT is built on Next.js 14 App Router, PostgreSQL (Prisma ORM), and the Vercel AI SDK. It operates with a **zero-fabrication guarantee**:
- **Live Observational Telemetry**: Ingests IMD (India Meteorological Department) GeoServer data and Open-Meteo as fallback.
- **Server-Sent Events (SSE)**: Native real-time streaming at `/api/realtime` with automatic NAT keep-alive heartbeats every 10s for rural CG-NAT reliability.
- **Zero Mock Data in Production**: All test fixtures are isolated in `tests/fixtures/`. Offline or degraded states surface honest `quality="DEMO"` with null metrics and clear status badges.
- **Minimal Standalone Container**: Generates a self-contained bundle (`output: "standalone"`) in `.next/standalone`, executable via `node server.js` in Alpine Linux (< 150MB).

---

## 2. Environment Configuration Matrix

Create a production `.env.production` file on your host or inject these variables into your container orchestrator / secret manager.

| Variable Name | Required | Default / Format | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Enables React production mode, minification, and Serwist PWA service worker. |
| `WEATHERGPT_MODE` | Yes | `production` | Enforces zero mock data; throws on unverified providers. |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/weathergpt?schema=public&connection_limit=10&pool_timeout=20` | PostgreSQL connection string. |
| `ALERT_INGESTION_TOKEN` | Yes | Min 32 hex chars (`openssl rand -hex 32`) | Timing-safe token protecting `POST /api/alerts`. |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://your-domain.com` | Public host URL used for canonical metadata and CSP headers. |
| `GEMINI_API_KEY` | Optional | `AIzaSy...` | Primary LLM key for conversational briefing (`gemini-3.6-flash`). |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional | `AIzaSy...` | Alias for Gemini API key. |
| `OPENAI_API_KEY` | Optional | `sk-...` | Fallback LLM provider key. |
| `UPSTASH_REDIS_REST_URL` | Optional | `https://...upstash.io` | Distributed sliding-window rate limiting & multi-region cache. |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Token string | Upstash Redis REST token. |
| `TWILIO_ACCOUNT_SID` | Optional | `AC...` | Live SMS and IVR disaster alert dissemination. |
| `TWILIO_AUTH_TOKEN` | Optional | Secret string | Twilio API authentication token. |
| `TWILIO_PHONE_NUMBER` | Optional | E.164 phone | Twilio sender phone number. |
| `RATE_LIMIT_MAX_REQUESTS` | Optional | `60` | Global requests per 60s window per client. |
| `RATE_LIMIT_AI_MAX_REQUESTS` | Optional | `30` | AI Chat requests per 60s window per client. |

> [!IMPORTANT]
> **Token Generation**: Always generate a cryptographically strong ingestion token before launching:
> ```bash
> openssl rand -hex 32
> ```

---

## 3. Database Provisioning & Migrations

WeatherGPT uses Prisma ORM with PostgreSQL.

### 3.1 Provision PostgreSQL
Ensure your database supports UUID generation and standard PostgreSQL relational tables.

### 3.2 Run Migrations
Execute production schema migrations without interactive prompts:
```bash
npx prisma migrate deploy
```

### 3.3 Verify Schema Indexes
The following indexes are applied automatically:
- `Alert(alertHash)`: Unique deduplication constraint.
- `Alert(districtCode, issueTime)`: Fast composite lookups.
- `ChatSession(userId, updatedAt)`: Multi-turn session resumption.
- `ChatMessage(sessionId, createdAt)`: Chronological history retrieval.

---

## 4. Container Deployment (Docker & Compose)

### 4.1 Production Docker Image Build
WeatherGPT includes a hardened multi-stage `Dockerfile`:
```bash
# Build the optimized standalone container
docker build -t weathergpt:latest .

# Run the container as unprivileged user (UID 1001)
docker run -d \
  --name weathergpt \
  -p 3000:3000 \
  --env-file .env.production \
  weathergpt:latest
```

### 4.2 Multi-Container Deployment via Docker Compose
For turnkey deployments with PostgreSQL and Redis:
```bash
# Start all services with automated health checks
docker-compose up -d --build

# View logs across services
docker-compose logs -f app
```

---

## 5. Kubernetes & Cloud Orchestrator Setup

WeatherGPT exposes two dedicated health endpoints for zero-downtime rolling deployments:

### 5.1 Liveness Probe (`/api/health`)
- **HTTP Path**: `/api/health`
- **Port**: `3000`
- **Initial Delay**: 10s
- **Period**: 30s
- **Behavior**: Verifies app responsiveness and upstream provider reachability. Returns HTTP 200 (healthy/degraded) or HTTP 503 (critical subsystem down).

### 5.2 Readiness Probe (`/api/ready`)
- **HTTP Path**: `/api/ready`
- **Port**: `3000`
- **Initial Delay**: 5s
- **Period**: 10s
- **Behavior**: Verifies that PostgreSQL database connectivity is active and heap memory is healthy before routing live traffic. Returns HTTP 200 when ready, HTTP 503 if database connection fails.

### Example Kubernetes Deployment Spec
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: weathergpt
spec:
  replicas: 3
  selector:
    matchLabels:
      app: weathergpt
  template:
    metadata:
      labels:
        app: weathergpt
    spec:
      containers:
        - name: weathergpt
          image: your-registry/weathergpt:latest
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: weathergpt-secrets
          readinessProbe:
            httpGet:
              path: /api/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 30
            timeoutSeconds: 5
          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "1000m"
              memory: "512Mi"
```

---

## 6. Real-Time Telemetry Streaming

- **Endpoint**: `GET /api/realtime?district=Raigad&state=Maharashtra`
- **Protocol**: Server-Sent Events (`text/event-stream; charset=utf-8`)
- **Carrier NAT Resilience**: Sends periodic `: ping\n\n` comments every 10 seconds to keep TCP carrier connections open across rural cellular towers.
- **Client Consumption**: Handled automatically in the frontend via `useRealtimeWeather` hook:
```tsx
import { useRealtimeWeather } from "@/lib/hooks/useRealtimeWeather";

const { isConnected, telemetry } = useRealtimeWeather({
  district: "Raigad",
  state: "Maharashtra",
});
```

---

## 7. Security & Compliance Checklist

- [x] **Timing-Safe Token Validation**: `POST /api/alerts` compares tokens using `crypto.timingSafeEqual` with constant-time equality check to prevent timing attacks.
- [x] **Zero Mock Fallbacks**: `sample-alerts.json` and `sample-forecast.json` purged from production paths.
- [x] **Input Validation**: All API routes (`/api/chat`, `/api/rag`, `/api/advisory`, `/api/alerts`) enforce strict Zod schemas with regex length bounds.
- [x] **Carrier CG-NAT Rate Limiting**: Chat rate limiter keys on `sessionId + IP` to ensure hundreds of rural farmers sharing a single cellular NAT IP are not blocked simultaneously.
- [x] **PII Protection**: Subscriber phone numbers are masked in logs (e.g. `+91******3210`) and sanitized to E.164 standard.
- [x] **Tele MANAS Crisis Interception**: Crisis queries trigger immediate 24x7 Government of India helpline guidance (`14416` / `1800-891-4416`).
- [x] **Content Security Policy (CSP)**: `default-src 'self'`, `frame-ancestors 'none'`, and sanitized origins in `next.config.mjs`.

---

## 8. Verification & Sanity Checks

After deploying, run these automated sanity commands against your live endpoint:

```bash
# 1. Verify container readiness
curl -I https://your-domain.com/api/ready

# 2. Verify health subsystems
curl -s https://your-domain.com/api/health | jq .

# 3. Test real-time SSE stream (receives initial snapshot + ping)
curl -N -H "Accept: text/event-stream" "https://your-domain.com/api/realtime?district=Raigad"

# 4. Verify weather data provenance
curl -s "https://your-domain.com/api/weather?district=Raigad" | jq .provenance
```
