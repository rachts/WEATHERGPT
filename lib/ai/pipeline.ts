// WeatherGPT — Conversational AI Pipeline
// Implements the 5-stage architecture:
// 1. Detect language (Per message, not per session)
// 2. Extract location and time (Structured output plus history)
// 3. Map to IMD district (Fuzzy match plus aliases)
// 4. Fetch IMD data (Nowcast, forecast, or none)
// 5. Generate localized reply (One LLM call, native language)

import { getAllDistricts, DistrictInfo, findDistrictInfo } from "@/lib/utils/location";
import { getDistrictWeather } from "@/lib/services/weather-data";
import { logger } from "@/lib/utils/logger";
import { DEFAULT_DISTRICT } from "@/lib/config/constants";
import { detectCrisisMessage } from "@/lib/services/query-pipeline";

// ============================================================================
// STAGE 1: Detect language (Per message, not per session)
// ============================================================================

export interface LanguageDetectionResult {
  code: "hi" | "ta" | "bn" | "te" | "mr" | "gu" | "kn" | "pa" | "en";
  name: string;
  nativeName: string;
  instruction: string;
}

export function detectMessageLanguage(messageText: string): LanguageDetectionResult {
  if (!messageText || typeof messageText !== "string") {
    return {
      code: "en",
      name: "English",
      nativeName: "English",
      instruction: "Respond in clear, accessible English.",
    };
  }

  const text = messageText.trim();

  // Devanagari script: Hindi or Marathi
  if (/[\u0900-\u097F]/.test(text)) {
    // Check for Marathi specific words using boundary or inclusion (never ASCII \b)
    const marathiPattern = /(?:^|[\s,।?!])(आहे|आहेत|कसा|कशी|कसे|पाऊस|पडू|पडेल|शकतो|होईल|काय|सांगा|नाही|शेतकरी|पीक)(?:[\s,।?!]|$)/;
    const marathiKeywords = ["आहे", "आहेत", "कसा", "कशी", "कसे", "पाऊस", "पडू", "पडेल", "शकतो", "होईल", "काय", "सांगा", "नाही", "शेतकरी", "पीक"];
    if (marathiPattern.test(text) || marathiKeywords.some((w) => text.includes(w))) {
      return {
        code: "mr",
        name: "Marathi",
        nativeName: "मराठी",
        instruction: "Respond fluently and naturally in Marathi (मराठी). Provide agricultural guidance in rural Marathi.",
      };
    }
    return {
      code: "hi",
      name: "Hindi",
      nativeName: "हिन्दी",
      instruction: "Respond fluently and naturally in Hindi (हिन्दी). Use respectful language suitable for Indian farmers (जैसे कि 'नमस्ते', 'मौसम', 'फसल', 'वर्षा').",
    };
  }

  // Tamil script
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return {
      code: "ta",
      name: "Tamil",
      nativeName: "தமிழ்",
      instruction: "Respond fluently and naturally in Tamil (தமிழ்). Use accessible vocabulary suitable for farmers in Tamil Nadu.",
    };
  }

  // Bengali script
  if (/[\u0980-\u09FF]/.test(text)) {
    return {
      code: "bn",
      name: "Bengali",
      nativeName: "বাংলা",
      instruction: "Respond fluently and naturally in Bengali (বাংলা). Use natural colloquial terms for farmers in West Bengal.",
    };
  }

  // Telugu script
  if (/[\u0C00-\u0C7F]/.test(text)) {
    return {
      code: "te",
      name: "Telugu",
      nativeName: "తెలుగు",
      instruction: "Respond fluently and naturally in Telugu (తెలుగు).",
    };
  }

  // Gujarati script
  if (/[\u0A80-\u0AFF]/.test(text)) {
    return {
      code: "gu",
      name: "Gujarati",
      nativeName: "ગુજરાતી",
      instruction: "Respond fluently and naturally in Gujarati (ગુજરાતી).",
    };
  }

  // Kannada script
  if (/[\u0C80-\u0CFF]/.test(text)) {
    return {
      code: "kn",
      name: "Kannada",
      nativeName: "ಕನ್ನಡ",
      instruction: "Respond fluently and naturally in Kannada (ಕನ್ನಡ).",
    };
  }

  // Gurmukhi / Punjabi script
  if (/[\u0A00-\u0A7F]/.test(text)) {
    return {
      code: "pa",
      name: "Punjabi",
      nativeName: "ਪੰਜਾਬੀ",
      instruction: "Respond fluently and naturally in Punjabi (ਪੰਜਾਬੀ).",
    };
  }

  // Hinglish / Latin script Hindi heuristics
  const hinglishPatterns = [
    /\b(kya|barish|barsat|hogi|hoga|mausam|mosam|kaisa|rahega|aaj|kal|parso|khet|kheti|paani|tapman)\b/i,
    /\b(batao|bataiye|kitna|halka|tez|badal|dhoop)\b/i,
  ];
  if (hinglishPatterns.some((regex) => regex.test(text))) {
    return {
      code: "hi",
      name: "Hindi (Hinglish / Roman Script)",
      nativeName: "Hinglish",
      instruction: "The user asked in Roman Hindi / Hinglish. Respond in warm, simple Hindi (or Hinglish) that is easy to understand.",
    };
  }

  // Default to English
  return {
    code: "en",
    name: "English",
    nativeName: "English",
    instruction: "Respond in clear, natural English.",
  };
}

