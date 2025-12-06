import { CaseAgent } from '../CaseAgent';
import { RAGService } from '../../services/RAGService';
import { VertexAISearchService } from '../../services/VertexAISearchService';

jest.mock('../../services/VertexAISearchService');

// Skip these tests if Gemini API key is not available
// These are integration tests that require real API access
const describeIfHasApiKey = process.env.GEMINI_API_KEY ? describe : describe.skip;

describeIfHasApiKey('CaseAgent - Intent Detection', () => {
  let agent: CaseAgent;
  let ragService: RAGService;

  // Helper to create valid CaseData
  const createCaseData = (overrides: any = {}) => ({
    id: 'case-1',
    name: 'Test Case',
    description: 'Test',
    status: 'active' as const,
    priority: 'normal' as const,
    category: 'rescue' as const,
    guardianId: 'guardian-1',
    donationsReceived: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    const mockVertexAI = new VertexAISearchService() as jest.Mocked<VertexAISearchService>;
    ragService = new RAGService(mockVertexAI);
    agent = new CaseAgent();
    agent.setRAGService(ragService);
  });

  describe('Donation Intent', () => {
    it('should detect donation intent with amount', async () => {
      const response = await agent.processCaseInquiry(
        'Quiero donar $1000',
        createCaseData(),
        {
          userId: 'user-1',
          userRole: 'user',
          language: 'es',
        }
      );

      expect(response.success).toBe(true);
      // Should mention amount
      expect(response.message.toLowerCase()).toMatch(/1000|1\.000|mil/);
    });

    it('should detect donation intent without amount', async () => {
      const response = await agent.processCaseInquiry(
        'Quiero donar',
        createCaseData(),
        {
          userId: 'user-1',
          userRole: 'user',
          language: 'es',
        }
      );

      expect(response.success).toBe(true);
      // Should ask for amount
      expect(response.message.toLowerCase()).toMatch(/monto|cantidad|cuánto/);
    });

    it('should detect short-form donation', async () => {
      const response = await agent.processCaseInquiry(
        'Donar',
        createCaseData(),
        {
          userId: 'user-1',
          userRole: 'user',
          language: 'es',
        }
      );

      expect(response.success).toBe(true);
    });

    it('should detect amount-only message', async () => {
      const response = await agent.processCaseInquiry(
        '$500',
        createCaseData(),
        {
          userId: 'user-1',
          userRole: 'user',
          language: 'es',
        }
      );

      expect(response.success).toBe(true);
      expect(response.message).toMatch(/500/);
    });
  });

  describe('Share Intent', () => {
    it('should detect share intent', async () => {
      const response = await agent.processCaseInquiry(
        'Quiero compartir',
        createCaseData(),
        {
          userId: 'user-1',
          userRole: 'user',
          language: 'es',
        }
      );

      expect(response.success).toBe(true);
      // Should provide share message
      expect(response.message.length).toBeGreaterThan(50);
    });

    it('should detect short-form share', async () => {
      const response = await agent.processCaseInquiry(
        'Compartir',
        createCaseData(),
        {
          userId: 'user-1',
          userRole: 'user',
          language: 'es',
        }
      );

      expect(response.success).toBe(true);
    });
  });

  describe('Help Intent', () => {
    it('should detect help-seeking messages', async () => {
      const response = await agent.processCaseInquiry(
        '¿Cómo puedo ayudar?',
        createCaseData(),
        {
          userId: 'user-1',
          userRole: 'user',
          language: 'es',
        }
      );

      expect(response.success).toBe(true);
      // Should provide help options
      expect(response.metadata).toBeDefined();
    });
  });

  describe('Intent Caching', () => {
    it('should cache intent detection results', async () => {
      const message = 'Quiero donar $1000';
      const caseData = createCaseData();
      const userContext = {
        userId: 'user-1',
        userRole: 'user' as const,
        language: 'es' as const,
      };

      // First call
      const response1 = await agent.processCaseInquiry(message, caseData, userContext);

      // Second call (should use cache)
      const response2 = await agent.processCaseInquiry(message, caseData, userContext);

      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      const response = await agent.processCaseInquiry(
        '', // Empty message
        createCaseData(),
        {
          userId: 'user-1',
          userRole: 'user',
          language: 'es',
        }
      );

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should handle rate limit errors', async () => {
      // Trigger rate limit by making many requests
        const promises = Array.from({ length: 150 }, (_, i) =>
          agent.processCaseInquiry(
            `Message ${i}`,
            createCaseData(),
          {
            userId: 'rate-limit-test',
            userRole: 'user',
            language: 'es',
          }
        )
      );

      const results = await Promise.all(promises);

      // At least one should hit rate limit
      const rateLimited = results.some(r => !r.success && r.error === 'RATE_LIMIT_EXCEEDED');
      expect(rateLimited).toBe(true);
    });
  });
});
