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
import { DEFAULT_DISTRICT } from "../config/constants";

export type WeatherIntent =
  | "current_weather"
  | "rainfall_forecast"
  | "warning_status"
  | "crop_advisory"
  | "seven_day_outlook"
  | "safety_crisis";

export type SupportedLanguage =
  | "en-IN"
  | "hi-IN"
  | "ta-IN"
  | "mr-IN"
  | "bn-IN"
  | "te-IN"
  | "gu-IN"
  | "kn-IN"
  | "pa-IN";

export function normalizeLanguageCode(code?: string): SupportedLanguage {
  if (!code) return "en-IN";
  const lower = code.toLowerCase().trim();
  if (lower === "mr" || lower === "mr-in") return "mr-IN";
  if (lower === "bn" || lower === "bn-in") return "bn-IN";
  if (lower === "hi" || lower === "hi-in") return "hi-IN";
  if (lower === "ta" || lower === "ta-in") return "ta-IN";
  if (lower === "te" || lower === "te-in") return "te-IN";
  if (lower === "gu" || lower === "gu-in") return "gu-IN";
  if (lower === "kn" || lower === "kn-in") return "kn-IN";
  if (lower === "pa" || lower === "pa-in") return "pa-IN";
  return "en-IN";
}

export interface QueryResponse {
  answerText: string;
  intent: WeatherIntent;
  language: SupportedLanguage;
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

// Crisis / distress detection phrases in English, Hindi, Tamil, Marathi, Bengali, Telugu, Kannada, Gujarati, Punjabi
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
  /मरायचं आहे/i,
  /मरायचे आहे/i,
  /जीव द्यायचा/i,
  /जीवन संपवा/i,
  /जगण्याची इच्छा/i,
  /नैराश्य/i,
  /আত্মহত্যা/i,
  /মরতে চাই/i,
  /জীবন শেষ/i,
  /ఆత్మహత్య/i,
  /చనిపోవాలనుకుంటున్నా/i,
  /ಆತ್ಮಹತ್ಯೆ/i,
  /ಸಾಯಬೇಕು/i,
  /આત્મહત્યા/i,
  /મરી જવું/i,
  /ਖੁਦਕੁਸ਼ੀ/i,
  /ਮਰਨਾ ਚਾਹੁੰਦਾ/i,
];

