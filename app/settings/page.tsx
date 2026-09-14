"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getActiveLocation, LOCATION_CHANGE_EVENT } from "@/lib/utils/location";
import LocationModal from "@/components/LocationModal";
import { useTranslation } from "@/lib/i18n/context";

export default function SettingsPage() {
  const { t, lang, setLanguage } = useTranslation();
  const [activeLoc, setActiveLoc] = useState(() => getActiveLocation());
  const [voiceOutput, setVoiceOutput] = useState(true);
  const [smsForecast, setSmsForecast] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [savedToast, setSavedToast] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
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

  const handleLanguageChange = (newLang: "hi-IN" | "ta-IN" | "en-IN") => {
    setLanguage(newLang);
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
          {t.actions.save}
        </div>
      )}

      {/* Header */}
      <div className="border-b border-border pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl text-text-primary font-medium tracking-tight">
            {t.settings.title}
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {t.settings.subtitle}
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
            <div className="text-sm font-medium text-text-primary">{t.settings.languageTitle}</div>
            <div className="text-xs text-text-secondary mt-0.5">
              {t.settings.languageDesc}
            </div>
          </div>
          <select
            value={lang}
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
            <div className="text-sm font-medium text-text-primary">{t.settings.voiceTitle}</div>
            <div className="text-xs text-text-secondary mt-0.5">
              {t.settings.voiceDesc}
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
            <div className="text-sm font-medium text-text-primary flex items-center gap-2">
              <span>{t.settings.pushTitle}</span>
              <span className="text-[10px] text-text-secondary border border-border px-1.5 py-0.5 rounded">
                Coming soon (VAPID key pending)
              </span>
            </div>
            <div className="text-xs text-text-secondary mt-0.5">
              {t.settings.pushDesc}
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
              <span>{t.settings.smsTitle}</span>
              <span className="text-[10px] text-text-secondary border border-border px-1.5 py-0.5 rounded">
                Coming soon (Requires C-DOT Gateway)
              </span>
            </div>
            <div className="text-xs text-text-secondary mt-0.5">
              {t.settings.smsDesc}
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
            <strong>IMD Open Data Attribution:</strong> Weather observations, nowcasts, and bulletins
            are sourced from India Meteorological Department (IMD) open data layers. WeatherGPT is an
            independent, unofficial student prototype developed for Smart India Hackathon (SIH 2026, PS 26068).
          </p>
          <p>
            <strong>Deterministic Engine Disclosure:</strong> Responses are generated by a deterministic,
            rule-based agronomic query engine over verified meteorological observations. Forecast numbers,
            temperatures, rain metrics, and warning text are <em>strictly retrieved from data feeds and never hallucinated</em>.
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
              href="https://github.com/rachts/WEATHERGPT/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary"
            >
              Report Feedback (GitHub)
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
              Surface observations originate from IMD observatory stations across India. When an observatory
              is temporarily offline, numerical agromet model forecasts from Open-Meteo serve as calibrated
              secondary fallback, clearly labeled as such.
            </p>
          </div>
          <div className="p-4 space-y-1">
            <h3 className="font-medium text-text-primary">2. How does the offline mode work?</h3>
            <p className="text-text-secondary leading-relaxed">
              Every successfully retrieved forecast is written to local browser cache. If your
              mobile connection drops in the field, WeatherGPT automatically serves your district&apos;s latest
              cached snapshot with an explicit timestamp.
            </p>
          </div>
          <div className="p-4 space-y-1">
            <h3 className="font-medium text-text-primary">3. Is my location data shared with third parties?</h3>
            <p className="text-text-secondary leading-relaxed">
              No. GPS coordinates are converted locally in your browser to your nearest district using
              pre-bundled district geometries. Coordinates are never sold, tracked, or sent to ad brokers.
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
        <p>© 2026 WeatherGPT · Powered by IMD open data (Unofficial Student Prototype)</p>
      </footer>
    </div>
  );
}
