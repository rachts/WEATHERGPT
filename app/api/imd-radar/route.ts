import { NextRequest, NextResponse } from "next/server";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMD_RADAR_BASE = "https://mausam.imd.gov.in/Radar";

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = request.headers.get("x-forwarded-for") || "unknown-ip";

  if (await isRateLimited(`imd-radar:${clientIp}`, 60, 60_000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded", correlationId },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawStation = (searchParams.get("station") || "kol").toLowerCase().trim();
  const product = (searchParams.get("product") || "caz").toLowerCase().trim();

  // Map station full names / aliases to IMD radar abbreviations
  const STATION_CODE_MAP: Record<string, string> = {
    kolkata: "kol",
    kol: "kol",
    mumbai: "mum",
    mum: "mum",
    delhi: "delhi",
    chennai: "cni",
    cni: "cni",
    kochi: "koc",
    koc: "koc",
    patna: "ptn",
    ptn: "ptn",
    srinagar: "srn",
    srn: "srn",
    guwahati: "ghy",
    ghy: "ghy",
    hyderabad: "hyd",
    hyd: "hyd",
    nagpur: "ngp",
    ngp: "ngp",
  };

  const resolvedStation = STATION_CODE_MAP[rawStation] || rawStation;

  // Whitelist product & station parameters to prevent SSRF
  const sanitizedProduct = product.replace(/[^a-zA-Z0-9_-]/g, "");
  const sanitizedStation = resolvedStation.replace(/[^a-zA-Z0-9_-]/g, "");

  let url = `${IMD_RADAR_BASE}/${sanitizedProduct}_${sanitizedStation}.gif`;
  if (sanitizedProduct === "mosaic") {
    url = `${IMD_RADAR_BASE}/MOSAIC/Converted/mosaic.gif`;
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent": "WeatherGPT-OpenData/1.0 (+https://github.com/rachts/WEATHERGPT)",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "IMD radar scan currently unavailable", correlationId },
        { status: res.status }
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "public, max-age=180, s-maxage=180, stale-while-revalidate=300",
      },
    });
  } catch (err: any) {
    logger.error("IMD Radar proxy fetch error", { correlationId, error: err?.message || String(err) });
    return NextResponse.json(
      { error: "Failed to fetch IMD radar image", correlationId },
      { status: 504 }
    );
  }
}
