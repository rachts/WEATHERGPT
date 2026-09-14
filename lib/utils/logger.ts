// WeatherGPT — Production Structured Logger (Pino)
// Provides fast, structured JSON logging with correlation IDs, log levels, and timestamps.

import pino from "pino";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogMeta {
  requestId?: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: unknown;
  [key: string]: unknown;
}

const pinoInstance = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  browser: {
    asObject: true,
  },
});

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    };
  }
  return err ? { message: String(err) } : undefined;
}

export const logger = {
  pino: pinoInstance,

  debug(message: string, meta?: LogMeta) {
    const correlationId = meta?.correlationId || meta?.requestId;
    pinoInstance.debug(
      {
        ...meta,
        correlationId,
        requestId: correlationId,
        error: meta?.error ? serializeError(meta.error) : undefined,
      },
      message
    );
  },

  info(message: string, meta?: LogMeta) {
    const correlationId = meta?.correlationId || meta?.requestId;
    pinoInstance.info(
      {
        ...meta,
        correlationId,
        requestId: correlationId,
        error: meta?.error ? serializeError(meta.error) : undefined,
      },
      message
    );
  },

  warn(message: string, meta?: LogMeta) {
    const correlationId = meta?.correlationId || meta?.requestId;
    pinoInstance.warn(
      {
        ...meta,
        correlationId,
        requestId: correlationId,
        error: meta?.error ? serializeError(meta.error) : undefined,
      },
      message
    );
  },

  error(message: string, meta?: LogMeta) {
    const correlationId = meta?.correlationId || meta?.requestId;
    pinoInstance.error(
      {
        ...meta,
        correlationId,
        requestId: correlationId,
        error: meta?.error ? serializeError(meta.error) : undefined,
      },
      message
    );
  },
};
