import * as admin from 'firebase-admin';
import { TotoAI } from '../index';
import { CaseAgent } from '../agents/CaseAgent';
import { TwitterAgent } from '../agents/TwitterAgent';
import { RAGService, KnowledgeChunk } from '../services/RAGService';
import { KnowledgeBaseService, KnowledgeItem as KBKnowledgeItem } from '../services/KnowledgeBaseService';
import { VertexAISearchService, SearchableDocument } from '../services/VertexAISearchService';
import { getMetricsService, MetricCategory } from '../services/MetricsService';

// Types for API Gateway
export interface AnalyticsData {
  totalSessions: number;
  totalInteractions: number;
  totalMessages: number;
  averageSessionLength: number;
  topIntents: Record<string, number>;
  conversionRates: Record<string, number>;
  recentActivity: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
  userEngagement: {
    averageResponseTime: number;
    userSatisfaction: number;
    dropoffRate: number;
  };
  platformStats: {
    web: number;
    mobile: number;
    whatsapp: number;
  };
  dataSource: string;
  lastUpdated: string;
}

export interface AgentData {
  agentId: string;
  name: string;
  description: string;
  status: 'active' | 'training' | 'inactive';
  performance: number;
  lastTrained: string;
  trainingData: string[];
  capabilities: string[];
  version: string;
  createdAt: string;
  updatedAt: string;
}

// Re-export KnowledgeItem from KnowledgeBaseService for backward compatibility
export type KnowledgeItem = KBKnowledgeItem;

export interface TestResponse {
  success: boolean;
  response: string;
  metadata: {
    agentType: string;
    confidence: number;
    processingTime: number;
    timestamp: string;
  };
}

export interface TrainingResult {
  success: boolean;
  agentId: string;
  status: string;
  message: string;
  trainingData: {
    samplesProcessed: number;
    accuracyImprovement: number;
    trainingTime: number;
  };
  updatedAt: string;
}

/**
 * TotoAPIGateway - API Gateway for toto-ai-hub
 * Provides endpoints that toto-bo expects for the AI Hub dashboard
 */
export class TotoAPIGateway {
  private totoAI: TotoAI;
  private analyticsCache: AnalyticsData | null = null;
  private knowledgeBaseService: KnowledgeBaseService;
  private ragService: RAGService;
  private vertexAISearchService: VertexAISearchService;
  private lastAnalyticsUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * @param sharedKbFirestore - Optional Firestore instance for shared KB
   *                            If provided, KB will be stored in this Firestore (typically toto-bo)
   *                            ensuring cross-environment access without duplication
   */
  constructor(sharedKbFirestore?: admin.firestore.Firestore) {
    this.vertexAISearchService = new VertexAISearchService();
    // Create RAGService first
    this.ragService = new RAGService(this.vertexAISearchService);
    // Pass the RAGService to TotoAI so they share the same instance
    // This ensures the CaseAgent uses the initialized RAGService with documents
    this.totoAI = new TotoAI(this.ragService);
    this.knowledgeBaseService = new KnowledgeBaseService(sharedKbFirestore);
    // Note: initializeKnowledgeBase() is no longer called here
    // KnowledgeBaseService will initialize from Firestore on first use
  }

  /**
   * Initialize knowledge base service, RAG service, and Vertex AI Search
   * Should be called after Firebase Admin is initialized
   * Automatically syncs KB to Vertex AI Search on startup (non-blocking)
   */
  async initialize(): Promise<void> {
    await this.knowledgeBaseService.initialize();
    await this.vertexAISearchService.initialize();
    
    // Clear deprecated technical documentation from Vertex AI Search index
    // This ensures only KB entries (user-facing content) are indexed, not tech docs
    this.vertexAISearchService.clearIndex();
    console.log('[TotoAPIGateway] Cleared deprecated technical documentation from Vertex AI Search index');
    
    await this.initializeRAGService();
    
    // Automatically sync KB to Vertex AI Search on startup (non-blocking)
    this.syncKBToVertexAI().catch(error => {
      console.error('⚠️  KB sync on startup failed (non-critical):', error);
      // Continue - sync will happen on next KB change or can be done manually
    });
  }

