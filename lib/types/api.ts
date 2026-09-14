// WeatherGPT — Standard API Response Envelope & Error Codes

import { DataProvenance } from "./provenance";

export interface ApiMeta {
  requestId: string;
  provenance?: DataProvenance[];
  generatedAt: string;
  isCached?: boolean;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: Record<string, string[]>;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export const API_ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNKNOWN_DISTRICT: "UNKNOWN_DISTRICT",
  WEATHER_PROVIDER_UNAVAILABLE: "WEATHER_PROVIDER_UNAVAILABLE",
  ALERTS_UNAVAILABLE: "ALERTS_UNAVAILABLE",
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  TIMEOUT: "TIMEOUT",
} as const;
