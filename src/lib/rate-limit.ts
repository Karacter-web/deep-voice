// In-memory sliding-window rate limiter.
//
// LIMITATION: this is per-worker-process and resets on cold start. It does
// NOT survive across multiple workers and is NOT durable. For real
// production rate limiting, back this with Redis / Upstash / Cloudflare KV
// or a dedicated Postgres table — see TODO Phase 10.

type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Unique key (e.g. `convertVoice:${userId}`). */
  key: string;
  /** Max requests allowed in the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t > cutoff);
  if (bucket.hits.length >= limit) {
    const retryAfterMs = Math.max(1000, bucket.hits[0]! + windowMs - now);
    return { ok: false as const, retryAfterMs };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true as const, remaining: limit - bucket.hits.length };
}

export function enforceRateLimit(opts: RateLimitOptions) {
  const r = checkRateLimit(opts);
  if (!r.ok) {
    throw new Error(
      `Rate limit exceeded. Try again in ${Math.ceil(r.retryAfterMs / 1000)}s.`,
    );
  }
}
