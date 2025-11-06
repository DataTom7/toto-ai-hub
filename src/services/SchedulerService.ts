import * as cron from 'node-cron';
import { TotoAI } from '../index';
import { GuardianInsightsService } from './GuardianInsightsService';
import { SocialMediaPostService } from './SocialMediaPostService';

export class SchedulerService {
  private totoAI: TotoAI;
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private guardianInsightsService: GuardianInsightsService;
  private socialMediaPostService: SocialMediaPostService;

  constructor(totoAI: TotoAI) {
    this.totoAI = totoAI;
    this.guardianInsightsService = new GuardianInsightsService();
    this.socialMediaPostService = new SocialMediaPostService();
  }

  /**
   * Start all scheduled tasks
   */
  startAll() {
    console.log('🕐 Starting scheduled tasks...');
    
    // Unified Social Media Monitoring - runs daily before midnight (23:30)
    this.scheduleSocialMediaMonitoring();
    
    // Twitter Agent - runs every 24 hours at 9:00 AM (legacy, kept for backward compatibility)
    // this.scheduleTwitterAgent();
    
    // For testing: Social Media Monitoring - runs every 5 minutes (comment out in production)
    // this.scheduleSocialMediaMonitoringTest();
    
    console.log('✅ All scheduled tasks started');
  }

  /**
   * Schedule Twitter Agent to run every 24 hours
   */
  private scheduleTwitterAgent() {
    const task = cron.schedule('0 9 * * *', async () => {
      console.log('🔄 Running scheduled Twitter Agent monitoring...');
      try {
        await this.runTwitterAgentMonitoring();
        console.log('✅ Twitter Agent monitoring completed successfully');
      } catch (error) {
        console.error('❌ Twitter Agent monitoring failed:', error);
      }
    }, {
      timezone: 'America/Argentina/Buenos_Aires' // Adjust timezone as needed
    });

    this.tasks.set('twitter-agent', task);
    task.start();
    console.log('📅 Twitter Agent scheduled to run daily at 9:00 AM (Argentina time)');
  }

  /**
   * Schedule Twitter Agent for testing (every 5 minutes)
   */
  private scheduleTwitterAgentTest() {
    const task = cron.schedule('*/5 * * * *', async () => {
      console.log('🧪 Running TEST Twitter Agent monitoring (every 5 minutes)...');
      try {
        await this.runTwitterAgentMonitoring();
        console.log('✅ TEST Twitter Agent monitoring completed successfully');
      } catch (error) {
        console.error('❌ TEST Twitter Agent monitoring failed:', error);
      }
    }, {
      timezone: 'America/Argentina/Buenos_Aires'
    });

    this.tasks.set('twitter-agent-test', task);
    task.start();
    console.log('🧪 TEST Twitter Agent scheduled to run every 5 minutes');
  }

  /**
   * Run Twitter Agent monitoring for all guardians
   */
  private async runTwitterAgentMonitoring() {
    const twitterAgent = this.totoAI.getTwitterAgent();
    
    // Ensure Twitter Agent is initialized with guardians
    if (!twitterAgent.getGuardians() || twitterAgent.getGuardians().length === 0) {
      console.log('🔄 Initializing Twitter Agent with guardians from database...');
      // No credentials needed for web scraping
      const dummyCredentials = {};
      await twitterAgent.initializeWithDatabase(dummyCredentials);
    }
    
    const guardians = twitterAgent.getGuardians();
    
    console.log(`🔍 Monitoring ${guardians.length} guardians...`);
    
    const results = {
      totalGuardians: guardians.length,
      successfulFetches: 0,
      totalTweets: 0,
      caseUpdates: 0,
      errors: 0,
      startTime: new Date(),
      endTime: null as Date | null
    };

    for (const guardian of guardians) {
      try {
        console.log(`📱 Fetching tweets for ${guardian.name} (@${guardian.twitterHandle})...`);
        
        const response = await twitterAgent.fetchRealTweets(guardian.id, 10);
        
        if (response.success) {
          results.successfulFetches++;
          results.totalTweets += response.tweets.length;
          results.caseUpdates += response.proposedActions.length;
          
          console.log(`✅ ${guardian.name}: ${response.tweets.length} tweets, ${response.proposedActions.length} proposed actions`);
        } else {
          results.errors++;
          console.log(`⚠️ ${guardian.name}: No tweets fetched`);
        }
      } catch (error) {
        results.errors++;
        console.error(`❌ Error monitoring ${guardian.name}:`, error);
      }
    }

    results.endTime = new Date();
    const duration = results.endTime.getTime() - results.startTime.getTime();
    
    console.log('📊 Twitter Agent Monitoring Summary:');
    console.log(`   Total Guardians: ${results.totalGuardians}`);
    console.log(`   Successful Fetches: ${results.successfulFetches}`);
    console.log(`   Total Tweets: ${results.totalTweets}`);
    console.log(`   Proposed Actions: ${results.caseUpdates}`);
    console.log(`   Errors: ${results.errors}`);
    console.log(`   Duration: ${Math.round(duration / 1000)}s`);
    
    return results;
  }

