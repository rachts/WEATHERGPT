// WeatherGPT — Real-Time Meteorological Telemetry Stream (Server-Sent Events)
// Delivers live observation updates, nowcasts, and disaster alerts directly to clients.

import { NextRequest } from "next/server";
import { getDistrictWeather } from "@/lib/services/weather-data";
import { fetchLiveImdDistrictAlerts, type IMDWarningProduct } from "@/lib/services/alerts";
import { findDistrictInfo } from "@/lib/utils/location";
import { DEFAULT_DISTRICT } from "@/lib/config/constants";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = req.headers.get("x-forwarded-for") || "unknown-ip";

  // Rate limiting on SSE connections
  if (await isRateLimited(`sse:${clientIp}`, 30, 60_000)) {
    return new Response(JSON.stringify({ error: "Too many real-time connections. Please slow down." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const districtParam = searchParams.get("district") || DEFAULT_DISTRICT;
  const stateParam = searchParams.get("state") || undefined;

  const districtInfo = findDistrictInfo(districtParam, stateParam);
  const districtName = districtInfo?.name || districtParam.trim();
  const stateName = stateParam || districtInfo?.state;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isAborted = false;
      let intervalId: ReturnType<typeof setInterval> | null = null;

      const safeEnqueue = (payload: string) => {
        if (isAborted) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        isAborted = true;
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener("abort", () => {
        cleanup();
      });

      // 1. Send initial connected event
      safeEnqueue(`event: connection\ndata: ${JSON.stringify({ status: "connected", correlationId, district: districtName })}\n\n`);

      // Helper to fetch and push fresh telemetry
      const pushTelemetry = async () => {
        if (isAborted) return;
        try {
          const [weatherData, alertsData] = await Promise.allSettled([
            getDistrictWeather(districtName, stateName),
            fetchLiveImdDistrictAlerts(districtName, stateName),
          ]);

          const weather = weatherData.status === "fulfilled" ? weatherData.value : null;
          const alerts = alertsData.status === "fulfilled" ? alertsData.value : [];

          const eventPayload = {
            type: "telemetry",
            district: districtName,
            state: stateName,
            weather,
            alerts,
            timestamp: new Date().toISOString(),
          };

          safeEnqueue(`event: telemetry\ndata: ${JSON.stringify(eventPayload)}\n\n`);
        } catch (err) {
          logger.warn("Real-time telemetry poll error", {
            correlationId,
            district: districtName,
            error: (err as Error).message,
          });
          safeEnqueue(`: error polling telemetry\n\n`);
        }
      };

      // Push immediate initial telemetry snapshot
      await pushTelemetry();

      // Setup periodic update stream (every 20s telemetry, heartbeat every 10s)
      let ticks = 0;
      intervalId = setInterval(async () => {
        if (isAborted) {
          cleanup();
          return;
        }

        ticks++;
        if (ticks % 2 === 0) {
          // Telemetry tick every 20s
          await pushTelemetry();
        } else {
          // Heartbeat keep-alive ping for carrier NAT stability
          safeEnqueue(`: ping ${Date.now()}\n\n`);
        }
      }, 10_000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
