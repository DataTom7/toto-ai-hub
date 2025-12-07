/**
 * Profile Analyzer Service
 *
 * Performs deep analysis of LinkedIn profiles to extract activity,
 * engagement, and profile completeness information.
 */

import { Page } from 'puppeteer';
import { linkedInAuthService } from './LinkedInAuthService';
import { humanBehaviorService } from './HumanBehaviorService';
import { locationParserService } from './LocationParserService';
import { linkedInSelectors, contactScanConfig } from '../../config/linkedin.config';
import {
  LinkedInContact,
  ActivityInfo,
  ActivityLevel,
  ProfileCompleteness,
  EngagementIndicators,
  ScanProgress,
} from '../../types/linkedin.types';

interface ProfileData {
  // Basic info
  fullName: string;
  headline: string;
  location: string;
  about: string;

  // Activity
  lastActivityDate: Date | null;
  activityLevel: ActivityLevel;
  postFrequency: 'daily' | 'weekly' | 'monthly' | 'rare' | 'none' | 'unknown';

  // Profile completeness
  hasPhoto: boolean;
  hasAboutSection: boolean;
  experienceCount: number;
  educationCount: number;
  skillsCount: number;
  recommendationsCount: number;
  hasCustomBanner: boolean;

  // Engagement
  isCreator: boolean;
  isPremium: boolean;
  isOpenToMessages: boolean;
  isInfluencer: boolean;
  followersCount: number | null;
  connectionsCount: string;

  // Relationship
  mutualConnectionsCount: number;
  connectionDegree: '1st' | '2nd' | '3rd' | 'out_of_network';
}

export class ProfileAnalyzerService {
  private analyzedProfiles: Map<string, ProfileData> = new Map();
  private analysisProgress: ScanProgress | null = null;
  private dailyProfileCount: number = 0;
  private dailyCountResetDate: Date = new Date();

  constructor() {
    console.log('ProfileAnalyzerService initialized');
  }

