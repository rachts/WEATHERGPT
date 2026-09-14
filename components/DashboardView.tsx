"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatISTTime } from "@/lib/utils/formatters";
import type { CropAdvisoryResult } from "@/lib/services/advisory-rules";
import { getActiveLocation, findDistrictInfo, LOCATION_CHANGE_EVENT } from "@/lib/utils/location";
import LocationModal from "@/components/LocationModal";

interface WeatherData {
  district: string;
  state: string;
  sourceProduct: string;
  issueTime: string;
  isCachedFallback: boolean;
  current: {
    temperature: number;
    tempUnit: string;
    humidity: number;
    humidityUnit: string;
    windSpeed: number;
    windDirection: string;
    windUnit: string;
    condition: string;
    rainfallLast24h: number;
    rainUnit: string;
  };
  forecastDaily: Array<{
    day: string;
    condition: string;
    tempMin: number;
    tempMax: number;
  }>;
}

interface AlertData {
  id: string;
  severity: string;
  headline: string;
  warningText: string;
  issueTime: string;
}

export default function DashboardView() {
  const router = useRouter();
  const [activeLoc, setActiveLoc] = useState(() => getActiveLocation());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [advisory, setAdvisory] = useState<CropAdvisoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const loadData = useCallback(async (district: string) => {
    try {
      setLoading(true);
      const districtInfo = findDistrictInfo(district);
      const primaryCrop = (districtInfo?.crops && districtInfo.crops.length > 0) ? districtInfo.crops[0].toLowerCase() : "paddy";

      const [weatherRes, alertsRes, advisoryRes] = await Promise.all([
        fetch(`/api/weather?district=${encodeURIComponent(district)}`),
        fetch(`/api/alerts?district=${encodeURIComponent(district)}`),
        fetch(`/api/advisory?district=${encodeURIComponent(district)}&crop=${encodeURIComponent(primaryCrop)}`),
      ]);

      if (weatherRes.ok) setWeather(await weatherRes.json());
      if (alertsRes.ok) {
        const aJson = await alertsRes.json();
        setAlerts(aJson.alerts || []);
      }
      if (advisoryRes.ok) setAdvisory(await advisoryRes.json());
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loc = getActiveLocation();
    setActiveLoc(loc);
    loadData(loc.district);

    const handleLocationChange = (e: Event) => {
      const custom = e as CustomEvent<{ district: string; state: string }>;
      const newDistrict = custom.detail ? custom.detail.district : getActiveLocation().district;
      const newState = custom.detail ? custom.detail.state : getActiveLocation().state;
      setActiveLoc({ district: newDistrict, state: newState });
      loadData(newDistrict);
    };

    window.addEventListener(LOCATION_CHANGE_EVENT, handleLocationChange);
    return () => window.removeEventListener(LOCATION_CHANGE_EVENT, handleLocationChange);
  }, [loadData]);

  const handleQuickQuestion = (text: string) => {
    router.push(`/chat?q=${encodeURIComponent(text)}`);
  };

  const districtInfo = findDistrictInfo(activeLoc.district);

  if (loading || !weather) {
    return (
      <div className="py-12 flex flex-col items-center justify-center">
        <div className="top-loading-bar"></div>
        <p className="text-sm text-text-secondary mt-4">
          Loading IMD weather feed for {activeLoc.district}...
        </p>
      </div>
    );
  }

  const formattedIssueTime = formatISTTime(weather.issueTime);

  return (
    <div className="py-4 space-y-5">
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />

      {/* Header Location & Last Updated */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-border pb-3 gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl text-text-primary font-medium tracking-tight">
              {weather.district}, {weather.state}
            </h1>
            <button
              id="dashboard-change-location-btn"
              onClick={() => setIsLocationModalOpen(true)}
              className="text-xs text-primary underline underline-offset-4 hover:text-primary-dark transition-colors cursor-pointer"
            >
              Change
            </button>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Issued: {formattedIssueTime} IST · {weather.isCachedFallback ? "Cached Offline" : "IMD Live"}
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 bg-surface border border-border text-primary rounded font-medium self-start sm:self-auto">
          {districtInfo?.station || "IMD Agromet Observatory"}
        </span>
      </div>

      {/* Active Alerts Banner */}
      <div className="space-y-2">
        {alerts.filter(a => a.severity !== "Low" || !a.warningText.toLowerCase().includes("no warning")).length > 0 ? (
          alerts.filter(a => a.severity !== "Low" || !a.warningText.toLowerCase().includes("no warning")).map((alert) => (
            <div
              key={alert.id}
              className="bg-surface border border-border border-l-[3px] border-l-primary rounded-lg p-4 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                  {alert.severity} Alert — Impact Warning
                </span>
                <span className="text-[11px] text-text-secondary">{districtInfo?.metCentre || "IMD MoES"}</span>
              </div>
              <p className="text-sm text-text-primary font-medium">{alert.headline}</p>
              <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                {alert.warningText}
              </p>
              <div className="mt-2.5 flex items-center space-x-4 text-xs">
                <Link href="/alerts" className="text-primary underline underline-offset-2">
                  View Full Warning
                </Link>
                <Link href="/radar" className="text-text-secondary hover:text-text-primary">
                  Inspect Radar
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-surface border border-border rounded-lg p-3.5 flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0"></span>
            <span className="text-xs text-text-primary font-medium">
              No active severe weather warnings in your area.
            </span>
          </div>
        )}
      </div>

      {/* Current Conditions Card */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-4xl sm:text-5xl text-text-primary font-medium tracking-tight">
              {Math.round(weather.current.temperature)}°C
            </div>
            <p className="text-sm sm:text-base text-text-secondary mt-1">
              {weather.current.condition}
            </p>
          </div>
          <div className="text-right text-xs text-text-secondary">
            <p>24h Rain: {weather.current.rainfallLast24h} mm</p>
            <p className="mt-0.5">Wind: {weather.current.windDirection} {weather.current.windSpeed} km/h</p>
          </div>
        </div>

        {/* 3-Metric Clean Grid (Table-like, hairline borders, no icons per Design_v2.md) */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center">
          <div className="p-2 border border-border rounded bg-bg">
            <div className="text-[11px] uppercase tracking-wider text-text-secondary">Humidity</div>
            <div className="text-base text-text-primary font-medium mt-0.5">
              {weather.current.humidity}%
            </div>
          </div>
          <div className="p-2 border border-border rounded bg-bg">
            <div className="text-[11px] uppercase tracking-wider text-text-secondary">Wind Speed</div>
            <div className="text-base text-text-primary font-medium mt-0.5">
              {weather.current.windSpeed} km/h
            </div>
          </div>
          <div className="p-2 border border-border rounded bg-bg">
            <div className="text-[11px] uppercase tracking-wider text-text-secondary">Precipitation</div>
            <div className="text-base text-text-primary font-medium mt-0.5">
              {weather.current.rainfallLast24h} mm
            </div>
          </div>
        </div>

        <div className="text-[11px] text-text-secondary pt-1 flex justify-between items-center">
          <span>Source: {weather.sourceProduct}</span>
          <span>{formattedIssueTime} IST</span>
        </div>
      </div>

      {/* Today's Advisory Card (Deterministic Rules Module) */}
      {advisory && (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-text-primary">
              Today&apos;s Crop Advisory ({advisory.crop})
            </h2>
            <span
              className={`text-xs px-2 py-0.5 rounded border ${
                advisory.sprayCondition === "SAFE"
                  ? "border-primary bg-primary-light text-primary"
                  : "border-border text-text-secondary bg-bg"
              }`}
            >
              {advisory.sprayCondition}: Pesticide Spray
            </span>
          </div>

          <div className="text-sm text-text-primary space-y-2 leading-relaxed">
            <p>• {advisory.sprayAdvisory}</p>
            <p>• {advisory.irrigationAdvisory}</p>
          </div>

          <div className="text-[11px] text-text-secondary pt-2 border-t border-border flex justify-between items-center">
            <span>Rule: {advisory.sourceRule}</span>
            <span>Non-LLM Verified</span>
          </div>
        </div>
      )}

      {/* Quick Question Chips */}
      <div className="space-y-2 pt-1">
        <p className="text-xs uppercase tracking-wider text-text-secondary">
          Quick Inquiries
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            `Will it rain today in ${weather.district}?`,
            `Is it safe to spray ${advisory ? advisory.crop.toLowerCase() : "crops"} today?`,
            "Show 7-day weather outlook",
            "Any cyclone or thunderstorm alert?",
          ].map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickQuestion(chip)}
              className="bg-surface border border-border hover:border-primary text-text-primary px-3.5 py-1.5 rounded-full text-xs transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Ask Input Bar (Redirects to Chat) */}
      <div className="pt-2">
        <div
          onClick={() => router.push("/chat")}
          className="bg-surface border border-border hover:border-primary cursor-pointer p-3.5 rounded-xl flex items-center justify-between text-sm text-text-secondary transition-colors"
        >
          <div className="flex items-center space-x-2.5">
            <span className="material-symbols-outlined text-[20px] text-text-secondary">
              mic
            </span>
            <span>Ask in Hindi, English, Tamil...</span>
          </div>
          <span className="text-primary font-medium text-xs flex items-center space-x-1">
            <span>Ask</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </span>
        </div>
      </div>
    </div>
  );
}
