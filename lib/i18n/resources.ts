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
  },
};
