/**
 * Application Constants
 *
 * Centralized constants for the toto-ai-hub application.
 * Prefer using these constants over magic numbers throughout the codebase.
 */

/**
 * Case Agent Configuration
 */
export const CASE_AGENT_CONSTANTS = {
  /**
   * Minimum similarity threshold for intent detection
   */
  INTENT_SIMILARITY_THRESHOLD: 0.7,

  /**
   * Multiplier for vector search results (get more candidates for filtering)
   */
  VECTOR_SEARCH_MULTIPLIER: 2,

  /**
   * Maximum number of conversation history items to include in context
   */
  MAX_CONVERSATION_HISTORY_ITEMS: 6,

  /**
   * Delay before saving conversation (ms)
   */
  SAVE_CONVERSATION_DELAY_MS: 200,

  /**
   * Embedding vector dimensions (Vertex AI text-embedding-004)
   */
  EMBEDDING_DIMENSIONS: 768,

  /**
   * Default language for conversations
   */
  DEFAULT_LANGUAGE: 'es' as const,

  /**
   * Default audience type
   */
  DEFAULT_AUDIENCE: 'donors' as const,

  /**
   * Maximum number of KB results to retrieve
   */
  MAX_KB_RESULTS: 3,
} as const;

/**
 * RAG Service Configuration
 */
export const RAG_SERVICE_CONSTANTS = {
  /**
   * Maximum retries for Vertex AI API calls
   */
  VERTEX_AI_MAX_RETRIES: 3,

  /**
   * Base delay for exponential backoff (ms)
   */
  VERTEX_AI_BASE_DELAY_MS: 1000,

  /**
   * Timeout for Vertex AI API calls (ms)
   */
  VERTEX_AI_TIMEOUT_MS: 10000,

  /**
   * Default Vertex AI location
   */
  VERTEX_AI_DEFAULT_LOCATION: 'us-central1',

  /**
   * Embedding cache TTL (ms) - 24 hours
   */
  EMBEDDING_CACHE_TTL_MS: 24 * 60 * 60 * 1000,

  /**
   * Maximum cache size (number of entries)
   */
  EMBEDDING_CACHE_MAX_SIZE: 1000,
} as const;

/**
 * Vector Database Configuration
 */
export const VECTOR_DB_CONSTANTS = {
  /**
   * Default minimum similarity score for search results
   */
  DEFAULT_MIN_SCORE: 0.7,

  /**
   * Default number of results to return
   */
  DEFAULT_TOP_K: 5,

  /**
   * HNSW index parameters (if using in-memory HNSW)
   */
  HNSW_MAX_ELEMENTS: 100000,
  HNSW_M: 16,
  HNSW_EF_CONSTRUCTION: 200,
} as const;

/**
 * Guardian Service Configuration
 */
export const GUARDIAN_SERVICE_CONSTANTS = {
  /**
   * Maximum retries for Firestore operations
   */
  FIRESTORE_MAX_RETRIES: 3,

  /**
   * Timeout for Firestore operations (ms)
   */
  FIRESTORE_TIMEOUT_MS: 5000,

  /**
   * Base delay for exponential backoff (ms)
   */
  FIRESTORE_BASE_DELAY_MS: 100,
} as const;

/**
 * Firestore Connection Pool Configuration
 */
export const FIRESTORE_CONSTANTS = {
  /**
   * Maximum number of idle connections to maintain
   */
  MAX_IDLE_CONNECTIONS: 10,

  /**
   * Connection timeout (ms)
   */
  CONNECTION_TIMEOUT_MS: 5000,

  /**
   * Enable connection pooling
   */
  ENABLE_POOLING: true,
} as const;

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMIT_CONSTANTS = {
  /**
   * Per-user rate limits
   */
  USER_REQUESTS_PER_HOUR: 100,
  USER_WINDOW_MS: 60 * 60 * 1000, // 1 hour

  /**
   * Per-IP rate limits (more lenient for multiple users behind same IP)
   */
  IP_REQUESTS_PER_HOUR: 300,
  IP_WINDOW_MS: 60 * 60 * 1000, // 1 hour

  /**
   * Global rate limits (prevent total system overload)
   */
  GLOBAL_REQUESTS_PER_HOUR: 10000,
  GLOBAL_WINDOW_MS: 60 * 60 * 1000, // 1 hour

  /**
   * Expensive operations (embedding generation, vector search)
   */
  EXPENSIVE_REQUESTS_PER_HOUR: 50,
  EXPENSIVE_WINDOW_MS: 60 * 60 * 1000, // 1 hour

  /**
   * Admin/trusted users (higher limits)
   */
  ADMIN_REQUESTS_PER_HOUR: 1000,
  ADMIN_WINDOW_MS: 60 * 60 * 1000, // 1 hour
} as const;

/**
 * Message Keywords
 *
 * Keywords used for message classification and intent detection.
 * Prefer semantic detection over these keyword lists where possible.
 */
export const MESSAGE_KEYWORDS = {
  SHARING: ['compartir', 'share', 'redes sociales', 'social media', 'difundir', 'spread'] as const,
  AMOUNT: ['cuánto', 'how much', 'montos', 'amounts', 'monto', 'amount', '¿qué monto', 'what amount'] as const,
  ALIAS: ['alias bancario', 'alias', 'banking alias', 'transferencia', 'transfer'] as const,
  DONATION: ['donar', 'donate', 'donación', 'donation'] as const,
  ADOPTION: ['adoptar', 'adopt', 'adopción', 'adoption'] as const,
} as const;

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;
