/**
 * LinkedIn Outreach Service
 *
 * Unified workflow that mimics human browsing behavior:
 * 1. Visit profile
 * 2. Analyze (activity, location, engagement)
 * 3. Qualify (score against criteria)
 * 4. If qualified → Send message immediately
 * 5. Move to next contact
 *
 * This is MORE human-like than:
 * - Visiting 500 profiles first
 * - Then coming back to message 200 of them
 */

import { Page } from 'puppeteer';
import { linkedInAuthService } from './LinkedInAuthService';
import { humanBehaviorService } from './HumanBehaviorService';
import { locationParserService } from './LocationParserService';
import { contactScoringService } from './ContactScoringService';
import { linkedInDataExportService } from './LinkedInDataExportService';
import { linkedInConfig, linkedInSelectors, linkedInUrls } from '../../config/linkedin.config';
import { targetingConfig } from '../../config/targeting.config';
import {
  LinkedInContact,
  ContactScores,
  MessageTemplate,
  ActivityLevel,
} from '../../types/linkedin.types';

interface OutreachResult {
  contactId: string;
  profileUrl: string;
  fullName: string;
  status: 'messaged' | 'skipped_region' | 'skipped_inactive' | 'skipped_score' | 'skipped_already_messaged' | 'error';
  score?: number;
  skipReason?: string;
  messageSent?: boolean;
  error?: string;
}

interface OutreachSession {
  sessionId: string;
  startTime: Date;
  endTime: Date | null;
  contactsProcessed: number;
  messageseSent: number;
  skipped: number;
  errors: number;
  status: 'active' | 'paused' | 'completed' | 'error';
}

interface OutreachProgress {
  totalCandidates: number;
  processed: number;
  messaged: number;
  skipped: number;
  errors: number;
  currentContact: string | null;
  isRunning: boolean;
  dailyMessagesRemaining: number;
}

export class LinkedInOutreachService {
  private session: OutreachSession | null = null;
  private results: OutreachResult[] = [];
  private isRunning: boolean = false;
  private shouldStop: boolean = false;
  private dailyMessageCount: number = 0;
  private dailyCountResetDate: Date = new Date();
  private messageTemplates: MessageTemplate[] = [];

  constructor() {
    console.log('LinkedInOutreachService initialized');
    this.loadDefaultTemplates();
  }

  /**
   * Load default message templates
   */
  private loadDefaultTemplates(): void {
    this.messageTemplates = [
      {
        id: 'reconnect_1',
        name: 'Simple Reconnect',
        category: 'reconnect',
        variations: [
          'Hi {firstName}, hope you\'re doing well! It\'s been a while since we connected. Would love to catch up sometime.',
          'Hey {firstName}! I was going through my connections and thought I\'d reach out. How have you been?',
          '{firstName} - hope all is well on your end! Just wanted to say hi and see what you\'ve been up to lately.',
        ],
        variables: ['firstName'],
        createdAt: new Date(),
        usageCount: 0,
        responseRate: null,
      },
      {
        id: 'reconnect_2',
        name: 'Professional Reconnect',
        category: 'reconnect',
        variations: [
          'Hi {firstName}, I noticed we\'ve been connected for a while but haven\'t had a chance to chat. I\'d love to learn more about what you\'re working on at {company}.',
          'Hey {firstName}, hope things are going well at {company}! I\'ve been meaning to reach out - would be great to connect properly.',
        ],
        variables: ['firstName', 'company'],
        createdAt: new Date(),
        usageCount: 0,
        responseRate: null,
      },
    ];
  }

  /**
   * Get outreach progress
   */
  getProgress(): OutreachProgress {
    this.checkDailyLimit();

    return {
      totalCandidates: 0, // Set by caller
      processed: this.results.length,
      messaged: this.results.filter(r => r.status === 'messaged').length,
      skipped: this.results.filter(r => r.status.startsWith('skipped')).length,
      errors: this.results.filter(r => r.status === 'error').length,
      currentContact: null,
      isRunning: this.isRunning,
      dailyMessagesRemaining: linkedInConfig.maxMessagesPerDay - this.dailyMessageCount,
    };
  }