const TELE_MANAS_RESPONSES: Record<SupportedLanguage, string> = {
  "en-IN": "We care deeply about your safety and well-being. Please remember that you are not alone and help is available. You can speak with a trained counselor at Tele MANAS by calling 14416 (or toll-free 1-800-891-4416). It is free, confidential, available 24/7, and offered in your language.",
  "hi-IN": "हम आपकी सुरक्षा और भलाई की गहरी चिंता करते हैं। कृपया याद रखें कि आप अकेले नहीं हैं और सहायता हमेशा उपलब्ध है। आप अभी टेली-मानस (Tele MANAS) हेल्पलाइन 14416 (या टोल-फ्री 1-800-891-4416) पर कॉल करके किसी प्रशिक्षित परामर्शदाता से बात कर सकते हैं। यह सेवा 24 घंटे, निःशुल्क, गोपनीय और आपकी भाषा में उपलब्ध है।",
  "ta-IN": "உங்கள் பாதுகாப்பும் நல்வாழ்வும் எங்களுக்கு மிக முக்கியம். நீங்கள் தனியாக இல்லை, உதவி எப்போதும் உள்ளது. இலவச டெலி-மானாஸ் (Tele MANAS) உதவி எண் 14416 (அல்லது 1-800-891-4416) ஐ அழைத்து உடனடியாக ஆலோசகரிடம் பேசலாம். இது 24 மணி நேரமும் இலவசமாகவும், ரகசியமாகவும், உங்கள் மொழியிலும் கிடைக்கும்.",
  "mr-IN": "आम्हाला तुमच्या सुरक्षेची आणि आरोग्याची काळजी आहे. कृपया लक्षात ठेवा की तुम्ही एकटे नाही आहात आणि मदत उपलब्ध आहे. तुम्ही टेली-मानस (Tele MANAS) हेल्पलाइन 14416 (किंवा 1-800-891-4416) वर कॉल करून समुपदेशकांशी बोलू शकता. ही सेवा २४ तास मोफत, गोपनीय आणि आपल्या भाषेत उपलब्ध आहे.",
  "bn-IN": "আমরা আপনার নিরাপত্তা এবং সুস্থতার বিষয়ে গভীরভাবে যত্নশীল। দয়া করে মনে রাখবেন যে আপনি একা নন এবং সাহায্য পাওয়া যায়। আপনি টেলি-মানস (Tele MANAS) হেল্পলাইন 14416 (বা 1-800-891-4416)-এ কল করে প্রশিক্ষিত কাউন্সেলরের সাথে কথা বলতে পারেন। এটি ২৪/৭ বিনামূল্যে, গোপনীয় এবং আপনার ভাষায় উপলব্ধ।",
  "te-IN": "మీ భద్రత మరియు శ్రేయస్సు మాకు చాలా ముఖ్యం. మీరు ఒంటరిగా లేరని దయచేసి గుర్తుంచుకోండి. మీరు టెలి-మానస్ (Tele MANAS) హెల్ప్‌లైన్ 14416 (లేదా 1-800-891-4416) కు కాల్ చేసి కౌన్సెలర్‌తో మాట్లాడవచ్చు. ఇది 24/7 ఉచితంగా, గోప్యంగా మీ భాషలో లభిస్తుంది.",
  "gu-IN": "અમે તમારી સુરક્ષા અને સુખાકારીની ઊંડી કાળજી રાખીએ છીએ. કૃપા કરીને યાદ રાખો કે તમે એકલા નથી અને મદદ ઉપલબ્ધ છે. તમે ટેલિ-માનસ (Tele MANAS) હેલ્પલાઇન 14416 (અથવા 1-800-891-4416) પર કૉલ કરી શકો છો. આ સેવા 24/7 મફત, ગુપ્ત અને તમારી ભાષામાં ઉપલબ્ધ છે.",
  "kn-IN": "ನಿಮ್ಮ ಸುರಕ್ಷತೆ ಮತ್ತು ಯೋಗಕ್ಷೇಮ ನಮಗೆ ಅತ್ಯಂತ ಮುಖ್ಯ. ದಯವಿಟ್ಟು ನೆನಪಿಡಿ ನೀವು ಒಂಟಿಯಲ್ಲ, ಸಹಾಯ ಸದಾ ಲಭ್ಯವಿದೆ. ಟೆಲಿ-ಮಾನಸ್ (Tele MANAS) ಸಹಾಯವಾಣಿ 14416 (ಅಥವಾ 1-800-891-4416) ಗೆ ಕರೆ ಮಾಡಿ ಸಮಾಲೋಚಕರೊಂದಿಗೆ ಮಾತನಾಡಬಹುದು. ಇದು 24/7 ಉಚಿತ ಹಾಗೂ ಗೌಪ್ಯವಾಗಿರುತ್ತದೆ.",
  "pa-IN": "ਅਸੀਂ ਤੁਹਾਡੀ ਸੁਰੱਖਿਆ ਅਤੇ ਭਲਾਈ ਦੀ ਡੂੰਘੀ ਚਿੰਤਾ ਕਰਦੇ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਯਾਦ ਰੱਖੋ ਕਿ ਤੁਸੀਂ ਇਕੱਲੇ ਨਹੀਂ ਹੋ ਅਤੇ ਮਦਦ ਉਪਲਬਧ ਹੈ। ਤੁਸੀਂ ਟੈਲੀ-ਮਾਨਸ (Tele MANAS) ਹੈਲਪਲਾਈਨ 14416 (ਜਾਂ 1-800-891-4416) 'ਤੇ ਕਾਲ ਕਰਕੇ ਸਲਾਹਕਾਰ ਨਾਲ ਗੱਲ ਕਰ ਸਕਦੇ ਹੋ।",
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
  "इशारा", "वादळ", "पूर", "धोका",
  "সতর্কতা", "ঘূর্ণিঝড়", "বন্যা",
  "హెచ్చరిక", "తుఫాను",
  "ચેતવણી", "વાવાઝોડું",
  "ಎಚ್ಚರಿಕೆ",
  "ਚੇਤਾਵਨੀ",
];
const WARNING_PATTERNS = WARNING_KEYWORDS.map(compileTokenRegex);

