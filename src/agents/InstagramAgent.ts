import { BaseAgent } from './BaseAgent';
import {
  AgentConfig,
  AgentResponse,
  UserContext,
  AgentAction,
  ConversationContext
} from "../types";
import { socialMediaAgentTools } from "../types/tools";
import { FunctionDeclaration, FunctionCall } from "@google/generative-ai";
import { InstagramService } from "../services/InstagramService";
import { SocialMediaPostService } from "../services/SocialMediaPostService";
import { ImageService } from "../services/ImageService";
import { ImageAnalysisService, ImageAnalysis } from "../services/ImageAnalysisService";
import { AgentFeedbackService } from "../services/AgentFeedbackService";
import { PromptBuilder } from '../prompts/PromptBuilder';
import {
  instagramAgentPersona,
  instagramVisualFocus,
  socialMediaUpdateTypes,
  socialMediaAnalysisGuidelines,
  socialMediaFiltering,
  duplicateDetectionRules,
  urgencyLevels,
  communicationStyleForAnalysis,
  safetyForSocialMedia
} from '../prompts/components';

// Instagram-specific types
export interface InstagramCredentials {
  accessToken?: string; // For Instagram Basic Display API
  appId?: string;
  appSecret?: string;
}

export interface Guardian {
  id: string;
  name: string;
  instagramHandle: string;
  instagramUserId?: string;
  accessToken?: string; // Guardian-specific access token
  isActive: boolean;
  lastPostFetch?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstagramAgentConfig extends AgentConfig {
  instagramCredentials: InstagramCredentials;
  guardians: Guardian[];
  monitoringInterval: number; // minutes
  maxPostsPerFetch: number;
  searchTimeWindow: number; // hours
  caseCreationPolicy: {
    enabled: boolean;
    requireApproval: boolean;
    minConfidence: number;
    maxCasesPerDay: number;
  };
  reviewPolicy: {
    requireManualReview: boolean;
    autoApproveThreshold: number;
    reviewQueueEnabled: boolean;
    notifyOnReview: boolean;
  };
}

export interface InstagramPost {
  id: string;
  caption: string;
  media: {
    images: string[];
    videos: string[];
    carousel: string[];
  };
  author: {
    name: string;
    username: string;
    profileImageUrl: string;
  };
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  hashtags: string[];
  mentions: string[];
  location?: {
    name: string;
    coordinates?: [number, number];
  };
  createdAt: Date;
  fetchedAt: Date;
  permalink?: string;
}

export interface InstagramStory {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  author: {
    name: string;
    username: string;
  };
  metrics: {
    views: number;
    interactions: number;
  };
  expiresAt: Date;
  createdAt: Date;
  fetchedAt: Date;
}

export interface PostAnalysis {
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
  visualAnalysis?: {
    animalDetected: boolean;
    animalType?: string;
    medicalIndicators?: string[];
    visualElements: string[];
  };
  caseEnrichment?: {
    fieldsToUpdate: string[];
    newValues: Record<string, any>;
    reason: string;
  };
  isDuplicate?: boolean;
  duplicateReason?: string;
  imageAnalysis?: ImageAnalysis; // NEW: Multi-modal image analysis from Gemini vision
}

export interface ReviewItem {
  id: string;
  type: 'case_creation' | 'case_update' | 'case_enrichment';
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  postId: string;
  postContent: string;
  postAuthor: string;
  guardianId: string;
  caseId?: string;
  proposedAction: any;
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  originalPost: InstagramPost | InstagramStory;
  metadata: {
    analysisResult: PostAnalysis;
    caseAnalysis?: any;
    images?: string[];
  };
}

export interface InstagramAgentResponse extends AgentResponse {
  postsAnalyzed?: number;
  postsCreated?: number;
  storiesAnalyzed?: number;
  caseUpdatesCreated?: number;
  analysisResults?: PostAnalysis[];
}

export class InstagramAgent extends BaseAgent {
  protected config: InstagramAgentConfig;
  private lastRun: Date | null = null;
  private totalPostsAnalyzed: number = 0;
  private totalCaseUpdatesCreated: number = 0;
  private casesCreatedToday: number = 0;
  private lastCaseCreationDate: string = '';
  private reviewQueue: ReviewItem[] = [];
  private instagramService: InstagramService | null = null;
  private socialMediaPostService!: SocialMediaPostService;
  private imageService!: ImageService;
  private imageAnalysisService!: ImageAnalysisService;
  private feedbackService!: AgentFeedbackService;

  constructor(config?: Partial<InstagramAgentConfig>) {
    const baseConfig: AgentConfig = {
      name: 'InstagramAgent',
      description: 'Monitors guardian Instagram accounts, analyzes posts and stories for case relevance, and creates case updates',
      version: '1.0.0',
      capabilities: [
        'post_fetching',
        'story_monitoring',
        'visual_content_analysis',
        'content_analysis',
        'case_update_creation',
        'emergency_detection',
        'fundraising_filtering',
        'pattern_learning',
        'case_creation',
        'function_calling', // NEW: Function calling capability
      ],
      isEnabled: true,
      maxRetries: 3,
      timeout: 60000,
    };

    super(baseConfig);

    // Default configuration
    this.config = {
      ...baseConfig,
      instagramCredentials: {},
      guardians: [],
      monitoringInterval: 60,
      maxPostsPerFetch: 10,
      searchTimeWindow: 24,
      caseCreationPolicy: {
        enabled: true,
        requireApproval: true,
        minConfidence: 0.8,
        maxCasesPerDay: 5
      },
      reviewPolicy: {
        requireManualReview: true,
        autoApproveThreshold: 0.95,
        reviewQueueEnabled: true,
        notifyOnReview: true
      },
      ...config
    };
  }

