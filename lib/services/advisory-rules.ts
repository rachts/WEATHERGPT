// WeatherGPT — Advisory Rules Module (Production-Grade)
// STRICTLY DETERMINISTIC, NON-LLM RULES TABLE
// Consumes normalised weather metrics and evaluates agricultural advisories.
// NOTE: This module contains ZERO LLM calls or AI dependencies.
// Chemical Safety Rule: Never invents pesticide chemical combinations, doses, or unauthorized chemical advice.
// Authoritative Guidance: ICAR-CRIDA / KVK Agromet Advisory Guidelines.

import { AdvisoryRule, CropAdvisoryResult } from "../types/advisory";
import { Evidence } from "../types/provenance";
import { DEFAULT_DISTRICT } from "../config/constants";

export const SPRAY_MAX_WIND_KMH = 15;
export const SPRAY_MAX_RAIN_MM = 5;
export const SPRAY_MAX_HUMIDITY_PCT = 90;

export interface WeatherMetrics {
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection?: string | null;
  rainfallLast24h: number | null;
  rainfallForecastNext24h: number;
}

export { type CropAdvisoryResult, type AdvisoryRule };

const CHEMICAL_DISCLAIMER_BY_LANG: Record<string, string> = {
  "en-IN": "Consult the locally approved agricultural extension recommendation (KVK / State Agriculture University) before applying pesticides or other crop-protection chemicals. Adhere strictly to label directions and pre-harvest intervals.",
  "hi-IN": "कीटनाशक या अन्य फसल-सुरक्षा रसायनों का उपयोग करने से पहले स्थानीय अनुमोदित कृषि विज्ञान केंद्र (KVK) अथवा कृषि विभाग की आधिकारिक अनुशंसा अवश्य लें।",
  "ta-IN": "பூச்சிக்கொல்லி அல்லது பயிர் பாதுகாப்பு ரசாயனங்களைப் பயன்படுத்துவதற்கு முன் உள்ளூர் வேளாண் அறிவியல் மையம் (KVK) அல்லது வேளாண் துறை பரிந்துரையை அணுகவும்.",
  "mr-IN": "कीटकनाशके किंवा पीक-संरक्षण रसायने वापरण्यापूर्वी स्थानिक मान्यताप्राप्त कृषी विज्ञान केंद्र (KVK) किंवा कृषी विद्यापीठाचा अधिकृत सल्ला नक्की घ्या.",
  "bn-IN": "কীটনাশক বা অন্যান্য ফসল সুরক্ষা রাসায়নিক প্রয়োগ করার পূর্বে স্থানীয় অনুমোদিত কৃষি বিজ্ঞান কেন্দ্র (KVK) বা কৃষি বিশ্ববিদ্যালয়ের পরামর্শ নিন।",
  "te-IN": "పురుగుమందులు లేదా పంట సంరక్షణ రసాయనాలను ఉపయోగించే ముందు స్థానిక కృషి విజ్ఞాన కేంద్రం (KVK) లేదా వ్యవసాయ విశ్వవిద్యాలయం సిఫార్సులను తప్పనిసరిగా సంప్రదించండి.",
  "gu-IN": "જંતુનાશક દવાઓ અથવા પાક સંરક્ષણ રસાયણોનો ઉપયોગ કરતા પહેલા સ્થાનિક કૃષિ વિજ્ઞાન કેન્દ્ર (KVK) અથવા કૃષિ યુનિવર્સિટીની ભલામણ અચૂક લો.",
  "kn-IN": "ಕೀಟನಾಶಕಗಳು ಅಥವಾ ಬೆಳೆ ಸಂರಕ್ಷಣಾ ರಾಸಾಯನಿಕಗಳನ್ನು ಬಳಸುವ ಮುನ್ನ ಸ್ಥಳೀಯ ಕೃಷಿ ವಿಜ್ಞಾನ ಕೇಂದ್ರ (KVK) ಅಥವಾ ಕೃಷಿ ವಿಶ್ವವಿದ್ಯಾಲಯದ ಶಿಫಾರಸುಗಳನ್ನು ಸಂಪರ್ಕಿಸಿ.",
  "pa-IN": "ਕੀਟਨਾਸ਼ਕਾਂ ਜਾਂ ਫ਼ਸਲ ਸੁਰੱਖਿਆ ਰਸਾਇਣਾਂ ਦੀ ਵਰਤੋਂ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਸਥਾਨਕ ਕ੍ਰਿਸ਼ੀ ਵਿਗਿਆਨ ਕੇਂਦਰ (KVK) ਜਾਂ ਖੇਤੀਬਾੜੀ ਯੂਨੀਵਰਸਿਟੀ ਦੀ ਸਿਫ਼ਾਰਸ਼ ਜ਼ਰੂਰ ਲਵੋ।",
};

