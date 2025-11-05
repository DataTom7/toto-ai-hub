import { TotoAPIGateway } from '../src/gateway/TotoAPIGateway';
import { KnowledgeBaseService } from '../src/services/KnowledgeBaseService';
import { RAGService } from '../src/services/RAGService';

// Mock dependencies
jest.mock('../src/services/KnowledgeBaseService');
jest.mock('../src/services/RAGService');
jest.mock('../src/index', () => ({
  TotoAI: jest.fn().mockImplementation(() => ({
    getAvailableAgents: jest.fn(() => []),
    getTwitterAgent: jest.fn(() => ({
      getAgentInfo: jest.fn(() => ({ capabilities: ['tweet_fetching'] })),
      getMonitoringStats: jest.fn(() => ({
        guardiansMonitored: 1,
        totalTweetsAnalyzed: 10,
      })),
      processMessage: jest.fn().mockResolvedValue({
        message: 'Test response',
        metadata: { confidence: 0.9 },
      }),
    })),
    getCaseAgent: jest.fn(() => ({
      getAgentInfo: jest.fn(() => ({ capabilities: ['case_information'] })),
      processCaseInquiry: jest.fn().mockResolvedValue({
        message: 'Case response',
        metadata: { confidence: 0.9 },
      }),
    })),
  })),
}));

