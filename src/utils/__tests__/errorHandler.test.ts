import { handleError, isRetryable, getRetryDelay, withErrorHandling } from '../errorHandler';
import { AppError, ValidationError, ExternalAPIError, ErrorCategory } from '../../errors/AppErrors';

describe('errorHandler', () => {
  describe('handleError', () => {
    it('should pass through AppError instances', () => {
      const originalError = new ValidationError('Test');
      const handled = handleError(originalError);

      expect(handled).toBe(originalError);
    });

    it('should transform Firestore errors to DatabaseError', () => {
      const error = new Error('Firestore operation failed');
      const handled = handleError(error);

      expect(handled.category).toBe(ErrorCategory.DATABASE);
    });

    it('should transform API errors to ExternalAPIError', () => {
      const error = new Error('Vertex AI fetch failed');
      const handled = handleError(error);

      expect(handled.category).toBe(ErrorCategory.EXTERNAL_API);
    });

    it('should transform timeout errors to TimeoutError', () => {
      const error = new Error('Operation timed out');
      const handled = handleError(error);

      expect(handled.category).toBe(ErrorCategory.TIMEOUT);
    });

    it('should add context to errors', () => {
      const error = new Error('Test error');
      const context = { userId: '123', operation: 'test' };
      const handled = handleError(error, context);

      expect(handled.context).toMatchObject(context);
    });
  });

  describe('isRetryable', () => {
    it('should return true for retryable errors', () => {
      const error = new ExternalAPIError('TestAPI', 'Failed');
      expect(isRetryable(error)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = new ValidationError('Invalid');
      expect(isRetryable(error)).toBe(false);
    });

    it('should return false for non-AppError instances', () => {
      const error = new Error('Generic error');
      expect(isRetryable(error)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      const delay1 = getRetryDelay(1, 1000);
      const delay2 = getRetryDelay(2, 1000);
      const delay3 = getRetryDelay(3, 1000);

      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThan(3000);

      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThan(5000);

      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThan(9000);
    });

    it('should cap at 30 seconds', () => {
      const delay = getRetryDelay(10, 10000);
      expect(delay).toBeLessThanOrEqual(30000);
    });
  });

  describe('withErrorHandling', () => {
    it('should wrap function with error handling', async () => {
      const fn = async () => {
        throw new Error('Test error');
      };

      const wrapped = withErrorHandling(fn, { operation: 'test' });

      await expect(wrapped()).rejects.toThrow(AppError);
    });

    it('should pass through successful results', async () => {
      const fn = async () => 'success';
      const wrapped = withErrorHandling(fn);

      const result = await wrapped();
      expect(result).toBe('success');
    });
  });
});

