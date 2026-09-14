// WeatherGPT — Advisory Rules Module (SIH 2026, PS 26068)
// STRICTLY DETERMINISTIC, NON-LLM RULES TABLE
// Consumes normalised weather metrics and evaluates agricultural advisories.
// NOTE: This module contains ZERO LLM calls or AI dependencies.

export interface WeatherMetrics {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection?: string;
  rainfallLast24h: number;
  rainfallForecastNext24h: number;
}

export interface CropAdvisoryResult {
  crop: string;
  district: string;
  timeWindow: string;
  sprayCondition: "SAFE" | "UNSAFE" | "CAUTION";
  sprayAdvisory: string;
  irrigationAdvisory: string;
  pestDiseaseAdvisory: string;
  actionSummary: string;
  sourceRule: string;
  issueTime: string;
  isDeterministic: true;
}

// Deterministic multilingual strings
const ADVISORY_DICTIONARY = {
  "en-IN": {
    safeToSpray: "Safe for pesticide/fertilizer spraying (low wind, no imminent heavy rain).",
    unsafeHighWind: "UNSAFE to spray pesticides. Wind speed exceeds 15 km/h causing chemical drift.",
    unsafeRain: "UNSAFE to spray pesticides. Rain forecast exceeds 5 mm causing wash-off and chemical loss.",
    standingWaterPaddy: "Maintain 2 to 3 cm standing water in paddy fields during panicle stage.",
    drainageMango: "Ensure active drainage in mango root zones to prevent collar rot in high humidity.",
    postponeNitrogen: "Postpone urea/nitrogen top-dressing until showers recede to prevent runoff.",
    wheatCrownRoot: "Schedule crown root initiation (CRI) irrigation if topsoil is dry; avoid heavy irrigation under windy spells.",
    cottonDrainage: "Maintain deep furrow drainage to prevent root hypoxia; inspect squares and bolls for pink bollworm.",
    sugarcaneMulch: "Apply trash mulching between cane rows to conserve soil moisture; monitor for early shoot borer.",
    mustardAphid: "Monitor for aphid and white rust under cloudy weather; avoid overhead irrigation during flowering.",
    teaPlucking: "Maintain 7 to 10 day plucking intervals; inspect tea bushes for blister blight and red spider mite.",
    pulsesGroundnut: "Apply gypsum at pegging stage for groundnut; monitor pulses for pod borer (Helicoverpa).",
    sourceRuleName: "ICAR-KVK & IMD Agromet District Operational Advisory Guidelines"
  },
  "hi-IN": {
    safeToSpray: "कीटनाशक या उर्वरक छिड़काव के लिए सुरक्षित स्थिति (हवा की गति सामान्य, भारी बारिश की संभावना नहीं)।",
    unsafeHighWind: "कीटनाशक छिड़काव के लिए असुरक्षित। हवा की गति 15 किमी/घंटे से अधिक होने से बहाव का खतरा है।",
    unsafeRain: "छिड़काव के लिए असुरक्षित। 5 मिमी से अधिक वर्षा के पूर्वानुमान के कारण दवा धुलने का जोखिम है।",
    standingWaterPaddy: "धान के खेतों में 2 से 3 सेमी स्थिर जलस्तर बनाए रखें।",
    drainageMango: "आम के बगीचों में जलभराव रोकने के लिए उचित जल निकासी नालियां खुली रखें।",
    postponeNitrogen: "बारिश के दौरान यूरिया का छिड़काव स्थगित करें ताकि पोषक तत्व बह न जाएं।",
    wheatCrownRoot: "शीर्ष जड़ (CRI) अवस्था में हल्की सिंचाई करें; तेज हवा के दौरान सिंचाई से बचें ताकि फसल गिरे नहीं।",
    cottonDrainage: "गुलाबी सुंडी की निगरानी करें तथा जलभराव रोकने के लिए खेत की नालियां खुली रखें।",
    sugarcaneMulch: "गन्ने की पंक्तियों के बीच सूखी पत्ती बिछाएं (मल्चिंग) तथा कनसुआ (शूट बोरर) कीट पर नजर रखें।",
    mustardAphid: "बादल छाए मौसम में माहू (चेपा) और सफेद रतुआ की जांच करें; फूल आने पर तेज पानी न दें।",
    teaPlucking: "7 से 10 दिन के अंतराल पर पत्ती तुड़ाई जारी रखें तथा फफोला रोग (ब्लिस्टर ब्लाइट) की जांच करें।",
    pulsesGroundnut: "मूंगफली में सुइयां बनते समय जिप्सम डालें तथा दालों में फली छेदक कीट का निरीक्षण करें।",
    sourceRuleName: "आईसीएआर-केवीके एवं आईएमडी कृषि मौसम परिचालन दिशानिर्देश"
  },
  "ta-IN": {
    safeToSpray: "பூச்சிக்கொல்லி தெளிக்க உகந்த சூழல் (காற்றின் வேகம் குறைவு, அதிக மழை வாய்ப்பு இல்லை).",
    unsafeHighWind: "பூச்சிக்கொல்லி தெளிக்க உகந்ததல்ல. காற்றின் வேகம் 15 கிமீ/மணிக்கு மேல் உள்ளதால் மருந்து வீணாகும்.",
    unsafeRain: "தெளிக்க வேண்டாம். 5 மிமீ மேல் மழை எதிர்பார்க்கப்படுவதால் மருந்து அடித்துச் செல்லப்படும்.",
    standingWaterPaddy: "நெல் வயல்களில் 2-3 செமீ வரை நீர் தேங்க வைக்கவும்.",
    drainageMango: "மாந்தோப்புகளில் வேர் அழுகலைத் தடுக்க முறையான வடிகால் வசதி செய்யவும்.",
    postponeNitrogen: "மழை நேரத்தில் நைட்ரஜன் உரமிடுவதை தற்காலிகமாக தவிர்க்கவும்.",
    wheatCrownRoot: "மேல்மண் காய்ந்திருந்தால் கிரீட வேர் துவக்க பாசனத்தை மேற்கொள்ளவும்; பலத்த காற்றின் போது அதிக பாசனத்தை தவிர்க்கவும்.",
    cottonDrainage: "பருத்தியில் வேர் அழுகலைத் தடுக்க வடிகால் வசதி செய்யவும்; இளங்காய் துளைப்பான் பூச்சியைக் கண்காணிக்கவும்.",
    sugarcaneMulch: "ஈரப்பதத்தை காக்க கரும்பு வரிசைகளிடையே சருகு தழைக்கூளம் இடவும்; குருத்து துளைப்பான் தாக்குதலை கண்காணிக்கவும்.",
    mustardAphid: "மேகமூட்டமான வானிலையில் அசுவினி பூச்சி தாக்குதலை கண்காணிக்கவும்; பூக்கும் தருணத்தில் அதிக பாசனம் வேண்டாம்.",
    teaPlucking: "7-10 நாட்கள் இடைவெளியில் கொழுந்து பறிக்கவும்; கொப்பள நோய் மற்றும் சிவப்பு சிலந்தி தாக்குதலை கண்காணிக்கவும்.",
    pulsesGroundnut: "நிலக்கடலையில் விழுது இறங்கும் போது ஜிப்சம் இடவும்; பயறு வகைகளில் காய் துளைப்பான் பூச்சியைக் கண்காணிக்கவும்.",
    sourceRuleName: "ஐசிஏஆர்-கேவிகே மற்றும் ஐஎம்டி வேளாண் வானிலை வழிகாட்டுதல்கள்"
  }
};

