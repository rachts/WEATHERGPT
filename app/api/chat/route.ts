import { NextRequest, NextResponse } from "next/server";
import { processWeatherQuery } from "@/lib/services/query-pipeline";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body.query || "";
    const district = body.district || "Raigad";
    const language = (body.language || "hi-IN") as "hi-IN" | "ta-IN" | "en-IN";

    if (!query.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const response = await processWeatherQuery(query, district, language);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: "Error processing query", details: String(error) },
      { status: 500 }
    );
  }
}
