import { NextRequest, NextResponse } from "next/server";
import { generateGroundedResponse } from "@/lib/services/rag";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body.query || "";
    const district = body.district || "Raigad";
    const language = (body.language || "en-IN") as "hi-IN" | "ta-IN" | "en-IN";

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const result = await generateGroundedResponse(query, district, language);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "RAG generation failed", details: String(error) },
      { status: 500 }
    );
  }
}
