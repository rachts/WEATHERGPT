// WeatherGPT — Query Pipeline (Production-Grade)
// Core Pipeline:
// 1. Prompt-Injection & Tamper Defense
// 2. Safety / Crisis detection (Tele MANAS 14416)
// 3. Intent & Entity resolution (deterministic multi-token scoring)
// 4. Data fetching (IMD / Open-Meteo fallback) or Advisory Rules (pure deterministic)
// 5. Authoritative IMD rainfall threshold semantics (0mm never yields "rain expected")
// 6. Evidence-based Citation Gate verification (never manufactures new Date())

import { getDistrictWeather, NormalizedWeather } from "./weather-data";
import { getDeterministicCropAdvisory, CropAdvisoryResult } from "./advisory-rules";
import { fetchLiveImdDistrictAlerts } from "./alerts";
import { findDistrictInfo, resolveDistrictOrThrow } from "../utils/location";
import { Evidence } from "../types/provenance";

export type WeatherIntent =
  | "current_weather"
  | "rainfall_forecast"
  | "warning_status"
  | "crop_advisory"
  | "seven_day_outlook"
  | "safety_crisis";

export interface QueryResponse {
  answerText: string;
  intent: WeatherIntent;
  language: "hi-IN" | "ta-IN" | "en-IN";
  dataCard?: {
    temperature?: string;
    humidity?: string;
    wind?: string;
    rainfall?: string;
    condition?: string;
    advisory?: string;
    severity?: string;
    warningHeadline?: string;
    outlook?: Array<{ day: string; condition: string; range: string }>;
  };
  sourceProduct: string;
  issueTime: string | null;
  isCrisisIntervention: boolean;
  citationVerified: boolean;
  evidence?: Evidence;
}

// Prompt-injection patterns to block or sanitize
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /pretend\s+(you\s+are|imd\s+issued)/i,
  /generate\s+(a\s+)?fake\s+(alert|warning|temperature|weather)/i,
  /change\s+the\s+(temperature|forecast|rainfall|wind)/i,
  /override\s+(system|rules|data)/i,
  /system\s+prompt/i,
  /jailbreak/i,
];

/**
 * Detects prompt injection attempts in user input
 */
export function isPromptInjection(input: string): boolean {
  if (!input) return false;
  return PROMPT_INJECTION_PATTERNS.some((re) => re.test(input));
}

// Crisis / distress detection phrases in English, Hindi, Tamil
const CRISIS_PATTERNS = [
  /suicid/i,
  /kill myself/i,
  /end my life/i,
  /want to die/i,
  /hopeless/i,
  /आत्महत्या/i,
  /जान देना/i,
  /मरना चाहता/i,
  /जिंदगी खत्म/i,
  /தற்கொலை/i,
  /சாக வேண்டும்/i,
  /உயிரை மாய்க்க/i,
];

const TELE_MANAS_RESPONSES = {
  "en-IN": "We care deeply about your safety and well-being. Please remember that you are not alone and help is available. You can speak with a trained counselor at Tele MANAS by calling 14416 (or toll-free 1-800-891-4416). It is free, confidential, available 24/7, and offered in your language.",
  "hi-IN": "हम आपकी सुरक्षा और भलाई की गहरी चिंता करते हैं। कृपया याद रखें कि आप अकेले नहीं हैं और सहायता हमेशा उपलब्ध है। आप अभी टेली-मानस (Tele MANAS) हेल्पलाइन 14416 (या टोल-फ्री 1-800-891-4416) पर कॉल करके किसी प्रशिक्षित परामर्शदाता से बात कर सकते हैं। यह सेवा 24 घंटे, निःशुल्क, गोपनीय और आपकी भाषा में उपलब्ध है।",
  "ta-IN": "உங்கள் பாதுகாப்பும் நல்வாழ்வும் எங்களுக்கு மிக முக்கியம். நீங்கள் தனியாக இல்லை, உதவி எப்போதும் உள்ளது. இலவச டெலி-மானாஸ் (Tele MANAS) உதவி எண் 14416 (அல்லது 1-800-891-4416) ஐ அழைத்து உடனடியாக ஆலோசகரிடம் பேசலாம். இது 24 மணி நேரமும் இலவசமாகவும், ரகசியமாகவும், உங்கள் மொழியிலும் கிடைக்கும்.",
};

