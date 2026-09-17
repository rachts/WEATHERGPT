import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateGroundedResponse } from "@/lib/services/rag";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const ragRequestSchema = z.object({
  query: z.string().min(1, "Query is required").max(500, "Query exceeds maximum allowed length of 500 characters"),
  district: z.string().min(1).max(100).default("Raigad"),
  language: z.enum(["hi-IN", "ta-IN", "en-IN"]).default("en-IN"),
});

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = req.headers.get("x-forwarded-for") || "unknown-ip";

  if (await isRateLimited(`rag:${clientIp}`, 60, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down.", correlationId },
      { status: 429 }
    );
  }

  try {
    let unvalidatedJson: unknown;
    try {
      unvalidatedJson = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body.", correlationId },
        { status: 400 }
      );
    }

    const parseResult = ragRequestSchema.safeParse(unvalidatedJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error.issues[0]?.message || "Invalid request payload",
          correlationId,
        },
        { status: 400 }
      );
    }

    const { query, district, language } = parseResult.data;
    const result = await generateGroundedResponse(query, district, language);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("RAG API generation error", { correlationId, error: (error as Error).message });
    return NextResponse.json(
      { error: "RAG generation failed", correlationId },
      { status: 500 }
    );
  }
}
