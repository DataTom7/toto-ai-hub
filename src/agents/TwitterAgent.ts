import { BaseAgent } from './BaseAgent';
import { 
  AgentConfig, 
  AgentResponse, 
  UserContext, 
  AgentAction,
  ConversationContext 
} from "../types";

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
}

export interface TweetAnalysis {
  isCaseRelated: boolean;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  caseUpdateType: 'status_change' | 'note' | 'milestone' | 'emergency';
  suggestedAction: string;
  confidence: number;
  extractedInfo: {
    animalMentioned?: string;
    medicalCondition?: string;
    location?: string;
    fundraisingRequest?: boolean;
    emergency?: boolean;
  };
}

export interface TwitterAgentResponse extends AgentResponse {
  tweetsAnalyzed?: number;
  caseUpdatesCreated?: number;
  analysisResults?: TweetAnalysis[];
}

export class TwitterAgent extends BaseAgent {
  private twitterCredentials?: TwitterCredentials;
  private guardians: Guardian[] = [];

  constructor() {
    const config: AgentConfig = {
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
      ],
      isEnabled: true,
      maxRetries: 3,
      timeout: 60000, // 60 seconds for Twitter operations
    };
    super(config);
  }

  protected getSystemPrompt(): string {
    return `You are Toto's Twitter Monitoring Agent, specialized in analyzing pet rescue tweets and creating case updates.

Your role:
- Analyze tweets from guardian accounts for case relevance
- Detect emergencies and urgent situations requiring immediate attention
- Create appropriate case updates based on tweet content
- Filter out funding requests (ignore donation pleas)
- Learn patterns to improve analysis accuracy over time
- Provide insights about guardian activity and case progress

Analysis Guidelines:
- Case-related tweets: Medical updates, rescue progress, animal conditions, treatment plans
- Emergency tweets: Urgent medical needs, critical situations, immediate help required
- Non-case tweets: Personal updates, general animal content, fundraising requests (IGNORE)
- Urgency levels: critical (life-threatening), high (urgent medical), medium (routine updates), low (general info)

Response Format:
- Always provide analysis confidence (0-1)
- Suggest specific case update type and content
- Extract relevant information (animal, condition, location)
- Flag emergencies for immediate attention

Be thorough but concise in your analysis.`;
  }

  /**
   * Initialize Twitter credentials and guardian data
   */
  async initialize(credentials: TwitterCredentials, guardians: Guardian[]): Promise<void> {
    this.twitterCredentials = credentials;
    this.guardians = guardians;
    console.log(`TwitterAgent initialized with ${guardians.length} guardians`);
  }

  /**
   * Fetch tweets from all active guardians
   */
  async fetchGuardianTweets(): Promise<TweetData[]> {
    if (!this.twitterCredentials) {
      throw new Error('Twitter credentials not initialized');
    }

    const allTweets: TweetData[] = [];
    const activeGuardians = this.guardians.filter(g => g.isActive);

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
        const analysis = await this.analyzeTweet(tweet);
        analysisResults.push(analysis);

        // Create case update if tweet is case-related and not a funding request
        if (analysis.isCaseRelated && !analysis.extractedInfo.fundraisingRequest) {
          const updateCreated = await this.createCaseUpdate(tweet, analysis);
          if (updateCreated) {
            caseUpdatesCreated++;
          }
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
   * Analyze a single tweet for case relevance
   */
  private async analyzeTweet(tweet: TweetData): Promise<TweetAnalysis> {
    const analysisPrompt = `Analyze this tweet from a pet rescue guardian:

Tweet: "${tweet.content}"
Author: @${tweet.author.handle} (${tweet.author.name})
Created: ${tweet.createdAt.toISOString()}

Determine:
1. Is this tweet case-related? (medical updates, rescue progress, animal conditions)
2. What's the urgency level? (critical, high, medium, low)
3. What type of case update should this create? (status_change, note, milestone, emergency)
4. What specific action should be taken?
5. Extract relevant information (animal mentioned, medical condition, location)
6. Is this a fundraising request? (if yes, ignore it)

Respond in JSON format:
{
  "isCaseRelated": boolean,
  "urgency": "low|medium|high|critical",
  "caseUpdateType": "status_change|note|milestone|emergency",
  "suggestedAction": "string",
  "confidence": number,
  "extractedInfo": {
    "animalMentioned": "string or null",
    "medicalCondition": "string or null", 
    "location": "string or null",
    "fundraisingRequest": boolean,
    "emergency": boolean
  }
}`;

    try {
      const result = await this.processMessage(analysisPrompt, {
        userId: 'twitter-agent',
        userRole: 'admin',
        language: 'en',
      });

      // Parse the JSON response
      const analysis = JSON.parse(result.message);
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
   * Create a case update based on tweet analysis
   */
  private async createCaseUpdate(tweet: TweetData, analysis: TweetAnalysis): Promise<boolean> {
    try {
      // Find the guardian for this tweet
      const guardian = this.guardians.find(g => g.twitterUserId === tweet.author.handle);
      if (!guardian) {
        console.warn(`Guardian not found for tweet author: ${tweet.author.handle}`);
        return false;
      }

      // Create case update content
      const updateContent = this.generateCaseUpdateContent(tweet, analysis);

      // TODO: Implement actual case update creation in Firestore
      // For now, we'll just log the update that would be created
      console.log(`Would create case update for guardian ${guardian.name}:`, {
        type: analysis.caseUpdateType,
        urgency: analysis.urgency,
        content: updateContent,
        source: 'twitter',
        tweetId: tweet.id,
      });

      return true;
    } catch (error) {
      console.error('Error creating case update:', error);
      return false;
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
    // TODO: Implement actual Twitter API integration
    // For now, return mock data for testing
    return [
      {
        id: `tweet_${Date.now()}_${guardian.id}`,
        content: `Mock tweet from ${guardian.name} about a rescue case update`,
        author: {
          name: guardian.name,
          handle: guardian.twitterHandle,
          profileImageUrl: 'https://via.placeholder.com/48',
        },
        metrics: {
          likes: Math.floor(Math.random() * 50),
          retweets: Math.floor(Math.random() * 20),
          replies: Math.floor(Math.random() * 10),
        },
        media: {
          images: [],
          videos: [],
        },
        createdAt: new Date(),
        fetchedAt: new Date(),
      },
    ];
  }

  /**
   * Get agent information
   */
  getAgentInfo(): AgentConfig {
    return this.config;
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    guardiansMonitored: number;
    lastRun?: Date;
    totalTweetsAnalyzed: number;
    totalCaseUpdatesCreated: number;
  } {
    return {
      guardiansMonitored: this.guardians.filter(g => g.isActive).length,
      totalTweetsAnalyzed: 0, // TODO: Track this
      totalCaseUpdatesCreated: 0, // TODO: Track this
    };
  }
}