  /**
   * Run outreach on a list of contacts
   * This is the main entry point for the unified workflow
   */
  async runOutreach(
    contacts: Partial<LinkedInContact>[],
    options?: {
      messageTemplate?: MessageTemplate;
      dryRun?: boolean;
      maxMessages?: number;
      onProgress?: (result: OutreachResult) => void;
    }
  ): Promise<{ success: boolean; results: OutreachResult[]; error?: string }> {

    if (this.isRunning) {
      return { success: false, results: [], error: 'Outreach already running' };
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.results = [];

    const template = options?.messageTemplate || this.messageTemplates[0];
    const maxMessages = options?.maxMessages || linkedInConfig.maxMessagesPerDay;
    const dryRun = options?.dryRun ?? linkedInConfig.dryRunMode;

    this.session = {
      sessionId: `outreach_${Date.now()}`,
      startTime: new Date(),
      endTime: null,
      contactsProcessed: 0,
      messageseSent: 0,
      skipped: 0,
      errors: 0,
      status: 'active',
    };

    console.log('='.repeat(60));
    console.log('LINKEDIN OUTREACH SESSION');
    console.log('='.repeat(60));
    console.log(`Candidates: ${contacts.length}`);
    console.log(`Max messages: ${maxMessages}`);
    console.log(`Dry run: ${dryRun}`);
    console.log(`Template: ${template.name}`);
    console.log('='.repeat(60));

    try {
      // Start behavior session
      humanBehaviorService.startSession();

      // Maybe browse feed first (looks natural)
      if (humanBehaviorService.shouldScrollFeed()) {
        await this.browseFeedNaturally();
      }

      let messagesent = 0;

      for (const contact of contacts) {
        // Check stop conditions
        if (this.shouldStop) {
          console.log('Outreach stopped by user');
          break;
        }

        this.checkDailyLimit();
        if (this.dailyMessageCount >= linkedInConfig.maxMessagesPerDay) {
          console.log('Daily message limit reached');
          break;
        }

        if (messagesent >= maxMessages) {
          console.log('Max messages for this session reached');
          break;
        }

        // Check session duration
        if (humanBehaviorService.shouldEndSession()) {
          console.log('Session duration reached, taking a break...');
          await this.takeBreak();
          humanBehaviorService.startSession();
        }

        // Maybe take a short break
        if (humanBehaviorService.shouldTakeBreak()) {
          const breakTime = humanBehaviorService.getRandomDelay(30000, 90000);
          console.log(`Taking a short break (${humanBehaviorService.formatDuration(breakTime)})...`);
          await humanBehaviorService.sleep(breakTime);
        }

        // Process this contact
        const result = await this.processContact(contact, template, dryRun);
        this.results.push(result);

        if (result.status === 'messaged') {
          messagesent++;
          this.dailyMessageCount++;
          this.session.messageseSent++;
        } else if (result.status === 'error') {
          this.session.errors++;
        } else {
          this.session.skipped++;
        }

        this.session.contactsProcessed++;

        // Report progress
        if (options?.onProgress) {
          options.onProgress(result);
        }

        console.log(`[${this.results.length}/${contacts.length}] ${contact.fullName}: ${result.status}`);

        // Natural delay before next contact
        const delay = humanBehaviorService.getRandomDelay(5000, 15000);
        await humanBehaviorService.sleep(delay);

        // Occasionally do something natural
        if (Math.random() < 0.1) {
          await this.doSomethingNatural();
        }
      }

      this.session.endTime = new Date();
      this.session.status = 'completed';
      this.isRunning = false;

      console.log('\n' + '='.repeat(60));
      console.log('OUTREACH SESSION COMPLETE');
      console.log('='.repeat(60));
      console.log(`Processed: ${this.session.contactsProcessed}`);
      console.log(`Messaged: ${this.session.messageseSent}`);
      console.log(`Skipped: ${this.session.skipped}`);
      console.log(`Errors: ${this.session.errors}`);
      console.log('='.repeat(60));

      return { success: true, results: this.results };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Outreach error:', errorMessage);

      if (this.session) {
        this.session.status = 'error';
        this.session.endTime = new Date();
      }

      this.isRunning = false;
      return { success: false, results: this.results, error: errorMessage };
    }
  }

  /**
   * Process a single contact: visit → analyze → qualify → maybe message
   */
  private async processContact(
    contact: Partial<LinkedInContact>,
    template: MessageTemplate,
    dryRun: boolean
  ): Promise<OutreachResult> {
    const result: OutreachResult = {
      contactId: contact.linkedInId || '',
      profileUrl: contact.profileUrl || '',
      fullName: contact.fullName || '',
      status: 'error',
    };

    try {
      // Skip if already messaged
      if (contact.hasMessaged) {
        result.status = 'skipped_already_messaged';
        result.skipReason = 'Already messaged this contact';
        return result;
      }

      // Navigate to profile
      const profileUrl = contact.profileUrl || `https://www.linkedin.com/in/${contact.publicIdentifier}`;
      const navResult = await linkedInAuthService.navigateTo(profileUrl);

      if (!navResult.success) {
        result.status = 'error';
        result.error = navResult.error;
        return result;
      }

      const page = await linkedInAuthService.getPage();

      // Wait for profile to load
      await humanBehaviorService.randomSleep(2000, 4000);

      // Extract and analyze profile data
      const profileData = await this.extractProfileData(page);

      // Build full contact with analysis
      const fullContact = this.buildFullContact(contact, profileData);

      // Check region filter FIRST (quick skip)
      if (!fullContact.location.isTargetRegion && fullContact.location.confidence > 0.5) {
        result.status = 'skipped_region';
        result.skipReason = `Outside target region: ${fullContact.location.country || fullContact.location.raw}`;

        // Still spend some time on profile (looks natural)
        await this.simulateReading(page, 3000, 8000);
        return result;
      }

      // Check activity filter
      const { maxInactiveDays } = targetingConfig.activityThreshold;
      if (fullContact.activity.daysSinceActivity !== null &&
          fullContact.activity.daysSinceActivity > maxInactiveDays) {
        result.status = 'skipped_inactive';
        result.skipReason = `Inactive for ${fullContact.activity.daysSinceActivity} days`;

        await this.simulateReading(page, 3000, 8000);
        return result;
      }

      // Score the contact
      const scores = contactScoringService.scoreContact(fullContact as LinkedInContact);
      result.score = scores.totalScore;

      // Check if qualifies
      if (scores.priority === 'skip') {
        result.status = 'skipped_score';
        result.skipReason = `Score too low: ${scores.totalScore.toFixed(1)}`;

        await this.simulateReading(page, 5000, 12000);
        return result;
      }

      // QUALIFIED! Spend time reading profile (natural behavior)
      console.log(`  ✓ Qualified (score: ${scores.totalScore.toFixed(1)}, priority: ${scores.priority})`);
      await this.simulateReading(page, 8000, 20000);

      // Prepare personalized message
      const message = this.personalizeMessage(template, fullContact);

      // Send message (or simulate in dry run)
      if (dryRun) {
        console.log(`  [DRY RUN] Would send: "${message.substring(0, 50)}..."`);
        result.status = 'messaged';
        result.messageSent = false;
      } else {
        const sendResult = await this.sendMessage(page, message);
        if (sendResult.success) {
          result.status = 'messaged';
          result.messageSent = true;
        } else {
          result.status = 'error';
          result.error = sendResult.error;
        }
      }

      return result;

    } catch (error) {
      result.status = 'error';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      return result;
    }
  }

  /**
   * Extract profile data from current page
   */
  private async extractProfileData(page: Page): Promise<any> {
    const selectors = linkedInSelectors.profile;

    return await page.evaluate((sels) => {
      const getText = (selector: string): string => {
        const el = document.querySelector(selector);
        return el?.textContent?.trim() || '';
      };

      const exists = (selector: string): boolean => {
        return document.querySelector(selector) !== null;
      };

      // Basic info
      const fullName = getText(sels.name);
      const headline = getText(sels.headline);
      const location = getText(sels.location);

      // Profile completeness
      const photoElement = document.querySelector(sels.profilePhoto);
      let hasPhoto = false;
      if (photoElement) {
        const src = photoElement.getAttribute('src') || '';
        hasPhoto = !src.includes('ghost') && !src.includes('default');
      }

      // About section
      const aboutSection = document.querySelector('#about');
      const hasAboutSection = aboutSection !== null;

      // Experience
      const experienceSection = document.querySelector('#experience');
      let experienceCount = 0;
      if (experienceSection) {
        experienceCount = experienceSection.parentElement?.querySelectorAll('li').length || 0;
      }

      // Engagement indicators
      const isPremium = exists(sels.premiumBadge);
      const isCreator = exists(sels.creatorBadge);
      const isOpenToMessages = exists(sels.messageButton);

      // Connection degree
      let connectionDegree: '1st' | '2nd' | '3rd' | 'out_of_network' = 'out_of_network';
      const degreeElement = document.querySelector(sels.connectionDegree);
      if (degreeElement) {
        const text = degreeElement.textContent || '';
        if (text.includes('1st')) connectionDegree = '1st';
        else if (text.includes('2nd')) connectionDegree = '2nd';
        else if (text.includes('3rd')) connectionDegree = '3rd';
      }

      // Activity indicators (check for recent posts in activity section)
      let hasRecentActivity = false;
      let activityLevel: ActivityLevel = 'unknown';

      const activitySection = document.querySelector('.pv-recent-activity-section');
      if (activitySection) {
        const activityItems = activitySection.querySelectorAll('.feed-shared-update-v2');
        hasRecentActivity = activityItems.length > 0;

        // Try to find dates
        const timeElement = activitySection.querySelector('time');
        if (timeElement) {
          const datetime = timeElement.getAttribute('datetime');
          if (datetime) {
            const activityDate = new Date(datetime);
            const daysSince = (Date.now() - activityDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince <= 7) activityLevel = 'very_active';
            else if (daysSince <= 30) activityLevel = 'active';
            else if (daysSince <= 90) activityLevel = 'moderate';
            else if (daysSince <= 180) activityLevel = 'low';
            else activityLevel = 'inactive';
          }
        }
      }

      // Mutual connections
      let mutualConnectionsCount = 0;
      const mutualElement = document.querySelector(sels.mutualConnections);
      if (mutualElement) {
        const match = (mutualElement.textContent || '').match(/\d+/);
        if (match) mutualConnectionsCount = parseInt(match[0], 10);
      }

      return {
        fullName,
        headline,
        location,
        hasPhoto,
        hasAboutSection,
        experienceCount,
        isPremium,
        isCreator,
        isOpenToMessages,
        connectionDegree,
        hasRecentActivity,
        activityLevel,
        mutualConnectionsCount,
      };
    }, selectors);
  }

  /**
   * Build full contact object from partial + profile data
   */
  private buildFullContact(partial: Partial<LinkedInContact>, profileData: any): Partial<LinkedInContact> {
    const location = locationParserService.parseLocation(profileData.location);

    // Estimate days since activity
    let daysSinceActivity: number | null = null;
    if (profileData.activityLevel === 'very_active') daysSinceActivity = 3;
    else if (profileData.activityLevel === 'active') daysSinceActivity = 15;
    else if (profileData.activityLevel === 'moderate') daysSinceActivity = 60;
    else if (profileData.activityLevel === 'low') daysSinceActivity = 120;
    else if (profileData.activityLevel === 'inactive') daysSinceActivity = 200;

    return {
      ...partial,
      fullName: profileData.fullName || partial.fullName,
      headline: profileData.headline || partial.headline,
      location,
      activity: {
        lastActivityDate: null,
        daysSinceActivity,
        level: profileData.activityLevel,
        isActive: daysSinceActivity !== null && daysSinceActivity <= 90,
        hasRecentPost: profileData.hasRecentActivity,
        hasRecentComment: false,
        hasRecentReaction: false,
        hasRecentProfileUpdate: false,
        postFrequency: 'unknown',
        estimatedPostsPerMonth: null,
      },
      profile: {
        hasPhoto: profileData.hasPhoto,
        hasCustomHeadline: (profileData.headline || '').length > 10,
        hasAboutSection: profileData.hasAboutSection,
        hasExperience: profileData.experienceCount > 0,
        hasEducation: false,
        hasSkills: false,
        hasRecommendations: false,
        hasCustomBanner: false,
        experienceCount: profileData.experienceCount,
        educationCount: 0,
        skillsCount: 0,
        recommendationsGivenCount: 0,
        recommendationsReceivedCount: 0,
        completenessScore: 0,
      },
      engagement: {
        isCreator: profileData.isCreator,
        isPremium: profileData.isPremium,
        isOpenToMessages: profileData.isOpenToMessages,
        isInfluencer: false,
        followersCount: null,
        connectionsCount: '',
        connectionsNumeric: null,
      },
      connectionDegree: profileData.connectionDegree,
      mutualConnectionsCount: profileData.mutualConnectionsCount,
      analysisComplete: true,
    };
  }

  /**
   * Personalize message template
   */
  private personalizeMessage(template: MessageTemplate, contact: Partial<LinkedInContact>): string {
    // Pick random variation
    const variation = template.variations[Math.floor(Math.random() * template.variations.length)];

    // Replace variables
    let message = variation
      .replace(/{firstName}/g, contact.firstName || '')
      .replace(/{lastName}/g, contact.lastName || '')
      .replace(/{fullName}/g, contact.fullName || '')
      .replace(/{company}/g, contact.currentCompany || 'your company')
      .replace(/{role}/g, contact.currentRole || 'your role');

    return message;
  }

  /**
   * Send a message on LinkedIn
   */
  private async sendMessage(page: Page, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const selectors = linkedInSelectors.messaging;

      // Find and click message button
      const messageButton = await page.$(linkedInSelectors.profile.messageButton);
      if (!messageButton) {
        return { success: false, error: 'Message button not found' };
      }

      await messageButton.click();
      await humanBehaviorService.randomSleep(1500, 3000);

      // Wait for message input
      await page.waitForSelector(selectors.messageInput, { timeout: 10000 });

      // Type message with human-like delays
      const messageInput = await page.$(selectors.messageInput);
      if (!messageInput) {
        return { success: false, error: 'Message input not found' };
      }

      // Focus on input
      await messageInput.click();
      await humanBehaviorService.randomSleep(500, 1000);

      // Type character by character
      const charDelays = humanBehaviorService.getCharacterDelays(message);
      for (let i = 0; i < message.length; i++) {
        await page.keyboard.type(message[i]);
        await humanBehaviorService.sleep(charDelays[i]);
      }

      // Wait before sending
      await humanBehaviorService.randomSleep(1000, 2000);

      // Click send
      const sendButton = await page.$(selectors.sendButton);
      if (!sendButton) {
        return { success: false, error: 'Send button not found' };
      }

      await sendButton.click();
      await humanBehaviorService.randomSleep(1500, 3000);

      // Close message dialog if still open
      try {
        const closeButton = await page.$('.msg-overlay-bubble-header__button');
        if (closeButton) {
          await closeButton.click();
        }
      } catch {
        // Ignore
      }

      return { success: true };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Send failed' };
    }
  }