// ============================================================================
// STAGE 2: Extract location and time (Structured output plus history)
// ============================================================================

export type TimeHorizon = "nowcast" | "today" | "tomorrow" | "day_after" | "7_day" | "none";
export type QueryIntent = "weather" | "crisis" | "chitchat" | "out_of_scope";

export interface ExtractedEntities {
  rawLocation: string | null;
  timeHorizon: TimeHorizon;
  intent: QueryIntent;
}

export function extractLocationAndTime(
  messages: Array<{ role: string; content?: string }>,
  currentQuery: string
): ExtractedEntities {
  const query = (currentQuery || "").toLowerCase();

  // Safety crisis detection (Stage 2 - shared multilingual pattern engine, M9)
  if (detectCrisisMessage(currentQuery)) {
    return {
      rawLocation: null,
      timeHorizon: "none",
      intent: "crisis",
    };
  }

  // General chitchat or meta inquiry
  const chitchatTerms = ["who are you", "what can you do", "help me", "hello", "hi", "namaste", "vanakkam"];
  if (chitchatTerms.some((term) => query === term || query.startsWith(term + " "))) {
    if (!query.includes("weather") && !query.includes("rain") && !query.includes("mausam")) {
      return {
        rawLocation: null,
        timeHorizon: "none",
        intent: "chitchat",
      };
    }
  }

  // Extract Time Horizon
  let timeHorizon: TimeHorizon = "today";
  if (/\b(now|currently|current|live|right now|abhi|turant|radar)\b/i.test(query)) {
    timeHorizon = "nowcast";
  } else if (/\b(day after tomorrow|kal ke baad|parso|day after)\b/i.test(query)) {
    timeHorizon = "day_after";
  } else if (/\b(tomorrow|kal|naalai|repu|udya)\b/i.test(query)) {
    timeHorizon = "tomorrow";
  } else if (/\b(week|weekly|7 days|7 day|hafta|agle 7 din)\b/i.test(query)) {
    timeHorizon = "7_day";
  } else if (/\b(today|aaj|inniku|aaj ka)\b/i.test(query)) {
    timeHorizon = "today";
  }

  // Extract Location:
  // Check current message first, then traverse backwards through message history
  let rawLocation: string | null = extractLocationFromText(currentQuery);

  if (!rawLocation && messages && messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.content) {
        const found = extractLocationFromText(msg.content);
        if (found) {
          rawLocation = found;
          break;
        }
      }
    }
  }

  return {
    rawLocation,
    timeHorizon,
    intent: "weather",
  };
}

function extractLocationFromText(text: string): string | null {
  if (!text) return null;

  // 1. Explicit prepositions: "in [Location]", "at [Location]", "for [Location]", "[Location] me", "[Location] ka"
  const patterns = [
    /\b(?:in|at|for|around|near|of)\s+([A-Za-z\u0900-\u0D7F]+(?:\s+[A-Za-z\u0900-\u0D7F]+)?)/i,
    /([A-Za-z\u0900-\u0D7F]+(?:\s+[A-Za-z\u0900-\u0D7F]+)?)\s+(?:me|mein|ka|ke|ki|weather|mausam|paas)\b/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const cleanCandidate = candidate.replace(/[?,.!]/g, "").trim();
      if (cleanCandidate.length > 2 && !isStopWord(cleanCandidate)) {
        return cleanCandidate;
      }
    }
  }

  // 2. Scan for known aliases or district names in the text
  const words = text.split(/\s+/).map((w) => w.replace(/[?,.!]/g, "").trim());
  for (const word of words) {
    if (COMMON_DISTRICT_ALIASES[word.toLowerCase()]) {
      return word;
    }
  }

  return null;
}

function isStopWord(word: string): boolean {
  const stops = new Set([
    "the", "a", "an", "weather", "forecast", "rain", "rainfall", "temperature", "today", "tomorrow",
    "yesterday", "day", "night", "week", "mausam", "barish", "barsat", "pani", "khet", "kheti", "crop",
    "farmers", "india", "him", "her", "me", "you", "my", "your", "what", "how", "when", "will", "is"
  ]);
  return stops.has(word.toLowerCase());
}

