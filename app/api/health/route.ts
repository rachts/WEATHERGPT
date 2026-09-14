import { NextResponse } from "next/server";
import { getEnvironmentConfig } from "@/lib/config/environment";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const correlationId = crypto.randomUUID();
  const startTime = Date.now();
  const config = getEnvironmentConfig();

  let dbStatus: "healthy" | "degraded" | "unavailable" = "degraded";
  if (process.env.DATABASE_URL) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = "healthy";
    } catch {
      dbStatus = "unavailable";
    }
  }

  // Quick provider check
  let imdStatus: "healthy" | "degraded" | "unavailable" = "healthy";
  try {
    const imdUrl = "https://reactjs.imd.gov.in/geoserver/imd/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=imd:synop_data_layer&maxFeatures=1&outputFormat=application/json";
    const res = await fetch(imdUrl, {
      headers: { "User-Agent": "WeatherGPT-HealthCheck/1.0" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) imdStatus = "degraded";
  } catch {
    imdStatus = "degraded";
  }

  const overallStatus =
    dbStatus === "unavailable" && config.isProduction
      ? "unavailable"
      : imdStatus === "degraded"
      ? "degraded"
      : "healthy";

  return NextResponse.json(
    {
      status: overallStatus,
      version: "1.0.0",
      mode: config.mode,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      subsystems: {
        database: dbStatus,
        imdGeoServer: imdStatus,
        cache: "healthy",
      },
      requestId: correlationId,
    },
    { status: overallStatus === "unavailable" ? 503 : 200 }
  );
}
