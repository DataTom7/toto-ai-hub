/**
 * Semantic Caching Service
 *
 * Caches semantically similar queries to reduce API calls and costs.
 * Uses embeddings to determine query similarity and cache responses.
 *
 * Features:
 * - Semantic similarity-based caching (not exact match)
 * - Embedding-based cache key generation
 * - TTL (time-to-live) management
 * - Cache hit/miss analytics
 * - Automatic cache invalidation
 * - LRU eviction policy
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Cached response
 */
export interface CachedResponse {
  query: string;
  embedding: number[];
  response: string;
  timestamp: Date;
  hits: number;
  metadata?: any;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  totalQueries: number;
  costSavings: number; // Estimated cost savings in dollars
}

/**
 * SemanticCachingService - Intelligent query caching
 */
export class SemanticCachingService {
  private genAI: GoogleGenerativeAI;
  private cache: Map<string, CachedResponse> = new Map();

  // Configuration
  private readonly SIMILARITY_THRESHOLD = 0.85; // Min similarity to consider cache hit
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour
  private readonly MAX_CACHE_SIZE = 1000;

  // Analytics
  private stats: CacheStats = {
    size: 0,
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalQueries: 0,
    costSavings: 0,
  };

  // Cost per query (Gemini 2.0 Flash: ~$0.075 per 1M input tokens, avg 500 tokens/query)
  private readonly COST_PER_QUERY = 0.0000375; // $0.0375 per 1000 queries

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
    console.log('[SemanticCachingService] Initialized with semantic similarity threshold:', this.SIMILARITY_THRESHOLD);
  }

  /**
   * Generate embedding for query
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Use a simple hash-based embedding for now
      // In production, use proper embedding model like text-embedding-004
      const embedding = new Array(768).fill(0);
      const words = text.toLowerCase().split(/\s+/);

      words.forEach((word, index) => {
        const hash = this.simpleHash(word);
        embedding[index % 768] += hash / 1000;
      });

      // Normalize
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
    } catch (error) {
      console.error('[SemanticCachingService] Error generating embedding:', error);
      return new Array(768).fill(0);
    }
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Find similar cached query
   */
  private async findSimilarCached(query: string, embedding: number[]): Promise<CachedResponse | null> {
    let bestMatch: CachedResponse | null = null;
    let bestSimilarity = 0;

    const now = Date.now();

    for (const [key, cached] of this.cache.entries()) {
      // Check TTL
      if (now - cached.timestamp.getTime() > this.CACHE_TTL) {
        this.cache.delete(key);
        continue;
      }

      // Calculate similarity
      const similarity = this.cosineSimilarity(embedding, cached.embedding);

      if (similarity > bestSimilarity && similarity >= this.SIMILARITY_THRESHOLD) {
        bestSimilarity = similarity;
        bestMatch = cached;
      }
    }

    if (bestMatch) {
      console.log(`[SemanticCachingService] Cache hit! Similarity: ${bestSimilarity.toFixed(3)}`);
      console.log(`[SemanticCachingService] Original: "${bestMatch.query}"`);
      console.log(`[SemanticCachingService] Current: "${query}"`);
    }

    return bestMatch;
  }

  /**
   * Get cached response or null if not found
   */
  async get(query: string): Promise<string | null> {
    this.stats.totalQueries++;

    try {
      const embedding = await this.generateEmbedding(query);
      const cached = await this.findSimilarCached(query, embedding);

      if (cached) {
        // Update hits
        cached.hits++;
        this.stats.hits++;
        this.stats.costSavings += this.COST_PER_QUERY;
        this.updateHitRate();

        return cached.response;
      }

      this.stats.misses++;
      this.updateHitRate();
      return null;
    } catch (error) {
      console.error('[SemanticCachingService] Error getting from cache:', error);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Set cached response
   */
  async set(query: string, response: string, metadata?: any): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(query);

      const cached: CachedResponse = {
        query,
        embedding,
        response,
        timestamp: new Date(),
        hits: 0,
        metadata,
      };

      // Generate cache key
      const cacheKey = this.generateCacheKey(query);
      this.cache.set(cacheKey, cached);

      // Evict if cache is too large
      if (this.cache.size > this.MAX_CACHE_SIZE) {
        this.evictLRU();
      }

      this.stats.size = this.cache.size;
      console.log(`[SemanticCachingService] Cached response for: "${query}"`);
    } catch (error) {
      console.error('[SemanticCachingService] Error setting cache:', error);
    }
  }

  /**
   * Generate cache key from query
   */
  private generateCacheKey(query: string): string {
    return `cache_${this.simpleHash(query)}`;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();
    let lowestHits = Infinity;

    for (const [key, cached] of this.cache.entries()) {
      // Prioritize evicting entries with lowest hits, then oldest timestamp
      if (cached.hits < lowestHits || (cached.hits === lowestHits && cached.timestamp.getTime() < oldestTimestamp)) {
        oldestKey = key;
        oldestTimestamp = cached.timestamp.getTime();
        lowestHits = cached.hits;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`[SemanticCachingService] Evicted LRU entry with ${lowestHits} hits`);
    }
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    this.stats.hitRate = this.stats.totalQueries > 0
      ? this.stats.hits / this.stats.totalQueries
      : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats, size: this.cache.size };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      size: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalQueries: 0,
      costSavings: 0,
    };
    console.log('[SemanticCachingService] Cache cleared');
  }

  /**
   * Invalidate cache entries older than TTL
   */
  invalidateExpired(): number {
    const now = Date.now();
    let invalidated = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp.getTime() > this.CACHE_TTL) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    if (invalidated > 0) {
      console.log(`[SemanticCachingService] Invalidated ${invalidated} expired entries`);
      this.stats.size = this.cache.size;
    }

    return invalidated;
  }

  /**
   * Get cache contents (for debugging)
   */
  getCacheContents(): Array<{ query: string; hits: number; age: number }> {
    const now = Date.now();
    return Array.from(this.cache.values()).map(cached => ({
      query: cached.query,
      hits: cached.hits,
      age: now - cached.timestamp.getTime(),
    }));
  }
}