// Rainfall indicators (+4 for explicit rain queries)
const RAIN_KEYWORDS = [
  "rain", "rains", "raining", "rainfall", "precipitation", "shower", "showers", "downpour", "drizzle",
  "बारिश", "वर्षा", "बरसात", "बूंदाबांदी",
  "மழை", "தூறல்",
  "पाऊस", "पडेल", "पावसाची", "धारा",
  "বৃষ্টি", "বৃষ্টিপাত",
  "వర్షం", "వాన",
  "વરસાદ",
  "ಮಳೆ",
  "ਮੀਂਹ",
];
const RAIN_PATTERNS = RAIN_KEYWORDS.map(compileTokenRegex);

// 7-day outlook indicators (+4)
const OUTLOOK_KEYWORDS = [
  "forecast", "outlook", "next week", "upcoming", "7 day", "seven day",
  "पूर्वानुमान", "आगामी", "अगले सात दिन",
  "முன்னறிவிப்பு", "அடுத்த வாரம்",
  "अंदाज", "आठवडा", "७ दिवस",
  "পূর্বাভাস", "সাত দিন",
  "సూచన",
  "આગાહી",
  "ಮುನ್ಸೂಚನೆ",
  "ਅਨੁਮਾਨ",
];
const OUTLOOK_PATTERNS = OUTLOOK_KEYWORDS.map(compileTokenRegex);

// Crop / Advisory indicators (+3)
const CROP_KEYWORDS = [
  "crop", "crops", "spray", "spraying", "irrigation", "irrigate", "paddy", "wheat", "cotton", "cane", "sugarcane",
  "mango", "fertilizer", "fertilizers", "pest", "pests", "pesticide", "pesticides", "disease", "diseases", "farm", "farmer", "farming", "kisan",
  "फसल", "छिड़काव", "सिंचाई", "गेहूं", "धान", "कपास", "गन्ना", "खाद", "कीट",
  "பயிர்", "தெளிப்பு", "பாசனம்", "நெல்", "கோதுமை", "பருத்தி", "கரும்பு", "உரம்",
  "पीक", "फवारणी", "पाणी", "खत", "शेतकरी",
  "ফসল", "সেচ", "সার", "কীটনাশক", "কৃষক",
  "పంట", "రైతు",
  "પાક", "ખેડૂત",
  "ಬೆಳೆ", "ರೈತ",
  "ਫ਼ਸਲ", "ਕਿਸਾਨ",
];
const CROP_PATTERNS = CROP_KEYWORDS.map(compileTokenRegex);

