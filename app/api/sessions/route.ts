import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = req.headers.get("x-forwarded-for") || "unknown-ip";

  if (await isRateLimited(`sessions:${clientIp}`, 60, 60_000)) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many session requests. Please slow down.",
          requestId: correlationId,
        },
      },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ sessions: [], messages: [] });
    }

    if (sessionId) {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
      return NextResponse.json({ session, messages: session?.messages ?? [] });
    }

    const sessions = await prisma.chatSession.findMany({
      take: 10,
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    logger.warn("Sessions API query notice", {
      correlationId,
      error: (error as Error).message,
    });
    // Graceful fallback for offline / unconfigured database
    return NextResponse.json({ sessions: [], messages: [] });
  }
}

export async function DELETE(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = req.headers.get("x-forwarded-for") || "unknown-ip";

  if (await isRateLimited(`sessions-prune:${clientIp}`, 10, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const maxAgeDays = parseInt(searchParams.get("maxAgeDays") || "30", 10);
    const { pruneOldChatSessions } = await import("@/lib/services/chat-session");
    const count = await pruneOldChatSessions(maxAgeDays);

    return NextResponse.json({
      success: true,
      prunedCount: count,
      maxAgeDays,
      requestId: correlationId,
    });
  } catch (error) {
    logger.error("Session pruning endpoint failure", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Failed to prune sessions", requestId: correlationId },
      { status: 500 }
    );
  }
}

