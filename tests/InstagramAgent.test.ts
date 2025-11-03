import { InstagramAgent } from '../src/agents/InstagramAgent';
import { InstagramCredentials, Guardian, InstagramPost } from '../src/agents/InstagramAgent';

describe('InstagramAgent', () => {
  let instagramAgent: InstagramAgent;
  let mockCredentials: InstagramCredentials;
  let mockGuardians: Guardian[];

  beforeEach(() => {
    instagramAgent = new InstagramAgent();
    
    mockCredentials = {};

    mockGuardians = [
      {
        id: 'guardian_1',
        name: 'Maria Fernandez',
        instagramHandle: 'maria_fernandez',
        instagramUserId: undefined,
        accessToken: undefined,
        isActive: true,
        lastPostFetch: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  });

  describe('Initialization', () => {
    it('should initialize with credentials and guardians', async () => {
      await instagramAgent.initialize(mockCredentials, mockGuardians);
      
      const stats = instagramAgent.getMonitoringStats();
      expect(stats.guardiansMonitored).toBe(1);
    });

    it('should get guardians after initialization', async () => {
      await instagramAgent.initialize(mockCredentials, mockGuardians);
      
      const guardians = instagramAgent.getGuardians();
      expect(guardians).toHaveLength(1);
      expect(guardians[0].name).toBe('Maria Fernandez');
    });
  });

  describe('Agent Info', () => {
    it('should return correct agent configuration', () => {
      const agentInfo = instagramAgent.getAgentInfo();
      
      expect(agentInfo.name).toBe('InstagramAgent');
      expect(agentInfo.description).toContain('Monitors guardian Instagram accounts');
      expect(agentInfo.capabilities).toContain('post_fetching');
      expect(agentInfo.capabilities).toContain('content_analysis');
      expect(agentInfo.capabilities).toContain('case_update_creation');
      expect(agentInfo.capabilities).toContain('visual_content_analysis');
    });
  });

  describe('Monitoring Stats', () => {
    it('should return monitoring statistics', () => {
      const stats = instagramAgent.getMonitoringStats();
      
      expect(stats).toHaveProperty('guardiansMonitored');
      expect(stats).toHaveProperty('totalPostsAnalyzed');
      expect(stats).toHaveProperty('totalCaseUpdatesCreated');
      expect(stats).toHaveProperty('casesCreatedToday');
    });
  });

  describe('Post Analysis', () => {
    it('should analyze posts and create case updates', async () => {
      await instagramAgent.initialize(mockCredentials, mockGuardians);
      
      const mockPosts: InstagramPost[] = [
        {
          id: 'post_1',
          caption: 'Emergency! Luna needs immediate surgery for her broken leg. Please help! 🚨',
          author: {
            name: 'Maria Fernandez',
            username: 'maria_fernandez',
            profileImageUrl: 'https://example.com/avatar.jpg'
          },
          media: {
            images: ['https://example.com/luna1.jpg'],
            videos: [],
            carousel: []
          },
          metrics: {
            likes: 10,
            comments: 5,
            shares: 3,
            saves: 2
          },
          hashtags: ['#rescuedog', '#petrescue'],
          mentions: [],
          createdAt: new Date(),
          fetchedAt: new Date()
        }
      ];

      const result = await instagramAgent.analyzePostsAndCreateUpdates(mockPosts);
      
      expect(result.success).toBe(true);
      expect(result.postsAnalyzed).toBe(1);
      expect(result.analysisResults).toHaveLength(1);
    });

    it('should handle posts with visual content', async () => {
      await instagramAgent.initialize(mockCredentials, mockGuardians);
      
      const mockPost: InstagramPost[] = [
        {
          id: 'post_2',
          caption: 'Luna is recovering well after surgery! Here are some updates.',
          author: {
            name: 'Maria Fernandez',
            username: 'maria_fernandez',
            profileImageUrl: 'https://example.com/avatar.jpg'
          },
          media: {
            images: ['https://example.com/luna_recovery1.jpg', 'https://example.com/luna_recovery2.jpg'],
            videos: ['https://example.com/luna_video.mp4'],
            carousel: []
          },
          metrics: {
            likes: 25,
            comments: 8,
            shares: 5,
            saves: 10
          },
          hashtags: ['#petrecovery', '#rescuesuccess'],
          mentions: [],
          createdAt: new Date(),
          fetchedAt: new Date()
        }
      ];

      const result = await instagramAgent.analyzePostsAndCreateUpdates(mockPost);
      
      expect(result.success).toBe(true);
      expect(result.analysisResults).toBeDefined();
    });
  });

  describe('Review Queue', () => {
    it('should get review queue status', () => {
      const status = instagramAgent.getReviewQueueStatus();
      
      expect(status).toHaveProperty('totalItems');
      expect(status).toHaveProperty('pendingItems');
      expect(status).toHaveProperty('approvedItems');
      expect(status).toHaveProperty('rejectedItems');
    });

    it('should get review queue items', () => {
      const items = instagramAgent.getReviewQueueItems();
      
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe('Guardian Management', () => {
    it('should update guardian', async () => {
      await instagramAgent.initialize(mockCredentials, mockGuardians);
      
      const result = instagramAgent.updateGuardian('guardian_1', { isActive: false });
      
      expect(result.success).toBe(true);
      
      const guardians = instagramAgent.getGuardians();
      expect(guardians[0].isActive).toBe(false);
    });

    it('should return error when updating non-existent guardian', () => {
      const result = instagramAgent.updateGuardian('non_existent', { isActive: false });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Configuration', () => {
    it('should get configuration', () => {
      const config = instagramAgent.getConfiguration();
      
      expect(config).toHaveProperty('name', 'InstagramAgent');
      expect(config).toHaveProperty('instagramCredentials');
      expect(config).toHaveProperty('caseCreationPolicy');
    });

    it('should update configuration', () => {
      const newConfig = {
        monitoringInterval: 120,
        maxPostsPerFetch: 20
      };
      
      const result = instagramAgent.updateConfiguration(newConfig);
      
      expect(result.success).toBe(true);
      
      const updatedConfig = instagramAgent.getConfiguration();
      expect(updatedConfig.monitoringInterval).toBe(120);
      expect(updatedConfig.maxPostsPerFetch).toBe(20);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        caseCreationPolicy: {
          enabled: true,
          requireApproval: true,
          minConfidence: 1.5, // Invalid: should be 0-1
          maxCasesPerDay: 5
        }
      };
      
      const result = instagramAgent.updateConfiguration(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Confidence threshold');
    });
  });

  describe('Monitoring Cycle', () => {
    it('should handle empty guardian list gracefully', async () => {
      await instagramAgent.initialize(mockCredentials, []);
      
      const result = await instagramAgent.runMonitoringCycle();
      
      expect(result.success).toBe(true);
      expect(result.postsAnalyzed).toBe(0);
    });
  });
});
