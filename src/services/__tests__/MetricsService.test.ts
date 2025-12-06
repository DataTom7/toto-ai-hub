import { MetricsService, getMetricsService, MetricCategory, trackExecution } from '../MetricsService';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = getMetricsService();
    service.clear();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('recordCounter', () => {
    it('should record counter metrics', () => {
      service.recordCounter('test_counter', MetricCategory.PERFORMANCE, 5);

      const metrics = service.getMetrics('test_counter');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(5);
    });

    it('should support tags', () => {
      service.recordCounter('api_calls', MetricCategory.API, 1, { endpoint: 'test' });

      const metrics = service.getMetrics('api_calls');
      expect(metrics[0].tags).toEqual({ endpoint: 'test' });
    });
  });

  describe('recordGauge', () => {
    it('should record gauge metrics', () => {
      service.recordGauge('cache_size', MetricCategory.CACHE, 450);

      const metrics = service.getMetrics('cache_size');
      expect(metrics[0].value).toBe(450);
    });
  });

  describe('recordHistogram', () => {
    it('should record histogram metrics', () => {
      service.recordHistogram('response_time', MetricCategory.PERFORMANCE, 123);

      const metrics = service.getMetrics('response_time');
      expect(metrics[0].value).toBe(123);
    });
  });

  describe('startTimer', () => {
    it('should measure duration', async () => {
      const stopTimer = service.startTimer('test_timer', MetricCategory.PERFORMANCE);

      await new Promise(resolve => setTimeout(resolve, 100));
      stopTimer();

      const metrics = service.getMetrics('test_timer');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBeGreaterThanOrEqual(100);
    });
  });

  describe('getStats', () => {
    it('should calculate statistics', () => {
      service.recordHistogram('test_metric', MetricCategory.PERFORMANCE, 10);
      service.recordHistogram('test_metric', MetricCategory.PERFORMANCE, 20);
      service.recordHistogram('test_metric', MetricCategory.PERFORMANCE, 30);

      const stats = service.getStats('test_metric');

      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(3);
      expect(stats!.sum).toBe(60);
      expect(stats!.avg).toBe(20);
      expect(stats!.min).toBe(10);
      expect(stats!.max).toBe(30);
    });
  });

  describe('getSummary', () => {
    it('should aggregate metrics by category', () => {
      service.recordCounter('metric1', MetricCategory.COST, 5);
      service.recordCounter('metric2', MetricCategory.COST, 10);
      service.recordCounter('metric3', MetricCategory.PERFORMANCE, 3);

      const summary = service.getSummary();

      expect(summary.cost).toBeDefined();
      expect(summary.cost.metric1).toBe(5);
      expect(summary.cost.metric2).toBe(10);
      expect(summary.performance.metric3).toBe(3);
    });
  });

  describe('trackExecution', () => {
    it('should track successful execution', async () => {
      const fn = async () => 'success';
      const tracked = trackExecution(fn, 'test_fn', MetricCategory.PERFORMANCE);

      const result = await tracked();

      expect(result).toBe('success');

      const successMetrics = service.getMetrics('test_fn_success');
      expect(successMetrics).toHaveLength(1);
    });

    it('should track failed execution', async () => {
      const fn = async () => { throw new Error('test error'); };
      const tracked = trackExecution(fn, 'test_fn', MetricCategory.PERFORMANCE);

      await expect(tracked()).rejects.toThrow('test error');

      const errorMetrics = service.getMetrics('test_fn_error');
      expect(errorMetrics).toHaveLength(1);
    });
  });
});

