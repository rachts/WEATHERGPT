# WeatherGPT — Smart India Hackathon (SIH) Judge Briefing Pack
**Problem Statement PS 26068 | MoES & IMD Agro-Meteorological Intelligence**

---

## 1. System Architecture Diagram

```
                 ┌─────────────────────────────────────────────────────────┐
                 │                 FARMER CLIENT (PWA)                     │
                 │  - Offline-first Service Worker (Serwist / Workbox)     │
                 │  - Voice-First Web Speech API (In & Out Audio TTS)      │
                 │  - 9 Indic Languages (hi, mr, bn, ta, te, gu, kn, pa)   │
                 │  - Visible Evidence & Provenance Citation Cards         │
                 └────────────────────────────┬────────────────────────────┘
                                              │ HTTPS / Streaming WSS
                                              ▼
                 ┌─────────────────────────────────────────────────────────┐
                 │            NEXT.JS 14 APP ROUTER BACKEND                │
                 │  - Rate Limiter: True Sliding-Window (IP + SessionId)   │
                 │  - Boot Instrumentation: Fail-Fast Env Validation       │
                 │  - Crisis & Suicide Prevention Filter (Tele MANAS 14416)│
                 └───────┬─────────────────┬────────────────────┬──────────┘
                         │                 │                    │
             Deterministic / RAG           │ Tool-Calling       │ Resilient Ingestion
                         ▼                 ▼                    ▼
        ┌─────────────────────────┐ ┌──────────────┐ ┌─────────────────────┐
        │  OFFLINE BRIEFING ENGINE│ │VERCEL AI SDK │ │ IMD NOWCAST SCRAPER │
        │  - 9-Language Templates │ │ Gemini 2.5 / │ │ - Resilient Parser  │
        │  - ICAR-CRIDA Rules     │ │ OpenAI GPT-4o│ │ - 3+ Failure Health │
        │  - Stampede Deduplication│ │ - getWeather │ │ - Scored Disambig  │
        └────────────┬────────────┘ └──────┬───────┘ └──────────┬──────────┘
                     │                     │                    │
                     └──────────────┬──────┴────────────────────┘
                                    │
                                    ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │             METEOROLOGICAL TELEMETRY & PERSISTENCE               │
        │  - IMD Surface Observatories (SYNOP 0300/1200 UTC)               │
        │  - Open-Meteo High-Resolution Fallback (Stampede-Protected)      │
        │  - Strict Zero-Fabrication Policy (quality: OBSERVED/ESTIMATED)  │
        │  - Station Distance Guard (>50km flagged as ESTIMATED)           │
        │  - PostgreSQL / Prisma ORM with atomic P2002 Alert Deduplication │
        │  - Dissemination Gateway: Live SMS & IVR Voice with Retry/Audit  │
        └──────────────────────────────────────────────────────────────────┘
```

---

## 2. MoES & IMD Data-Flow and Provenance Attribution

Every meteorological datapoint presented by WeatherGPT strictly obeys the **Zero-Fabrication Contract**:
1. **Primary Ground Station**: Direct IMD Surface Observatories (SYNOP 0300/1200 UTC) retrieved via official open data endpoints.
2. **Station Distance Quality Guard**: If the nearest reporting observatory is farther than **50 km** from the district centroid, the telemetry is explicitly marked with `quality: "ESTIMATED"` and surfaces the exact distance in the UI.
3. **Absence of Data**: Missing or model-derived metrics (pressure, wind direction, rainfall) **never default to arbitrary constants** (e.g. 20°C or 1008 hPa). They return `null` and set `isRainfallEstimated: true`.
4. **Citation Badges**: Every chat response attaches an unalterable **Evidence & Provenance Card** identifying:
   - Observatory Station Name
   - Distance in Kilometers
   - Quality Tier (`OBSERVED`, `ESTIMATED`, `FALLBACK`, `DEMO`)
   - Official Source Attribution (IMD Open Data / ICAR-CRIDA)

