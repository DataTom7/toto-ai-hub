/**
 * Metrics Service
 *
 * Centralized metrics collection and logging for production monitoring.
 * Tracks performance, costs, errors, and quality metrics.
 */

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = 'counter',       // Incrementing counter (e.g., API calls)
  GAUGE = 'gauge',           // Current value (e.g., cache size)
  HISTOGRAM = 'histogram',   // Distribution (e.g., response times)
  TIMER = 'timer',           // Duration measurement
}

/**
 * Metric categories for organization
 */
export enum MetricCategory {
  PERFORMANCE = 'performance',
  COST = 'cost',
  ERROR = 'error',
  QUALITY = 'quality',
  CACHE = 'cache',
  API = 'api',
}

/**
 * Metric entry
 */
interface MetricEntry {
  name: string;
  type: MetricType;
  category: MetricCategory;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

/**
 * Aggregated metric statistics
 */
export interface MetricStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50?: number; // Median
  p95?: number;
  p99?: number;
}

/**
 * Metrics Service - Singleton for centralized metrics
 */
export class MetricsService {
  private static instance: MetricsService;
  private metrics: MetricEntry[] = [];
  private maxStoredMetrics: number = 10000;
  private aggregationInterval: NodeJS.Timeout;

  private constructor() {
    // Aggregate and log metrics every 5 minutes
    this.aggregationInterval = setInterval(() => {
      this.aggregateAndLog();
    }, 5 * 60 * 1000);
    // Unref to allow process to exit if only aggregation interval is running
    if (this.aggregationInterval.unref) {
      this.aggregationInterval.unref();
    }

    console.log('[MetricsService] ✅ Initialized');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * Record a counter metric (increment)
   *
   * @param name - Metric name
   * @param category - Metric category
   * @param value - Value to increment (default: 1)
   * @param tags - Optional tags for filtering
   *
   * @example
   * metrics.recordCounter('vertex_ai_calls', MetricCategory.COST, 1, { operation: 'embedding' });
   */
  recordCounter(
    name: string,
    category: MetricCategory,
    value: number = 1,
    tags?: Record<string, string>
  ): void {
    this.addMetric({
      name,
      type: MetricType.COUNTER,
      category,
      value,
      timestamp: new Date(),
      tags,
    });
  }

  /**
   * Record a gauge metric (current value)
   *
   * @param name - Metric name
   * @param category - Metric category
   * @param value - Current value
   * @param tags - Optional tags
   *
   * @example
   * metrics.recordGauge('cache_size', MetricCategory.CACHE, 450);
   */
  recordGauge(
    name: string,
    category: MetricCategory,
    value: number,
    tags?: Record<string, string>
  ): void {
    this.addMetric({
      name,
      type: MetricType.GAUGE,
      category,
      value,
      timestamp: new Date(),
      tags,
    });
  }

  /**
   * Record a histogram metric (distribution)
   *
   * @param name - Metric name
   * @param category - Metric category
   * @param value - Measured value
   * @param tags - Optional tags
   *
   * @example
   * metrics.recordHistogram('response_time_ms', MetricCategory.PERFORMANCE, 245);
   */
  recordHistogram(
    name: string,
    category: MetricCategory,
    value: number,
    tags?: Record<string, string>
  ): void {
    this.addMetric({
      name,
      type: MetricType.HISTOGRAM,
      category,
      value,
      timestamp: new Date(),
      tags,
    });
  }

  /**
   * Start a timer
   *
   * @param name - Timer name
   * @param category - Metric category
   * @param tags - Optional tags
   * @returns Stop function to end timer
   *
   * @example
   * const stopTimer = metrics.startTimer('process_message', MetricCategory.PERFORMANCE);
   * // ... do work ...
   * stopTimer(); // Automatically records duration
   */
  startTimer(
    name: string,
    category: MetricCategory,
    tags?: Record<string, string>
  ): () => void {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      this.recordHistogram(name, category, duration, tags);
    };
  }

  /**
   * Record an error
   *
   * @param errorCategory - Error category from AppError
   * @param errorMessage - Error message
   * @param metadata - Additional context
   *
   * @example
   * metrics.recordError('EXTERNAL_API', 'Vertex AI timeout', { userId: '123' });
   */
  recordError(
    errorCategory: string,
    errorMessage: string,
    metadata?: Record<string, any>
  ): void {
    this.addMetric({
      name: 'error_count',
      type: MetricType.COUNTER,
      category: MetricCategory.ERROR,
      value: 1,
      timestamp: new Date(),
      tags: { errorCategory },
      metadata: { errorMessage, ...metadata },
    });
  }