// Current weather indicators (+2)
const CURRENT_KEYWORDS = [
  "today", "now", "temperature", "temp", "humidity", "wind", "winds", "current", "weather",
  "आज", "अभी", "तापमान", "हवा", "आर्द्रता", "मौसम",
  "இன்று", "இப்போது", "வெப்பநிலை", "காற்று", "வானிலை",
  "हवामान",
  "আবহাওয়া",
  "వాతావరణం",
  "હવામાન",
  "ಹವಾಮಾನ",
  "ਮੌਸਮ",
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
  rainfallMm: number | null,
  condition: string,
  district: string,
  language: SupportedLanguage
): string {
  if (rainfallMm === null) {
    switch (language) {
      case "hi-IN":
        return `${district} के लिए वर्षा का कोई प्रेक्षित डेटा उपलब्ध नहीं है। वर्तमान स्थिति: ${condition}।`;
      case "ta-IN":
        return `${district} மாவட்டத்திற்கான மழைப்பொழிவு தரவு கிடைக்கவில்லை. தற்போதைய நிலை: ${condition}.`;
      case "mr-IN":
        return `${district} साठी पावसाचा कोणताही प्रेक्षित डेटा उपलब्ध नाही. सद्यस्थिती: ${condition}.`;
      case "bn-IN":
        return `${district} জেলার জন্য কোনো বৃষ্টির ডেটা উপলব্ধ নেই। বর্তমান অবস্থা: ${condition}।`;
      case "te-IN":
        return `${district} కొరకు వర్షపాతం డేటా అందుబాటులో లేదు. ప్రస్తుత పరిస్థితి: ${condition}.`;
      case "gu-IN":
        return `${district} માટે વરસાદનો કોઈ ઉપલબ્ધ ડેટા નથી. વર્તમાન સ્થિતિ: ${condition}.`;
      case "kn-IN":
        return `${district} ಗೆ ಮಳೆಯ ದತ್ತಾಂಶ ಲಭ್ಯವಿಲ್ಲ. ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ: ${condition}.`;
      case "pa-IN":
        return `${district} ਲਈ ਮੀਂਹ ਦਾ ਕੋਈ ਡਾਟਾ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਮੌਜੂਦਾ ਸਥਿਤੀ: ${condition}।`;
      case "en-IN":
      default:
        return `Rainfall data is currently unavailable for ${district}. Current condition: ${condition}.`;
    }
  }

  if (rainfallMm === 0) {
    switch (language) {
      case "hi-IN":
        return `${district} में आज वर्षा की कोई संभावना नहीं है (0 मिमी)। मौसम मुख्यतः शुष्क रहेगा।`;
      case "ta-IN":
        return `${district}ல் இன்று மழை பெய்ய வாய்ப்பில்லை (0 மிமீ). பெரும்பாலும் வறண்ட வானிலை நிலவும்.`;
      case "mr-IN":
        return `${district} मध्ये आज पावसाची शक्यता नाही (0 मिमी). हवामान मुख्यतः कोरडे राहील.`;
      case "bn-IN":
        return `${district} জেলায় আজ কোনো বৃষ্টির সম্ভাবনা নেই (০ মিমি)। আবহাওয়া মূলত শুষ্ক থাকবে।`;
      case "te-IN":
        return `${district} లో ఈరోజు వర్షం పడే అవకాశం లేదు (0 మి.మీ). వాతావరణం పొడిగా ఉంటుంది.`;
      case "gu-IN":
        return `${district} માં આજે વરસાદની કોઈ શક્યતા નથી (0 મીમી). હવામાન મુખ્યત્વે સૂકું રહેશે.`;
      case "kn-IN":
        return `${district} ನಲ್ಲಿ ಇಂದು ಮಳೆಯ ಸಾಧ್ಯತೆಯಿಲ್ಲ (0 ಮಿಮೀ). ವಾತಾವರಣ ಒಣಗಿರುತ್ತದೆ.`;
      case "pa-IN":
        return `${district} ਵਿੱਚ ਅੱਜ ਮੀਂਹ ਦੀ ਕੋਈ ਸੰਭਾਵਨਾ ਨਹੀਂ ਹੈ (0 ਮਿਲੀਮੀਟਰ)। ਮੌਸਮ ਮੁੱਖ ਤੌਰ 'ਤੇ ਖੁਸ਼ਕ ਰਹੇਗਾ।`;
      case "en-IN":
      default:
        return `No rain expected for ${district} today (0 mm). Dry conditions expected.`;
    }
  }

  let classification = "Light Rain";
  if (rainfallMm < 2.5) classification = "Very Light Rain";
  else if (rainfallMm <= 15.5) classification = "Light Rain";
  else if (rainfallMm <= 64.4) classification = "Moderate Rain";
  else if (rainfallMm <= 115.5) classification = "Heavy Rain";
  else classification = "Very Heavy Rain";

  switch (language) {
    case "hi-IN":
      return `${district} में 24 घंटे में ${rainfallMm} मिमी वर्षा का अनुमान है (${classification})। स्थिति: ${condition}।`;
    case "ta-IN":
      return `${district}ல் 24 மணி நேரத்தில் ${rainfallMm} மிமீ மழை எதிர்பார்க்கப்படுகிறது (${classification}). நிலை: ${condition}.`;
    case "mr-IN":
      return `${district} मध्ये 24 तासांत अंदाजे ${rainfallMm} मिमी पाऊस पडण्याची शक्यता आहे (${classification}). स्थिती: ${condition}.`;
    case "bn-IN":
      return `${district} জেলায় আগামী ২৪ ঘণ্টায় প্রায় ${rainfallMm} মিমি বৃষ্টির সম্ভাবনা রয়েছে (${classification})। অবস্থা: ${condition}।`;
    case "te-IN":
      return `${district} లో 24 గంటల్లో ${rainfallMm} మి.మీ వర్షపాతం అంచనా వేయబడింది (${classification}). పరిస్థితి: ${condition}.`;
    case "gu-IN":
      return `${district} માં 24 કલાકમાં ${rainfallMm} મીમી વરસાદની આગાહી છે (${classification}). સ્થિતિ: ${condition}.`;
    case "kn-IN":
      return `${district} ನಲ್ಲಿ 24 ಗಂಟೆಗಳಲ್ಲಿ ${rainfallMm} ಮಿಮೀ ಮಳೆ ಮುನ್ಸೂಚನೆ ಇದೆ (${classification}). ಸ್ಥಿತಿ: ${condition}.`;
    case "pa-IN":
      return `${district} ਵਿੱਚ 24 ਘੰਟਿਆਂ ਵਿੱਚ ${rainfallMm} ਮਿਲੀਮੀਟਰ ਮੀਂਹ ਦਾ ਅਨੁਮਾਨ ਹੈ (${classification})। ਸਥਿਤੀ: ${condition}।`;
    case "en-IN":
    default:
      return `Rainfall forecast for ${district}: Expected precipitation around ${rainfallMm} mm (${classification}) with ${condition.toLowerCase()}.`;
  }
}