  /**
   * Stop all scheduled tasks
   */
  stopAll() {
    console.log('🛑 Stopping all scheduled tasks...');
    for (const [name, task] of this.tasks) {
      task.stop();
      console.log(`✅ Stopped task: ${name}`);
    }
    this.tasks.clear();
  }

  /**
   * Get status of all scheduled tasks
   */
  getStatus() {
    const status: Record<string, any> = {};
    for (const [name, task] of this.tasks) {
      status[name] = {
        running: task.getStatus() === 'scheduled',
        nextRun: null // node-cron doesn't provide nextDate method
      };
    }
    return status;
  }

  /**
   * Manually trigger Twitter Agent monitoring (legacy)
   */
  async triggerTwitterAgentMonitoring() {
    console.log('🚀 Manually triggering Twitter Agent monitoring...');
    return await this.runTwitterAgentMonitoring();
  }

  /**
   * Schedule unified social media monitoring (Twitter + Instagram)
   * Runs daily before midnight at 23:30
   */
  private scheduleSocialMediaMonitoring() {
    const task = cron.schedule('30 23 * * *', async () => {
      console.log('🔄 Running scheduled Social Media monitoring (Twitter + Instagram)...');
      try {
        await this.runSocialMediaMonitoring();
        console.log('✅ Social Media monitoring completed successfully');
      } catch (error) {
        console.error('❌ Social Media monitoring failed:', error);
      }
    }, {
      timezone: 'America/Argentina/Buenos_Aires'
    });

    this.tasks.set('social-media-monitoring', task);
    task.start();
    console.log('📅 Social Media monitoring scheduled to run daily at 23:30 (before midnight, Argentina time)');
  }

