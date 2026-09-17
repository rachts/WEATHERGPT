import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto, { timingSafeEqual } from "crypto";
import {
  fetchLiveImdDistrictAlerts,
  routeWarningDissemination,
  routeWarningDisseminationAsync,
  computeAlertHash,
  IMDWarningProduct,
  AlertSeverity,
  DisseminationResult,
} from "@/lib/services/alerts";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/logger";
import { prisma } from "@/lib/prisma";

import { findDistrictInfo } from "@/lib/utils/location";

export const dynamic = "force-dynamic";

const alertQuerySchema = z.object({
  district: z.string().min(1).max(100).default("Raigad"),
  state: z.string().max(100).optional(),
});

const isoDateString = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: "Must be a valid ISO 8601 date string",
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
  issueTime: isoDateString,
  validFrom: isoDateString,
  validTo: isoDateString,
  isActive: z.boolean().default(true),
  recipientPhones: z.array(z.string().regex(/^\+?[1-9]\d{6,14}$/)).max(50).optional().default([]),
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
    const liveAlerts = await fetchLiveImdDistrictAlerts(district, state);

    let dbAlerts: IMDWarningProduct[] = [];
    if (process.env.DATABASE_URL) {
      try {
        const now = new Date();
        const canonicalDistrict = findDistrictInfo(district, state)?.name || district.trim();
        const records = await prisma.alert.findMany({
          where: {
            OR: [
              { district: canonicalDistrict },
              { district: district.trim() },
            ],
            isActive: true,
            validTo: { gte: now },
          },
          orderBy: { issueTime: "desc" },
        });


        dbAlerts = records.map((r) => ({
          id: r.sourceId || r.id,
          alertHash: r.alertHash || "",
          sourceId: r.sourceId || r.id,
          districtCode: r.districtCode || "",
          district: r.district,
          state: r.state || undefined,
          severity: r.severity as AlertSeverity,
          officialSeverity: r.officialSeverity || undefined,
          eventType: r.eventType || undefined,
          headline: r.headline,
          warningText: r.warningText,
          rawBulletin: r.rawBulletin || undefined,
          normalizedBulletin: r.normalizedBulletin || undefined,
          sourceProduct: r.sourceProduct,
          sourceUrl: r.sourceUrl || undefined,
          issueTime: r.issueTime.toISOString(),
          validFrom: r.validFrom.toISOString(),
          validTo: r.validTo.toISOString(),
          isActive: r.isActive,
        }));
      } catch (dbErr) {
        logger.warn("Failed to retrieve alerts from database, relying on live IMD nowcast", {
          requestId: correlationId,
          error: (dbErr as Error).message,
        });
      }
    }

    // Deduplicate union by alertHash
    const seenHashes = new Set<string>();
    const alerts: IMDWarningProduct[] = [];
    for (const alert of [...dbAlerts, ...liveAlerts]) {
      const hash = alert.alertHash || computeAlertHash(alert.id, alert.districtCode, alert.issueTime, alert.warningText);
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        alerts.push({ ...alert, alertHash: hash });
      }
    }

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

  // Origin protection: Block cross-origin browser drive-by injections
  const origin = req.headers.get("origin");
  if (origin) {
    const allowed = [process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000", "http://127.0.0.1:3000"].filter(Boolean);
    const isAllowed = allowed.some((a) => origin.startsWith(a!));
    if (!isAllowed) {
      logger.warn("Alert ingestion rejected: Untrusted cross-origin request", {
        correlationId,
        origin,
      });
      return new NextResponse(null, { status: 403 });
    }
  }

  // Public-safety lockdown: Gate endpoint behind ingestion secret with timing-safe comparison
  const configuredToken = process.env.ALERT_INGESTION_TOKEN;
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const customHeaderToken = req.headers.get("x-ingestion-token");
  const providedToken = bearerToken || customHeaderToken;

  // Fail closed: If configuredToken is unset, empty, or insecure (< 16 chars), reject immediately.
  // Never permit alert ingestion without explicit, cryptographically secure configuration.
  if (!configuredToken || configuredToken.trim().length < 16) {
    logger.error("Alert ingestion rejected: ALERT_INGESTION_TOKEN is not configured or insecure (< 16 chars). Failing closed.", {
      correlationId,
    });
    return new NextResponse(null, { status: 404 });
  }

  if (!providedToken) {
    return new NextResponse(null, { status: 404 });
  }

  // Hash both tokens to fixed 32-byte digests to prevent length-leak timing attacks
  // and guarantee timingSafeEqual never throws on length mismatch
  const hashProvided = crypto.createHash("sha256").update(providedToken).digest();
  const hashConfigured = crypto.createHash("sha256").update(configuredToken).digest();
  const isAuthorized = timingSafeEqual(hashProvided, hashConfigured);

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
    const dInfo = findDistrictInfo(alertData.district, alertData.state);
    const canonicalDistrict = dInfo?.name || alertData.district.trim();
    const districtCode = alertData.districtCode || dInfo?.districtCode || `IN-${canonicalDistrict.toUpperCase()}`;
    const alertHash = computeAlertHash(alertData.id, districtCode, alertData.issueTime, alertData.warningText);

    const fullAlert: IMDWarningProduct = {
      ...alertData,
      district: canonicalDistrict,
      alertHash,
      sourceId: alertData.id,
      districtCode,
      rawBulletin: alertData.rawBulletin || alertData.warningText,
      normalizedBulletin: alertData.normalizedBulletin || alertData.warningText,
    };


    let isDuplicate = false;
    if (process.env.DATABASE_URL) {
      try {
        await prisma.alert.create({
          data: {
            alertHash,
            sourceId: fullAlert.sourceId,
            districtCode: fullAlert.districtCode,
            district: fullAlert.district,
            state: fullAlert.state,
            severity: fullAlert.severity,
            officialSeverity: fullAlert.officialSeverity,
            eventType: fullAlert.eventType,
            headline: fullAlert.headline,
            warningText: fullAlert.warningText,
            rawBulletin: fullAlert.rawBulletin,
            normalizedBulletin: fullAlert.normalizedBulletin,
            sourceProduct: fullAlert.sourceProduct,
            sourceUrl: fullAlert.sourceUrl,
            issueTime: new Date(fullAlert.issueTime),
            validFrom: new Date(fullAlert.validFrom),
            validTo: new Date(fullAlert.validTo),
            isActive: fullAlert.isActive,
          },
        });
      } catch (dbErr: unknown) {
        const errObj = dbErr as { code?: string; message?: string };
        if (errObj.code === "P2002") {
          // Unique constraint violation on alertHash -> already ingested
          isDuplicate = true;
        } else {
          logger.warn("Database alert persistence error, falling back to process dedup", {
            correlationId,
            error: errObj.message || String(dbErr),
          });
        }
      }
    }

    let dissemination: DisseminationResult;
    if (isDuplicate) {
      dissemination = {
        alertId: fullAlert.id,
        alertHash,
        district: fullAlert.district,
        severity: fullAlert.severity,
        displayWarningText: fullAlert.warningText,
        verbatimWarningText: fullAlert.rawBulletin || fullAlert.warningText,
        channels: {
          inAppBanner: false,
          webPush: false,
          smsStubbed: false,
          ivrStubbed: false,
        },
        deliveryLogs: [
          `Alert ${fullAlert.id} (hash: ${alertHash.slice(0, 8)}) was already persisted in database. Skipping duplicate notification.`,
        ],
        skipped: true,
      };
    } else {
      dissemination = await routeWarningDisseminationAsync(fullAlert, alertData.recipientPhones);
    }

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
