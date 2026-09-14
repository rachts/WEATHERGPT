import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ sessions: [], messages: [] });
    }

    if (sessionId) {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
      return NextResponse.json({ session, messages: session?.messages ?? [] });
    }

    const sessions = await prisma.chatSession.findMany({
      take: 10,
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.warn(`[Sessions API Warning - ${correlationId}]`, error);
    // Graceful fallback for offline / unconfigured database
    return NextResponse.json({ sessions: [], messages: [] });
  }
}