  /**
   * Simulate reading a profile
   */
  private async simulateReading(page: Page, minMs: number, maxMs: number): Promise<void> {
    const duration = humanBehaviorService.getRandomDelay(minMs, maxMs);
    const endTime = Date.now() + duration;

    while (Date.now() < endTime) {
      // Random scrolling
      if (Math.random() < 0.4) {
        await page.evaluate(() => {
          window.scrollBy(0, 150 + Math.random() * 250);
        });
      } else if (Math.random() < 0.2) {
        await page.evaluate(() => {
          window.scrollBy(0, -(50 + Math.random() * 100));
        });
      }

      await humanBehaviorService.randomSleep(500, 2000);
    }
  }

  /**
   * Browse feed naturally (adds to human-like behavior)
   */
  private async browseFeedNaturally(): Promise<void> {
    console.log('Browsing feed naturally...');

    const navResult = await linkedInAuthService.navigateTo(linkedInUrls.feed);
    if (!navResult.success) return;

    const page = await linkedInAuthService.getPage();

    // Scroll through some posts
    const scrollCount = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, 400 + Math.random() * 300);
      });
      await humanBehaviorService.randomSleep(2000, 5000);
    }
  }

  /**
   * Do something natural (check notifications, etc.)
   */
  private async doSomethingNatural(): Promise<void> {
    const action = Math.random();

    if (action < 0.5) {
      // Check notifications
      console.log('  (Checking notifications...)');
      try {
        const page = await linkedInAuthService.getPage();
        const notifButton = await page.$('button[aria-label*="Notification"]');
        if (notifButton) {
          await notifButton.click();
          await humanBehaviorService.randomSleep(2000, 4000);
          // Click away to close
          await page.keyboard.press('Escape');
        }
      } catch {
        // Ignore
      }
    } else {
      // Just scroll a bit on current page
      const page = await linkedInAuthService.getPage();
      await page.evaluate(() => {
        window.scrollBy(0, -200);
      });
      await humanBehaviorService.randomSleep(1000, 2000);
    }
  }

  /**
   * Take a break between sessions
   */
  private async takeBreak(): Promise<void> {
    const breakDuration = humanBehaviorService.getBreakDuration();
    console.log(`Taking a ${humanBehaviorService.formatDuration(breakDuration)} break...`);

    if (this.session) {
      this.session.status = 'paused';
    }

    await humanBehaviorService.sleep(breakDuration);

    if (this.session) {
      this.session.status = 'active';
    }
  }

  /**
   * Check and reset daily limit counter
   */
  private checkDailyLimit(): void {
    const now = new Date();
    if (now.getDate() !== this.dailyCountResetDate.getDate()) {
      this.dailyMessageCount = 0;
      this.dailyCountResetDate = now;
      console.log('Daily message count reset');
    }
  }

  /**
   * Stop the current outreach session
   */
  stop(): void {
    this.shouldStop = true;
    console.log('Outreach stop requested');
  }

  /**
   * Get session results
   */
  getResults(): OutreachResult[] {
    return [...this.results];
  }

  /**
   * Add a custom message template
   */
  addTemplate(template: MessageTemplate): void {
    this.messageTemplates.push(template);
  }

  /**
   * Get available templates
   */
  getTemplates(): MessageTemplate[] {
    return [...this.messageTemplates];
  }
}

// Export singleton instance
export const linkedInOutreachService = new LinkedInOutreachService();
