import {
  validateEmbedding,
  assertValidEmbedding,
  validateEmbeddingBatch,
} from '../embeddingValidator';

describe('embeddingValidator', () => {
  const validEmbedding = new Array(768).fill(0).map(() => Math.random());

  describe('validateEmbedding', () => {
    it('should validate correct embedding', () => {
      const result = validateEmbedding(validEmbedding);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject null/undefined', () => {
      expect(validateEmbedding(null).valid).toBe(false);
      expect(validateEmbedding(undefined).valid).toBe(false);
    });

    it('should reject non-array', () => {
      const result = validateEmbedding('not an array' as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be an array');
    });

    it('should reject empty array', () => {
      const result = validateEmbedding([]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject wrong dimensions', () => {
      const wrongDim = new Array(512).fill(0.5);
      const result = validateEmbedding(wrongDim, 768);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid embedding dimension');
      expect(result.details?.dimension).toBe(512);
      expect(result.details?.expectedDimension).toBe(768);
    });

    it('should reject NaN values', () => {
      const withNaN = [...validEmbedding];
      withNaN[100] = NaN;
      const result = validateEmbedding(withNaN);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('NaN');
    });

    it('should reject Infinity values', () => {
      const withInfinity = [...validEmbedding];
      withInfinity[100] = Infinity;
      const result = validateEmbedding(withInfinity);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Infinity');
    });

    it('should reject all-zero embeddings', () => {
      const allZeros = new Array(768).fill(0);
      const result = validateEmbedding(allZeros);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('all zeros');
    });
  });

  describe('assertValidEmbedding', () => {
    it('should not throw for valid embedding', () => {
      expect(() => assertValidEmbedding(validEmbedding)).not.toThrow();
    });

    it('should throw for invalid embedding', () => {
      expect(() => assertValidEmbedding(null)).toThrow();
    });

    it('should include context in error message', () => {
      expect(() => assertValidEmbedding(null, 768, 'TestContext')).toThrow(/TestContext/);
    });
  });

  describe('validateEmbeddingBatch', () => {
    it('should validate all valid embeddings', () => {
      const embeddings = [validEmbedding, validEmbedding, validEmbedding];
      const result = validateEmbeddingBatch(embeddings);
      expect(result.validCount).toBe(3);
      expect(result.invalidCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid embeddings in batch', () => {
      const embeddings = [validEmbedding, null, validEmbedding, []];
      const result = validateEmbeddingBatch(embeddings);
      expect(result.validCount).toBe(2);
      expect(result.invalidCount).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].index).toBe(1);
      expect(result.errors[1].index).toBe(3);
    });
  });
});

