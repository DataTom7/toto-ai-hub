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
    
    // Twitter Agent - runs every 24 hours at 9:00 AM
    this.scheduleTwitterAgent();
    
    // For testing: Twitter Agent - runs every 5 minutes (comment out in production)
    this.scheduleTwitterAgentTest();
    
    // Add more scheduled tasks here as needed
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
   * Manually trigger Twitter Agent monitoring
   */
  async triggerTwitterAgentMonitoring() {
    console.log('🚀 Manually triggering Twitter Agent monitoring...');
    return await this.runTwitterAgentMonitoring();
  }
}
