import {
  AppError,
  ValidationError,
  ExternalAPIError,
  DatabaseError,
  NotFoundError,
  TimeoutError,
  RateLimitError,
  InternalError,
  ErrorCategory,
} from '../AppErrors';

describe('AppErrors', () => {
  describe('AppError', () => {
    it('should create error with correct properties', () => {
      const error = new AppError(
        'Test error',
        ErrorCategory.INTERNAL,
        false,
        500,
        { key: 'value' }
      );

      expect(error.message).toBe('Test error');
      expect(error.category).toBe(ErrorCategory.INTERNAL);
      expect(error.isRetryable).toBe(false);
      expect(error.statusCode).toBe(500);
      expect(error.context).toEqual({ key: 'value' });
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should serialize to JSON', () => {
      const error = new AppError('Test', ErrorCategory.VALIDATION);
      const json = error.toJSON();

      expect(json.name).toBe('AppError');
      expect(json.message).toBe('Test');
      expect(json.category).toBe(ErrorCategory.VALIDATION);
      expect(json.timestamp).toBeDefined();
    });

    it('should return user messages in both languages', () => {
      const error = new AppError('Test', ErrorCategory.INTERNAL);

      expect(error.getUserMessage('es')).toContain('error');
      expect(error.getUserMessage('en')).toContain('error');
    });
  });

  describe('ValidationError', () => {
    it('should be retryable=false with statusCode=400', () => {
      const error = new ValidationError('Invalid input');

      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.isRetryable).toBe(false);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('ExternalAPIError', () => {
    it('should be retryable with statusCode=502', () => {
      const error = new ExternalAPIError('VertexAI', 'API failed', 500);

      expect(error.category).toBe(ErrorCategory.EXTERNAL_API);
      expect(error.isRetryable).toBe(true);
      expect(error.statusCode).toBe(502);
      expect(error.apiName).toBe('VertexAI');
      expect(error.apiStatusCode).toBe(500);
    });
  });

  describe('DatabaseError', () => {
    it('should be retryable with operation context', () => {
      const error = new DatabaseError('upsert', 'Connection failed');

      expect(error.category).toBe(ErrorCategory.DATABASE);
      expect(error.isRetryable).toBe(true);
      expect(error.operation).toBe('upsert');
    });
  });

  describe('NotFoundError', () => {
    it('should not be retryable with statusCode=404', () => {
      const error = new NotFoundError('Case', 'case-123');

      expect(error.category).toBe(ErrorCategory.NOT_FOUND);
      expect(error.isRetryable).toBe(false);
      expect(error.statusCode).toBe(404);
      expect(error.resourceType).toBe('Case');
      expect(error.resourceId).toBe('case-123');
    });
  });

  describe('TimeoutError', () => {
    it('should be retryable with timeout details', () => {
      const error = new TimeoutError('embedding_generation', 10000);

      expect(error.category).toBe(ErrorCategory.TIMEOUT);
      expect(error.isRetryable).toBe(true);
      expect(error.statusCode).toBe(504);
      expect(error.operation).toBe('embedding_generation');
      expect(error.timeoutMs).toBe(10000);
    });
  });

  describe('RateLimitError', () => {
    it('should not be retryable with statusCode=429', () => {
      const error = new RateLimitError(100, 60000);

      expect(error.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(error.isRetryable).toBe(false);
      expect(error.statusCode).toBe(429);
      expect(error.limit).toBe(100);
      expect(error.retryAfterMs).toBe(60000);
    });
  });

  describe('InternalError', () => {
    it('should not be retryable with statusCode=500', () => {
      const error = new InternalError('Unexpected error');

      expect(error.category).toBe(ErrorCategory.INTERNAL);
      expect(error.isRetryable).toBe(false);
      expect(error.statusCode).toBe(500);
    });
  });
});