const ADVISORY_DICTIONARY: Record<string, Record<string, string>> = {
  "en-IN": {
    safeToSpray: "Safe for pesticide/fertilizer spraying (low wind, no imminent heavy rain).",
    unsafeHighWind: `UNSAFE to spray pesticides. Wind speed exceeds ${SPRAY_MAX_WIND_KMH} km/h causing chemical drift.`,
    unsafeRain: `UNSAFE to spray pesticides. Rain forecast exceeds ${SPRAY_MAX_RAIN_MM} mm causing wash-off and chemical loss.`,
    cautionHighHumidity: `CAUTION: High humidity (>${SPRAY_MAX_HUMIDITY_PCT}%). Spray only systemic agrochemicals during dry morning hours.`,
    standingWaterPaddy: "Maintain 2 to 3 cm standing water in paddy fields during panicle stage.",
    drainageMango: "Ensure active drainage in mango root zones to prevent collar rot in high humidity.",
    postponeNitrogen: "Postpone urea/nitrogen top-dressing until showers recede to prevent runoff.",
    wheatCrownRoot: "Schedule crown root initiation (CRI) irrigation if topsoil is dry; avoid heavy irrigation under windy spells.",
    cottonDrainage: "Maintain deep furrow drainage to prevent root hypoxia; inspect squares and bolls for pink bollworm.",
    sugarcaneMulch: "Apply trash mulching between cane rows to conserve soil moisture; monitor for early shoot borer.",
    mustardAphid: "Monitor for aphid and white rust under cloudy weather; avoid overhead irrigation during flowering.",
    teaPlucking: "Maintain 7 to 10 day plucking intervals; inspect tea bushes for blister blight and red spider mite.",
    pulsesGroundnut: "Apply gypsum at pegging stage for groundnut; monitor pulses for pod borer (Helicoverpa).",
    sourceRuleName: "ICAR-KVK & IMD Agromet District Operational Advisory Guidelines",
  },
  "hi-IN": {
    safeToSpray: "कीटनाशक या उर्वरक छिड़काव के लिए सुरक्षित स्थिति (हवा की गति सामान्य, भारी बारिश की संभावना नहीं)।",
    unsafeHighWind: `कीटनाशक छिड़काव के लिए असुरक्षित। हवा की गति ${SPRAY_MAX_WIND_KMH} किमी/घंटे से अधिक होने से बहाव का खतरा है।`,
    unsafeRain: `छिड़काव के लिए असुरक्षित। ${SPRAY_MAX_RAIN_MM} मिमी से अधिक वर्षा के पूर्वानुमान के कारण दवा धुलने का जोखिम है।`,
    cautionHighHumidity: `सावधानी: अत्यधिक आर्द्रता (>${SPRAY_MAX_HUMIDITY_PCT}%)। केवल सुबह के सूखे घंटों में प्रणालीगत (systemic) कीटनाशक का छिड़काव करें।`,
    standingWaterPaddy: "धान के खेतों में 2 से 3 सेमी स्थिर जलस्तर बनाए रखें।",
    drainageMango: "आम के बगीचों में जलभराव रोकने के लिए उचित जल निकासी नालियां खुली रखें।",
    postponeNitrogen: "बारिश के दौरान यूरिया का छिड़काव स्थगित करें ताकि पोषक तत्व बह न जाएं।",
    wheatCrownRoot: "शीर्ष जड़ (CRI) अवस्था में हल्की सिंचाई करें; तेज हवा के दौरान सिंचाई से बचें ताकि फसल गिरे नहीं।",
    cottonDrainage: "गुलाबी सुंडी की निगरानी करें तथा जलभराव रोकने के लिए खेत की नालियां खुली रखें।",
    sugarcaneMulch: "गन्ने की पंक्तियों के बीच सूखी पत्ती बिछाएं (मल्चिंग) तथा कनसुआ (शूट बोरर) कीट पर नजर रखें।",
    mustardAphid: "बादल छाए मौसम में माहू (चेपा) और सफेद रतुआ की जांच करें; फूल आने पर तेज पानी न दें।",
    teaPlucking: "7 से 10 दिन के अंतराल पर पत्ती तुड़ाई जारी रखें तथा फफोला रोग (ब्लिस्टर ब्लाइट) की जांच करें।",
    pulsesGroundnut: "मूंगफली में सुइयां बनते समय जिप्सम डालें तथा दालों में फली छेदक कीट का निरीक्षण करें।",
    sourceRuleName: "आईसीएआर-केवीके एवं आईएमडी कृषि मौसम परिचालन दिशानिर्देश",
  },
  "ta-IN": {
    safeToSpray: "பூச்சிக்கொல்லி தெளிக்க உகந்த சூழல் (காற்றின் வேகம் குறைவு, அதிக மழை வாய்ப்பு இல்லை).",
    unsafeHighWind: `பூச்சிக்கொல்லி தெளிக்க உகந்ததல்ல. காற்றின் வேகம் ${SPRAY_MAX_WIND_KMH} கிமீ/மணிக்கு மேல் உள்ளதால் மருந்து வீணாகும்.`,
    unsafeRain: `தெளிக்க வேண்டாம். ${SPRAY_MAX_RAIN_MM} மிமீ மேல் மழை எதிர்பார்க்கப்படுவதால் மருந்து அடித்துச் செல்லப்படும்.`,
    cautionHighHumidity: `எச்சரிக்கை: அதிக ஈரப்பதம் (>${SPRAY_MAX_HUMIDITY_PCT}%). காலை உலர்ந்த வேளையில் மட்டுமே உறிஞ்சும் வகை மருந்துகளை தெளிக்கவும்.`,
    standingWaterPaddy: "நெல் வயல்களில் 2-3 செமீ வரை நீர் தேங்க வைக்கவும்.",
    drainageMango: "மாந்தோப்புகளில் வேர் அழுகலைத் தடுக்க முறையான வடிகால் வசதி செய்யவும்.",
    postponeNitrogen: "மழை நேரத்தில் நைட்ரஜன் உரமிடுவதை தற்காலிகமாக தவிர்க்கவும்.",
    wheatCrownRoot: "மேல்மண் காய்ந்திருந்தால் கிரீட வேர் துவக்க பாசனத்தை மேற்கொள்ளவும்; பலத்த காற்றின் போது அதிக பாசனத்தை தவிர்க்கவும்.",
    cottonDrainage: "பருத்தியில் வேர் அழுகலைத் தடுக்க வடிகால் வசதி செய்யவும்; இளங்காய் துளைப்பான் பூச்சியைக் கண்காணிக்கவும்.",
    sugarcaneMulch: "ஈரப்பதத்தை காக்க கரும்பு வரிசைகளிடையே சருகு தழைக்கூளம் இடவும்; குருத்து துளைப்பான் தாக்குதலை கண்காணிக்கவும்.",
    mustardAphid: "மேகமூட்டமான வானிலையில் அசுவினி பூச்சி தாக்குதலை கண்காணிக்கவும்; பூக்கும் தருணத்தில் அதிக பாசனம் வேண்டாம்.",
    teaPlucking: "7-10 நாட்கள் இடைவெளியில் கொழுந்து பறிக்கவும்; கொப்பள நோய் மற்றும் சிவப்பு சிலந்தி தாக்குதலை கண்காணிக்கவும்.",
    pulsesGroundnut: "நிலக்கடலையில் விழுது இறங்கும் போது ஜிப்சம் இடவும்; பயறு வகைகளில் காய் துளைப்பான் பூச்சியைக் கண்காணிக்கவும்.",
    sourceRuleName: "ஐசிஏஆர்-கேவிகே மற்றும் ஐஎம்டி வேளாண் வானிலை வழிகாட்டுதல்கள்",
  },
  "mr-IN": {
    safeToSpray: "कीटकनाशक किंवा खत फवारणीसाठी सुरक्षित स्थिती (कमी वारा, पावसाची शक्यता नाही).",
    unsafeHighWind: `कीटकनाशक फवारणीसाठी असुरक्षित. वाऱ्याचा वेग ${SPRAY_MAX_WIND_KMH} किमी/तासापेक्षा जास्त असल्यामुळे औषध वाहून जाण्याचा धोका.`,
    unsafeRain: `फवारणीसाठी असुरक्षित. ${SPRAY_MAX_RAIN_MM} मिमीपेक्षा जास्त पाऊस पडण्याचा अंदाज असल्यामुळे औषध धुऊन जाण्याचा धोका.`,
    cautionHighHumidity: `सावधान: जास्त आर्द्रता (>${SPRAY_MAX_HUMIDITY_PCT}%). फक्त सकाळच्या कोरड्या वेळेत सिस्टेमिक औषधांची फवारणी करा.`,
    standingWaterPaddy: "भाताच्या शेतात लोंबी येण्याच्या काळात २ ते ३ सेमी पाणी साठवून ठेवा.",
    drainageMango: "आंब्याच्या बागेत मुळाजवळ पाणी साचू नये म्हणून चर काढून निचरा ठेवा.",
    postponeNitrogen: "पाऊस थांबेपर्यंत युरिया खताचा वापर पुढे ढकला.",
    wheatCrownRoot: "मुकुट मुळे फुटण्याच्या (CRI) अवस्थेत हलके पाणी द्या; सोसाट्याच्या वाऱ्यात पाणी देणे टाळा.",
    cottonDrainage: "कपाशीमध्ये पाणी साचू नये म्हणून निचरा व्यवस्था ठेवा; बोंड अळीचे निरीक्षण करा.",
    sugarcaneMulch: "ऊस पिकात पाचटाचे आच्छादन करा; खोडकिडीवर लक्ष ठेवा.",
    mustardAphid: "ढगाळ हवामानात मावा आणि तांबेरा रोगाची तपासणी करा; फुलोऱ्यात जादा पाणी देऊ नका.",
    teaPlucking: "७ ते १० दिवसांच्या अंतराने शेंडे खुडणी करा; करपा आणि लाल कोळी रोगाची तपासणी करा.",
    pulsesGroundnut: "भुईमुगाला आऱ्या सुटताना जिप्सम द्या; डाळवर्गीय पिकांत शेंगअळीची पाहणी करा.",
    sourceRuleName: "ICAR-KVK आणि IMD कृषी हवामान परिचालन मार्गदर्शक तत्त्वे",
  },
  "bn-IN": {
    safeToSpray: "কীটনাশক বা সার স্প্রে করার জন্য নিরাপদ পরিস্থিতি (বাতাস স্বাভাবিক, ভারী বৃষ্টির সম্ভাবনা নেই)।",
    unsafeHighWind: `স্প্রে করার জন্য অনিরাপদ। বাতাসের গতিবেগ ${SPRAY_MAX_WIND_KMH} কিমি/ঘণ্টার বেশি হওয়ায় ওষুধ ভেসে যাওয়ার ঝুঁকি।`,
    unsafeRain: `স্প্রে করার জন্য অনিরাপদ। ${SPRAY_MAX_RAIN_MM} মিমি-এর বেশি বৃষ্টিপাতের পূর্বাভাসের কারণে ওষুধ ধুয়ে যাওয়ার আশঙ্কা।`,
    cautionHighHumidity: `সতর্কতা: অতিরিক্ত আর্দ্রতা (>${SPRAY_MAX_HUMIDITY_PCT}%)। কেবল সকালের শুষ্ক সময়ে সিস্টেমিক ওষুধ স্প্রে করুন।`,
    standingWaterPaddy: "ধানের জমিতে শিষ আসার সময় ২-৩ সেমি স্থির জল বজায় রাখুন।",
    drainageMango: "আম বাগানে গোড়ায় জল জমা রোধ করতে উপযুক্ত নিকাশি ব্যবস্থা রাখুন।",
    postponeNitrogen: "বৃষ্টির সময় ইউরিয়া সার প্রয়োগ স্থগিত রাখুন।",
    wheatCrownRoot: "শীর্ষ শিকড় পর্যায়ে সেচ দিন; ঝোড়ো বাতাসের সময় ভারী সেচ এড়িয়ে চলুন।",
    cottonDrainage: "তুলো ক্ষেতে জল নিষ্কাশনের ব্যবস্থা রাখুন; শুঁয়োপোকা ও কীটের নজরদারি করুন।",
    sugarcaneMulch: "আখের সারির মাঝে শুকনো পাতার মালচিং করুন; মাজরা পোকা পর্যবেক্ষণ করুন।",
    mustardAphid: "মেঘলা আবহাওয়ায় জাব পোকা ও সাদা মরচে রোগ পরীক্ষা করুন।",
    teaPlucking: "৭ থেকে ১০ দিনের ব্যবধানে পাতা তুলুন; ব্লিস্টার ব্লাইট রোগ লক্ষ্য করুন।",
    pulsesGroundnut: "বাদামে জিপসাম প্রয়োগ করুন; ডাল শস্যে শুঁয়োপোকার আক্রমণ পরীক্ষা করুন।",
    sourceRuleName: "আইসিএআর-কেভিকে এবং আইএমডি কৃষি আবহাওয়া নির্দেশিকা",
  },
};

