/**
 * Application Error Types
 *
 * Centralized error handling with categorization and structured logging.
 * Enables proper error recovery, user messaging, and debugging.
 */

/**
 * Error categories for handling strategies
 */
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',           // Invalid input data
  AUTHENTICATION = 'AUTHENTICATION',   // Auth failures
  AUTHORIZATION = 'AUTHORIZATION',     // Permission denied
  NOT_FOUND = 'NOT_FOUND',            // Resource not found
  RATE_LIMIT = 'RATE_LIMIT',          // Rate limit exceeded
  EXTERNAL_API = 'EXTERNAL_API',      // Third-party API failures
  DATABASE = 'DATABASE',               // Firestore/DB errors
  INTERNAL = 'INTERNAL',               // Internal server errors
  NETWORK = 'NETWORK',                 // Network/connectivity issues
  TIMEOUT = 'TIMEOUT',                 // Operation timeout
}

/**
 * Base application error
 */
export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly isRetryable: boolean;
  public readonly statusCode: number;
  public context?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    category: ErrorCategory,
    isRetryable: boolean = false,
    statusCode: number = 500,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.category = category;
    this.isRetryable = isRetryable;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      isRetryable: this.isRetryable,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(language: 'en' | 'es' = 'es'): string {
    // Override in subclasses for custom messages
    return language === 'es'
      ? 'Ocurrió un error. Por favor, intenta nuevamente.'
      : 'An error occurred. Please try again.';
  }
}

/**
 * Validation errors (invalid input)
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorCategory.VALIDATION, false, 400, context);
  }

  getUserMessage(language: 'en' | 'es' = 'es'): string {
    return language === 'es'
      ? 'Los datos proporcionados no son válidos. Por favor, verifica e intenta nuevamente.'
      : 'The provided data is invalid. Please check and try again.';
  }
}

/**
 * External API errors (Vertex AI, Firestore, etc.)
 */
export class ExternalAPIError extends AppError {
  public readonly apiName: string;
  public readonly apiStatusCode?: number;

  constructor(
    apiName: string,
    message: string,
    apiStatusCode?: number,
    context?: Record<string, any>
  ) {
    super(
      message,
      ErrorCategory.EXTERNAL_API,
      true, // Most API errors are retryable
      502,
      { ...context, apiName, apiStatusCode }
    );
    this.apiName = apiName;
    this.apiStatusCode = apiStatusCode;
  }

  getUserMessage(language: 'en' | 'es' = 'es'): string {
    return language === 'es'
      ? 'Hubo un problema con un servicio externo. Estamos trabajando para resolverlo.'
      : 'There was a problem with an external service. We are working to resolve it.';
  }
}

/**
 * Database errors (Firestore)
 */
export class DatabaseError extends AppError {
  public readonly operation: string;

  constructor(operation: string, message: string, context?: Record<string, any>) {
    super(
      message,
      ErrorCategory.DATABASE,
      true, // Most DB errors are retryable
      503,
      { ...context, operation }
    );
    this.operation = operation;
  }

  getUserMessage(language: 'en' | 'es' = 'es'): string {
    return language === 'es'
      ? 'Error al acceder a la base de datos. Por favor, intenta nuevamente.'
      : 'Database access error. Please try again.';
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends AppError {
  public readonly resourceType: string;
  public readonly resourceId: string;

  constructor(resourceType: string, resourceId: string, context?: Record<string, any>) {
    super(
      `${resourceType} not found: ${resourceId}`,
      ErrorCategory.NOT_FOUND,
      false,
      404,
      { ...context, resourceType, resourceId }
    );
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }

  getUserMessage(language: 'en' | 'es' = 'es'): string {
    return language === 'es'
      ? 'No se encontró el recurso solicitado.'
      : 'The requested resource was not found.';
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends AppError {
  public readonly operation: string;
  public readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number, context?: Record<string, any>) {
    super(
      `Operation timed out: ${operation} (${timeoutMs}ms)`,
      ErrorCategory.TIMEOUT,
      true, // Timeouts are retryable
      504,
      { ...context, operation, timeoutMs }
    );
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }

  getUserMessage(language: 'en' | 'es' = 'es'): string {
    return language === 'es'
      ? 'La operación tardó demasiado tiempo. Por favor, intenta nuevamente.'
      : 'The operation took too long. Please try again.';
  }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends AppError {
  public readonly limit: number;
  public readonly retryAfterMs?: number;

  constructor(limit: number, retryAfterMs?: number, context?: Record<string, any>) {
    super(
      `Rate limit exceeded: ${limit} requests`,
      ErrorCategory.RATE_LIMIT,
      false,
      429,
      { ...context, limit, retryAfterMs }
    );
    this.limit = limit;
    this.retryAfterMs = retryAfterMs;
  }

  getUserMessage(language: 'en' | 'es' = 'es'): string {
    return language === 'es'
      ? 'Has alcanzado el límite de solicitudes. Por favor, espera un momento e intenta nuevamente.'
      : 'You have reached the request limit. Please wait a moment and try again.';
  }
}

/**
 * Internal server errors
 */
export class InternalError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorCategory.INTERNAL, false, 500, context);
  }

  getUserMessage(language: 'en' | 'es' = 'es'): string {
    return language === 'es'
      ? 'Ocurrió un error interno. Nuestro equipo ha sido notificado.'
      : 'An internal error occurred. Our team has been notified.';
  }
}