/**
 * Pure deterministic rule engine evaluating agricultural safety windows
 * NO LLM OR GENERATIVE MODEL IS EVER CALLED IN THIS MODULE.
 */
export function getDeterministicCropAdvisory(
  crop: string = "paddy",
  district: string = "Raigad",
  weather: WeatherMetrics,
  language: "hi-IN" | "ta-IN" | "en-IN" = "en-IN",
  issueTime: string = new Date().toISOString()
): CropAdvisoryResult {
  const lang = ADVISORY_DICTIONARY[language] ? language : "en-IN";
  const dict = ADVISORY_DICTIONARY[lang];

  let sprayCondition: "SAFE" | "UNSAFE" | "CAUTION" = "SAFE";
  let sprayAdvisory = dict.safeToSpray;

  if (weather.windSpeed > 15) {
    sprayCondition = "UNSAFE";
    sprayAdvisory = dict.unsafeHighWind;
  } else if (weather.rainfallForecastNext24h > 5) {
    sprayCondition = "UNSAFE";
    sprayAdvisory = dict.unsafeRain;
  } else if (weather.humidity > 90) {
    sprayCondition = "CAUTION";
    sprayAdvisory = "High humidity (>90%). Spray only systemics during dry morning hours.";
  }

  const normalizedCrop = crop.toLowerCase();
  let irrigationAdvisory = dict.standingWaterPaddy;
  let pestDiseaseAdvisory = "Monitor for leaf blast and stem borer under humid cloudy conditions.";

  if (normalizedCrop.includes("wheat") || normalizedCrop.includes("गेहूं") || normalizedCrop.includes("கோதுமை")) {
    irrigationAdvisory = dict.wheatCrownRoot;
    pestDiseaseAdvisory = "Scout for yellow rust (stripe rust) pustules on leaves during cool mornings.";
  } else if (normalizedCrop.includes("cotton") || normalizedCrop.includes("कपास") || normalizedCrop.includes("பருத்தி")) {
    irrigationAdvisory = dict.cottonDrainage;
    pestDiseaseAdvisory = "Pheromone trap monitoring for pink bollworm; spray neem oil if ETL exceeds 5%.";
  } else if (normalizedCrop.includes("cane") || normalizedCrop.includes("sugarcane") || normalizedCrop.includes("गन्ना") || normalizedCrop.includes("கரும்பு")) {
    irrigationAdvisory = dict.sugarcaneMulch;
    pestDiseaseAdvisory = "Inspect root zones for white grub; drench chlorpyrifos only if soil moisture is adequate.";
  } else if (normalizedCrop.includes("mustard") || normalizedCrop.includes("सरसों") || normalizedCrop.includes("கடுகு")) {
    irrigationAdvisory = dict.mustardAphid;
    pestDiseaseAdvisory = "Monitor for mustard aphid and white rust under persistent cloud cover.";
  } else if (normalizedCrop.includes("tea") || normalizedCrop.includes("चाय") || normalizedCrop.includes("தேயிலை")) {
    irrigationAdvisory = dict.teaPlucking;
    pestDiseaseAdvisory = "Inspect upper canopy for blister blight and red spider mite after heavy mist.";
  } else if (normalizedCrop.includes("groundnut") || normalizedCrop.includes("pulse") || normalizedCrop.includes("peanut") || normalizedCrop.includes("दाल") || normalizedCrop.includes("मूंगफली")) {
    irrigationAdvisory = dict.pulsesGroundnut;
    pestDiseaseAdvisory = "Scout for spodoptera and pod borers; avoid chemical spray during bee pollination hours.";
  } else if (normalizedCrop.includes("mango") || normalizedCrop.includes("fruit") || normalizedCrop.includes("आम") || normalizedCrop.includes("மா")) {
    irrigationAdvisory = dict.drainageMango;
    pestDiseaseAdvisory = "Inspect leaf axils and trunk base for fungal infestation during damp spells.";
  } else if (normalizedCrop.includes("vegetable") || normalizedCrop.includes("tomato") || normalizedCrop.includes("सब्जी") || normalizedCrop.includes("தக்காளி")) {
    irrigationAdvisory = dict.postponeNitrogen;
    pestDiseaseAdvisory = "Provide vine staking against winds up to 20 km/h and check for damping-off.";
  }

  const actionSummary = `${sprayCondition}: ${sprayAdvisory} | ${irrigationAdvisory}`;

  return {
    crop: crop.charAt(0).toUpperCase() + crop.slice(1),
    district,
    timeWindow: "Next 24 Hours",
    sprayCondition,
    sprayAdvisory,
    irrigationAdvisory,
    pestDiseaseAdvisory,
    actionSummary,
    sourceRule: dict.sourceRuleName,
    issueTime,
    isDeterministic: true,
  };
}
