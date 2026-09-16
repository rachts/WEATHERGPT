// WeatherGPT — Runtime Environment Configuration & Fail-Fast Validation
// Validates environment variables at startup and provides typed application configuration.

import { z } from "zod";
import { logger } from "@/lib/utils/logger";

export type AppMode = "production" | "demo" | "development" | "test";

export const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  WEATHERGPT_MODE: z.enum(["production", "demo", "development", "test"]).optional(),
  ALERT_INGESTION_TOKEN: z
    .string()
    .min(16, "ALERT_INGESTION_TOKEN must be at least 16 characters long for cryptographic security.")
    .optional(),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL.").or(z.literal("")).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL.").default("http://localhost:3000"),
  UPSTASH_REDIS_REST_URL: z.string().url().or(z.literal("")).optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().or(z.literal("")).optional(),
  DATA_GOV_IN_API_KEY: z.string().or(z.literal("")).optional(),
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).default("60"),
  RATE_LIMIT_WINDOW_SECONDS: z.string().regex(/^\d+$/).default("60"),
  GEMINI_API_KEY: z.string().or(z.literal("")).optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().or(z.literal("")).optional(),
  OPENAI_API_KEY: z.string().or(z.literal("")).optional(),
  TWILIO_ACCOUNT_SID: z.string().or(z.literal("")).optional(),
  TWILIO_AUTH_TOKEN: z.string().or(z.literal("")).optional(),
  TWILIO_PHONE_NUMBER: z.string().or(z.literal("")).optional(),
  TWILIO_FROM: z.string().or(z.literal("")).optional(),
  SMS_GATEWAY_URL: z.string().url().or(z.literal("")).optional(),
  SMS_GATEWAY_API_KEY: z.string().or(z.literal("")).optional(),
  IVR_GATEWAY_URL: z.string().url().or(z.literal("")).optional(),
  IVR_GATEWAY_API_KEY: z.string().or(z.literal("")).optional(),
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

/**
 * Validates environment variables and throws immediately if required variables are missing or invalid.
 * Fails fast at startup with a formatted diagnostic listing all missing/invalid fields.
 */
export function assertEnvironmentValid(env: Record<string, string | undefined> = process.env): ValidatedEnvironment {
  const isProd = env.NODE_ENV === "production" || env.WEATHERGPT_MODE === "production";

  // In production, ALERT_INGESTION_TOKEN is strictly mandatory with zero defaults
  const schema = isProd
    ? environmentSchema.extend({
        ALERT_INGESTION_TOKEN: z
          .string()
          .min(16, "ALERT_INGESTION_TOKEN is required in production (min 16 chars). Never use a default or placeholder token."),
      })
    : environmentSchema.extend({
        ALERT_INGESTION_TOKEN: z
          .string()
          .min(16)
          .optional(),
      });

  const parseResult = schema.safeParse(env);

  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    const fatalReport = `\n❌ FATAL CONFIGURATION ERROR: Application startup rejected due to missing or invalid environment variables:\n${errorMessages.join("\n")}\n`;
    logger.error("Fail-fast environment validation failed", { error: fatalReport });
    throw new Error(fatalReport);
  }

  return parseResult.data as ValidatedEnvironment;
}

export function validateEnvironment(env: Record<string, string | undefined> = process.env): {
  success: boolean;
  data: Partial<ValidatedEnvironment>;
  errors?: string[];
} {
  try {
    const data = assertEnvironmentValid(env);
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      data: {},
      errors: (err as Error).message.split("\n").filter((l) => l.startsWith("  - ")),
    };
  }
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
