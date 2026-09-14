# WeatherGPT — Product Requirements Document
**SIH 2026 · PS ID 26068 · MoES / India Meteorological Department**

## Problem
Weather information is scattered across portals, bulletins, satellite products, and forecast systems. Common users, farmers, disaster managers, and government agencies cannot quickly get actionable, trustworthy, multilingual weather intelligence.

## Product Goal
A voice-first conversational weather PWA where a user asks a question in Hindi, Tamil, or English (typed or spoken) and receives a plain-language answer in **under 2 seconds on 3G**, with a data card, the **source IMD product name, and its issue time**.

## Prototype Scope (fixed — do not expand)
- **One district** (Raigad, Maharashtra — cyclone-exposed, justified in PPT)
- **Three languages:** hi-IN, ta-IN, en-IN
- **Five intents:** current_weather, rainfall_forecast, warning_status, crop_advisory, seven_day_outlook

## Core Requirements
| ID | Requirement |
|---|---|
| R1 | Installable PWA (React + Next.js) with offline cache; works on low-end Android |
| R2 | Voice input on-device via Web Speech API (hi-IN, ta-IN); zero per-call cost |
| R3 | Voice fallback: quick-question chips when speech is unsupported |
| R4 | Answers in < 2s on 3G when data is cached |
| R5 | Every answer shows: plain-language text, data card (temp/humidity/wind), source product, issue time |
| R6 | Offline/no-network: serve last cached forecast WITH its issue time displayed |
| R7 | Warning text delivered **verbatim** from IMD products — never generated, never paraphrased |
| R8 | Severity-tiered alerts per IMD impact-based system: Low = in-app banner, Moderate = push, High = push + SMS, Severe = push + SMS + IVR |
| R9 | SMS/IVR = stubbed gateway interface + TODO (production target, paid gateway) — never faked as working |
| R10 | Grounded generation: LLM phrases answers only over retrieved passages; uncited answers are rejected and re-retrieved, never shown |
| R11 | Severity indicated by label + border weight + sort order only (colour-blind safe) |

## Non-Goals (explicit)
- Multi-district or national coverage in prototype
- Languages beyond hi-IN / ta-IN / en-IN
- Custom ML model training
- Working SMS/IVR transmission (interface only)

## Success Metrics
- Response latency < 2s (3G, cached)
- 100% of warnings verbatim from IMD products
- 0 uncited answers shown
- PWA installable, offline cache functional
