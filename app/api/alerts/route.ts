import { NextRequest, NextResponse } from "next/server";
import { fetchLiveImdDistrictAlerts, routeWarningDissemination, IMDWarningProduct } from "@/lib/services/alerts";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const district = searchParams.get("district") || "Raigad";
  const alerts = await fetchLiveImdDistrictAlerts(district);
  return NextResponse.json({ district, alerts });
}

export async function POST(req: NextRequest) {
  try {
    const warning = (await req.json()) as IMDWarningProduct;
    if (!warning.district || !warning.severity || !warning.warningText) {
      return NextResponse.json(
        { error: "Invalid alert payload: district, severity, and warningText are required" },
        { status: 400 }
      );
    }
    const result = routeWarningDissemination(warning);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to disseminate warning", details: String(error) },
      { status: 500 }
    );
  }
}
