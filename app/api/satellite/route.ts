import { NextRequest, NextResponse } from "next/server";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SATELLITE_PRODUCTS: Record<string, { url: string; mime: string }> = {
  ir1: { url: "https://mausam.imd.gov.in/Satellite/3Dasiasec_ir1.jpg", mime: "image/jpeg" },
  ctbt: { url: "https://mausam.imd.gov.in/Satellite/3Dasiasec_ctbt.jpg", mime: "image/jpeg" },
  vis: { url: "https://mausam.imd.gov.in/Satellite/3Dasiasec_vis.jpg", mime: "image/jpeg" },
  wv: { url: "https://mausam.imd.gov.in/Satellite/3Dasiasec_wv.jpg", mime: "image/jpeg" },
  globe: { url: "https://mausam.imd.gov.in/Satellite/3Dglobe_ir1.jpg", mime: "image/jpeg" },
  ir1_loop: { url: "https://mausam.imd.gov.in/Satellite/Converted/IR1.gif", mime: "image/gif" },
  ctbt_loop: { url: "https://mausam.imd.gov.in/Satellite/Converted/CTBT.gif", mime: "image/gif" },
  vis_loop: { url: "https://mausam.imd.gov.in/Satellite/Converted/VIS.gif", mime: "image/gif" },
  wv_loop: { url: "https://mausam.imd.gov.in/Satellite/Converted/WV.gif", mime: "image/gif" },
};

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = request.headers.get("x-forwarded-for") || "unknown-ip";

  if (await isRateLimited(`satellite:${clientIp}`, 60, 60_000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded", correlationId },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const product = searchParams.get("product") || "ir1";
  const target = SATELLITE_PRODUCTS[product] || SATELLITE_PRODUCTS.ir1;

  try {
    const res = await fetch(target.url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "WeatherGPT-OpenData/1.0 (+https://github.com/rachts/WEATHERGPT)",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "IMD satellite product currently unavailable", correlationId },
        { status: res.status }
      );
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": target.mime,
        "Cache-Control": "public, max-age=180, s-maxage=180, stale-while-revalidate=300",
      },
    });
  } catch (err: any) {
    logger.error("Satellite proxy fetch error", { correlationId, error: err?.message || String(err) });
    return NextResponse.json(
      { error: "Failed to fetch IMD satellite image", correlationId },
      { status: 504 }
    );
  }
}
