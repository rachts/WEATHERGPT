// WeatherGPT — Runtime Environment Configuration & Mode Management

export type AppMode = "production" | "demo" | "development" | "test";

export interface AppConfig {
  mode: AppMode;
  isProduction: boolean;
  isDemo: boolean;
  isTest: boolean;
  allowSimulatedFailures: boolean;
  allowSampleDataFallbacks: boolean;
  alertIngestionToken?: string;
  databaseUrl?: string;
  upstashRedisUrl?: string;
  upstashRedisToken?: string;
}

export function resolveAppMode(): AppMode {
  const envMode = process.env.WEATHERGPT_MODE?.toLowerCase();
  if (envMode === "production" || envMode === "demo" || envMode === "development" || envMode === "test") {
    return envMode;
  }
  if (process.env.NODE_ENV === "production") {
    return "production";
  }
  if (process.env.NODE_ENV === "test") {
    return "test";
  }
  return "development";
}

export function isProduction(): boolean {
  return resolveAppMode() === "production";
}

export function isDemo(): boolean {
  return resolveAppMode() === "demo";
}

export function isTest(): boolean {
  return resolveAppMode() === "test";
}

export function getEnvironmentConfig(): AppConfig {
  const mode = resolveAppMode();
  return {
    mode,
    isProduction: mode === "production",
    isDemo: mode === "demo",
    isTest: mode === "test",
    allowSimulatedFailures: mode !== "production",
    allowSampleDataFallbacks: mode === "demo",
    alertIngestionToken: process.env.ALERT_INGESTION_TOKEN,
    databaseUrl: process.env.DATABASE_URL,
    upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
}

export const APP_CONFIG: AppConfig = getEnvironmentConfig();
