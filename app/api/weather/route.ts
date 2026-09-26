import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDistrictWeather, UnknownDistrictError } from "@/lib/services/weather-data";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const weatherQuerySchema = z.object({
  district: z.string().min(1, "District is required").max(100, "District name too long").default("Raigad"),
  state: z.string().max(100).optional(),
  simulateImdFailure: z.enum(["true", "false"]).optional(),
  simulateNetworkFailure: z.enum(["true", "false"]).optional(),
});

export async function GET(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = req.headers.get("x-forwarded-for") || "unknown-ip";

  if (await isRateLimited(`weather:${clientIp}`, 120, 60_000)) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please slow down.",
          requestId: correlationId,
        },
      },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const parseResult = weatherQuerySchema.safeParse({
    district: searchParams.get("district") || "Raigad",
    state: searchParams.get("state") || undefined,
    simulateImdFailure: searchParams.get("simulateImdFailure") || undefined,
    simulateNetworkFailure: searchParams.get("simulateNetworkFailure") || undefined,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST_PARAMETERS",
          message: parseResult.error.issues.map((e) => e.message).join(", "),
          requestId: correlationId,
        },
      },
      { status: 400 }
    );
  }

  const { district, state } = parseResult.data;

  // Simulation flags strictly guarded for non-production environments
  const isDev = process.env.NODE_ENV !== "production";
  const simulateImdFailure = isDev && parseResult.data.simulateImdFailure === "true";
  const simulateNetworkFailure = isDev && parseResult.data.simulateNetworkFailure === "true";

  try {
    const data = await getDistrictWeather({
      district,
      state,
      simulateImdFailure,
      simulateNetworkFailure,
    });
    return NextResponse.json(
      {
        data,
        meta: {
          requestId: correlationId,
          provenance: [data.provenance],
          generatedAt: new Date().toISOString(),
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-Request-Id": correlationId,
        },
      }
    );
  } catch (error) {
    if (error instanceof UnknownDistrictError) {
      return NextResponse.json(
        {
          error: {
            code: "UNKNOWN_DISTRICT",
            message: error.message,
            requestId: correlationId,
          },
        },
        { status: 400 }
      );
    }

    logger.error("Weather API query error", { correlationId, error: (error as Error).message });
    return NextResponse.json(
      {
        error: {
          code: "WEATHER_SERVICE_UNAVAILABLE",
          message: "Current weather is temporarily unavailable for this location.",
          requestId: correlationId,
        },
      },
      { status: 503 }
    );
  }
}
