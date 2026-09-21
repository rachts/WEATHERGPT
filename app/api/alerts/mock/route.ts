import { NextRequest, NextResponse } from "next/server";
import { injectJudgeSevereAlert } from "@/lib/services/alerts";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const district = typeof body?.district === "string" ? body.district : "Raigad";
    const state = typeof body?.state === "string" ? body.state : "Maharashtra";

    const { alert, dissemination } = await injectJudgeSevereAlert(district, state);

    return NextResponse.json({
      success: true,
      data: {
        alert,
        dissemination,
      },
      message: `Injected mock Red Alert Severe Cyclonic Storm for ${district}. Dissemination routed via SMS/IVR gateways.`,
    });
  } catch (err: unknown) {
    logger.error("Failed to inject judge severe alert", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to inject mock alert",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const district = searchParams.get("district") || "Raigad";
  const state = searchParams.get("state") || "Maharashtra";

  try {
    const { alert, dissemination } = await injectJudgeSevereAlert(district, state);
    return NextResponse.json({
      success: true,
      data: {
        alert,
        dissemination,
      },
      message: `Injected mock Red Alert Severe Cyclonic Storm for ${district}. Dissemination routed via SMS/IVR gateways.`,
    });
  } catch (err: unknown) {
    logger.error("Failed to inject judge severe alert", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to inject mock alert",
      },
      { status: 500 }
    );
  }
}