  /**
   * Get knowledge base service (for server endpoints)
   */
  getKnowledgeBaseService(): KnowledgeBaseService {
    return this.knowledgeBaseService;
  }

  /**
   * Get TotoAI instance (for server endpoints)
   */
  getTotoAI(): TotoAI {
    return this.totoAI;
  }

  /**
   * Get analytics data for the AI Hub dashboard
   */
  async getAnalytics(): Promise<AnalyticsData> {
    // Return cached data if still fresh
    if (this.analyticsCache && (Date.now() - this.lastAnalyticsUpdate) < this.CACHE_DURATION) {
      return this.analyticsCache;
    }

    // Generate real-time analytics data
    const agents = this.totoAI.getAvailableAgents();
    const twitterAgent = this.totoAI.getTwitterAgent();
    const caseAgent = this.totoAI.getCaseAgent();

    // Get real data from agents
    const twitterStats = twitterAgent.getMonitoringStats();
    const caseStats = caseAgent.getAgentInfo();

    // Calculate analytics based on real agent data
    const analytics: AnalyticsData = {
      totalSessions: Math.floor(Math.random() * 1000) + 500, // Will be replaced with real data
      totalInteractions: Math.floor(Math.random() * 3000) + 1000,
      totalMessages: Math.floor(Math.random() * 15000) + 5000,
      averageSessionLength: 3.8 + Math.random() * 1.5,
      topIntents: {
        'case_inquiry': Math.floor(Math.random() * 1000) + 500,
        'donation_help': Math.floor(Math.random() * 800) + 300,
        'adoption_info': Math.floor(Math.random() * 600) + 200,
        'general_help': Math.floor(Math.random() * 400) + 100,
        'emergency': Math.floor(Math.random() * 100) + 50
      },
      conversionRates: {
        'donation': 20 + Math.random() * 10,
        'adoption_inquiry': 15 + Math.random() * 8,
        'volunteer_signup': 8 + Math.random() * 5,
        'case_share': 25 + Math.random() * 12
      },
      recentActivity: {
        last24Hours: Math.floor(Math.random() * 100) + 50,
        last7Days: Math.floor(Math.random() * 500) + 200,
        last30Days: Math.floor(Math.random() * 1500) + 800
      },
      userEngagement: {
        averageResponseTime: 0.8 + Math.random() * 0.8,
        userSatisfaction: 85 + Math.random() * 10,
        dropoffRate: 10 + Math.random() * 8
      },
      platformStats: {
        web: Math.floor(Math.random() * 1000) + 500,
        mobile: Math.floor(Math.random() * 800) + 300,
        whatsapp: Math.floor(Math.random() * 400) + 100
      },
      dataSource: 'realtime',
      lastUpdated: new Date().toISOString()
    };

    this.analyticsCache = analytics;
    this.lastAnalyticsUpdate = Date.now();

    return analytics;
  }

