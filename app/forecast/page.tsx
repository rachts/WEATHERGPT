"use client";

import React, { useEffect, useState } from "react";
import { formatISTTime } from "@/lib/utils/formatters";
import { getActiveLocation, LOCATION_CHANGE_EVENT } from "@/lib/utils/location";
import LocationModal from "@/components/LocationModal";
import DataStatusBadge from "@/components/DataStatusBadge";
import type { DataProvenance } from "@/lib/types/provenance";

interface ForecastDay {
  day: string;
  date: string;
  condition: string;
  tempMin: number;
  tempMax: number;
  rainfallMm: number;
  pop: number;
}

export default function ForecastPage() {
  const [activeLoc, setActiveLoc] = useState(() => getActiveLocation());
  const [days, setDays] = useState<ForecastDay[]>([]);
  const [issueTime, setIssueTime] = useState("");
  const [sourceProduct, setSourceProduct] = useState("");
  const [provenance, setProvenance] = useState<DataProvenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  useEffect(() => {
    async function loadForecast(district: string) {
      try {
        setLoading(true);
        setOfflineError(false);
        const res = await fetch(`/api/weather?district=${encodeURIComponent(district)}`);
        if (res.ok) {
          const rawData = await res.json();
          const data = rawData.data || rawData;
          setDays(data.forecastDaily || []);
          setIssueTime(data.issueTime || "");
          setSourceProduct(data.sourceProduct || "");
          setProvenance(data.provenance || null);
          setIsOfflineFallback(false);

          try {
            // Update district snapshot in localStorage
            const existingRaw = localStorage.getItem(`wg_cache_${district.toLowerCase()}`);
            const existing = existingRaw ? JSON.parse(existingRaw) : {};
            localStorage.setItem(
              `wg_cache_${district.toLowerCase()}`,
              JSON.stringify({
                ...existing,
                weather: data,
                savedAt: Date.now(),
              })
            );
          } catch {}
        } else {
          throw new Error("Forecast fetch returned non-200");
        }
      } catch (err) {
        console.warn("Forecast live fetch unavailable, checking cache:", err);
        try {
          const cachedRaw = localStorage.getItem(`wg_cache_${district.toLowerCase()}`);
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (parsed.weather?.forecastDaily) {
              setDays(parsed.weather.forecastDaily);
              setIssueTime(parsed.weather.issueTime || "");
              setSourceProduct(parsed.weather.sourceProduct || "IMD Cached Forecast");
              setIsOfflineFallback(true);
              return;
            }
          }
        } catch {}
        setOfflineError(true);
      } finally {
        setLoading(false);
      }
    }

    const loc = getActiveLocation();
    setActiveLoc(loc);
    loadForecast(loc.district);

    const handleLocationChange = (e: Event) => {
      const custom = e as CustomEvent<{ district: string; state: string }>;
      const newDistrict = custom.detail ? custom.detail.district : getActiveLocation().district;
      const newState = custom.detail ? custom.detail.state : getActiveLocation().state;
      setActiveLoc({ district: newDistrict, state: newState });
      loadForecast(newDistrict);
    };

    window.addEventListener(LOCATION_CHANGE_EVENT, handleLocationChange);
    return () => window.removeEventListener(LOCATION_CHANGE_EVENT, handleLocationChange);
  }, []);

  const formattedIssueTime = formatISTTime(issueTime);

  // Compute dynamic SVG chart coordinates based on daily forecast max temperatures
  const maxTemps = days.length > 0 ? days.map((d) => d.tempMax) : [30, 31, 32, 33, 34, 34, 33];
  const minT = Math.min(...maxTemps, 20);
  const maxT = Math.max(...maxTemps, 40);
  const range = maxT - minT || 1;

  const chartPoints = maxTemps.map((temp, index) => {
    const x = Math.round((index / Math.max(maxTemps.length - 1, 1)) * 600 + 50);
    // Y: 10px is highest temp, 65px is lowest temp
    const y = Math.round(65 - ((temp - minT) / range) * 55);
    return { x, y, temp: `${temp}°` };
  });

  const polylineStr = chartPoints.map((p) => `${p.x},${p.y}`).join(" ");

  if (loading && days.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center">
        <div className="top-loading-bar"></div>
        <p className="text-sm text-text-secondary mt-4">
          Loading 7-day meteorological outlook for {activeLoc.district}...
        </p>
      </div>
    );
  }

  if (offlineError && days.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center px-4">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-2xl">wifi_off</span>
        </div>
        <h2 className="text-lg font-medium text-text-primary">Offline — No Cached Forecast</h2>
        <p className="text-xs text-text-secondary mt-1 max-w-sm">
          No offline forecast is stored for {activeLoc.district}. Please reconnect to fetch latest IMD outlooks.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-white text-xs rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-6">
      {/* Offline Cached Data Notice */}
      {isOfflineFallback && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-base text-amber-600">cloud_off</span>
            <span>Showing cached 7-day forecast. Live update currently unavailable.</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-[11px] underline font-medium hover:text-amber-950 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />

      {/* Top Section */}
      <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl text-text-primary font-medium tracking-tight">
              7-Day District Forecast
            </h1>
            <button
              onClick={() => setIsLocationModalOpen(true)}
              className="text-xs text-primary underline underline-offset-4 hover:text-primary-dark transition-colors"
            >
              Change
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <DataStatusBadge
              status={isOfflineFallback ? "OFFLINE" : (provenance?.quality || "LIVE")}
              provider={provenance?.provider || "IMD"}
              providerName={provenance?.providerName}
              observedAt={formattedIssueTime}
            />
            <span className="text-xs text-text-secondary">
              {activeLoc.district}, {activeLoc.state} · {formattedIssueTime ? `Issued ${formattedIssueTime} IST` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Temperature Trend Line Chart (Design_v2.md: line graph, moss-green 1.5px stroke, no fill under line, no grid) */}
      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-widest text-text-secondary">
          Temperature Trend (Max °C)
        </h2>
        <div className="bg-surface border border-border p-4 rounded-xl">
          <div className="h-36 w-full relative flex flex-col justify-end">
            <svg
              className="w-full h-24 overflow-visible"
              viewBox="0 0 700 85"
              preserveAspectRatio="none"
            >
              <polyline
                fill="none"
                stroke="#2D5016"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={polylineStr}
              />
              {/* Data points */}
              {chartPoints.map((pt, i) => (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.y} r="3" fill="#2D5016" />
                  <text
                    x={pt.x}
                    y={pt.y - 8}
                    fontSize="11"
                    fill="#1A1A1A"
                    textAnchor="middle"
                    fontFamily="Inter"
                  >
                    {pt.temp}
                  </text>
                </g>
              ))}
            </svg>

            {/* X Axis Labels */}
            <div className="flex justify-between text-xs text-text-secondary pt-3 border-t border-border mt-2">
              {days.map((d, i) => (
                <span key={i} className="text-center w-10">
                  {d.day.split(" ")[0]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7-Day Table (Strict per Design_v2.md: Day | Condition | "24° / 32°", 1px row dividers, no icons) */}
      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-widest text-text-secondary">
          Daily Meteorological Outlook
        </h2>
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg text-text-secondary text-xs uppercase tracking-wider">
                <th className="py-3 px-4 font-normal">Day</th>
                <th className="py-3 px-4 font-normal">Condition</th>
                <th className="py-3 px-4 font-normal text-right">Temp (Min / Max)</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, idx) => (
                <tr
                  key={idx}
                  className={idx !== days.length - 1 ? "border-b border-border" : ""}
                >
                  <td className="py-3.5 px-4 font-medium text-text-primary">{d.day}</td>
                  <td className="py-3.5 px-4 text-text-secondary">{d.condition}</td>
                  <td className="py-3.5 px-4 text-right font-medium text-text-primary">
                    {d.tempMin}° / {d.tempMax}°
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Agricultural Advisories Accordion */}
      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-widest text-text-secondary">
          Agromet Crop Advisories
        </h2>
        <div className="bg-surface border border-border rounded-xl divide-y divide-border">
          <div className="p-4 space-y-1">
            <h3 className="text-sm font-medium text-text-primary">
              Paddy (Kharif Rice) — Panicle Initiation
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Maintain 2 to 3 cm standing water in paddy fields. Intermittent rains provide good
              moisture. Postpone chemical spray if winds exceed 15 km/h.
            </p>
          </div>
          <div className="p-4 space-y-1">
            <h3 className="text-sm font-medium text-text-primary">
              Horticulture (Mango & Coconut Orchards)
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Maintain drainage channels along orchards to prevent collar rot. Inspect coconut palms
              for bud rot after humid coastal showers.
            </p>
          </div>
          <div className="p-4 space-y-1">
            <h3 className="text-sm font-medium text-text-primary">
              Vegetables & Pulses
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Provide staking support to tomato and brinjal vines against gusty coastal winds.
              Avoid top-dressing urea during heavy rain.
            </p>
          </div>
        </div>
      </section>

      <footer className="text-xs text-text-secondary pt-2 flex justify-between">
        <span>Source: {sourceProduct || "data.gov.in — IMD Daily District Forecast"}</span>
        <span>Valid through 7 Days</span>
      </footer>
    </div>
  );
}
