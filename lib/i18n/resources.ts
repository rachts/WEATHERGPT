// WeatherGPT — UI Chrome Localization Resources (Hindi, Tamil, English)

export type SupportedLanguage = "en-IN" | "hi-IN" | "ta-IN";

export interface TranslationDict {
  nav: {
    home: string;
    radar: string;
    chat: string;
    forecast: string;
    alerts: string;
    settings: string;
    imdLive: string;
    offlineCache: string;
    changeDistrict: string;
    appTitle: string;
  };
  actions: {
    send: string;
    cancel: string;
    retry: string;
    clear: string;
    voiceInput: string;
    speaking: string;
    returnHome: string;
    close: string;
    save: string;
  };
  status: {
    showingCached: string;
    offlineNotice: string;
    liveObservation: string;
    radarActive: string;
  };
  settings: {
    title: string;
    subtitle: string;
    languageTitle: string;
    languageDesc: string;
    voiceTitle: string;
    voiceDesc: string;
    alertsTitle: string;
    alertsDesc: string;
    pushTitle: string;
    pushDesc: string;
    smsTitle: string;
    smsDesc: string;
    aboutTitle: string;
    attribution: string;
  };
  dashboard: {
    change: string;
    issued: string;
    noAlerts: string;
    temperature: string;
    humidity: string;
    wind: string;
    rain24h: string;
    forecast7Day: string;
    agrometAdvisory: string;
    quickQuestions: string;
    inspectRadar: string;
    viewWarning: string;
    loading: string;
    askPlaceholder: string;
    askBtn: string;
    pesticideSpray: string;
    nonLlmVerified: string;
    chips: [string, string, string, string];
  };
  forecast: {
    title: string;
    change: string;
    tempTrend: string;
    rainChance: string;
    rainfall: string;
    loading: string;
  };
  alerts: {
    title: string;
    change: string;
    subtitle: string;
    noAlerts: string;
    loading: string;
  };
  chat: {
    title: string;
    loading: string;
    placeholder: string;
    suggestedTitle: string;
    suggested: [string, string, string, string];
  };
}

