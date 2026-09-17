// WeatherGPT — Shared Distributed Cache Provider
// Provides two-tier caching:
// L1: In-memory Process Cache
// L2: Upstash REST / Redis Shared Cache (when configured via UPSTASH_REDIS_REST_URL)

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MAX_MEMORY_CACHE_ENTRIES = 1000;
const memoryCache = new Map<string, CacheEntry<unknown>>();

function pruneMemoryCache(now: number): void {
  // 1. Remove expired items
  for (const [k, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(k);
    }
  }

  // 2. If still exceeding limit, evict oldest inserted entries (FIFO/LRU)
  if (memoryCache.size >= MAX_MEMORY_CACHE_ENTRIES) {
    const keysToEvict = Array.from(memoryCache.keys()).slice(0, Math.floor(MAX_MEMORY_CACHE_ENTRIES * 0.2));
    for (const key of keysToEvict) {
      memoryCache.delete(key);
    }
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const now = Date.now();

  // 1. Check L1 Memory Cache
  const local = memoryCache.get(key);
  if (local) {
    if (local.expiresAt > now) {
      return local.value as T;
    }
    memoryCache.delete(key);
  }

  // 2. Check L2 Upstash Redis if configured
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const res = await fetch(`${upstashUrl}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.result !== null && json.result !== undefined) {
          const parsed = typeof json.result === "string" ? JSON.parse(json.result) : json.result;
          // Store in L1 for 60s
          if (memoryCache.size >= MAX_MEMORY_CACHE_ENTRIES) {
            pruneMemoryCache(now);
          }
          memoryCache.set(key, { value: parsed, expiresAt: now + 60_000 });
          return parsed as T;
        }
      }
    } catch {
      // Degrade to memory cache on network or timeout failure
    }
  }

  return null;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
  const now = Date.now();
  const ttlMs = ttlSeconds * 1000;

  // 1. Write to L1 Memory Cache with capacity guard
  if (memoryCache.size >= MAX_MEMORY_CACHE_ENTRIES) {
    pruneMemoryCache(now);
  }
  memoryCache.set(key, { value, expiresAt: now + ttlMs });

  // 2. Write to L2 Upstash Redis if configured
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      await fetch(`${upstashUrl}/set/${encodeURIComponent(key)}?ex=${ttlSeconds}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(value),
        signal: AbortSignal.timeout(1500),
      });
    } catch {
      // Ignore network errors on background cache write
    }
  }
}
