import { NextResponse } from "next/server";
import { getEnvironmentConfig } from "@/lib/config/environment";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const correlationId = crypto.randomUUID();
  const startTime = Date.now();
  const config = getEnvironmentConfig();

  // 1. Database subsystem check
  let dbStatus: "healthy" | "degraded" | "unavailable" = "healthy";
  let dbLatencyMs: number | null = null;
  if (process.env.DATABASE_URL) {
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbStatus = "unavailable";
    }
  } else {
    // Graceful stateless mode
    dbStatus = "degraded"; // Ephemeral in-memory fallback mode
  }

  // 2. Distributed Cache / Redis subsystem check
  let redisStatus: "healthy" | "degraded" | "unavailable" = "healthy";
  let redisLatencyMs: number | null = null;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    const redisStart = Date.now();
    try {
      const res = await fetch(`${upstashUrl}/ping`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        redisLatencyMs = Date.now() - redisStart;
      } else {
        redisStatus = "degraded";
      }
    } catch {
      redisStatus = "unavailable";
    }
  } else {
    redisStatus = "healthy"; // Running on in-memory LRU cache
  }

  // 3. Upstream IMD GeoServer subsystem check
  let imdStatus: "healthy" | "degraded" | "unavailable" = "healthy";
  let imdLatencyMs: number | null = null;
  const imdStart = Date.now();
  try {
    const imdUrl =
      "https://reactjs.imd.gov.in/geoserver/imd/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=imd:synop_data_layer&maxFeatures=1&outputFormat=application/json";
    const res = await fetch(imdUrl, {
      headers: { "User-Agent": "WeatherGPT-HealthCheck/1.0" },
      signal: AbortSignal.timeout(3000),
    });
    imdLatencyMs = Date.now() - imdStart;
    if (!res.ok) imdStatus = "degraded";
  } catch {
    imdStatus = "degraded";
  }

  const overallStatus =
    dbStatus === "unavailable" && config.isProduction
      ? "unavailable"
      : imdStatus === "degraded" || redisStatus === "unavailable"
      ? "degraded"
      : "healthy";

  return NextResponse.json(
    {
      status: overallStatus,
      version: "1.0.0",
      mode: config.mode,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      totalLatencyMs: Date.now() - startTime,
      subsystems: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          mode: process.env.DATABASE_URL ? "postgresql" : "stateless-ephemeral",
        },
        cache: {
          status: redisStatus,
          latencyMs: redisLatencyMs,
          mode: upstashUrl && upstashToken ? "upstash-redis-distributed" : "in-memory-lru",
        },
        imdGeoServer: {
          status: imdStatus,
          latencyMs: imdLatencyMs,
        },
      },
      requestId: correlationId,
    },
    { status: overallStatus === "unavailable" ? 503 : 200 }
  );
}
