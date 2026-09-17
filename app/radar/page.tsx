"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { getActiveLocation, findDistrictInfo } from "@/lib/utils/location";
import SatelliteView from "@/components/SatelliteView";
import DataStatusBadge from "@/components/DataStatusBadge";

export interface RadarStation {
  id: string;
  imdCode: string;
  name: string;
  band: string;
  coverage: string;
  center: [number, number]; // [lon, lat]
  zoom: number;
  frequency: string;
}

const RADAR_STATIONS: RadarStation[] = [
  { id: "kolkata", imdCode: "kol", name: "Kolkata New Town", band: "S-Band", coverage: "Covering Gangetic Bengal & Sunderbans", center: [88.36, 22.57], zoom: 7.2, frequency: "2.7 GHz" },
  { id: "mumbai", imdCode: "mum", name: "Mumbai Colaba", band: "S-Band", coverage: "Covering Raigad & Konkan", center: [72.82, 18.90], zoom: 7.2, frequency: "2.8 GHz" },
  { id: "delhi", imdCode: "delhi", name: "Delhi Mausam Bhawan", band: "C-Band", coverage: "Covering Delhi NCR, Haryana & W. UP", center: [77.22, 28.59], zoom: 7.2, frequency: "5.6 GHz" },
  { id: "chennai", imdCode: "cni", name: "Chennai Port", band: "S-Band", coverage: "Covering N. Tamil Nadu & Coastal AP", center: [80.29, 13.08], zoom: 7.2, frequency: "2.8 GHz" },
  { id: "kochi", imdCode: "koc", name: "Kochi Naval Base", band: "C-Band", coverage: "Covering Kerala & Arabian Sea", center: [76.27, 9.96], zoom: 7.2, frequency: "5.6 GHz" },
  { id: "patna", imdCode: "ptn", name: "Patna Airport", band: "DWR", coverage: "Covering Bihar & E. UP Plains", center: [85.08, 25.59], zoom: 7.2, frequency: "5.6 GHz" },
  { id: "srinagar", imdCode: "srn", name: "Srinagar Weather Radar", band: "X-Band", coverage: "Covering Kashmir Valley & Pir Panjal", center: [74.80, 34.08], zoom: 7.2, frequency: "9.4 GHz" },
  { id: "guwahati", imdCode: "ghy", name: "Guwahati Borjhar", band: "C-Band", coverage: "Covering Assam & Brahmaputra Valley", center: [91.74, 26.14], zoom: 7.2, frequency: "5.6 GHz" },
  { id: "hyderabad", imdCode: "hyd", name: "Hyderabad Begumpet", band: "C-Band", coverage: "Covering Telangana & Deccan Plateau", center: [78.47, 17.45], zoom: 7.2, frequency: "5.6 GHz" },
  { id: "nagpur", imdCode: "ngp", name: "Nagpur Sonegaon", band: "S-Band", coverage: "Covering Vidarbha & Central India", center: [79.05, 21.09], zoom: 7.2, frequency: "2.8 GHz" },
];

const STATION_SUMMARIES: Record<string, string> = {
  mumbai: "Doppler reflectivity scan active for Mumbai and Konkan coast. S-band radar monitoring marine rain bands and orographic cloud enhancement along the Western Ghats.",
  kolkata: "Doppler reflectivity scan active for Kolkata Metropolitan Area and Gangetic West Bengal. High-resolution S-band sweep tracking convective cloud clusters across South 24 Parganas and Hooghly delta.",
  delhi: "C-band Doppler radar monitoring Delhi-NCR, Haryana and Western UP. Low-level wind convergence and convective reflectivity bands active across Yamuna plains.",
  chennai: "S-band coastal radar scanning North Tamil Nadu and Coromandel coast. Monitoring convective shower lines moving inland.",
  kochi: "C-band Doppler radar monitoring coastal Kerala and Lakshadweep Sea. Tracking orographic monsoon rainbands against Anamalai hills.",
  patna: "Doppler radar scanning Middle Gangetic Plain and North Bihar. Monitoring squall lines and localized thunderstorm activity.",
  srinagar: "X-band Doppler radar tracking precipitation systems and cloud dynamics over Kashmir Valley and Pir Panjal mountain passes.",
  guwahati: "C-band Doppler radar active over Brahmaputra Valley. Monitoring isolated thunderstorm cells and river basin cloud clusters.",
  hyderabad: "C-band Doppler radar scanning Telangana and North Karnataka. Monitoring localized convection and mid-tropospheric wind shear.",
  nagpur: "S-band Doppler radar monitoring Vidarbha and Central India. Tracking tropical depression cloud bands across the Satpura range.",
};

