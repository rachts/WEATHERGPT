import { NextRequest, NextResponse } from "next/server";
import { getDistrictWeather } from "@/lib/services/weather-data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const district = searchParams.get("district") || "Raigad";
  const simulateImdFailure = searchParams.get("simulateImdFailure") === "true";
  const simulateNetworkFailure = searchParams.get("simulateNetworkFailure") === "true";

  try {
    const data = await getDistrictWeather(district, false, simulateImdFailure, simulateNetworkFailure);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to retrieve weather data", details: String(error) },
      { status: 500 }
    );
  }
}
