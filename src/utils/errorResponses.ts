/**
 * Standardized Error Response System
 * Centralizes error message generation with codes, user-friendly messages, and translation support
 */

export type ErrorCode = 
  | 'AUTH_ERROR'
  | 'CORS_ERROR'
  | 'RATE_LIMIT'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'PROCESSING_ERROR'
  | 'GENERAL_ERROR'
  | 'CASE_NOT_FOUND'
  | 'GUARDIAN_NOT_FOUND'
  | 'INVALID_INPUT';

export interface StandardizedError {
  code: ErrorCode;
  message: string; // Technical message for logging
  userMessage: {
    es: string; // Spanish user-friendly message
    en: string; // English user-friendly message
  };
  retryable: boolean;
  details?: Record<string, any>;
}

/**
 * Generate standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  details?: Record<string, any>
): StandardizedError {
  const errorMap: Record<ErrorCode, Omit<StandardizedError, 'details'>> = {
    AUTH_ERROR: {
      code: 'AUTH_ERROR',
      message: 'Authentication failed',
      userMessage: {
        es: 'No estás autenticado. Por favor, inicia sesión e intenta nuevamente.',
        en: 'You are not authenticated. Please sign in and try again.'
      },
      retryable: true
    },
    CORS_ERROR: {
      code: 'CORS_ERROR',
      message: 'CORS error: Server does not allow requests from this origin',
      userMessage: {
        es: 'Error de conexión. Por favor, verifica tu conexión a internet e intenta nuevamente.',
        en: 'Connection error. Please check your internet connection and try again.'
      },
      retryable: true
    },
    RATE_LIMIT: {
      code: 'RATE_LIMIT',
      message: 'Rate limit exceeded',
      userMessage: {
        es: 'Has enviado demasiados mensajes. Por favor, espera un momento e intenta nuevamente.',
        en: 'You have sent too many messages. Please wait a moment and try again.'
      },
      retryable: true
    },
    VALIDATION_ERROR: {
      code: 'VALIDATION_ERROR',
      message: 'Input validation failed',
      userMessage: {
        es: 'El mensaje no es válido. Por favor, intenta con otro mensaje.',
        en: 'The message is not valid. Please try with a different message.'
      },
      retryable: true
    },
    NETWORK_ERROR: {
      code: 'NETWORK_ERROR',
      message: 'Network request failed',
      userMessage: {
        es: 'Error de conexión. Por favor, verifica tu conexión a internet.',
        en: 'Connection error. Please check your internet connection.'
      },
      retryable: true
    },
    PROCESSING_ERROR: {
      code: 'PROCESSING_ERROR',
      message: 'Error processing request',
      userMessage: {
        es: 'Lo siento, encontré un problema al procesar tu solicitud. Por favor, intenta nuevamente.',
        en: 'I apologize, but I encountered an issue processing your request. Please try again.'
      },
      retryable: true
    },
    GENERAL_ERROR: {
      code: 'GENERAL_ERROR',
      message: 'An unexpected error occurred',
      userMessage: {
        es: 'Ocurrió un error inesperado. Por favor, intenta nuevamente.',
        en: 'An unexpected error occurred. Please try again.'
      },
      retryable: true
    },
    CASE_NOT_FOUND: {
      code: 'CASE_NOT_FOUND',
      message: 'Case not found',
      userMessage: {
        es: 'No se encontró el caso. Por favor, verifica e intenta nuevamente.',
        en: 'Case not found. Please verify and try again.'
      },
      retryable: false
    },
    GUARDIAN_NOT_FOUND: {
      code: 'GUARDIAN_NOT_FOUND',
      message: 'Guardian not found',
      userMessage: {
        es: 'No se encontró información del guardián.',
        en: 'Guardian information not found.'
      },
      retryable: false
    },
    INVALID_INPUT: {
      code: 'INVALID_INPUT',
      message: 'Invalid input provided',
      userMessage: {
        es: 'La información proporcionada no es válida. Por favor, verifica e intenta nuevamente.',
        en: 'The provided information is not valid. Please verify and try again.'
      },
      retryable: true
    }
  };

  return {
    ...errorMap[code],
    details
  };
}

/**
 * Get user-friendly error message based on language
 */
export function getUserErrorMessage(error: StandardizedError, language: 'es' | 'en' = 'es'): string {
  return error.userMessage[language] || error.userMessage.es;
}