  /**
   * Analyze a single profile
   */
  async analyzeProfile(profileUrl: string): Promise<ProfileData | null> {
    // Check daily limit
    this.checkDailyLimit();
    if (this.dailyProfileCount >= contactScanConfig.maxProfilesPerDay) {
      console.warn('Daily profile limit reached');
      return null;
    }

    // Check if already analyzed
    if (this.analyzedProfiles.has(profileUrl)) {
      console.log(`Profile already analyzed: ${profileUrl}`);
      return this.analyzedProfiles.get(profileUrl) || null;
    }

    try {
      console.log(`Analyzing profile: ${profileUrl}`);

      // Navigate to profile
      const navResult = await linkedInAuthService.navigateTo(profileUrl);
      if (!navResult.success) {
        throw new Error(navResult.error);
      }

      const page = await linkedInAuthService.getPage();

      // Wait for profile to load
      await humanBehaviorService.randomSleep(2000, 4000);

      // Extract profile data
      const profileData = await this.extractProfileData(page);

      // Spend some time "reading" the profile
      const viewDuration = humanBehaviorService.getProfileViewDuration();
      await this.simulateProfileBrowsing(page, viewDuration);

      // Cache the result
      this.analyzedProfiles.set(profileUrl, profileData);
      this.dailyProfileCount++;

      // Record the activity
      linkedInAuthService.recordActivity();

      // Wait before next action
      const delay = humanBehaviorService.getProfileViewDelay();
      console.log(`Profile analyzed. Waiting ${humanBehaviorService.formatDuration(delay)} before next...`);
      await humanBehaviorService.sleep(delay);

      return profileData;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error analyzing profile ${profileUrl}:`, errorMessage);
      return null;
    }
  }

  /**
   * Analyze multiple profiles in batch
   */
  async analyzeProfiles(
    profileUrls: string[],
    onProgress?: (analyzed: number, total: number) => void
  ): Promise<Map<string, ProfileData | null>> {
    const results = new Map<string, ProfileData | null>();
    const total = profileUrls.length;

    console.log(`Starting batch analysis of ${total} profiles...`);

    // Start a session
    humanBehaviorService.startSession();

    for (let i = 0; i < profileUrls.length; i++) {
      const url = profileUrls[i];

      // Check daily limit
      if (this.dailyProfileCount >= contactScanConfig.maxProfilesPerDay) {
        console.log('Daily limit reached, stopping batch analysis');
        break;
      }

      // Check session duration
      if (humanBehaviorService.shouldEndSession()) {
        console.log('Session duration reached, taking a break...');
        await this.takeSessionBreak();
        humanBehaviorService.startSession();
      }

      // Check for break probability
      if (humanBehaviorService.shouldTakeBreak()) {
        const shortBreak = humanBehaviorService.getRandomDelay(30000, 120000);
        console.log(`Taking a short break (${humanBehaviorService.formatDuration(shortBreak)})...`);
        await humanBehaviorService.sleep(shortBreak);
      }

      // Analyze profile
      const profileData = await this.analyzeProfile(url);
      results.set(url, profileData);

      // Report progress
      if (onProgress) {
        onProgress(i + 1, total);
      }

      console.log(`Progress: ${i + 1}/${total} profiles analyzed`);
    }

    return results;
  }

  /**
   * Extract all profile data from the current page
   */
  private async extractProfileData(page: Page): Promise<ProfileData> {
    const selectors = linkedInSelectors.profile;

    const data = await page.evaluate((sels) => {
      // Helper to get text content safely
      const getText = (selector: string): string => {
        const el = document.querySelector(selector);
        return el?.textContent?.trim() || '';
      };

      // Helper to check if element exists
      const exists = (selector: string): boolean => {
        return document.querySelector(selector) !== null;
      };

      // Helper to count elements
      const count = (selector: string): number => {
        return document.querySelectorAll(selector).length;
      };

      // Basic info
      const fullName = getText(sels.name);
      const headline = getText(sels.headline);
      const location = getText(sels.location);

      // About section
      const aboutElement = document.querySelector('#about');
      let about = '';
      if (aboutElement) {
        const nextDiv = aboutElement.parentElement?.querySelector('.display-flex.ph5.pv3 span');
        about = nextDiv?.textContent?.trim() || '';
      }

      // Experience count
      const experienceSection = document.querySelector('#experience');
      let experienceCount = 0;
      if (experienceSection) {
        experienceCount = experienceSection.parentElement?.querySelectorAll('li.artdeco-list__item').length || 0;
      }

      // Education count
      const educationSection = document.querySelector('#education');
      let educationCount = 0;
      if (educationSection) {
        educationCount = educationSection.parentElement?.querySelectorAll('li.artdeco-list__item').length || 0;
      }

      // Skills count
      const skillsSection = document.querySelector('#skills');
      let skillsCount = 0;
      if (skillsSection) {
        skillsCount = skillsSection.parentElement?.querySelectorAll('li').length || 0;
      }

      // Recommendations count
      const recsReceived = getText('a[href*="recommendationsReceived"]');
      let recommendationsCount = 0;
      const recsMatch = recsReceived.match(/\d+/);
      if (recsMatch) {
        recommendationsCount = parseInt(recsMatch[0], 10);
      }

      // Profile photo
      const photoElement = document.querySelector(sels.profilePhoto);
      let hasPhoto = false;
      if (photoElement) {
        const src = photoElement.getAttribute('src') || '';
        hasPhoto = !src.includes('ghost') && !src.includes('default');
      }

      // Custom banner
      const bannerElement = document.querySelector('.profile-background-image img');
      const hasCustomBanner = bannerElement !== null;

      // Premium badge
      const isPremium = exists(sels.premiumBadge) || exists('.pv-text-details__separator');

      // Creator mode
      const isCreator = exists(sels.creatorBadge) || exists('[data-test-badge="creator"]');

      // Followers count (only visible for creators)
      let followersCount: number | null = null;
      const followersElement = document.querySelector('.pv-recent-activity-section__follower-count-text');
      if (followersElement) {
        const followersText = followersElement.textContent || '';
        const match = followersText.match(/[\d,]+/);
        if (match) {
          followersCount = parseInt(match[0].replace(/,/g, ''), 10);
        }
      }

      // Connections count
      let connectionsCount = '';
      const connectionsLink = document.querySelector('a[href*="/connections"]');
      if (connectionsLink) {
        connectionsCount = connectionsLink.textContent?.trim() || '';
      } else {
        // Try alternative location
        const connectionsBadge = document.querySelector('.pv-top-card--list-bullet li:first-child');
        if (connectionsBadge) {
          connectionsCount = connectionsBadge.textContent?.trim() || '';
        }
      }

      // Connection degree
      let connectionDegree: '1st' | '2nd' | '3rd' | 'out_of_network' = 'out_of_network';
      const degreeElement = document.querySelector(sels.connectionDegree);
      if (degreeElement) {
        const degreeText = degreeElement.textContent?.trim() || '';
        if (degreeText.includes('1st')) connectionDegree = '1st';
        else if (degreeText.includes('2nd')) connectionDegree = '2nd';
        else if (degreeText.includes('3rd')) connectionDegree = '3rd';
      }

      // Mutual connections
      let mutualConnectionsCount = 0;
      const mutualElement = document.querySelector(sels.mutualConnections);
      if (mutualElement) {
        const mutualText = mutualElement.textContent || '';
        const match = mutualText.match(/\d+/);
        if (match) {
          mutualConnectionsCount = parseInt(match[0], 10);
        }
      }

      // Open to messages
      const isOpenToMessages = exists(sels.messageButton);

      // Influencer badge
      const isInfluencer = exists('.pv-top-card-profile-picture__badge--influencer');

      return {
        fullName,
        headline,
        location,
        about,
        hasPhoto,
        hasAboutSection: about.length > 0,
        experienceCount,
        educationCount,
        skillsCount,
        recommendationsCount,
        hasCustomBanner,
        isPremium,
        isCreator,
        followersCount,
        connectionsCount,
        connectionDegree,
        mutualConnectionsCount,
        isOpenToMessages,
        isInfluencer,
      };
    }, selectors);

    // Get activity info (requires separate navigation or API call)
    const activityInfo = await this.getActivityInfo(page);

    return {
      ...data,
      lastActivityDate: activityInfo.lastActivityDate,
      activityLevel: activityInfo.level,
      postFrequency: activityInfo.postFrequency,
    };
  }

  /**
   * Get activity information from profile
   */
  private async getActivityInfo(page: Page): Promise<ActivityInfo> {
    const defaultActivity: ActivityInfo = {
      lastActivityDate: null,
      daysSinceActivity: null,
      level: 'unknown',
      isActive: false,
      hasRecentPost: false,
      hasRecentComment: false,
      hasRecentReaction: false,
      hasRecentProfileUpdate: false,
      postFrequency: 'unknown',
      estimatedPostsPerMonth: null,
    };

    try {
      // Try to find activity section on profile
      const activityData = await page.evaluate(() => {
        // Look for recent activity section
        const activitySection = document.querySelector('.pv-recent-activity-section');
        if (!activitySection) {
          return null;
        }

        // Get activity items
        const activityItems = activitySection.querySelectorAll('.pv-recent-activity-section__card');
        const activities: { date: string | null; type: string }[] = [];

        activityItems.forEach((item) => {
          const timeElement = item.querySelector('time');
          const date = timeElement?.getAttribute('datetime') || null;

          // Try to determine activity type
          let type = 'unknown';
          const text = item.textContent?.toLowerCase() || '';
          if (text.includes('posted')) type = 'post';
          else if (text.includes('commented')) type = 'comment';
          else if (text.includes('liked') || text.includes('reacted')) type = 'reaction';
          else if (text.includes('shared')) type = 'share';

          activities.push({ date, type });
        });

        return activities;
      });

      if (!activityData || activityData.length === 0) {
        return defaultActivity;
      }

      // Find most recent activity
      let lastActivityDate: Date | null = null;
      let hasRecentPost = false;
      let hasRecentComment = false;
      let hasRecentReaction = false;
      let postCount = 0;

      for (const activity of activityData) {
        if (activity.date) {
          const date = new Date(activity.date);
          if (!lastActivityDate || date > lastActivityDate) {
            lastActivityDate = date;
          }

          const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);

          if (daysSince <= 30) {
            if (activity.type === 'post') {
              hasRecentPost = true;
              postCount++;
            }
            if (activity.type === 'comment') hasRecentComment = true;
            if (activity.type === 'reaction') hasRecentReaction = true;
          }
        }
      }

      // Calculate days since activity
      const daysSinceActivity = lastActivityDate
        ? Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Determine activity level
      let level: ActivityLevel = 'unknown';
      if (daysSinceActivity !== null) {
        if (daysSinceActivity <= 7) level = 'very_active';
        else if (daysSinceActivity <= 30) level = 'active';
        else if (daysSinceActivity <= 90) level = 'moderate';
        else if (daysSinceActivity <= 180) level = 'low';
        else level = 'inactive';
      }

      // Estimate post frequency
      let postFrequency: 'daily' | 'weekly' | 'monthly' | 'rare' | 'none' | 'unknown' = 'unknown';
      if (postCount >= 4) postFrequency = 'weekly';
      else if (postCount >= 1) postFrequency = 'monthly';
      else if (activityData.length > 0) postFrequency = 'rare';
      else postFrequency = 'none';

      return {
        lastActivityDate,
        daysSinceActivity,
        level,
        isActive: daysSinceActivity !== null && daysSinceActivity <= 90,
        hasRecentPost,
        hasRecentComment,
        hasRecentReaction,
        hasRecentProfileUpdate: false, // Hard to detect from profile page
        postFrequency,
        estimatedPostsPerMonth: postCount,
      };

    } catch (error) {
      console.warn('Error getting activity info:', error);
      return defaultActivity;
    }
  }

  /**
   * Simulate natural profile browsing behavior
   */
  private async simulateProfileBrowsing(page: Page, duration: number): Promise<void> {
    const endTime = Date.now() + duration;

    while (Date.now() < endTime) {
      // Random action
      const action = Math.random();

      if (action < 0.4) {
        // Scroll down
        await page.evaluate(() => {
          window.scrollBy(0, 200 + Math.random() * 300);
        });
      } else if (action < 0.7) {
        // Scroll up a bit
        await page.evaluate(() => {
          window.scrollBy(0, -(100 + Math.random() * 200));
        });
      }
      // Otherwise just wait (reading)

      await humanBehaviorService.randomSleep(500, 2000);
    }
  }

  /**
   * Take a break between sessions
   */
  private async takeSessionBreak(): Promise<void> {
    const breakDuration = humanBehaviorService.getBreakDuration();
    console.log(`Taking session break (${humanBehaviorService.formatDuration(breakDuration)})...`);
    await humanBehaviorService.sleep(breakDuration);
  }

  /**
   * Check and reset daily limit counter
   */
  private checkDailyLimit(): void {
    const now = new Date();
    if (now.getDate() !== this.dailyCountResetDate.getDate()) {
      this.dailyProfileCount = 0;
      this.dailyCountResetDate = now;
      console.log('Daily profile count reset');
    }
  }

  /**
   * Build a LinkedInContact from profile data
   */
  buildContact(
    basicInfo: { linkedInId: string; profileUrl: string; publicIdentifier: string },
    profileData: ProfileData
  ): Partial<LinkedInContact> {
    const location = locationParserService.parseLocation(profileData.location);

    const activity: ActivityInfo = {
      lastActivityDate: profileData.lastActivityDate,
      daysSinceActivity: profileData.lastActivityDate
        ? Math.floor((Date.now() - profileData.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      level: profileData.activityLevel,
      isActive: profileData.activityLevel !== 'inactive' && profileData.activityLevel !== 'unknown',
      hasRecentPost: false, // Would need more detailed analysis
      hasRecentComment: false,
      hasRecentReaction: false,
      hasRecentProfileUpdate: false,
      postFrequency: profileData.postFrequency,
      estimatedPostsPerMonth: null,
    };

    const profile: ProfileCompleteness = {
      hasPhoto: profileData.hasPhoto,
      hasCustomHeadline: profileData.headline.length > 10,
      hasAboutSection: profileData.hasAboutSection,
      hasExperience: profileData.experienceCount > 0,
      hasEducation: profileData.educationCount > 0,
      hasSkills: profileData.skillsCount > 0,
      hasRecommendations: profileData.recommendationsCount > 0,
      hasCustomBanner: profileData.hasCustomBanner,
      experienceCount: profileData.experienceCount,
      educationCount: profileData.educationCount,
      skillsCount: profileData.skillsCount,
      recommendationsGivenCount: 0,
      recommendationsReceivedCount: profileData.recommendationsCount,
      completenessScore: 0, // Will be calculated by scoring service
    };

    const engagement: EngagementIndicators = {
      isCreator: profileData.isCreator,
      isPremium: profileData.isPremium,
      isOpenToMessages: profileData.isOpenToMessages,
      isInfluencer: profileData.isInfluencer,
      followersCount: profileData.followersCount,
      connectionsCount: profileData.connectionsCount,
      connectionsNumeric: null, // Parse from connectionsCount string
    };

    return {
      linkedInId: basicInfo.linkedInId,
      profileUrl: basicInfo.profileUrl,
      publicIdentifier: basicInfo.publicIdentifier,
      firstName: profileData.fullName.split(' ')[0] || '',
      lastName: profileData.fullName.split(' ').slice(1).join(' ') || '',
      fullName: profileData.fullName,
      headline: profileData.headline,
      currentCompany: null, // Would need to parse from headline/experience
      currentRole: null,
      industry: null,
      location,
      activity,
      profilePhotoUrl: profileData.hasPhoto ? 'detected' : null, // Actual URL would be from initial scan
      bannerImageUrl: profileData.hasCustomBanner ? 'detected' : null,
      profile,
      engagement,
      connectionDegree: profileData.connectionDegree,
      mutualConnectionsCount: profileData.mutualConnectionsCount,
      sharedGroupsCount: 0,
      hasMessaged: false,
      hasPreviousInteraction: false,
      scrapedAt: new Date(),
      lastUpdated: new Date(),
      analysisComplete: true,
      tags: [],
      notes: '',
    };
  }

  /**
   * Get analysis statistics
   */
  getStats(): {
    analyzedToday: number;
    dailyLimit: number;
    totalAnalyzed: number;
    cacheSize: number;
  } {
    return {
      analyzedToday: this.dailyProfileCount,
      dailyLimit: contactScanConfig.maxProfilesPerDay,
      totalAnalyzed: this.analyzedProfiles.size,
      cacheSize: this.analyzedProfiles.size,
    };
  }

  /**
   * Clear the analysis cache
   */
  clearCache(): void {
    this.analyzedProfiles.clear();
    console.log('Profile analysis cache cleared');
  }
}

// Export singleton instance
export const profileAnalyzerService = new ProfileAnalyzerService();