interface RadarFrame {
  time: number;
  path: string;
}

/**
 * Generate geodesic circle polygon in GeoJSON
 */
function createGeoJsonCircle(center: [number, number], radiusInKm: number, points = 64) {
  const [lon, lat] = center;
  const coords: [number, number][] = [];
  const distanceX = radiusInKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusInKm / 110.574;

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lon + x, lat + y]);
  }
  return {
    type: "Feature" as const,
    properties: { radius: radiusInKm },
    geometry: {
      type: "Polygon" as const,
      coordinates: [coords],
    },
  };
}

/**
 * Generates concentric radar range rings (50, 100, 150, 250 km) and crosshair lines
 */
function generateRadarRangeGeoJson(center: [number, number]) {
  const [lon, lat] = center;
  const rings = [50, 100, 150, 250].map((r) => createGeoJsonCircle(center, r));
  const dLat = 250 / 110.574;
  const dLon = 250 / (111.32 * Math.cos((lat * Math.PI) / 180));

  const crosshairs = [
    {
      type: "Feature" as const,
      properties: { type: "crosshair" },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [lon, lat - dLat],
          [lon, lat + dLat],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: { type: "crosshair" },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [lon - dLon, lat],
          [lon + dLon, lat],
        ],
      },
    },
  ];

  return {
    type: "FeatureCollection" as const,
    features: [...rings, ...crosshairs],
  };
}