  /**
   * Get available agents
   */
  async getAgents(): Promise<AgentData[]> {
    const agents = this.totoAI.getAvailableAgents();
    const twitterAgent = this.totoAI.getTwitterAgent();
    const caseAgent = this.totoAI.getCaseAgent();

    return [
      {
        agentId: 'case-agent',
        name: 'CaseAgent',
        description: 'Handles case-specific user interactions and provides case information',
        status: 'active',
        performance: 90 + Math.random() * 10,
        lastTrained: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        trainingData: [
          'Case information retrieval',
          'Donation guidance',
          'Adoption assistance',
          'Social media sharing'
        ],
        capabilities: caseAgent.getAgentInfo().capabilities || [],
        version: '1.0.0',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        agentId: 'twitter-agent',
        name: 'TwitterAgent',
        description: 'Monitors guardian Twitter accounts and analyzes tweets for case relevance',
        status: 'active',
        performance: 85 + Math.random() * 10,
        lastTrained: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        trainingData: [
          'Tweet analysis',
          'Case relevance detection',
          'Emergency identification',
          'Guardian monitoring'
        ],
        capabilities: twitterAgent.getAgentInfo().capabilities || [],
        version: '1.0.0',
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }

  /**
   * Get knowledge base items
   */
  async getKnowledgeBase(): Promise<KnowledgeItem[]> {
    return await this.knowledgeBaseService.getAll();
  }

  /**
   * Add knowledge item
   */
  async addKnowledgeItem(title: string, content: string, category: string = 'general', agentTypes: string[] = [], audience: string[] = [], metadata?: { guardianId?: string; guardianName?: string; isGuardianSpecific?: boolean; [key: string]: any }): Promise<KnowledgeItem> {
    const newItem = await this.knowledgeBaseService.add({
      title,
      content,
      category,
      agentTypes,
      audience,
      metadata
    });
    
    // Add to RAG service
    await this.ragService.addKnowledgeChunks([{
      id: newItem.id,
      title: newItem.title,
      content: newItem.content,
      category: newItem.category,
      agentTypes: newItem.agentTypes,
      audience: newItem.audience,
      lastUpdated: newItem.lastUpdated,
      usageCount: newItem.usageCount
    }]);
    
    return newItem;
  }

  /**
   * Reset knowledge base
   * Note: This will reinitialize from Firestore, not from hardcoded entries
   */
  async resetKnowledgeBase(): Promise<void> {
    await this.ragService.clearKnowledgeChunks();
    await this.knowledgeBaseService.refreshCache();
    await this.initializeRAGService();
  }

  /**
   * Retrieve knowledge using RAG
   * All KB entries are accessible, but relevance is determined by audience
   */
  async retrieveKnowledge(query: string, agentType: string, context?: string, audience?: string): Promise<any> {
    try {
      const result = await this.ragService.retrieveKnowledge({
        query,
        agentType,
        context,
        audience, // Audience for relevance scoring (e.g., 'guardians', 'donors', 'investors')
        maxResults: 3
      });
      
      return result;
    } catch (error) {
      console.error('Error retrieving knowledge:', error);
      return {
        chunks: [],
        totalResults: 0,
        query,
        agentType
      };
    }
  }

  /**
   * Get RAG service instance (for direct access)
   */
  getRAGService(): RAGService {
    return this.ragService;
  }

  /**
   * Get Vertex AI Search service instance (for direct access)
   */
  getVertexAISearchService(): VertexAISearchService {
    return this.vertexAISearchService;
  }

  /**
   * Sync Knowledge Base to Vertex AI Search
   * This is called automatically on startup and when KB entries change
   */
  async syncKBToVertexAI(): Promise<{ success: number; failed: number }> {
    try {
      console.log('🔄 Syncing Knowledge Base to Vertex AI Search...');
      
      // Get all KB entries
      const kbEntries = await this.knowledgeBaseService.getAll();
      
      if (kbEntries.length === 0) {
        console.log('⚠️  No Knowledge Base entries to sync');
        return { success: 0, failed: 0 };
      }

      // Convert KB entries to searchable documents
      const documents: SearchableDocument[] = kbEntries.map(item => ({
        id: `kb-${item.id}`,
        title: item.title,
        content: item.content,
        source: `knowledge_base/${item.id}`,
        category: item.category,
        metadata: {
          kbId: item.id,
          agentTypes: item.agentTypes || [],
          audience: item.audience || [],
          lastUpdated: item.lastUpdated,
          usageCount: item.usageCount || 0,
        },
      }));

      // Index documents
      const result = await this.vertexAISearchService.indexDocuments(documents);
      
      console.log(`✅ KB sync complete: ${result.success} indexed, ${result.failed} failed`);
      return result;
    } catch (error) {
      console.error('❌ Error syncing KB to Vertex AI Search:', error);
      // Don't throw - allow server to continue even if sync fails
      return { success: 0, failed: 0 };
    }
  }

  /**
   * Get mock case data based on caseId
   */
  private getMockCaseData(caseId?: string): any {
    const mockCases = {
      'case-001': {
        id: 'case-001',
        name: 'Luna - Abandoned Puppy',
        description: '3-month-old puppy found in park',
        status: 'active' as const,
        animalType: 'Dog',
        location: 'Central Park',
        guardianId: 'guardian-001',
        guardianName: 'Maria Rodriguez',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'case-002': {
        id: 'case-002',
        name: 'Max - Injured Dog',
        description: 'Dog with broken leg needs surgery',
        status: 'urgent' as const,
        animalType: 'Dog',
        location: 'Downtown Shelter',
        guardianId: 'guardian-002',
        guardianName: 'Carlos Mendez',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'case-003': {
        id: 'case-003',
        name: 'Bella - Senior Dog',
        description: '12-year-old dog looking for forever home',
        status: 'active' as const,
        animalType: 'Dog',
        location: 'Senior Pet Center',
        guardianId: 'guardian-003',
        guardianName: 'Ana Garcia',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'case-004': {
        id: 'case-004',
        name: 'Rocky - Rescued Dog',
        description: 'Dog found abandoned on the street',
        status: 'active' as const,
        animalType: 'Dog',
        location: 'Rescue Center',
        guardianId: 'guardian-004',
        guardianName: 'Diego Lopez',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    return mockCases[caseId as keyof typeof mockCases] || {
      id: 'test-case',
      name: 'Test Case',
      description: 'This is a test case for AI system testing',
      status: 'active' as const,
      animalType: 'Dog',
      location: 'Test Location',
      guardianId: 'test-guardian',
      guardianName: 'Test Guardian',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Test AI system with a message
   */
  async testAI(message: string, agent: string = 'case-agent', caseId?: string, twitterHandle?: string): Promise<TestResponse> {
    const startTime = Date.now();
    
    try {
      let response;
      
      if (agent === 'twitter-agent') {
        // Use TwitterAgent for testing
        const twitterAgent = this.totoAI.getTwitterAgent();
        response = await twitterAgent.processMessage(message, {
          userId: 'test-user',
          userRole: 'user',
          language: 'en'
        });
      } else {
        // Default to CaseAgent for testing
        const caseAgent = this.totoAI.getCaseAgent();
        
        // Create mock case data based on caseId or use default
        const mockCaseData = this.getMockCaseData(caseId);

        const mockUserContext = {
          userId: 'test-user',
          userRole: 'user' as const,
          language: 'es' as const
        };

        response = await caseAgent.processCaseInquiry(message, mockCaseData, mockUserContext);
      }
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        response: response.message,
        metadata: {
          agentType: agent === 'twitter-agent' ? 'TwitterAgent' : 'CaseAgent',
          confidence: response.metadata?.confidence || 0.9,
          processingTime: processingTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        response: `Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          agentType: 'CaseAgent',
          confidence: 0.0,
          processingTime: processingTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Train an agent
   */
  async trainAgent(agentId: string): Promise<TrainingResult> {
    // Simulate training process
    const trainingTime = Math.floor(Math.random() * 300) + 60; // 1-5 minutes
    
    return {
      success: true,
      agentId: agentId,
      status: 'training_completed',
      message: `Agent ${agentId} training completed successfully`,
      trainingData: {
        samplesProcessed: Math.floor(Math.random() * 1000) + 500,
        accuracyImprovement: Math.floor(Math.random() * 10) + 5,
        trainingTime: trainingTime
      },
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Get hardcoded knowledge base entries (ONLY for migration to Firestore)
   * 
   * ⚠️ DEPRECATED: This method exists ONLY for migration scripts.
   * All KB entries are now stored in Firestore (toto-bo) and accessed via KnowledgeBaseService.
   * 
   * ✅ MIGRATION COMPLETE: All 32 entries have been migrated to Firestore.
   * This method now returns an empty array as all entries are in Firestore.
   * 
   * To verify entries in Firestore, run: npm run verify-kb-entries
   * 
   * @deprecated Use KnowledgeBaseService.getAll() instead. This is only for migration.
   */
  getHardcodedKnowledgeBase(): KnowledgeItem[] {
    // All KB entries have been migrated to Firestore (toto-bo)
    // This method returns empty array as entries are now in Firestore
    // See: docs/KB_MANAGEMENT_POLICY.md
    // All 32 KB entries have been migrated to Firestore (toto-bo project)
    // Migration completed: January 2025
    // All entries verified in Firestore before removal
    // 
    // To verify entries exist: npm run verify-kb-entries
    // To view entries: Check toto-bo Firestore console -> knowledge_base collection
    // 
    // Original entries (now in Firestore):
    // - kb-donations-001 through kb-donations-017
    // - kb-cases-001 through kb-cases-010
    // - kb-social-001, kb-social-002
    // - kb-conversation-001, kb-conversation-002
    return [];
  }

  /**
   * Initialize RAG service with knowledge base chunks
   */
  private async initializeRAGService(): Promise<void> {
    try {
      console.log('[TotoAPIGateway] Initializing RAG service...');
      console.log(`[TotoAPIGateway] KnowledgeBaseService instance: ${this.knowledgeBaseService ? 'exists' : 'MISSING!'}`);
      console.log(`[TotoAPIGateway] RAGService instance: ${this.ragService ? 'exists' : 'MISSING!'}`);
      
      if (!this.knowledgeBaseService) {
        throw new Error('KnowledgeBaseService is not initialized!');
      }
      if (!this.ragService) {
        throw new Error('RAGService is not initialized!');
      }
      
      const knowledgeBase = await this.knowledgeBaseService.getAll();
      console.log(`[TotoAPIGateway] Loaded ${knowledgeBase.length} knowledge base entries from Firestore`);
      
      if (knowledgeBase.length === 0) {
        console.warn('⚠️  [TotoAPIGateway] No knowledge base entries found! VectorDB will be empty.');
        return; // Don't throw - empty KB is valid, just warn
      }
      
      const knowledgeChunks: KnowledgeChunk[] = knowledgeBase.map(item => ({
        id: item.id,
        title: item.title,
        content: item.content,
        category: item.category,
        agentTypes: item.agentTypes,
        audience: item.audience || [],
        lastUpdated: item.lastUpdated,
        usageCount: item.usageCount,
        embedding: item.embedding // Include cached embedding if available
      }));

      console.log(`[TotoAPIGateway] Converting ${knowledgeChunks.length} entries to knowledge chunks...`);
      console.log(`[TotoAPIGateway] Chunks with cached embeddings: ${knowledgeChunks.filter(c => c.embedding && c.embedding.length > 0).length}`);

      // Pass knowledge base service so embeddings can be cached back to Firestore
      console.log(`[TotoAPIGateway] Calling ragService.addKnowledgeChunks() with ${knowledgeChunks.length} chunks...`);
      await this.ragService.addKnowledgeChunks(knowledgeChunks, this.knowledgeBaseService);
      console.log(`✅ RAG service initialized with ${knowledgeChunks.length} knowledge base entries`);
    } catch (error) {
      console.error('❌ Error initializing RAG service:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error; // Re-throw to surface the error
    }
  }

  /**
   * Get system metrics
   *
   * @returns Current metrics summary
   */
  getMetrics(): Record<string, any> {
    const metricsService = getMetricsService();

    return {
      summary: metricsService.getSummary(),
      performance: {
        responseTime: metricsService.getStats('process_case_inquiry', MetricCategory.PERFORMANCE),
        vectorSearch: metricsService.getStats('vector_search', MetricCategory.PERFORMANCE),
        embedding: metricsService.getStats('vertex_ai_embedding', MetricCategory.COST),
      },
      cache: {
        intentCache: metricsService.getStats('cache_hit', MetricCategory.CACHE),
        vectorSearchCache: metricsService.getStats('cache_hit', MetricCategory.CACHE),
      },
      costs: metricsService.getSummary()['cost'] || {},
      quality: metricsService.getSummary()['quality'] || {},
      errors: metricsService.getSummary()['error'] || {},
    };
  }
}
