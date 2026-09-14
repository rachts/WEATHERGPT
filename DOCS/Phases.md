# WeatherGPT — 36-Hour Build Plan

## Phase 0 · Hours 0–2 — Scaffold
- Next.js 14 (App Router) + TypeScript + Tailwind with design tokens from Design_v2.md
- PWA via serwist; manifest; installable check
- Vercel serverless API route skeleton; .env handling (server-side only)
- Postgres (Prisma) schema: users, saved_locations, chat_sessions, chat_messages, forecast_cache, alerts, bulletin_embeddings

## Phase 1 · Hours 2–8 — Data pipeline
- Weather data service: fetch → normalise → cache per district
- data.gov.in IMD fetch + Open-Meteo fallback + cached-with-issue-time path
- Seed: Raigad GeoJSON, sample forecast cache entries
- **Gate:** IMD data flowing into normalised cache

## Phase 2 · Hours 8–16 — Query pipeline (text)
- Intent + entity resolution via Gemini (phrasing only; 5 intents)
- Response templates; values injected from cache/API; **no LLM-authored numbers**
- Answer render: text + data card + source + issue time
- Chat UI per Design_v2.md (bubbles, chips, input)
- **Gate:** typed English question → correct answer with source in < 2s cached

## Phase 3 · Hours 16–22 — Voice + languages
- Web Speech API input (hi-IN, ta-IN, en-IN) with quick-question chip fallback
- TTS read-aloud on request
- Hindi/Tamil answer templates
- **Gate:** spoken Hindi question → spoken answer

## Phase 4 · Hours 22–28 — Alerts
- Poll IMD warning products; parse district polygon · severity · valid time
- Match users to districts; severity-tier routing
- Web push + in-app banner built (High/Severe tiers show SMS/IVR as stubbed)
- Warning text verbatim everywhere
- **Gate:** mock High warning reaches test users on banner + push

## Phase 5 · Hours 28–33 — Grounded generation (RAG)
- pgvector embeddings; bulletin chunking with overlap
- Constrained prompt; citation gate; re-retrieve loop
- Seed 5–10 bulletin chunks
- **Gate:** out-of-corpus question → "insufficient data" or re-retrieval, never invented

## Phase 6 · Hours 33–36 — Polish + demo
- Latency tune (< 2s on throttled 3G); offline cache verification
- MapLibre radar + district outline view
- README + demo script rehearsal
- **Gate:** full demo passes end-to-end twice without intervention

## Definition of done
`npm run build` passes · PWA installs · voice works in Chrome · cached query < 2s · warnings verbatim · 0 uncited answers shown.
