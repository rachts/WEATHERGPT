// WeatherGPT — Distributed Serverless Rate Limiter (Upstash Redis + Bounded In-Memory Fallback)
// Limits and windows are dynamically configurable via environment variables.

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const memoryLimitMap = new Map<string, RateLimitRecord>();
const MAX_MEMORY_ENTRIES = 5000;

/**
 * Global rate-limiting configuration from environment variables.
 * Default: 60 requests per 60 seconds (1 req/s average burst capacity).
 * Configurable via RATE_LIMIT_MAX_REQUESTS and RATE_LIMIT_WINDOW_SECONDS.
 */
export function getRateLimitConfig(type: "default" | "ai" | "weather" | "alert" = "default") {
  const windowSeconds = parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || "60", 10);
  const windowMs = Math.max(1, windowSeconds) * 1000;

  switch (type) {
    case "ai": {
      // AI endpoints are cost-intensive and compute-heavy; limit to 30 req/min
      const max = parseInt(process.env.RATE_LIMIT_AI_MAX_REQUESTS || "30", 10);
      return { maxRequests: max, windowMs };
    }
    case "weather": {
      // Weather endpoints support farmer dashboard navigation; allow 120 req/min
      const max = parseInt(process.env.RATE_LIMIT_WEATHER_MAX_REQUESTS || "120", 10);
      return { maxRequests: max, windowMs };
    }
    case "alert": {
      // Alert ingestion endpoint; limit to 15 emergency ingestions/min
      const max = parseInt(process.env.RATE_LIMIT_ALERT_MAX_REQUESTS || "15", 10);
      return { maxRequests: max, windowMs };
    }
    default: {
      const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "60", 10);
      return { maxRequests: max, windowMs };
    }
  }
}

/**
 * Synchronous in-memory sliding-window fallback with active TTL cleanup and memory bounding.
 */
export function isRateLimitedSync(
  identifier: string,
  maxRequests?: number,
  windowMs?: number
): boolean {
  const config = getRateLimitConfig("default");
  const limit = maxRequests ?? config.maxRequests;
  const windowDuration = windowMs ?? config.windowMs;
  const now = Date.now();

  // Automatic LRU-style pruning when approaching memory bounds
  if (memoryLimitMap.size > MAX_MEMORY_ENTRIES) {
    const expiredKeys: string[] = [];
    memoryLimitMap.forEach((record, key) => {
      if (now > record.resetTime) expiredKeys.push(key);
    });
    expiredKeys.forEach((key) => memoryLimitMap.delete(key));

    // If still oversized, clear oldest 1000 entries
    if (memoryLimitMap.size > MAX_MEMORY_ENTRIES) {
      let count = 0;
      for (const key of Array.from(memoryLimitMap.keys())) {
        if (count++ > 1000) break;
        memoryLimitMap.delete(key);
      }
    }
  }

  const record = memoryLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    memoryLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowDuration,
    });
    return false;
  }

  record.count += 1;
  return record.count > limit;
}

/**
 * Distributed rate limiter supporting Upstash Redis REST API across serverless functions.
 * Degrades seamlessly to bounded in-memory sliding window if Redis is not configured or network drops.
 */
export async function isRateLimited(
  identifier: string,
  maxRequests?: number,
  windowMs?: number
): Promise<boolean> {
  const config = getRateLimitConfig("default");
  const limit = maxRequests ?? config.maxRequests;
  const windowDuration = windowMs ?? config.windowMs;

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // If Upstash Redis credentials exist, use atomic pipeline INCR + EXPIRE
  if (upstashUrl && upstashToken) {
    try {
      const windowSeconds = Math.ceil(windowDuration / 1000);
      const redisKey = `rl:${identifier}`;

      const response = await fetch(`${upstashUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", redisKey],
          ["EXPIRE", redisKey, windowSeconds],
        ]),
        signal: AbortSignal.timeout(1500),
      });

      if (response.ok) {
        const results = await response.json();
        const currentCount = results[0]?.result ?? 1;
        return currentCount > limit;
      }
    } catch {
      // Degrade silently to in-memory limiter without crashing user request
    }
  }

  return isRateLimitedSync(identifier, limit, windowDuration);
}
