// WeatherGPT — Production Structured JSON Logger
// Provides structured, JSON-formatted logging with correlation IDs and timestamps.

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogMeta {
  requestId?: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: unknown;
  [key: string]: unknown;
}

export interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

function formatLog(level: LogLevel, message: string, meta?: LogMeta): string {
  const reqId = meta?.correlationId || meta?.requestId;
  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    requestId: reqId,
    correlationId: reqId,
    context: meta?.context,
  };

  if (meta?.error) {
    if (meta.error instanceof Error) {
      payload.error = {
        name: meta.error.name,
        message: meta.error.message,
        stack: process.env.NODE_ENV !== "production" ? meta.error.stack : undefined,
      };
    } else {
      payload.error = {
        message: String(meta.error),
      };
    }
  }

  return JSON.stringify(payload);
}

export const logger = {
  debug(message: string, meta?: LogMeta) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatLog("debug", message, meta));
    }
  },

  info(message: string, meta?: LogMeta) {
    console.log(formatLog("info", message, meta));
  },

  warn(message: string, meta?: LogMeta) {
    console.warn(formatLog("warn", message, meta));
  },

  error(message: string, meta?: LogMeta) {
    console.error(formatLog("error", message, meta));
  },
};