describe('TotoAPIGateway', () => {
  let gateway: TotoAPIGateway;
  let mockKnowledgeBaseService: jest.Mocked<KnowledgeBaseService>;
  let mockRAGService: jest.Mocked<RAGService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockKnowledgeBaseService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getAll: jest.fn().mockResolvedValue([]),
      add: jest.fn(),
      refreshCache: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockRAGService = {
      addKnowledgeChunks: jest.fn().mockResolvedValue(undefined),
      clearKnowledgeChunks: jest.fn(),
      retrieveKnowledge: jest.fn().mockResolvedValue({
        chunks: [],
        totalResults: 0,
      }),
    } as any;

    (KnowledgeBaseService as jest.Mock).mockImplementation(() => mockKnowledgeBaseService);
    (RAGService as jest.Mock).mockImplementation(() => mockRAGService);

    gateway = new TotoAPIGateway();
  });

  describe('initialize', () => {
    it('should initialize knowledge base and RAG service', async () => {
      await gateway.initialize();

      expect(mockKnowledgeBaseService.initialize).toHaveBeenCalled();
      expect(mockRAGService.addKnowledgeChunks).toHaveBeenCalled();
    });
  });

  describe('getKnowledgeBaseService', () => {
    it('should return knowledge base service instance', () => {
      const service = gateway.getKnowledgeBaseService();
      expect(service).toBe(mockKnowledgeBaseService);
    });
  });

  describe('getAnalytics', () => {
    it('should return analytics data', async () => {
      const analytics = await gateway.getAnalytics();

      expect(analytics).toHaveProperty('totalSessions');
      expect(analytics).toHaveProperty('totalInteractions');
      expect(analytics).toHaveProperty('totalMessages');
      expect(analytics).toHaveProperty('topIntents');
      expect(analytics).toHaveProperty('conversionRates');
      expect(analytics).toHaveProperty('recentActivity');
      expect(analytics).toHaveProperty('userEngagement');
      expect(analytics).toHaveProperty('platformStats');
      expect(analytics.dataSource).toBe('realtime');
    });

    it('should cache analytics data', async () => {
      const analytics1 = await gateway.getAnalytics();
      const analytics2 = await gateway.getAnalytics();

      // Should return cached data (same timestamp)
      expect(analytics1.lastUpdated).toBe(analytics2.lastUpdated);
    });
  });

  describe('getAgents', () => {
    it('should return agent data', async () => {
      const agents = await gateway.getAgents();

      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
      
      agents.forEach(agent => {
        expect(agent).toHaveProperty('agentId');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('description');
        expect(agent).toHaveProperty('status');
        expect(agent).toHaveProperty('performance');
        expect(agent).toHaveProperty('capabilities');
      });
    });

    it('should include CaseAgent and TwitterAgent', async () => {
      const agents = await gateway.getAgents();
      const agentIds = agents.map(a => a.agentId);

      expect(agentIds).toContain('case-agent');
      expect(agentIds).toContain('twitter-agent');
    });
  });

  describe('getKnowledgeBase', () => {
    it('should return all knowledge base items', async () => {
      const mockItems = [
        { id: 'kb-1', title: 'Test 1', content: 'Content 1', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 },
        { id: 'kb-2', title: 'Test 2', content: 'Content 2', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 },
      ];

      mockKnowledgeBaseService.getAll.mockResolvedValue(mockItems as any);

      const items = await gateway.getKnowledgeBase();

      expect(items).toHaveLength(2);
      expect(mockKnowledgeBaseService.getAll).toHaveBeenCalled();
    });
  });

  describe('addKnowledgeItem', () => {
    it('should add knowledge item and update RAG service', async () => {
      const mockItem = {
        id: 'kb-new',
        title: 'New Item',
        content: 'New Content',
        category: 'test',
        agentTypes: [],
        audience: [],
        lastUpdated: '2024-01-01',
        usageCount: 0,
      };

      mockKnowledgeBaseService.add.mockResolvedValue(mockItem as any);

      const result = await gateway.addKnowledgeItem(
        'New Item',
        'New Content',
        'test',
        [],
        []
      );

      expect(mockKnowledgeBaseService.add).toHaveBeenCalled();
      expect(mockRAGService.addKnowledgeChunks).toHaveBeenCalled();
      expect(result).toEqual(mockItem);
    });
  });

  describe('resetKnowledgeBase', () => {
    it('should clear RAG service and refresh cache', async () => {
      await gateway.resetKnowledgeBase();

      expect(mockRAGService.clearKnowledgeChunks).toHaveBeenCalled();
      expect(mockKnowledgeBaseService.refreshCache).toHaveBeenCalled();
      expect(mockRAGService.addKnowledgeChunks).toHaveBeenCalled();
    });
  });

  describe('retrieveKnowledge', () => {
    it('should retrieve knowledge using RAG service', async () => {
      const mockResult = {
        chunks: [
          { id: 'kb-1', title: 'Test', content: 'Content', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 },
        ],
        totalResults: 1,
      };

      mockRAGService.retrieveKnowledge.mockResolvedValue(mockResult);

      const result = await gateway.retrieveKnowledge('test query', 'CaseAgent', 'context', 'donors');

      expect(mockRAGService.retrieveKnowledge).toHaveBeenCalledWith({
        query: 'test query',
        agentType: 'CaseAgent',
        context: 'context',
        audience: 'donors',
        maxResults: 3,
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle errors gracefully', async () => {
      mockRAGService.retrieveKnowledge.mockRejectedValue(new Error('RAG error'));

      const result = await gateway.retrieveKnowledge('test query', 'CaseAgent');

      expect(result).toHaveProperty('chunks');
      expect(result.chunks).toEqual([]);
      expect(result.totalResults).toBe(0);
    });
  });

  describe('testAI', () => {
    it('should test CaseAgent with message', async () => {
      const result = await gateway.testAI('Tell me about Luna', 'case-agent', 'case-001');

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.metadata.agentType).toBe('CaseAgent');
      expect(result.metadata.confidence).toBeGreaterThan(0);
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should test TwitterAgent with message', async () => {
      const result = await gateway.testAI('Analyze this tweet', 'twitter-agent');

      expect(result.success).toBe(true);
      expect(result.metadata.agentType).toBe('TwitterAgent');
    });

    it('should handle errors in testAI', async () => {
      const { TotoAI } = require('../src/index');
      const mockTotoAI = new TotoAI();
      mockTotoAI.getCaseAgent = jest.fn(() => ({
        processCaseInquiry: jest.fn().mockRejectedValue(new Error('Test error')),
      }));

      const result = await gateway.testAI('test', 'case-agent');

      expect(result.success).toBe(false);
      expect(result.response).toContain('Error');
    });
  });

  describe('trainAgent', () => {
    it('should simulate training process', async () => {
      const result = await gateway.trainAgent('case-agent');

      expect(result.success).toBe(true);
      expect(result.agentId).toBe('case-agent');
      expect(result.status).toBe('training_completed');
      expect(result.trainingData).toHaveProperty('samplesProcessed');
      expect(result.trainingData).toHaveProperty('accuracyImprovement');
      expect(result.trainingData).toHaveProperty('trainingTime');
    });
  });

  describe('getRAGService', () => {
    it('should return RAG service instance', () => {
      const service = gateway.getRAGService();
      expect(service).toBe(mockRAGService);
    });
  });
});

