// WeatherGPT — Runtime Environment Configuration & Mode Management
// Validates environment variables at startup and provides typed application configuration.

import { z } from "zod";
import { logger } from "@/lib/utils/logger";

export type AppMode = "production" | "demo" | "development" | "test";

export const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  WEATHERGPT_MODE: z.enum(["production", "demo", "development", "test"]).optional(),
  ALERT_INGESTION_TOKEN: z
    .string()
    .min(16, "ALERT_INGESTION_TOKEN should be at least 16 characters long for security.")
    .optional(),
  DATABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal("")),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().or(z.literal("")),
  DATA_GOV_IN_API_KEY: z.string().optional().or(z.literal("")),
});

export type ValidatedEnvironment = z.infer<typeof environmentSchema>;

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
  appUrl: string;
}

export function validateEnvironment(): { success: boolean; data: ValidatedEnvironment; errors?: string[] } {
  const parseResult = environmentSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    WEATHERGPT_MODE: process.env.WEATHERGPT_MODE,
    ALERT_INGESTION_TOKEN: process.env.ALERT_INGESTION_TOKEN,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    DATA_GOV_IN_API_KEY: process.env.DATA_GOV_IN_API_KEY,
  });

  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    logger.warn("Environment validation issues detected", {
      context: { issues: errorMessages },
    });
    return { success: false, data: {} as ValidatedEnvironment, errors: errorMessages };
  }

  return { success: true, data: parseResult.data };
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
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  };
}

export const APP_CONFIG: AppConfig = getEnvironmentConfig();
