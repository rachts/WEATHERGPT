import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_SYNOPTIC_SYSTEMS, getDistrictSynopticImpact } from "@/lib/services/synoptic";
import { findDistrictInfo } from "@/lib/utils/location";
import { isRateLimited } from "@/lib/utils/rate-limit";

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
  const district = searchParams.get("district") || "Kolkata";
  const state = searchParams.get("state") || "West Bengal";

  const dInfo = findDistrictInfo(district);
  const lat = dInfo?.lat ?? parseFloat(searchParams.get("lat") || "22.57");
  const lon = dInfo?.lon ?? parseFloat(searchParams.get("lon") || "88.36");

  const impact = getDistrictSynopticImpact(district, state, lat, lon);

  return NextResponse.json(
    {
      district,
      state,
      coordinates: { lat, lon },
      systems: ACTIVE_SYNOPTIC_SYSTEMS,
      localImpact: impact,
      generatedAt: new Date().toISOString(),
      source: "India Meteorological Department (NWFC / RSMC New Delhi)",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=120, s-maxage=120, stale-while-revalidate=300",
      },
    }
  );
}
