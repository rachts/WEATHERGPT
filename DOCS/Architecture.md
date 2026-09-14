# WeatherGPT — System Architecture
**Canonical reference: flowchart 01 (System architecture).**
Solid outline = built in the prototype. Dashed = production target, NOT built.

## Client
| Component | Detail |
|---|---|
| Installable PWA | React + Next.js, offline cache (serwist/next-pwa) |
| Voice, on-device | Web Speech API · hi-IN, ta-IN. No speech cloud, no per-call cost |
| ~~SMS and IVR reach~~ (dashed) | Feature phones — production target, not built |

## Backend
- **Serverless functions (Vercel):** API keys held server-side only · rate limiting · response caching

## Services
| Service | Responsibility |
|---|---|
| Query understanding | Gemini — **phrasing only**. Resolves intent + entities (parameter · location · time window). Never authors forecast values |
| Weather data service | fetch · normalise · cache per district |
| Advisory rules | crop · district · window rule matching |

## Storage
| Store | Contents |
|---|---|
| Postgres | users, saved locations |
| Forecast cache | per district, with issue_time |
| pgvector | embedded IMD bulletins/advisories |

## External Sources (fetched server-side)
| Source | Role |
|---|---|
| data.gov.in — IMD datasets | **Primary** source |
| Open-Meteo | Documented fallback |
| IMD radar image · district GeoJSON | Shown **unmodified** · MapLibre outlines |

## Data Flows (see flowcharts 02, 03, 04)
1. **Query pipeline (02):** question received → intent/entities resolved → IMD product fetched for district (cache on failure) → values fill template, warning text verbatim → answer rendered with data card + source + issue time. Target < 2s on 3G. Every answer names its IMD product and issue time so errors are traceable.
2. **Warning dissemination (03):** IMD warning product (polled via data.gov.in) + radar nowcast → parse (district polygon · severity · valid time) → match users to districts from saved locations → severity decision → tiered delivery. Web push + in-app banner = built; SMS + voice IVR = production target (paid gateway).
3. **Grounded response generation (04):** bulletins chunked with overlap → embedded → pgvector → per question: embed → top passages retrieved → context assembled → constrained prompt → model phrases (low temperature, short output) → citation check: no → re-retrieve, not shown; yes → deliver with source.

## Hard Rules (non-negotiable)
- The model **never authors forecast values or warning text**.
- Live values come from the IMD API, not the vector store.
- RAG reduces hallucination; it does not eliminate it — which is why warnings pass through verbatim and uncited answers are re-retrieved.
- Voice runs on the device.
- Prototype scope: one district, three languages, five intents.
