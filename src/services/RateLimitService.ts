/**
 * Rate Limit Service
 *
 * Centralized rate limiting for all API operations.
 * Supports per-user, per-IP, and global limits.
 */

import { RateLimiter, createRateLimiter } from '../utils/rateLimiter';
import { RATE_LIMIT_CONSTANTS } from '../config/constants';
import { RateLimitError } from '../errors/AppErrors';

/**
 * Rate limit tier
 */
export type RateLimitTier = 'user' | 'admin' | 'ip' | 'global' | 'expensive';

/**
 * User context for rate limiting
 */
export interface RateLimitContext {
  userId?: string;
  userRole?: 'user' | 'guardian' | 'admin' | 'investor' | 'lead_investor' | 'partner';
  ipAddress?: string;
}

/**
 * Rate limit service singleton
 */
export class RateLimitService {
  private static instance: RateLimitService;

  // Rate limiters for different tiers
  private userLimiter: RateLimiter;
  private adminLimiter: RateLimiter;
  private ipLimiter: RateLimiter;
  private globalLimiter: RateLimiter;
  private expensiveLimiter: RateLimiter;

  private constructor() {
    // Initialize rate limiters
    this.userLimiter = createRateLimiter(
      RATE_LIMIT_CONSTANTS.USER_REQUESTS_PER_HOUR,
      RATE_LIMIT_CONSTANTS.USER_WINDOW_MS,
      'user'
    );

    this.adminLimiter = createRateLimiter(
      RATE_LIMIT_CONSTANTS.ADMIN_REQUESTS_PER_HOUR,
      RATE_LIMIT_CONSTANTS.ADMIN_WINDOW_MS,
      'admin'
    );

    this.ipLimiter = createRateLimiter(
      RATE_LIMIT_CONSTANTS.IP_REQUESTS_PER_HOUR,
      RATE_LIMIT_CONSTANTS.IP_WINDOW_MS,
      'ip'
    );

    this.globalLimiter = createRateLimiter(
      RATE_LIMIT_CONSTANTS.GLOBAL_REQUESTS_PER_HOUR,
      RATE_LIMIT_CONSTANTS.GLOBAL_WINDOW_MS,
      'global'
    );

    this.expensiveLimiter = createRateLimiter(
      RATE_LIMIT_CONSTANTS.EXPENSIVE_REQUESTS_PER_HOUR,
      RATE_LIMIT_CONSTANTS.EXPENSIVE_WINDOW_MS,
      'expensive'
    );

    console.log('[RateLimitService] ✅ Initialized with multi-tier rate limiting');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  /**
   * Check rate limit for a request
   *
   * @param context - User/IP context
   * @param tier - Rate limit tier (default: 'user')
   * @throws RateLimitError if limit exceeded
   *
   * @example
   * rateLimitService.checkLimit({ userId: '123', userRole: 'user' });
   */
  checkLimit(context: RateLimitContext, tier: RateLimitTier = 'user'): void {
    // Always check global limit first
    this.globalLimiter.enforceLimit('global');

    // Check IP limit if IP provided
    if (context.ipAddress) {
      this.ipLimiter.enforceLimit(context.ipAddress);
    }

    // Check user-specific limit
    if (context.userId) {
      // Admins get higher limits
      const isAdmin = context.userRole === 'admin' || context.userRole === 'lead_investor';
      const limiter = isAdmin ? this.adminLimiter : this.userLimiter;
      limiter.enforceLimit(context.userId);
    }

    // Check expensive operation limit if applicable
    if (tier === 'expensive' && context.userId) {
      this.expensiveLimiter.enforceLimit(context.userId);
    }
  }

  /**
   * Check rate limit for expensive operations (embedding, vector search)
   *
   * @param context - User/IP context
   * @throws RateLimitError if limit exceeded
   */
  checkExpensiveLimit(context: RateLimitContext): void {
    this.checkLimit(context, 'expensive');
  }

  /**
   * Get current status for a user (without consuming a token)
   *
   * @param userId - User ID
   * @param userRole - User role
   * @returns Rate limit status
   */
  getStatus(userId: string, userRole?: string) {
    const isAdmin = userRole === 'admin' || userRole === 'lead_investor';
    const limiter = isAdmin ? this.adminLimiter : this.userLimiter;

    return {
      user: limiter.getStatus(userId),
      expensive: this.expensiveLimiter.getStatus(userId),
      global: this.globalLimiter.getStatus('global'),
    };
  }

  /**
   * Reset limits for a user (admin function)
   *
   * @param userId - User ID
   */
  resetUser(userId: string): void {
    this.userLimiter.reset(userId);
    this.adminLimiter.reset(userId);
    this.expensiveLimiter.reset(userId);
    console.log(`[RateLimitService] Reset limits for user: ${userId}`);
  }

  /**
   * Reset all limits (admin function, use with caution)
   */
  resetAll(): void {
    this.userLimiter.resetAll();
    this.adminLimiter.resetAll();
    this.ipLimiter.resetAll();
    this.globalLimiter.resetAll();
    this.expensiveLimiter.resetAll();
    console.log('[RateLimitService] ⚠️  All rate limits reset');
  }
}

/**
 * Get rate limit service instance
 */
export function getRateLimitService(): RateLimitService {
  return RateLimitService.getInstance();
}

