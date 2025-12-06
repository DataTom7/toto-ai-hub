/**
 * Embedding Validation Utility
 *
 * Validates embedding vectors to prevent corrupt data from
 * causing search failures, dimension mismatches, or silent errors.
 */

import { CASE_AGENT_CONSTANTS } from '../config/constants';

/**
 * Validation result
 */
export interface EmbeddingValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    dimension?: number;
    expectedDimension?: number;
    hasNaN?: boolean;
    hasInfinity?: boolean;
    isAllZeros?: boolean;
  };
}

/**
 * Validate an embedding vector
 *
 * Checks for:
 * - Correct dimensions (768 for Vertex AI text-embedding-004)
 * - No NaN values
 * - No Infinity values
 * - Not all zeros (indicates generation failure)
 * - Valid number array
 *
 * @param embedding - The embedding vector to validate
 * @param expectedDimension - Expected vector dimension (default: 768)
 * @returns Validation result with error details
 *
 * @example
 * const result = validateEmbedding(embedding);
 * if (!result.valid) {
 *   console.error('Invalid embedding:', result.error);
 *   throw new Error(result.error);
 * }
 */
export function validateEmbedding(
  embedding: any,
  expectedDimension: number = CASE_AGENT_CONSTANTS.EMBEDDING_DIMENSIONS
): EmbeddingValidationResult {
  // Check if embedding exists
  if (!embedding) {
    return {
      valid: false,
      error: 'Embedding is null or undefined',
    };
  }

  // Check if it's an array
  if (!Array.isArray(embedding)) {
    return {
      valid: false,
      error: `Embedding must be an array, got ${typeof embedding}`,
    };
  }

  // Check if array is empty
  if (embedding.length === 0) {
    return {
      valid: false,
      error: 'Embedding array is empty',
      details: { dimension: 0, expectedDimension },
    };
  }

  // Check dimension
  if (embedding.length !== expectedDimension) {
    return {
      valid: false,
      error: `Invalid embedding dimension: expected ${expectedDimension}, got ${embedding.length}`,
      details: {
        dimension: embedding.length,
        expectedDimension,
      },
    };
  }

  // Check for NaN values
  const hasNaN = embedding.some((val: any) => typeof val !== 'number' || isNaN(val));
  if (hasNaN) {
    return {
      valid: false,
      error: 'Embedding contains NaN values',
      details: {
        dimension: embedding.length,
        expectedDimension,
        hasNaN: true,
      },
    };
  }

  // Check for Infinity values
  const hasInfinity = embedding.some((val: number) => !isFinite(val));
  if (hasInfinity) {
    return {
      valid: false,
      error: 'Embedding contains Infinity values',
      details: {
        dimension: embedding.length,
        expectedDimension,
        hasInfinity: true,
      },
    };
  }

  // Check if all zeros (indicates generation failure)
  const isAllZeros = embedding.every((val: number) => val === 0);
  if (isAllZeros) {
    return {
      valid: false,
      error: 'Embedding is all zeros (possible generation failure)',
      details: {
        dimension: embedding.length,
        expectedDimension,
        isAllZeros: true,
      },
    };
  }

  // All checks passed
  return { valid: true };
}

/**
 * Validate embedding and throw error if invalid
 *
 * @param embedding - The embedding to validate
 * @param expectedDimension - Expected dimension
 * @param context - Context for error message (e.g., 'VectorDB upsert')
 * @throws Error if validation fails
 *
 * @example
 * assertValidEmbedding(embedding, 768, 'RAGService.generateEmbedding');
 */
export function assertValidEmbedding(
  embedding: any,
  expectedDimension?: number,
  context?: string
): asserts embedding is number[] {
  const result = validateEmbedding(embedding, expectedDimension);

  if (!result.valid) {
    const contextMsg = context ? `[${context}] ` : '';
    throw new Error(`${contextMsg}${result.error}`);
  }
}

/**
 * Validate multiple embeddings in batch
 *
 * @param embeddings - Array of embeddings to validate
 * @param expectedDimension - Expected dimension
 * @returns Object with validation results
 *
 * @example
 * const results = validateEmbeddingBatch(embeddings);
 * if (results.invalidCount > 0) {
 *   console.error(`${results.invalidCount} invalid embeddings found`);
 * }
 */
export function validateEmbeddingBatch(
  embeddings: any[],
  expectedDimension?: number
): {
  validCount: number;
  invalidCount: number;
  errors: Array<{ index: number; error: string }>;
} {
  let validCount = 0;
  let invalidCount = 0;
  const errors: Array<{ index: number; error: string }> = [];

  embeddings.forEach((embedding, index) => {
    const result = validateEmbedding(embedding, expectedDimension);
    if (result.valid) {
      validCount++;
    } else {
      invalidCount++;
      errors.push({ index, error: result.error || 'Unknown error' });
    }
  });

  return { validCount, invalidCount, errors };
}

