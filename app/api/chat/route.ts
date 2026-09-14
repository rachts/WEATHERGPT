import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processWeatherQuery } from "@/lib/services/query-pipeline";
import { UnknownDistrictError } from "@/lib/utils/location";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const chatInputSchema = z.object({
  query: z.string().min(1, "Query is required").max(500, "Query exceeds maximum allowed length of 500 characters"),
  district: z.string().max(100).optional().default("Raigad"),
  language: z.enum(["hi-IN", "ta-IN", "en-IN"]).optional().default("hi-IN"),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = req.headers.get("x-forwarded-for") || "unknown-ip";

  if (await isRateLimited(`chat:${clientIp}`, 60, 60_000)) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many chat requests. Please slow down.",
          requestId: correlationId,
        },
      },
      { status: 429 }
    );
  }

  try {
    const rawBody = await req.json();
    const parseResult = chatInputSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST_PAYLOAD",
            message: parseResult.error.issues.map((e) => e.message).join(", "),
            requestId: correlationId,
          },
        },
        { status: 400 }
      );
    }

    const { query, district, language } = parseResult.data;
    let { sessionId } = parseResult.data;

    // Process query with 8-second timeout guard
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Query processing timed out")), 8000)
    );

    const response = (await Promise.race([
      processWeatherQuery(query, district, language),
      timeoutPromise,
    ])) as any;

    // Optional asynchronous persistence if PostgreSQL is reachable
    if (process.env.DATABASE_URL) {
      try {
        let activeSession;
        if (sessionId) {
          activeSession = await prisma.chatSession.findUnique({
            where: { id: sessionId },
          });
        }
        if (!activeSession) {
          activeSession = await prisma.chatSession.create({
            data: {
              title: query.slice(0, 40),
              language,
            },
          });
          sessionId = activeSession.id;
        }

        // Persist user query message
        await prisma.chatMessage.create({
          data: {
            sessionId: activeSession.id,
            role: "user",
            content: query,
          },
        });

        // Persist assistant response message
        await prisma.chatMessage.create({
          data: {
            sessionId: activeSession.id,
            role: "assistant",
            content: response.answerText,
            intent: response.intent,
            dataCard: response.dataCard ?? undefined,
            sourceProduct: response.sourceProduct ?? undefined,
            issueTime: response.issueTime ? new Date(response.issueTime) : undefined,
          },
        });
      } catch (dbErr) {
        console.warn(`[Chat Persistence Warning - ${correlationId}]`, dbErr);
      }
    }

    return NextResponse.json(
      {
        data: { ...response, sessionId },
        meta: {
          requestId: correlationId,
          generatedAt: new Date().toISOString(),
        },
        // Backward-compatible root fields
        ...response,
        sessionId,
      },
      {
        headers: {
          "X-Request-Id": correlationId,
        },
      }
    );
  } catch (error) {
    if (error instanceof UnknownDistrictError) {
      return NextResponse.json(
        {
          error: {
            code: "UNKNOWN_DISTRICT",
            message: error.message,
            requestId: correlationId,
          },
        },
        { status: 400 }
      );
    }

    logger.error("Chat API processing error", { correlationId, error: (error as Error).message });
    const isTimeout = (error as Error)?.message?.includes("timed out");
    return NextResponse.json(
      {
        error: {
          code: isTimeout ? "GATEWAY_TIMEOUT" : "INTERNAL_SERVER_ERROR",
          message: isTimeout
            ? "The weather intelligence service timed out waiting for upstream telemetry. Please try again."
            : "Unable to process query at this time. Please try again.",
          requestId: correlationId,
        },
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
