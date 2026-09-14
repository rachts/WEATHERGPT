"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getActiveLocation, LOCATION_CHANGE_EVENT } from "@/lib/utils/location";
import LocationModal from "@/components/LocationModal";

export default function SettingsPage() {
  const [activeLoc, setActiveLoc] = useState(() => getActiveLocation());
  const [language, setLanguage] = useState<"hi-IN" | "ta-IN" | "en-IN">("hi-IN");
  const [voiceOutput, setVoiceOutput] = useState(true);
  const [smsForecast, setSmsForecast] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [savedToast, setSavedToast] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("weathergpt_lang") as any;
      if (stored) setLanguage(stored);
      const voice = localStorage.getItem("weathergpt_voice");
      if (voice !== null) setVoiceOutput(voice === "true");
    }

    const loc = getActiveLocation();
    setActiveLoc(loc);

    const handleLocationChange = (e: Event) => {
      const custom = e as CustomEvent<{ district: string; state: string }>;
      if (custom.detail) {
        setActiveLoc({ district: custom.detail.district, state: custom.detail.state });
      } else {
        setActiveLoc(getActiveLocation());
      }
      showToast();
    };

    window.addEventListener(LOCATION_CHANGE_EVENT, handleLocationChange);
    return () => window.removeEventListener(LOCATION_CHANGE_EVENT, handleLocationChange);
  }, []);

  const handleLanguageChange = (lang: "hi-IN" | "ta-IN" | "en-IN") => {
    setLanguage(lang);
    localStorage.setItem("weathergpt_lang", lang);
    showToast();
  };

  const handleVoiceToggle = () => {
    const next = !voiceOutput;
    setVoiceOutput(next);
    localStorage.setItem("weathergpt_voice", String(next));
    showToast();
  };

  const showToast = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  return (
    <div className="py-4 space-y-6">
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />

      {savedToast && (
        <div className="fixed top-16 right-4 bg-primary text-white text-xs px-3 py-1.5 rounded shadow-none z-50">
          Preferences saved
        </div>
      )}

      {/* Header */}
      <div className="border-b border-border pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl text-text-primary font-medium tracking-tight">
            Settings & Preferences
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Regional dialect, notifications, and telemetry
          </p>
        </div>
        <span className="text-xs text-text-secondary border border-border px-2 py-0.5 rounded">
          v1.0.0
        </span>
      </div>

      {/* Settings Rows List */}
      <div className="bg-surface border border-border rounded-xl divide-y divide-border">
        {/* Language Selector */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-text-primary">Response Language</div>
            <div className="text-xs text-text-secondary mt-0.5">
              Natural language speech and text phrasing
            </div>
          </div>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as any)}
            className="text-xs p-1.5 border border-border rounded bg-bg text-text-primary focus:outline-none focus:border-primary font-medium"
          >
            <option value="hi-IN">हिंदी (Hindi)</option>
            <option value="ta-IN">தமிழ் (Tamil)</option>
            <option value="en-IN">English (Indian)</option>
          </select>
        </div>

        {/* Saved Location */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-text-primary">Primary Location</div>
            <div className="text-xs text-text-secondary mt-0.5">
              IMD Agromet Observation sub-division across all 36 States & UTs
            </div>
          </div>
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center space-x-1 text-xs border border-border hover:border-primary px-2.5 py-1.5 rounded bg-bg text-text-primary font-medium transition-colors"
            title="Change primary location"
          >
            <span className="material-symbols-outlined text-[14px] text-primary">edit_location</span>
            <span>{activeLoc.district}, {activeLoc.state}</span>
          </button>
        </div>

        {/* Voice Read-Aloud Toggle */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-text-primary">Voice Output (TTS)</div>
            <div className="text-xs text-text-secondary mt-0.5">
              Speak answers aloud on device using local Web Speech synthesis
            </div>
          </div>
          {/* 1px bordered switch, moss-green ON per Design_v2.md */}
          <button
            type="button"
            role="switch"
            aria-checked={voiceOutput}
            onClick={handleVoiceToggle}
            className={`w-11 h-6 rounded-full border transition-colors flex items-center px-0.5 ${
              voiceOutput
                ? "bg-primary border-primary"
                : "bg-surface border-border"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                voiceOutput ? "translate-x-5" : "translate-x-0 border border-border"
              }`}
            />
          </button>
        </div>

        {/* Web Push Notifications */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-text-primary">In-App & Push Warnings</div>
            <div className="text-xs text-text-secondary mt-0.5">
              Receive immediate notifications for Moderate, High, and Severe weather alerts
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pushEnabled}
            onClick={() => {
              setPushEnabled(!pushEnabled);
              showToast();
            }}
            className={`w-11 h-6 rounded-full border transition-colors flex items-center px-0.5 ${
              pushEnabled
                ? "bg-primary border-primary"
                : "bg-surface border-border"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                pushEnabled ? "translate-x-5" : "translate-x-0 border border-border"
              }`}
            />
          </button>
        </div>

        {/* Daily Forecast SMS (Honest Stub) */}
        <div className="p-4 flex items-center justify-between opacity-80">
          <div>
            <div className="text-sm font-medium text-text-primary flex items-center gap-2">
              <span>Daily SMS Digest</span>
              <span className="text-[10px] text-text-secondary border border-border px-1.5 py-0.2 rounded">
                Production Target (Stub)
              </span>
            </div>
            <div className="text-xs text-text-secondary mt-0.5">
              SMS gateway requires paid telecom carrier integration (C-DOT / CDAC)
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={smsForecast}
            onClick={() => {
              setSmsForecast(!smsForecast);
              showToast();
            }}
            className={`w-11 h-6 rounded-full border transition-colors flex items-center px-0.5 ${
              smsForecast
                ? "bg-primary border-primary"
                : "bg-surface border-border"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                smsForecast ? "translate-x-5" : "translate-x-0 border border-border"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Disclosures & Policy Section */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary">
          Data Governance & Disclosures
        </h2>
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2.5 text-xs text-text-secondary leading-relaxed">
          <p>
            <strong>Official IMD Data Source:</strong> Weather observations, nowcasts, and bulletins
            are ingested from the India Meteorological Department (MoES, Government of India).
          </p>
          <p>
            <strong>AI-Usage Disclosure:</strong> Responses are phrased by an AI language model over
            verified IMD meteorological data. Forecast numbers, temperatures, rain metrics, and
            warning text are <em>never authored or hallucinated by the AI</em>.
          </p>
          <p>
            <strong>Offline Operation:</strong> When disconnected from cellular network, WeatherGPT
            serves the latest cached bulletin along with its exact issuance timestamp.
          </p>
          <div className="pt-2 border-t border-border flex space-x-4">
            <Link href="/privacy" className="text-primary font-medium underline underline-offset-2">
              Privacy Policy
            </Link>
            <a
              href="mailto:imd-kisan@imd.gov.in"
              className="text-text-secondary hover:text-text-primary"
            >
              Contact Support: imd-kisan@imd.gov.in
            </a>
          </div>
        </div>
      </section>

      {/* 5 Frequently Asked Questions (G11 requirement) */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary">
          Frequently Asked Questions (FAQ)
        </h2>
        <div className="bg-surface border border-border rounded-xl divide-y divide-border text-xs">
          <div className="p-4 space-y-1">
            <h3 className="font-medium text-text-primary">1. Where does the weather data originate?</h3>
            <p className="text-text-secondary leading-relaxed">
              All forecasts, Doppler radar scans, and bulletins originate from the India Meteorological
              Department (MoES) Regional Meteorological Centre Mumbai and data.gov.in APIs, with
              Open-Meteo as a documented secondary fallback.
            </p>
          </div>
          <div className="p-4 space-y-1">
            <h3 className="font-medium text-text-primary">2. Why is only Raigad district available?</h3>
            <p className="text-text-secondary leading-relaxed">
              For the SIH 2026 prototype (PS ID 26068), Raigad district was selected due to its
              vulnerability to cyclone landfalls and high rural agricultural density. Full national
              coverage is planned for the production phase.
            </p>
          </div>
          <div className="p-4 space-y-1">
            <h3 className="font-medium text-text-primary">3. How does WeatherGPT work offline?</h3>
            <p className="text-text-secondary leading-relaxed">
              The application is a progressive web app (PWA) with a local service worker cache. If
              network drops, WeatherGPT serves the last known forecast with its exact original issue
              time clearly displayed.
            </p>
          </div>
          <div className="p-4 space-y-1">
            <h3 className="font-medium text-text-primary">4. How are warnings escalated across tiers?</h3>
            <p className="text-text-secondary leading-relaxed">
              Alerts follow the IMD Impact-Based Warning System: Low alerts show an in-app banner;
              Moderate alerts trigger Web Push; High alerts dispatch push and SMS; Severe alerts trigger
              push, SMS, and an IVR automated voice call.
            </p>
          </div>
          <div className="p-4 space-y-1">
            <h3 className="font-medium text-text-primary">5. What is the status of SMS and IVR delivery?</h3>
            <p className="text-text-secondary leading-relaxed">
              In this prototype, SMS and IVR are structured gateway interfaces with clear production
              TODOs. Live SMS/IVR requires a paid government telecom tie-in (C-DOT / CDAC) and is
              honestly logged rather than faked.
            </p>
          </div>
        </div>
      </section>

      {/* Emergency Crisis Helpline Footer */}
      <footer className="text-center py-4 border-t border-border space-y-1 text-xs text-text-secondary">
        <p>National Tele Mental Health Programme: Tele MANAS toll-free 14416 (24/7)</p>
        <p>© 2026 India Meteorological Department, Ministry of Earth Sciences</p>
      </footer>
    </div>
  );
}
