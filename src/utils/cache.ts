/**
 * Cache Utility
 *
 * Simple in-memory cache with TTL and size limits.
 * Uses LRU (Least Recently Used) eviction when size limit reached.
 */

/**
 * Cache entry
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /**
   * Time-to-live in milliseconds
   */
  ttl: number;

  /**
   * Maximum number of entries (LRU eviction when exceeded)
   */
  maxSize: number;

  /**
   * Cache key prefix for namespacing
   */
  keyPrefix?: string;
}

/**
 * Simple in-memory cache with TTL and LRU eviction
 */
export class Cache<T> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private config: Required<CacheConfig>;
  private hits: number = 0;
  private misses: number = 0;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: CacheConfig) {
    this.config = {
      ttl: config.ttl,
      maxSize: config.maxSize,
      keyPrefix: config.keyPrefix || 'cache',
    };

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
    // Unref to allow process to exit if only cleanup interval is running
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Get value from cache
   *
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   *
   * @example
   * const value = cache.get('user_123');
   * if (value) {
   *   console.log('Cache hit:', value);
   * }
   */
  get(key: string): T | undefined {
    const fullKey = this.makeKey(key);
    const entry = this.store.get(fullKey);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(fullKey);
      this.misses++;
      return undefined;
    }

    // Update last accessed time (for LRU)
    entry.lastAccessed = Date.now();
    this.hits++;

    return entry.value;
  }

  /**
   * Set value in cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Optional custom TTL (overrides default)
   *
   * @example
   * cache.set('user_123', userData);
   * cache.set('temp_data', tempData, 5000); // 5 second TTL
   */
  set(key: string, value: T, ttl?: number): void {
    const fullKey = this.makeKey(key);
    const effectiveTtl = ttl || this.config.ttl;

    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + effectiveTtl,
      lastAccessed: Date.now(),
    };

    // Check if we need to evict (LRU)
    if (this.store.size >= this.config.maxSize && !this.store.has(fullKey)) {
      this.evictLRU();
    }

    this.store.set(fullKey, entry);
  }

  /**
   * Check if key exists in cache (without updating access time)
   *
   * @param key - Cache key
   * @returns True if key exists and not expired
   */
  has(key: string): boolean {
    const fullKey = this.makeKey(key);
    const entry = this.store.get(fullKey);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(fullKey);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   *
   * @param key - Cache key
   */
  delete(key: string): void {
    const fullKey = this.makeKey(key);
    this.store.delete(fullKey);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    return {
      size: this.store.size,
      maxSize: this.config.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate.toFixed(2) + '%',
      total,
    };
  }

  /**
   * Create full cache key with prefix
   */
  private makeKey(key: string): string {
    return `${this.config.keyPrefix}:${key}`;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[Cache:${this.config.keyPrefix}] Cleaned up ${cleanedCount} expired entries`);
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
 * Create a cache instance
 *
 * @param ttl - Time-to-live in milliseconds
 * @param maxSize - Maximum cache size
 * @param keyPrefix - Optional key prefix
 * @returns Cache instance
 */
export function createCache<T>(ttl: number, maxSize: number, keyPrefix?: string): Cache<T> {
  return new Cache<T>({ ttl, maxSize, keyPrefix });
}

/**
 * Generate cache key from object
 *
 * @param obj - Object to generate key from
 * @returns Deterministic cache key
 *
 * @example
 * const key = generateCacheKey({ userId: '123', query: 'donate' });
 * // Returns: 'userId:123|query:donate'
 */
export function generateCacheKey(obj: Record<string, any>): string {
  return Object.entries(obj)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
    .join('|');
}

