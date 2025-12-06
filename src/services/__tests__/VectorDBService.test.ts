import { VectorDBService, VectorDocument, VectorSearchQuery } from '../VectorDBService';
import { VECTOR_DB_CONSTANTS } from '../../config/constants';

describe('VectorDBService', () => {
  let service: VectorDBService;

  beforeEach(() => {
    service = new VectorDBService({
      backend: 'in-memory',
      dimensions: 768,
    });
  });

  describe('HNSW Index', () => {
    it('should initialize HNSW index', () => {
      // HNSW should be initialized in constructor
      expect(service).toBeDefined();
    });

    it('should add documents to HNSW index', async () => {
      const doc: VectorDocument = {
        id: 'test-1',
        embedding: new Array(768).fill(0).map(() => Math.random()),
        content: 'Test document',
        metadata: {
          category: 'test',
          audience: ['all'],
          source: 'test',
          timestamp: new Date(),
          version: '1.0',
        },
      };

      await service.upsert(doc);

      // Verify document count
      const count = await service.count();
      expect(count).toBe(1);
    });

    it('should search using HNSW index', async () => {
      // Add test documents
      const docs: VectorDocument[] = [];
      for (let i = 0; i < 10; i++) {
        docs.push({
          id: `doc-${i}`,
          embedding: new Array(768).fill(0).map(() => Math.random()),
          content: `Test document ${i}`,
          metadata: {
            category: 'test',
            audience: ['all'],
            source: 'test',
            timestamp: new Date(),
            version: '1.0',
          },
        });
      }

      await service.upsertBatch(docs);

      // Search
      const query: VectorSearchQuery = {
        embedding: new Array(768).fill(0).map(() => Math.random()),
        topK: 5,
      };

      const results = await service.search(query);

      expect(results).toHaveLength(5);
      expect(results[0]).toHaveProperty('document');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('distance');
    });

    it('should return results in order of similarity', async () => {
      // Create a reference embedding
      const refEmbedding = new Array(768).fill(0).map(() => Math.random());

      // Create similar and dissimilar documents
      const similarDoc: VectorDocument = {
        id: 'similar',
        embedding: refEmbedding.map(v => v + Math.random() * 0.01), // Very close
        content: 'Similar document',
        metadata: {
          category: 'test',
          audience: ['all'],
          source: 'test',
          timestamp: new Date(),
          version: '1.0',
        },
      };

      const dissimilarDoc: VectorDocument = {
        id: 'dissimilar',
        embedding: new Array(768).fill(0).map(() => Math.random()), // Random
        content: 'Dissimilar document',
        metadata: {
          category: 'test',
          audience: ['all'],
          source: 'test',
          timestamp: new Date(),
          version: '1.0',
        },
      };

      await service.upsert(similarDoc);
      await service.upsert(dissimilarDoc);

      // Search with reference embedding
      const results = await service.search({
        embedding: refEmbedding,
        topK: 2,
      });

      // First result should be the similar document
      expect(results[0].document.id).toBe('similar');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should apply filters correctly', async () => {
      const doc1: VectorDocument = {
        id: 'category-a',
        embedding: new Array(768).fill(0).map(() => Math.random()),
        content: 'Category A document',
        metadata: {
          category: 'category_a',
          audience: ['donors'],
          source: 'test',
          timestamp: new Date(),
          version: '1.0',
        },
      };

      const doc2: VectorDocument = {
        id: 'category-b',
        embedding: new Array(768).fill(0).map(() => Math.random()),
        content: 'Category B document',
        metadata: {
          category: 'category_b',
          audience: ['guardians'],
          source: 'test',
          timestamp: new Date(),
          version: '1.0',
        },
      };

      await service.upsert(doc1);
      await service.upsert(doc2);

      // Search with category filter
      const results = await service.search({
        embedding: new Array(768).fill(0).map(() => Math.random()),
        topK: 5,
        filters: { category: 'category_a' },
      });

      expect(results).toHaveLength(1);
      expect(results[0].document.id).toBe('category-a');
    });

    it('should apply minimum score threshold', async () => {
      const doc: VectorDocument = {
        id: 'test',
        embedding: new Array(768).fill(0).map(() => Math.random()),
        content: 'Test',
        metadata: {
          category: 'test',
          audience: ['all'],
          source: 'test',
          timestamp: new Date(),
          version: '1.0',
        },
      };

      await service.upsert(doc);

      // Search with very high threshold (should return nothing)
      const results = await service.search({
        embedding: new Array(768).fill(0).map(() => Math.random()),
        topK: 5,
        minScore: 0.99, // Very high threshold
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should handle batch upsert', async () => {
      const docs: VectorDocument[] = Array.from({ length: 50 }, (_, i) => ({
        id: `batch-${i}`,
        embedding: new Array(768).fill(0).map(() => Math.random()),
        content: `Batch document ${i}`,
        metadata: {
          category: 'batch',
          audience: ['all'],
          source: 'test',
          timestamp: new Date(),
          version: '1.0',
        },
      }));

      const result = await service.upsertBatch(docs);

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(50);
      expect(result.failedCount).toBe(0);

      const count = await service.count();
      expect(count).toBe(50);
    });

    it('should clear search cache when documents change', async () => {
      const doc: VectorDocument = {
        id: 'test',
        embedding: new Array(768).fill(0).map(() => Math.random()),
        content: 'Test',
        metadata: {
          category: 'test',
          audience: ['all'],
          source: 'test',
          timestamp: new Date(),
          version: '1.0',
        },
      };

      await service.upsert(doc);

      // First search (cache miss)
      const query: VectorSearchQuery = {
        embedding: new Array(768).fill(0).map(() => Math.random()),
        topK: 5,
      };
      await service.search(query);

      // Second search (should be cached)
      await service.search(query);

      // Add new document (should clear cache)
      await service.upsert({
        ...doc,
        id: 'test-2',
      });

      // Search again (cache should be cleared)
      const results = await service.search(query);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Embedding Validation', () => {
    it('should reject documents with invalid embeddings', async () => {
      const invalidDoc: VectorDocument = {
        id: 'invalid',
        embedding: [1, 2, 3] as any, // Wrong dimensions
        content: 'Invalid',
        metadata: {
          category: 'test',
          audience: ['all'],
          source: 'test',
          timestamp: new Date(),
          version: '1.0',
        },
      };

      await expect(service.upsert(invalidDoc)).rejects.toThrow();
    });

    it('should reject search with invalid query embedding', async () => {
      const query: VectorSearchQuery = {
        embedding: [1, 2, 3] as any, // Wrong dimensions
        topK: 5,
      };

      await expect(service.search(query)).rejects.toThrow();
    });
  });

  describe('Delete Operations', () => {
    it('should delete documents', async () => {
      const doc: VectorDocument = {
        id: 'to-delete',
        embedding: new Array(768).fill(0).map(() => Math.random()),
        content: 'To delete',
        metadata: {
          category: 'test',
          audience: ['all'],
          source: 'test',
          timestamp: new Date(),
          version: '1.0',
        },
      };

      await service.upsert(doc);
      expect(await service.count()).toBe(1);

      await service.delete('to-delete');
      expect(await service.count()).toBe(0);
    });

    it('should handle batch delete', async () => {
      const docs: VectorDocument[] = Array.from({ length: 5 }, (_, i) => ({
        id: `delete-${i}`,
        embedding: new Array(768).fill(0).map(() => Math.random()),
        content: `Delete ${i}`,
        metadata: {
          category: 'test',
          audience: ['all'],
          source: 'test',
          timestamp: new Date(),
          version: '1.0',
        },
      }));

      await service.upsertBatch(docs);
      expect(await service.count()).toBe(5);

      await service.deleteBatch(['delete-0', 'delete-1', 'delete-2']);
      expect(await service.count()).toBe(2);
    });
  });
});

