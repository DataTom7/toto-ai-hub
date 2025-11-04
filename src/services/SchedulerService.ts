import * as cron from 'node-cron';
import { TotoAI } from '../index';

export class SchedulerService {
  private totoAI: TotoAI;
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  constructor(totoAI: TotoAI) {
    this.totoAI = totoAI;
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
      if (!twitterAgent.getGuardians() || twitterAgent.getGuardians().length === 0) {
        console.log('🔄 Initializing Twitter Agent with guardians from database...');
        const dummyCredentials = {};
        await twitterAgent.initializeWithDatabase(dummyCredentials);
      }

      let twitterGuardians = twitterAgent.getGuardians();
      
      // Filter by guardian ID if specified
      if (filterGuardianId) {
        twitterGuardians = twitterGuardians.filter(g => g.id === filterGuardianId);
        console.log(`🔍 Filtered to ${twitterGuardians.length} Twitter guardian(s) matching ID: ${filterGuardianId}`);
      }
      
      results.twitter.totalGuardians = twitterGuardians.length;

      if (twitterGuardians.length > 0) {
        console.log(`🔍 Processing ${twitterGuardians.length} Twitter guardians in batches...`);
        await this.processGuardiansInBatches(
          twitterGuardians,
          async (guardian) => {
            try {
              console.log(`📱 Fetching tweets for ${guardian.name} (@${guardian.twitterHandle})...`);
              const response = await twitterAgent.fetchRealTweets(guardian.id, 10);
              
              if (response.success && response.tweets.length > 0) {
                results.twitter.successfulFetches++;
                results.twitter.totalPosts += response.tweets.length;
                console.log(`✅ ${guardian.name}: ${response.tweets.length} tweets fetched`);
                
                // Analyze the tweets to add them to review queue
                // Pass guardian.id so we don't need to match by handle (which can fail!)
                console.log(`🔍 Analyzing ${response.tweets.length} tweets for ${guardian.name} (ID: ${guardian.id})...`);
                const analysisResult = await twitterAgent.analyzeTweetsAndCreateUpdates(response.tweets, guardian.id);
                if (analysisResult.success) {
                  results.twitter.proposedActions += analysisResult.tweetsAnalyzed || 0;
                  console.log(`✅ ${guardian.name}: ${analysisResult.tweetsAnalyzed || 0} tweets analyzed and added to review queue`);
                } else {
                  console.warn(`⚠️ ${guardian.name}: Analysis failed - ${analysisResult.error || 'Unknown error'}`);
                }
              } else {
                results.twitter.errors++;
                console.log(`⚠️ ${guardian.name}: No tweets fetched`);
              }
            } catch (error) {
              results.twitter.errors++;
              console.error(`❌ Error monitoring ${guardian.name}:`, error);
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
      if (!instagramAgent.getGuardians() || instagramAgent.getGuardians().length === 0) {
        console.log('🔄 Initializing Instagram Agent with guardians from database...');
        const dummyCredentials = {};
        await instagramAgent.initializeWithDatabase(dummyCredentials);
      }

      let instagramGuardians = instagramAgent.getGuardians();
      
      // Filter by guardian ID if specified
      if (filterGuardianId) {
        instagramGuardians = instagramGuardians.filter(g => g.id === filterGuardianId);
        console.log(`🔍 Filtered to ${instagramGuardians.length} Instagram guardian(s) matching ID: ${filterGuardianId}`);
      }
      
      results.instagram.totalGuardians = instagramGuardians.length;

      if (instagramGuardians.length > 0) {
        console.log(`🔍 Processing ${instagramGuardians.length} Instagram guardians...`);
        if (filterGuardianId) {
          console.log(`   📌 Passing guardianId filter to Instagram agent: "${filterGuardianId}"`);
        } else {
          console.log(`   ⚠️ NO guardianId filter - will process ALL guardians`);
        }
        try {
          // Pass guardianId filter to Instagram agent if filtering by specific guardian
          const response = await instagramAgent.runMonitoringCycle(filterGuardianId);
          
          if (response.success) {
            results.instagram.successfulFetches = instagramGuardians.length;
            results.instagram.totalPosts = response.postsAnalyzed || 0;
            results.instagram.proposedActions = response.caseUpdatesCreated || 0;
            console.log(`✅ Instagram: ${response.postsAnalyzed || 0} posts analyzed, ${response.caseUpdatesCreated || 0} actions created`);
          } else {
            results.instagram.errors++;
            console.log(`⚠️ Instagram monitoring failed: ${response.error || 'Unknown error'}`);
          }
        } catch (error) {
          results.instagram.errors++;
          console.error(`❌ Error in Instagram monitoring:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error in Instagram Agent monitoring:', error);
      results.instagram.errors++;
    }
    } // End Instagram-only filter

    results.endTime = new Date();
    const duration = results.endTime.getTime() - results.startTime.getTime();

    console.log('📊 Social Media Monitoring Summary:');
    console.log(`   Twitter: ${results.twitter.totalGuardians} guardians, ${results.twitter.successfulFetches} successful, ${results.twitter.totalPosts} posts, ${results.twitter.proposedActions} actions`);
    console.log(`   Instagram: ${results.instagram.totalGuardians} guardians, ${results.instagram.successfulFetches} successful, ${results.instagram.totalPosts} posts, ${results.instagram.proposedActions} actions`);
    console.log(`   Total Duration: ${Math.round(duration / 1000)}s`);

    return results;
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
