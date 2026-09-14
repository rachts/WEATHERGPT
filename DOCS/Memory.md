# WeatherGPT — Project Memory (decisions & context for agents)

## Why these choices (do not reverse without asking)
- **Gemini, phrasing only** — an unconstrained LLM is a liability for life-critical weather data. The LLM's job is language, not meteorology. Swapping models is allowed (architecture is model-agnostic), removing the citation gate is not.
- **Web Speech API on-device** — a farmer on 2G/3G pays nothing; no speech cloud means no per-call cost and no network dependency for STT. This is a core rural-accessibility decision, not a shortcut.
- **PWA, not native app** — no app-store gatekeeping; installable; offline cache; works on low-end Android. Critical for the target users.
- **Serverless (Vercel)** — keys server-side, zero infra management, free tier covers prototype. Production scaling path documented.
- **pgvector inside Postgres** — one database, no extra infrastructure; RAG and relational data colocated.
- **data.gov.in primary, Open-Meteo fallback** — IMD data is authoritative but formats vary; Open-Meteo is the documented fallback; cache is the last resort, always with issue time shown.
- **Warning text verbatim** — RAG reduces hallucination; it does not eliminate it. Verbatim passthrough is the guarantee. This phrasing is deliberate and appears in the PPT; keep it.
- **Severity by label/border/sort** — judges and users include colour-blind stakeholders; accessibility is a designed feature.
- **Honest scope (1 district / 3 languages / 5 intents)** — the PPT claims exactly this. Demo and deck must match. Expanding scope silently breaks consistency with the presentation.
- **SMS/IVR stubbed, not faked** — the PPT presents these as "production target, scoped & costed". A fake working SMS in the demo would collapse credibility under questioning.

## PPT ↔ code consistency map
- Slide claims to defend in code/demo: < 2s on 3G · warnings verbatim · 0 uncited answers · voice on-device · cached-with-issue-time offline path.
- If code cannot support a PPT claim, change the PPT — never fake the demo.