  /**
   * Unified social media monitoring method
   * Processes both Twitter and Instagram agents with batch processing
   */
  private async runSocialMediaMonitoring(filterGuardianId?: string, filterPlatform?: 'twitter' | 'instagram') {
    const results = {
      twitter: {
        totalGuardians: 0,
        successfulFetches: 0,
        totalPosts: 0,
        proposedActions: 0,
        errors: 0
      },
      instagram: {
        totalGuardians: 0,
        successfulFetches: 0,
        totalPosts: 0,
        proposedActions: 0,
        errors: 0
      },
      startTime: new Date(),
      endTime: null as Date | null
    };

    // Process Twitter Agent (skip if Instagram-only filter)
    if (filterPlatform !== 'instagram') {
    try {
      const twitterAgent = this.totoAI.getTwitterAgent();
      // If filtering by guardianId, always re-initialize to ensure only that guardian is loaded
      if (filterGuardianId) {
        const dummyCredentials = {};
        await twitterAgent.initializeWithDatabase(dummyCredentials, filterGuardianId);
      } else if (!twitterAgent.getGuardians() || twitterAgent.getGuardians().length === 0) {
        const dummyCredentials = {};
        await twitterAgent.initializeWithDatabase(dummyCredentials);
      }

      let twitterGuardians = twitterAgent.getGuardians();
      
      // Additional filter check (should already be filtered if guardianId was provided)
      if (filterGuardianId) {
        twitterGuardians = twitterGuardians.filter(g => g.id === filterGuardianId);
      }
      
      results.twitter.totalGuardians = twitterGuardians.length;

      if (twitterGuardians.length > 0) {
        await this.processGuardiansInBatches(
          twitterGuardians,
          async (guardian) => {
            try {
              const response = await twitterAgent.fetchRealTweets(guardian.id, 10);
              
              if (response.success && response.tweets.length > 0) {
                results.twitter.successfulFetches++;
                const tweetsFetched = response.tweets.length;
                
                // Analyze the tweets to add them to review queue
                const analysisResult = await twitterAgent.analyzeTweetsAndCreateUpdates(response.tweets, guardian.id);
                if (analysisResult.success) {
                  const tweetsAnalyzed = analysisResult.tweetsAnalyzed || 0;
                  const postsCreated = analysisResult.postsCreated || 0;
                  results.twitter.totalPosts += tweetsAnalyzed;
                  results.twitter.proposedActions += postsCreated;
                }
              } else {
                results.twitter.errors++;
              }
            } catch (error) {
              results.twitter.errors++;
              console.error(`Error monitoring ${guardian.name}:`, error);
            }
          },
          'Twitter'
        );
      }
    } catch (error) {
      console.error('❌ Error in Twitter Agent monitoring:', error);
      results.twitter.errors++;
    }
    } // End Twitter-only filter

    // Process Instagram Agent (skip if Twitter-only filter)
    if (filterPlatform !== 'twitter') {
    try {
      const instagramAgent = this.totoAI.getInstagramAgent();
      // If filtering by guardianId, always re-initialize to ensure only that guardian is loaded
      if (filterGuardianId) {
        const dummyCredentials = {};
        await instagramAgent.initializeWithDatabase(dummyCredentials, filterGuardianId);
      } else if (!instagramAgent.getGuardians() || instagramAgent.getGuardians().length === 0) {
        const dummyCredentials = {};
        await instagramAgent.initializeWithDatabase(dummyCredentials);
      }

      let instagramGuardians = instagramAgent.getGuardians();
      
      // Additional filter check (should already be filtered if guardianId was provided)
      if (filterGuardianId) {
        instagramGuardians = instagramGuardians.filter(g => g.id === filterGuardianId);
      }
      
      results.instagram.totalGuardians = instagramGuardians.length;

      if (instagramGuardians.length > 0) {
        try {
          // Pass guardianId filter to Instagram agent if filtering by specific guardian
          const response = await instagramAgent.runMonitoringCycle(filterGuardianId);
          
          if (response.success) {
            results.instagram.successfulFetches = instagramGuardians.length;
            const postsAnalyzed = response.postsAnalyzed || 0;
            const postsCreated = response.postsCreated || 0;
            results.instagram.totalPosts = postsAnalyzed;
            results.instagram.proposedActions = postsCreated;
          } else {
            results.instagram.errors++;
          }
        } catch (error) {
          results.instagram.errors++;
          console.error(`Error in Instagram monitoring:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error in Instagram Agent monitoring:', error);
      results.instagram.errors++;
    }
    } // End Instagram-only filter

    results.endTime = new Date();
    const duration = results.endTime.getTime() - results.startTime.getTime();

    // Calculate total posts analyzed vs created
    const totalPostsAnalyzed = results.twitter.totalPosts + results.instagram.totalPosts;
    const totalPostsCreated = results.twitter.proposedActions + results.instagram.proposedActions;
    
    console.log(`✅ Monitoring completed: ${totalPostsAnalyzed} analyzed, ${totalPostsCreated} saved`);

    // Extract guardian insights from posts (async, don't block)
    if (results.twitter.totalPosts > 0 || results.instagram.totalPosts > 0) {
      this.extractGuardianInsights(filterGuardianId).catch(error => {
        console.error('Error extracting guardian insights:', error);
      });
    }

    // Return results with postsAnalyzed and postsCreated for API response
    return {
      ...results,
      postsAnalyzed: totalPostsAnalyzed,
      postsCreated: totalPostsCreated, // This is the number of posts saved to review queue/Firestore
    };
  }

  /**
   * Process guardians in batches with delays to avoid rate limits
   * Batch size: 5 guardians, delay: 2 minutes between batches
   */
  private async processGuardiansInBatches<T extends { id: string; name: string }>(
    guardians: T[],
    processFn: (guardian: T) => Promise<void>,
    platform: string
  ): Promise<void> {
    const BATCH_SIZE = 5;
    const DELAY_BETWEEN_BATCHES_MS = 2 * 60 * 1000; // 2 minutes

    for (let i = 0; i < guardians.length; i += BATCH_SIZE) {
      const batch = guardians.slice(i, i + BATCH_SIZE);
      console.log(`   Processing ${platform} batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} guardians)...`);

      // Process batch in parallel
      await Promise.all(batch.map(guardian => processFn(guardian)));

      // Delay between batches (except for the last batch)
      if (i + BATCH_SIZE < guardians.length) {
        console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES_MS / 1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    console.log(`✅ Completed ${platform} processing for all ${guardians.length} guardians`);
  }

  /**
   * Extract guardian insights from recently saved posts
   */
  private async extractGuardianInsights(filterGuardianId?: string): Promise<void> {
    try {
      if (!this.socialMediaPostService) {
        console.warn('⚠️ SocialMediaPostService not available - skipping insights extraction');
        return;
      }

      // Get all guardians that were monitored
      const guardians: Array<{ id: string; name: string }> = [];
      
      if (filterGuardianId) {
        // Get specific guardian
        const twitterAgent = this.totoAI.getTwitterAgent();
        const instagramAgent = this.totoAI.getInstagramAgent();
        const twitterGuardians = twitterAgent.getGuardians().filter(g => g.id === filterGuardianId);
        const instagramGuardians = instagramAgent.getGuardians().filter(g => g.id === filterGuardianId);
        guardians.push(...twitterGuardians, ...instagramGuardians);
      } else {
        // Get all guardians
        const twitterAgent = this.totoAI.getTwitterAgent();
        const instagramAgent = this.totoAI.getInstagramAgent();
        guardians.push(...twitterAgent.getGuardians(), ...instagramAgent.getGuardians());
      }

      // Remove duplicates
      const uniqueGuardians = Array.from(new Map(guardians.map(g => [g.id, g])).values());

      console.log(`🔍 Processing insights for ${uniqueGuardians.length} guardian(s)...`);

      for (const guardian of uniqueGuardians) {
        try {
          // Fetch recent posts for this guardian (last 30 days)
          const posts = await this.socialMediaPostService.getPosts({
            guardianId: guardian.id,
            limit: 100 // Get up to 100 recent posts
          });

          if (posts.length === 0) {
            console.log(`   ⚠️ No posts found for ${guardian.name} - skipping`);
            continue;
          }

          console.log(`   📊 Processing ${posts.length} posts for ${guardian.name}...`);

          // Process posts to extract insights
          const postsForProcessing = posts.map(p => ({
            id: p.postId,
            platform: p.platform,
            postContent: p.postContent,
            postUrl: p.postUrl,
            createdAt: p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt as any)
          }));

          await this.guardianInsightsService.processGuardianPosts(
            guardian.id,
            postsForProcessing
          );

          console.log(`   ✅ Extracted insights for ${guardian.name}`);
        } catch (error) {
          console.error(`   ❌ Error processing insights for ${guardian.name}:`, error);
        }
      }

      console.log('✅ Guardian insights extraction completed');
    } catch (error) {
      console.error('❌ Error in guardian insights extraction:', error);
    }
  }

  /**
   * Manually trigger social media monitoring
   * @param guardianId Optional guardian ID to filter monitoring to a specific guardian
   * @param platform Optional platform to filter monitoring ('twitter' or 'instagram')
   */
  async triggerSocialMediaMonitoring(guardianId?: string, platform?: 'twitter' | 'instagram') {
    if (guardianId) {
      console.log(`🚀 Manually triggering Social Media monitoring for guardian: ${guardianId}${platform ? ` (${platform} only)` : ''}...`);
    } else {
      console.log(`🚀 Manually triggering Social Media monitoring for all guardians${platform ? ` (${platform} only)` : ''}...`);
    }
    return await this.runSocialMediaMonitoring(guardianId, platform);
  }
}