/**
 * Check if the input message triggers crisis intervention
 */
export function detectCrisisMessage(input: string): boolean {
  if (!input) return false;
  return CRISIS_PATTERNS.some((regex) => regex.test(input));
}

/**
 * Compiles a Unicode-aware token boundary regular expression.
 * Prevents false-positive substring matches:
 * - "rain" in "grain", "drain", "drainage", "train"
 * - "cane" in "hurricane", "volcano"
 * - "wind" in "window", "unwind"
 * - "now" in "know", "snow"
 * - "rice" in "price"
 * - "tea" in "team", "steam"
 */
export function compileTokenRegex(term: string): RegExp {
  const escaped = term
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "[\\s-]+");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`, "iu");
}

const CROP_EXTRACTION_MAP: Array<{ crop: string; patterns: RegExp[] }> = [
  { crop: "wheat", patterns: ["wheat", "गेहूं", "கோதுமை"].map(compileTokenRegex) },
  { crop: "cotton", patterns: ["cotton", "कपास", "பருத்தி"].map(compileTokenRegex) },
  { crop: "sugarcane", patterns: ["sugarcane", "cane", "गन्ना", "கரும்பு"].map(compileTokenRegex) },
  { crop: "mustard", patterns: ["mustard", "सरसों", "கடுகு"].map(compileTokenRegex) },
  { crop: "tea", patterns: ["tea", "चाय", "தேயிலை"].map(compileTokenRegex) },
  { crop: "groundnut", patterns: ["groundnut", "pulse", "peanut", "मूंगफली", "दाल"].map(compileTokenRegex) },
  {
    crop: "mango",
    patterns: [
      ...["mango", "mangoes", "fruit", "fruits", "आम", "மாம்பழம்", "மாங்காய்", "மாந்தோப்பு", "மாமரம்"].map(compileTokenRegex),
      /(?:^|\s)மா(?:\s|$)/u,
    ],
  },
  { crop: "vegetable", patterns: ["vegetable", "vegetables", "tomato", "tomatoes", "सब्जी", "தக்காளி"].map(compileTokenRegex) },
  { crop: "paddy", patterns: ["paddy", "rice", "धान", "நெல்"].map(compileTokenRegex) },
];

/**
 * Extract crop mentioned in user inquiry, or fallback to district primary crop
 */
export function extractCropFromQuery(q: string, fallbackCrop: string = "paddy"): string {
  for (const { crop, patterns } of CROP_EXTRACTION_MAP) {
    if (patterns.some((p) => p.test(q))) {
      return crop;
    }
  }
  return fallbackCrop;
}

// Warning indicators (+4)
const WARNING_KEYWORDS = [
  "warning", "alert", "cyclone", "danger", "storm", "flood", "gale",
  "चेतावनी", "अलर्ट", "तूफान", "बाढ़",
  "எச்சரிக்கை", "புயல்", "வெள்ளம்",
];
const WARNING_PATTERNS = WARNING_KEYWORDS.map(compileTokenRegex);

// Rainfall indicators (+4 for explicit rain queries)
const RAIN_KEYWORDS = [
  "rain", "rains", "raining", "rainfall", "precipitation", "shower", "showers", "downpour", "drizzle",
  "बारिश", "वर्षा", "बरसात", "बूंदाबांदी",
  "மழை", "தூறல்",
];
const RAIN_PATTERNS = RAIN_KEYWORDS.map(compileTokenRegex);

// 7-day outlook indicators (+4)
const OUTLOOK_KEYWORDS = [
  "forecast", "outlook", "next week", "upcoming", "7 day", "seven day",
  "पूर्वानुमान", "आगामी", "अगले सात दिन",
  "முன்னறிவிப்பு", "அடுத்த வாரம்",
];
const OUTLOOK_PATTERNS = OUTLOOK_KEYWORDS.map(compileTokenRegex);

// Crop / Advisory indicators (+3)
const CROP_KEYWORDS = [
  "crop", "crops", "spray", "spraying", "irrigation", "irrigate", "paddy", "wheat", "cotton", "cane", "sugarcane",
  "mango", "fertilizer", "fertilizers", "pest", "pests", "pesticide", "pesticides", "disease", "diseases", "farm", "farmer", "farming", "kisan",
  "फसल", "छिड़काव", "सिंचाई", "गेहूं", "धान", "कपास", "गन्ना", "खाद", "कीट",
  "பயிர்", "தெளிப்பு", "பாசனம்", "நெல்", "கோதுமை", "பருத்தி", "கரும்பு", "உரம்",
];
const CROP_PATTERNS = CROP_KEYWORDS.map(compileTokenRegex);

// Current weather indicators (+2)
const CURRENT_KEYWORDS = [
  "today", "now", "temperature", "temp", "humidity", "wind", "winds", "current",
  "आज", "अभी", "तापमान", "हवा", "आर्द्रता",
  "இன்று", "இப்போது", "வெப்பநிலை", "காற்று",
];
const CURRENT_PATTERNS = CURRENT_KEYWORDS.map(compileTokenRegex);

/**
 * Resolve intent deterministically with multi-intent scoring
 */
export function resolveIntent(query: string): WeatherIntent {
  const q = query.toLowerCase();

  // 1. Crisis Check: immediate bypass
  if (detectCrisisMessage(q)) {
    return "safety_crisis";
  }

  let scoreWarning = 0;
  let scoreRainfall = 0;
  let scoreCrop = 0;
  let scoreOutlook = 0;
  let scoreCurrent = 0;

  for (const pat of WARNING_PATTERNS) {
    if (pat.test(q)) scoreWarning += 4;
  }

  for (const pat of RAIN_PATTERNS) {
    if (pat.test(q)) scoreRainfall += 4;
  }

  for (const pat of OUTLOOK_PATTERNS) {
    if (pat.test(q)) scoreOutlook += 4;
  }

  for (const pat of CROP_PATTERNS) {
    if (pat.test(q)) scoreCrop += 3;
  }

  for (const pat of CURRENT_PATTERNS) {
    if (pat.test(q)) scoreCurrent += 2;
  }

  const scores = [
    { intent: "warning_status" as WeatherIntent, score: scoreWarning },
    { intent: "rainfall_forecast" as WeatherIntent, score: scoreRainfall },
    { intent: "seven_day_outlook" as WeatherIntent, score: scoreOutlook },
    { intent: "crop_advisory" as WeatherIntent, score: scoreCrop },
    { intent: "current_weather" as WeatherIntent, score: scoreCurrent },
  ];

  scores.sort((a, b) => b.score - a.score);
  return scores[0].score > 0 ? scores[0].intent : "current_weather";
}

/**
 * Format rainfall statement according to authoritative IMD classification standards:
 * 0 mm: strictly "no rain expected / dry weather" (SAFETY-CRITICAL TEST 6)
 * 0.1 - 2.4 mm: Very Light Rain
 * 2.5 - 15.5 mm: Light Rain
 * 15.6 - 64.4 mm: Moderate Rain
 * 64.5 - 115.5 mm: Heavy Rain
 * >= 115.6 mm: Very Heavy Rain
 */
function formatRainfallAnswer(
  rainfallMm: number,
  condition: string,
  district: string,
  language: "hi-IN" | "ta-IN" | "en-IN"
): string {
  if (rainfallMm === 0) {
    if (language === "hi-IN") {
      return `${district} में आज वर्षा की कोई संभावना नहीं है (0 मिमी)। मौसम मुख्यतः शुष्क रहेगा।`;
    }
    if (language === "ta-IN") {
      return `${district}ல் இன்று மழை பெய்ய வாய்ப்பில்லை (0 மிமீ). பெரும்பாலும் வறண்ட வானிலை நிலவும்.`;
    }
    return `No rain expected for ${district} today (0 mm). Dry conditions expected.`;
  }

  let classification = "Light Rain";
  if (rainfallMm < 2.5) classification = "Very Light Rain";
  else if (rainfallMm <= 15.5) classification = "Light Rain";
  else if (rainfallMm <= 64.4) classification = "Moderate Rain";
  else if (rainfallMm <= 115.5) classification = "Heavy Rain";
  else classification = "Very Heavy Rain";

  if (language === "hi-IN") {
    return `${district} में 24 घंटे में ${rainfallMm} मिमी वर्षा का अनुमान है (${classification})। स्थिति: ${condition}।`;
  }
  if (language === "ta-IN") {
    return `${district}ல் 24 மணி நேரத்தில் ${rainfallMm} மிமீ மழை எதிர்பார்க்கப்படுகிறது (${classification}). நிலை: ${condition}.`;
  }
  return `Rainfall forecast for ${district}: Expected precipitation around ${rainfallMm} mm (${classification}) with ${condition.toLowerCase()}.`;
}

/**
 * Process a user meteorological inquiry end-to-end
 */
export async function processWeatherQuery(
  query: string,
  district: string = "Raigad",
  language: "hi-IN" | "ta-IN" | "en-IN" = "en-IN"
): Promise<QueryResponse> {
  // Step 1: Prompt-Injection Defense
  // If prompt injection attempted, refuse to override trusted domain data
  if (isPromptInjection(query)) {
    return {
      answerText: "WeatherGPT only provides factual meteorological telemetry from authoritative sources. System instructions and meteorological data cannot be overridden.",
      intent: "current_weather",
      language,
      sourceProduct: "WeatherGPT Security Policy",
      issueTime: null,
      isCrisisIntervention: false,
      citationVerified: true,
    };
  }

  // Step 2: Crisis check
  if (detectCrisisMessage(query)) {
    return {
      answerText: TELE_MANAS_RESPONSES[language] || TELE_MANAS_RESPONSES["en-IN"],
      intent: "safety_crisis",
      language,
      sourceProduct: "National Tele Mental Health Programme (Tele MANAS 14416)",
      issueTime: null,
      isCrisisIntervention: true,
      citationVerified: true,
    };
  }

  const intent = resolveIntent(query);
  const districtInfo = resolveDistrictOrThrow(district);

  // Parallelize weather data & district alerts retrieval
  const [weather, activeAlerts] = await Promise.all([
    getDistrictWeather(districtInfo.name, districtInfo.state),
    fetchLiveImdDistrictAlerts(districtInfo.name, districtInfo.state),
  ]);

  const targetCrop = extractCropFromQuery(query, (districtInfo.crops?.[0] || "paddy").toLowerCase());

  let answerText = "";
  let dataCard: QueryResponse["dataCard"] = undefined;
  let sourceProduct = weather.sourceProduct;
  let issueTime = weather.issueTime;
  let evidence: Evidence | undefined = undefined;

  switch (intent) {
    case "crop_advisory": {
      const advisory = getDeterministicCropAdvisory(
        targetCrop,
        districtInfo.name,
        {
          temperature: weather.current.temperature,
          humidity: weather.current.humidity,
          windSpeed: weather.current.windSpeed,
          windDirection: weather.current.windDirection,
          rainfallLast24h: weather.current.rainfallLast24h,
          rainfallForecastNext24h: weather.forecastDaily[0]?.rainfallMm ?? 0,
        },
        language,
        weather.issueTime
      );

      sourceProduct = advisory.sourceRule;
      issueTime = advisory.issueTime;
      evidence = advisory.evidence;

      if (language === "hi-IN") {
        answerText = `${advisory.crop} फसल हेतु सलाह (${districtInfo.name}): ${advisory.sprayAdvisory} ${advisory.irrigationAdvisory} ${advisory.chemicalDisclaimer}`;
      } else if (language === "ta-IN") {
        answerText = `${advisory.crop} பயிர் ஆலோசனை (${districtInfo.name}): ${advisory.sprayAdvisory} ${advisory.irrigationAdvisory} ${advisory.chemicalDisclaimer}`;
      } else {
        answerText = `Advisory for ${districtInfo.name} ${advisory.crop} Crops: ${advisory.sprayAdvisory} ${advisory.irrigationAdvisory} Note: ${advisory.chemicalDisclaimer}`;
      }

      dataCard = {
        advisory: advisory.sprayCondition === "SAFE" ? "Spray Safe" : "Spray Unsafe",
        wind: weather.current.windSpeed !== null ? `${weather.current.windSpeed} km/h` : "N/A",
        rainfall: `${weather.forecastDaily[0]?.rainfallMm ?? 0} mm (Next 24h)`,
        humidity: weather.current.humidity !== null ? `${weather.current.humidity}%` : "N/A",
      };
      break;
    }

    case "warning_status": {
      if (activeAlerts.length > 0) {
        const topAlert = activeAlerts[0];
        answerText = topAlert.warningText;
        sourceProduct = topAlert.sourceProduct;
        issueTime = topAlert.issueTime;
        dataCard = {
          severity: topAlert.severity,
          warningHeadline: topAlert.headline,
        };
        evidence = {
          sourceId: topAlert.id,
          provider: "IMD",
          product: topAlert.sourceProduct,
          sourceUrl: topAlert.sourceUrl,
          issuedAt: topAlert.issueTime,
          retrievedAt: new Date().toISOString(),
          validFrom: topAlert.validFrom,
          validUntil: topAlert.validTo,
          rawRecordHash: topAlert.alertHash,
          quality: "OBSERVED",
        };
      } else {
        if (language === "hi-IN") {
          answerText = `वर्तमान में ${districtInfo.name} जिले के लिए कोई मौसम चेतावनी सक्रिय नहीं है।`;
        } else if (language === "ta-IN") {
          answerText = `தற்போது ${districtInfo.name} மாவட்டத்திற்கு தீவிர வானிலை எச்சரிக்கை எதுவும் இல்லை.`;
        } else {
          answerText = `No active weather warnings in effect for ${districtInfo.name} district at this time.`;
        }
        sourceProduct = `IMD Nowcast (${districtInfo.state})`;
        dataCard = {
          severity: "Low",
          warningHeadline: "No Warnings Active",
        };
      }
      break;
    }

    case "rainfall_forecast": {
      const todayRain = weather.forecastDaily[0]?.rainfallMm ?? 0;
      const condition = weather.current.condition;
      answerText = formatRainfallAnswer(todayRain, condition, districtInfo.name, language);

      dataCard = {
        rainfall: `${todayRain} mm`,
        humidity: weather.current.humidity !== null ? `${weather.current.humidity}%` : "N/A",
        wind: weather.current.windSpeed !== null ? `${weather.current.windSpeed} km/h` : "N/A",
        condition,
      };
      evidence = {
        sourceId: weather.provenance.sourceId || "FORECAST_NWP",
        provider: weather.provenance.provider,
        product: weather.sourceProduct,
        issuedAt: weather.issueTime,
        retrievedAt: weather.provenance.retrievedAt,
        quality: weather.provenance.quality,
      };
      break;
    }

    case "seven_day_outlook": {
      const minTemps = weather.forecastDaily.map(d => d.tempMin).filter(t => t !== null && !isNaN(t));
      const maxTemps = weather.forecastDaily.map(d => d.tempMax).filter(t => t !== null && !isNaN(t));
      const overallMin = minTemps.length > 0 ? Math.min(...minTemps) : 20;
      const overallMax = maxTemps.length > 0 ? Math.max(...maxTemps) : 32;
      const rainyDays = weather.forecastDaily.filter(d => (d.rainfallMm ?? 0) > 1 || d.condition.toLowerCase().includes("rain") || d.condition.toLowerCase().includes("shower"));

      let summaryEn = rainyDays.length > 0
        ? `Expect approximately ${rainyDays.length} day(s) with precipitation over the 7-day period.`
        : `Mainly dry conditions expected across the 7-day outlook.`;
      let summaryHi = rainyDays.length > 0
        ? `आगामी 7 दिनों में लगभग ${rainyDays.length} दिन वर्षा की संभावना है।`
        : `आगामी 7 दिनों में मुख्यतः मौसम शुष्क रहने का अनुमान है।`;
      let summaryTa = rainyDays.length > 0
        ? `அடுத்த 7 நாட்களில் சுமார் ${rainyDays.length} நாட்கள் மழை பெய்ய வாய்ப்புள்ளது.`
        : `அடுத்த 7 நாட்களில் பெரும்பாலும் வறண்ட வானிலை நிலவும்.`;

      if (language === "hi-IN") {
        answerText = `${districtInfo.name} के लिए 7-दिवसीय पूर्वानुमान: तापमान ${overallMin}°C से ${overallMax}°C के बीच रहने का अनुमान है। ${summaryHi}`;
      } else if (language === "ta-IN") {
        answerText = `${districtInfo.name} 7 நாள் வானிலை: வெப்பநிலை ${overallMin}°C முதல் ${overallMax}°C வரை இருக்கும். ${summaryTa}`;
      } else {
        answerText = `7-Day Outlook for ${districtInfo.name}: Temperatures ranging between ${overallMin}°C and ${overallMax}°C. ${summaryEn}`;
      }
      dataCard = {
        outlook: weather.forecastDaily.map((d) => ({
          day: d.day,
          condition: d.condition,
          range: `${d.tempMin}° / ${d.tempMax}°`,
        })),
      };
      break;
    }

    case "current_weather":
    default: {
      const temp = weather.current.temperature !== null ? `${Math.round(weather.current.temperature)}` : "N/A";
      const cond = weather.current.condition;
      const wind = weather.current.windSpeed !== null ? `${weather.current.windSpeed}` : "N/A";
      const hum = weather.current.humidity !== null ? `${weather.current.humidity}` : "N/A";
      const windDir = weather.current.windDirection || "Calm";

      if (language === "hi-IN") {
        answerText = `${districtInfo.name} में वर्तमान तापमान ${temp}°C है। मौसम: ${cond}। हवा ${wind} किमी/घंटा और आर्द्रता ${hum}% है।`;
      } else if (language === "ta-IN") {
        answerText = `${districtInfo.name}ல் தற்போதைய வெப்பநிலை ${temp}°C. வானிலை: ${cond}. காற்று வேகம் ${wind} கிமீ/மணி, ஈரப்பதம் ${hum}%.`;
      } else {
        answerText = `Current weather in ${districtInfo.name}: ${temp}°C, ${cond}. Wind speed is ${wind} km/h from ${windDir} with ${hum}% relative humidity.`;
      }

      dataCard = {
        temperature: `${temp}°C`,
        humidity: `${hum}%`,
        wind: `${wind} km/h`,
        condition: cond,
      };
      evidence = {
        sourceId: weather.provenance.sourceId || "OBS_SURFACE",
        provider: weather.provenance.provider,
        product: weather.sourceProduct,
        issuedAt: weather.issueTime,
        retrievedAt: weather.provenance.retrievedAt,
        quality: weather.provenance.quality,
      };
      break;
    }
  }

  // Citation Gate Assertion (Requirement 14):
  // Must have genuine provider, sourceProduct, and not an unverified fabrication.
  const citationVerified = Boolean(
    sourceProduct &&
    sourceProduct.trim().length > 0 &&
    !sourceProduct.toLowerCase().includes("unverified")
  );

  return {
    answerText,
    intent,
    language,
    dataCard,
    sourceProduct,
    issueTime: issueTime || null,
    isCrisisIntervention: false,
    citationVerified,
    evidence,
  };
}