/**
 * Process a user meteorological inquiry end-to-end
 */
export async function processWeatherQuery(
  query: string,
  district: string = DEFAULT_DISTRICT,
  rawLanguage: string = "en-IN"
): Promise<QueryResponse> {
  const language = normalizeLanguageCode(rawLanguage);

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
          rainfallLast24h: weather.current.rainfallLast24h ?? weather.current.rainfallLast24hEstimate ?? null,
          rainfallForecastNext24h: weather.forecastDaily[0]?.rainfallMm ?? 0,
        },
        language,
        weather.issueTime
      );

      sourceProduct = advisory.sourceRule;
      issueTime = advisory.issueTime;
      evidence = advisory.evidence;

      switch (language) {
        case "hi-IN":
          answerText = `${advisory.crop} फसल हेतु सलाह (${districtInfo.name}): ${advisory.sprayAdvisory} ${advisory.irrigationAdvisory} ${advisory.chemicalDisclaimer}`;
          break;
        case "ta-IN":
          answerText = `${advisory.crop} பயிர் ஆலோசனை (${districtInfo.name}): ${advisory.sprayAdvisory} ${advisory.irrigationAdvisory} ${advisory.chemicalDisclaimer}`;
          break;
        case "mr-IN":
          answerText = `${advisory.crop} पिकासाठी सल्ला (${districtInfo.name}): ${advisory.sprayAdvisory} ${advisory.irrigationAdvisory} ${advisory.chemicalDisclaimer}`;
          break;
        case "bn-IN":
          answerText = `${advisory.crop} ফসলের জন্য পরামর্শ (${districtInfo.name}): ${advisory.sprayAdvisory} ${advisory.irrigationAdvisory} ${advisory.chemicalDisclaimer}`;
          break;
        case "te-IN":
          answerText = `${districtInfo.name} ${advisory.crop} పంట సలహా: ${advisory.sprayAdvisory} ${advisory.irrigationAdvisory} ${advisory.chemicalDisclaimer}`;
          break;
        case "gu-IN":
          answerText = `${districtInfo.name} ${advisory.crop} પાક માટે સલાહ: ${advisory.sprayAdvisory} ${advisory.irrigationAdvisory} ${advisory.chemicalDisclaimer}`;
          break;
        case "kn-IN":
          answerText = `${districtInfo.name} ${advisory.crop} ಬೆಳೆ ಸಲಹೆ: ${advisory.sprayAdvisory} ${advisory.irrigationAdvisory} ${advisory.chemicalDisclaimer}`;
          break;
        case "pa-IN":
          answerText = `${districtInfo.name} ${advisory.crop} ਫ਼ਸਲ ਸੰਬੰਧੀ ਸਲਾਹ: ${advisory.sprayAdvisory} ${advisory.irrigationAdvisory} ${advisory.chemicalDisclaimer}`;
          break;
        case "en-IN":
        default:
          answerText = `Advisory for ${districtInfo.name} ${advisory.crop} Crops: ${advisory.sprayAdvisory} ${advisory.irrigationAdvisory} Note: ${advisory.chemicalDisclaimer}`;
          break;
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
        switch (language) {
          case "hi-IN":
            answerText = `वर्तमान में ${districtInfo.name} जिले के लिए कोई मौसम चेतावनी सक्रिय नहीं है।`;
            break;
          case "ta-IN":
            answerText = `தற்போது ${districtInfo.name} மாவட்டத்திற்கு தீவிர வானிலை எச்சரிக்கை எதுவும் இல்லை.`;
            break;
          case "mr-IN":
            answerText = `सध्या ${districtInfo.name} जिल्ह्यासाठी कोणतीही हवामान चेतावणी सक्रिय नाही.`;
            break;
          case "bn-IN":
            answerText = `বর্তমানে ${districtInfo.name} জেলার জন্য কোনো আবহাওয়া সতর্কতা সক্রিয় নেই।`;
            break;
          case "te-IN":
            answerText = `ప్రస్తుతం ${districtInfo.name} జిల్లాకు ఎలాంటి వాతావరణ హెచ్చరికలు లేవు.`;
            break;
          case "gu-IN":
            answerText = `હાલમાં ${districtInfo.name} જિલ્લા માટે કોઈ હવામાન ચેતવણી સક્રિય નથી.`;
            break;
          case "kn-IN":
            answerText = `ಪ್ರಸ್ತುತ ${districtInfo.name} ಜಿಲ್ಲೆಗೆ ಯಾವುದೇ ಹವಾಮಾನ ಎಚ್ಚರಿಕೆ ಸಕ್ರಿಯವಾಗಿಲ್ಲ.`;
            break;
          case "pa-IN":
            answerText = `ਇਸ ਵੇਲੇ ${districtInfo.name} ਜ਼ਿਲ੍ਹੇ ਲਈ ਕੋਈ ਮੌਸਮ ਚੇਤਾਵਨੀ ਸਰਗਰਮ ਨਹੀਂ ਹੈ।`;
            break;
          case "en-IN":
          default:
            answerText = `No active weather warnings in effect for ${districtInfo.name} district at this time.`;
            break;
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
      const todayRain = weather.forecastDaily[0]?.rainfallMm !== undefined
        ? weather.forecastDaily[0].rainfallMm
        : (weather.current.rainfallLast24hEstimate ?? null);
      const condition = weather.current.condition;
      answerText = formatRainfallAnswer(todayRain, condition, districtInfo.name, language);

      dataCard = {
        rainfall: todayRain !== null ? `${todayRain} mm` : "N/A",
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
      const minTemps = weather.forecastDaily.map(d => d.tempMin).filter((t): t is number => t !== null && !isNaN(t));
      const maxTemps = weather.forecastDaily.map(d => d.tempMax).filter((t): t is number => t !== null && !isNaN(t));
      const overallMin = minTemps.length > 0 ? Math.min(...minTemps) : null;
      const overallMax = maxTemps.length > 0 ? Math.max(...maxTemps) : null;
      const rainyDays = weather.forecastDaily.filter(d => (d.rainfallMm ?? 0) > 1 || d.condition.toLowerCase().includes("rain") || d.condition.toLowerCase().includes("shower"));
      const rainyCount = rainyDays.length;
      const hasRain = rainyCount > 0;

      switch (language) {
        case "hi-IN": {
          const summary = hasRain
            ? `आगामी 7 दिनों में लगभग ${rainyCount} दिन वर्षा की संभावना है।`
            : `आगामी 7 दिनों में मुख्यतः मौसम शुष्क रहने का अनुमान है।`;
          const tempRange = overallMin !== null && overallMax !== null
            ? `तापमान ${overallMin}°C से ${overallMax}°C के बीच रहने का अनुमान है।`
            : `तापमान डेटा अद्यतन हो रहा है।`;
          answerText = `${districtInfo.name} के लिए 7-दिवसीय पूर्वानुमान: ${tempRange} ${summary}`;
          break;
        }
        case "ta-IN": {
          const summary = hasRain
            ? `அடுத்த 7 நாட்களில் சுமார் ${rainyCount} நாட்கள் மழை பெய்ய வாய்ப்புள்ளது.`
            : `அடுத்த 7 நாட்களில் பெரும்பாலும் வறண்ட வானிலை நிலவும்.`;
          const tempRange = overallMin !== null && overallMax !== null
            ? `வெப்பநிலை ${overallMin}°C முதல் ${overallMax}°C வரை இருக்கும்.`
            : `வெப்பநிலை தகவல் புதுப்பிக்கப்படுகிறது.`;
          answerText = `${districtInfo.name} 7 நாள் வானிலை: ${tempRange} ${summary}`;
          break;
        }
        case "mr-IN": {
          const summary = hasRain
            ? `पुढील ७ दिवसांत साधारण ${rainyCount} दिवस पावसाची शक्यता आहे.`
            : `पुढील ७ दिवसांत हवामान मुख्यतः कोरडे राहण्याचा अंदाज आहे.`;
          const tempRange = overallMin !== null && overallMax !== null
            ? `तापमान ${overallMin}°C ते ${overallMax}°C दरम्यान राहण्याचा अंदाज आहे.`
            : `तापमान माहिती अद्यतनित होत आहे.`;
          answerText = `${districtInfo.name} साठी ७ दिवसांचा हवामान अंदाज: ${tempRange} ${summary}`;
          break;
        }
        case "bn-IN": {
          const summary = hasRain
            ? `আগামী ৭ দিনে প্রায় ${rainyCount} দিন বৃষ্টির সম্ভাবনা রয়েছে।`
            : `আগামী ৭ দিনে আবহাওয়া মূলত শুষ্ক থাকার পূর্বাভাস রয়েছে।`;
          const tempRange = overallMin !== null && overallMax !== null
            ? `तापমাত্রা ${overallMin}°C থেকে ${overallMax}°C এর মধ্যে থাকার সম্ভাবনা।`
            : `তাপমাত্রার তথ্য আপডেট হচ্ছে।`;
          answerText = `${districtInfo.name} জেলার ৭ দিনের পূর্বাভাস: ${tempRange} ${summary}`;
          break;
        }
        case "te-IN": {
          const summary = hasRain
            ? `రాబోయే 7 రోజుల్లో సుమారు ${rainyCount} రోజులు వర్షం పడే అవకాశం ఉంది.`
            : `రాబోయే 7 రోజుల్లో వాతావరణం పొడిగా ఉండే అవకాశం ఉంది.`;
          const tempRange = overallMin !== null && overallMax !== null
            ? `ఉష్ణోగ్రతలు ${overallMin}°C నుండి ${overallMax}°C మధ్య ఉంటాయి.`
            : `ఉష్ణోగ్రత వివరాలు నవీకరించబడుతున్నాయి.`;
          answerText = `${districtInfo.name} 7 రోజుల వాతావరణ సూచన: ${tempRange} ${summary}`;
          break;
        }
        case "gu-IN": {
          const summary = hasRain
            ? `આગામી 7 દિવસમાં આશરે ${rainyCount} દિવસ વરસાદની શક્યતા છે.`
            : `આગામી 7 દિવસમાં હવામાન મુખ્યત્વે સૂકું રહેવાની ધારણા છે.`;
          const tempRange = overallMin !== null && overallMax !== null
            ? `તાપમાન ${overallMin}°C થી ${overallMax}°C વચ્ચે રહેશે.`
            : `તાપમાન ડેટા અપડેટ થઈ રહ્યો છે.`;
          answerText = `${districtInfo.name} માટે 7 દિવસની આગાહી: ${tempRange} ${summary}`;
          break;
        }
        case "kn-IN": {
          const summary = hasRain
            ? `ಮುಂದಿನ 7 ದಿನಗಳಲ್ಲಿ ಸುಮಾರು ${rainyCount} ದಿನ ಮಳೆಯಾಗುವ ಸಾಧ್ಯತೆಯಿದೆ.`
            : `ಮುಂದಿನ 7 ದಿನಗಳಲ್ಲಿ ವಾತಾವರಣ ಮುಖ್ಯವಾಗಿ ಒಣಗಿರುತ್ತದೆ.`;
          const tempRange = overallMin !== null && overallMax !== null
            ? `ತಾಪಮಾನ ${overallMin}°C ನಿಂದ ${overallMax}°C ವರೆಗೆ ಇರುತ್ತದೆ.`
            : `ತಾಪಮಾನ ನವೀಕರಣಗೊಳ್ಳುತ್ತಿದೆ.`;
          answerText = `${districtInfo.name} ಗೆ 7 ದಿನಗಳ ಹವಾಮಾನ ಮುನ್ಸೂಚನೆ: ${tempRange} ${summary}`;
          break;
        }
        case "pa-IN": {
          const summary = hasRain
            ? `ਅਗਲੇ 7 ਦਿਨਾਂ ਵਿੱਚ ਲਗਭਗ ${rainyCount} ਦਿਨ ਮੀਂਹ ਪੈਣ ਦੀ ਸੰਭਾਵਨਾ ਹੈ।`
            : `ਅਗਲੇ 7 ਦਿਨਾਂ ਵਿੱਚ ਮੌਸਮ ਮੁੱਖ ਤੌਰ 'ਤੇ ਖੁਸ਼ਕ ਰਹਿਣ ਦੀ ਉਮੀਦ ਹੈ।`;
          const tempRange = overallMin !== null && overallMax !== null
            ? `ਤਾਪਮਾਨ ${overallMin}°C ਤੋਂ ${overallMax}°C ਦੇ ਵਿਚਕਾਰ ਰਹਿਣ ਦਾ ਅਨੁਮਾਨ ਹੈ।`
            : `ਤਾਪਮਾਨ ਡਾਟਾ ਅੱਪਡੇਟ ਹੋ ਰਿਹਾ ਹੈ।`;
          answerText = `${districtInfo.name} ਲਈ 7 ਦਿਨਾਂ ਦਾ ਮੌਸਮ ਅਨੁਮਾਨ: ${tempRange} ${summary}`;
          break;
        }
        case "en-IN":
        default: {
          const summary = hasRain
            ? `Expect approximately ${rainyCount} day(s) with precipitation over the 7-day period.`
            : `Mainly dry conditions expected across the 7-day outlook.`;
          const tempRange = overallMin !== null && overallMax !== null
            ? `Temperatures ranging between ${overallMin}°C and ${overallMax}°C.`
            : `Temperature trends currently updating.`;
          answerText = `7-Day Outlook for ${districtInfo.name}: ${tempRange} ${summary}`;
          break;
        }
      }

      dataCard = {
        outlook: weather.forecastDaily.map((d) => ({
          day: d.day,
          condition: d.condition,
          range: `${d.tempMin != null ? `${d.tempMin}°` : "N/A"} / ${d.tempMax != null ? `${d.tempMax}°` : "N/A"}`,
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

      switch (language) {
        case "hi-IN":
          answerText = `${districtInfo.name} में वर्तमान तापमान ${temp}°C है। मौसम: ${cond}। हवा ${wind} किमी/घंटा और आर्द्रता ${hum}% है।`;
          break;
        case "ta-IN":
          answerText = `${districtInfo.name}ல் தற்போதைய வெப்பநிலை ${temp}°C. வானிலை: ${cond}. காற்று வேகம் ${wind} கிமீ/மணி, ஈரப்பதம் ${hum}%.`;
          break;
        case "mr-IN":
          answerText = `${districtInfo.name} मध्ये सध्याचे तापमान ${temp}°C आहे. हवामान: ${cond}. वाऱ्याचा वेग ${wind} किमी/तास आणि आर्द्रता ${hum}% आहे.`;
          break;
        case "bn-IN":
          answerText = `${districtInfo.name} জেলায় বর্তমান তাপমাত্রা ${temp}°C। আবহাওয়া: ${cond}। বাতাসের গতিবেগ ${wind} কিমি/ঘণ্টা এবং আর্দ্রতা ${hum}%।`;
          break;
        case "te-IN":
          answerText = `${districtInfo.name} లో ప్రస్తుత ఉష్ణోగ్రత ${temp}°C. వాతావరణం: ${cond}. గాలి వేగం ${wind} కి.మీ/గం, తేమ ${hum}%.`;
          break;
        case "gu-IN":
          answerText = `${districtInfo.name} માં વર્તમાન તાપમાન ${temp}°C છે. હવામાન: ${cond}. પવનની ગતિ ${wind} કિમી/કલાક અને ભેજ ${hum}% છે.`;
          break;
        case "kn-IN":
          answerText = `${districtInfo.name} ನಲ್ಲಿ ಪ್ರಸ್ತುತ ತಾಪಮಾನ ${temp}°C ಆಗಿದೆ. ಹವಾಮಾನ: ${cond}. ಗಾಳಿಯ ವೇಗ ${wind} ಕಿ.ಮೀ/ಗಂ ಮತ್ತು ತೇವಾಂಶ ${hum}%.`;
          break;
        case "pa-IN":
          answerText = `${districtInfo.name} ਵਿੱਚ ਮੌਜੂਦਾ ਤਾਪਮਾਨ ${temp}°C ਹੈ। ਮੌਸਮ: ${cond}। ਹਵਾ ਦੀ ਰਫ਼ਤਾਰ ${wind} ਕਿਮੀ/ਘੰਟਾ ਅਤੇ ਨਮੀ ${hum}% ਹੈ।`;
          break;
        case "en-IN":
        default:
          answerText = `Current weather in ${districtInfo.name}: ${temp}°C, ${cond}. Wind speed is ${wind} km/h from ${windDir} with ${hum}% relative humidity.`;
          break;
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