  /**
   * Override to provide function declarations for this agent
   */
  protected getFunctionDeclarations(): FunctionDeclaration[] {
    return socialMediaAgentTools as FunctionDeclaration[];
  }

  protected getSystemPrompt(): string {
    // Build modular prompt using PromptBuilder
    const { prompt, metrics } = PromptBuilder.create({ enableCache: true, version: 'v2.0' })
      .addComponent('persona', instagramAgentPersona, 10)
      .addComponent('visualFocus', instagramVisualFocus, 15)
      .addComponent('analysisGuidelines', socialMediaAnalysisGuidelines, 20)
      .addComponent('filtering', socialMediaFiltering, 30)
      .addComponent('updateTypes', socialMediaUpdateTypes, 40)
      .addComponent('duplicateDetection', duplicateDetectionRules, 50)
      .addComponent('urgencyLevels', urgencyLevels, 60)
      .addComponent('responseFormat', communicationStyleForAnalysis, 70)
      .addComponent('safety', safetyForSocialMedia, 80)
      .build();

    // Log metrics for analytics
    console.log(`[InstagramAgent] Prompt built: ${metrics.componentCount} components, ~${metrics.estimatedTokens} tokens, cache hit: ${metrics.cacheHit}`);

    return prompt;
  }

  /**
   * Initialize Instagram credentials and guardian data
   */
  async initialize(credentials: InstagramCredentials, guardians: Guardian[]): Promise<void> {
    // CRITICAL: Ensure review queue is enabled (required for saving posts to Firestore)
    if (!this.config.reviewPolicy.reviewQueueEnabled) {
      console.warn('⚠️ reviewQueueEnabled was false - enabling it to ensure posts are saved');
      this.config.reviewPolicy.reviewQueueEnabled = true;
    }
    this.config.instagramCredentials = credentials;
    this.config.guardians = guardians;
    
    // Initialize Instagram service
    this.instagramService = new InstagramService(credentials);
    this.socialMediaPostService = new SocialMediaPostService();
    this.imageService = new ImageService();
    this.imageAnalysisService = new ImageAnalysisService();
    this.feedbackService = new AgentFeedbackService();
    console.log(`InstagramAgent initialized with ${guardians.length} guardians`);
  }

  /**
   * Load guardians from database and initialize Instagram service
   */
  async initializeWithDatabase(credentials: InstagramCredentials, guardianId?: string): Promise<void> {
    // CRITICAL: Ensure review queue is enabled (required for saving posts to Firestore)
    if (!this.config.reviewPolicy.reviewQueueEnabled) {
      console.warn('⚠️ reviewQueueEnabled was false - enabling it to ensure posts are saved');
      this.config.reviewPolicy.reviewQueueEnabled = true;
    }
    this.config.instagramCredentials = credentials;
    
    // Load guardians from database
      await this.loadGuardiansFromDatabase(guardianId);
    
    // Initialize Instagram service
    this.instagramService = new InstagramService(credentials);
    this.socialMediaPostService = new SocialMediaPostService();
    this.imageService = new ImageService();
    this.imageAnalysisService = new ImageAnalysisService();
    this.feedbackService = new AgentFeedbackService();
    console.log(`InstagramAgent initialized with ${this.config.guardians.length} guardians from database`);
  }

