# WeatherGPT Demo Runbook

This runbook is for a repeatable local or container-based demonstration of WeatherGPT's weather, agronomic, satellite, radar, and safety flows.

## Before you start

- Node.js 20 LTS and npm 9+ for a host run, or Docker Compose for the container path.
- A browser with Web Speech API support (Chrome or Edge is recommended for the voice walkthrough).
- Optional credentials for live integrations. The UI still starts without paid credentials; any degraded or cached data must remain visibly labelled by the app.

## Fastest host demo

```bash
npm ci
npm run build

# Use a non-production mode for a credential-free local walkthrough.
NODE_ENV=production \
WEATHERGPT_MODE=demo \
ALERT_INGESTION_TOKEN=weathergpt-demo-token-123456 \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
npm start
```

Open <http://localhost:3000>. Keep the terminal running while presenting.

## Container demo

```bash
docker compose up --build -d
docker compose ps
curl -fsS http://localhost:3000/api/ready
curl -fsS http://localhost:3000/api/health
curl -fsS http://localhost:3000/sw.js | grep -qi serwist
```

The checked-in Compose stack starts PostgreSQL, applies migrations, seeds one clearly labelled demo alert, and then starts the app. Stop it after the demo with:

If no `ALERT_INGESTION_TOKEN` is supplied, the demo container generates an ephemeral token and prints a warning; no credentials are needed for the judge walkthrough.

```bash
docker compose down
```

Use `docker compose down -v` only when you intentionally want to delete the local PostgreSQL volume.

## Suggested five-minute walkthrough

1. **Dashboard:** open the home screen and point out the selected district, telemetry cards, provenance, and degraded-state labelling.
2. **Conversation:** open `/chat`, try an English or Indic-language weather question, then use the browser microphone and read-aloud controls when supported.
3. **Agronomy:** ask whether it is safe to spray pesticides today. Explain that the advisory is produced by deterministic thresholds, not generated forecast numbers.
4. **Satellite and radar:** open `/satellite` and `/radar` to show the imagery layers and station/range controls. External imagery can be delayed or unavailable; the status UI is part of the demo.
5. **Safety boundary:** use the documented Tele MANAS test phrase only in a controlled demonstration and show that the crisis response takes precedence over weather resolution.
6. **Offline differentiator:** first load the dashboard, then open DevTools → Network → Offline. Refresh or navigate back to the dashboard and show the cached advisory plus the explicit `Offline Mode` badge. Restore the network afterward.

## Smoke checks

The CI workflow builds the production bundle, starts `next start`, and checks the three deployment-critical public assets:

```bash
curl -fsS http://localhost:3000/api/health
curl -fsS http://localhost:3000/api/ready
curl -fsSI http://localhost:3000/sw.js
```

`/api/health` may report `degraded` when an upstream provider is unreachable; the endpoint is still considered live when it returns HTTP 200. `/api/ready` is the traffic-routing check.

## Data and demo boundaries

- Do not describe cached, fallback, or unavailable values as live observations.
- Do not present the demo as an official IMD or MoES application.
- Do not paste real personal data or phone numbers into the chat, logs, screenshots, or issue reports.
- The Compose seed is demo-only and uses the dated bulletin fixture under `lib/data/seeded-bulletins.json`. It is skipped automatically in production mode.
