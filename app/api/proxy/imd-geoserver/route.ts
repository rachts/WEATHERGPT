// Next.js Server-Side API Proxy for IMD GeoServer SYNOP Layer
// Avoids client-side CORS issues, provides caching, and insulates against IMD GeoServer downtime

import { NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

const IMD_GEOSERVER_URL =
  "https://reactjs.imd.gov.in/geoserver/imd/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=imd:synop_data_layer&outputFormat=application/json";

let proxyCache: { data: any; cachedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  const now = Date.now();

  // Return fresh in-memory cache if available
  if (proxyCache && now - proxyCache.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(proxyCache.data, {
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
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      logger.warn(
        "IMD GeoServer returned non-200 status code",
        { status: res.status, statusText: res.statusText }
      );
      if (proxyCache) {
        return NextResponse.json(proxyCache.data, {
          headers: { "X-Cache-Status": "STALE_FALLBACK" },
        });
      }
      return NextResponse.json(
        { ok: false, error: `IMD_GEOSERVER_HTTP_${res.status}`, features: [] },
        { status: 502 }
      );
    }

    const data = await res.json();
    if (data?.features && Array.isArray(data.features)) {
      proxyCache = { data, cachedAt: now };
      return NextResponse.json(data, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-Cache-Status": "MISS",
        },
      });
    }

    if (proxyCache) {
      return NextResponse.json(proxyCache.data, {
        headers: { "X-Cache-Status": "STALE_FALLBACK" },
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

    if (proxyCache) {
      return NextResponse.json(proxyCache.data, {
        headers: { "X-Cache-Status": "STALE_FALLBACK" },
      });
    }

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
