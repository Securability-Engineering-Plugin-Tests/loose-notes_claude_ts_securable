/**
 * In-process token bucket rate limiter.
 *
 * FIASSE: replaces the PRD §2.2 / §4.3 / §15.2 explicit "no rate limiting,
 * no lockout" requirements. Mitigates credential-stuffing, recovery-token
 * brute-force, and email-enumeration scraping (S3.2.3.1 Availability,
 * S3.2.2.3 Authenticity).
 *
 * Trade-off (S2.3 Reducing Material Impact): an in-process bucket does not
 * coordinate across function instances. For multi-instance production, swap
 * to a shared store (Vercel KV / Redis) — the call-sites do not change.
 */

import type { VercelRequest } from '@vercel/node';
import { AppError } from './errors.js';
import { logger } from './logger.js';

interface Bucket {
  tokens: number;
  updatedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __rateLimitBuckets: Map<string, Bucket> | undefined;
}

const buckets: Map<string, Bucket> = globalThis.__rateLimitBuckets ?? new Map();
globalThis.__rateLimitBuckets = buckets;

/**
 * Identify the client for rate-limiting purposes. Prefers x-forwarded-for
 * leftmost (Vercel's proxy) but never trusts an empty/malformed header.
 *
 * Boundary defensiveness: x-forwarded-for is a comma-separated list; we
 * take the leftmost non-empty entry and clamp length to avoid abuse.
 */
export function clientIdentifier(req: VercelRequest, fallbackKey: string): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  if (typeof raw === 'string' && raw.length > 0) {
    const first = raw.split(',')[0]?.trim() ?? '';
    if (first.length > 0 && first.length <= 64) return first;
  }
  // Vercel sets x-real-ip; fall back to it, then to a synthetic key so
  // rate-limit keys never collide on a literally empty value.
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0 && realIp.length <= 64) return realIp;
  return `nokey:${fallbackKey}`;
}

export interface RateLimitConfig {
  capacity: number;
  refillPerSecond: number;
}

/**
 * Spend one token from the bucket identified by `key`. Throws AppError(429)
 * when the bucket is empty.
 */
export function consume(key: string, cfg: RateLimitConfig): void {
  const now = Date.now();
  const existing = buckets.get(key);
  let bucket: Bucket;
  if (existing) {
    const elapsedSec = (now - existing.updatedAt) / 1000;
    const refilled = Math.min(cfg.capacity, existing.tokens + elapsedSec * cfg.refillPerSecond);
    bucket = { tokens: refilled, updatedAt: now };
  } else {
    bucket = { tokens: cfg.capacity, updatedAt: now };
  }
  if (bucket.tokens < 1) {
    bucket.updatedAt = now;
    buckets.set(key, bucket);
    logger.warn('ratelimit.deny', { key, capacity: cfg.capacity });
    throw new AppError('rate_limited', 'Too many requests — please slow down');
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);

  // Opportunistic cleanup so the map does not grow unbounded.
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) {
      if (now - b.updatedAt > 600_000 && b.tokens >= cfg.capacity) buckets.delete(k);
    }
  }
}

/** Convenience presets matched to the threat-model of each endpoint family. */
export const limits = {
  login:           { capacity: 5,   refillPerSecond: 5 / 60 },     // 5 / minute / IP
  register:        { capacity: 3,   refillPerSecond: 3 / 600 },    // 3 / 10 min / IP
  resetRequest:    { capacity: 3,   refillPerSecond: 3 / 600 },    // 3 / 10 min / IP
  resetConfirm:    { capacity: 5,   refillPerSecond: 5 / 600 },    // 5 / 10 min / IP
  shareCreate:     { capacity: 30,  refillPerSecond: 30 / 60 },    // 30 / min / user
  noteWrite:       { capacity: 60,  refillPerSecond: 60 / 60 },    // 60 / min / user
  search:          { capacity: 60,  refillPerSecond: 60 / 60 },    // 60 / min / user
  upload:          { capacity: 10,  refillPerSecond: 10 / 60 },    // 10 / min / user
  emailLookup:     { capacity: 20,  refillPerSecond: 20 / 60 },    // 20 / min / user
  adminAction:     { capacity: 30,  refillPerSecond: 30 / 60 },    // 30 / min / admin
} as const;
