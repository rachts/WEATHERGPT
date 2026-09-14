// WeatherGPT — Strict Weather Metrics & Semantic Interfaces
// Ensures unambiguous meteorological variable separation and provenance.

import { DataProvenance, DataQuality } from "./provenance";

export interface MetricValue<T = number> {
  value: T | null;
  unit: string;
  timestamp?: string | null;
  quality: DataQuality;
  source: string;
}

export interface WeatherCoordinates {
  latitude: number;
  longitude: number;
}

export interface DailyForecastMetric {
  day: string;
  date: string; // ISO date string (YYYY-MM-DD)
  condition: string;
  tempMin: number | null;
  tempMax: number | null;
  rainfallMm: number | null;
  pop: number | null; // Probability of precipitation (0-100%)
  provenance: DataProvenance;
}

export interface ComputedForecastSummary {
  rainyDays: number;
  dryDays: number;
  maxRainfallMm: number;
  minTemperatureC: number | null;
  maxTemperatureC: number | null;
  strongestWindKmh: number | null;
  forecastConfidence: "HIGH" | "MODERATE" | "LOW";
  narrativeSummary: string;
}

export interface RadarProductInfo {
  station: string;
  stationCode?: string;
  scanTime: string | null;
  summary: string;
  status: "LIVE" | "CACHED" | "DEMO" | "UNAVAILABLE";
  reflectivityBands: Array<{
    band: string;
    range: string;
    color: string;
  }>;
  provenance: DataProvenance;
}

export interface NormalizedWeather {
  district: string;
  state: string;
  districtCode?: string;
  coordinates: WeatherCoordinates;
  provenance: DataProvenance;
  sourceProduct: string; // Backward compatibility with UI
  issueTime: string;      // Backward compatibility with UI
  validUntil: string;
  isCachedFallback: boolean;
  current: {
    temperature: number | null;
    tempUnit: string;
    humidity: number | null;
    humidityUnit: string;
    windSpeed: number | null;
    windDirection: string; // 16-point cardinal e.g. "SW", "Calm", "N"
    windDirectionDegrees?: number | null;
    windUnit: string;
    condition: string;
    // Strict semantic rainfall metrics
    currentPrecipitationMm?: number | null;
    rainfallLast24h: number | null; // backward compatibility
    rainfallLast24hMm?: number | null;
    forecastRainfallNext24hMm?: number | null;
    rainUnit: string;
    pressure?: number | null;
    cloudCover?: number | null;
  };
  forecastDaily: DailyForecastMetric[];
  forecastSummary?: ComputedForecastSummary;
  radarNowcast: RadarProductInfo;
}
