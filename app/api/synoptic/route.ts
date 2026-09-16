import { NextRequest, NextResponse } from "next/server";
import {
  fetchLiveSynopticReport,
  getDistrictSynopticImpact,
  ACTIVE_SYNOPTIC_SYSTEMS,
} from "@/lib/services/synoptic";
import { findDistrictInfo } from "@/lib/utils/location";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { DEFAULT_DISTRICT, DEFAULT_STATE, DEFAULT_COORDINATES } from "@/lib/config/constants";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = request.headers.get("x-forwarded-for") || "unknown-ip";

  if (await isRateLimited(`synoptic:${clientIp}`, 120, 60_000)) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many synoptic requests. Please slow down.",
          requestId: correlationId,
        },
      },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const district = searchParams.get("district") || DEFAULT_DISTRICT;
  const state = searchParams.get("state") || DEFAULT_STATE;
  const isDemo = searchParams.get("demo") === "true";

  // Disambiguate identical district names across states (e.g., Hamirpur UP vs Hamirpur HP)
  const dInfo = findDistrictInfo(district, state);
  const lat = dInfo?.lat ?? parseFloat(searchParams.get("lat") || String(DEFAULT_COORDINATES.latitude));
  const lon = dInfo?.lon ?? parseFloat(searchParams.get("lon") || String(DEFAULT_COORDINATES.longitude));

  const synopticReport = await fetchLiveSynopticReport(isDemo);
  const impact = getDistrictSynopticImpact(district, state, lat, lon, synopticReport.systems);

  return NextResponse.json(
    {
      district,
      state,
      coordinates: { lat, lon },
      systems: synopticReport.systems,
      status: synopticReport.status,
      summary: synopticReport.summary,
      bulletinTitle: synopticReport.bulletinTitle,
      bulletinUrl: synopticReport.bulletinUrl,
      localImpact: impact,
      generatedAt: new Date().toISOString(),
      issueTime: synopticReport.issueTime,
      source: synopticReport.source,
      provenance: {
        source: synopticReport.source,
        quality: synopticReport.quality,
        issueTime: synopticReport.issueTime,
      },
      ...(isDemo
        ? {
            isDemo: true,
            disclaimer:
              "DEMO EVALUATION MODE: Displaying historical storm track benchmark for evaluation and drill testing. Not a live weather warning.",
          }
        : {}),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=120, s-maxage=120, stale-while-revalidate=300",
      },
    }
  );
}

