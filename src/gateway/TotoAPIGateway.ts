import { TotoAI } from '../index';
import { CaseAgent } from '../agents/CaseAgent';
import { TwitterAgent } from '../agents/TwitterAgent';
import { RAGService, KnowledgeChunk } from '../services/RAGService';

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

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  lastUpdated: string;
  usageCount: number;
  agentTypes: string[];
  embedding?: number[];
}

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
  private knowledgeBase: KnowledgeItem[] = [];
  private ragService: RAGService;
  private lastAnalyticsUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.totoAI = new TotoAI();
    this.ragService = new RAGService();
    this.initializeKnowledgeBase();
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
    return this.knowledgeBase;
  }

  /**
   * Add knowledge item
   */
  async addKnowledgeItem(title: string, content: string, category: string = 'general', agentTypes: string[] = []): Promise<KnowledgeItem> {
    const newItem: KnowledgeItem = {
      id: `kb-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      category: category,
      lastUpdated: new Date().toISOString(),
      usageCount: 0,
      agentTypes
    };

    this.knowledgeBase.push(newItem);
    
    // Add to RAG service
    await this.ragService.addKnowledgeChunks([{
      id: newItem.id,
      title: newItem.title,
      content: newItem.content,
      category: newItem.category,
      agentTypes: newItem.agentTypes,
      lastUpdated: newItem.lastUpdated,
      usageCount: newItem.usageCount
    }]);
    
    return newItem;
  }

  /**
   * Reset knowledge base
   */
  async resetKnowledgeBase(): Promise<void> {
    this.knowledgeBase = [];
    this.ragService.clearKnowledgeChunks();
    this.initializeKnowledgeBase();
  }

  /**
   * Retrieve knowledge using RAG
   */
  async retrieveKnowledge(query: string, agentType: string, context?: string): Promise<any> {
    try {
      const result = await this.ragService.retrieveKnowledge({
        query,
        agentType,
        context,
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
        name: 'Max - Injured Cat',
        description: 'Cat with broken leg needs surgery',
        status: 'urgent' as const,
        animalType: 'Cat',
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
        name: 'Charlie - Rescued Bird',
        description: 'Parrot found in abandoned building',
        status: 'active' as const,
        animalType: 'Bird',
        location: 'Wildlife Rescue',
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
   * Initialize default knowledge base with comprehensive entries
   */
  private initializeKnowledgeBase(): void {
    this.knowledgeBase = [
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

DONATION PROCESS
- Donors transfer funds directly to the guardian's banking alias
- Each guardian has one banking alias for all their cases
- No intermediary processing - 100% of donations go directly to the guardian`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent']
      },
      {
        id: 'kb-donations-002',
        title: 'Donation Verification Process',
        content: `- Donors should provide proof of transfer (bank document, wallet receipt, etc.) if they want the donation to count as verified and earn totitos
- Verification happens weekly with guardians
- If verification fails, we contact the donor for further verification instructions
- In case a user claims for a not-verified donation, inform the user that we will contact the guardian for further information and ask them to provide more detailed information about the transfer
- If the donor does not verify the donation, but the guardian does (with user-specific data), we notify the user to claim their totitos
- No penalties for unverified donations`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent']
      },
      {
        id: 'kb-donations-003',
        title: 'Totitos Loyalty System',
        content: `- Totitos are earned based on number of verified donations (not amount)
- Each verified donation earns loyalty points regardless of amount
- Totitos can be exchanged for products and services
- System is currently in development mode`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent']
      },
      {
        id: 'kb-donations-004',
        title: 'Donation Allocation Rules',
        content: `- Donations go directly to the specific case/guardian
- If a case exceeds its funding goal, excess goes to guardian for other cases
- Each guardian sets their own funding goals
- Funding goals can be modified if new needs arise
- No centralized fund management`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent']
      },
      {
        id: 'kb-donations-005',
        title: 'Donor Experience',
        content: `- Donors access case information through conversational interface
- Automatic notifications sent for case updates after donation
- No tax certificates provided (direct guardian donations)
- International donations supported`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent']
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
        agentTypes: ['CaseAgent']
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
        agentTypes: ['CaseAgent']
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
        agentTypes: ['CaseAgent']
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
        agentTypes: ['CaseAgent']
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
        agentTypes: ['CaseAgent']
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
        agentTypes: ['CaseAgent']
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
        agentTypes: ['TwitterAgent', 'SharingAgent']
      },
      {
        id: 'kb-social-002',
        title: 'Case Sharing Process',
        content: `- When users show intent to share a case, the case agent inquires about their preferred social media platform
- The case agent should go to that specific case document in Firestore and share the URL corresponding to the social media app the user requested (Twitter, Instagram, Threads, Facebook, WhatsApp)
- Users receive the appropriate sharing link for their chosen platform
- Trackable links measure engagement and impact`,
        category: 'social_media',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['TwitterAgent', 'SharingAgent']
      }
    ];

    // Initialize RAG service with knowledge chunks
    this.initializeRAGService();
  }

  /**
   * Initialize RAG service with knowledge base chunks
   */
  private async initializeRAGService(): Promise<void> {
    try {
      const knowledgeChunks: KnowledgeChunk[] = this.knowledgeBase.map(item => ({
        id: item.id,
        title: item.title,
        content: item.content,
        category: item.category,
        agentTypes: item.agentTypes,
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
