// WeatherGPT — Meteorological Provider Abstraction Layer

import { DataProvenance } from "../types/provenance";
import { DailyForecastMetric, RadarProductInfo } from "../types/weather";
import { IMDWarningProduct } from "../services/alerts";

export interface WeatherObservationResult {
  temperatureC: number | null;
  humidityPct: number | null;
  windSpeedKmh: number | null;
  windDirectionCardinal: string;
  windDirectionDegrees: number | null;
  rainfallLast24hMm: number | null;
  pressureHpa: number | null;
  condition: string;
  observedAt: string | null;
  provenance: DataProvenance;
}

export interface ForecastResult {
  daily: DailyForecastMetric[];
  forecastRainfallNext24hMm: number;
  provenance: DataProvenance;
}

export interface WarningResult {
  alerts: IMDWarningProduct[];
  provenance: DataProvenance;
}

export interface WeatherObservationProvider {
  readonly id: string;
  readonly name: string;
  readonly isOfficial: boolean;
  getObservation(
    lat: number,
    lon: number,
    districtName: string,
    stateName: string
  ): Promise<WeatherObservationResult | null>;
}

export interface ForecastProvider {
  readonly id: string;
  readonly name: string;
  readonly isOfficial: boolean;
  getForecast(
    lat: number,
    lon: number,
    districtName: string,
    stateName: string
  ): Promise<ForecastResult | null>;
}

export interface WarningProvider {
  readonly id: string;
  readonly name: string;
  readonly isOfficial: boolean;
  getWarnings(district: string, state?: string): Promise<WarningResult | null>;
}

export interface RadarProvider {
  readonly id: string;
  readonly name: string;
  getRadarStatus(stationCode: string): Promise<RadarProductInfo>;
}
