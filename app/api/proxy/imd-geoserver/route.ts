// Next.js Server-Side API Proxy for IMD GeoServer SYNOP Layer
// Avoids client-side CORS issues, provides caching, and insulates against IMD GeoServer downtime

import { NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";
import { cacheGet, cacheSet } from "@/lib/utils/cache";

export const dynamic = "force-dynamic";

const IMD_GEOSERVER_URL =
  "https://reactjs.imd.gov.in/geoserver/imd/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=imd:synop_data_layer&outputFormat=application/json";

const CACHE_KEY = "imd:geoserver:synop";
const CACHE_TTL_SECONDS = 300;

export async function GET() {
  const cached = await cacheGet<any>(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "X-Cache-Status": "HIT",
      },
    });
  }

  try {
    const res = await fetch(IMD_GEOSERVER_URL, {
      headers: {
        "User-Agent": "WeatherGPT-MoES-Kisan/1.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      logger.warn(
        "IMD GeoServer returned non-200 status code",
        { status: res.status, statusText: res.statusText }
      );
      return NextResponse.json(
        { ok: false, error: `IMD_GEOSERVER_HTTP_${res.status}`, features: [] },
        { status: 502 }
      );
    }

    const data = await res.json();
    if (data?.features && Array.isArray(data.features)) {
      await cacheSet(CACHE_KEY, data, CACHE_TTL_SECONDS);
      return NextResponse.json(data, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-Cache-Status": "MISS",
        },
      });
    }

    return NextResponse.json(
      { ok: false, error: "INVALID_GEOSERVER_RESPONSE", features: [] },
      { status: 502 }
    );
  } catch (err: unknown) {
    logger.warn(
      "IMD GeoServer connection error or timeout",
      { error: err instanceof Error ? err.message : String(err) }
    );

    return NextResponse.json(
      {
        ok: false,
        error: "IMD_GEOSERVER_UNAVAILABLE",
        message: err instanceof Error ? err.message : "Service timeout",
        features: [],
      },
      { status: 503 }
    );
  }
}
