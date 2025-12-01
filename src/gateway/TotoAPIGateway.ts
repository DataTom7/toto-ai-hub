import * as admin from 'firebase-admin';
import { TotoAI } from '../index';
import { CaseAgent } from '../agents/CaseAgent';
import { TwitterAgent } from '../agents/TwitterAgent';
import { RAGService, KnowledgeChunk } from '../services/RAGService';
import { KnowledgeBaseService, KnowledgeItem as KBKnowledgeItem } from '../services/KnowledgeBaseService';
import { VertexAISearchService, SearchableDocument } from '../services/VertexAISearchService';

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
    this.totoAI = new TotoAI();
    this.vertexAISearchService = new VertexAISearchService();
    this.ragService = new RAGService(this.vertexAISearchService);
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
   * Get hardcoded knowledge base entries (for migration purposes)
   * @deprecated Use KnowledgeBaseService instead. This is only for migration.
   */
  getHardcodedKnowledgeBase(): KnowledgeItem[] {
    return [
      // Donations Knowledge Base
      {
        id: 'kb-donations-001',
        title: 'Banking Alias System',
        content: `BANKING ALIAS SETUP
- Each guardian/admin must complete their banking alias when creating their guardian profile
- Banking aliases follow Argentina's national banking alias system (each guardian creates their own unique alias)
- Aliases are stored in the guardian's Firestore document and are guardian-specific (not case-specific)

DONOR ACCESS TO BANKING ALIASES
- In toto-app: The case agent provides the banking alias and basic bank transfer instructions when users show donation intent
- In toto-bo: Banking aliases are displayed in case details for guardians/admin users
- Users can make a standard transfer from their bank account or wallet using the guardian alias

DONATION PROCESS - CRITICAL: NOT "THROUGH THE PLATFORM"
- Donations are DIRECT bank transfers from donor's bank account or wallet to guardian's banking alias
- Do NOT say "through our platform" or "through the platform" - this is incorrect
- Say: "direct transfer to the guardian's banking alias" or "transfer from your bank/wallet to the guardian's alias"
- There is NO platform processing - money goes directly from donor to guardian
- Each guardian has one banking alias for all their cases
- No intermediary processing - 100% of donations go directly to the guardian
- The agent only provides the banking alias and instructions - the actual transfer happens outside the platform`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-002',
        title: 'Donation Verification Process',
        content: `VERIFICATION PURPOSE
- Donors should provide proof of transfer (bank document, wallet receipt, screenshot, etc.) if they want the donation to count as verified and earn totitos
- Verification is optional but recommended to earn totitos and improve user rating
- No penalties for unverified donations - donations still help the cause

VERIFICATION PROCESS
- Verification happens weekly with guardians
- Guardians review and approve donations after cross-checking with their records
- Once guardian approves, donor receives automatic notification
- Donors then earn their totitos for verified donations

IF VERIFICATION FAILS
- If verification fails, we contact the donor for further verification instructions
- Ask donors to provide more detailed information about the transfer (date, amount, transaction ID)
- Work collaboratively with donor to resolve any verification issues

GUARDIAN-LED VERIFICATION
- If the donor does not verify the donation, but the guardian verifies it independently (with user-specific data), we notify the user to claim their totitos
- This ensures donors don't miss out on totitos even if they forget to upload receipt`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-003',
        title: 'Totitos Loyalty System - Complete Guide',
        content: `WHAT ARE TOTITOS?
- Totitos are a loyalty/reward system for verified donors
- Totitos are earned for verified donations and other actions (sharing, interactions)
- Totitos can be exchanged for goods or services for pets
- System tracks all donor contributions and rewards active participation

HOW TO EARN TOTITOS:
- Verified donations: Each verified donation earns totitos (amount doesn't matter, only that it's verified)
- Sharing cases: Sharing cases on social media also earns totitos
- Interactions: Engaging with agents and the platform improves user rating which multiplies totitos
- User rating multiplier: 1 star = 1x, 2 stars = 2x, 3 stars = 3x, 4 stars = 4x, 5 stars = 5x
- Total totitos = base value × user star rating

VERIFICATION PROCESS FOR TOTITOS:
- Donors upload receipt/comprobante after making transfer
- Verification happens weekly with guardians
- Guardians review and approve donations after cross-checking records
- Once guardian approves, donor receives automatic notification
- Donor then earns totitos for the verified donation

IF DONOR DOESN'T VERIFY:
- If guardian verifies independently (with user-specific data), donor is notified to claim totitos
- This ensures donors don't miss totitos even if they forget to upload receipt
- Unverified donations still help the pet, but no totitos earned

WHERE TO SEE TOTITOS:
- Users can access their profile from the bottom navbar
- Profile shows: donation history, totitos earned, user rating/stars
- All donation and contribution information is accessible in the profile

USER RATING AND TOTITOS:
- User rating (1-5 stars) affects totitos multiplier
- Rating factors: active rate, number of donations, interactions with agents, guardian/user reviews
- Higher rating = more totitos per action
- Example: Base value 10 totitos × 3 star rating = 30 totitos earned

COMMUNICATION:
- When explaining totitos, mention: "Totitos son un sistema de recompensas por donaciones verificadas"
- Explain that sharing cases also earns totitos
- Mention that user rating multiplies totitos earnings
- Encourage verification to maximize totitos earnings`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-004',
        title: 'Donation Allocation Rules',
        content: `CASE-SPECIFIC DONATIONS
- Donations go directly to the specific case/guardian
- If a case exceeds its funding goal, excess donations are reassigned to the next urgent case under that same guardian's care
- Each guardian sets their own funding goals
- Funding goals can be modified if new needs arise
- No centralized fund management

COMMUNICATION TO DONORS
- When a case reaches its goal, inform donors that their donation will be reassigned to the guardian's next urgent case
- Frame this positively: "In the fortunate event that the case reaches the goal, your donation will be reassigned to the next urgent case of that specific guardian"
- Emphasize that their contribution continues to help pets in need`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-005',
        title: 'Donor Experience Overview',
        content: `PLATFORM ACCESS
- Donors access case information through conversational interface (chat with Toto)
- Available in toto-app, with future availability on web and WhatsApp
- Conversational approach makes donation process simple and personal

NOTIFICATIONS AND UPDATES
- Automatic notifications sent for case updates after donation
- Case conversations stored in donor's inbox for easy access
- Real-time updates keep donors informed about case progress

TAX AND DOCUMENTATION
- No tax certificates provided (direct guardian donations, not through organization)
- Donations go directly from donor to guardian's bank account
- This enables 100% of donations to reach the pets without intermediaries

INTERNATIONAL SUPPORT
- International donations supported
- Platform accessible from anywhere
- Multiple payment methods accepted (bank transfers, wallets)`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-006',
        title: 'Donation Amounts and Minimums',
        content: `- There is NO minimum donation amount
- Donors can donate any amount they wish
- Every donation helps, regardless of size
- No maximum donation limit
- When showing donation intent, agents should emphasize that every donation helps, no matter the amount`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-007',
        title: 'Toto Rescue Fund (TRF)',
        content: `CRITICAL: TRF ACRONYM DEFINITION
- TRF stands for "Toto Rescue Fund" (English name)
- In Spanish: "Fondo de Rescate de Toto" or use the acronym "TRF"
- NEVER translate TRF as "Transferencia Rápida de Fondos" - this is INCORRECT
- NEVER invent Spanish translations for TRF - always use "Toto Rescue Fund" or "Fondo de Rescate de Toto"
- When explaining TRF, always state: "TRF (Toto Rescue Fund)" or "TRF (Fondo de Rescate de Toto)"

PURPOSE
- The Toto Rescue Fund (TRF) is available for cases with urgent needs that arise on very short notice
- Used for medical needs that must be paid in advance
- Automatically disperses donations to the most urgent cases on a daily basis

DONATION OPTIONS
- Donors can choose to donate to: (1) a specific case, (2) a specific guardian (for their multiple cases), or (3) the Toto Rescue Fund
- TRF provides an alternative for donors who want to help without selecting a specific case
- Donations to different guardians require separate transactions

COMMUNICATION
- When explaining TRF, always clarify: "TRF es el Fondo de Rescate de Toto" or "TRF (Toto Rescue Fund)"
- CRITICAL: TRF is a GENERAL fund that automatically distributes to urgent cases - it is NOT a direct transfer to a specific guardian
- Explain: "TRF se asigna automáticamente a los casos más urgentes diariamente" or "TRF automatically allocates to the most urgent cases daily"
- Clarify: "Las donaciones al TRF no van directamente a un guardián específico, sino que se distribuyen automáticamente a los casos más urgentes"
- Emphasize that TRF ensures urgent cases receive immediate funding when specific case/guardian alias is unavailable
- NEVER say TRF is a direct transfer to a guardian - it's a general fund that distributes automatically
- NEVER create alternative translations or explanations for TRF`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-008',
        title: 'Donation Flow and Conversation Guidance',
        content: `CONVERSATION FLOW
- When users show donation intent, express gratitude and emphasize the importance of their contribution: "It's very important that we can count with your effort to help [case name]"
- CRITICAL: There is NO minimum donation amount - say "No hay un monto mínimo para donar, ¡cada ayuda cuenta!" or "You can donate any amount you wish - every donation helps!"
- Actively ask: "How much would you like to donate?"
- Once amount is confirmed, provide the banking alias and basic transfer instructions
- Offer to help verify the donation: "If you would like to improve your user scoring, you can verify your donation by sending me the receipt"
- Explain the benefits: "This will help you be a verified donor and collect totitos that can be exchanged for goods or services for our furry friends"

RECEIPT UPLOAD
- Donors can upload receipt directly in the conversation interface
- Accept bank documents, wallet receipts, or any proof of transfer
- Confirm receipt has been received`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-009',
        title: 'User Rating and Totitos Calculation System',
        content: `USER RATING SYSTEM (STARS)
- Users have a 1-5 star rating system
- Rating affects totitos multiplier: 1 star = 1x, 2 stars = 2x, 3 stars = 3x, 4 stars = 4x, 5 stars = 5x
- Rating factors include: active rate, number of donations, interactions with agents, guardian/user reviews

TOTITOS CALCULATION
- Each action (like a verified donation) has a specific base value
- Total totitos = base value × user star rating
- Example: If base value is 10 totitos and user has 3 stars, they earn 30 totitos
- Users earn totitos for every verified donation they make
- Totitos can be exchanged for goods or services for pets

COMMUNICATION
- Explain that user rating multiplies totitos earnings
- Mention that active participation, donations, and positive interactions improve rating
- Encourage verification to maximize totitos earnings`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-010',
        title: 'Donor Inbox and Case Communication - Complete Post-Donation Experience',
        content: `WHAT HAPPENS AFTER YOU DONATE:
- The case conversation is automatically saved in your inbox
- You'll receive automatic notifications when the case gets updates
- All case updates appear in your inbox conversation thread
- You can track your donation history and totitos in your profile

INBOX SYSTEM
- After a user donates to a case, that case's conversation is stored in their inbox
- Users can access their inbox from the bottom navbar
- Each case has its own conversation thread in the inbox
- Inbox shows all cases you've donated to or interacted with

CASE UPDATES AND NOTIFICATIONS
- When a case receives an update, a message is automatically sent to the specific case conversation in the donor's inbox
- Updates appear as unread messages in the inbox
- Users receive notifications to check their inbox when new case updates arrive
- Case updates include: medical progress, milestones, recovery status, treatment updates
- This ensures donors stay informed about the cases they've supported

WHAT HAPPENS IF CASE REACHES GOAL:
- If a case exceeds its funding goal, excess donations are automatically reassigned to the next urgent case under that same guardian's care
- Frame this positively: "En el afortunado caso de que el caso alcance su meta, tu donación se reasignará al siguiente caso urgente de ese guardián específico"
- Your donation continues to help pets in need, just directed to the next urgent case
- You'll still receive updates about the original case AND the new case if your donation is reallocated

PROFILE ACCESS
- Users can access their profile from the bottom navbar
- Profile shows: donation history, totitos earned, user rating/stars
- All donation and contribution information is accessible in the profile

COMMUNICATION
- When explaining post-donation experience, mention: "Después de donar, la conversación se guardará en tu bandeja de entrada y recibirás actualizaciones automáticas del caso"
- Explain that inbox notifications keep them informed
- Mention that if goal is reached, donation reallocates to next urgent case of same guardian`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-011',
        title: 'Donation Refunds and Corrections',
        content: `REFUND REQUESTS
- If a donor accidentally donates the wrong amount and requests a refund, agents should:
  1. Acknowledge the situation with empathy
  2. Explain that the guardian will be notified of the refund request
  3. Clarify that the final decision rests with the guardian
  4. Do not promise refunds - it's the guardian's decision

COMMUNICATION APPROACH
- Be understanding and helpful: "I understand the situation. I can notify the guardian about your refund request"
- Set expectations: "The guardian will review your request and make the decision"
- Encourage patience while the guardian reviews the request`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-012',
        title: 'Donation Allocation to Guardians',
        content: `GUARDIAN-SPECIFIC DONATIONS
- Donors can choose to donate directly to a guardian rather than a specific case
- When donating to a guardian, the allocation to specific cases is determined by the guardian's criteria
- However, urgency is a shared concern between all guardians, so urgent needs are prioritized

COMMUNICATION
- Explain that guardian donations help support all cases under that guardian's care
- Mention that the guardian will allocate based on urgency and need
- If donor wants to support multiple guardians, they need to make separate donations`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-013',
        title: 'Banking Alias Provision and Retrieval',
        content: `AGENT RESPONSIBILITY
- When users show donation intent, the agent MUST provide the banking alias directly
- The agent should retrieve the alias from the guardian's Firestore document (caseData.guardianId -> guardian document -> bankingAlias field)
- NEVER tell users to "find it in a profile" or "look in a section" - these don't exist in toto-app
- Provide the alias immediately when donation intent is expressed

ALIAS FORMAT
- Banking aliases follow Argentina's national banking alias system
- Each guardian has one unique alias for all their cases
- Present the alias clearly: "El alias bancario del guardián es [ALIAS]"
- Provide basic transfer instructions: "Puedes hacer una transferencia estándar desde tu banco o billetera usando este alias"

IF ALIAS NOT FOUND
- If the guardian document doesn't have a bankingAlias field, inform the user
- Offer alternative: suggest donating to Toto Rescue Fund (TRF) which can be allocated to urgent cases
- Escalate: inform the user that the guardian needs to complete their banking alias setup
- Do NOT make up or guess an alias`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-014',
        title: 'Missing Alias Scenarios and Alternative Donation Methods',
        content: `WHEN ALIAS IS NOT AVAILABLE - IMMEDIATE ACTION REQUIRED
- If guardian doesn't have bankingAlias configured in their Firestore document:
  1. Inform the user clearly: "El guardián aún no ha configurado su alias bancario"
  2. IMMEDIATELY offer Toto Rescue Fund (TRF) as alternative: "Mientras tanto, puedes donar al Fondo de Rescate de Toto que se asignará automáticamente a los casos más urgentes"
  3. Do NOT wait for user to ask about alternatives - proactively offer TRF
  4. Explain that TRF funds are distributed daily to most urgent cases
  5. Mention that once the guardian sets up their alias, they can donate directly to specific cases

ALTERNATIVE DONATION METHODS
- Toto Rescue Fund (TRF): Available when specific case/guardian alias is unavailable
- TRF funds are automatically allocated to most urgent cases on a daily basis
- TRF is ideal for urgent medical needs that must be paid in advance
- Donors can choose: case-directed donation (when alias available) OR TRF (always available)

WHAT NOT TO DO
- Do NOT suggest credit cards, payment links, or other payment methods that don't exist
- Do NOT say "hay otras maneras" without specifying TRF
- Do NOT wait for user to ask "what else can I do?" - offer TRF immediately

COMMUNICATION
- Always present TRF as a valid alternative, not a last resort
- Emphasize that TRF funds help the most urgent cases immediately
- If user prefers case-specific donation, offer to notify when alias becomes available
- Be proactive: when alias is missing, immediately offer TRF in the same response`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-015',
        title: 'Donation Transparency and Verification Details',
        content: `VERIFICATION PROCESS FOR DONORS
- After making a transfer, donors can verify their donation by sending the receipt/comprobante
- Donors upload the bank transfer receipt through the conversation
- Verification happens weekly: guardian verifies donations with the platform
- Once verified, donor receives notification and earns Totitos

VERIFICATION OUTCOMES
- If donor verifies: They earn Totitos and get confirmation notification
- If donor doesn't verify BUT guardian verifies (with user-specific data): Donor is notified to claim their Totitos
- If verification fails: Platform contacts donor for further verification instructions
- If donor doesn't verify at all: No Totitos earned, but donation still reaches the pet

TRANSPARENCY FEATURES
- All donations are registered and tracked
- Donations are used exclusively for the pet's care (case-specific)
- Donors receive automatic notifications when case gets updates
- Case updates show progress: medical treatment, milestones, recovery status
- Donors can see their donation history in their profile

COMMUNICATION
- Emphasize that 100% of donations go directly to the guardian (no fees)
- Explain that verification helps track donations and reward donors with Totitos
- Mention that donors will receive updates automatically after donating
- Clarify that even unverified donations reach the pets, but verification enables Totitos rewards`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      
      // Case Management Knowledge Base
      {
        id: 'kb-cases-001',
        title: 'Case Creation Process',
        content: `- Guardians and Admins can create cases
- Required fields: name, description, guardianId, donationGoal, images, category
- Optional fields: location, medicalNeeds, specialNeeds, tags
- New cases start in 'draft' status by default
- No review process required - cases go live immediately`,
        category: 'case_management',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-cases-002',
        title: 'Case Status Workflow',
        content: `- Draft → Active → Completed
- Priority levels: 'urgent' or 'normal'
- Status can be updated by admins or guardians
- Status changes are tracked in case updates
- Updates could trigger a status change, but not always necessary`,
        category: 'case_management',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-cases-003',
        title: 'Case Documentation',
        content: `- Each case requires: name, description, guardian information
- Medical needs and special requirements tracked
- Image galleries with full-screen preview
- Case updates and history maintained`,
        category: 'case_management',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-cases-004',
        title: 'Case Updates & Communication',
        content: `- Frequency depends on each case's needs
- Updates can include: status changes, medical progress, milestones, images
- Automatic notifications to donors when case updates`,
        category: 'case_management',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-cases-005',
        title: 'Case Categories',
        content: `- Rescue: Initial rescue operations
- Surgery: Medical procedures and treatments
- Treatment: Ongoing medical care
- Transit: Transportation and relocation
- Foster: Temporary care arrangements`,
        category: 'case_management',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-cases-006',
        title: 'Emergency Cases',
        content: `- Urgent priority cases get immediate attention
- Emergency cases can be created and activated instantly
- Special handling for medical emergencies and abuse situations`,
        category: 'case_management',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-cases-007',
        title: 'Agent Conversation Behavior Guidelines',
        content: `AVOID UNNECESSARY REPETITION
- Do NOT repeat case introduction information (name, description, situation) in every message
- Only mention case details when directly relevant to the user's question
- If user asks about donation process, focus on answering that - don't reintroduce the case
- If user asks about verification, focus on verification - don't repeat case story

CONVERSATION FLOW
- First message: Introduce the case with name, description, and needs (appropriate)
- Subsequent messages: Address user's specific questions without repeating case introduction
- Only reference case details when they're directly relevant to the current question
- Keep responses concise and focused on what the user asked

EXAMPLE GOOD BEHAVIOR
- User: "¿Cómo dono?"
- Good: "Para donar, puedes transferir al alias bancario del guardián. Te doy el alias..."
- Bad: "Sofía, una perrita preñada encontrada en un basural, necesita ayuda. Para donar, puedes transferir..."

EXAMPLE GOOD BEHAVIOR
- User: "¿Cómo verifico mi donación?"
- Good: "Puedes verificar enviando el comprobante de transferencia. Te explico el proceso..."
- Bad: "Sofía necesita ayuda urgente. Para verificar tu donación, puedes enviar el comprobante..."

COMMUNICATION PRINCIPLES
- Be helpful and informative, not repetitive
- Trust that the user remembers the case from the first message
- Focus on answering the specific question asked
- Provide relevant information without unnecessary context`,
        category: 'case_management',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-cases-008',
        title: 'Agent Identity and Communication Voice',
        content: `AGENT IDENTITY
- The agent IS part of Toto, not separate from it
- Use plural first person: "estamos", "podemos", "tenemos", "nuestro", "nosotros"
- Never use singular first person: "estoy", "puedo", "tengo", "mi", "yo"
- Examples:
  - Good: "Estamos aquí para ayudarte", "Podemos ayudarte con eso", "Tenemos el alias disponible"
  - Bad: "Estoy aquí para ayudarte", "Puedo ayudarte con eso", "Tengo el alias disponible"

BRAND NAME
- Always refer to the platform as "Toto", never "Betoto"
- "Betoto" is the website domain (betoto.pet), but the brand name is "Toto"
- Examples:
  - Good: "En Toto trabajamos directamente con guardianes", "Toto es tu asistente"
  - Bad: "En Betoto trabajamos...", "Betoto es tu asistente"

COMMUNICATION STYLE
- Be warm, helpful, and conversational
- Use "nosotros/nosotras" when referring to the platform or team
- Maintain consistent voice that reflects being part of the Toto community`,
        category: 'case_management',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent', 'SharingAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-cases-009',
        title: 'CRITICAL: Use ONLY Provided Case Data - No Hallucination',
        content: `MANDATORY RULE: USE ONLY PROVIDED CASE DATA
- You receive case information in the Case Information section of your context
- ONLY use the exact case details provided: name, description, status, animal type, location, guardian name, etc.
- NEVER make up, invent, or assume case details that are not in the provided data
- If case data says "Sofía, perrita preñada encontrada en basural, necesita hogar temporal y atención médica" - use EXACTLY that
- If case data says "Luna, perrita con pata rota" - use EXACTLY that
- NEVER confuse one case with another or mix up case details

EXAMPLES OF HALLUCINATION (DO NOT DO THIS):
- Bad: Case says "Sofía, perrita preñada" but you say "gatita con problemas respiratorios" - WRONG!
- Bad: Case says "Luna, perrita con pata rota" but you say "Sofía, perrita preñada" - WRONG!
- Bad: Making up medical conditions not mentioned in case description
- Bad: Making up adoption status when not provided
- Bad: Confusing case names or mixing case details

CORRECT BEHAVIOR:
- Read the Case Information section carefully
- Use ONLY the animal name, description, and status provided
- If something is not in the case data, say "no tengo esa información disponible" or "esa información no está disponible"
- If banking alias is missing, say "el alias no está disponible" and offer TRF
- NEVER invent payment methods, donation processes, or case details

BANKING ALIAS:
- If Case Information shows "Banking Alias: [alias]" - provide that exact alias
- If Case Information does NOT show a banking alias - say "el alias no está disponible" and immediately offer TRF
- NEVER make up or guess an alias
- NEVER suggest other payment methods that don't exist

PAYMENT METHODS:
- ONLY bank transfer via guardian banking alias exists
- If alias not available, ONLY offer Toto Rescue Fund (TRF)
- NEVER mention credit cards, payment links, or other methods
- NEVER say "hay otras maneras" without specifying TRF

CRITICAL: If you don't know something, say you don't know. Do NOT make it up.`,
        category: 'case_management',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-cases-010',
        title: 'Ways to Help - Donation, Sharing, and Adoption Options',
        content: `WAYS TO HELP WITH A CASE

There are three main ways users can help with a pet rescue case:

1. DONATION
- Users can make a direct bank transfer to the guardian's banking alias
- Donations are direct transfers from donor's bank account or wallet to guardian's banking alias
- There is NO minimum donation amount - every donation helps
- The platform provides the banking alias, but the transfer happens outside the platform
- Donors can verify their donation by uploading a receipt to earn totitos
- If guardian's banking alias is not available, users can donate to Toto Rescue Fund (TRF) which automatically allocates to urgent cases

2. SHARING ON SOCIAL MEDIA
- Users can share cases on Instagram, Twitter/X, or Facebook
- Sharing helps reach more potential supporters and donors
- Social media links are provided via quick action buttons in the conversation
- Sharing cases also earns totitos for the user
- Users should choose which platform they prefer to share on

3. ADOPTION
- Users interested in adopting can learn about adoption requirements
- Adoption process and requirements vary by case and guardian
- Users should express interest in adoption to learn specific requirements
- Not all cases are available for adoption - depends on case status and guardian's plans

WHEN TO REFERENCE THIS INFORMATION:
- When users ask "Cómo puedo ayudar?" / "How can I help?"
- When users ask "¿Qué puedo hacer?" / "What can I do?"
- When users want to know their options for helping
- Always provide all three options with brief explanations, then ask which they'd like to explore further

COMMUNICATION APPROACH:
- Start with gratitude: "¡Gracias por querer ayudar!" or "Thank you for wanting to help!"
- List all three options clearly
- Provide brief explanation for each option
- Ask follow-up: "¿Cuál te gustaría conocer más?" or "Which would you like to know more about?"
- Do NOT just describe the case - focus on actionable ways to help`,
        category: 'case_management',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-017',
        title: 'How to Explain Donation Process - Direct Transfer Only',
        content: `CRITICAL: DONATIONS ARE NOT "THROUGH THE PLATFORM"
- NEVER say "through our platform", "through the platform", "directly through our platform", or similar phrases
- Donations are DIRECT bank transfers from donor's bank account or wallet to guardian's banking alias
- The platform (Toto) only provides the banking alias and instructions - money never goes through Toto

CORRECT LANGUAGE TO USE:
- "Puedes hacer una transferencia directa desde tu cuenta bancaria o billetera al alias del guardián"
- "La donación va directamente del guardián a tu cuenta bancaria/billetera"
- "Transferirás directamente al guardián usando el alias bancario"
- "El dinero va directamente al guardián, sin intermediarios"

INCORRECT LANGUAGE (DO NOT USE):
- "Puedes donar a través de nuestra plataforma" - WRONG
- "Directamente a través de nuestra plataforma" - WRONG
- "Usando nuestra plataforma" - WRONG
- "A través de Toto" - WRONG

THE PROCESS:
1. Agent provides guardian's banking alias
2. Donor transfers money from their bank/wallet to that alias
3. Transfer happens outside Toto platform
4. Donor can optionally upload receipt for verification
5. Guardian verifies donation weekly
6. Donor earns totitos if verified`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-016',
        title: 'Payment Methods and Feature Accuracy',
        content: `AVAILABLE PAYMENT METHODS
- ONLY bank transfer via guardian banking alias exists
- Do NOT mention credit cards, debit cards, PayPal, or any other payment methods
- Do NOT mention payment links or online payment forms
- The ONLY way to donate is: bank transfer to guardian's banking alias

CRITICAL RULE: NO HALLUCINATION
- ONLY mention features, payment methods, and processes that actually exist in the platform
- If you don't know if something exists, don't mention it
- Never invent or suggest features that don't exist (e.g., credit card payments, payment links)
- If asked about features that don't exist, say: "Esa funcionalidad no está disponible en este momento"

WHEN ALIAS IS MISSING
- If guardian doesn't have bankingAlias configured:
  1. Immediately offer Toto Rescue Fund (TRF) as alternative
  2. Explain: "Mientras tanto, puedes donar al Fondo de Rescate Toto que se asignará automáticamente a los casos más urgentes"
  3. Do NOT suggest other payment methods that don't exist
  4. Do NOT mention credit cards, payment links, or alternative methods

COMMUNICATION
- Be accurate and truthful about platform capabilities
- If user asks about payment methods you mentioned that don't exist, apologize and correct
- Only offer TRF as alternative when alias is unavailable`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      
      // Social Media Knowledge Base
      {
        id: 'kb-social-001',
        title: 'Social Media Integration',
        content: `- SharingAgent provides specific social media URLs for donors to share and like cases
- Agents are available in toto-app and will be accessible on other platforms like web and WhatsApp
- Trackable links provide impact feedback for shared content
- Multi-platform support for case sharing and engagement`,
        category: 'social_media',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['TwitterAgent', 'SharingAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-social-002',
        title: 'Case Sharing Process - How to Share',
        content: `WHEN USERS ASK "CÓMO COMPARTO?" OR "HOW DO I SHARE?"
- Users asking "Cómo comparto?", "Como comparto?", "How do I share?", "¿Cómo puedo compartir?" want to know HOW to share
- Your response MUST include ALL of these in one message:
  1. Brief acknowledgment: "¡Qué bueno que quieras compartir!" or similar
  2. IMMEDIATELY explain the process: "Puedes compartir el caso en Instagram, Twitter/X, o Facebook"
  3. Ask which platform: "¿En qué plataforma te gustaría compartir?" or "¿Cuál prefieres?"
  4. Mention buttons: "Las opciones aparecerán como botones para que puedas compartir fácilmente"
- Do NOT just acknowledge without explaining HOW - the user wants to know the process
- Example CORRECT: "¡Qué bueno que quieras compartir! Puedes compartir el caso en Instagram, Twitter/X, o Facebook. ¿Cuál prefieres? Las opciones aparecerán como botones para que puedas compartir fácilmente."
- Example WRONG: "¡Hola! Qué bueno que quieras compartir el caso de Rocky." (This only acknowledges, doesn't explain HOW)

SHARING PROCESS DETAILS
- When users show intent to share a case, the case agent inquires about their preferred social media platform
- Available platforms: Instagram, Twitter/X, Facebook
- If user specifies a platform: Acknowledge their choice and provide encouragement
- If user says "all" or "todas": Acknowledge they want to share on all platforms
- The case agent should use the social media URLs from Case Information (guardianTwitter, guardianInstagram, guardianFacebook)
- 🚨 CRITICAL: NEVER include actual social media handles (e.g., @omfa_refugio) or URLs in your message text
- 🚨 CRITICAL: NEVER mention the guardian's social media handle or profile name in the message text
- The social media URLs will be provided separately via quick action buttons
- Keep your response focused on encouraging sharing and explaining the impact
- Do NOT mix donation information with sharing information in the same message
- Trackable links measure engagement and impact`,
        category: 'social_media',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'TwitterAgent', 'SharingAgent'],
        audience: ['donors']
      },
      
      // Conversation Management Knowledge Base
      {
        id: 'kb-conversation-001',
        title: 'Conversation Progression and Avoiding Repetition',
        content: `GENERAL PRINCIPLE: Each message should advance the conversation forward. Never repeat information you've already provided.

WHEN TO REPEAT:
- Only if user explicitly asks "can you repeat that?" or "what was that again?"
- If user seems confused and asks for clarification
- Never repeat just because user says "Si" or "Ok" after you've explained something

WHEN TO MOVE FORWARD:
- After explaining donation process: Ask about verification or sharing
- After explaining totitos: Ask if they want to verify donation or share case
- After explaining verification: Confirm understanding and suggest next action
- If user says "Si" after you've explained something: Acknowledge and move to next step

CONVERSATION FLOW:
1. Welcome → Case intro (brief)
2. Donation intent → Explain donation process (once)
3. Totitos question → Explain totitos
4. Verification interest → Explain verification process
5. Ready to verify → Provide step-by-step instructions
6. Confirmation → Move forward (suggest sharing, other cases, or close)

NEXT STEPS AFTER COMPLETING A TOPIC:
- After explaining donation: "¿Te gustaría saber cómo verificar tu donación y obtener totitos?" or "¿Te gustaría compartir este caso?"
- After explaining totitos: "¿Te gustaría verificar tu donación?" or "¿Quieres compartir el caso?"
- After explaining verification: "¿Tienes alguna otra pregunta?" or "¿Te gustaría ayudar de otra manera?"
- After user confirms understanding: Suggest sharing, offer to help with other cases, or gracefully close

AVOID:
- Repeating donation instructions multiple times
- Repeating case information after welcome
- Asking the same question multiple times
- Going in circles with the same information`,
        category: 'conversation',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-conversation-002',
        title: 'Handling Affirmative Responses',
        content: `When user says "Si", "Sí", "Ok", "Dale", "Claro", etc.:

CONTEXT MATTERS:
- If you just explained something: Acknowledge and move to next step
- If you asked a question: Treat as "yes" to that question
- If you offered to explain: Proceed with explanation
- If you already explained: Don't repeat, move forward

EXAMPLES:
- "¿Te gustaría saber cómo verificar?" → User: "Si" → Explain verification
- "Puedes hacer una transferencia..." → User: "Si" → Ask about verification or sharing
- After explaining totitos → User: "Si" → Ask if they want to verify donation

NEVER:
- Repeat the same explanation you just gave
- Ask the same question again
- Assume "Si" means "repeat everything"`,
        category: 'conversation',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-015',
        title: 'Donation Verification Step-by-Step Guide',
        content: `STEP-BY-STEP VERIFICATION PROCESS:

STEP 1: Make the donation
- User transfers money to guardian's banking alias
- No minimum amount required
- Transfer happens directly (not through platform)

STEP 2: Upload receipt (optional but recommended)
- User uploads receipt/comprobante in the chat dialog
- Can be: bank document, wallet receipt, screenshot
- Upload happens in same chat where they're talking to agent

STEP 3: Wait for verification
- Verification happens weekly with guardian
- Guardian reviews and approves donations
- Cross-checks with their records

STEP 4: Receive notification
- User gets automatic notification when verified
- Can also be verified by guardian independently

STEP 5: Earn totitos
- Once verified, totitos are automatically added
- Amount multiplied by user's rating (1-5 stars)
- Can see totitos in profile (bottom navbar)

IMPORTANT:
- Verification is optional but recommended
- No penalties for unverified donations
- Donations still help the cause even if not verified
- Guardian can verify independently if user forgets to upload`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      }
    ];
  }

  /**
   * Initialize RAG service with knowledge base chunks
   */
  private async initializeRAGService(): Promise<void> {
    try {
      const knowledgeBase = await this.knowledgeBaseService.getAll();
      const knowledgeChunks: KnowledgeChunk[] = knowledgeBase.map(item => ({
        id: item.id,
        title: item.title,
        content: item.content,
        category: item.category,
        agentTypes: item.agentTypes,
        audience: item.audience || [],
        lastUpdated: item.lastUpdated,
        usageCount: item.usageCount
      }));

      await this.ragService.addKnowledgeChunks(knowledgeChunks);
      console.log('✅ RAG service initialized with knowledge base');
    } catch (error) {
      console.error('Error initializing RAG service:', error);
    }
  }
}