// ============================================================================
// STAGE 3: Map to IMD district (Fuzzy match plus aliases)
// ============================================================================

export const COMMON_DISTRICT_ALIASES: Record<string, string> = {
  // Major Indian metropolis and historical names
  calcutta: "Kolkata",
  kolkatta: "Kolkata",
  bombay: "Mumbai",
  mumbai: "Mumbai",
  "bombay suburban": "Mumbai Suburban",
  bangalore: "Bengaluru Urban",
  bengaluru: "Bengaluru Urban",
  bangaluru: "Bengaluru Urban",
  madras: "Chennai",
  chennai: "Chennai",
  banaras: "Varanasi",
  kashi: "Varanasi",
  varanasi: "Varanasi",
  allahabad: "Prayagraj",
  prayagraj: "Prayagraj",
  gurgaon: "Gurugram",
  gurugram: "Gurugram",
  baroda: "Vadodara",
  vadodara: "Vadodara",
  poona: "Pune",
  pune: "Pune",
  cochin: "Ernakulam",
  kochi: "Ernakulam",
  ernakulam: "Ernakulam",
  trivandrum: "Thiruvananthapuram",
  thiruvananthapuram: "Thiruvananthapuram",
  simla: "Shimla",
  shimla: "Shimla",
  pondicherry: "Puducherry",
  puducherry: "Puducherry",
  gauhati: "Kamrup Metropolitan",
  guwahati: "Kamrup Metropolitan",
  vizag: "Visakhapatnam",
  visakhapatnam: "Visakhapatnam",
  mangalore: "Dakshina Kannada",
  mysore: "Mysuru",
  mysuru: "Mysuru",
  orissa: "Khurda",
  bhubaneswar: "Khurda",
  delhi: "New Delhi",
  "new delhi": "New Delhi",
  ncr: "New Delhi",
  raigarh: "Raigad",
  raigad: "Raigad",
  ludhiana: "Ludhiana",
  ludhianna: "Ludhiana",
  patna: "Patna",
  jaipur: "Jaipur",
  lucknow: "Lucknow",
  kanpur: "Kanpur Nagar",
  ahmedabad: "Ahmedabad",
  surat: "Surat",
  indore: "Indore",
  bhopal: "Bhopal",
  nagpur: "Nagpur",
};

export interface DistrictMappingResult {
  district: string;
  state?: string;
  matchedBy: "exact" | "alias" | "fuzzy" | "fallback";
  confidence: number;
}

// Memoized district list and mapping cache (Low/Polish performance optimization)
let memoizedAllDistricts: DistrictInfo[] | null = null;
function getMemoizedDistricts(): DistrictInfo[] {
  if (!memoizedAllDistricts) {
    memoizedAllDistricts = getAllDistricts();
  }
  return memoizedAllDistricts;
}

const districtMappingMemoCache = new Map<string, DistrictMappingResult>();
const MAX_MAPPING_CACHE = 1000;

function storeMappingResult(key: string, result: DistrictMappingResult): DistrictMappingResult {
  if (districtMappingMemoCache.size >= MAX_MAPPING_CACHE) {
    const oldestKey = districtMappingMemoCache.keys().next().value;
    if (oldestKey) districtMappingMemoCache.delete(oldestKey);
  }
  districtMappingMemoCache.set(key, result);
  return result;
}

