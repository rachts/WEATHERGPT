import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import {
  fetchLiveImdDistrictAlerts,
  routeWarningDissemination,
  computeAlertHash,
  IMDWarningProduct,
} from "@/lib/services/alerts";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const alertQuerySchema = z.object({
  district: z.string().min(1).max(100).default("Raigad"),
  state: z.string().max(100).optional(),
});

const alertIngestSchema = z.object({
  id: z.string().min(1),
  district: z.string().min(1).max(100),
  districtCode: z.string().optional(),
  state: z.string().max(100).optional(),
  severity: z.enum(["Low", "Moderate", "High", "Severe"]),
  officialSeverity: z.string().optional(),
  eventType: z.string().optional(),
  headline: z.string().min(1),
  warningText: z.string().min(1),
  rawBulletin: z.string().optional(),
  normalizedBulletin: z.string().optional(),
  sourceProduct: z.string().default("IMD Mausam District Nowcast Portal (MoES)"),
  sourceUrl: z.string().url().optional(),
  issueTime: z.string(),
  validFrom: z.string(),
  validTo: z.string(),
  isActive: z.boolean().default(true),
  recipientPhones: z.array(z.string().regex(/^\+?[1-9]\d{6,14}$/)).optional().default([]),
});

export async function GET(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = req.headers.get("x-forwarded-for") || "unknown-ip";

  if (await isRateLimited(`alerts:${clientIp}`, 120, 60_000)) {
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

  try {
    const { searchParams } = new URL(req.url);
    const parseResult = alertQuerySchema.safeParse({
      district: searchParams.get("district") || "Raigad",
      state: searchParams.get("state") || undefined,
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
    const alerts = await fetchLiveImdDistrictAlerts(district, state);

    return NextResponse.json(
      {
        data: { district, state, alerts },
        meta: {
          requestId: correlationId,
          count: alerts.length,
          generatedAt: new Date().toISOString(),
        },
        district,
        state,
        alerts,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
          "X-Request-Id": correlationId,
        },
      }
    );
  } catch (error) {
    logger.error("Failed to retrieve alerts", { requestId: correlationId, error });
    return NextResponse.json(
      {
        error: {
          code: "ALERT_SERVICE_UNAVAILABLE",
          message: "Unable to retrieve meteorological alerts.",
          requestId: correlationId,
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();

  // Public-safety lockdown: Gate endpoint behind ingestion secret with timing-safe comparison
  const configuredToken = process.env.ALERT_INGESTION_TOKEN;
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const customHeaderToken = req.headers.get("x-ingestion-token");
  const providedToken = bearerToken || customHeaderToken;

  let isAuthorized = false;
  if (configuredToken && providedToken) {
    const a = Buffer.from(providedToken);
    const b = Buffer.from(configuredToken);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    // Return 404 to avoid leaking existence of ingestion endpoint to unauthorized callers
    return new NextResponse(null, { status: 404 });
  }

  // Rate limit: max 15 emergency alert updates per minute
  const clientIp = req.headers.get("x-forwarded-for") || "unknown-ip";
  if (await isRateLimited(`alert-ingest:${clientIp}`, 15, 60_000)) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Rate limit exceeded for alert ingestion.",
          requestId: correlationId,
        },
      },
      { status: 429 }
    );
  }

  try {
    const rawBody = await req.json();
    const parseResult = alertIngestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: parseResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
            requestId: correlationId,
          },
        },
        { status: 400 }
      );
    }

    const alertData = parseResult.data;
    const districtCode = alertData.districtCode || `IN-${alertData.district.toUpperCase()}`;
    const alertHash = computeAlertHash(alertData.id, districtCode, alertData.issueTime, alertData.warningText);

    const fullAlert: IMDWarningProduct = {
      ...alertData,
      alertHash,
      sourceId: alertData.id,
      districtCode,
      rawBulletin: alertData.rawBulletin || alertData.warningText,
      normalizedBulletin: alertData.normalizedBulletin || alertData.warningText,
    };

    const dissemination = routeWarningDissemination(fullAlert, alertData.recipientPhones);

    return NextResponse.json({
      data: {
        success: true,
        alertHash,
        dissemination,
      },
      meta: {
        requestId: correlationId,
        generatedAt: new Date().toISOString(),
      },
      success: true,
      alertHash,
      dissemination,
    });
  } catch (error) {
    logger.error("Alert ingestion error", { correlationId, error: (error as Error).message });
    return NextResponse.json(
      {
        error: {
          code: "INGESTION_ERROR",
          message: "Alert ingestion could not be completed.",
          requestId: correlationId,
        },
      },
      { status: 500 }
    );
  }
}
