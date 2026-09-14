// WeatherGPT — Production Prisma Client Singleton
// Type-safe singleton proxy with lazy instantiation and graceful connection reuse across serverless invocations.

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return globalThis.prismaGlobal;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get<K extends keyof PrismaClient>(_target: PrismaClient, prop: K): PrismaClient[K] {
    const client = getPrismaClient();
    const val = client[prop];
    if (typeof val === "function") {
      return (val as (...args: unknown[]) => unknown).bind(client) as PrismaClient[K];
    }
    return val;
  },
});
