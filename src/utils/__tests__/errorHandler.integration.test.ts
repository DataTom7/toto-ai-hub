import { handleError, withErrorHandling } from '../errorHandler';
import {
  AppError,
  ValidationError,
  ExternalAPIError,
  DatabaseError,
  TimeoutError,
  ErrorCategory,
} from '../../errors/AppErrors';

describe('Error Handler Integration', () => {
  describe('Error Transformation', () => {
    it('should transform Firestore errors', () => {
      const error = new Error('firestore operation failed: PERMISSION_DENIED');
      const handled = handleError(error, { operation: 'read_document' });

      expect(handled).toBeInstanceOf(DatabaseError);
      expect(handled.category).toBe(ErrorCategory.DATABASE);
      expect(handled.isRetryable).toBe(true);
    });

    it('should transform Vertex AI errors', () => {
      const error = new Error('Vertex AI API call failed: 429 Too Many Requests');
      const handled = handleError(error, { operation: 'generate_embedding' });

      expect(handled).toBeInstanceOf(ExternalAPIError);
      expect(handled.category).toBe(ErrorCategory.EXTERNAL_API);
      expect(handled.isRetryable).toBe(true);
    });

    it('should transform timeout errors', () => {
      const error = new Error('Operation timed out after 10000ms');
      const handled = handleError(error);

      expect(handled).toBeInstanceOf(TimeoutError);
      expect(handled.category).toBe(ErrorCategory.TIMEOUT);
      expect(handled.isRetryable).toBe(true);
    });

    it('should preserve AppError instances', () => {
      const original = new ValidationError('Invalid input');
      const handled = handleError(original);

      expect(handled).toBe(original);
      expect(handled).toBeInstanceOf(ValidationError);
    });
  });

  describe('Error Context Enrichment', () => {
    it('should add context to errors', () => {
      const error = new Error('Test error');
      const context = {
        userId: 'user-123',
        operation: 'test_operation',
        timestamp: new Date().toISOString(),
      };

      const handled = handleError(error, context);

      expect(handled.context).toMatchObject(context);
    });
  });

  describe('withErrorHandling Wrapper', () => {
    it('should wrap async functions with error handling', async () => {
      const fn = async () => {
        throw new Error('firestore connection failed');
      };

      const wrapped = withErrorHandling(fn, { operation: 'test' });

      try {
        await wrapped();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        // Context should include both the wrapper context and the transformed error context
        expect((error as AppError).context).toBeDefined();
      }
    });

    it('should pass through successful results', async () => {
      const fn = async (x: number, y: number) => x + y;
      const wrapped = withErrorHandling(fn);

      const result = await wrapped(2, 3);
      expect(result).toBe(5);
    });
  });

  describe('User-Friendly Messages', () => {
    it('should provide Spanish messages', () => {
      const error = new ValidationError('Invalid data');
      const message = error.getUserMessage('es');

      expect(message).toContain('válido');
      expect(message.length).toBeGreaterThan(10);
    });

    it('should provide English messages', () => {
      const error = new ValidationError('Invalid data');
      const message = error.getUserMessage('en');

      expect(message).toContain('invalid');
      expect(message.length).toBeGreaterThan(10);
    });
  });

  describe('Error Serialization', () => {
    it('should serialize to JSON', () => {
      const error = new ExternalAPIError('VertexAI', 'API failed', 500, {
        userId: 'user-123',
      });

      const json = error.toJSON();

      expect(json.name).toBe('ExternalAPIError');
      expect(json.category).toBe(ErrorCategory.EXTERNAL_API);
      expect(json.statusCode).toBe(502);
      expect(json.context?.apiName).toBe('VertexAI');
      expect(json.timestamp).toBeDefined();
    });
  });
});

