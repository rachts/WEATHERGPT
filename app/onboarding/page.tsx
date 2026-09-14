"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  getAllStates,
  getDistrictsByState,
  getNearestDistrict,
  setActiveLocation,
} from "@/lib/utils/location";

export default function OnboardingPage() {
  const router = useRouter();
  const [manualMode, setManualMode] = useState(false);
  const [selectedState, setSelectedState] = useState("Maharashtra");
  const [district, setDistrict] = useState("Raigad");
  const [language, setLanguage] = useState("hi-IN");
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  const states = useMemo(() => getAllStates(), []);
  const districtsForState = useMemo(() => getDistrictsByState(selectedState), [selectedState]);

  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    const districts = getDistrictsByState(newState);
    if (districts.length > 0) {
      setDistrict(districts[0].name);
    }
  };

  const handleGpsDetect = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsMessage("Geolocation not supported by browser. Select manually.");
      setManualMode(true);
      return;
    }

    setGpsDetecting(true);
    setGpsMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsDetecting(false);
        const nearest = getNearestDistrict(pos.coords.latitude, pos.coords.longitude);
        setSelectedState(nearest.state);
        setDistrict(nearest.name);
        setGpsMessage(`Location detected: ${nearest.name}, ${nearest.state}`);
      },
      (err) => {
        setGpsDetecting(false);
        setGpsMessage(
          err.code === 1
            ? "Location permission was not granted. Please select your district manually."
            : "Could not retrieve GPS coordinates. Please select manually."
        );
        setManualMode(true);
      },
      { timeout: 8000 }
    );
  };

  const handleComplete = () => {
    if (typeof window !== "undefined") {
      setActiveLocation(district, selectedState);
      localStorage.setItem("weathergpt_lang", language);
      localStorage.setItem("weathergpt_onboarded", "true");
    }
    router.push("/");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 py-8">
      {/* Editorial Line Art Container */}
      <div className="mb-6 flex justify-center w-full">
        <div className="w-44 h-44 border border-border bg-surface flex items-center justify-center rounded-lg p-3">
          <svg
            className="w-full h-full text-text-primary opacity-80"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Minimalist continuous line art farmer & clouds */}
            <path d="M 20 40 Q 35 25 50 40 Q 65 25 80 40 Q 90 50 80 60 Q 70 70 50 65 Q 30 70 20 60 Z" />
            <line x1="30" y1="72" x2="30" y2="78" />
            <line x1="45" y1="72" x2="45" y2="82" />
            <line x1="60" y1="72" x2="60" y2="78" />
            <line x1="75" y1="72" x2="75" y2="82" />
            {/* Horizon & Farmer silhouette */}
            <line x1="10" y1="90" x2="90" y2="90" />
            <circle cx="50" cy="80" r="3" />
            <line x1="50" y1="83" x2="50" y2="90" />
          </svg>
        </div>
      </div>

      <div className="space-y-3 max-w-md mx-auto">
        <h1 className="text-2xl sm:text-3xl text-text-primary font-medium tracking-tight">
          Ask the weather anything
        </h1>
        <p className="text-sm sm:text-base text-text-secondary max-w-sm mx-auto leading-relaxed">
          Get forecasts, warnings, and farming advice across all 28 States and 8 Union Territories.
        </p>
      </div>

      {gpsMessage && (
        <p className="text-xs text-primary font-medium mt-4 max-w-xs">{gpsMessage}</p>
      )}

      {!manualMode ? (
        <div className="w-full max-w-xs mt-6 space-y-3">
          <button
            onClick={handleGpsDetect}
            disabled={gpsDetecting}
            className="w-full bg-surface border border-primary text-primary font-medium py-3 rounded-xl hover:bg-primary-light transition-colors duration-150 text-sm flex items-center justify-center space-x-2"
          >
            <span className="material-symbols-outlined text-[18px]">
              {gpsDetecting ? "sync" : "my_location"}
            </span>
            <span>{gpsDetecting ? "Detecting Location..." : `Allow Location (${district}, ${selectedState})`}</span>
          </button>

          {district && (
            <button
              onClick={handleComplete}
              className="w-full bg-primary text-white font-medium py-2.5 rounded-xl hover:bg-primary-dark transition-colors duration-150 text-xs"
            >
              Continue with {district}, {selectedState}
            </button>
          )}

          <div>
            <button
              onClick={() => setManualMode(true)}
              className="text-xs text-primary underline underline-offset-4 hover:text-primary-dark transition-colors"
            >
              Select State & District manually
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-sm mt-6 text-left border border-border p-5 rounded-xl bg-surface space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">
              Select State / UT (36)
            </label>
            <select
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full p-2 text-sm border border-border rounded-lg bg-bg text-text-primary focus:outline-none focus:border-primary"
            >
              <optgroup label="28 States">
                {states
                  .filter((s) => s.type === "State")
                  .map((s) => (
                    <option key={s.state} value={s.state}>
                      {s.state}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="8 Union Territories">
                {states
                  .filter((s) => s.type === "Union Territory")
                  .map((s) => (
                    <option key={s.state} value={s.state}>
                      {s.state}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">
              Select District
            </label>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full p-2 text-sm border border-border rounded-lg bg-bg text-text-primary focus:outline-none focus:border-primary"
            >
              {districtsForState.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} {d.crops && d.crops.length > 0 ? `(${d.crops.slice(0, 2).join(", ")})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">
              Primary Language
            </label>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {[
                { code: "hi-IN", label: "हिंदी" },
                { code: "en-IN", label: "English" },
                { code: "ta-IN", label: "தமிழ்" },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`py-2 border rounded-lg transition-colors ${
                    language === lang.code
                      ? "border-primary bg-primary-light text-primary font-medium"
                      : "border-border text-text-secondary bg-surface"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleComplete}
            className="w-full mt-2 bg-surface border border-primary text-primary font-medium py-2.5 rounded-lg hover:bg-primary-light transition-colors text-sm"
          >
            Confirm District & Continue
          </button>
        </div>
      )}

      <footer className="mt-12 text-center">
        <p className="text-[10px] text-text-secondary uppercase tracking-widest">
          Powered by India Meteorological Department (MoES)
        </p>
      </footer>
    </div>
  );
}
