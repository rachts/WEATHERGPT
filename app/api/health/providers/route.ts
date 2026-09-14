import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ProviderStatus {
  name: string;
  status: "healthy" | "degraded" | "unavailable";
  endpoint: string;
  latencyMs: number;
  message?: string;
}

export async function GET() {
  const correlationId = crypto.randomUUID();
  const startTime = Date.now();

  const providers: ProviderStatus[] = [];

  // 1. IMD GeoServer SYNOP WFS endpoint
  const imdStartTime = Date.now();
  try {
    const imdUrl = "https://reactjs.imd.gov.in/geoserver/imd/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=imd:synop_data_layer&maxFeatures=1&outputFormat=application/json";
    const res = await fetch(imdUrl, {
      headers: { "User-Agent": "WeatherGPT-HealthCheck/1.0" },
      signal: AbortSignal.timeout(4000),
    });
    providers.push({
      name: "IMD GeoServer SYNOP WFS",
      status: res.ok ? "healthy" : "degraded",
      endpoint: "https://reactjs.imd.gov.in/geoserver",
      latencyMs: Date.now() - imdStartTime,
    });
  } catch (err) {
    providers.push({
      name: "IMD GeoServer SYNOP WFS",
      status: "unavailable",
      endpoint: "https://reactjs.imd.gov.in/geoserver",
      latencyMs: Date.now() - imdStartTime,
      message: (err as Error).message,
    });
  }

  // 2. Open-Meteo fallback API
  const omStartTime = Date.now();
  try {
    const omUrl = "https://api.open-meteo.com/v1/forecast?latitude=18.5204&longitude=73.8567&current=temperature_2m";
    const res = await fetch(omUrl, { signal: AbortSignal.timeout(3000) });
    providers.push({
      name: "Open-Meteo Numerical Fallback",
      status: res.ok ? "healthy" : "degraded",
      endpoint: "https://api.open-meteo.com/v1",
      latencyMs: Date.now() - omStartTime,
    });
  } catch (err) {
    providers.push({
      name: "Open-Meteo Numerical Fallback",
      status: "unavailable",
      endpoint: "https://api.open-meteo.com/v1",
      latencyMs: Date.now() - omStartTime,
      message: (err as Error).message,
    });
  }

  // Determine overall status
  const anyUnavailable = providers.some((p) => p.status === "unavailable");
  const allUnavailable = providers.every((p) => p.status === "unavailable");
  const overallStatus = allUnavailable ? "unavailable" : anyUnavailable ? "degraded" : "healthy";

  return NextResponse.json(
    {
      status: overallStatus,
      totalLatencyMs: Date.now() - startTime,
      providers,
      requestId: correlationId,
    },
    { status: allUnavailable ? 503 : 200 }
  );
}
