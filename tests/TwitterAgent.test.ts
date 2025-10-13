import { TwitterAgent } from '../src/agents/TwitterAgent';
import { TwitterCredentials, Guardian, TweetData } from '../src/agents/TwitterAgent';

describe('TwitterAgent', () => {
  let twitterAgent: TwitterAgent;
  let mockCredentials: TwitterCredentials;
  let mockGuardians: Guardian[];

  beforeEach(() => {
    twitterAgent = new TwitterAgent();
    
    mockCredentials = {
      apiKey: 'test_api_key',
      apiSecret: 'test_api_secret',
      accessToken: 'test_access_token',
      accessTokenSecret: 'test_access_token_secret'
    };

    mockGuardians = [
      {
        id: 'guardian_1',
        name: 'Maria Fernandez',
        twitterHandle: 'maria_fernandez',
        twitterUserId: '123456789',
        isActive: true,
        lastTweetFetch: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  });

  describe('Initialization', () => {
    it('should initialize with credentials and guardians', async () => {
      await twitterAgent.initialize(mockCredentials, mockGuardians);
      
      const stats = twitterAgent.getMonitoringStats();
      expect(stats.guardiansMonitored).toBe(1);
    });

    it('should throw error when running without initialization', async () => {
      await expect(twitterAgent.runMonitoringCycle()).rejects.toThrow('Twitter credentials not initialized');
    });
  });

  describe('Agent Info', () => {
    it('should return correct agent configuration', () => {
      const agentInfo = twitterAgent.getAgentInfo();
      
      expect(agentInfo.name).toBe('TwitterAgent');
      expect(agentInfo.description).toContain('Monitors guardian Twitter accounts');
      expect(agentInfo.capabilities).toContain('tweet_fetching');
      expect(agentInfo.capabilities).toContain('content_analysis');
      expect(agentInfo.capabilities).toContain('case_update_creation');
    });
  });

  describe('Monitoring Stats', () => {
    it('should return monitoring statistics', () => {
      const stats = twitterAgent.getMonitoringStats();
      
      expect(stats).toHaveProperty('guardiansMonitored');
      expect(stats).toHaveProperty('totalTweetsAnalyzed');
      expect(stats).toHaveProperty('totalCaseUpdatesCreated');
    });
  });

  describe('Tweet Analysis', () => {
    it('should analyze tweets and create case updates', async () => {
      await twitterAgent.initialize(mockCredentials, mockGuardians);
      
      const mockTweets: TweetData[] = [
        {
          id: 'tweet_1',
          content: 'Emergency! Luna needs immediate surgery for her broken leg. Please help!',
          author: {
            name: 'Maria Fernandez',
            handle: 'maria_fernandez',
            profileImageUrl: 'https://example.com/avatar.jpg'
          },
          metrics: {
            likes: 10,
            retweets: 5,
            replies: 3
          },
          media: {
            images: [],
            videos: []
          },
          createdAt: new Date(),
          fetchedAt: new Date()
        }
      ];

      const result = await twitterAgent.analyzeTweetsAndCreateUpdates(mockTweets);
      
      expect(result.success).toBe(true);
      expect(result.tweetsAnalyzed).toBe(1);
      expect(result.analysisResults).toHaveLength(1);
    });
  });

  describe('Monitoring Cycle', () => {
    it('should run complete monitoring cycle', async () => {
      await twitterAgent.initialize(mockCredentials, mockGuardians);
      
      const result = await twitterAgent.runMonitoringCycle();
      
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('tweetsAnalyzed');
      expect(result).toHaveProperty('caseUpdatesCreated');
      expect(result).toHaveProperty('metadata');
    });
  });
});



