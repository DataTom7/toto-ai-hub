/**
 * PromptBuilder - Utility for building modular, cacheable prompts
 *
 * Features:
 * - Modular prompt components
 * - In-memory caching for performance
 * - Conditional component injection
 * - Token usage tracking
 * - Version control for A/B testing
 */

export interface PromptComponent {
  key: string;
  content: string;
  cacheable?: boolean; // Components that rarely change can be cached
  priority?: number; // Lower number = higher priority (for ordering)
}

export interface PromptBuildOptions {
  /**
   * Variables to interpolate into components
   */
  variables?: Record<string, string | undefined>;

  /**
   * Whether to enable caching for this prompt build
   */
  enableCache?: boolean;

  /**
   * Prompt version for A/B testing
   */
  version?: string;
}

export interface PromptMetrics {
  componentCount: number;
  estimatedTokens: number;
  cacheHit: boolean;
  buildTime: number;
}

/**
 * PromptBuilder - Fluent API for building modular prompts
 */
export class PromptBuilder {
  private components: PromptComponent[] = [];
  private static cache: Map<string, { prompt: string; timestamp: number; hits: number }> = new Map();
  private static readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour
  private static readonly MAX_CACHE_SIZE = 100;

  // Analytics
  private static cacheHits = 0;
  private static cacheMisses = 0;
  private static totalBuilds = 0;

  constructor(private options: PromptBuildOptions = {}) {}

  /**
   * Create a new PromptBuilder instance
   */
  static create(options?: PromptBuildOptions): PromptBuilder {
    return new PromptBuilder(options);
  }

  /**
   * Add a component to the prompt
   */
  addComponent(key: string, content: string | PromptComponent, priority: number = 100): this {
    if (typeof content === 'string') {
      this.components.push({ key, content, priority });
    } else {
      this.components.push({ ...content, key, priority: priority ?? content.priority ?? 100 });
    }
    return this;
  }

  /**
   * Add multiple components at once
   */
  addComponents(components: PromptComponent[]): this {
    this.components.push(...components);
    return this;
  }

  /**
   * Add a component conditionally
   */
  addIf(condition: boolean, key: string, content: string | PromptComponent, priority?: number): this {
    if (condition) {
      this.addComponent(key, content, priority);
    }
    return this;
  }

  /**
   * Build the final prompt string
   */
  build(): { prompt: string; metrics: PromptMetrics } {
    const startTime = Date.now();
    PromptBuilder.totalBuilds++;

    // Check cache first
    if (this.options.enableCache !== false) {
      const cacheKey = this.getCacheKey();
      const cached = PromptBuilder.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < PromptBuilder.CACHE_TTL) {
        cached.hits++;
        PromptBuilder.cacheHits++;

        return {
          prompt: cached.prompt,
          metrics: {
            componentCount: this.components.length,
            estimatedTokens: this.estimateTokens(cached.prompt),
            cacheHit: true,
            buildTime: Date.now() - startTime,
          },
        };
      }
    }

    PromptBuilder.cacheMisses++;

    // Sort components by priority
    const sortedComponents = [...this.components].sort((a, b) =>
      (a.priority ?? 100) - (b.priority ?? 100)
    );

    // Build prompt from components
    let prompt = sortedComponents
      .map(comp => this.interpolateVariables(comp.content, this.options.variables))
      .join('\n\n');

    // Cache the result
    if (this.options.enableCache !== false) {
      const cacheKey = this.getCacheKey();
      PromptBuilder.cache.set(cacheKey, { prompt, timestamp: Date.now(), hits: 0 });

      // Evict old entries if cache is too large
      if (PromptBuilder.cache.size > PromptBuilder.MAX_CACHE_SIZE) {
        this.evictOldestCacheEntry();
      }
    }

    return {
      prompt,
      metrics: {
        componentCount: this.components.length,
        estimatedTokens: this.estimateTokens(prompt),
        cacheHit: false,
        buildTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Interpolate variables into content using {{variable}} syntax
   */
  private interpolateVariables(content: string, variables?: Record<string, string | undefined>): string {
    if (!variables) return content;

    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] ?? match;
    });
  }

  /**
   * Generate cache key from components
   */
  private getCacheKey(): string {
    const componentKeys = this.components
      .map(c => `${c.key}:${c.priority}`)
      .sort()
      .join('|');

    const variableKeys = this.options.variables
      ? Object.keys(this.options.variables).sort().join('|')
      : '';

    const version = this.options.version ?? 'v1';

    return `${version}:${componentKeys}:${variableKeys}`;
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Evict the oldest or least-used cache entry
   */
  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();
    let lowestHits = Infinity;

    for (const [key, value] of PromptBuilder.cache.entries()) {
      // Prioritize evicting entries with lowest hits, then oldest timestamp
      if (value.hits < lowestHits || (value.hits === lowestHits && value.timestamp < oldestTimestamp)) {
        oldestKey = key;
        oldestTimestamp = value.timestamp;
        lowestHits = value.hits;
      }
    }

    if (oldestKey) {
      PromptBuilder.cache.delete(oldestKey);
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    totalBuilds: number;
  } {
    const hitRate = this.totalBuilds > 0
      ? this.cacheHits / this.totalBuilds
      : 0;

    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate,
      totalBuilds: this.totalBuilds,
    };
  }

  /**
   * Clear the cache
   */
  static clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.totalBuilds = 0;
  }

  /**
   * Get cache contents (for debugging)
   */
  static getCacheContents(): Array<{ key: string; hits: number; age: number }> {
    const now = Date.now();
    return Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      hits: value.hits,
      age: now - value.timestamp,
    }));
  }
}
