import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const IMD_RADAR_BASE = "https://mausam.imd.gov.in/Radar";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const station = searchParams.get("station") || "kol";
  const product = searchParams.get("product") || "caz"; // caz, ppi, sri, pac, ppv

  // If mosaic requested
  let url = `${IMD_RADAR_BASE}/${product}_${station}.gif`;
  if (product === "mosaic") {
    url = `${IMD_RADAR_BASE}/MOSAIC/Converted/mosaic.gif`;
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent": "WeatherGPT-IMD-Kisan/1.0 (+https://weathergpt.gov.in)",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `IMD Radar returned HTTP ${res.status}` },
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
    return NextResponse.json(
      { error: "Failed to fetch IMD Radar image", details: err?.message },
      { status: 504 }
    );
  }
}
