"use client";

import React, { useState, useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { getActiveLocation, findDistrictInfo, LOCATION_CHANGE_EVENT } from "@/lib/utils/location";
import {
  ACTIVE_SYNOPTIC_SYSTEMS,
  getDistrictSynopticImpact,
  SynopticSystem,
  DistrictSynopticImpact,
} from "@/lib/services/synoptic";

import { DEFAULT_DISTRICT, DEFAULT_STATE } from "@/lib/config/constants";

type SatelliteSubMode = "gibs_map" | "imd_insat" | "depressions_tracker";
type InsatProduct = "ir1" | "ctbt" | "vis" | "wv" | "ir1_loop" | "ctbt_loop";

export default function SatelliteView() {
  const [subMode, setSubMode] = useState<SatelliteSubMode>("gibs_map");
  const [insatProduct, setInsatProduct] = useState<InsatProduct>("ctbt");
  const [showDepressions, setShowDepressions] = useState(true);
  const [showConvectiveRadius, setShowConvectiveRadius] = useState(true);
  const [activeLocation, setActiveLocation] = useState(() => getActiveLocation());
  const [synopticImpact, setSynopticImpact] = useState<DistrictSynopticImpact | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const systemMarkersRef = useRef<any[]>([]);

  // Load and subscribe to active location changes
  useEffect(() => {
    const loc = getActiveLocation();
    setActiveLocation(loc);

    const dInfo = findDistrictInfo(loc.district);
    const lat = dInfo?.lat ?? 22.57;
    const lon = dInfo?.lon ?? 88.36;
    setSynopticImpact(getDistrictSynopticImpact(loc.district, loc.state, lat, lon));

    const handleLocChange = () => {
      const updated = getActiveLocation();
      setActiveLocation(updated);
      const updatedDInfo = findDistrictInfo(updated.district);
      const uLat = updatedDInfo?.lat ?? 22.57;
      const uLon = updatedDInfo?.lon ?? 88.36;
      setSynopticImpact(getDistrictSynopticImpact(updated.district, updated.state, uLat, uLon));

      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo({
          center: [uLon, uLat],
          zoom: 7,
          essential: true,
        });
        if (userMarkerRef.current) {
          userMarkerRef.current.setLngLat([uLon, uLat]);
        }
      }
    };

    window.addEventListener(LOCATION_CHANGE_EVENT, handleLocChange);
    return () => {
      window.removeEventListener(LOCATION_CHANGE_EVENT, handleLocChange);
    };
  }, []);

  const dInfo = findDistrictInfo(activeLocation.district);
  const userLat = dInfo?.lat ?? 22.57;
  const userLon = dInfo?.lon ?? 88.36;

  // Calculate pixel percentage on IMD INSAT-3D Asia Sector image (approx 40°E-110°E, -10°S-45°N)
  const targetXPct = Math.min(Math.max(((userLon - 40) / 70) * 100, 5), 95);
  const targetYPct = Math.min(Math.max(((45 - userLat) / 55) * 100, 5), 95);

  // Depression center on INSAT-3D
  const depressionSystem = ACTIVE_SYNOPTIC_SYSTEMS.find((s) => s.type === "depression") || ACTIVE_SYNOPTIC_SYSTEMS[0];
  const depXPct = ((depressionSystem.center[0] - 40) / 70) * 100;
  const depYPct = ((45 - depressionSystem.center[1]) / 55) * 100;

  // Initialize MapLibre for TrueColor Earth Observation
  useEffect(() => {
    let isMounted = true;
    let maplibregl: any;

    async function initMap() {
      try {
        const mod = await import("maplibre-gl");
        maplibregl = mod.default || mod;

        if (!isMounted || !mapContainerRef.current) return;

        // Use yesterday's guaranteed complete date for NASA GIBS TrueColor
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: {
            version: 8,
            sources: {
              "nasa-gibs-satellite": {
                type: "raster",
                tiles: [
                  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${yesterday}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
                ],
                tileSize: 256,
                minzoom: 0,
                maxzoom: 8,
                attribution: "© NASA EOSDIS GIBS | VIIRS Earth Observation",
              },
              "carto-labels": {
                type: "raster",
                tiles: ["https://a.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors, CartoDB",
              },
            },
            layers: [
              {
                id: "nasa-satellite-layer",
                type: "raster",
                source: "nasa-gibs-satellite",
                paint: {
                  "raster-opacity": 0.95,
                },
              },
              {
                id: "carto-labels-layer",
                type: "raster",
                source: "carto-labels",
                paint: {
                  "raster-opacity": 0.85,
                },
              },
            ],
          },
          center: [userLon, userLat],
          zoom: 6.8,
        });

        // Add User Location Marker
        const userEl = document.createElement("div");
        userEl.className = "flex items-center justify-center";
        userEl.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-7 h-7 rounded-full bg-emerald-500/30 animate-ping"></span>
            <div class="w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-md flex items-center justify-center text-[9px] text-white font-bold">
              •
            </div>
          </div>
        `;
        userEl.title = `Your District: ${activeLocation.district} (${userLat.toFixed(2)}°N, ${userLon.toFixed(2)}°E)`;
        const uMarker = new maplibregl.Marker(userEl).setLngLat([userLon, userLat]).addTo(map);
        userMarkerRef.current = uMarker;

        // Add Synoptic System Markers
        systemMarkersRef.current = [];
        ACTIVE_SYNOPTIC_SYSTEMS.forEach((sys) => {
          const sysEl = document.createElement("div");
          sysEl.className = "flex flex-col items-center cursor-pointer pointer-events-auto";

          const isDep = sys.type === "depression" || sys.type === "deep_depression";
          const badgeColor = isDep ? "bg-red-600" : "bg-amber-600";
          const pingColor = isDep ? "bg-red-500/30" : "bg-amber-500/30";

          sysEl.innerHTML = `
            <div class="relative flex items-center justify-center">
              <span class="absolute w-8 h-8 rounded-full ${pingColor} animate-ping"></span>
              <div class="w-6 h-6 rounded-full ${badgeColor} border-2 border-white shadow-lg flex items-center justify-center text-white text-[11px] font-bold">
                🌀
              </div>
            </div>
            <div class="mt-1 px-1.5 py-0.5 rounded bg-black/80 text-white text-[9px] font-medium whitespace-nowrap shadow-sm">
              ${sys.intensityLabel} (${sys.centralPressureHpa} hPa)
            </div>
          `;
          sysEl.title = `${sys.name} · Pressure: ${sys.centralPressureHpa} hPa · Winds: ${sys.maxSustainedWindKmph}`;

          const sMarker = new maplibregl.Marker(sysEl).setLngLat(sys.center).addTo(map);
          systemMarkersRef.current.push(sMarker);
        });

        map.on("load", () => {
          mapInstanceRef.current = map;
        });

        const resizeObs = new ResizeObserver(() => {
          map.resize();
        });
        if (mapContainerRef.current) {
          resizeObs.observe(mapContainerRef.current);
        }

        return () => {
          resizeObs.disconnect();
          map.remove();
        };
      } catch (err) {
        console.error("MapLibre Satellite init note:", err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map center when district changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: [userLon, userLat],
        zoom: 6.8,
        essential: true,
      });
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([userLon, userLat]);
      }
    }
  }, [userLon, userLat]);

  // Toggle markers visibility
  useEffect(() => {
    systemMarkersRef.current.forEach((marker) => {
      const el = marker.getElement();
      if (el) {
        el.style.display = showDepressions ? "flex" : "none";
      }
    });
  }, [showDepressions]);

  const insatImgUrl = `/api/satellite?product=${insatProduct}`;

  return (
    <div className="space-y-4">
      {/* Location Satellite Banner */}
      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-primary-light border border-primary/20 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[20px]">satellite_alt</span>
          </div>
          <div>
            <div className="text-xs text-text-secondary uppercase tracking-wider font-medium">
              Targeted Satellite Earth Observation
            </div>
            <h2 className="text-base sm:text-lg text-text-primary font-medium tracking-tight">
              {activeLocation.district}, {activeLocation.state}
              <span className="text-xs text-text-secondary ml-2 font-mono">
                ({userLat.toFixed(2)}°N, {userLon.toFixed(2)}°E)
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-emerald-700 font-medium">INSAT-3D & EARTH OBSERVATION LIVE</span>
        </div>
      </div>

      {/* Submode Switcher */}
      <div className="flex items-center space-x-2 p-1 bg-surface border border-border rounded-xl text-xs w-fit overflow-x-auto">
        <button
          onClick={() => setSubMode("gibs_map")}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
            subMode === "gibs_map"
              ? "bg-primary text-white font-medium shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <span>Location Satellite Map (TrueColor)</span>
        </button>
        <button
          onClick={() => setSubMode("imd_insat")}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
            subMode === "imd_insat"
              ? "bg-primary text-white font-medium shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <span>Official IMD INSAT-3D Suite</span>
        </button>
        <button
          onClick={() => setSubMode("depressions_tracker")}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
            subMode === "depressions_tracker"
              ? "bg-primary text-white font-medium shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <span>Depressions & Synoptic Systems</span>
        </button>
      </div>

      {/* Mode 1: Location Satellite Map (NASA VIIRS TrueColor) */}
      <div className={subMode === "gibs_map" ? "block space-y-3" : "hidden"}>
        {/* Layer Toggles & Map Info */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showDepressions}
                onChange={(e) => setShowDepressions(e.target.checked)}
                className="accent-primary rounded"
              />
              <span>Show Active Depressions & Lows (🌀)</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showConvectiveRadius}
                onChange={(e) => setShowConvectiveRadius(e.target.checked)}
                className="accent-primary rounded"
              />
              <span>Convective Influence Footprint</span>
            </label>
          </div>
          <span className="text-[11px] font-mono">Satellite: NASA VIIRS / MODIS TrueColor 250m</span>
        </div>

        {/* Map Container */}
        <div className="relative w-full h-[400px] sm:h-[480px] bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Location Focus Badge */}
          <div className="absolute top-3 left-3 bg-surface/90 border border-border px-3 py-1.5 rounded-lg text-xs shadow-sm backdrop-blur-sm flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              Target: <strong>{activeLocation.district}</strong>
            </span>
          </div>

          {/* Synoptic Depression Distance HUD */}
          {synopticImpact && (
            <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md bg-surface/95 border border-border p-3 rounded-lg text-xs shadow-md backdrop-blur-sm space-y-1">
              <div className="flex items-center justify-between text-[11px] border-b border-border pb-1">
                <span className="text-text-secondary font-medium uppercase tracking-wider">
                  Nearest Synoptic Depression
                </span>
                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-medium text-[10px]">
                  {synopticImpact.nearestSystem.intensityLabel}
                </span>
              </div>
              <div className="text-text-primary font-medium">
                {synopticImpact.nearestSystem.name}
              </div>
              <div className="flex items-center justify-between text-text-secondary text-[11px]">
                <span>
                  Distance: <strong className="text-text-primary">{synopticImpact.distanceKm} km {synopticImpact.bearing}</strong>
                </span>
                <span>
                  Central Pressure: <strong className="text-text-primary">{synopticImpact.nearestSystem.centralPressureHpa} hPa</strong>
                </span>
              </div>
              <p className="text-[11px] text-text-secondary leading-snug pt-0.5">
                {synopticImpact.localizedAdvisory}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mode 2: Official IMD INSAT-3D Geostationary Viewer with Location Reticle */}
      <div className={subMode === "imd_insat" ? "block space-y-3" : "hidden"}>
        {/* INSAT Product Selector */}
        <div className="flex space-x-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: "ctbt", label: "Cloud Top Temp (CTBT)" },
            { id: "ir1", label: "Thermal Infrared (IR1)" },
            { id: "vis", label: "Daylight Visible (VIS)" },
            { id: "wv", label: "Water Vapor (WV)" },
            { id: "ctbt_loop", label: "6-Hour Convective Loop" },
            { id: "ir1_loop", label: "6-Hour IR Loop" },
          ].map((prod) => (
            <button
              key={prod.id}
              onClick={() => setInsatProduct(prod.id as any)}
              className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                insatProduct === prod.id
                  ? "border-primary bg-primary-light text-primary font-medium"
                  : "border-border bg-surface text-text-secondary hover:text-text-primary"
              }`}
            >
              {prod.label}
            </button>
          ))}
        </div>

        {/* INSAT Image Container with Location Spotlight Reticle */}
        <div className="relative w-full bg-surface border border-border rounded-xl p-4 flex flex-col items-center justify-center min-h-[420px] shadow-sm">
          <div className="w-full flex items-center justify-between text-xs text-text-secondary mb-3 pb-2 border-b border-border">
            <span>
              IMD INSAT-3D / 3DR SATELLITE:{" "}
              <strong className="text-text-primary uppercase font-medium">
                {insatProduct.replace("_", " ").toUpperCase()} — ASIA SECTOR
              </strong>
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] bg-primary-light text-primary px-2 py-0.5 rounded font-medium">
                Target: {activeLocation.district}
              </span>
              <a
                href="https://mausam.imd.gov.in/responsive/satellite.php"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1"
              >
                IMD Portal ↗
              </a>
            </div>
          </div>

          <div className="relative max-w-full overflow-hidden rounded-lg bg-black/10 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={insatImgUrl}
              alt={`IMD INSAT-3D ${insatProduct}`}
              className="max-h-[500px] w-auto object-contain rounded shadow-sm"
              onError={(e) => {
                // Fallback to direct IMD URL if proxy fails
                const target = e.currentTarget;
                if (!target.src.includes("mausam.imd.gov.in")) {
                  target.src = `https://mausam.imd.gov.in/Satellite/3Dasiasec_${insatProduct.split("_")[0]}.jpg`;
                }
              }}
            />

            {/* Target Reticle pinpointing the user's selected district on the INSAT-3D Asia sector image */}
            <div
              className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300"
              style={{ left: `${targetXPct}%`, top: `${targetYPct}%` }}
            >
              <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping"></span>
              <span className="absolute inset-1.5 rounded-full border-2 border-emerald-400 shadow-md"></span>
              <span className="absolute inset-3 rounded-full bg-emerald-500 shadow-sm"></span>
              <div className="absolute left-9 top-0 bg-black/85 border border-emerald-500/60 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap shadow-lg">
                📍 {activeLocation.district} ({userLat.toFixed(1)}°N, {userLon.toFixed(1)}°E)
              </div>
            </div>

            {/* Depression Reticle on INSAT-3D Image */}
            <div
              className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${depXPct}%`, top: `${depYPct}%` }}
            >
              <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping"></span>
              <span className="absolute inset-1.5 rounded-full border-2 border-red-500 shadow-md"></span>
              <span className="absolute inset-3 rounded-full bg-red-600"></span>
              <div className="absolute left-9 top-0 bg-black/85 border border-red-500/60 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap shadow-lg">
                🌀 {depressionSystem.name} ({depressionSystem.centralPressureHpa} hPa)
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-text-secondary mt-3 pt-2 border-t border-border gap-1">
            <span>Satellite Source: INSAT-3D / INSAT-3DR Geostationary (82°E Orbit) · IMD MoES</span>
            <span>Update Frequency: Continuous 15-minute intervals</span>
          </div>
        </div>

        {/* CTBT / CTT Scale Explanation */}
        <div className="bg-surface border border-border rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-text-secondary border-b border-border pb-1.5">
            <span className="font-medium text-[10px] uppercase tracking-wider">
              Cloud Top Temperature (CTT) & Convection Scale
            </span>
            <span>IMD Meteorological Standard</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2 rounded bg-surface border border-border space-y-0.5">
              <div className="text-text-secondary text-[10px]">Warm / Shallow Clouds</div>
              <div className="font-medium text-text-primary">&gt; -40°C</div>
              <div className="text-[10px] text-text-secondary">Fair Weather / Low Stratus</div>
            </div>
            <div className="p-2 rounded bg-surface border border-border space-y-0.5">
              <div className="text-blue-600 text-[10px] font-medium">Moderate Convection</div>
              <div className="font-medium text-text-primary">-40°C to -60°C</div>
              <div className="text-[10px] text-text-secondary">Active Monsoon Showers</div>
            </div>
            <div className="p-2 rounded bg-surface border border-border space-y-0.5">
              <div className="text-amber-600 text-[10px] font-medium">Deep Convective Storms</div>
              <div className="font-medium text-text-primary">-60°C to -75°C</div>
              <div className="text-[10px] text-text-secondary">Depression Cloud Cores</div>
            </div>
            <div className="p-2 rounded bg-surface border border-border space-y-0.5">
              <div className="text-red-600 text-[10px] font-medium">Intense Overshooting Tops</div>
              <div className="font-medium text-text-primary">&lt; -75°C</div>
              <div className="text-[10px] text-text-secondary">Severe Thunderstorms / Squalls</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mode 3: Depressions & Synoptic Systems Tracker */}
      <div className={subMode === "depressions_tracker" ? "block space-y-4" : "hidden"}>
        {/* Local District Proximity & Advisory Card */}
        {synopticImpact && (
          <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                <span className="text-xs uppercase tracking-wider text-text-secondary font-medium">
                  Synoptic Impact on {activeLocation.district}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-800">
                {synopticImpact.impactLevel}
              </span>
            </div>

            <p className="text-sm text-text-primary leading-relaxed">
              {synopticImpact.localizedAdvisory}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border text-xs">
              <div>
                <span className="text-text-secondary block text-[10px]">Nearest Center:</span>
                <span className="font-medium text-text-primary">
                  {synopticImpact.distanceKm} km {synopticImpact.bearing}
                </span>
              </div>
              <div>
                <span className="text-text-secondary block text-[10px]">Associated System:</span>
                <span className="font-medium text-text-primary">{synopticImpact.nearestSystem.name}</span>
              </div>
              <div>
                <span className="text-text-secondary block text-[10px]">Central Pressure:</span>
                <span className="font-medium text-text-primary">
                  {synopticImpact.nearestSystem.centralPressureHpa} hPa
                </span>
              </div>
              <div>
                <span className="text-text-secondary block text-[10px]">Sustained Winds:</span>
                <span className="font-medium text-text-primary">
                  {synopticImpact.nearestSystem.maxSustainedWindKmph}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* All Active Synoptic Systems Across India */}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-text-secondary font-medium px-1">
            Active Tropical Depressions & Low Pressure Systems (Pan-India)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ACTIVE_SYNOPTIC_SYSTEMS.map((sys) => (
              <div
                key={sys.id}
                className="bg-surface border border-border rounded-xl p-4 space-y-3 shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">🌀</span>
                    <div>
                      <h3 className="text-sm font-medium text-text-primary">{sys.name}</h3>
                      <span className="text-[10px] text-text-secondary font-mono">{sys.categoryCode}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      sys.warningStatus === "Warning"
                        ? "bg-red-100 text-red-800"
                        : sys.warningStatus === "Alert"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {sys.warningStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-text-secondary block text-[10px]">Center:</span>
                    <span className="font-mono text-text-primary">
                      {sys.center[1]}°N, {sys.center[0]}°E
                    </span>
                  </div>
                  <div>
                    <span className="text-text-secondary block text-[10px]">Min Pressure:</span>
                    <span className="font-medium text-text-primary">{sys.centralPressureHpa} hPa</span>
                  </div>
                  <div>
                    <span className="text-text-secondary block text-[10px]">Movement:</span>
                    <span className="font-medium text-text-primary">
                      {sys.movement.direction} @ {sys.movement.speedKmph} km/h
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-text-secondary block text-[10px]">Peak Surface Winds:</span>
                    <span className="font-medium text-text-primary">{sys.maxSustainedWindKmph}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-text-secondary block text-[10px]">Cloud Top Temp:</span>
                    <span className="font-medium text-text-primary">{sys.cloudTopTemp}</span>
                  </div>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed bg-bg/50 p-2.5 rounded-lg border border-border/60">
                  {sys.advisoryText}
                </p>

                {sys.forecastTrack && sys.forecastTrack.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">
                      Forecasted Track Progression
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-[10px]">
                      {sys.forecastTrack.map((trk, i) => (
                        <div key={i} className="p-1.5 rounded bg-surface border border-border">
                          <div className="text-text-secondary">{trk.time}</div>
                          <div className="font-mono font-medium text-text-primary">
                            {trk.center[1]}°N, {trk.center[0]}°E
                          </div>
                          <div className="text-[9px] text-primary">{trk.category}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
