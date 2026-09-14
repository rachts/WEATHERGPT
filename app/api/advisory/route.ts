import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDeterministicCropAdvisory } from "@/lib/services/advisory-rules";
import { getDistrictWeather, UnknownDistrictError } from "@/lib/services/weather-data";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const advisoryQuerySchema = z.object({
  crop: z.string().min(1).max(100).default("paddy"),
  district: z.string().min(1).max(100).default("Raigad"),
  state: z.string().max(100).optional(),
  language: z.enum(["hi-IN", "ta-IN", "en-IN"]).default("en-IN"),
});

export async function GET(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = req.headers.get("x-forwarded-for") || "unknown-ip";

  if (await isRateLimited(`advisory:${clientIp}`, 120, 60_000)) {
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
  const parseResult = advisoryQuerySchema.safeParse({
    crop: searchParams.get("crop") || "paddy",
    district: searchParams.get("district") || "Raigad",
    state: searchParams.get("state") || undefined,
    language: searchParams.get("language") || "en-IN",
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

  const { crop, district, state, language } = parseResult.data;

  try {
    const weather = await getDistrictWeather(district, state);
    const advisory = getDeterministicCropAdvisory(
      crop,
      district,
      {
        temperature: weather.current.temperature,
        humidity: weather.current.humidity,
        windSpeed: weather.current.windSpeed,
        windDirection: weather.current.windDirection,
        rainfallLast24h: weather.current.rainfallLast24h,
        rainfallForecastNext24h: weather.forecastDaily[0]?.rainfallMm ?? 0,
      },
      language,
      weather.issueTime
    );

    return NextResponse.json(
      {
        data: advisory,
        meta: {
          requestId: correlationId,
          generatedAt: new Date().toISOString(),
        },
        ...advisory,
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

    logger.error("Advisory API processing error", { correlationId, error: (error as Error).message });
    return NextResponse.json(
      {
        error: {
          code: "ADVISORY_SERVICE_UNAVAILABLE",
          message: "Agricultural advisory is temporarily unavailable.",
          requestId: correlationId,
        },
      },
      { status: 503 }
    );
  }
}