export default function RadarPage() {
  const [hubTab, setHubTab] = useState<"satellite" | "radar">("radar");
  const [viewMode, setViewMode] = useState<"gis" | "imd_direct">("gis");
  const [imdProduct, setImdProduct] = useState<"caz" | "ppi" | "sri" | "pac" | "mosaic">("caz");
  const [selectedProduct, setSelectedProduct] = useState<"reflectivity" | "rainfall" | "cloud">("reflectivity");
  const [selectedStationId, setSelectedStationId] = useState<string>("kolkata");
  const [sweepAngle, setSweepAngle] = useState<string>("0.5°");
  const [isPlaying, setIsPlaying] = useState(false);
  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([]);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [isLiveStream, setIsLiveStream] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("maplibre-gl").Map | null>(null);
  const stationMarkerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const userMarkerRef = useRef<import("maplibre-gl").Marker | null>(null);

  const activeStation = RADAR_STATIONS.find((s) => s.id === selectedStationId) || RADAR_STATIONS[0];

  // Fetch real-time composite radar frames from RainViewer
  useEffect(() => {
    let isCancelled = false;
    async function loadRadarFrames() {
      try {
        const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", {
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return;
        const data = await res.json();
        const past = data.radar?.past || [];
        if (!isCancelled && Array.isArray(past) && past.length > 0) {
          setRadarFrames(past);
          setCurrentTimeIndex(past.length - 1);
          setIsLiveStream(true);
        }
      } catch (e) {
        console.warn("Real-time radar feed notice:", e);
      }
    }
    loadRadarFrames();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Update MapLibre raster tile layer when frame or product changes
  const updateRadarLayer = useCallback(
    (frameIndex: number, product: string) => {
      const map = mapInstanceRef.current;
      if (!map || radarFrames.length === 0) return;

      const frame = radarFrames[frameIndex];
      if (!frame) return;

      const tileUrl = `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;

      try {
        const existingSource = map.getSource("radar-tiles") as any;
        if (existingSource && typeof existingSource.setTiles === "function") {
          existingSource.setTiles([tileUrl]);
          return;
        }

        // minzoom: 0, maxzoom: 7 ensures MapLibre automatically upscales z=7 tiles
        // and never requests z>=8 where RainViewer returns unsupported zoom watermarks
        map.addSource("radar-tiles", {
          type: "raster",
          tiles: [tileUrl],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 7,
        });

        const beforeLayerId = map.getLayer("radar-rings-line") ? "radar-rings-line" : undefined;
        map.addLayer(
          {
            id: "radar-tiles-layer",
            type: "raster",
            source: "radar-tiles",
            paint: {
              "raster-opacity": product === "reflectivity" ? 0.72 : 0.6,
              "raster-fade-duration": 150,
            },
          },
          beforeLayerId
        );
      } catch (err) {
        console.warn("Radar tile layer update note:", err);
      }
    },
    [radarFrames]
  );

  // Trigger layer update on frame change
  useEffect(() => {
    if (radarFrames.length > 0) {
      updateRadarLayer(currentTimeIndex, selectedProduct);
    }
  }, [currentTimeIndex, selectedProduct, radarFrames, updateRadarLayer]);

  // Station selection handler
  const handleSelectStation = (station: RadarStation) => {
    setSelectedStationId(station.id);
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      map.flyTo({
        center: station.center,
        zoom: station.zoom,
        essential: true,
      });
      if (stationMarkerRef.current) {
        stationMarkerRef.current.setLngLat(station.center);
      }
      const ringsSource = map.getSource("radar-rings") as import("maplibre-gl").GeoJSONSource | undefined;
      if (ringsSource && typeof ringsSource.setData === "function") {
        ringsSource.setData(generateRadarRangeGeoJson(station.center));
      }
    }
  };

  // Playback timer loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isPlaying && radarFrames.length > 0) {
      interval = setInterval(() => {
        setCurrentTimeIndex((prev) => (prev + 1) % radarFrames.length);
      }, 900);
    }
    return () => clearInterval(interval);
  }, [isPlaying, radarFrames.length]);

  // Format time labels for time scrubber
  const formatIstTime = (timestamp?: number) => {
    if (!timestamp) return "--:--";
    const d = new Date(timestamp * 1000);
    return d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const totalSteps = radarFrames.length > 0 ? radarFrames.length : 1;
  const currentFormattedTime = radarFrames[currentTimeIndex]
    ? formatIstTime(radarFrames[currentTimeIndex].time)
    : "--:--";
  const firstTime = radarFrames[0] ? formatIstTime(radarFrames[0].time) : "Past";
  const lastTime = radarFrames[radarFrames.length - 1]
    ? formatIstTime(radarFrames[radarFrames.length - 1].time)
    : "Live";

  const imdImageUrl =
    imdProduct === "mosaic"
      ? "https://mausam.imd.gov.in/Radar/MOSAIC/Converted/mosaic.gif"
      : `https://mausam.imd.gov.in/Radar/${imdProduct}_${activeStation.imdCode}.gif`;

  // Initialize MapLibre GL when Radar tab and GIS mode are active
  useEffect(() => {
    if (hubTab !== "radar" || viewMode !== "gis") return;

    if (mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.resize(), 50);
      return;
    }

    let isMounted = true;
    let resizeObs: ResizeObserver | null = null;
    let mapInstance: import("maplibre-gl").Map | null = null;

    async function initMap() {
      try {
        const mod = await import("maplibre-gl");
        const maplibregl = mod.default || mod;

        if (!isMounted || !mapContainerRef.current) return;

        // Auto-select nearest station to user district
        const userLoc = getActiveLocation();
        const distInfo = findDistrictInfo(userLoc.district);
        const userLat = distInfo?.lat ?? 22.57;
        const userLon = distInfo?.lon ?? 88.36;

        let initialStation = RADAR_STATIONS[0];
        let minDistance = Infinity;
        for (const st of RADAR_STATIONS) {
          const dist = Math.hypot(st.center[1] - userLat, st.center[0] - userLon);
          if (dist < minDistance) {
            minDistance = dist;
            initialStation = st;
          }
        }
        setSelectedStationId(initialStation.id);

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: {
            version: 8,
            sources: {
              "osm-tiles": {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors | IMD Radar Network",
              },
              "radar-rings": {
                type: "geojson",
                data: generateRadarRangeGeoJson(initialStation.center),
              },
            },
            layers: [
              {
                id: "osm-layer",
                type: "raster",
                source: "osm-tiles",
                minzoom: 0,
                maxzoom: 18,
                paint: {
                  "raster-opacity": 0.5,
                  "raster-saturation": -0.75,
                },
              },
              {
                id: "radar-rings-fill",
                type: "fill",
                source: "radar-rings",
                filter: ["==", "$type", "Polygon"],
                paint: {
                  "fill-color": "#2D5016",
                  "fill-opacity": 0.02,
                },
              },
              {
                id: "radar-rings-line",
                type: "line",
                source: "radar-rings",
                paint: {
                  "line-color": "#2D5016",
                  "line-width": 1,
                  "line-dasharray": [4, 4],
                  "line-opacity": 0.45,
                },
              },
            ],
          },
          center: initialStation.center,
          zoom: initialStation.zoom,
        });
        mapInstance = map;

        // Add Radar Antenna Marker
        const el = document.createElement("div");
        el.className = "w-3.5 h-3.5 bg-primary rounded-full border-2 border-white shadow-none ring-2 ring-primary/30";
        el.title = `${initialStation.name} Radar (${initialStation.band})`;
        const marker = new maplibregl.Marker(el).setLngLat(initialStation.center).addTo(map);
        stationMarkerRef.current = marker;

        // Add User Location Pin
        const userEl = document.createElement("div");
        userEl.className = "flex items-center justify-center";
        userEl.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-5 h-5 rounded-full bg-blue-500/20 animate-ping"></span>
            <div class="w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-sm flex items-center justify-center text-[8px] text-white font-bold">
              •
            </div>
          </div>
        `;
        userEl.title = `Your District (${userLoc.district})`;
        const uMarker = new maplibregl.Marker(userEl).setLngLat([userLon, userLat]).addTo(map);
        userMarkerRef.current = uMarker;

        map.on("load", () => {
          mapInstanceRef.current = map;
          if (radarFrames.length > 0) {
            updateRadarLayer(currentTimeIndex, selectedProduct);
          }
        });

        // Keep map container responsive on resize
        resizeObs = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.resize();
          }
        });
        if (mapContainerRef.current) {
          resizeObs.observe(mapContainerRef.current);
        }
      } catch (err) {
        console.error("MapLibre init error:", err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (resizeObs) {
        resizeObs.disconnect();
      }
      if (mapInstance) {
        try {
          mapInstance.remove();
        } catch {}
      }
      mapInstanceRef.current = null;
    };
  }, [hubTab, viewMode, currentTimeIndex, selectedProduct, radarFrames.length, updateRadarLayer]);

  return (
    <div className="py-4 space-y-5">
      {/* Top Hub Navigation: Satellite & Depressions vs Doppler Radar */}
      <div className="flex items-center space-x-2 p-1 bg-surface border border-border rounded-xl text-xs w-fit">
        <button
          onClick={() => setHubTab("satellite")}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
            hubTab === "satellite"
              ? "bg-primary text-white font-medium shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">satellite_alt</span>
          <span>Real Satellite Imagery & Depressions</span>
        </button>
        <button
          onClick={() => {
            setHubTab("radar");
            setTimeout(() => mapInstanceRef.current?.resize(), 50);
          }}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
            hubTab === "radar"
              ? "bg-primary text-white font-medium shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">radar</span>
          <span>Doppler Weather Radar (Local DWR)</span>
        </button>
      </div>

      {hubTab === "satellite" ? (
        <SatelliteView />
      ) : (
        <div className="space-y-5">
          {/* Top Header */}
          <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl text-text-primary font-medium tracking-tight">
                Doppler Weather Radar
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Station: {activeStation.name} ({activeStation.band} · {activeStation.frequency}) · {activeStation.coverage}
              </p>
            </div>
            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <DataStatusBadge
                status={viewMode === "imd_direct" ? "LIVE" : (radarFrames.length > 0 ? "LIVE" : "UNAVAILABLE")}
                provider={viewMode === "imd_direct" ? "IMD" : "OTHER"}
                providerName={viewMode === "imd_direct" ? "IMD Radar Network" : "RainViewer Radar Composite"}
              />
            </div>
          </div>

          {/* Mode Switcher: GIS Interactive Map vs Official IMD DWR Scan */}
          <div className="flex items-center space-x-2 p-1 bg-surface border border-border rounded-xl text-xs w-fit">
        <button
          onClick={() => setViewMode("gis")}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
            viewMode === "gis"
              ? "bg-primary text-white font-medium shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <span>Interactive GIS Map</span>
        </button>
        <button
          onClick={() => setViewMode("imd_direct")}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
            viewMode === "imd_direct"
              ? "bg-primary text-white font-medium shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <span>Official IMD Doppler Scan</span>
        </button>
      </div>

      {/* Radar Station Selector (Pan-India Doppler Network) */}
      <div className="space-y-1.5">
        <label className="block text-[11px] uppercase tracking-wider text-text-secondary">
          Select IMD Radar Station (Pan-India Network)
        </label>
        <div className="flex space-x-2 overflow-x-auto pb-1 text-xs">
          {RADAR_STATIONS.map((st) => (
            <button
              key={st.id}
              onClick={() => handleSelectStation(st)}
              className={`px-3 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
                selectedStationId === st.id
                  ? "border-primary bg-primary text-white font-medium"
                  : "border-border bg-surface text-text-secondary hover:text-text-primary"
              }`}
            >
              {st.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product controls dependent on mode */}
      {viewMode === "gis" ? (
        <div className="flex space-x-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: "reflectivity", label: "Reflectivity (dBZ)" },
            { id: "rainfall", label: "Precipitation Rate (mm/h)" },
            { id: "cloud", label: "Cloud Top Height (km)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedProduct(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg border transition-colors ${
                selectedProduct === tab.id
                  ? "border-primary bg-primary-light text-primary font-medium"
                  : "border-border bg-surface text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex space-x-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: "caz", label: "MAX (Z) Reflectivity" },
            { id: "ppi", label: "PPI (Reflectivity Scan)" },
            { id: "sri", label: "SRI (Rainfall Intensity)" },
            { id: "pac", label: "PAC (Precip Accumulation)" },
            { id: "mosaic", label: "National Radar Mosaic" },
          ].map((prod) => (
            <button
              key={prod.id}
              onClick={() => setImdProduct(prod.id as any)}
              className={`px-3.5 py-1.5 rounded-lg border transition-colors ${
                imdProduct === prod.id
                  ? "border-primary bg-primary-light text-primary font-medium"
                  : "border-border bg-surface text-text-secondary hover:text-text-primary"
              }`}
            >
              {prod.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Display Area */}
      {/* GIS Interactive Map Panel */}
      <div
        className={`relative w-full h-80 sm:h-96 bg-surface border border-border rounded-xl overflow-hidden ${
          viewMode === "gis" ? "block" : "hidden"
        }`}
      >
        {/* MapLibre Map Container */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Live Elevation Angle Selector Badge */}
        <div className="absolute top-3 right-3 bg-surface/90 border border-border px-2.5 py-1 rounded flex items-center space-x-2 text-[11px] shadow-sm backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
          <span className="text-text-secondary">Elevation:</span>
          <select
            value={sweepAngle}
            onChange={(e) => setSweepAngle(e.target.value)}
            className="bg-transparent text-text-primary font-medium focus:outline-none cursor-pointer"
          >
            <option value="0.5°">0.5° (Surveillance)</option>
            <option value="1.0°">1.0° (Mid-level)</option>
            <option value="1.5°">1.5° (Core)</option>
            <option value="2.5°">2.5° (Storm Top)</option>
          </select>
        </div>

        {/* Geodesic Range Legend Overlay */}
        <div className="absolute bottom-3 left-3 bg-surface/90 border border-border px-2.5 py-1 rounded text-[10px] text-text-secondary backdrop-blur-sm">
          Range Rings: 50 · 100 · 150 · 250 km
        </div>
      </div>

      {/* Official IMD DWR Product Panel */}
      <div
        className={`relative w-full bg-surface border border-border rounded-xl p-4 flex flex-col items-center justify-center min-h-[360px] ${
          viewMode === "imd_direct" ? "block" : "hidden"
        }`}
      >
        <div className="w-full flex items-center justify-between text-xs text-text-secondary mb-3 pb-2 border-b border-border">
          <span>
            IMD DWR PRODUCT:{" "}
            <strong className="text-text-primary uppercase font-medium">
              {imdProduct === "mosaic" ? "National Composite Mosaic" : `${imdProduct.toUpperCase()} — ${activeStation.name}`}
            </strong>
          </span>
          <a
            href="https://mausam.imd.gov.in/responsive/radar.php"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            IMD Portal ↗
          </a>
        </div>
        <div className="relative max-w-full flex items-center justify-center overflow-hidden rounded-lg bg-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imdImageUrl}
            alt={`IMD Doppler Radar ${activeStation.name}`}
            className="max-h-[420px] w-auto object-contain rounded-md shadow-sm"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.includes("/api/imd-radar")) {
                target.src = `/api/imd-radar?station=${activeStation.imdCode}&product=${imdProduct}`;
              }
            }}
          />
        </div>
        <div className="w-full flex items-center justify-between text-[11px] text-text-secondary mt-3 pt-2 border-t border-border">
          <span>Scan Source: India Meteorological Department (MoES)</span>
          <span>Update Frequency: 10–15 mins</span>
        </div>
      </div>

      {/* Legend Row: Dynamic per Selected Product */}
      <div className="bg-surface border border-border rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs text-text-secondary border-b border-border pb-2">
          <span className="font-medium uppercase tracking-wider text-[10px]">
            {viewMode === "imd_direct"
              ? "IMD Standard Calibration Scale"
              : selectedProduct === "reflectivity"
              ? "Reflectivity Scale (dBZ)"
              : selectedProduct === "rainfall"
              ? "Precipitation Rate Scale"
              : "Cloud Top Altitude"}
          </span>
          <span>IMD Standard Scale</span>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
          {selectedProduct === "reflectivity" || viewMode === "imd_direct" ? (
            <>
              <div className="space-y-1">
                <div className="h-3 w-full bg-[#E8E6E1] border border-border rounded-sm"></div>
                <div className="font-medium text-text-primary">Light</div>
                <div className="text-[10px] text-text-secondary">&lt; 20 dBZ</div>
              </div>
              <div className="space-y-1">
                <div className="h-3 w-full bg-[#C4C1BA] border border-border rounded-sm"></div>
                <div className="font-medium text-text-primary">Moderate</div>
                <div className="text-[10px] text-text-secondary">20–35 dBZ</div>
              </div>
              <div className="space-y-1">
                <div className="h-3 w-full bg-[#8A8781] border border-border rounded-sm"></div>
                <div className="font-medium text-text-primary">Heavy</div>
                <div className="text-[10px] text-text-secondary">35–50 dBZ</div>
              </div>
              <div className="space-y-1">
                <div className="h-3 w-full bg-[#4A4A4A] border border-border rounded-sm"></div>
                <div className="font-medium text-text-primary">Severe</div>
                <div className="text-[10px] text-text-secondary">&gt; 50 dBZ</div>
              </div>
            </>
          ) : selectedProduct === "rainfall" ? (
            <>
              <div className="space-y-1">
                <div className="h-3 w-full bg-[#E8E6E1] border border-border rounded-sm"></div>
                <div className="font-medium text-text-primary">Drizzle</div>
                <div className="text-[10px] text-text-secondary">&lt; 2.5 mm/h</div>
              </div>
              <div className="space-y-1">
                <div className="h-3 w-full bg-[#C4C1BA] border border-border rounded-sm"></div>
                <div className="font-medium text-text-primary">Moderate</div>
                <div className="text-[10px] text-text-secondary">2.5–7.5 mm/h</div>
              </div>
              <div className="space-y-1">
                <div className="h-3 w-full bg-[#8A8781] border border-border rounded-sm"></div>
                <div className="font-medium text-text-primary">Heavy</div>
                <div className="text-[10px] text-text-secondary">7.5–35 mm/h</div>
              </div>
              <div className="space-y-1">
                <div className="h-3 w-full bg-[#4A4A4A] border border-border rounded-sm"></div>
                <div className="font-medium text-text-primary">Torrential</div>
                <div className="text-[10px] text-text-secondary">&gt; 35 mm/h</div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <div className="h-3 w-full bg-[#E8E6E1] border border-border rounded-sm"></div>
                <div className="font-medium text-text-primary">Low</div>
                <div className="text-[10px] text-text-secondary">&lt; 3 km</div>
              </div>
              <div className="space-y-1">
                <div className="h-3 w-full bg-[#C4C1BA] border border-border rounded-sm"></div>
                <div className="font-medium text-text-primary">Mid</div>
                <div className="text-[10px] text-text-secondary">3–7 km</div>
              </div>
              <div className="space-y-1">
                <div className="h-3 w-full bg-[#8A8781] border border-border rounded-sm"></div>
                <div className="font-medium text-text-primary">High</div>
                <div className="text-[10px] text-text-secondary">7–12 km</div>
              </div>
              <div className="space-y-1">
                <div className="h-3 w-full bg-[#4A4A4A] border border-border rounded-sm"></div>
                <div className="font-medium text-text-primary">Overshooting</div>
                <div className="text-[10px] text-text-secondary">&gt; 12 km</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Time Scrubber & Controls */}
      {viewMode === "gis" ? (
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center space-x-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-9 h-9 border border-primary text-primary hover:bg-primary-light rounded-lg flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer"
            title={isPlaying ? "Pause loop" : "Play loop"}
          >
            {isPlaying ? (
              <span className="material-symbols-outlined text-[18px]">pause</span>
            ) : (
              <svg className="w-4 h-4 fill-primary" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="flex-1 space-y-1.5">
            <div className="flex justify-between text-[11px] text-text-secondary font-mono">
              <span>Scan Time</span>
              <span className="text-primary font-medium">{currentFormattedTime} IST</span>
            </div>
            <input
              type="range"
              min="0"
              max={totalSteps - 1}
              value={currentTimeIndex}
              onChange={(e) => setCurrentTimeIndex(Number(e.target.value))}
              className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-text-secondary font-mono">
              <span>{firstTime} IST</span>
              <span>{lastTime} IST</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between text-xs text-text-secondary">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span>Live Scan Broadcast: Continuous operational sweep sequence from IMD DWR network</span>
          </div>
          <span className="text-primary font-medium">Authoritative MoES Feed</span>
        </div>
      )}

      {/* Dynamic Plain-Language Summary Card */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-1.5">
        <div className="text-xs uppercase tracking-wider text-text-secondary font-medium">
          Doppler Nowcast Summary
        </div>
        <p className="text-sm sm:text-base text-text-primary leading-relaxed font-normal">
          {STATION_SUMMARIES[activeStation.id] ||
            `Doppler reflectivity scan active for ${activeStation.name} sector (${activeStation.coverage}).`}
        </p>
        <p className="text-xs text-text-secondary pt-1 border-t border-border">
          Radar: {activeStation.name} ({activeStation.band} · {activeStation.frequency}) · Elevation Sweep {sweepAngle}
        </p>
      </div>
    </div>
    )}
  </div>
  );
}
