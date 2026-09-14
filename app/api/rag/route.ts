import { NextRequest, NextResponse } from "next/server";
import { generateGroundedResponse } from "@/lib/services/rag";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

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
    const body = await req.json();
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const district = typeof body.district === "string" ? body.district : "Raigad";
    const language = (body.language || "en-IN") as "hi-IN" | "ta-IN" | "en-IN";

    if (!query) {
      return NextResponse.json({ error: "Query is required", correlationId }, { status: 400 });
    }

    if (query.length > 500) {
      return NextResponse.json(
        { error: "Query exceeds maximum allowed length of 500 characters", correlationId },
        { status: 400 }
      );
    }

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
