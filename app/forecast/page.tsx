"use client";

import React, { useEffect, useState } from "react";
import { formatISTTime } from "@/lib/utils/formatters";
import { getActiveLocation, LOCATION_CHANGE_EVENT } from "@/lib/utils/location";
import LocationModal from "@/components/LocationModal";

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
  const [loading, setLoading] = useState(true);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  useEffect(() => {
    async function loadForecast(district: string) {
      try {
        setLoading(true);
        const res = await fetch(`/api/weather?district=${encodeURIComponent(district)}`);
        if (res.ok) {
          const data = await res.json();
          setDays(data.forecastDaily || []);
          setIssueTime(data.issueTime || "");
          setSourceProduct(data.sourceProduct || "");
        }
      } catch (err) {
        console.error(err);
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

  return (
    <div className="py-4 space-y-6">
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
          <p className="text-xs text-text-secondary mt-0.5">
            {activeLoc.district} District, {activeLoc.state} · Issued {formattedIssueTime} IST
          </p>
        </div>
        <span className="text-xs text-text-secondary border border-border px-2 py-0.5 rounded self-start sm:self-auto">
          IMD Bulletin
        </span>
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
