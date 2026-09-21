// WeatherGPT — Web Push Subscription Registration Route
// Allows client browsers to register Web Push subscriptions for instant disaster alerts.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { savePushSubscription } from "@/lib/services/web-push";
import { isRateLimited } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  district: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = req.headers.get("x-forwarded-for") || "unknown-ip";

  if (await isRateLimited(`push-sub:${clientIp}`, 30, 60_000)) {
    return NextResponse.json(
      { error: "Too many subscription requests. Please slow down.", correlationId },
      { status: 429 }
    );
  }

  try {
    const json = await req.json();
    const parsed = subscriptionSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid subscription payload",
          details: parsed.error.issues.map((i) => i.message),
          correlationId,
        },
        { status: 400 }
      );
    }

    const saved = await savePushSubscription(parsed.data);

    return NextResponse.json(
      {
        success: saved,
        message: "Web push subscription registered successfully.",
        correlationId,
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("Failed to register web push subscription", {
      correlationId,
      error: (err as Error).message,
    });
    return NextResponse.json(
      { error: "Internal server error registering subscription", correlationId },
      { status: 500 }
    );
  }
}