/**
 * Pure deterministic rule engine evaluating agricultural safety windows.
 * NO LLM OR GENERATIVE MODEL IS EVER CALLED IN THIS MODULE.
 */
export function getDeterministicCropAdvisory(
  crop: string = "paddy",
  district: string = DEFAULT_DISTRICT,
  weather: WeatherMetrics,
  language: string = "en-IN",
  issueTime?: string | null
): CropAdvisoryResult {
  const lang = ADVISORY_DICTIONARY[language] ? language : "en-IN";
  const dict = ADVISORY_DICTIONARY[lang];

  let sprayCondition: "SAFE" | "UNSAFE" | "CAUTION" = "SAFE";
  let sprayAdvisory = dict.safeToSpray;

  if (weather.windSpeed !== null && weather.windSpeed > SPRAY_MAX_WIND_KMH) {
    sprayCondition = "UNSAFE";
    sprayAdvisory = dict.unsafeHighWind;
  } else if (weather.rainfallForecastNext24h > SPRAY_MAX_RAIN_MM) {
    sprayCondition = "UNSAFE";
    sprayAdvisory = dict.unsafeRain;
  } else if (weather.humidity !== null && weather.humidity > SPRAY_MAX_HUMIDITY_PCT) {
    sprayCondition = "CAUTION";
    sprayAdvisory = dict.cautionHighHumidity;
  }

  const normalizedCrop = crop.toLowerCase();
  const hasCropToken = (pattern: RegExp) => pattern.test(normalizedCrop);

  // Default to balanced agronomic field moisture; apply paddy-specific water standing only if paddy is specified
  let irrigationAdvisory = "Maintain balanced field soil moisture based on crop stage; keep active field drainage open to avoid waterlogging.";
  let pestDiseaseAdvisory = "Scout fields regularly for regional pests; consult local KVK before chemical treatment.";

  if (hasCropToken(/(?:^|[^\p{L}\p{N}])(?:paddy|rice|धान|चावल|भात|நெல்)(?:[^\p{L}\p{N}]|$)/iu)) {
    irrigationAdvisory = dict.standingWaterPaddy;
    pestDiseaseAdvisory = "Monitor for leaf blast and stem borer under humid cloudy conditions.";
  } else if (hasCropToken(/(?:^|[^\p{L}\p{N}])(?:wheat|गेहूं|கோதுமை)(?:[^\p{L}\p{N}]|$)/iu)) {
    irrigationAdvisory = dict.wheatCrownRoot;
    pestDiseaseAdvisory = "Scout for yellow rust (stripe rust) pustules on leaves during cool mornings.";
  } else if (hasCropToken(/(?:^|[^\p{L}\p{N}])(?:cotton|कपास|பருத்தி)(?:[^\p{L}\p{N}]|$)/iu)) {
    irrigationAdvisory = dict.cottonDrainage;
    pestDiseaseAdvisory = "Pheromone trap monitoring for pink bollworm; consult local KVK if ETL exceeds 5%.";
  } else if (hasCropToken(/(?:^|[^\p{L}\p{N}])(?:sugarcane|cane|गन्ना|கரும்பு)(?:[^\p{L}\p{N}]|$)/iu)) {
    irrigationAdvisory = dict.sugarcaneMulch;
    // REPLACED UNSUPPORTED CHEMICAL CHLORPYRIFOS WITH SAFE EXTENSION GUIDANCE (Req 23)
    pestDiseaseAdvisory = "Inspect root zones for white grub; consult local Krishi Vigyan Kendra (KVK) for approved soil treatment.";
  } else if (hasCropToken(/(?:^|[^\p{L}\p{N}])(?:mustard|सरसों|கடுகு)(?:[^\p{L}\p{N}]|$)/iu)) {
    irrigationAdvisory = dict.mustardAphid;
    pestDiseaseAdvisory = "Monitor for mustard aphid and white rust under persistent cloud cover.";
  } else if (hasCropToken(/(?:^|[^\p{L}\p{N}])(?:tea|चाय|தேயிலை)(?:[^\p{L}\p{N}]|$)/iu)) {
    irrigationAdvisory = dict.teaPlucking;
    pestDiseaseAdvisory = "Inspect upper canopy for blister blight and red spider mite after heavy mist.";
  } else if (hasCropToken(/(?:^|[^\p{L}\p{N}])(?:groundnut|pulse|peanut|दाल|मूंगफली)(?:[^\p{L}\p{N}]|$)/iu)) {
    irrigationAdvisory = dict.pulsesGroundnut;
    pestDiseaseAdvisory = "Scout for spodoptera and pod borers; avoid chemical spray during bee pollination hours.";
  } else if (
    hasCropToken(/(?:^|[^\p{L}\p{N}])(?:mango|fruit|आम)(?:[^\p{L}\p{N}]|$)/iu) ||
    ["மாம்பழம்", "மாங்காய்", "மாந்தோப்பு", "மாமரம்"].some(m => normalizedCrop.includes(m))
  ) {
    irrigationAdvisory = dict.drainageMango;
    pestDiseaseAdvisory = "Inspect leaf axils and trunk base for fungal infestation during damp spells.";
  } else if (hasCropToken(/(?:^|[^\p{L}\p{N}])(?:vegetable|tomato|सब्जी|தக்காளி)(?:[^\p{L}\p{N}]|$)/iu)) {
    irrigationAdvisory = dict.postponeNitrogen;
    pestDiseaseAdvisory = `Provide vine staking against winds up to ${SPRAY_MAX_WIND_KMH} km/h and check for damping-off.`;
  }

  const actionSummary = `${sprayCondition}: ${sprayAdvisory} | ${irrigationAdvisory}`;
  const chemicalDisclaimer = CHEMICAL_DISCLAIMER_BY_LANG[lang] || CHEMICAL_DISCLAIMER_BY_LANG["en-IN"];

  const evidence: Evidence = {
    sourceId: "ICAR_CRIDA_AGROMET_GUIDELINE_V2",
    provider: "OTHER",
    providerName: "ICAR-CRIDA",
    product: "ICAR-CRIDA District Agromet Advisory",
    retrievedAt: new Date().toISOString(),
    quality: "OBSERVED",
  };

  return {
    crop: crop.charAt(0).toUpperCase() + crop.slice(1),
    district,
    timeWindow: "Next 24-48 Hours",
    sprayCondition,
    sprayAdvisory,
    irrigationAdvisory,
    pestDiseaseAdvisory,
    actionSummary,
    sourceRule: dict.sourceRuleName,
    chemicalDisclaimer,
    issueTime: issueTime || null,
    isDeterministic: true,
    evidence,
  };
}