  /**
   * Load guardians from database
   */
  private async loadGuardiansFromDatabase(guardianId?: string): Promise<void> {
    try {
      const admin = require('firebase-admin');
      const db = admin.firestore();
      
      // If guardianId is provided, load only that guardian
      if (guardianId) {
        const guardianDoc = await db.collection('users').doc(guardianId).get();
        if (guardianDoc.exists) {
          const userData = guardianDoc.data();
          const socialLinks = userData?.contactInfo?.socialLinks || {};
          
          if (socialLinks.instagram) {
            this.config.guardians = [{
              id: guardianDoc.id,
              name: userData?.name || 'Unknown Guardian',
              instagramHandle: socialLinks.instagram.replace('@', '').replace('https://instagram.com/', '').replace('https://www.instagram.com/', ''),
              instagramUserId: userData?.instagramUserId,
              accessToken: userData?.instagramAccessToken,
              isActive: true,
              lastPostFetch: new Date(),
              createdAt: userData?.createdAt || new Date(),
              updatedAt: userData?.updatedAt || new Date()
            }];
            console.log(`Loaded 1 guardian from database (filtered)`);
            return;
          }
        }
        // If guardian not found or doesn't have Instagram, set empty
        this.config.guardians = [];
        console.log(`Guardian ${guardianId} not found or has no Instagram handle`);
        return;
      }
      
      // Load all guardians from users collection where role = 'guardian'
      const guardiansSnapshot = await db.collection('users')
        .where('role', '==', 'guardian')
        .get();
      
      const guardians: Guardian[] = [];
      
      guardiansSnapshot.forEach((doc: any) => {
        const userData = doc.data();
        const socialLinks = userData.contactInfo?.socialLinks || {};
        
        if (socialLinks.instagram) {
          const guardian: Guardian = {
            id: doc.id,
            name: userData.name || 'Unknown Guardian',
            instagramHandle: socialLinks.instagram.replace('@', '').replace('https://instagram.com/', '').replace('https://www.instagram.com/', ''),
            instagramUserId: userData.instagramUserId,
            accessToken: userData.instagramAccessToken,
            isActive: true,
            lastPostFetch: new Date(),
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
   * Fetch posts from active guardians (optionally filter by guardianId)
   */
  async fetchGuardianPosts(guardianId?: string): Promise<InstagramPost[]> {
    if (!this.instagramService) {
      throw new Error('Instagram service not initialized');
    }

    const allPosts: InstagramPost[] = [];
    let activeGuardians = this.config.guardians.filter((g: Guardian) => g.isActive);
    
    if (guardianId) {
      activeGuardians = activeGuardians.filter((g: Guardian) => g.id === guardianId);
    }

    for (const guardian of activeGuardians) {
      try {
        let posts: InstagramPost[] = [];
        
        if (guardian.accessToken && guardian.instagramUserId) {
          // Use API if access token available
          posts = await this.instagramService.getUserPosts(
            guardian.instagramUserId, 
            this.config.maxPostsPerFetch,
            guardian.accessToken
          );
        } else {
          // Fallback to web scraping
          posts = await this.instagramService.scrapeUserPosts(
            guardian.instagramHandle,
            this.config.maxPostsPerFetch
          );
        }
        
        // Add author information to posts
        posts = posts.map(post => ({
          ...post,
          author: {
            ...post.author,
            name: guardian.name,
            username: guardian.instagramHandle,
          }
        }));
        
        allPosts.push(...posts);
      } catch (error) {
        console.error(`Error fetching posts for @${guardian.instagramHandle}:`, error);
      }
    }

    return allPosts;
  }

  /**
   * Fetch stories from all active guardians
   */
  async fetchGuardianStories(): Promise<InstagramStory[]> {
    if (!this.instagramService) {
      throw new Error('Instagram service not initialized');
    }

    const allStories: InstagramStory[] = [];
    const activeGuardians = this.config.guardians.filter((g: Guardian) => g.isActive);

    console.log(`Fetching stories from ${activeGuardians.length} active guardians`);

    for (const guardian of activeGuardians) {
      try {
        if (guardian.accessToken && guardian.instagramUserId) {
          const stories = await this.instagramService.getUserStories(
            guardian.instagramUserId,
            guardian.accessToken
          );
          
          // Add author information to stories
          const storiesWithAuthor = stories.map(story => ({
            ...story,
            author: {
              ...story.author,
              name: guardian.name,
              username: guardian.instagramHandle,
            }
          }));
          
          allStories.push(...storiesWithAuthor);
          console.log(`Fetched ${stories.length} stories from @${guardian.instagramHandle}`);
        }
      } catch (error) {
        console.error(`Error fetching stories for @${guardian.instagramHandle}:`, error);
      }
    }

    return allStories;
  }

  /**
   * Analyze posts for case relevance and create updates
   */
  async analyzePostsAndCreateUpdates(posts: InstagramPost[]): Promise<InstagramAgentResponse> {
    const startTime = Date.now();
    const analysisResults: PostAnalysis[] = [];
    let caseUpdatesCreated = 0;
    let postsSavedCount = 0; // Track actual posts saved to Firestore

    console.log(`1. Extraction requested: ${posts.length} posts`);

    for (const post of posts) {
      try {
        // Find the guardian for this post
        const guardian = this.config.guardians.find((g: Guardian) => 
          g.instagramHandle === post.author.username
        );
        if (!guardian) {
          console.warn(`Guardian not found for post author: ${post.author.username}`);
          continue;
        }

        // Analyze existing case data to determine if this adds new information
        const caseAnalysis = await this.analyzeCaseForUpdates(guardian.id, post);
        
        // Analyze the post with case context
        const analysis = await this.analyzePost(post, caseAnalysis);
        analysisResults.push(analysis);

        // Handle different scenarios based on case analysis
        // Save ALL posts to review queue (not just case-related ones)
        // Default to 'case_creation' - only use 'case_update' if an existing case is found
        let reviewType: 'case_creation' | 'case_update' | 'case_enrichment' = 'case_creation';
        
        if (caseAnalysis.shouldCreateNewCase && caseAnalysis.newCaseData) {
          reviewType = 'case_creation';
        } else if (caseAnalysis.existingCase && 
                   analysis.isCaseRelated && 
                   !analysis.extractedInfo.fundraisingRequest && 
                   !analysis.isDuplicate &&
                   analysis.caseUpdateType !== 'duplicate') {
          // Only set to 'case_update' if an existing case was found
          reviewType = 'case_update';
        } else if (analysis.isCaseRelated && !caseAnalysis.existingCase) {
          // Case-related but no existing case found - should create new case
          reviewType = 'case_creation';
        }

        // Create and save review item for ALL posts (users can review and dismiss if needed)
        const reviewItem = await this.createReviewItem(reviewType, post, analysis, caseAnalysis);
        if (reviewItem) {
          // Track if save was successful
          const saved = await this.addToReviewQueue(reviewItem);
          if (saved) {
            postsSavedCount++;
          }
        }
      } catch (error) {
        console.error(`Error analyzing post ${post.id}:`, error);
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      message: `Analyzed ${posts.length} posts, created ${caseUpdatesCreated} case updates, saved ${postsSavedCount} posts`,
      postsAnalyzed: posts.length,
      caseUpdatesCreated,
      postsCreated: postsSavedCount, // Actual posts saved to Firestore
      analysisResults,
      metadata: {
        agentType: this.config.name,
        confidence: 0.9,
        processingTime,
      },
    };
  }

  /**
   * Main method to run the complete Instagram monitoring process
   * @param guardianId Optional guardian ID to filter monitoring to a specific guardian
   */
  async runMonitoringCycle(guardianId?: string): Promise<InstagramAgentResponse> {
    try {
      console.log(`1. Extraction requested: Instagram monitoring`);

      // Step 1: Fetch posts from guardians (filtered by guardianId if provided)
      console.log(`2. Instagram scraping...`);
      const posts = await this.fetchGuardianPosts(guardianId);
      
      // Step 2: Fetch stories from all guardians (optional, as they expire quickly)
      const stories = await this.fetchGuardianStories();
      
      if (posts.length === 0 && stories.length === 0) {
        return {
          success: true,
          message: 'No new posts or stories found from guardians',
          postsAnalyzed: 0,
          storiesAnalyzed: 0,
          caseUpdatesCreated: 0,
          metadata: {
            agentType: this.config.name,
            confidence: 1.0,
            processingTime: 0,
          },
        };
      }

      // Step 3: Analyze posts and create case updates
      const result = await this.analyzePostsAndCreateUpdates(posts);
      
      // TODO: Analyze stories separately (they have different handling)

      this.lastRun = new Date();
      return result;

    } catch (error) {
      console.error('Error in Instagram monitoring cycle:', error);
      return {
        success: false,
        message: `Instagram monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
   * Analyze existing case data to determine if post adds new information
   */
  private async analyzeCaseForUpdates(guardianId: string, post: InstagramPost): Promise<{
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
        const existingCase = existingCases[0];
        
        return {
          existingCase,
          isNewInformation: true,
          duplicateFields: [],
          enrichmentOpportunities: ['medicalProgress', 'treatmentUpdate', 'additionalImages', 'visualProgress']
        };
      }
      
      // No existing cases found - analyze if we should create a new one
      const shouldCreateNewCase = await this.shouldCreateNewCaseFromPost(post);
      
      if (shouldCreateNewCase) {
        const newCaseData = await this.generateNewCaseDataFromPost(post, guardianId);
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
      // Query toto-app-stg Firestore for cases belonging to this guardian
      const admin = (await import('firebase-admin')).default;
      const db = admin.firestore(); // Uses default app (toto-app-stg)
      
      const casesSnapshot = await db.collection('cases')
        .where('guardianId', '==', guardianId)
        .where('status', 'in', ['active', 'draft', 'in_progress'])
        .orderBy('updatedAt', 'desc')
        .limit(10)
        .get();
      
      if (casesSnapshot.empty) {
        return [];
      }
      
      const cases = casesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return cases;
    } catch (error) {
      console.error('[Instagram] Error finding cases for guardian:', error);
      return [];
    }
  }

  /**
   * Determine if we should create a new case from a post
   */
  private async shouldCreateNewCaseFromPost(post: InstagramPost): Promise<boolean> {
    try {
      if (!this.config.caseCreationPolicy.enabled) {
        return false;
      }

      // Check daily rate limit
      const today = new Date().toISOString().split('T')[0];
      if (this.lastCaseCreationDate !== today) {
        this.casesCreatedToday = 0;
        this.lastCaseCreationDate = today;
      }

      if (this.casesCreatedToday >= this.config.caseCreationPolicy.maxCasesPerDay) {
        return false;
      }

      // Use LLM to analyze if post contains enough information for a new case
      const analysisPrompt = `Analyze this Instagram post to determine if it contains enough information to create a new pet rescue case:

Post Caption: "${post.caption}"
Author: @${post.author.username} (${post.author.name})
Media: ${post.media.images.length} image(s), ${post.media.videos.length} video(s)
Hashtags: ${post.hashtags.join(', ') || 'None'}

Consider:
1. Does it mention a specific animal in need?
2. Does it describe a medical condition or emergency?
3. Does it mention location or contact information?
4. Does it seem like a legitimate rescue case (not just general animal content)?
5. Is there enough detail to create a meaningful case description?
6. Are there visual indicators (images/videos) showing an animal in need?

Respond with JSON:
{
  "shouldCreateCase": boolean,
  "confidence": number (0-1),
  "reason": "explanation of decision",
  "caseType": "emergency|medical|adoption|other",
  "urgency": "low|medium|high|critical"
}`;

      const result = await this.processMessage(analysisPrompt, {
        userId: 'instagram-agent',
        userRole: 'admin',
        language: 'en'
      });

      if (result.success && result.message) {
        try {
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
            console.log(`Post qualifies for case creation: confidence=${analysis.confidence}, reason=${analysis.reason}`);
            return true;
          }
        } catch (parseError) {
          console.error('Error parsing case creation analysis:', parseError);
        }
      }

      return false;
    } catch (error) {
      console.error('Error analyzing post for case creation:', error);
      return false;
    }
  }

  /**
   * Generate new case data from post content
   */
  private async generateNewCaseDataFromPost(post: InstagramPost, guardianId: string): Promise<any> {
    try {
      const caseGenerationPrompt = `Generate case data from this pet rescue Instagram post:

Post Caption: "${post.caption}"
Author: @${post.author.username} (${post.author.name})
Guardian ID: ${guardianId}
Media: ${post.media.images.length} image(s), ${post.media.videos.length} video(s)
Hashtags: ${post.hashtags.join(', ') || 'None'}

Extract and generate:
1. Case name (animal name or descriptive title)
2. Description (expand on the post content and visual elements)
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
  "source": "instagram",
  "sourcePostId": "${post.id}"
}`;

      const result = await this.processMessage(caseGenerationPrompt, {
        userId: 'instagram-agent',
        userRole: 'admin',
        language: 'en'
      });

      if (result.success && result.message) {
        try {
          let jsonString = result.message;
          if (jsonString.includes('```json')) {
            jsonString = jsonString.replace(/```json\s*/, '').replace(/```\s*$/, '');
          } else if (jsonString.includes('```')) {
            jsonString = jsonString.replace(/```\s*/, '').replace(/```\s*$/, '');
          }
          jsonString = jsonString.trim();
          const caseData = JSON.parse(jsonString);
          
          // Combine all media URLs
          const allMedia = [
            ...post.media.images,
            ...post.media.videos,
            ...post.media.carousel
          ];
          
          return {
            ...caseData,
            guardianId,
            guardianName: post.author.name,
            donationsReceived: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: this.config.caseCreationPolicy.requireApproval ? 'draft' : 'active',
            additionalImages: allMedia,
            imageUrl: allMedia[0] || undefined
          };
        } catch (parseError) {
          console.error('Error parsing case data generation:', parseError);
        }
      }

      // Fallback case data
      return {
        name: `Rescue Case from @${post.author.username}`,
        description: `Case created from Instagram post: ${post.caption}`,
        animalType: 'Unknown',
        medicalCondition: 'To be determined',
        location: null,
        donationGoal: 5000,
        priority: 'normal',
        status: 'draft',
        tags: ['instagram', 'auto-created'],
        source: 'instagram',
        sourcePostId: post.id,
        guardianId,
        guardianName: post.author.name,
        donationsReceived: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        additionalImages: [...post.media.images, ...post.media.videos, ...post.media.carousel],
        imageUrl: post.media.images[0] || undefined
      };
    } catch (error) {
      console.error('Error generating case data from post:', error);
      return null;
    }
  }

  /**
   * Convert function calls from Gemini to PostAnalysis
   * Uses structured function calling for reliable action detection
   */
  private convertFunctionCallsToPostAnalysis(
    functionCalls: FunctionCall[] | undefined,
    post: InstagramPost,
    caseAnalysis?: any
  ): PostAnalysis | null {
    if (!functionCalls || functionCalls.length === 0) {
      return null;
    }

    // Process the first function call (primary action)
    const call = functionCalls[0];
    const { name, args } = call;
    // Type assertion for args since it's typed as object
    const typedArgs = args as any;

    switch (name) {
      case 'flagUrgentCase':
        return {
          isCaseRelated: true,
          urgency: typedArgs.urgencyLevel as 'high' | 'critical',
          caseUpdateType: 'emergency',
          suggestedAction: typedArgs.suggestedAction,
          confidence: 0.9, // Function calling has high confidence
          extractedInfo: {
            emergency: true,
            fundraisingRequest: false,
          },
        };

      case 'updatePetStatus':
        return {
          isCaseRelated: true,
          urgency: typedArgs.statusType === 'emergency' ? 'critical' : 'medium',
          caseUpdateType: this.mapStatusTypeToCaseUpdateType(typedArgs.statusType),
          suggestedAction: `Update case with: ${typedArgs.details}`,
          confidence: typedArgs.confidence,
          extractedInfo: {
            statusUpdate: typedArgs.details,
            fundraisingRequest: false,
            emergency: typedArgs.statusType === 'emergency',
          },
          caseEnrichment: caseAnalysis?.existingCase ? {
            fieldsToUpdate: ['status', 'medicalProgress'],
            newValues: {
              status: typedArgs.statusType,
              medicalProgress: typedArgs.details,
            },
            reason: `Status update from Instagram: ${typedArgs.details}`,
          } : undefined,
        };

      case 'dismissPost':
        return {
          isCaseRelated: false,
          urgency: 'low',
          caseUpdateType: 'duplicate',
          suggestedAction: 'No action needed',
          confidence: 0.95,
          extractedInfo: {
            fundraisingRequest: typedArgs.reason === 'promotional',
            emergency: false,
          },
          isDuplicate: typedArgs.reason === 'duplicate',
          duplicateReason: typedArgs.reason,
        };

      case 'createCaseFromPost':
        return {
          isCaseRelated: true,
          urgency: typedArgs.urgency as 'low' | 'medium' | 'high' | 'critical',
          caseUpdateType: 'note',
          suggestedAction: 'create_case',
          confidence: typedArgs.confidence,
          extractedInfo: {
            animalMentioned: typedArgs.petName || typedArgs.animalType,
            fundraisingRequest: false,
            emergency: typedArgs.urgency === 'critical',
          },
        };

      default:
        console.warn(`Unknown function call: ${name}`);
        return null;
    }
  }

  /**
   * Map status type to case update type
   */
  private mapStatusTypeToCaseUpdateType(statusType: string): PostAnalysis['caseUpdateType'] {
    switch (statusType) {
      case 'medical_update':
        return 'note';
      case 'emergency':
        return 'emergency';
      case 'milestone':
        return 'milestone';
      case 'adoption_update':
        return 'status_change';
      default:
        return 'note';
    }
  }

  /**
   * Analyze a single post for case relevance
   */
  private async analyzePost(post: InstagramPost, caseAnalysis?: any): Promise<PostAnalysis> {
    // NEW: Analyze images with Gemini vision if present
    let imageAnalysis: ImageAnalysis | undefined;
    const postImages = [...post.media.images, ...post.media.carousel];

    if (postImages.length > 0) {
      try {
        console.log(`🖼️  Post has ${postImages.length} image(s), analyzing with Gemini vision...`);
        imageAnalysis = await this.imageAnalysisService.analyzeMultipleImages(
          postImages,
          {
            postText: post.caption,
            platform: 'instagram',
            guardianName: post.author.name,
          }
        );
        console.log(`✅ Image analysis complete - Urgency: ${imageAnalysis.urgencyLevel}, Confidence: ${(imageAnalysis.confidence * 100).toFixed(1)}%`);

        // If image shows critical condition, log it
        if (imageAnalysis.urgencyLevel === 'critical' || imageAnalysis.urgencyLevel === 'high') {
          console.log(`⚠️  HIGH URGENCY detected in image: ${imageAnalysis.healthIndicators.visibleInjuries.join(', ')}`);
        }
      } catch (error) {
        console.error('Error analyzing Instagram images:', error);
        // Continue without image analysis
      }
    }

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

    const analysisPrompt = `Analyze this Instagram post from a pet rescue guardian:

Post Caption: "${post.caption}"
Author: @${post.author.username} (${post.author.name})
Created: ${post.createdAt.toISOString()}
Media: ${post.media.images.length} image(s), ${post.media.videos.length} video(s), ${post.media.carousel.length} carousel item(s)
Hashtags: ${post.hashtags.join(', ') || 'None'}
Mentions: ${post.mentions.join(', ') || 'None'}
${caseContext}

Determine:
1. Is this post case-related? (medical updates, rescue progress, animal conditions, visual progress)
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
   - New images or media URLs
6. Analyze visual content when available (note if images/videos contain relevant information)
7. Is this a fundraising request? (if yes, ignore it)
8. Does this add NEW information or duplicate existing case data?

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
  "visualAnalysis": {
    "animalDetected": boolean,
    "animalType": "string or null",
    "medicalIndicators": ["array of indicators or null"],
    "visualElements": ["array of visual elements described"]
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
      // Try function calling first (preferred method)
      console.log('🔧 Attempting function calling for Instagram post analysis...');
      const functionResult = await this.processMessageWithFunctions(analysisPrompt, {
        userId: 'instagram-agent',
        userRole: 'admin',
        language: 'en',
      });

      // Check if we got function calls
      if (functionResult.functionCalls && functionResult.functionCalls.length > 0) {
        console.log(`✅ Function calling successful! Got ${functionResult.functionCalls.length} function calls`);
        const analysis = this.convertFunctionCallsToPostAnalysis(functionResult.functionCalls, post, caseAnalysis);
        if (analysis) {
          // Add media URLs to extractedInfo
          const allMedia = [
            ...post.media.images,
            ...post.media.videos,
            ...post.media.carousel
          ];
          if (allMedia.length > 0 && !analysis.extractedInfo.newImages) {
            analysis.extractedInfo.newImages = allMedia;
          }
          // Add image analysis if available
          if (imageAnalysis) {
            analysis.imageAnalysis = imageAnalysis;
            // Boost urgency if image analysis shows higher urgency
            if (imageAnalysis.urgencyLevel === 'critical' && analysis.urgency !== 'critical') {
              console.log(`⚠️  Boosting urgency to 'critical' based on image analysis`);
              analysis.urgency = 'critical';
            }
          }
          console.log(`✅ Converted function call to PostAnalysis: ${JSON.stringify(analysis, null, 2)}`);
          return analysis;
        }
        console.log('⚠️ Function call conversion returned null, falling back to legacy parsing');
      } else {
        console.log('ℹ️ No function calls returned, falling back to legacy text parsing');
      }

      // Fallback to legacy text parsing (DEPRECATED)
      console.log('⚠️ Using legacy text parsing method...');
      const result = await this.processMessage(analysisPrompt, {
        userId: 'instagram-agent',
        userRole: 'admin',
        language: 'en',
      });

      // Parse the JSON response
      let jsonString = result.message;

      if (jsonString.includes('```json')) {
        jsonString = jsonString.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (jsonString.includes('```')) {
        jsonString = jsonString.replace(/```\s*/, '').replace(/```\s*$/, '');
      }

      jsonString = jsonString.trim();
      const analysis = JSON.parse(jsonString);

      // Add media URLs to extractedInfo
      const allMedia = [
        ...post.media.images,
        ...post.media.videos,
        ...post.media.carousel
      ];
      if (allMedia.length > 0 && !analysis.extractedInfo.newImages) {
        analysis.extractedInfo.newImages = allMedia;
      }

      const typedAnalysis = analysis as PostAnalysis;
      // Add image analysis if available
      if (imageAnalysis) {
        typedAnalysis.imageAnalysis = imageAnalysis;
        // Boost urgency if image analysis shows higher urgency
        if (imageAnalysis.urgencyLevel === 'critical' && typedAnalysis.urgency !== 'critical') {
          console.log(`⚠️  Boosting urgency to 'critical' based on image analysis`);
          typedAnalysis.urgency = 'critical';
        } else if (imageAnalysis.urgencyLevel === 'high' && (typedAnalysis.urgency === 'low' || typedAnalysis.urgency === 'medium')) {
          console.log(`⚠️  Boosting urgency to 'high' based on image analysis`);
          typedAnalysis.urgency = 'high';
        }
      }

      return typedAnalysis;
    } catch (error) {
      console.error('Error analyzing post:', error);
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
        imageAnalysis, // Include image analysis even on error
      };
    }
  }

  /**
   * Create a review item for manual approval
   */
  private async createReviewItem(
    type: 'case_creation' | 'case_update' | 'case_enrichment',
    post: InstagramPost,
    analysis: PostAnalysis,
    caseAnalysis?: any
  ): Promise<ReviewItem | null> {
    try {
      const guardian = this.config.guardians.find((g: Guardian) => 
        g.instagramHandle === post.author.username
      );
      if (!guardian) {
        console.warn(`Guardian not found for post author: ${post.author.username}`);
        return null;
      }

      const shouldAutoApprove = !this.config.reviewPolicy.requireManualReview && 
                               analysis.confidence >= this.config.reviewPolicy.autoApproveThreshold;

      const allMedia = [
        ...post.media.images,
        ...post.media.videos,
        ...post.media.carousel
      ];

      const reviewItem: ReviewItem = {
        id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        status: shouldAutoApprove ? 'auto_approved' : 'pending',
        postId: post.id,
        postContent: post.caption,
        postAuthor: post.author.username,
        guardianId: guardian.id,
        caseId: caseAnalysis?.existingCase?.id,
        proposedAction: this.generateProposedAction(type, post, analysis, caseAnalysis),
        confidence: analysis.confidence,
        urgency: analysis.urgency,
        createdAt: new Date(),
        originalPost: post,
        metadata: {
          analysisResult: analysis,
          caseAnalysis,
          images: allMedia
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
   * @returns true if post was successfully saved to Firestore, false otherwise
   */
  private async addToReviewQueue(reviewItem: ReviewItem): Promise<boolean> {
    try {
      if (!this.config.reviewPolicy.reviewQueueEnabled) {
        return false;
      }

      // Get guardian info
      const guardian = this.config.guardians.find((g: Guardian) => g.id === reviewItem.guardianId);
      if (!guardian) {
        console.error(`❌ Guardian not found for review item: ${reviewItem.guardianId}`);
        return false;
      }

      // Process images if any (separate videos from images)
      const allMedia = reviewItem.metadata?.images || [];
      const imageUrls = allMedia.filter(url => {
        // Filter out video URLs - they typically contain .mp4 or video-related paths
        const lowerUrl = url.toLowerCase();
        return !lowerUrl.includes('.mp4') && 
               !lowerUrl.includes('video') && 
               !lowerUrl.includes('/o1/v/t2/f2/'); // Instagram video CDN pattern
      });
      const videoUrls = allMedia.filter(url => {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes('.mp4') || 
               lowerUrl.includes('video') || 
               lowerUrl.includes('/o1/v/t2/f2/');
      });
      
      const processedImages: string[] = [];
      const imageFileNames: string[] = [];
      
      // Process images only (skip videos)
      if (imageUrls.length > 0) {
        try {
          // Process each image individually to track file names
          for (let i = 0; i < imageUrls.length; i++) {
            try {
              const result = await this.imageService.processAndUploadImage(
                imageUrls[i],
                'instagram',
                reviewItem.postId,
                i
              );
              if (result) {
                processedImages.push(result.url);
                imageFileNames.push(result.fileName);
              } else {
                // Fallback: keep original URL if processing fails
                processedImages.push(imageUrls[i]);
              }
            } catch (imgError) {
              console.error(`Error processing image ${imageUrls[i]}:`, imgError);
              // Fallback: keep original URL if processing fails
              processedImages.push(imageUrls[i]);
            }
          }
        } catch (error) {
          console.error('Error processing images:', error);
          // Fallback: use original URLs if all processing fails
          if (processedImages.length === 0 && imageUrls.length > 0) {
            processedImages.push(...imageUrls);
          }
        }
      }
      
      // Add videos directly without processing (they can't be optimized with sharp)
      processedImages.push(...videoUrls);

      // Determine recommended action
      let recommendedAction: 'create_case' | 'create_update' | 'dismiss' = 'dismiss';
      if (reviewItem.type === 'case_creation') {
        recommendedAction = 'create_case';
      } else if (reviewItem.type === 'case_update' || reviewItem.type === 'case_enrichment') {
        recommendedAction = 'create_update';
      }

      // Save to Firestore via SocialMediaPostService
      const postData: any = {
        platform: 'instagram' as const,
        guardianId: reviewItem.guardianId,
        guardianName: guardian.name,
        postId: reviewItem.postId,
        postContent: reviewItem.postContent,
        images: processedImages,
        imageFileNames: imageFileNames,
        analysisResult: reviewItem.metadata?.analysisResult,
        recommendedAction,
        status: (reviewItem.status === 'auto_approved' ? 'approved' : 'pending') as 'pending' | 'approved' | 'rejected' | 'dismissed',
        urgency: reviewItem.urgency,
        confidence: reviewItem.confidence,
        metadata: {
          instagramPost: reviewItem.originalPost,
          originalPlatformData: reviewItem
        }
      };
      
      // Only add optional fields if they exist (avoid undefined in Firestore)
      if (reviewItem.originalPost && 'permalink' in reviewItem.originalPost && reviewItem.originalPost.permalink) {
        postData.postUrl = reviewItem.originalPost.permalink;
      }
      if (reviewItem.caseId) {
        postData.matchedCaseId = reviewItem.caseId;
      }

      const savedPostId = await this.socialMediaPostService.savePost(postData);
      if (savedPostId) {
        // Also keep in-memory queue for backward compatibility (only if save succeeded)
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
        
        return true;
      } else {
        console.error(`Failed to save post to Firestore: ${postData.postId} (Guardian: ${guardian.name})`);
        // Don't add to in-memory queue if save failed
        return false;
      }
    } catch (error) {
      console.error('Error adding to review queue:', error);
      return false;
    }
  }

  /**
   * Generate proposed action based on review type
   */
  private generateProposedAction(
    type: string,
    post: InstagramPost,
    analysis: PostAnalysis,
    caseAnalysis?: any
  ): any {
    const allMedia = [
      ...post.media.images,
      ...post.media.videos,
      ...post.media.carousel
    ];

    switch (type) {
      case 'case_creation':
        return {
          action: 'create_case',
          caseData: caseAnalysis?.newCaseData,
          images: allMedia
        };
      case 'case_update':
        return {
          action: 'create_update',
          updateType: analysis.caseUpdateType,
          content: this.generateCaseUpdateContent(post, analysis),
          images: allMedia,
          caseId: caseAnalysis?.existingCase?.id
        };
      case 'case_enrichment':
        return {
          action: 'enrich_case',
          enrichment: analysis.caseEnrichment,
          caseId: caseAnalysis?.existingCase?.id,
          images: allMedia
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
      // TODO: Implement actual case creation/update via toto-bo API
      console.log(`Executing approved action: ${reviewItem.type}`, reviewItem.proposedAction);
      return true;
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
      // TODO: Implement actual notification system
    } catch (error) {
      console.error('Error notifying admins:', error);
    }
  }

  /**
   * Generate case update content from post and analysis
   */
  private generateCaseUpdateContent(post: InstagramPost, analysis: PostAnalysis): string {
    const urgencyPrefix = analysis.urgency === 'critical' ? '🚨 URGENT: ' : 
                         analysis.urgency === 'high' ? '⚠️ HIGH PRIORITY: ' : '';
    
    let content = `${urgencyPrefix}Instagram Update from @${post.author.username}:\n\n`;
    content += `${post.caption}\n\n`;
    
    if (analysis.extractedInfo.animalMentioned) {
      content += `Animal: ${analysis.extractedInfo.animalMentioned}\n`;
    }
    if (analysis.extractedInfo.medicalCondition) {
      content += `Condition: ${analysis.extractedInfo.medicalCondition}\n`;
    }
    if (analysis.extractedInfo.location) {
      content += `Location: ${analysis.extractedInfo.location}\n`;
    }
    
    const allMedia = [
      ...post.media.images,
      ...post.media.videos,
      ...post.media.carousel
    ];
    if (allMedia.length > 0) {
      content += `\nMedia: ${allMedia.length} image(s)/video(s) attached\n`;
    }
    
    content += `\nSuggested Action: ${analysis.suggestedAction}`;
    
    return content;
  }

  /**
   * Get agent information
   */
  getAgentInfo(): AgentConfig {
    return this.config;
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
    totalPostsAnalyzed: number;
    totalCaseUpdatesCreated: number;
    casesCreatedToday: number;
    maxCasesPerDay: number;
    caseCreationEnabled: boolean;
    requireApproval: boolean;
    reviewQueueStatus: any;
  } {
    return {
      guardiansMonitored: this.config.guardians.filter(g => g.isActive).length,
      totalPostsAnalyzed: this.totalPostsAnalyzed,
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
   * Get configuration
   */
  getConfiguration(): any {
    return {
      ...this.config,
      instagramCredentials: {} // Don't expose actual credentials
    };
  }

  /**
   * Update agent configuration
   */
  updateConfiguration(newConfig: Partial<InstagramAgentConfig>): { success: boolean; message?: string; error?: string } {
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

      // Update configuration
      this.config = { ...this.config, ...newConfig };

      return { success: true, message: 'Configuration updated successfully' };
    } catch (error) {
      console.error('Error updating configuration:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
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
   * Test Instagram connection
   */
  async testConnection(credentials: InstagramCredentials): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const instagramService = new InstagramService(credentials);
      return await instagramService.testConnection(credentials.accessToken);
    } catch (error) {
      console.error('Error testing Instagram connection:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Connection test failed' };
    }
  }
}