  /**
   * Get metrics by name
   *
   * @param name - Metric name
   * @param category - Optional category filter
   * @returns Array of matching metrics
   */
  getMetrics(name: string, category?: MetricCategory): MetricEntry[] {
    return this.metrics.filter(m =>
      m.name === name && (!category || m.category === category)
    );
  }

  /**
   * Get aggregated statistics for a metric
   *
   * @param name - Metric name
   * @param category - Optional category filter
   * @returns Aggregated stats
   */
  getStats(name: string, category?: MetricCategory): MetricStats | null {
    const metrics = this.getMetrics(name, category);

    if (metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      count: values.length,
      sum,
      min: values[0],
      max: values[values.length - 1],
      avg: sum / values.length,
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
    };
  }

  /**
   * Get all metrics summary
   *
   * @returns Summary by category
   */
  getSummary(): Record<string, any> {
    const summary: Record<string, any> = {};

    // Group by category
    for (const category of Object.values(MetricCategory)) {
      const categoryMetrics = this.metrics.filter(m => m.category === category);

      if (categoryMetrics.length > 0) {
        // Group by name within category
        const byName: Record<string, number> = {};

        for (const metric of categoryMetrics) {
          if (metric.type === MetricType.COUNTER) {
            byName[metric.name] = (byName[metric.name] || 0) + metric.value;
          } else if (metric.type === MetricType.GAUGE) {
            byName[metric.name] = metric.value; // Use latest value
          }
        }

        summary[category] = byName;
      }
    }

    return summary;
  }

  /**
   * Clear old metrics (keep last N)
   */
  private addMetric(metric: MetricEntry): void {
    this.metrics.push(metric);

    // Trim if exceeds max
    if (this.metrics.length > this.maxStoredMetrics) {
      this.metrics = this.metrics.slice(-this.maxStoredMetrics);
    }
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Aggregate and log metrics
   */
  private aggregateAndLog(): void {
    if (this.metrics.length === 0) {
      return;
    }

    const summary = this.getSummary();

    console.log('[MetricsService] 📊 Metrics Summary:');
    console.log(JSON.stringify(summary, null, 2));

    // Log performance stats
    const responseTimeStats = this.getStats('process_case_inquiry', MetricCategory.PERFORMANCE);
    if (responseTimeStats) {
      console.log('[MetricsService] ⚡ Performance Stats:');
      console.log(`  - Avg response time: ${responseTimeStats.avg.toFixed(2)}ms`);
      console.log(`  - P95 response time: ${responseTimeStats.p95?.toFixed(2)}ms`);
      console.log(`  - P99 response time: ${responseTimeStats.p99?.toFixed(2)}ms`);
    }

    // Log cache stats
    const cacheHitMetrics = this.getMetrics('cache_hit', MetricCategory.CACHE);
    const cacheMissMetrics = this.getMetrics('cache_miss', MetricCategory.CACHE);
    if (cacheHitMetrics.length > 0 && cacheMissMetrics.length > 0) {
      const totalCacheOps = cacheHitMetrics.length + cacheMissMetrics.length;
      const hitRate = (cacheHitMetrics.length / totalCacheOps) * 100;
      console.log('[MetricsService] 🎯 Cache Stats:');
      console.log(`  - Hit rate: ${hitRate.toFixed(2)}%`);
      console.log(`  - Total operations: ${totalCacheOps}`);
    }
  }

  /**
   * Export metrics (for external monitoring services)
   *
   * @returns All metrics as JSON
   */
  exportMetrics(): MetricEntry[] {
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Stop aggregation interval
   */
  destroy(): void {
    clearInterval(this.aggregationInterval);
  }
}

/**
 * Get metrics service instance
 */
export function getMetricsService(): MetricsService {
  return MetricsService.getInstance();
}

/**
 * Helper to track function execution
 *
 * @param fn - Async function to track
 * @param name - Metric name
 * @param category - Metric category
 * @returns Wrapped function with metrics
 *
 * @example
 * const trackedFn = trackExecution(
 *   async () => { ... },
 *   'process_message',
 *   MetricCategory.PERFORMANCE
 * );
 */
export function trackExecution<T>(
  fn: (...args: any[]) => Promise<T>,
  name: string,
  category: MetricCategory = MetricCategory.PERFORMANCE
): (...args: any[]) => Promise<T> {
  return async (...args: any[]): Promise<T> => {
    const metrics = getMetricsService();
    const stopTimer = metrics.startTimer(name, category);

    try {
      const result = await fn(...args);
      metrics.recordCounter(`${name}_success`, category);
      return result;
    } catch (error) {
      metrics.recordCounter(`${name}_error`, category);
      throw error;
    } finally {
      stopTimer();
    }
  };
}

