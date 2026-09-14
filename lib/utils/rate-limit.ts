// Simple sliding-window in-memory rate limiter for serverless endpoints

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * Check if an IP or identifier has exceeded rate limits.
 * @param identifier Unique key (e.g. client IP or route identifier)
 * @param maxRequests Maximum requests allowed within windowMs
 * @param windowMs Window duration in milliseconds (default 60s)
 */
export function isRateLimited(
  identifier: string,
  maxRequests: number = 60,
  windowMs: number = 60_000
): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  // Clean up expired records occasionally
  if (rateLimitMap.size > 1000) {
    rateLimitMap.forEach((val, key) => {
      if (now > val.resetTime) {
        rateLimitMap.delete(key);
      }
    });
  }

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return false;
  }

  record.count += 1;
  return record.count > maxRequests;
}
