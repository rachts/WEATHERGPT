import { NextRequest, NextResponse } from "next/server";
import { isRateLimited } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMD_RADAR_BASE = "https://mausam.imd.gov.in/Radar";

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = request.headers.get("x-forwarded-for") || "unknown-ip";

  if (isRateLimited(`imd-radar:${clientIp}`, 60, 60_000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded", correlationId },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const station = searchParams.get("station") || "kol";
  const product = searchParams.get("product") || "caz"; // caz, ppi, sri, pac, ppv

  // Whitelist product & station parameters to prevent SSRF
  const sanitizedProduct = product.replace(/[^a-zA-Z0-9_-]/g, "");
  const sanitizedStation = station.replace(/[^a-zA-Z0-9_-]/g, "");

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
    console.error(`[IMD Radar Proxy Error - ${correlationId}]`, err);
    return NextResponse.json(
      { error: "Failed to fetch IMD radar image", correlationId },
      { status: 504 }
    );
  }
}