export const I18N_RESOURCES: Record<SupportedLanguage, TranslationDict> = {
  "en-IN": {
    nav: {
      home: "Home",
      radar: "Radar & Satellite",
      chat: "Chat",
      forecast: "Forecast",
      alerts: "Alerts",
      settings: "Settings",
      imdLive: "IMD Live",
      offlineCache: "Offline Cache",
      changeDistrict: "Change agricultural district",
      appTitle: "AgriWeather India",
    },
    actions: {
      send: "Send",
      cancel: "Cancel",
      retry: "Retry Inquiry",
      clear: "Clear Chat",
      voiceInput: "Tap to speak",
      speaking: "Listening...",
      returnHome: "Return to Home",
      close: "Close",
      save: "Saved",
    },
    status: {
      showingCached: "Showing cached snapshot",
      offlineNotice: "You are currently offline. Displaying local data snapshot.",
      liveObservation: "Official IMD Ground Observation",
      radarActive: "RADAR SCAN ACTIVE",
    },
    settings: {
      title: "Settings & Preferences",
      subtitle: "Language, audio feedback, and emergency alert channels",
      languageTitle: "Interface & Speech Language",
      languageDesc: "Responses and voice output will use this language",
      voiceTitle: "Read Responses Aloud (TTS)",
      voiceDesc: "Automatically read weather responses via speech synthesis",
      alertsTitle: "Emergency Warning Channels",
      alertsDesc: "Receive critical IMD weather alerts directly to your phone",
      pushTitle: "Browser Push Notifications",
      pushDesc: "Instant notification for Severe (Red) tier alerts",
      smsTitle: "SMS Forecast & Severe Warnings",
      smsDesc: "Offline broadcast SMS directly to your phone",
      aboutTitle: "Data Attribution & Transparency",
      attribution: "Meteorological telemetry provided by India Meteorological Department (IMD) open data. Unofficial student prototype developed for SIH 2026.",
    },
    dashboard: {
      change: "Change",
      issued: "Issued",
      noAlerts: "No active severe weather warnings in your area.",
      temperature: "Temperature",
      humidity: "Relative Humidity",
      wind: "Wind Speed",
      rain24h: "Precipitation",
      forecast7Day: "7-Day Agricultural Forecast",
      agrometAdvisory: "Today's Crop Advisory",
      quickQuestions: "Quick Inquiries",
      inspectRadar: "Inspect Radar",
      viewWarning: "View Full Warning",
      loading: "Loading IMD weather feed...",
      askPlaceholder: "Ask in Hindi, English, Tamil...",
      askBtn: "Ask",
      pesticideSpray: "Pesticide Spray",
      nonLlmVerified: "Non-LLM Verified",
      chips: [
        "Will it rain today in {district}?",
        "Is it safe to spray crops today?",
        "Show 7-day weather outlook",
        "Any cyclone or thunderstorm alert?",
      ],
    },
    forecast: {
      title: "7-Day District Forecast",
      change: "Change",
      tempTrend: "Temperature Trend (Max °C)",
      rainChance: "Rain Chance",
      rainfall: "Precipitation",
      loading: "Loading 7-day meteorological outlook...",
    },
    alerts: {
      title: "Weather Warnings & Bulletins",
      change: "Change",
      subtitle: "Multi-Tier Impact Warnings (IMD MoES)",
      noAlerts: "No active weather warnings at this time.",
      loading: "Fetching official IMD warning bulletins...",
    },
    chat: {
      title: "Kisan Weather Intelligence",
      loading: "Loading Kisan Weather Intelligence...",
      placeholder: "Ask weather question in your language...",
      suggestedTitle: "Suggested Inquiries",
      suggested: [
        "Will it rain in Kolkata tomorrow?",
        "What about the day after?",
        "Is it safe to spray crops today?",
        "Show 7-day temperature forecast",
      ],
    },
  },
  "hi-IN": {
    nav: {
      home: "मुख्य पृष्ठ",
      radar: "रडार व उपग्रह",
      chat: "मौसम चैट",
      forecast: "पूर्वानुमान",
      alerts: "चेतावनी",
      settings: "सेटिंग्स",
      imdLive: "आईएमडी लाइव",
      offlineCache: "ऑफ़लाइन कैश",
      changeDistrict: "कृषि ज़िला बदलें",
      appTitle: "कृषि मौसम भारत",
    },
    actions: {
      send: "भेजें",
      cancel: "रद्द करें",
      retry: "पुनः प्रयास करें",
      clear: "चैट साफ़ करें",
      voiceInput: "बोलने के लिए दबाएं",
      speaking: "सुन रहे हैं...",
      returnHome: "मुख्य पृष्ठ पर लौटें",
      close: "बंद करें",
      save: "सहेजा गया",
    },
    status: {
      showingCached: "कैश डेटा प्रदर्शित",
      offlineNotice: "आप ऑफ़लाइन हैं। सहेजा गया स्थानीय डेटा दिखाया जा रहा है।",
      liveObservation: "आईएमडी आधिकारिक भूतल अवलोकन",
      radarActive: "रडार स्कैन सक्रिय",
    },
    settings: {
      title: "सेटिंग्स और प्राथमिकताएं",
      subtitle: "भाषा, ध्वनि सहायता एवं आपातकालीन चेतावनी चैनल",
      languageTitle: "इंटरफ़ेस और संवाद भाषा",
      languageDesc: "मौसम उत्तर और आवाज़ इस भाषा में प्रदान की जाएगी",
      voiceTitle: "उत्तर बोलकर सुनाएं (TTS)",
      voiceDesc: "मौसम उत्तरों को ध्वनि द्वारा स्वचालित रूप से पढ़ें",
      alertsTitle: "आपातकालीन चेतावनी चैनल",
      alertsDesc: "गंभीर मौसम चेतावनियां सीधे अपने फोन पर प्राप्त करें",
      pushTitle: "ब्राउज़र पुश सूचनाएं",
      pushDesc: "गंभीर (लाल) अलर्ट के लिए त्वरित अधिसूचना",
      smsTitle: "एसएमएस पूर्वानुमान एवं चेतावनी",
      smsDesc: "इंटरनेट के बिना सीधा एसएमएस प्रसारण",
      aboutTitle: "डेटा स्रोत और पारदर्शिता",
      attribution: "मौसम डेटा भारत मौसम विज्ञान विभाग (IMD) ओपन डेटा से प्राप्त। SIH 2026 के लिए विकसित अनौपचारिक छात्र प्रोटोटाइप।",
    },
    dashboard: {
      change: "बदलें",
      issued: "जारी",
      noAlerts: "आपके क्षेत्र में कोई गंभीर मौसम चेतावनी सक्रिय नहीं है।",
      temperature: "तापमान",
      humidity: "सापेक्ष आर्द्रता (नमी)",
      wind: "हवा की गति",
      rain24h: "वर्षा (24 घंटे)",
      forecast7Day: "7-दिवसीय कृषि मौसम पूर्वानुमान",
      agrometAdvisory: "आज की कृषि मौसम सलाह",
      quickQuestions: "त्वरित मौसम प्रश्न",
      inspectRadar: "रडार देखें",
      viewWarning: "पूरी चेतावनी देखें",
      loading: "आईएमडी मौसम डेटा लोड हो रहा है...",
      askPlaceholder: "हिंदी, अंग्रेजी या तमिल में पूछें...",
      askBtn: "पूछें",
      pesticideSpray: "कीटनाशक छिड़काव",
      nonLlmVerified: "नियम-सत्यापित",
      chips: [
        "क्या आज {district} में बारिश होगी?",
        "क्या आज फसलों पर कीटनाशक छिड़कना सुरक्षित है?",
        "7-दिवसीय मौसम पूर्वानुमान दिखाएं",
        "क्या कोई आंधी-तूफ़ान या चक्रवात का अलर्ट है?",
      ],
    },
    forecast: {
      title: "7-दिवसीय जिला मौसम पूर्वानुमान",
      change: "बदलें",
      tempTrend: "तापमान रुझान (अधिकतम °C)",
      rainChance: "बारिश की संभावना",
      rainfall: "वर्षा",
      loading: "7-दिवसीय मौसम पूर्वानुमान लोड हो रहा है...",
    },
    alerts: {
      title: "मौसम चेतावनियां एवं बुलेटिन",
      change: "बदलें",
      subtitle: "बहु-स्तरीय प्रभाव चेतावनियां (आईएमडी)",
      noAlerts: "इस समय कोई मौसम चेतावनी सक्रिय नहीं है।",
      loading: "आईएमडी मौसम चेतावनियां लोड हो रही हैं...",
    },
    chat: {
      title: "किसान मौसम बुद्धिमत्ता",
      loading: "किसान मौसम बुद्धिमत्ता लोड हो रही है...",
      placeholder: "अपनी भाषा में मौसम संबंधी प्रश्न पूछें...",
      suggestedTitle: "सुझाए गए प्रश्न",
      suggested: [
        "क्या कल कोलकाता में बारिश होगी?",
        "परसों का मौसम कैसा रहेगा?",
        "क्या आज फसलों पर छिड़काव सुरक्षित है?",
        "7-दिवसीय तापमान पूर्वानुमान दिखाएं",
      ],
    },
  },
  "ta-IN": {
    nav: {
      home: "முகப்பு",
      radar: "ரேடார் & செயற்கைக்கோள்",
      chat: "உரையாடல்",
      forecast: "வானிலை முன்னறிவிப்பு",
      alerts: "எச்சரிக்கைகள்",
      settings: "அமைப்புகள்",
      imdLive: "ஐஎம்டி நேரலை",
      offlineCache: "ஆஃப்லைன் தரவு",
      changeDistrict: "வேளாண் மாவட்டத்தை மாற்றுக",
      appTitle: "வேளாண் வானிலை இந்தியா",
    },
    actions: {
      send: "அனுப்பு",
      cancel: "ரத்து செய்",
      retry: "மீண்டும் முயற்சி செய்",
      clear: "அழிக்கவும்",
      voiceInput: "பேச தொடவும்",
      speaking: "கேட்கிறது...",
      returnHome: "முகப்பிற்கு செல்",
      close: "மூடு",
      save: "சேமிக்கப்பட்டது",
    },
    status: {
      showingCached: "சேமிக்கப்பட்ட தரவு காட்டப்படுகிறது",
      offlineNotice: "இணைய தொடர்பு இல்லை. உள்ளூர் தரவு காண்பிக்கப்படுகிறது.",
      liveObservation: "அதிகாரப்பூர்வ ஐஎம்டி கள ஆய்வு",
      radarActive: "ரேடார் ஸ்கேன் செயல்படுகிறது",
    },
    settings: {
      title: "அமைப்புகள் & விருப்பங்கள்",
      subtitle: "மொழி, குரல் உதவி மற்றும் அவசர எச்சரிக்கை வழிகள்",
      languageTitle: "இடைமுக மற்றும் பேச்சு மொழி",
      languageDesc: "பதில்கள் மற்றும் குரல் இந்த மொழியில் வழங்கப்படும்",
      voiceTitle: "பதில்களை உரக்க வாசிக்கவும் (TTS)",
      voiceDesc: "வானிலை தகவலை தானாகவே குரல் வழியாக கேட்கலாம்",
      alertsTitle: "அவசர வானிலை எச்சரிக்கை வழிகள்",
      alertsDesc: "முக்கிய வானிலை எச்சரிக்கைகளை உங்கள் தொலைபேசியில் பெறுக",
      pushTitle: "உலவி புஷ் அறிவிப்புகள்",
      pushDesc: "தீவிர (சிவப்பு) எச்சரிக்கைகளுக்கான உடனடி அறிவிப்பு",
      smsTitle: "எஸ்எம்எஸ் முன்னறிவிப்பு & எச்சரிக்கைகள்",
      smsDesc: "இணையம் இல்லாத நேரடி குறுஞ்செய்தி சேவை",
      aboutTitle: "தரவு ஆதாரம் மற்றும் வெளிப்படைத்தன்மை",
      attribution: "வானிலை தரவுகள் இந்திய வானிலை மையம் (IMD) திறந்தநிலை தரவு மூலம் பெறப்பட்டது. SIH 2026 மாணவர் முன்மாதிரி திட்டம்.",
    },
    dashboard: {
      change: "மாற்றுக",
      issued: "வெளியிடப்பட்டது",
      noAlerts: "உங்கள் பகுதியில் தீவிர வானிலை எச்சரிக்கைகள் எதுவும் இல்லை.",
      temperature: "வெப்பநிலை",
      humidity: "காற்றின் ஈரப்பதம்",
      wind: "காற்றின் வேகம்",
      rain24h: "மழைப்பொழிவு (24 மணி)",
      forecast7Day: "7 நாள் வேளாண் வானிலை முன்னறிவிப்பு",
      agrometAdvisory: "இன்றைய வேளாண் பயிர் ஆலோசனை",
      quickQuestions: "விரைவு வானிலை கேள்விகள்",
      inspectRadar: "ரேடார் பார்க்க",
      viewWarning: "முழு எச்சரிக்கை விவரம்",
      loading: "வானிலை தரவு ஏற்றப்படுகிறது...",
      askPlaceholder: "தமிழ், இந்தி அல்லது ஆங்கிலத்தில் கேளுங்கள்...",
      askBtn: "கேளுங்கள்",
      pesticideSpray: "பூச்சிக்கொல்லி தெளிப்பு",
      nonLlmVerified: "விதிமுறை சரிபார்க்கப்பட்டது",
      chips: [
        "இன்று {district}-ல் மழை பெய்யுமா?",
        "இன்று பயிர்களுக்கு மருந்து தெளிப்பது பாதுகாப்பானதா?",
        "7 நாள் வானிலை முன்னறிவிப்பைக் காட்டு",
        "புயல் அல்லது இடிமின்னல் எச்சரிக்கை உள்ளதா?",
      ],
    },
    forecast: {
      title: "7 நாள் மாவட்ட வானிலை முன்னறிவிப்பு",
      change: "மாற்றுக",
      tempTrend: "வெப்பநிலை போக்கு (அதிகபட்ச °C)",
      rainChance: "மழை வாய்ப்பு",
      rainfall: "மழைப்பொழிவு",
      loading: "7 நாள் வானிலை முன்னறிவிப்பு ஏற்றப்படுகிறது...",
    },
    alerts: {
      title: "வானிலை எச்சரிக்கைகள் & அறிவிப்புகள்",
      change: "மாற்றுக",
      subtitle: "பல அடுக்கு தாக்க எச்சரிக்கைகள் (IMD)",
      noAlerts: "தற்போது வானிலை எச்சரிக்கைகள் எதுவும் இல்லை.",
      loading: "ஐஎம்டி வானிலை எச்சரிக்கைகள் ஏற்றப்படுகின்றன...",
    },
    chat: {
      title: "விவசாய வானிலை உரையாடல்",
      loading: "வானிலை உரையாடல் சேவை ஏற்றப்படுகிறது...",
      placeholder: "உங்கள் மொழியில் வானிலை கேள்விகளைக் கேளுங்கள்...",
      suggestedTitle: "பரிந்துரைக்கப்பட்ட கேள்விகள்",
      suggested: [
        "நாளை கொல்கத்தாவில் மழை பெய்யுமா?",
        "நாளை மறுநாள் வானிலை எப்படி இருக்கும்?",
        "இன்று பயிர்களுக்கு மருந்து தெளிப்பது பாதுகாப்பானதா?",
        "7 நாள் வெப்பநிலை முன்னறிவிப்பைக் காட்டு",
      ],
    },
  },
};
