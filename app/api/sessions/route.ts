import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/logger";
import { createHash, timingSafeEqual } from "crypto";

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
    const sessionId =
      searchParams.get("sessionId") ||
      req.headers.get("x-session-id") ||
      req.cookies.get("weathergpt_session_id")?.value;

    // Strict privacy scoping: Never leak stranger sessions
    if (!sessionId || !sessionId.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "SESSION_ID_REQUIRED",
            message:
              "A valid sessionId is required via ?sessionId=, X-Session-Id header, or weathergpt_session_id cookie.",
            requestId: correlationId,
          },
        },
        { status: 400 }
      );
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ session: null, messages: [] });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId.trim() },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        {
          session: null,
          messages: [],
          meta: { requestId: correlationId, message: "Session not found or expired." },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ session, messages: session.messages });
  } catch (error) {
    logger.warn("Sessions API query notice", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json({ session: null, messages: [] });
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
    const sessionId =
      searchParams.get("sessionId") ||
      req.headers.get("x-session-id") ||
      req.cookies.get("weathergpt_session_id")?.value;

    // Single-session deletion by client owner
    if (sessionId && sessionId.trim()) {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ success: true, deleted: true });
      }

      await prisma.chatSession.deleteMany({
        where: { id: sessionId.trim() },
      });

      return NextResponse.json({
        success: true,
        deletedSessionId: sessionId.trim(),
        requestId: correlationId,
      });
    }

    // Global administrative pruning: Require administrative secret
    const authHeader = req.headers.get("authorization");
    const adminToken = process.env.ALERT_INGESTION_TOKEN;

    if (!adminToken || !authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Administrative credentials required for global session pruning.",
            requestId: correlationId,
          },
        },
        { status: 401 }
      );
    }

    const provided = authHeader.slice(7);
    const hashProvided = createHash("sha256").update(provided).digest();
    const hashAdmin = createHash("sha256").update(adminToken).digest();

    if (!timingSafeEqual(hashProvided, hashAdmin)) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid administrative credentials.",
            requestId: correlationId,
          },
        },
        { status: 401 }
      );
    }

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
    logger.error("Session deletion endpoint failure", {
      correlationId,
      error: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Failed to delete or prune sessions", requestId: correlationId },
      { status: 500 }
    );
  }
}


