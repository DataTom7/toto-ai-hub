import { BaseAgent } from './BaseAgent';
import { 
  AgentConfig, 
  AgentResponse, 
  UserContext, 
  AgentAction,
  ConversationContext 
} from "../types";
import { TwitterService } from "../services/TwitterService";

// Twitter-specific types
export interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface Guardian {
  id: string;
  name: string;
  twitterHandle: string;
  twitterUserId: string;
  isActive: boolean;
  lastTweetFetch: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TwitterAgentConfig extends AgentConfig {
  twitterCredentials: TwitterCredentials;
  guardians: Guardian[];
  monitoringInterval: number; // minutes
  maxTweetsPerFetch: number;
  searchTimeWindow: number; // hours
  caseCreationPolicy: {
    enabled: boolean; // Allow automatic case creation
    requireApproval: boolean; // Create as draft for manual review
    minConfidence: number; // Minimum confidence score (0-1) to create case
    maxCasesPerDay: number; // Rate limiting for case creation
  };
  reviewPolicy: {
    requireManualReview: boolean; // All actions require manual review
    autoApproveThreshold: number; // Only auto-approve with very high confidence (0-1)
    reviewQueueEnabled: boolean; // Enable review queue system
    notifyOnReview: boolean; // Notify admins when items need review
  };
}

export interface TweetData {
  id: string;
  content: string;
  author: {
    name: string;
    handle: string;
    profileImageUrl: string;
  };
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  media: {
    images: string[];
    videos: string[];
  };
  createdAt: Date;
  fetchedAt: Date;
  // Enhanced media handling
  mediaUrls?: string[];
  imageUrls?: string[];
  videoUrls?: string[];
}

export interface TweetAnalysis {
  isCaseRelated: boolean;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  caseUpdateType: 'status_change' | 'note' | 'milestone' | 'emergency' | 'enrichment' | 'duplicate';
  suggestedAction: string;
  confidence: number;
  extractedInfo: {
    animalMentioned?: string;
    medicalCondition?: string;
    location?: string;
    fundraisingRequest?: boolean;
    emergency?: boolean;
    newImages?: string[];
    statusUpdate?: string;
    priorityChange?: string;
    medicalProgress?: string;
    treatmentUpdate?: string;
    fosterUpdate?: string;
    transportNeeds?: string;
  };
  caseEnrichment?: {
    fieldsToUpdate: string[];
    newValues: Record<string, any>;
    reason: string;
  };
  isDuplicate?: boolean;
  duplicateReason?: string;
}

export interface ReviewItem {
  id: string;
  type: 'case_creation' | 'case_update' | 'case_enrichment';
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  tweetId: string;
  tweetContent: string;
  tweetAuthor: string;
  guardianId: string;
  caseId?: string;
  proposedAction: any; // The action to be taken
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  originalTweet: TweetData; // Full original tweet data for manual review
  metadata: {
    analysisResult: TweetAnalysis;
    caseAnalysis?: any;
    images?: string[];
  };
}

export interface TwitterAgentResponse extends AgentResponse {
  tweetsAnalyzed?: number;
  caseUpdatesCreated?: number;
  analysisResults?: TweetAnalysis[];
}

export class TwitterAgent extends BaseAgent {
  protected config: TwitterAgentConfig;
  private lastRun: Date | null = null;
  private totalTweetsAnalyzed: number = 0;
  private totalCaseUpdatesCreated: number = 0;
  private casesCreatedToday: number = 0;
  private lastCaseCreationDate: string = '';
  private reviewQueue: ReviewItem[] = [];
  private twitterService: TwitterService | null = null;
  private userCache: Map<string, string> = new Map(); // Cache username -> userID

  constructor(config?: Partial<TwitterAgentConfig>) {
    const baseConfig: AgentConfig = {
      name: 'TwitterAgent',
      description: 'Monitors guardian Twitter accounts, analyzes tweets for case relevance, and creates case updates',
      version: '1.0.0',
      capabilities: [
        'tweet_fetching',
        'content_analysis',
        'case_update_creation',
        'emergency_detection',
        'fundraising_filtering',
        'pattern_learning',
        'case_creation',
      ],
      isEnabled: true,
      maxRetries: 3,
      timeout: 60000, // 60 seconds for Twitter operations
    };

    super(baseConfig);

    // Default configuration
    this.config = {
      ...baseConfig,
      twitterCredentials: {
        apiKey: '',
        apiSecret: '',
        accessToken: '',
        accessTokenSecret: ''
      },
      guardians: [],
      monitoringInterval: 60, // 1 hour
      maxTweetsPerFetch: 10,
      searchTimeWindow: 24, // 24 hours
      caseCreationPolicy: {
        enabled: true,
        requireApproval: true, // Create as draft by default
        minConfidence: 0.8,
        maxCasesPerDay: 5
      },
      reviewPolicy: {
        requireManualReview: true, // All actions require manual review
        autoApproveThreshold: 0.95, // Only auto-approve with very high confidence
        reviewQueueEnabled: true, // Enable review queue system
        notifyOnReview: true // Notify admins when items need review
      },
      ...config
    };
  }

  protected getSystemPrompt(): string {
    return `You are Toto's Twitter Monitoring Agent, specialized in analyzing pet rescue tweets and creating case updates.

Your role:
- Analyze tweets from guardian accounts for case relevance
- Compare tweet content with existing case data to detect duplicates
- Detect emergencies and urgent situations requiring immediate attention
- Create appropriate case updates OR enrich existing case data
- Filter out funding requests (ignore donation pleas)
- Learn patterns to improve analysis accuracy over time
- Provide insights about guardian activity and case progress

Analysis Guidelines:
- Case-related tweets: Medical updates, rescue progress, animal conditions, treatment plans
- Emergency tweets: Urgent medical needs, critical situations, immediate help required
- Non-case tweets: Personal updates, general animal content, fundraising requests (IGNORE)
- Duplicate detection: Check if tweet information already exists in case
- Enrichment opportunities: Add new details to existing case fields
- Urgency levels: critical (life-threatening), high (urgent medical), medium (routine updates), low (general info)

Update Types:
- "duplicate": Information already exists in case
- "enrichment": Adds new details to existing case fields (images, medical progress, etc.)
- "status_change": Changes case status or priority
- "note": General updates and progress notes
- "milestone": Significant progress or achievements
- "emergency": Urgent situations requiring immediate attention

Response Format:
- Always provide analysis confidence (0-1)
- Suggest specific case update type and content
- Extract ALL relevant information (animal, condition, location, images, progress)
- Flag emergencies for immediate attention
- Identify duplicate information to avoid redundant updates
- Suggest case enrichment opportunities

Be thorough but concise in your analysis.`;
  }

  /**
   * Initialize Twitter credentials and guardian data
   */
  async initialize(credentials: TwitterCredentials, guardians: Guardian[]): Promise<void> {
    this.config.twitterCredentials = credentials;
    this.config.guardians = guardians;
    
    // Only initialize Twitter service if we have valid credentials
    if (credentials.apiKey && credentials.apiSecret && credentials.accessToken && credentials.accessTokenSecret) {
      this.twitterService = new TwitterService(credentials);
      console.log(`TwitterAgent initialized with ${guardians.length} guardians and Twitter service`);
    } else {
      console.log(`TwitterAgent initialized with ${guardians.length} guardians (no Twitter service - empty credentials)`);
    }
  }

  /**
   * Load guardians from database and initialize Twitter service
   */
  async initializeWithDatabase(credentials: TwitterCredentials): Promise<void> {
    this.config.twitterCredentials = credentials;
    
    // Load guardians from database
    await this.loadGuardiansFromDatabase();
    
    // Initialize Twitter service
    this.twitterService = new TwitterService(credentials);
    console.log(`TwitterAgent initialized with ${this.config.guardians.length} guardians from database`);
  }

  /**
   * Load guardians from database
   */
  private async loadGuardiansFromDatabase(): Promise<void> {
    try {
      const admin = require('firebase-admin');
      const db = admin.firestore();
      
      // Load guardians from users collection where role = 'guardian'
      const guardiansSnapshot = await db.collection('users')
        .where('role', '==', 'guardian')
        .get();
      
      const guardians: Guardian[] = [];
      
      guardiansSnapshot.forEach((doc: any) => {
        const userData = doc.data();
        const socialLinks = userData.contactInfo?.socialLinks || {};
        
        if (socialLinks.twitter) {
          const guardian: Guardian = {
            id: doc.id,
            name: userData.name || 'Unknown Guardian',
            twitterHandle: socialLinks.twitter,
            twitterUserId: `twitter_${socialLinks.twitter}`,
            isActive: true,
            lastTweetFetch: new Date(),
            createdAt: userData.createdAt || new Date(),
            updatedAt: userData.updatedAt || new Date()
          };
          guardians.push(guardian);
        }
      });
      
      this.config.guardians = guardians;
      console.log(`Loaded ${guardians.length} guardians from database`);
    } catch (error) {
      console.error('Error loading guardians from database:', error);
      this.config.guardians = [];
    }
  }

  /**
   * Fetch tweets from all active guardians
   */
  async fetchGuardianTweets(): Promise<TweetData[]> {
    if (!this.config.twitterCredentials) {
      throw new Error('Twitter credentials not initialized');
    }

    const allTweets: TweetData[] = [];
    const activeGuardians = this.config.guardians.filter((g: Guardian) => g.isActive);

    console.log(`Fetching tweets from ${activeGuardians.length} active guardians`);

    for (const guardian of activeGuardians) {
      try {
        const tweets = await this.fetchUserTweets(guardian);
        allTweets.push(...tweets);
        console.log(`Fetched ${tweets.length} tweets from @${guardian.twitterHandle}`);
      } catch (error) {
        console.error(`Error fetching tweets for @${guardian.twitterHandle}:`, error);
      }
    }

    return allTweets;
  }

  /**
   * Analyze tweets for case relevance and create updates
   */
  async analyzeTweetsAndCreateUpdates(tweets: TweetData[]): Promise<TwitterAgentResponse> {
    const startTime = Date.now();
    const analysisResults: TweetAnalysis[] = [];
    let caseUpdatesCreated = 0;

    console.log(`Analyzing ${tweets.length} tweets for case relevance`);

    for (const tweet of tweets) {
      try {
        // Find the guardian for this tweet
        const guardian = this.config.guardians.find((g: Guardian) => 
          g.twitterHandle === tweet.author.handle || g.twitterUserId === tweet.author.handle
        );
        if (!guardian) {
          console.warn(`Guardian not found for tweet author: ${tweet.author.handle}`);
          continue;
        }

        // Analyze existing case data to determine if this adds new information
        const caseAnalysis = await this.analyzeCaseForUpdates(guardian.id, tweet);
        
        // Analyze the tweet with case context
        const analysis = await this.analyzeTweet(tweet, caseAnalysis);
        analysisResults.push(analysis);

        // Handle different scenarios based on case analysis
        if (caseAnalysis.shouldCreateNewCase && caseAnalysis.newCaseData) {
          // Add case creation to review queue
          const reviewItem = await this.createReviewItem('case_creation', tweet, analysis, caseAnalysis);
          if (reviewItem) {
            await this.addToReviewQueue(reviewItem);
            console.log(`📋 Case creation queued for review: ${caseAnalysis.newCaseData.name}`);
          }
        } else if (analysis.isCaseRelated && 
                   !analysis.extractedInfo.fundraisingRequest && 
                   !analysis.isDuplicate &&
                   analysis.caseUpdateType !== 'duplicate') {
          // Add case update to review queue
          const reviewItem = await this.createReviewItem('case_update', tweet, analysis, caseAnalysis);
          if (reviewItem) {
            await this.addToReviewQueue(reviewItem);
            console.log(`📋 Case update queued for review: ${analysis.caseUpdateType}`);
          }
        } else if (analysis.isDuplicate) {
          console.log(`Skipping duplicate tweet ${tweet.id}: ${analysis.duplicateReason}`);
        } else if (!analysis.isCaseRelated) {
          console.log(`Skipping non-case-related tweet ${tweet.id}`);
        }
      } catch (error) {
        console.error(`Error analyzing tweet ${tweet.id}:`, error);
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      message: `Analyzed ${tweets.length} tweets, created ${caseUpdatesCreated} case updates`,
      tweetsAnalyzed: tweets.length,
      caseUpdatesCreated,
      analysisResults,
      metadata: {
        agentType: this.config.name,
        confidence: 0.9,
        processingTime,
      },
    };
  }

  /**
   * Main method to run the complete Twitter monitoring process
   */
  async runMonitoringCycle(): Promise<TwitterAgentResponse> {
    try {
      console.log('Starting Twitter monitoring cycle...');

      // Step 1: Fetch tweets from all guardians
      const tweets = await this.fetchGuardianTweets();
      
      if (tweets.length === 0) {
        return {
          success: true,
          message: 'No new tweets found from guardians',
          tweetsAnalyzed: 0,
          caseUpdatesCreated: 0,
          metadata: {
            agentType: this.config.name,
            confidence: 1.0,
            processingTime: 0,
          },
        };
      }

      // Step 2: Analyze tweets and create case updates
      const result = await this.analyzeTweetsAndCreateUpdates(tweets);

      console.log(`Twitter monitoring cycle completed: ${result.message}`);
      return result;

    } catch (error) {
      console.error('Error in Twitter monitoring cycle:', error);
      return {
        success: false,
        message: `Twitter monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          agentType: this.config.name,
          confidence: 0,
          processingTime: 0,
        },
      };
    }
  }

  /**
   * Analyze existing case data to determine if tweet adds new information
   */
  private async analyzeCaseForUpdates(guardianId: string, tweet: TweetData): Promise<{
    existingCase?: any;
    isNewInformation: boolean;
    duplicateFields: string[];
    enrichmentOpportunities: string[];
    shouldCreateNewCase?: boolean;
    newCaseData?: any;
  }> {
    try {
      // First, try to find existing cases for this guardian
      const existingCases = await this.findCasesForGuardian(guardianId);
      
      // If we have existing cases, analyze against them
      if (existingCases.length > 0) {
        // For now, use the first case (could be enhanced to match by content similarity)
        const existingCase = existingCases[0];
        
        return {
          existingCase,
          isNewInformation: true,
          duplicateFields: [],
          enrichmentOpportunities: ['medicalProgress', 'treatmentUpdate', 'additionalImages']
        };
      }
      
      // No existing cases found - analyze if we should create a new one
      const shouldCreateNewCase = await this.shouldCreateNewCaseFromTweet(tweet);
      
      if (shouldCreateNewCase) {
        const newCaseData = await this.generateNewCaseDataFromTweet(tweet, guardianId);
        return {
          isNewInformation: true,
          duplicateFields: [],
          enrichmentOpportunities: [],
          shouldCreateNewCase: true,
          newCaseData
        };
      }
      
      // Don't create new case - just return basic analysis
      return {
        isNewInformation: false,
        duplicateFields: [],
        enrichmentOpportunities: []
      };
    } catch (error) {
      console.error('Error analyzing case for updates:', error);
      return {
        isNewInformation: true,
        duplicateFields: [],
        enrichmentOpportunities: []
      };
    }
  }

  /**
   * Find existing cases for a guardian
   */
  private async findCasesForGuardian(guardianId: string): Promise<any[]> {
    try {
      // TODO: Implement actual Firestore query
      // For now, return mock data
      return [
        {
          id: 'case_123',
          name: 'Luna Rescue Case',
          description: 'Luna is a 2-year-old dog who needs surgery for her broken leg',
          status: 'active',
          animalType: 'Dog',
          medicalCondition: 'Broken leg',
          location: 'Buenos Aires',
          currentAmount: 5000,
          targetAmount: 10000,
          additionalImages: ['image1.jpg'],
          updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
        }
      ];
    } catch (error) {
      console.error('Error finding cases for guardian:', error);
      return [];
    }
  }

  /**
   * Determine if we should create a new case from a tweet
   */
  private async shouldCreateNewCaseFromTweet(tweet: TweetData): Promise<boolean> {
    try {
      // Check if case creation is enabled
      if (!this.config.caseCreationPolicy.enabled) {
        console.log('Case creation is disabled in configuration');
        return false;
      }

      // Check daily rate limit
      const today = new Date().toISOString().split('T')[0];
      if (this.lastCaseCreationDate !== today) {
        this.casesCreatedToday = 0;
        this.lastCaseCreationDate = today;
      }

      if (this.casesCreatedToday >= this.config.caseCreationPolicy.maxCasesPerDay) {
        console.log(`Daily case creation limit reached: ${this.casesCreatedToday}/${this.config.caseCreationPolicy.maxCasesPerDay}`);
        return false;
      }

      // Use LLM to analyze if tweet contains enough information for a new case
      const analysisPrompt = `Analyze this tweet to determine if it contains enough information to create a new pet rescue case:

Tweet: "${tweet.content}"
Author: @${tweet.author.handle} (${tweet.author.name})

Consider:
1. Does it mention a specific animal in need?
2. Does it describe a medical condition or emergency?
3. Does it mention location or contact information?
4. Does it seem like a legitimate rescue case (not just general animal content)?
5. Is there enough detail to create a meaningful case description?

Respond with JSON:
{
  "shouldCreateCase": boolean,
  "confidence": number (0-1),
  "reason": "explanation of decision",
  "caseType": "emergency|medical|adoption|other",
  "urgency": "low|medium|high|critical"
}`;

      const result = await this.processMessage(analysisPrompt, {
        userId: 'twitter-agent',
        userRole: 'admin',
        language: 'en'
      });

      if (result.success && result.message) {
        try {
          // Parse JSON response (handle markdown formatting)
          let jsonString = result.message;
          if (jsonString.includes('```json')) {
            jsonString = jsonString.replace(/```json\s*/, '').replace(/```\s*$/, '');
          } else if (jsonString.includes('```')) {
            jsonString = jsonString.replace(/```\s*/, '').replace(/```\s*$/, '');
          }
          jsonString = jsonString.trim();
          const analysis = JSON.parse(jsonString);
          const meetsConfidenceThreshold = analysis.confidence >= this.config.caseCreationPolicy.minConfidence;
          
          if (analysis.shouldCreateCase && meetsConfidenceThreshold) {
            console.log(`Tweet qualifies for case creation: confidence=${analysis.confidence}, reason=${analysis.reason}`);
            return true;
          } else {
            console.log(`Tweet does not qualify for case creation: confidence=${analysis.confidence}, reason=${analysis.reason}`);
          }
        } catch (parseError) {
          console.error('Error parsing case creation analysis:', parseError);
        }
      }

      return false;
    } catch (error) {
      console.error('Error analyzing tweet for case creation:', error);
      return false;
    }
  }

  /**
   * Generate new case data from tweet content
   */
  private async generateNewCaseDataFromTweet(tweet: TweetData, guardianId: string): Promise<any> {
    try {
      const caseGenerationPrompt = `Generate case data from this pet rescue tweet:

Tweet: "${tweet.content}"
Author: @${tweet.author.handle} (${tweet.author.name})
Guardian ID: ${guardianId}

Extract and generate:
1. Case name (animal name or descriptive title)
2. Description (expand on the tweet content)
3. Animal type (dog, cat, etc.)
4. Medical condition or needs
5. Location (if mentioned)
6. Estimated donation goal (reasonable amount)
7. Priority level
8. Tags for categorization

Respond with JSON:
{
  "name": "string",
  "description": "string (detailed, 50-200 words)",
  "animalType": "string",
  "medicalCondition": "string",
  "location": "string or null",
  "donationGoal": number,
  "priority": "urgent|normal",
  "status": "draft|active",
  "tags": ["array", "of", "tags"],
  "source": "twitter",
  "sourceTweetId": "${tweet.id}"
}`;

      const result = await this.processMessage(caseGenerationPrompt, {
        userId: 'twitter-agent',
        userRole: 'admin',
        language: 'en'
      });

      if (result.success && result.message) {
        try {
          // Parse JSON response (handle markdown formatting)
          let jsonString = result.message;
          if (jsonString.includes('```json')) {
            jsonString = jsonString.replace(/```json\s*/, '').replace(/```\s*$/, '');
          } else if (jsonString.includes('```')) {
            jsonString = jsonString.replace(/```\s*/, '').replace(/```\s*$/, '');
          }
          jsonString = jsonString.trim();
          const caseData = JSON.parse(jsonString);
          
          // Add required fields and respect approval policy
          return {
            ...caseData,
            guardianId,
            guardianName: tweet.author.name,
            donationsReceived: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Set status based on approval policy
            status: this.config.caseCreationPolicy.requireApproval ? 'draft' : 'active',
            // Add images from tweet if available
            additionalImages: tweet.media?.images || tweet.imageUrls || []
          };
        } catch (parseError) {
          console.error('Error parsing case data generation:', parseError);
        }
      }

      // Fallback case data
      return {
        name: `Rescue Case from @${tweet.author.handle}`,
        description: `Case created from Twitter post: ${tweet.content}`,
        animalType: 'Unknown',
        medicalCondition: 'To be determined',
        location: null,
        donationGoal: 5000,
        priority: 'normal',
        status: 'draft',
        tags: ['twitter', 'auto-created'],
        source: 'twitter',
        sourceTweetId: tweet.id,
        guardianId,
        guardianName: tweet.author.name,
        donationsReceived: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        additionalImages: tweet.media?.images || tweet.imageUrls || []
      };
    } catch (error) {
      console.error('Error generating case data from tweet:', error);
      return null;
    }
  }

  /**
   * Analyze a single tweet for case relevance
   */
  private async analyzeTweet(tweet: TweetData, caseAnalysis?: any): Promise<TweetAnalysis> {
    const caseContext = caseAnalysis ? `
Existing Case Information:
- Name: ${caseAnalysis.existingCase?.name || 'Unknown'}
- Description: ${caseAnalysis.existingCase?.description || 'No description'}
- Status: ${caseAnalysis.existingCase?.status || 'Unknown'}
- Animal Type: ${caseAnalysis.existingCase?.animalType || 'Unknown'}
- Medical Condition: ${caseAnalysis.existingCase?.medicalCondition || 'Unknown'}
- Location: ${caseAnalysis.existingCase?.location || 'Unknown'}
- Last Updated: ${caseAnalysis.existingCase?.updatedAt || 'Unknown'}
- Current Images: ${caseAnalysis.existingCase?.additionalImages?.length || 0} images
- Duplicate Fields Detected: ${caseAnalysis.duplicateFields?.join(', ') || 'None'}
- Enrichment Opportunities: ${caseAnalysis.enrichmentOpportunities?.join(', ') || 'None'}
` : '';

    const analysisPrompt = `Analyze this tweet from a pet rescue guardian:

Tweet: "${tweet.content}"
Author: @${tweet.author.handle} (${tweet.author.name})
Created: ${tweet.createdAt.toISOString()}
${caseContext}

Determine:
1. Is this tweet case-related? (medical updates, rescue progress, animal conditions)
2. What's the urgency level? (critical, high, medium, low)
3. What type of action should this trigger?
   - "duplicate" if information already exists in case
   - "enrichment" if it adds new details to existing case fields
   - "status_change" if it changes case status/priority
   - "note" for general updates
   - "milestone" for significant progress
   - "emergency" for urgent situations
4. What specific action should be taken?
5. Extract ALL relevant information including:
   - Animal details, medical conditions, locations
   - Status updates, priority changes
   - Medical progress, treatment updates
   - Foster care, transportation needs
   - New images or media
6. Is this a fundraising request? (if yes, ignore it)
7. Does this add NEW information or duplicate existing case data?

Respond in JSON format:
{
  "isCaseRelated": boolean,
  "urgency": "low|medium|high|critical",
  "caseUpdateType": "status_change|note|milestone|emergency|enrichment|duplicate",
  "suggestedAction": "string",
  "confidence": number,
  "extractedInfo": {
    "animalMentioned": "string or null",
    "medicalCondition": "string or null", 
    "location": "string or null",
    "fundraisingRequest": boolean,
    "emergency": boolean,
    "newImages": ["array of image URLs or null"],
    "statusUpdate": "string or null",
    "priorityChange": "string or null",
    "medicalProgress": "string or null",
    "treatmentUpdate": "string or null",
    "fosterUpdate": "string or null",
    "transportNeeds": "string or null"
  },
  "caseEnrichment": {
    "fieldsToUpdate": ["array of field names to update"],
    "newValues": {"fieldName": "newValue"},
    "reason": "explanation of why these fields should be updated"
  },
  "isDuplicate": boolean,
  "duplicateReason": "string explaining why this is duplicate or null"
}`;

    try {
      const result = await this.processMessage(analysisPrompt, {
        userId: 'twitter-agent',
        userRole: 'admin',
        language: 'en',
      });

      // Parse the JSON response (handle markdown formatting)
      let jsonString = result.message;
      
      // Remove markdown code blocks if present
      if (jsonString.includes('```json')) {
        jsonString = jsonString.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (jsonString.includes('```')) {
        jsonString = jsonString.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      // Clean up any extra whitespace
      jsonString = jsonString.trim();
      
      const analysis = JSON.parse(jsonString);
      return analysis as TweetAnalysis;
    } catch (error) {
      console.error('Error analyzing tweet:', error);
      // Return default analysis
      return {
        isCaseRelated: false,
        urgency: 'low',
        caseUpdateType: 'note',
        suggestedAction: 'No action needed',
        confidence: 0.1,
        extractedInfo: {
          fundraisingRequest: false,
          emergency: false,
        },
      };
    }
  }

  /**
   * Create a new case from tweet content
   */
  private async createNewCaseFromTweet(tweet: TweetData, caseData: any): Promise<boolean> {
    try {
      // Process images from tweet first
      const newImages = await this.processTweetImages(tweet, { additionalImages: [] });
      
      // Add processed images to case data
      if (newImages.length > 0) {
        caseData.additionalImages = newImages;
        caseData.imageUrl = newImages[0]; // Use first image as main image
      }

      // Call toto-bo case creation API
      const response = await fetch(`${process.env.TOTO_BO_API_URL || 'http://localhost:5000'}/api/cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication headers when available
        },
        body: JSON.stringify(caseData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create new case: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as { success: boolean; id: string };
      console.log(`✅ New case created successfully: ${result.id} - ${caseData.name}`);

      // Increment daily case creation counter
      this.casesCreatedToday++;

      // Create initial case update documenting the source
      await this.createInitialCaseUpdate(result.id, tweet, caseData);

      return true;
    } catch (error) {
      console.error('Error creating new case from tweet:', error);
      return false;
    }
  }

  /**
   * Create initial case update documenting the Twitter source
   */
  private async createInitialCaseUpdate(caseId: string, tweet: TweetData, caseData: any): Promise<boolean> {
    try {
      const updatePayload = {
        caseId: caseId,
        type: 'note' as const,
        notes: `Case automatically created from Twitter post by @${tweet.author.handle}. Original tweet: "${tweet.content}"`,
        metadata: {
          tags: ['twitter', 'auto-created', 'initial'],
          priority: this.mapUrgencyToPriority(caseData.priority || 'normal')
        }
      };

      const response = await fetch(`${process.env.TOTO_BO_API_URL || 'http://localhost:5000'}/api/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication headers when available
        },
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) {
        console.warn(`Failed to create initial case update: ${response.status} ${response.statusText}`);
        return false;
      }

      console.log(`✅ Initial case update created for case ${caseId}`);
      return true;
    } catch (error) {
      console.error('Error creating initial case update:', error);
      return false;
    }
  }

  /**
   * Create a case update based on tweet analysis
   */
  private async createCaseUpdate(tweet: TweetData, analysis: TweetAnalysis, caseAnalysis?: any): Promise<boolean> {
    try {
      // Find the guardian for this tweet
        const guardian = this.config.guardians.find((g: Guardian) => 
          g.twitterHandle === tweet.author.handle || g.twitterUserId === tweet.author.handle
        );
      if (!guardian) {
        console.warn(`Guardian not found for tweet author: ${tweet.author.handle}`);
        return false;
      }

      // Handle different types of updates
      if (analysis.caseUpdateType === 'enrichment' && analysis.caseEnrichment) {
        // Enrich existing case with new information
        console.log(`Would enrich case for guardian ${guardian.name}:`, {
          type: 'enrichment',
          fieldsToUpdate: analysis.caseEnrichment.fieldsToUpdate,
          newValues: analysis.caseEnrichment.newValues,
          reason: analysis.caseEnrichment.reason,
          source: 'twitter',
          tweetId: tweet.id,
        });
        await this.enrichCase(caseAnalysis.existingCase.id, analysis.caseEnrichment, tweet);
      } else if (analysis.caseUpdateType === 'duplicate') {
        // Skip duplicate updates
        console.log(`Skipping duplicate tweet for case ${caseAnalysis.existingCase.id}: ${analysis.duplicateReason}`);
        return true;
      } else {
        // Create regular case update using existing toto-bo API
        await this.createCaseUpdateViaAPI(tweet, analysis, caseAnalysis);
      }

      return true;
    } catch (error) {
      console.error('Error creating case update:', error);
      return false;
    }
  }

  /**
   * Create case update using existing toto-bo API
   */
  private async createCaseUpdateViaAPI(tweet: TweetData, analysis: TweetAnalysis, caseAnalysis?: any): Promise<boolean> {
    try {
      const caseId = caseAnalysis?.existingCase?.id;
      if (!caseId) {
        console.warn('No case ID available for creating update');
        return false;
      }

      // Prepare images for upload and case update
      const newImages = await this.processTweetImages(tweet, caseAnalysis.existingCase);
      
      // Create case update content
      const updateContent = this.generateCaseUpdateContent(tweet, analysis);

      // Prepare case update payload for toto-bo API
      const updatePayload = {
        caseId: caseId,
        type: this.mapUpdateType(analysis.caseUpdateType),
        notes: updateContent,
        metadata: {
          attachmentUrl: newImages.length > 0 ? newImages[0] : undefined, // First image as attachment
          tags: ['twitter', 'automated'],
          priority: this.mapUrgencyToPriority(analysis.urgency)
        }
      };

      // Call toto-bo case updates API
      const response = await fetch(`${process.env.TOTO_BO_API_URL || 'http://localhost:5000'}/api/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication headers when available
        },
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) {
        throw new Error(`Failed to create case update: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as { success: boolean; update?: { id: string } };
      console.log(`✅ Case update created successfully: ${result.update?.id}`);

      // If we have new images, update the case's additionalImages array
      if (newImages.length > 0) {
        await this.updateCaseImages(caseId, newImages, caseAnalysis.existingCase.additionalImages || []);
      }

      return true;
    } catch (error) {
      console.error('Error creating case update via API:', error);
      return false;
    }
  }

  /**
   * Enrich case with new information from tweet
   */
  private async enrichCase(caseId: string, enrichment: any, tweet: TweetData): Promise<boolean> {
    try {
      // Process images from tweet
      const newImages = await this.processTweetImages(tweet, { additionalImages: [] });
      
      // Prepare case update payload for toto-bo API
      const updatePayload: any = {
        updatedAt: new Date().toISOString()
      };

      // Apply enrichment based on analysis
      if (enrichment.fieldsToUpdate.includes('additionalImages') && newImages.length > 0) {
        // Get existing images and add new ones
        const existingImages = enrichment.existingCase?.additionalImages || [];
        const allImages = [...existingImages, ...newImages];
        updatePayload.additionalImages = allImages;
      }

      if (enrichment.fieldsToUpdate.includes('description')) {
        updatePayload.description = enrichment.newValues.description;
      }

      if (enrichment.fieldsToUpdate.includes('status')) {
        updatePayload.status = enrichment.newValues.status;
      }

      if (enrichment.fieldsToUpdate.includes('priority')) {
        updatePayload.priority = enrichment.newValues.priority;
      }

      // Call toto-bo case update API
      const response = await fetch(`${process.env.TOTO_BO_API_URL || 'http://localhost:5000'}/api/cases/${caseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication headers when available
        },
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) {
        throw new Error(`Failed to enrich case: ${response.status} ${response.statusText}`);
      }

      console.log(`✅ Case enriched successfully: ${caseId}`, {
        fieldsUpdated: enrichment.fieldsToUpdate,
        newImages: newImages.length,
        reason: enrichment.reason
      });

      return true;
    } catch (error) {
      console.error('Error enriching case:', error);
      return false;
    }
  }

  /**
   * Process tweet images: download, upload to Firebase Storage, and return URLs
   */
  private async processTweetImages(tweet: TweetData, existingCase: any): Promise<string[]> {
    try {
      const newImageUrls: string[] = [];
      const existingImages = existingCase.additionalImages || [];
      
      // Get images from tweet
      const tweetImages = tweet.media?.images || tweet.imageUrls || [];
      
      for (const imageUrl of tweetImages) {
        // Check if image already exists in case
        if (this.isImageAlreadyInCase(imageUrl, existingImages)) {
          console.log(`Image already exists in case: ${imageUrl}`);
          continue;
        }

        try {
          // Download image from Twitter
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) continue;

          const imageBuffer = await imageResponse.arrayBuffer();
          const imageData = Buffer.from(imageBuffer);
          
          // Generate unique filename
          const timestamp = Date.now();
          const filename = `twitter_${tweet.id}_${timestamp}.jpg`;
          const caseId = existingCase.id || 'unknown';
          
          // Upload to Firebase Storage
          const firebaseImageUrl = await this.uploadImageToFirebase(imageData, caseId, filename);
          
          if (firebaseImageUrl) {
            newImageUrls.push(firebaseImageUrl);
            console.log(`✅ Image uploaded to Firebase: ${firebaseImageUrl}`);
          }
        } catch (imageError) {
          console.error(`Error processing image ${imageUrl}:`, imageError);
        }
      }

      return newImageUrls;
    } catch (error) {
      console.error('Error processing tweet images:', error);
      return [];
    }
  }

  /**
   * Check if image URL already exists in case images
   */
  private isImageAlreadyInCase(imageUrl: string, existingImages: string[]): boolean {
    // Simple URL comparison - could be enhanced with image hash comparison
    return existingImages.some(existingUrl => 
      existingUrl === imageUrl || 
      existingUrl.includes(imageUrl.split('/').pop() || '') ||
      imageUrl.includes(existingUrl.split('/').pop() || '')
    );
  }

  /**
   * Upload image to Firebase Storage
   */
  private async uploadImageToFirebase(imageData: Buffer, caseId: string, filename: string): Promise<string | null> {
    try {
      // TODO: Implement Firebase Storage upload
      // For now, return a mock URL
      console.log(`Would upload image to Firebase Storage: case-images/${caseId}/${filename}`);
      return `https://firebasestorage.googleapis.com/v0/b/toto-f9d2f-stg.firebasestorage.app/o/case-images%2F${caseId}%2F${filename}?alt=media`;
    } catch (error) {
      console.error('Error uploading image to Firebase:', error);
      return null;
    }
  }

  /**
   * Update case's additionalImages array using toto-bo API
   */
  private async updateCaseImages(caseId: string, newImages: string[], existingImages: string[]): Promise<boolean> {
    try {
      const allImages = [...existingImages, ...newImages];
      
      const response = await fetch(`${process.env.TOTO_BO_API_URL || 'http://localhost:5000'}/api/cases/${caseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication headers when available
        },
        body: JSON.stringify({
          additionalImages: allImages,
          updatedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update case images: ${response.status} ${response.statusText}`);
      }

      console.log(`✅ Case images updated: ${caseId} (${newImages.length} new images added)`);
      return true;
    } catch (error) {
      console.error('Error updating case images:', error);
      return false;
    }
  }

  /**
   * Map Twitter Agent update types to toto-bo API update types
   */
  private mapUpdateType(twitterUpdateType: string): 'status_change' | 'note' | 'comment' | 'milestone' {
    switch (twitterUpdateType) {
      case 'status_change':
        return 'status_change';
      case 'milestone':
        return 'milestone';
      case 'emergency':
        return 'status_change'; // Emergency updates are status changes
      case 'note':
      case 'enrichment':
      default:
        return 'note';
    }
  }

  /**
   * Map urgency levels to priority levels
   */
  private mapUrgencyToPriority(urgency: string): 'low' | 'medium' | 'high' {
    switch (urgency) {
      case 'critical':
        return 'high';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
      default:
        return 'low';
    }
  }

  /**
   * Generate case update content from tweet and analysis
   */
  private generateCaseUpdateContent(tweet: TweetData, analysis: TweetAnalysis): string {
    const urgencyPrefix = analysis.urgency === 'critical' ? '🚨 URGENT: ' : 
                         analysis.urgency === 'high' ? '⚠️ HIGH PRIORITY: ' : '';
    
    let content = `${urgencyPrefix}Twitter Update from @${tweet.author.handle}:\n\n`;
    content += `${tweet.content}\n\n`;
    
    if (analysis.extractedInfo.animalMentioned) {
      content += `Animal: ${analysis.extractedInfo.animalMentioned}\n`;
    }
    if (analysis.extractedInfo.medicalCondition) {
      content += `Condition: ${analysis.extractedInfo.medicalCondition}\n`;
    }
    if (analysis.extractedInfo.location) {
      content += `Location: ${analysis.extractedInfo.location}\n`;
    }
    
    content += `\nSuggested Action: ${analysis.suggestedAction}`;
    
    return content;
  }

  /**
   * Fetch tweets from a specific user (simplified implementation)
   */
  private async fetchUserTweets(guardian: Guardian): Promise<TweetData[]> {
    if (!this.twitterService) {
      throw new Error('Twitter service not initialized. Call initialize() first.');
    }

    try {
      console.log(`[DEBUG] Fetching tweets for ${guardian.name} using web scraping...`);
      console.log(`[DEBUG] Guardian Twitter handle: ${guardian.twitterHandle}`);
      console.log(`[DEBUG] Max tweets to fetch: ${this.config.maxTweetsPerFetch}`);
      
      // Use web scraping directly since API is rate-limited
      const rawTweets = await this.twitterService.scrapeUserTweets(
        guardian.twitterHandle,
        this.config.maxTweetsPerFetch
      );
      
      console.log(`[DEBUG] Scraped ${rawTweets.length} raw tweets from ${guardian.name}`);
      console.log(`[DEBUG] Raw tweets data:`, JSON.stringify(rawTweets, null, 2));

      // Convert scraped tweets to our TweetData format
      const tweets: TweetData[] = [];
      
      if (rawTweets && Array.isArray(rawTweets)) {
        console.log(`[DEBUG] Processing ${rawTweets.length} raw tweets...`);
        for (const tweet of rawTweets) {
          console.log(`[DEBUG] Processing tweet:`, JSON.stringify(tweet, null, 2));
          const tweetData: TweetData = {
            id: tweet.id,
            content: tweet.text,
            author: {
              name: guardian.name,
              handle: guardian.twitterHandle,
              profileImageUrl: '' 
            },
            metrics: {
              likes: tweet.public_metrics?.like_count || 0,
              retweets: tweet.public_metrics?.retweet_count || 0,
              replies: tweet.public_metrics?.reply_count || 0
            },
            media: {
              images: [],
              videos: []
            },
            createdAt: new Date(tweet.created_at!),
            fetchedAt: new Date()
          };

          tweets.push(tweetData);
          console.log(`[DEBUG] Converted tweet to TweetData:`, JSON.stringify(tweetData, null, 2));
        }
      } else {
        console.log(`[DEBUG] No raw tweets to process. rawTweets:`, rawTweets);
      }

      console.log(`[DEBUG] Final tweets array length: ${tweets.length}`);
      return tweets;
    } catch (error) {
      console.error(`[DEBUG] Error fetching tweets for guardian ${guardian.name}:`, error);
      return [];
    }
  }

  /**
   * Get agent information
   */
  getAgentInfo(): AgentConfig {
    return this.config;
  }

  /**
   * Create a review item for manual approval
   */
  private async createReviewItem(
    type: 'case_creation' | 'case_update' | 'case_enrichment',
    tweet: TweetData,
    analysis: TweetAnalysis,
    caseAnalysis?: any
  ): Promise<ReviewItem | null> {
    try {
        const guardian = this.config.guardians.find((g: Guardian) => 
          g.twitterHandle === tweet.author.handle || g.twitterUserId === tweet.author.handle
        );
      if (!guardian) {
        console.warn(`Guardian not found for tweet author: ${tweet.author.handle}`);
        return null;
      }

      // Check if auto-approval is possible
      const shouldAutoApprove = !this.config.reviewPolicy.requireManualReview && 
                               analysis.confidence >= this.config.reviewPolicy.autoApproveThreshold;

      const reviewItem: ReviewItem = {
        id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        status: shouldAutoApprove ? 'auto_approved' : 'pending',
        tweetId: tweet.id,
        tweetContent: tweet.content,
        tweetAuthor: tweet.author.handle,
        guardianId: guardian.id,
        caseId: caseAnalysis?.existingCase?.id,
        proposedAction: this.generateProposedAction(type, tweet, analysis, caseAnalysis),
        confidence: analysis.confidence,
        urgency: analysis.urgency,
        createdAt: new Date(),
        originalTweet: tweet, // Include full original tweet for manual review
        metadata: {
          analysisResult: analysis,
          caseAnalysis,
          images: tweet.media?.images || tweet.imageUrls || []
        }
      };

      return reviewItem;
    } catch (error) {
      console.error('Error creating review item:', error);
      return null;
    }
  }

  /**
   * Add item to review queue
   */
  private async addToReviewQueue(reviewItem: ReviewItem): Promise<void> {
    try {
      if (!this.config.reviewPolicy.reviewQueueEnabled) {
        console.log('Review queue is disabled, skipping review item');
        return;
      }

      this.reviewQueue.push(reviewItem);

      // If auto-approved, execute the action immediately
      if (reviewItem.status === 'auto_approved') {
        await this.executeApprovedAction(reviewItem);
      } else {
        // Notify admins if configured
        if (this.config.reviewPolicy.notifyOnReview) {
          await this.notifyAdminsOfReviewItem(reviewItem);
        }
      }

      console.log(`📋 Review item added to queue: ${reviewItem.id} (${reviewItem.type})`);
    } catch (error) {
      console.error('Error adding to review queue:', error);
    }
  }

  /**
   * Generate proposed action based on review type
   */
  private generateProposedAction(
    type: string,
    tweet: TweetData,
    analysis: TweetAnalysis,
    caseAnalysis?: any
  ): any {
    switch (type) {
      case 'case_creation':
        return {
          action: 'create_case',
          caseData: caseAnalysis?.newCaseData,
          images: tweet.media?.images || tweet.imageUrls || []
        };
      case 'case_update':
        return {
          action: 'create_update',
          updateType: analysis.caseUpdateType,
          content: this.generateCaseUpdateContent(tweet, analysis),
          images: tweet.media?.images || tweet.imageUrls || [],
          caseId: caseAnalysis?.existingCase?.id
        };
      case 'case_enrichment':
        return {
          action: 'enrich_case',
          enrichment: analysis.caseEnrichment,
          caseId: caseAnalysis?.existingCase?.id,
          images: tweet.media?.images || tweet.imageUrls || []
        };
      default:
        return { action: 'unknown' };
    }
  }

  /**
   * Execute approved action
   */
  private async executeApprovedAction(reviewItem: ReviewItem): Promise<boolean> {
    try {
      const { proposedAction } = reviewItem;
      
      switch (proposedAction.action) {
        case 'create_case':
          return await this.createNewCaseFromTweet(
            { 
              id: reviewItem.tweetId, 
              content: reviewItem.tweetContent,
              author: { handle: reviewItem.tweetAuthor, name: '', profileImageUrl: '' },
              metrics: { likes: 0, retweets: 0, replies: 0 },
              media: { images: proposedAction.images || [], videos: [] },
              createdAt: reviewItem.createdAt,
              fetchedAt: reviewItem.createdAt
            },
            proposedAction.caseData
          );
        
        case 'create_update':
          return await this.createCaseUpdateViaAPI(
            { 
              id: reviewItem.tweetId, 
              content: reviewItem.tweetContent,
              author: { handle: reviewItem.tweetAuthor, name: '', profileImageUrl: '' },
              metrics: { likes: 0, retweets: 0, replies: 0 },
              media: { images: proposedAction.images || [], videos: [] },
              createdAt: reviewItem.createdAt,
              fetchedAt: reviewItem.createdAt
            },
            reviewItem.metadata.analysisResult,
            { existingCase: { id: proposedAction.caseId } }
          );
        
        case 'enrich_case':
          return await this.enrichCase(
            proposedAction.caseId,
            proposedAction.enrichment,
            { 
              id: reviewItem.tweetId, 
              content: reviewItem.tweetContent,
              author: { handle: reviewItem.tweetAuthor, name: '', profileImageUrl: '' },
              metrics: { likes: 0, retweets: 0, replies: 0 },
              media: { images: proposedAction.images || [], videos: [] },
              createdAt: reviewItem.createdAt,
              fetchedAt: reviewItem.createdAt
            }
          );
        
        default:
          console.warn(`Unknown action type: ${proposedAction.action}`);
          return false;
      }
    } catch (error) {
      console.error('Error executing approved action:', error);
      return false;
    }
  }

  /**
   * Notify admins of new review item
   */
  private async notifyAdminsOfReviewItem(reviewItem: ReviewItem): Promise<void> {
    try {
      // TODO: Implement actual notification system (email, Slack, etc.)
      console.log(`🔔 NOTIFICATION: New review item requires attention:`, {
        id: reviewItem.id,
        type: reviewItem.type,
        urgency: reviewItem.urgency,
        confidence: reviewItem.confidence,
        tweetAuthor: reviewItem.tweetAuthor,
        tweetContent: reviewItem.tweetContent.substring(0, 100) + '...'
      });
    } catch (error) {
      console.error('Error notifying admins:', error);
    }
  }

  /**
   * Get review queue status
   */
  getReviewQueueStatus(): {
    totalItems: number;
    pendingItems: number;
    approvedItems: number;
    rejectedItems: number;
    autoApprovedItems: number;
    itemsByType: Record<string, number>;
    itemsByUrgency: Record<string, number>;
  } {
    const itemsByType = this.reviewQueue.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const itemsByUrgency = this.reviewQueue.reduce((acc, item) => {
      acc[item.urgency] = (acc[item.urgency] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalItems: this.reviewQueue.length,
      pendingItems: this.reviewQueue.filter(item => item.status === 'pending').length,
      approvedItems: this.reviewQueue.filter(item => item.status === 'approved').length,
      rejectedItems: this.reviewQueue.filter(item => item.status === 'rejected').length,
      autoApprovedItems: this.reviewQueue.filter(item => item.status === 'auto_approved').length,
      itemsByType,
      itemsByUrgency
    };
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    guardiansMonitored: number;
    lastRun?: Date;
    totalTweetsAnalyzed: number;
    totalCaseUpdatesCreated: number;
    casesCreatedToday: number;
    maxCasesPerDay: number;
    caseCreationEnabled: boolean;
    requireApproval: boolean;
    reviewQueueStatus: any;
  } {
    return {
      guardiansMonitored: this.config.guardians.filter(g => g.isActive).length,
      totalTweetsAnalyzed: this.totalTweetsAnalyzed,
      totalCaseUpdatesCreated: this.totalCaseUpdatesCreated,
      casesCreatedToday: this.casesCreatedToday,
      maxCasesPerDay: this.config.caseCreationPolicy.maxCasesPerDay,
      caseCreationEnabled: this.config.caseCreationPolicy.enabled,
      requireApproval: this.config.caseCreationPolicy.requireApproval,
      reviewQueueStatus: this.getReviewQueueStatus(),
      lastRun: this.lastRun || undefined
    };
  }

  /**
   * Get all review queue items
   */
  getReviewQueueItems(): ReviewItem[] {
    return [...this.reviewQueue];
  }

  /**
   * Get specific review item by ID
   */
  getReviewItem(itemId: string): ReviewItem | null {
    return this.reviewQueue.find(item => item.id === itemId) || null;
  }

  /**
   * Approve a review item
   */
  async approveReviewItem(itemId: string, reviewData: { notes?: string; reviewedBy?: string }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const item = this.getReviewItem(itemId);
      if (!item) {
        return { success: false, error: 'Review item not found' };
      }

      if (item.status !== 'pending') {
        return { success: false, error: 'Item is not pending review' };
      }

      // Update item status
      item.status = 'approved';
      item.reviewedAt = new Date();
      item.reviewedBy = reviewData.reviewedBy;
      item.reviewNotes = reviewData.notes;

      // Execute the approved action
      const executed = await this.executeApprovedAction(item);
      if (!executed) {
        item.status = 'pending'; // Revert if execution failed
        return { success: false, error: 'Failed to execute approved action' };
      }

      return { success: true, message: 'Review item approved and action executed' };
    } catch (error) {
      console.error('Error approving review item:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Reject a review item
   */
  async rejectReviewItem(itemId: string, reviewData: { notes?: string; reviewedBy?: string; reason?: string }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const item = this.getReviewItem(itemId);
      if (!item) {
        return { success: false, error: 'Review item not found' };
      }

      if (item.status !== 'pending') {
        return { success: false, error: 'Item is not pending review' };
      }

      // Update item status
      item.status = 'rejected';
      item.reviewedAt = new Date();
      item.reviewedBy = reviewData.reviewedBy;
      item.reviewNotes = reviewData.notes || reviewData.reason;

      return { success: true, message: 'Review item rejected' };
    } catch (error) {
      console.error('Error rejecting review item:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get agent configuration
   */
  getConfiguration(): any {
    return {
      ...this.config,
      // Don't expose sensitive credentials
      twitterCredentials: {
        apiKey: this.config.twitterCredentials.apiKey ? '***' : '',
        apiSecret: this.config.twitterCredentials.apiSecret ? '***' : '',
        accessToken: this.config.twitterCredentials.accessToken ? '***' : '',
        accessTokenSecret: this.config.twitterCredentials.accessTokenSecret ? '***' : ''
      }
    };
  }

  /**
   * Get rate limit status from Twitter service
   */
  getRateLimitStatus() {
    if (!this.twitterService) {
      return {};
    }
    return this.twitterService.getCurrentRateLimitStatus();
  }

  /**
   * Update agent configuration
   */
  updateConfiguration(newConfig: Partial<TwitterAgentConfig>): { success: boolean; message?: string; error?: string } {
    try {
      // Validate configuration
      if (newConfig.caseCreationPolicy) {
        if (newConfig.caseCreationPolicy.minConfidence < 0 || newConfig.caseCreationPolicy.minConfidence > 1) {
          return { success: false, error: 'Confidence threshold must be between 0 and 1' };
        }
        if (newConfig.caseCreationPolicy.maxCasesPerDay < 0) {
          return { success: false, error: 'Max cases per day must be positive' };
        }
      }

      if (newConfig.reviewPolicy) {
        if (newConfig.reviewPolicy.autoApproveThreshold < 0 || newConfig.reviewPolicy.autoApproveThreshold > 1) {
          return { success: false, error: 'Auto-approve threshold must be between 0 and 1' };
        }
      }

      // Update configuration
      this.config = { ...this.config, ...newConfig };

      return { success: true, message: 'Configuration updated successfully' };
    } catch (error) {
      console.error('Error updating configuration:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get analytics data
   */
  getAnalytics(days: number = 7, type: string = 'all'): any {
    // TODO: Implement actual analytics based on historical data
    // For now, return mock analytics
    return {
      period: `${days} days`,
      type: type,
      summary: {
        totalTweetsAnalyzed: this.totalTweetsAnalyzed,
        totalCaseUpdatesCreated: this.totalCaseUpdatesCreated,
        casesCreatedToday: this.casesCreatedToday,
        reviewItemsProcessed: this.reviewQueue.length
      },
      trends: {
        tweetsPerDay: Math.floor(this.totalTweetsAnalyzed / days),
        updatesPerDay: Math.floor(this.totalCaseUpdatesCreated / days),
        casesPerDay: Math.floor(this.casesCreatedToday / days)
      },
      reviewQueueStats: this.getReviewQueueStatus(),
      guardianActivity: this.config.guardians.map(g => ({
        id: g.id,
        name: g.name,
        isActive: g.isActive,
        lastTweetFetch: g.lastTweetFetch
      }))
    };
  }

  /**
   * Get guardians list
   */
  getGuardians(): Guardian[] {
    return [...this.config.guardians];
  }

  /**
   * Update guardian
   */
  updateGuardian(guardianId: string, updates: Partial<Guardian>): { success: boolean; message?: string; error?: string } {
    try {
      const guardianIndex = this.config.guardians.findIndex(g => g.id === guardianId);
      if (guardianIndex === -1) {
        return { success: false, error: 'Guardian not found' };
      }

      this.config.guardians[guardianIndex] = {
        ...this.config.guardians[guardianIndex],
        ...updates,
        updatedAt: new Date()
      };

      return { success: true, message: 'Guardian updated successfully' };
    } catch (error) {
      console.error('Error updating guardian:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get recent tweets
   */
  async getRecentTweets(guardianId?: string, limit: number = 20, hours: number = 24): Promise<TweetData[]> {
    try {
      // TODO: Implement actual tweet fetching
      // For now, return mock data
      return [
        {
          id: 'tweet_1',
          content: 'Luna is doing much better after her surgery! Thank you for all the support.',
          author: {
            name: 'Maria Fernandez',
            handle: 'maria_fernandez',
            profileImageUrl: 'https://example.com/profile.jpg'
          },
          metrics: {
            likes: 15,
            retweets: 3,
            replies: 2
          },
          media: {
            images: ['https://example.com/luna1.jpg'],
            videos: []
          },
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          fetchedAt: new Date()
        }
      ];
    } catch (error) {
      console.error('Error fetching recent tweets:', error);
      return [];
    }
  }

  /**
   * Test Twitter connection
   */
  async testConnection(credentials: TwitterCredentials): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const twitterService = new TwitterService(credentials);
      return await twitterService.testConnection();
    } catch (error) {
      console.error('Error testing Twitter connection:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Connection test failed' };
    }
  }

  /**
   * Fetch real tweets for testing (uses actual Twitter API)
   */
  async fetchRealTweets(guardianId: string, limit: number = 5): Promise<{
    success: boolean;
    tweets: TweetData[];
    analysisResults: TweetAnalysis[];
    proposedActions: ReviewItem[];
    error?: string;
  }> {
    try {
      const guardian = this.config.guardians.find(g => g.id === guardianId);
      if (!guardian) {
        return { success: false, tweets: [], analysisResults: [], proposedActions: [], error: 'Guardian not found' };
      }

      if (!this.twitterService) {
        return { success: false, tweets: [], analysisResults: [], proposedActions: [], error: 'Twitter service not initialized' };
      }

      // Fetch real tweets from Twitter API
      const tweets = await this.fetchUserTweets(guardian);
      const limitedTweets = tweets.slice(0, limit);

      const analysisResults: TweetAnalysis[] = [];
      const proposedActions: ReviewItem[] = [];

      // Analyze each tweet
      for (const tweet of limitedTweets) {
        try {
          // Find existing cases for this guardian
          const caseAnalysis = await this.analyzeCaseForUpdates(guardianId, tweet);
          
          // Analyze the tweet
          const analysis = await this.analyzeTweet(tweet, caseAnalysis);
          analysisResults.push(analysis);

          // Create review item if action is needed
          if (analysis.isCaseRelated && !analysis.extractedInfo.fundraisingRequest && !analysis.isDuplicate) {
            const reviewItem = await this.createReviewItem(
              caseAnalysis.shouldCreateNewCase ? 'case_creation' : 'case_update',
              tweet,
              analysis,
              caseAnalysis
            );
            if (reviewItem) {
              proposedActions.push(reviewItem);
            }
          }
        } catch (error) {
          console.error(`Error analyzing real tweet ${tweet.id}:`, error);
        }
      }

      return {
        success: true,
        tweets: limitedTweets,
        analysisResults,
        proposedActions
      };
    } catch (error) {
      console.error('Error fetching real tweets:', error);
      return {
        success: false,
        tweets: [],
        analysisResults: [],
        proposedActions: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Simulate tweet fetching for testing (returns mock tweets)
   */
  async simulateTweetFetching(guardianId: string, limit: number = 5): Promise<{
    success: boolean;
    tweets: TweetData[];
    analysisResults: TweetAnalysis[];
    proposedActions: ReviewItem[];
    error?: string;
  }> {
    try {
      const guardian = this.config.guardians.find(g => g.id === guardianId);
      if (!guardian) {
        return { success: false, tweets: [], analysisResults: [], proposedActions: [], error: 'Guardian not found' };
      }

      // Generate mock tweets for testing
      const mockTweets: TweetData[] = [
        {
          id: `test_tweet_${Date.now()}_1`,
          content: 'Luna needs urgent surgery! Please help us raise funds for her treatment. She has a broken leg and needs immediate care.',
          author: {
            name: guardian.name,
            handle: guardian.twitterHandle,
            profileImageUrl: 'https://example.com/profile.jpg'
          },
          metrics: {
            likes: 25,
            retweets: 8,
            replies: 5
          },
          media: {
            images: ['https://example.com/luna_injury.jpg', 'https://example.com/luna_xray.jpg'],
            videos: []
          },
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          fetchedAt: new Date()
        },
        {
          id: `test_tweet_${Date.now()}_2`,
          content: 'Update on Luna: She had her surgery yesterday and is recovering well! Thank you to everyone who donated.',
          author: {
            name: guardian.name,
            handle: guardian.twitterHandle,
            profileImageUrl: 'https://example.com/profile.jpg'
          },
          metrics: {
            likes: 45,
            retweets: 12,
            replies: 8
          },
          media: {
            images: ['https://example.com/luna_recovery.jpg'],
            videos: []
          },
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
          fetchedAt: new Date()
        },
        {
          id: `test_tweet_${Date.now()}_3`,
          content: 'Just adopted a new rescue dog today! Meet Max, he\'s looking for a loving home. DM me if interested.',
          author: {
            name: guardian.name,
            handle: guardian.twitterHandle,
            profileImageUrl: 'https://example.com/profile.jpg'
          },
          metrics: {
            likes: 18,
            retweets: 3,
            replies: 2
          },
          media: {
            images: ['https://example.com/max_adoption.jpg'],
            videos: []
          },
          createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          fetchedAt: new Date()
        }
      ].slice(0, limit);

      const analysisResults: TweetAnalysis[] = [];
      const proposedActions: ReviewItem[] = [];

      // Analyze each tweet
      for (const tweet of mockTweets) {
        try {
          // Find existing cases for this guardian
          const caseAnalysis = await this.analyzeCaseForUpdates(guardianId, tweet);
          
          // Analyze the tweet
          const analysis = await this.analyzeTweet(tweet, caseAnalysis);
          analysisResults.push(analysis);

          // Create review item if action is needed
          if (analysis.isCaseRelated && !analysis.extractedInfo.fundraisingRequest && !analysis.isDuplicate) {
            const reviewItem = await this.createReviewItem(
              caseAnalysis.shouldCreateNewCase ? 'case_creation' : 'case_update',
              tweet,
              analysis,
              caseAnalysis
            );
            if (reviewItem) {
              proposedActions.push(reviewItem);
            }
          }
        } catch (error) {
          console.error(`Error analyzing test tweet ${tweet.id}:`, error);
        }
      }

      return {
        success: true,
        tweets: mockTweets,
        analysisResults,
        proposedActions
      };
    } catch (error) {
      console.error('Error simulating tweet fetching:', error);
      return {
        success: false,
        tweets: [],
        analysisResults: [],
        proposedActions: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
