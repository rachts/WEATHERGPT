# WeatherGPT — Design System v2 (CURRENT — canonical)
Derived from the Stitch export. This is the single source of truth for UI.
(Design.md is deprecated — see its header.)

## Tokens
| Token | Value |
|---|---|
| Accent (only) | Deep Moss Green `#2D5016` — active states, key actions, status dots, thin progress bar |
| Background | Warm off-white `#FAF9F6` |
| Cards | White `#FFFFFF`, 1px border `#E8E6E1` |
| Chat background | `#FAF9F6` |
| AI bubble fill | `#F5F4F0`, no border |
| Primary text | `#1A1A1A` |
| Secondary text | `#6B6B6B` |
| Font | **Inter only, weights 400 and 500. NO Bold anywhere** |

## Forbidden
No shadows · no gradients · no blur · no glassmorphism · no purple · no blue · no emoji · no filled pill primary buttons · no iOS-style neon toggles · no spinning loaders · no skeleton-screen shimmer.

## Components
- **Buttons:** outlined, 1px moss-green border, white fill, 8px radius, Inter Medium 15px. Secondary actions = plain underlined text links (moss green).
- **User message:** right-aligned, white fill, 1px moss-green border, 16px radius, max-width 80%, Inter Regular 15px. No avatar.
- **AI message:** left-aligned, `#F5F4F0` fill, no border, 16px radius, max-width 80%. No avatar.
- **Data card (inside AI message):** 1px gray border; small uppercase 12px gray labels (TEMPERATURE / HUMIDITY / WIND); values Inter Regular 16px. Table-like, no icons.
- **Quick-question chips:** pill, 1px gray border, white fill, Inter Regular 14px.
- **Input:** 1px gray border, 4px radius, white fill; placeholder "Ask in Hindi, English, Tamil..."; outlined mic icon; outlined moss-green send arrow (no filled circle).
- **Loading:** thin 1px moss-green progress bar at very top. Typing = three moss-green dots, subtle opacity pulse only.
- **Alert cards:** white, 1px border, 16px radius; 2px moss-green left accent edge. Severity = **label text + border weight + sort order** (Low / Moderate / High / Severe). Survives grayscale and colour-blindness. Active dot = 6px moss-green circle; resolved = gray.
- **Toggles:** 1px border style; moss-green fill ON, white OFF.
- **Voice mode:** full screen; thin horizontal waveform bars (1px moss-green, varying heights); "Listening..." Inter Regular 20px; "Speak clearly in your language" 14px gray; "Cancel" underlined text.
- **Empty chat:** centered thin cloud line drawing (1px stroke); "No conversations yet" 16px gray; "Ask about the weather in your area" 14px gray.
- **Forecast table:** Day (Regular 15) | Condition text (14, gray) | "24° / 32°" (15). 1px row dividers. No icons, no colored rows.
- **Charts (if any):** line graph, moss-green 1px stroke, no fill under line, no grid background.

## Aesthetic
Government bulletin / premium newspaper weather section. Structure through borders, whitespace, and typography hierarchy — not color or weight. Calm, authoritative, rural-friendly.
