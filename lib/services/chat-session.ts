// WeatherGPT — Chat Session Continuity & Auto-Pruning Service (M15)
// Preserves conversation continuity across turns and enforces bounded storage via age-based pruning.

import { prisma } from "../prisma";
import { logger } from "../utils/logger";
import crypto from "node:crypto";

export interface ChatSessionRecord {
  id: string;
  title: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Retrieves an existing session or provisions a new one.
 * Ensures conversation continuity across multi-turn exchanges without orphaned rows.
 */
export async function getOrCreateChatSession(
  sessionId?: string | null,
  title?: string,
  language: string = "hi-IN"
): Promise<string> {
  const activeId = sessionId?.trim() || crypto.randomUUID();

  if (!process.env.DATABASE_URL) {
    return activeId;
  }

  try {
    const existing = await prisma.chatSession.findUnique({
      where: { id: activeId },
      select: { id: true },
    });

    if (existing) {
      await prisma.chatSession.update({
        where: { id: activeId },
        data: { updatedAt: new Date() },
      });
      return existing.id;
    }

    const created = await prisma.chatSession.create({
      data: {
        id: activeId,
        title: (title || "Weather Conversation").slice(0, 50),
        language,
      },
      select: { id: true },
    });

    return created.id;
  } catch (err) {
    logger.warn("Chat session getOrCreate notice (degrading to transient session)", {
      sessionId: activeId,
      error: (err as Error).message,
    });
    return activeId;
  }
}

/**
 * Appends user and assistant messages to an active chat session.
 */
export async function persistChatExchange(
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  meta?: { intent?: string; sourceProduct?: string; issueTime?: string }
): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  try {
    const issueDate = meta?.issueTime ? new Date(meta.issueTime) : undefined;
    const validIssueTime = issueDate && !isNaN(issueDate.getTime()) ? issueDate : undefined;

    await prisma.chatMessage.createMany({
      data: [
        {
          sessionId,
          role: "user",
          content: userMessage,
        },
        {
          sessionId,
          role: "assistant",
          content: assistantMessage,
          intent: meta?.intent,
          sourceProduct: meta?.sourceProduct,
          issueTime: validIssueTime,
        },
      ],
    });
  } catch (err) {
    logger.warn("Failed to persist chat exchange", {
      sessionId,
      error: (err as Error).message,
    });
  }
}

/**
 * Prunes expired chat sessions older than maxAgeDays (default: 30 days).
 * Cascades message deletions cleanly to prevent unbounded database growth (M15).
 */
export async function pruneOldChatSessions(maxAgeDays: number = 30): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;

  try {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    const result = await prisma.chatSession.deleteMany({
      where: {
        updatedAt: { lt: cutoff },
      },
    });

    if (result.count > 0) {
      logger.info("Pruned expired chat sessions", {
        count: result.count,
        cutoffIso: cutoff.toISOString(),
      });
    }

    return result.count;
  } catch (err) {
    logger.warn("Chat session pruning error", { error: (err as Error).message });
    return 0;
  }
}
