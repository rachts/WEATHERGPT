// WeatherGPT — Conversational AI Chat API Route (Vercel AI SDK)
// Streams tool-calling meteorologist responses with multi-turn conversation memory.

import { NextRequest, NextResponse } from "next/server";
import { streamText, createUIMessageStreamResponse, isStepCount } from "ai";
import { getLanguageModel } from "@/lib/ai/models";
import { METEOROLOGIST_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { getWeather } from "@/lib/ai/tools";
import { detectCrisisMessage } from "@/lib/services/query-pipeline";
import { isRateLimited, getRateLimitConfig } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Extracts a district name mentioned in conversation history, or returns fallback.
 */
function resolveDistrictFromMessages(
  messages: Array<{ role: string; content: string }>,
  defaultDistrict = "Raigad"
): string {
  const commonDistricts = [
    "Kolkata", "Raigad", "Mumbai", "Pune", "Ludhiana", "Chennai", "Delhi",
    "Bengaluru", "Hyderabad", "Ahmedabad", "Jaipur", "Lucknow", "Patna",
    "Bhopal", "Nagpur", "Indore", "Thane", "Nashik", "Amritsar", "Coimbatore"
  ];

  // Scan backwards from latest user message
  for (let i = messages.length - 1; i >= 0; i--) {
    const text = messages[i].content || "";
    for (const dist of commonDistricts) {
      const regex = new RegExp(`\\b${dist}\\b`, "i");
      if (regex.test(text)) {
        return dist;
      }
    }
  }

  return defaultDistrict;
}

/**
 * Deterministic conversational natural-language synthesizer for offline/mock mode
 * when no LLM provider API key is configured.
 */
async function generateDeterministicBriefing(
  messages: Array<{ role: string; content: string }>,
  district: string
): Promise<string> {
  const latestMessage = messages[messages.length - 1]?.content || "";
  const queryLower = latestMessage.toLowerCase();

  // Execute official tool
  const weatherResult = await (getWeather.execute as any)({ district });

  if (weatherResult.error || !weatherResult.current) {
    return `Live observation telemetry from the IMD weather observatory for ${district} is temporarily unreachable right now. Please check back in a few minutes, or choose a nearby district.`;
  }

  const { current, forecastDaily, state } = weatherResult;
  const isTomorrow = queryLower.includes("tomorrow") || queryLower.includes("कल");
  const isDayAfter =
    queryLower.includes("day after") ||
    queryLower.includes("परसों") ||
    queryLower.includes("next day");

  // Determine targeted day from forecast
  let targetDay = forecastDaily?.[0];
  let timeLabel = "today";

  if (isDayAfter && forecastDaily?.[2]) {
    targetDay = forecastDaily[2];
    timeLabel = `${targetDay.day} (${targetDay.date})`;
  } else if (isTomorrow && forecastDaily?.[1]) {
    targetDay = forecastDaily[1];
    timeLabel = `tomorrow (${targetDay.day})`;
  }

  // Synthesize conversational response based on user intent
  if (queryLower.includes("rain") || queryLower.includes("बारिश") || queryLower.includes("वर्षा")) {
    const rainChance = targetDay?.pop ?? (targetDay?.rainfallMm > 0 ? 70 : 10);
    const rainMm = targetDay?.rainfallMm ?? 0;
    if (rainMm > 5 || rainChance > 60) {
      return `For **${district}** (${state}) ${timeLabel}, wet weather is anticipated with an expected rainfall of approximately **${rainMm} mm** and a **${rainChance}%** probability of precipitation. If you are planning pesticide spraying or grain drying, it is strongly recommended to postpone field applications until conditions stabilize.`;
    }
    return `For **${district}** (${state}) ${timeLabel}, primarily dry conditions are forecast. Rain probability remains low at **${rainChance}%** with ${rainMm > 0 ? `${rainMm} mm drizzle` : "no significant precipitation expected"}. Weather conditions will remain favorable for harvesting and routine agricultural tasks.`;
  }

  if (queryLower.includes("temp") || queryLower.includes("तापमान") || queryLower.includes("hot") || queryLower.includes("cold")) {
    const min = targetDay?.tempMin ?? current.temperature - 4;
    const max = targetDay?.tempMax ?? current.temperature + 3;
    return `In **${district}** (${state}), temperatures ${timeLabel} are expected to range between **${min}°C** and **${max}°C** with ${targetDay?.condition?.toLowerCase() || current.condition?.toLowerCase() || "fair skies"}. Humidity will hover around **${current.humidity}%**.`;
  }

  // General comprehensive briefing
  return `In **${district}** (${state}), current weather is **${current.condition}** with a temperature of **${current.temperature}°C** and relative humidity at **${current.humidity}%**. Winds are moving from the ${current.windDirection} at **${current.windSpeed} km/h**. Over the next 24–48 hours, conditions will remain predominantly ${targetDay?.condition?.toLowerCase() || "fair"}, with day temperatures reaching up to **${targetDay?.tempMax ?? current.temperature}°C**.`;
}

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  const clientIp = req.headers.get("x-forwarded-for") || "unknown-ip";

  // Rate limiting (configurable AI rate limit)
  const rateLimitConfig = getRateLimitConfig("ai");
  if (await isRateLimited(`chat:${clientIp}`, rateLimitConfig.maxRequests, rateLimitConfig.windowMs)) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many chat requests. Please slow down.",
          requestId: correlationId,
        },
      },
      { status: 429 }
    );
  }

  try {
    const rawBody = await req.json();

    // Normalizing messages from either standard useChat body or legacy payload
    let messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];

    if (Array.isArray(rawBody.messages) && rawBody.messages.length > 0) {
      messages = rawBody.messages.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
        content: typeof m.content === "string" ? m.content : String(m.content || ""),
      }));
    } else if (typeof rawBody.query === "string" && rawBody.query.trim()) {
      messages = [{ role: "user", content: rawBody.query.trim() }];
    } else {
      return NextResponse.json(
        { error: "A non-empty query or messages array is required.", requestId: correlationId },
        { status: 400 }
      );
    }

    const latestUserMessage = messages[messages.length - 1];
    const userQuery = latestUserMessage?.content || "";

    // 1. Safety & Crisis Interception (Tele MANAS 14416)
    if (detectCrisisMessage(userQuery)) {
      const crisisText =
        "यदि आप या आपका कोई परिचित मानसिक तनाव, अवसाद या संकट से जूझ रहा है, तो कृपया तुरंत सहायता लें। भारत सरकार की 24x7 निःशुल्क हेल्पलाइन सेवाएँ:\n\n" +
        "- **टेली-मानस (Tele MANAS)**: **14416** या **1800-891-4416**\n" +
        "- **किसान कॉल सेंटर**: **1800-180-1551**\n\n" +
        "आप अकेले नहीं हैं। कृपया अभी संपर्क करें, विशेषज्ञ परामर्शदाता सहायता के लिए सदैव उपलब्ध हैं।";

      const stream = new ReadableStream({
        start(controller) {
          const id = crypto.randomUUID();
          controller.enqueue({ type: "text-start", id });
          controller.enqueue({ type: "text-delta", id, delta: crisisText });
          controller.enqueue({ type: "text-end", id });
          controller.enqueue({ type: "finish", finishReason: "stop" });
          controller.close();
        },
      });

      return createUIMessageStreamResponse({ stream });
    }

    // 2. Select Language Model (Gemini / OpenAI)
    const model = getLanguageModel();

    const activeDistrict = resolveDistrictFromMessages(
      messages,
      rawBody.district || "Kolkata"
    );

    // If model is configured with valid API key, run Vercel AI SDK tool calling
    if (model) {
      const result = streamText({
        model,
        system: METEOROLOGIST_SYSTEM_PROMPT,
        messages: messages as any,
        tools: { getWeather: getWeather as any },
        stopWhen: isStepCount(3),
        onFinish: async ({ text }) => {
          if (process.env.DATABASE_URL) {
            try {
              const session = await prisma.chatSession.create({
                data: {
                  title: userQuery.slice(0, 40),
                  language: "hi-IN",
                },
              });
              await prisma.chatMessage.createMany({
                data: [
                  { sessionId: session.id, role: "user", content: userQuery },
                  { sessionId: session.id, role: "assistant", content: text },
                ],
              });
            } catch (err) {
              logger.warn("Chat session persistence failed", {
                correlationId,
                error: (err as Error).message,
              });
            }
          }
        },
      });

      return result.toUIMessageStreamResponse({
        onError: (err) => {
          logger.warn("LLM streaming error intercepted", {
            correlationId,
            error: (err as Error).message,
          });
          return "Weather briefing service is operating with degraded live AI. Factual meteorological readings remain operational.";
        },
      });
    }

    // 3. Fallback for offline / demo environments without API key
    // Resolves context across multi-turn messages and executes official getWeather tool

    const naturalLanguageResponse = await generateDeterministicBriefing(
      messages,
      activeDistrict
    );

    const stream = new ReadableStream({
      start(controller) {
        const id = crypto.randomUUID();
        controller.enqueue({ type: "text-start", id });

        // Stream tokens in natural conversational chunks
        const words = naturalLanguageResponse.split(" ");
        let index = 0;

        function pushChunk() {
          if (index < words.length) {
            const chunk = (index === 0 ? "" : " ") + words[index++];
            controller.enqueue({ type: "text-delta", id, delta: chunk });
            setTimeout(pushChunk, 15);
          } else {
            controller.enqueue({ type: "text-end", id });
            controller.enqueue({ type: "finish", finishReason: "stop" });
            controller.close();
          }
        }

        pushChunk();
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    logger.error("Chat API processing failure", {
      correlationId,
      error: (error as Error).message,
    });

    return NextResponse.json(
      {
        error: {
          code: "CHAT_PROCESSING_ERROR",
          message: "Unable to process conversation at this time. Please try again.",
          requestId: correlationId,
        },
      },
      { status: 500 }
    );
  }
}
