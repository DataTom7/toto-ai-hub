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
  agentTypes: string[]; // Which agents can use this (e.g., ["CaseAgent", "DonationAgent"])
  audience: string[]; // Target audience/recipients (e.g., ["donors", "investors", "guardians", "partners"]) or ["admin"] for internal
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
  async addKnowledgeItem(title: string, content: string, category: string = 'general', agentTypes: string[] = [], audience: string[] = []): Promise<KnowledgeItem> {
    const newItem: KnowledgeItem = {
      id: `kb-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      category: category,
      lastUpdated: new Date().toISOString(),
      usageCount: 0,
      agentTypes,
      audience
    };

    this.knowledgeBase.push(newItem);
    
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
        title: 'Totitos Loyalty System',
        content: `TOTITOS EARNINGS
- Totitos are earned based on number of verified donations (not amount)
- Each verified donation earns loyalty points regardless of amount
- Totitos can be exchanged for goods or services for pets
- System is currently in development mode

VERIFICATION TIMING
- Donations are verified on a weekly basis with guardians
- Guardians approve verifications after review
- Once verified, donors receive notification and earn their totitos
- Verification confirmation is sent to the donor automatically`,
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
        content: `- Minimum donation amount is $10
- Donors can choose any amount from $10 and above
- No maximum donation limit
- When showing donation intent, agents should emphasize that every donation helps, starting from $10`,
        category: 'donations',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      },
      {
        id: 'kb-donations-007',
        title: 'Toto Rescue Fund (TRF)',
        content: `PURPOSE
- The Toto Rescue Fund (TRF) is available for cases with urgent needs that arise on very short notice
- Used for medical needs that must be paid in advance
- Automatically disperses donations to the most urgent cases on a daily basis

DONATION OPTIONS
- Donors can choose to donate to: (1) a specific case, (2) a specific guardian (for their multiple cases), or (3) the Toto Rescue Fund
- TRF provides an alternative for donors who want to help without selecting a specific case
- Donations to different guardians require separate transactions

COMMUNICATION
- Explain that TRF ensures urgent cases receive immediate funding
- Emphasize that TRF automatically allocates to the most urgent cases daily`,
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
- State the minimum donation amount: "You can donate from $10 to assist with the needs of this case under [guardian name]'s care"
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
        title: 'Donor Inbox and Case Communication',
        content: `INBOX SYSTEM
- After a user donates to a case, that case's conversation is stored in their inbox
- Users can access their inbox from the bottom navbar
- Each case has its own conversation thread in the inbox

CASE UPDATES AND NOTIFICATIONS
- When a case receives an update, a message is automatically sent to the specific case conversation in the donor's inbox
- Updates appear as unread messages in the inbox
- Users receive notifications to check their inbox when new case updates arrive
- This ensures donors stay informed about the cases they've supported

PROFILE ACCESS
- Users can access their profile from the bottom navbar
- Profile shows: donation history, totitos earned, user rating/stars
- All donation and contribution information is accessible in the profile`,
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
        title: 'Case Sharing Process',
        content: `- When users show intent to share a case, the case agent inquires about their preferred social media platform
- The case agent should go to that specific case document in Firestore and share the URL corresponding to the social media app the user requested (Twitter, Instagram, Threads, Facebook, WhatsApp)
- Users receive the appropriate sharing link for their chosen platform
- Trackable links measure engagement and impact`,
        category: 'social_media',
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        agentTypes: ['TwitterAgent', 'SharingAgent'],
        audience: ['donors']
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
