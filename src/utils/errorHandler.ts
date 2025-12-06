/**
 * Error Handling Utilities
 *
 * Centralized error handling, logging, and recovery strategies.
 */

import { AppError, ErrorCategory, ExternalAPIError, DatabaseError, TimeoutError, ValidationError, InternalError } from '../errors/AppErrors';

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  /**
   * Enable detailed error logging
   */
  enableDetailedLogging?: boolean;

  /**
   * Log errors to external service (e.g., Sentry)
   */
  logToExternalService?: (error: Error) => void;

  /**
   * Custom error transformers
   */
  transformers?: Array<(error: Error) => AppError | null>;
}

/**
 * Global error handler configuration
 */
let globalConfig: ErrorHandlerConfig = {
  enableDetailedLogging: process.env.NODE_ENV !== 'production',
};

/**
 * Configure error handler
 */
export function configureErrorHandler(config: ErrorHandlerConfig): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Handle and transform errors
 *
 * @param error - The error to handle
 * @param context - Additional context for logging
 * @returns Transformed AppError
 */
export function handleError(error: unknown, context?: Record<string, any>): AppError {
  // If already an AppError, just add context
  if (error instanceof AppError) {
    if (context) {
      error.context = { ...error.context, ...context };
    }
    logError(error);
    return error;
  }

  // Try custom transformers
  if (globalConfig.transformers && error instanceof Error) {
    for (const transformer of globalConfig.transformers) {
      const transformed = transformer(error);
      if (transformed) {
        if (context) {
          transformed.context = { ...transformed.context, ...context };
        }
        logError(transformed);
        return transformed;
      }
    }
  }

  // Transform common error patterns
  const transformed = transformCommonErrors(error, context);
  logError(transformed);
  return transformed;
}

/**
 * Transform common error patterns to AppErrors
 */
function transformCommonErrors(error: unknown, context?: Record<string, any>): AppError {
  if (!(error instanceof Error)) {
    return new InternalError(
      String(error),
      context
    );
  }

  const message = error.message.toLowerCase();

  // Firestore errors
  if (message.includes('firestore') || message.includes('grpc') || message.includes('database')) {
    return new DatabaseError('firestore_operation', error.message, {
      ...context,
      originalError: error.name,
    });
  }

  // Vertex AI / API errors
  if (
    message.includes('vertex') ||
    message.includes('api') ||
    message.includes('fetch failed') ||
    message.includes('econnrefused') ||
    message.includes('network')
  ) {
    return new ExternalAPIError('vertex_ai', error.message, undefined, {
      ...context,
      originalError: error.name,
    });
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out')) {
    return new TimeoutError('unknown_operation', 30000, {
      ...context,
      originalError: error.name,
    });
  }

  // Validation errors (Zod)
  if (error.name === 'ZodError') {
    return new ValidationError(error.message, {
      ...context,
      originalError: 'ZodError',
    });
  }

  // Default to internal error
  return new InternalError(error.message, {
    ...context,
    originalError: error.name,
  });
}

/**
 * Log error with structured format
 */
function logError(error: AppError): void {
  const logLevel = error.category === ErrorCategory.INTERNAL ? 'error' : 'warn';

  if (globalConfig.enableDetailedLogging) {
    console[logLevel]('[ErrorHandler]', JSON.stringify(error.toJSON(), null, 2));
  } else {
    console[logLevel](
      `[ErrorHandler] ${error.category}: ${error.message}`,
      error.context
    );
  }

  // Log to external service if configured
  if (globalConfig.logToExternalService) {
    try {
      globalConfig.logToExternalService(error);
    } catch (loggingError) {
      console.error('[ErrorHandler] Failed to log to external service:', loggingError);
    }
  }
}

/**
 * Wrap async function with error handling
 *
 * @example
 * const safeFunction = withErrorHandling(
 *   async () => { ... },
 *   { operation: 'fetchData' }
 * );
 */
export function withErrorHandling<T>(
  fn: (...args: any[]) => Promise<T>,
  context?: Record<string, any>
): (...args: any[]) => Promise<T> {
  return async (...args: any[]): Promise<T> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleError(error, context);
    }
  };
}

/**
 * Determine if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isRetryable;
  }
  return false;
}

/**
 * Get retry delay for retryable errors
 *
 * @param attempt - Current attempt number (1-indexed)
 * @param baseDelay - Base delay in ms (default: 1000)
 * @returns Delay in ms with exponential backoff and jitter
 */
export function getRetryDelay(attempt: number, baseDelay: number = 1000): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, 30000); // Max 30s
}

