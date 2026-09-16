// WeatherGPT — Distributed Serverless Sliding-Window Rate Limiter (Upstash Redis + In-Memory Fallback)
// Implements true sliding-window rate limiting using Redis Sorted Sets and in-memory timestamp logs.
// Limits and windows are dynamically configurable via environment variables.

interface SlidingWindowRecord {
  timestamps: number[];
  lastSeen: number;
}

const memoryLimitMap = new Map<string, SlidingWindowRecord>();
const MAX_MEMORY_ENTRIES = 5000;

/**
 * Constructs a rate limit key that isolates sessions behind shared CG-NAT/carrier IPs.
 * For rural farmers sharing mobile carrier IPs, including sessionId prevents IP-wide blocking (M8).
 */
export function buildRateLimitIdentifier(
  scope: string,
  clientIp: string,
  sessionId?: string | null
): string {
  const cleanIp = (clientIp || "unknown-ip").trim();
  if (sessionId && sessionId.trim()) {
    return `${scope}:${sessionId.trim()}:${cleanIp}`;
  }
  return `${scope}:${cleanIp}`;
}

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
 * Synchronous in-memory true sliding-window limiter with active TTL cleanup and memory bounding.
 * Prunes timestamps strictly older than (now - windowDuration).
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
  const windowStart = now - windowDuration;

  // Automatic LRU-style pruning when approaching memory bounds
  if (memoryLimitMap.size > MAX_MEMORY_ENTRIES) {
    const expiredKeys: string[] = [];
    memoryLimitMap.forEach((record, key) => {
      if (record.lastSeen < windowStart) expiredKeys.push(key);
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
  const activeTimestamps = (record?.timestamps || []).filter((t) => t > windowStart);

  if (activeTimestamps.length >= limit) {
    // Over rate limit within current sliding window
    if (record) {
      record.timestamps = activeTimestamps;
      record.lastSeen = now;
    }
    return true;
  }

  // Under limit: record request timestamp in sliding window
  activeTimestamps.push(now);
  memoryLimitMap.set(identifier, {
    timestamps: activeTimestamps,
    lastSeen: now,
  });

  return false;
}

/**
 * Distributed true sliding-window rate limiter supporting Upstash Redis REST API across serverless functions.
 * Employs atomic sorted sets (ZREMRANGEBYSCORE + ZADD + ZCARD + EXPIRE) for true sliding window (M7).
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
  const now = Date.now();

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // If Upstash Redis credentials exist, use atomic sorted-set sliding window
  if (upstashUrl && upstashToken) {
    try {
      const windowStart = now - windowDuration;
      const expireSeconds = Math.ceil(windowDuration / 1000) * 2;
      const redisKey = `rl:${identifier}`;
      const uniqueMember = `${now}:${Math.random().toString(36).slice(2, 9)}`;

      const response = await fetch(`${upstashUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["ZREMRANGEBYSCORE", redisKey, "0", String(windowStart)],
          ["ZADD", redisKey, String(now), uniqueMember],
          ["ZCARD", redisKey],
          ["EXPIRE", redisKey, String(expireSeconds)],
        ]),
        signal: AbortSignal.timeout(1500),
      });

      if (response.ok) {
        const results = await response.json();
        // Index 2 is ZCARD output: number of requests in current sliding window
        const currentCount = results[2]?.result ?? 1;
        return currentCount > limit;
      }
    } catch {
      // Degrade silently to in-memory sliding limiter without crashing user request
    }
  }

  return isRateLimitedSync(identifier, limit, windowDuration);
}
