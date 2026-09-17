// WeatherGPT — Container & Load Balancer Readiness Probe
// Orchestrators (Kubernetes / Docker Swarm / AWS ECS) query /api/ready to route traffic.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isProduction } from "@/lib/config/environment";

export const dynamic = "force-dynamic";

export async function GET() {
  const isProd = isProduction();

  // 1. Check database readiness if configured
  if (process.env.DATABASE_URL) {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      if (isProd) {
        return NextResponse.json(
          {
            status: "not_ready",
            reason: "database_unreachable",
            error: (err as Error).message,
            timestamp: new Date().toISOString(),
          },
          { status: 503 }
        );
      }
    }
  }

  // 2. Process memory sanity check
  const memUsage = process.memoryUsage();
  const heapUsedMb = Math.round(memUsage.heapUsed / (1024 * 1024));

  return NextResponse.json(
    {
      status: "ready",
      uptimeSeconds: Math.floor(process.uptime()),
      heapUsedMb,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
