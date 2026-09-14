import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const correlationId = crypto.randomUUID();
  const startTime = Date.now();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      status: "degraded",
      service: "database",
      message: "DATABASE_URL is not configured; running in stateless ephemeral mode.",
      latencyMs: Date.now() - startTime,
      requestId: correlationId,
    });
  }

  try {
    // Ping database with lightweight query
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      status: "healthy",
      service: "database",
      latencyMs,
      requestId: correlationId,
    });
  } catch (error) {
    logger.error("Database health check ping failed", { correlationId, error: (error as Error).message });
    return NextResponse.json(
      {
        status: "unavailable",
        service: "database",
        message: "Database connection failed.",
        latencyMs: Date.now() - startTime,
        requestId: correlationId,
      },
      { status: 503 }
    );
  }
}
