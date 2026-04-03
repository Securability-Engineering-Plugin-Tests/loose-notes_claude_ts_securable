/**
 * Simple in-process rate limiter for API routes.
 *
 * SSEM: Availability — prevents brute-force and resource exhaustion.
 * PRD anti-patterns corrected: PRD §2.2, §4.3 explicitly required no rate
 * limiting on auth and password-recovery endpoints. We enforce it.
 *
 * Note: In-process state works within a single Vercel function instance.
 * For multi-instance production use, replace with Redis-backed limiter
 * (e.g. @upstash/ratelimit) — the interface is intentionally kept swappable.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  /** Maximum requests allowed within windowMs. */
  limit: number;
  /** Time window in milliseconds. */
  windowMs: number;
}

const store = new Map<string, RateLimitEntry>();

/** Clean up expired entries every 5 minutes to prevent memory growth. */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > 300_000) {
      store.delete(key);
    }
  }
}, 300_000);

/**
 * Check and increment rate limit for a given key.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > config.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= config.limit) {
    const retryAfterMs = config.windowMs - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count++;
  return { allowed: true };
}

/** Pre-configured limits for common endpoint types. */
export const RATE_LIMITS = {
  /** 10 login attempts per 15 minutes per IP */
  AUTH: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** 5 password recovery attempts per hour per IP */
  PASSWORD_RECOVERY: { limit: 5, windowMs: 60 * 60 * 1000 },
  /** 60 general API calls per minute per IP */
  API_GENERAL: { limit: 60, windowMs: 60 * 1000 },
  /** 30 email autocomplete lookups per minute per IP */
  AUTOCOMPLETE: { limit: 30, windowMs: 60 * 1000 },
} as const;
