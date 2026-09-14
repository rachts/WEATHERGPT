"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  getAllStates,
  getAllDistricts,
  getNearestDistrict,
  setActiveLocation,
  getActiveLocation,
  DistrictInfo,
} from "@/lib/utils/location";

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LocationModal({ isOpen, onClose }: LocationModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("ALL");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const states = useMemo(() => getAllStates(), []);
  const allDistricts = useMemo(() => getAllDistricts(), []);
  const activeLocation = getActiveLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredDistricts = useMemo(() => {
    return allDistricts.filter((d) => {
      const matchesState =
        selectedState === "ALL" || d.state.toLowerCase() === selectedState.toLowerCase();
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.state.toLowerCase().includes(q) ||
        (Boolean(d.headquarters) && d.headquarters!.toLowerCase().includes(q)) ||
        (Array.isArray(d.crops) && d.crops.some((c) => c.toLowerCase().includes(q)));
      return matchesState && matchesQuery;
    });
  }, [allDistricts, selectedState, searchQuery]);

  const handleSelectDistrict = (district: DistrictInfo) => {
    setActiveLocation(district.name, district.state);
    onClose();
  };

  const handleGpsDetect = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser");
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const nearest = getNearestDistrict(pos.coords.latitude, pos.coords.longitude);
        handleSelectDistrict(nearest);
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(
          err.code === 1
            ? "Location permission denied. Please select your district manually."
            : "Unable to detect GPS position. Please pick your state and district."
        );
      },
      { timeout: 8000 }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-surface border border-border rounded-xl w-full max-w-xl max-h-[88vh] flex flex-col shadow-none overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-modal-title"
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 id="location-modal-title" className="text-base sm:text-lg font-medium text-text-primary tracking-tight">
              Select Agricultural District
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Available for all 28 States & 8 Union Territories across India
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-1.5 rounded-lg border border-border hover:bg-bg transition-colors"
            title="Close modal"
          >
            <span className="material-symbols-outlined text-[18px] block">close</span>
          </button>
        </div>

        {/* GPS Quick Button & Notification */}
        <div className="p-3 sm:p-4 bg-bg border-b border-border space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              id="gps-detect-btn"
              onClick={handleGpsDetect}
              disabled={gpsLoading}
              className="flex-1 flex items-center justify-center space-x-2 py-2 px-3 border border-primary text-primary bg-surface hover:bg-primary-light rounded-lg text-xs font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                {gpsLoading ? "sync" : "my_location"}
              </span>
              <span>{gpsLoading ? "Detecting Nearest District..." : "Auto-Detect Nearest District via GPS"}</span>
            </button>
          </div>
          {gpsError && <p className="text-xs text-severity-severe font-medium">{gpsError}</p>}
        </div>

        {/* Filters: State Dropdown & District Search Bar */}
        <div className="p-3 sm:p-4 border-b border-border space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-1">
              <label htmlFor="state-select-dropdown" className="block text-[11px] uppercase tracking-wider text-text-secondary mb-1">
                State / UT
              </label>
              <select
                id="state-select-dropdown"
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full text-xs p-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="ALL">All States & UTs (36)</option>
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

            <div className="sm:col-span-2">
              <label htmlFor="district-search-input" className="block text-[11px] uppercase tracking-wider text-text-secondary mb-1">
                Search by District, State, or Crop
              </label>
              <div className="relative">
                <input
                  id="district-search-input"
                  type="text"
                  placeholder="e.g. Ludhiana, Cotton, Assam, Guntur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs p-2 pl-8 border border-border rounded-lg bg-surface text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-primary"
                />
                <span className="material-symbols-outlined text-[16px] text-text-secondary absolute left-2.5 top-2.5">
                  search
                </span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-text-secondary hover:text-text-primary absolute right-2.5 top-2.5 text-xs"
                  >
                    clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 divide-y divide-border">
          {filteredDistricts.length === 0 ? (
            <div className="py-8 text-center text-text-secondary text-xs">
              No matching districts found. Try adjusting your search query or state filter.
            </div>
          ) : (
            filteredDistricts.map((d) => {
              const isSelected =
                activeLocation.district.toLowerCase() === d.name.toLowerCase();
              return (
                <button
                  key={`${d.state}-${d.name}`}
                  id={`district-item-${d.name.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => handleSelectDistrict(d)}
                  className={`w-full text-left py-2.5 px-3 rounded-lg flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-primary-light border border-primary"
                      : "hover:bg-bg border border-transparent"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="text-xs font-medium text-text-primary">{d.name}</span>
                      <span className="text-[11px] text-text-secondary">· {d.state}</span>
                      {Boolean(d.headquarters) && d.headquarters !== d.name && (
                        <span className="text-[10px] text-text-secondary">
                          (HQ: {d.headquarters})
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-[10px] text-primary border border-primary px-1.5 py-0.2 rounded font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {Boolean(d.station) && (
                        <span className="text-[10px] text-text-secondary border border-border px-1.5 py-0.5 rounded bg-surface">
                          {d.station}
                        </span>
                      )}
                      {(d.crops || []).map((c) => (
                        <span
                          key={c}
                          className="text-[10px] text-text-secondary bg-surface px-1.5 py-0.5 rounded border border-border"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-text-secondary">
                    chevron_right
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-border bg-bg flex items-center justify-between text-[11px] text-text-secondary">
          <span>{filteredDistricts.length} districts available</span>
          <span>IMD Agromet Observation Network</span>
        </div>
      </div>
    </div>
  );
}
