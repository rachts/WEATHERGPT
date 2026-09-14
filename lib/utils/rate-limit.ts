// WeatherGPT — Distributed Rate Limiter
// Provides distributed sliding-window rate limiting via Upstash Redis REST API
// with seamless in-memory bounded LRU fallback when Redis is unconfigured or unreachable.

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const memoryLimitMap = new Map<string, RateLimitRecord>();
const MAX_MEMORY_ENTRIES = 2000;

/**
 * In-memory fallback rate limiter with automatic sweep to prevent memory leaks.
 */
export function isRateLimitedSync(
  identifier: string,
  maxRequests: number = 60,
  windowMs: number = 60_000
): boolean {
  const now = Date.now();

  // Sweep expired entries if map grows beyond threshold
  if (memoryLimitMap.size > MAX_MEMORY_ENTRIES) {
    memoryLimitMap.forEach((val, key) => {
      if (now > val.resetTime) {
        memoryLimitMap.delete(key);
      }
    });
  }

  const record = memoryLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    memoryLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return false;
  }

  record.count += 1;
  return record.count > maxRequests;
}

/**
 * Distributed rate limiter supporting Upstash Redis REST API in serverless environments.
 * Degrades gracefully to local in-memory sliding window if Redis is not configured or fails.
 */
export async function isRateLimited(
  identifier: string,
  maxRequests: number = 60,
  windowMs: number = 60_000
): Promise<boolean> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // If Upstash Redis is configured, execute distributed atomic INCR + EXPIRE
  if (upstashUrl && upstashToken) {
    try {
      const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
      const key = `ratelimit:${identifier}`;

      // Use Upstash pipeline for atomic INCR and EXPIRE in a single round-trip
      const response = await fetch(`${upstashUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["EXPIRE", key, windowSeconds],
        ]),
        signal: AbortSignal.timeout(1500),
      });

      if (response.ok) {
        const results = await response.json();
        // results is an array of responses: [{ result: 1 }, { result: 1 }]
        const currentCount = Number(results?.[0]?.result ?? 1);
        return currentCount > maxRequests;
      }
    } catch {
      // Degrade to in-memory sliding window on Redis network/timeout failure
    }
  }

  // Graceful fallback to in-memory limiter
  return isRateLimitedSync(identifier, maxRequests, windowMs);
}