export function mapToIMDDistrict(
  rawLocation: string | null,
  fallbackDistrict = DEFAULT_DISTRICT
): DistrictMappingResult {
  if (!rawLocation || !rawLocation.trim()) {
    return {
      district: fallbackDistrict,
      matchedBy: "fallback",
      confidence: 0.5,
    };
  }

  const query = rawLocation.trim().toLowerCase();
  const cacheKey = `${query}:${fallbackDistrict}`;
  const cached = districtMappingMemoCache.get(cacheKey);
  if (cached) return cached;

  // 1. Check alias dictionary
  if (COMMON_DISTRICT_ALIASES[query]) {
    const aliased = COMMON_DISTRICT_ALIASES[query];
    const info = findDistrictInfo(aliased);
    return storeMappingResult(cacheKey, {
      district: info?.name || aliased,
      state: info?.state,
      matchedBy: "alias",
      confidence: 0.99,
    });
  }

  // 2. Exact match in district directory
  const exact = findDistrictInfo(rawLocation);
  if (exact) {
    return storeMappingResult(cacheKey, {
      district: exact.name,
      state: exact.state,
      matchedBy: "exact",
      confidence: 1.0,
    });
  }

  // 3. Substring match
  const allDistricts = getMemoizedDistricts();
  const subMatch = allDistricts.find(
    (d) => d.name.toLowerCase().includes(query) || query.includes(d.name.toLowerCase())
  );
  if (subMatch) {
    return storeMappingResult(cacheKey, {
      district: subMatch.name,
      state: subMatch.state,
      matchedBy: "fuzzy",
      confidence: 0.85,
    });
  }

  // 4. Levenshtein fuzzy distance matching
  let bestMatch: DistrictInfo | null = null;
  let lowestDistance = Infinity;

  for (const d of allDistricts) {
    const dist = levenshteinDistance(query, d.name.toLowerCase());
    if (dist < lowestDistance) {
      lowestDistance = dist;
      bestMatch = d;
    }
  }

  // Allow fuzzy match with distance threshold <= 2 for short words or <= 3 for longer words
  const threshold = query.length > 6 ? 3 : 2;
  if (bestMatch && lowestDistance <= threshold) {
    return storeMappingResult(cacheKey, {
      district: bestMatch.name,
      state: bestMatch.state,
      matchedBy: "fuzzy",
      confidence: Math.max(0.6, 1 - lowestDistance / query.length),
    });
  }

  // 5. If completely unrecognized, return as-is for tool execution / fallback
  return storeMappingResult(cacheKey, {
    district: rawLocation.trim(),
    matchedBy: "fallback",
    confidence: 0.3,
  });
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// ============================================================================
// STAGE 4: Fetch IMD data (Nowcast, forecast, or none)
// ============================================================================

export interface IMDFetchedData {
  needed: boolean;
  district: string;
  data: any | null;
  error?: string;
}

export async function fetchIMDData(
  district: string,
  timeHorizon: TimeHorizon,
  intent: QueryIntent
): Promise<IMDFetchedData> {
  // If user inquiry does not require meteorological telemetry (e.g. crisis, general chitchat)
  if (intent !== "weather") {
    return {
      needed: false,
      district,
      data: null,
    };
  }

  try {
    const weather = await getDistrictWeather(district);
    return {
      needed: true,
      district: weather.district,
      data: weather,
    };
  } catch (err) {
    logger.warn("IMD data fetch failure in conversational pipeline", {
      district,
      timeHorizon,
      error: (err as Error).message,
    });
    return {
      needed: true,
      district,
      data: null,
      error: (err as Error).message,
    };
  }
}

// ============================================================================
// STAGE 5: Generate localized reply (One LLM call, native language)
// ============================================================================

export function buildConversationalPrompt(
  lang: LanguageDetectionResult,
  district: string,
  timeHorizon: TimeHorizon,
  fetchedData: IMDFetchedData
): string {
  let contextPayload = "";

  if (fetchedData.data) {
    const d = fetchedData.data;
    contextPayload = `
OFFICIAL IMD METEOROLOGICAL DATA FOR ${d.district}, ${d.state}:
- Source: ${d.sourceProduct || "IMD MoES Surface Observation"} (Issue Time: ${d.issueTime || "Live"})
- Current Condition: ${d.current?.condition || "N/A"}, Temp: ${d.current?.temperature ?? "N/A"}°C, Humidity: ${d.current?.humidity ?? "N/A"}%, Wind: ${d.current?.windSpeed ?? 0} km/h ${d.current?.windDirection || ""}
- Forecast: ${JSON.stringify(d.forecastDaily || [])}
- Radar Nowcast: ${JSON.stringify(d.radarNowcast || {})}
`;
  } else if (fetchedData.error) {
    contextPayload = `
NOTICE: Upstream IMD meteorological data fetch encountered an issue: "${fetchedData.error}".
Instruct user that live telemetry is momentarily unreachable, do NOT fabricate false numbers.
`;
  }

  return `You are WeatherGPT, an authoritative yet empathetic conversational meteorologist assisting Indian farmers, rural communities, and citizens.
Back all factual statements with the official India Meteorological Department (IMD) Open Data.

DETECTED USER LANGUAGE: ${lang.name} (${lang.nativeName})
LANGUAGE INSTRUCTION: ${lang.instruction}
CRITICAL RULE: You MUST reply in this language: ${lang.name} (${lang.nativeName}).

TARGET DISTRICT: ${district}
REQUESTED TIME HORIZON: ${timeHorizon}

${contextPayload}

CONVERSATIONAL DIRECTIVES:
1. Explain weather in fluent, human, natural language without dumping raw JSON or unformatted keys.
2. Give actionable insights for farming and outdoor work:
   - When to spray pesticides or irrigate (avoid spraying before rain).
   - Wind safety and heat precautions.
   - Good windows for crop harvesting and grain drying.
3. If data is unavailable, state it plainly and kindly without hallucinating.
4. Keep the response concise, clear, and comforting.`;
}