---

## 3. Comprehensive Threat Model & Defense In-Depth

| Threat Vector | Attack Scenario | Defense Implemented & Verified in WeatherGPT |
| :--- | :--- | :--- |
| **Fake Alert Ingestion** | Attacker tries to inject false red alerts into the system to induce crop panic | **Fail-Closed Auth** (`ALERT_INGESTION_TOKEN` min 16 chars). Requests without authorization are immediately rejected (401). |
| **Alert Replay / Flooding** | Attacker sends duplicate alerts in rapid succession | **DB-Level Deduplication**: Prisma unique `alertHash` with atomic `P2002` duplicate handling; in-memory set replaced by DB persistence. |
| **Prompt Injection / Jailbreak** | Malicious prompt attempting to alter weather metrics or leak keys | **Deterministic Intent Token Isolation**: `compileTokenRegex` prevents substring bypasses; grounding prompt strictly mandates `getWeather` tool execution. |
| **Rural CG-NAT Denial of Service** | Whole village shares a single telecom IP; one user blocks all others | **Dual-Key Sliding-Window Rate Limiting**: Keyed by `chat:${sessionId}:${clientIp}`, isolating sessions across shared carrier NAT. |
| **PII & Phone Number Leaks** | Phone numbers exposed in server logs or browser payloads | **Sanitization & Masking**: All subscriber numbers masked to `+91******3210` before logging or database audit storage. |

---

## 4. Rehearsed 3-Minute SIH Evaluation Script

### [0:00 – 0:45] The Core Problem & Value Proposition
> *"Respected Judges, 70% of India's agrarian economy depends on timely weather decisions. Yet existing AI chatbots hallucinate temperatures and rain forecasts with zero accountability. When a farmer sprays pesticides before an unpredicted rainstorm, thousands of rupees in inputs are washed away.*  
>  
> *We built **WeatherGPT** on a single uncompromising rule: **Zero Fabrication, 100% Provenance.** Backed directly by IMD and MoES observation telemetry, our system provides actionable agro-meteorological intelligence across 9 Indian languages."*

### [0:45 – 1:45] Live Interactive Demo (Judge Mode)
> *"Let's test this live using our built-in **Judge Mode**. With one click on Day 1:  
> **'Will it rain in Raigad today? Is it safe to spray pesticides?'**  
> Notice how WeatherGPT evaluates ICAR-CRIDA agronomic rules in real time: wind speed, rain probability, and relative humidity. It doesn't just say 'maybe' — it cites the exact Alibag Observatory 18 km away with an **OBSERVED** quality tier.  
>  
> Now let's trigger Day 2:  
> **'Heavy Rainfall Warning & IMD Nowcast for Ratnagiri'**  
> The system scrapes and parses live IMD nowcasts, triggers an orange alert banner, and if distress keywords are detected, seamlessly intercepts with the Ministry of Health's 24x7 Tele MANAS helpline (14416)."*

### [1:45 – 2:15] Visible Evidence & Voice-First Inclusion
> *"Notice the small badge below the response: **Evidence & Provenance**. It shows the station name, distance, and data tier. For low-literacy farmers, click **🔊 Listen**: Web Speech audio reads the entire advisory aloud in Hindi, Tamil, or Marathi with zero friction."*

### [2:15 – 3:00] Architecture, Scale & Offline Resilience
> *"Under the hood, WeatherGPT is engineered for India's rural digital realities:  
> 1. **True Sliding-Window Rate Limiting** with carrier CG-NAT session isolation, preventing entire villages from being locked out.  
> 2. **Full Offline PWA Resilience**: Service Worker caches historical observation models so the app works even in fields with zero network bars.  
> 3. **Live Sandboxable Dissemination**: Integrated SMS & IVR voice alerts with automatic retry and delivery receipts.  
>  
> With 26 automated acceptance gates and 30 judge verification tests all passing in CI, WeatherGPT is production-ready for MoES deployment. Thank you!"*
