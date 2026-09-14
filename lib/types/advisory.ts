// WeatherGPT — Agricultural Advisory & Rules Interfaces
// Fully deterministic, versioned, and evidence-backed definitions.

import { Evidence } from "./provenance";

export interface AdvisoryRule {
  id: string;
  version: string;
  crop: string;
  growthStage?: string;
  condition: {
    maxWindSpeedKmh?: number;
    maxRainfallNext24hMm?: number;
    maxHumidityPct?: number;
    minHumidityPct?: number;
    minTempC?: number;
    maxTempC?: number;
  };
  severity: "SAFE" | "CAUTION" | "UNSAFE";
  action: string;
  actionHi?: string;
  actionTa?: string;
  chemicalGuidanceDisclaimer: string;
  source: Evidence;
}

export interface CropAdvisoryResult {
  crop: string;
  district: string;
  state?: string;
  timeWindow: string;
  sprayCondition: "SAFE" | "UNSAFE" | "CAUTION";
  sprayAdvisory: string;
  irrigationAdvisory: string;
  pestDiseaseAdvisory: string;
  actionSummary: string;
  sourceRule: string;
  chemicalDisclaimer: string;
  issueTime: string | null;
  isDeterministic: true;
  appliedRules?: AdvisoryRule[];
  evidence?: Evidence;
  disclaimer?: string;
}
