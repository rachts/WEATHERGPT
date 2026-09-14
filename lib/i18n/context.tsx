"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { SupportedLanguage, I18N_RESOURCES, TranslationDict } from "./resources";

interface I18nContextType {
  lang: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: TranslationDict;
}

const defaultDict = I18N_RESOURCES["hi-IN"];

const I18nContext = createContext<I18nContextType>({
  lang: "hi-IN",
  setLanguage: () => {},
  t: defaultDict,
});

export const LANG_CHANGE_EVENT = "weathergpt_lang_changed";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<SupportedLanguage>("hi-IN");

  const applyHtmlLang = (targetLang: SupportedLanguage) => {
    if (typeof document !== "undefined") {
      const code = targetLang.startsWith("ta") ? "ta" : targetLang.startsWith("hi") ? "hi" : "en";
      document.documentElement.lang = code;
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("weathergpt_lang") as SupportedLanguage | null;
      if (stored && I18N_RESOURCES[stored]) {
        setLangState(stored);
        applyHtmlLang(stored);
      } else {
        applyHtmlLang("hi-IN");
      }
    }

    const handleExternalLangChange = (e: Event) => {
      const custom = e as CustomEvent<{ lang: SupportedLanguage }>;
      if (custom.detail?.lang && I18N_RESOURCES[custom.detail.lang]) {
        setLangState(custom.detail.lang);
        applyHtmlLang(custom.detail.lang);
      }
    };

    window.addEventListener(LANG_CHANGE_EVENT, handleExternalLangChange);
    return () => window.removeEventListener(LANG_CHANGE_EVENT, handleExternalLangChange);
  }, []);

  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    setLangState(newLang);
    applyHtmlLang(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("weathergpt_lang", newLang);
      window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: { lang: newLang } }));
    }
  }, []);

  const t = I18N_RESOURCES[lang] || defaultDict;

  return (
    <I18nContext.Provider value={{ lang, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
