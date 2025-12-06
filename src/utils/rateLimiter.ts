/**
 * Rate Limiting Utility
 *
 * Implements token bucket algorithm for rate limiting.
 * Supports per-user, per-IP, and global rate limits.
 */

import { RateLimitError } from '../errors/AppErrors';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the time window
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Optional custom key prefix for storage
   */
  keyPrefix?: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Number of requests remaining in current window
   */
  remaining: number;

  /**
   * When the rate limit resets (Unix timestamp in ms)
   */
  resetAt: number;

  /**
   * Total limit for this window
   */
  limit: number;

  /**
   * Time until reset in milliseconds
   */
  retryAfterMs?: number;
}

/**
 * Token bucket for a specific key
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
  resetAt: number;
}

/**
 * Rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private config: Required<RateLimitConfig>;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      keyPrefix: config.keyPrefix || 'ratelimit',
    };

    // Cleanup expired buckets every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
    // Unref to allow process to exit if only cleanup interval is running
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Check if request is allowed and consume a token
   *
   * @param key - Unique identifier (userId, IP, etc.)
   * @returns Rate limit result
   *
   * @example
   * const result = rateLimiter.checkLimit('user_123');
   * if (!result.allowed) {
   *   throw new RateLimitError(result.limit, result.retryAfterMs);
   * }
   */
  checkLimit(key: string): RateLimitResult {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const now = Date.now();

    // Get or create bucket
    let bucket = this.buckets.get(fullKey);

    if (!bucket) {
      bucket = {
        tokens: this.config.maxRequests,
        lastRefill: now,
        resetAt: now + this.config.windowMs,
      };
      this.buckets.set(fullKey, bucket);
    }

    // Refill bucket if window has passed
    if (now >= bucket.resetAt) {
      bucket.tokens = this.config.maxRequests;
      bucket.lastRefill = now;
      bucket.resetAt = now + this.config.windowMs;
    }

    // Check if tokens available
    const allowed = bucket.tokens > 0;

    if (allowed) {
      bucket.tokens--;
    }

    const retryAfterMs = allowed ? undefined : bucket.resetAt - now;

    return {
      allowed,
      remaining: bucket.tokens,
      resetAt: bucket.resetAt,
      limit: this.config.maxRequests,
      retryAfterMs,
    };
  }

  /**
   * Check limit and throw if exceeded
   *
   * @param key - Unique identifier
   * @throws RateLimitError if limit exceeded
   *
   * @example
   * rateLimiter.enforceLimit('user_123');
   */
  enforceLimit(key: string): void {
    const result = this.checkLimit(key);

    if (!result.allowed) {
      throw new RateLimitError(
        result.limit,
        result.retryAfterMs,
        { key, resetAt: new Date(result.resetAt) }
      );
    }
  }

  /**
   * Get current status without consuming a token
   *
   * @param key - Unique identifier
   * @returns Rate limit result (read-only)
   */
  getStatus(key: string): RateLimitResult {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const now = Date.now();
    const bucket = this.buckets.get(fullKey);

    if (!bucket) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: now + this.config.windowMs,
        limit: this.config.maxRequests,
      };
    }

    // Check if window has passed
    if (now >= bucket.resetAt) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: now + this.config.windowMs,
        limit: this.config.maxRequests,
      };
    }

    return {
      allowed: bucket.tokens > 0,
      remaining: bucket.tokens,
      resetAt: bucket.resetAt,
      limit: this.config.maxRequests,
      retryAfterMs: bucket.tokens > 0 ? undefined : bucket.resetAt - now,
    };
  }

  /**
   * Reset limit for a specific key
   *
   * @param key - Unique identifier
   */
  reset(key: string): void {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    this.buckets.delete(fullKey);
  }

  /**
   * Reset all limits
   */
  resetAll(): void {
    this.buckets.clear();
  }

  /**
   * Cleanup expired buckets
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, bucket] of this.buckets.entries()) {
      // Remove buckets that expired more than 1 hour ago
      if (now > bucket.resetAt + 3600000) {
        this.buckets.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[RateLimiter] Cleaned up ${cleanedCount} expired buckets`);
    }
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

/**
 * Create a rate limiter with standard configuration
 *
 * @param maxRequests - Max requests per window
 * @param windowMs - Time window in milliseconds
 * @param keyPrefix - Optional key prefix
 * @returns RateLimiter instance
 */
export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
  keyPrefix?: string
): RateLimiter {
  return new RateLimiter({ maxRequests, windowMs, keyPrefix });
}

