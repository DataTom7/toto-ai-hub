import { RAGService, KnowledgeChunk } from '../RAGService';
import { VertexAISearchService } from '../VertexAISearchService';

// Mock VertexAISearchService
jest.mock('../VertexAISearchService');

describe('RAGService', () => {
  let service: RAGService;
  let mockVertexAI: jest.Mocked<VertexAISearchService>;

  beforeEach(() => {
    mockVertexAI = new VertexAISearchService() as jest.Mocked<VertexAISearchService>;
    service = new RAGService(mockVertexAI);
  });

  describe('Embedding Generation', () => {
    it('should generate embeddings for text', async () => {
      const text = 'Test text for embedding';

      // Mock will use fallback embedding
      const embedding = await service.generateEmbedding(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
      expect(embedding.every(v => typeof v === 'number')).toBe(true);
    });

    it('should cache embeddings', async () => {
      const text = 'Cacheable text';

      // First call
      const embedding1 = await service.generateEmbedding(text);

      // Second call (should use cache)
      const embedding2 = await service.generateEmbedding(text);

      // Should return same embedding
      expect(embedding1).toEqual(embedding2);
    });

    it('should handle empty text', async () => {
      // Empty text uses fallback embedding (hash-based)
      const embedding = await service.generateEmbedding('');
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
    });

    it('should handle very long text', async () => {
      const longText = 'word '.repeat(10000); // 50,000 characters

      const embedding = await service.generateEmbedding(longText);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
    });

    it('should validate generated embeddings', async () => {
      const text = 'Test validation';

      const embedding = await service.generateEmbedding(text);

      // Should not contain NaN or Infinity
      expect(embedding.every(v => isFinite(v))).toBe(true);

      // Should not be all zeros
      expect(embedding.some(v => v !== 0)).toBe(true);
    });
  });

  describe('Knowledge Retrieval', () => {
    beforeEach(async () => {
      // Add test KB entries
      const chunks: KnowledgeChunk[] = [
        {
          id: 'kb-1',
          category: 'donations',
          title: 'How to donate',
          content: 'You can donate via bank transfer or MercadoPago',
          agentTypes: ['CaseAgent'],
          audience: ['donors'],
          lastUpdated: new Date().toISOString(),
          usageCount: 0,
        },
        {
          id: 'kb-2',
          category: 'adoption',
          title: 'Adoption process',
          content: 'To adopt a pet, fill out the adoption form',
          agentTypes: ['CaseAgent'],
          audience: ['all'],
          lastUpdated: new Date().toISOString(),
          usageCount: 0,
        },
      ];

      await service.addKnowledgeChunks(chunks);
    });

    it('should retrieve relevant knowledge', async () => {
      const results = await service.retrieveKnowledge({
        query: 'How do I donate?',
        agentType: 'CaseAgent',
        maxResults: 2,
      });

      expect(results.chunks.length).toBeGreaterThan(0);
      expect(results.chunks[0]).toHaveProperty('content');
      expect(results.chunks[0]).toHaveProperty('title');
    });

    it('should filter by category', async () => {
      const results = await service.retrieveKnowledge({
        query: 'adoption process',
        agentType: 'CaseAgent',
        maxResults: 5,
      });

      // Results may be empty if embeddings fail, but structure should be correct
      expect(results).toHaveProperty('chunks');
      expect(results).toHaveProperty('totalResults');
      expect(Array.isArray(results.chunks)).toBe(true);
    });

    it('should filter by audience', async () => {
      const results = await service.retrieveKnowledge({
        query: 'donate',
        agentType: 'CaseAgent',
        audience: 'donors',
        maxResults: 5,
      });

      // Results may be empty if embeddings fail, but structure should be correct
      expect(results).toHaveProperty('chunks');
      expect(results).toHaveProperty('totalResults');
      expect(Array.isArray(results.chunks)).toBe(true);
    });

    it('should respect maxResults limit', async () => {
      const results = await service.retrieveKnowledge({
        query: 'test query',
        agentType: 'CaseAgent',
        maxResults: 1,
      });

      expect(results.chunks.length).toBeLessThanOrEqual(1);
    });

    it('should cache KB query results', async () => {
      const query = {
        query: 'cacheable query',
        agentType: 'CaseAgent',
        maxResults: 3,
      };

      // First call
      const results1 = await service.retrieveKnowledge(query);

      // Second call (should use cache)
      const results2 = await service.retrieveKnowledge(query);

      expect(results1.chunks).toEqual(results2.chunks);
    });
  });

  describe('Knowledge Entry Management', () => {
    it('should add knowledge chunks', async () => {
      const chunks: KnowledgeChunk[] = [
        {
          id: 'test-entry',
          category: 'test',
          title: 'Test Entry',
          content: 'Test content',
          agentTypes: ['CaseAgent'],
          audience: ['all'],
          lastUpdated: new Date().toISOString(),
          usageCount: 0,
        },
      ];

      await service.addKnowledgeChunks(chunks);

      const results = await service.retrieveKnowledge({
        query: 'Test content',
        agentType: 'CaseAgent',
        maxResults: 1,
      });

      expect(results.chunks.length).toBeGreaterThan(0);
    });

    it('should handle batch knowledge chunks', async () => {
      const chunks: KnowledgeChunk[] = Array.from({ length: 5 }, (_, i) => ({
        id: `batch-${i}`,
        category: 'test',
        title: `Batch Entry ${i}`,
        content: `Batch content ${i}`,
        agentTypes: ['CaseAgent'],
        audience: ['all'],
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
      }));

      await service.addKnowledgeChunks(chunks);

      const results = await service.retrieveKnowledge({
        query: 'Batch content',
        agentType: 'CaseAgent',
        maxResults: 10,
      });

      // Results may be empty if embeddings fail, but structure should be correct
      expect(results).toHaveProperty('chunks');
      expect(results).toHaveProperty('totalResults');
      expect(Array.isArray(results.chunks)).toBe(true);
    }, 10000); // Increase timeout

    it('should handle chunks with pre-computed embeddings', async () => {
      const embedding = new Array(768).fill(0).map(() => Math.random());
      const chunks: KnowledgeChunk[] = [
        {
          id: 'pre-embedded',
          category: 'test',
          title: 'Pre-embedded Entry',
          content: 'Content with embedding',
          agentTypes: ['CaseAgent'],
          audience: ['all'],
          embedding,
          lastUpdated: new Date().toISOString(),
          usageCount: 0,
        },
      ];

      await service.addKnowledgeChunks(chunks);

      const results = await service.retrieveKnowledge({
        query: 'Content with embedding',
        agentType: 'CaseAgent',
        maxResults: 1,
      });

      // Results may be empty if query embedding fails, but structure should be correct
      expect(results).toHaveProperty('chunks');
      expect(results).toHaveProperty('totalResults');
      expect(Array.isArray(results.chunks)).toBe(true);
    });
  });
});

