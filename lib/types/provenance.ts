// WeatherGPT — Data Provenance & Evidence System
// Enforces first-class source tracking, data quality classifications, and auditability.

export type DataQuality =
  | "OBSERVED"
  | "FORECAST"
  | "ESTIMATED"
  | "CACHED"
  | "FALLBACK"
  | "DEMO"
  | "UNAVAILABLE";

export type Provider =
  | "IMD"
  | "OPEN_METEO"
  | "NASA"
  | "OTHER"
  | "CACHE"
  | "DEMO";

export interface DataProvenance {
  provider: Provider;
  providerName: string;
  sourceUrl?: string;
  sourceProduct?: string;
  sourceId?: string;
  issuedAt?: string | null;
  observedAt?: string | null;
  retrievedAt: string;
  validFrom?: string | null;
  validUntil?: string | null;
  quality: DataQuality;
  isOfficial: boolean;
  isFallback: boolean;
}

export interface Evidence {
  sourceId: string;
  provider: Provider;
  providerName?: string;
  product: string;
  sourceUrl?: string;
  issuedAt?: string | null;
  retrievedAt: string;
  validFrom?: string | null;
  validUntil?: string | null;
  rawRecordHash?: string;
  quality?: DataQuality;
}
