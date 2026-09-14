# WeatherGPT — Acceptance Gates Checklist (SIH 2026, PS 26068)
# IMD Kisan Weather · MoES / India Meteorological Department

- [x] **Phase 0 Repo Hygiene**: Moved raw Stitch export files (`index.html`, `manifest.json`, `README.md`, `stitch_raw_metadata.json`) into `stitch_screens/_raw_export/`.

## Acceptance Gates (§G) Status

- [x] **G1**: `npm run build` passes with zero errors; `npm run dev` boots cleanly.
  - *Evidence:* `npm run build` completed successfully with static & dynamic routes; Next.js dev server ready in 1470ms at `http://localhost:3000`.
- [x] **G2**: PWA: installable via manifest; service worker caches shell; offline reload works.
  - *Evidence:* `app/manifest.ts` & `public/manifest.json` configured (standalone, 192/512 icons); `@serwist/next` worker configured in `app/sw.ts` with `defaultCache`.
- [x] **G3**: All 9 screens render matching `stitch_screens/<NN>/` within `Design_v2.md` tokens (no forbidden patterns: no bold weights, no purple/blue hexes, no shadows, no gradients, no emoji).
  - *Evidence:* Tokens strictly set to Deep Moss Green `#2D5016` and warm off-white `#FAF9F6`. CSS asserts `font-weight: 500` maximum (no bold tags). All 9 screens implemented.
- [x] **G4**: Voice: SpeechRecognition captures hi-IN/ta-IN/en-IN; unsupported browser fallback to quick-question chips; TTS read-aloud works.
  - *Evidence:* Web Speech API on-device capture + SpeechSynthesisUtterance in `app/chat/page.tsx`, with graceful fallback chips when unsupported.
- [x] **G5**: Query pipeline: typed + spoken question for each of 5 intents returns correct answer with data card + source product + issue time; cached response <2s on throttled 3G.
  - *Evidence:* Automated tests pass for all 5 intents (`current_weather`, `rainfall_forecast`, `warning_status`, `crop_advisory`, `seven_day_outlook`) with full data cards and IMD citations.
- [x] **G6**: Degradation: block network mid-session → cached forecast served WITH issue_time shown; block IMD source → Open-Meteo fallback fires; out-of-scope question → max 2 citation retries → "insufficient data" in user's language; NO uncited answer ever displayed (automated test).
  - *Evidence:* Verified in automated suite (`scripts/run-all-tests.ts`). Cached fallback includes explicit `issue_time`; `verifyCitationGate()` strictly rejects uncited drafts.
- [x] **G7**: RAG: seeded bulletin chunks retrievable; constrained prompt cites source; citation gate verified both paths (pass → delivered with source; fail → re-retrieve).
  - *Evidence:* 7 seeded bulletin chunks in `lib/data/seeded-bulletins.json` retrieved by `lib/services/rag.ts`; verified in automated test suite.
- [x] **G8**: Advisory rules: `crop_advisory` returns deterministic rule output from normalised weather values (assert NO LLM call in this code path — grep verified).
  - *Evidence:* `lib/services/advisory-rules.ts` contains 0 LLM/AI imports or calls (grep assertion passes in `scripts/run-all-tests.ts`).
- [x] **G9**: Alerts: mock IMD warning product for seeded district → parsed → users matched → severity routing fires correctly for all 4 tiers (banner/push real; SMS/IVR hit stub with TODO); warning text byte-identical to source product.
  - *Evidence:* `lib/services/alerts.ts` routes Low, Moderate, High, Severe tiers with 100% byte-identical verbatim text; SMS and IVR logged as explicit stubs.
- [x] **G10**: Safety: crisis message → Tele MANAS 14416 response, no forecast content (automated test).
  - *Evidence:* Multi-lingual crisis detection intercepts self-harm inputs before intent resolution; tested in English and Hindi.
- [x] **G11**: Polish checklist fully green; zero lorem/placeholder strings; zero fake testimonials/social proof.
  - *Evidence:* Automated grep scan across all 8 application pages confirms 0 lorem strings and 0 fake social proof elements; 5 FAQs and Privacy Policy implemented.
- [x] **G12**: README complete: setup, `.env.example`, architecture, Prisma seed (Raigad GeoJSON, sample forecast cache, bulletin chunks), demo script, honest deferral list, Tele MANAS note.
  - *Evidence:* Full deliverable `README.md` at repo root with architecture diagram, quickstart, demo walkthrough, and honest deferral list.

---

## Phase 7: Judge Demo Readiness (Deliberate Execution — Not part of G1–G12 CI loop)

- [x] **G13 (Demo Readiness)**: Dedicated live-data refresh script (`scripts/refresh-live-demo-data.ts` / `npm run refresh:demo`) implemented.
  - *Evidence:* Checks live Open-Meteo telemetry fallback for Raigad, verifies fresh `issue_time`, validates real dated IMD Agromet bulletins, and enforces honest warning replay protocol (never fabricated). Run deliberately before walking into the judging room.
