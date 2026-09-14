# WeatherGPT — Non-Negotiable Rules (binds every implementation decision)

## Data integrity
1. The LLM **never authors forecast values, warning text, or advisory content**. It phrases answers over retrieved data only.
2. Warning text is passed through from the IMD product **unchanged**, on every channel.
3. Live values come from the IMD API (data.gov.in, Open-Meteo fallback) — **never** from the vector store.
4. Uncited answers are **re-retrieved, never shown**. The citation check is a gate, not a warning.

## Degradation (never break)
5. No speech support → show quick-question chips.
6. No network → serve last cached forecast **with its issue time displayed**.
7. IMD fetch failure → documented Open-Meteo fallback → then cache.

## Scope honesty
8. Prototype = one district, three languages (hi-IN, ta-IN, en-IN), five intents.
9. SMS/IVR is a **stub with a clear TODO** (production target, paid gateway). Never fake it as working — in UI or in demos.
10. No feature beyond the five intents; no extra languages; no extra districts.

## Design
11. Accent color is `#2D5016` only. No purple, no blue.
12. Inter 400/500 only. No Bold, no Black.
13. No shadows, gradients, blur, emoji, or filled pill primary buttons.
14. Severity = label + border weight + sort order (colour-blind safe).

## Architecture
15. Voice runs on-device (Web Speech API). No speech cloud.
16. API keys live server-side only (Vercel serverless functions).
17. All external fetches happen server-side.
18. Every answer rendered to the user includes: source IMD product name + issue time.

## Process
19. Any ambiguity → ask, don't assume. Any conflict between files → PRD.md + Architecture.md win.
20. Commit working code in small increments; never leave the build broken.
