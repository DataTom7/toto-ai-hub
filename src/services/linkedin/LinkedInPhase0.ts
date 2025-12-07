/**
 * LinkedIn Phase 0 Orchestrator
 *
 * Coordinates the full contact intelligence and cleanup workflow:
 * 1. Export all 1st-degree connections
 * 2. Analyze each profile for activity and details
 * 3. Filter by region (Europe/Americas) and activity
 * 4. Score and prioritize contacts
 * 5. Generate analysis report
 */

import { linkedInAuthService } from './LinkedInAuthService';
import { contactScannerService } from './ContactScannerService';
import { profileAnalyzerService } from './ProfileAnalyzerService';
import { contactScoringService } from './ContactScoringService';
import { locationParserService } from './LocationParserService';
import { humanBehaviorService } from './HumanBehaviorService';
import { validateConfig, contactScanConfig } from '../../config/linkedin.config';
import { targetingConfig } from '../../config/targeting.config';
import {
  LinkedInContact,
  ContactAnalysisReport,
  ScanProgress,
  ContactStatus,
} from '../../types/linkedin.types';

interface Phase0Progress {
  phase: 'idle' | 'exporting' | 'analyzing' | 'scoring' | 'complete' | 'error';
  step: string;
  progress: number; // 0-100
  contactsExported: number;
  contactsAnalyzed: number;
  contactsScored: number;
  qualified: number;
  filtered: number;
  startTime: Date | null;
  estimatedTimeRemaining: string | null;
  errors: string[];
}

export class LinkedInPhase0 {
  private progress: Phase0Progress = {
    phase: 'idle',
    step: '',
    progress: 0,
    contactsExported: 0,
    contactsAnalyzed: 0,
    contactsScored: 0,
    qualified: 0,
    filtered: 0,
    startTime: null,
    estimatedTimeRemaining: null,
    errors: [],
  };

  private contacts: LinkedInContact[] = [];
  private report: ContactAnalysisReport | null = null;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor() {
    console.log('LinkedInPhase0 Orchestrator initialized');
  }

  /**
   * Get current progress
   */
  getProgress(): Phase0Progress {
    return { ...this.progress };
  }

  /**
   * Get analyzed contacts
   */
  getContacts(): LinkedInContact[] {
    return [...this.contacts];
  }

  /**
   * Get qualified contacts only
   */
  getQualifiedContacts(): LinkedInContact[] {
    return this.contacts.filter(c =>
      c.status === 'qualified' || c.status === 'queued'
    );
  }

  /**
   * Get the analysis report
   */
  getReport(): ContactAnalysisReport | null {
    return this.report;
  }

  /**
   * Run the full Phase 0 workflow
   */
  async run(options?: {
    skipExport?: boolean;
    skipAnalysis?: boolean;
    maxProfilesToAnalyze?: number;
  }): Promise<{ success: boolean; report?: ContactAnalysisReport; error?: string }> {
    // Validate configuration
    const configValidation = validateConfig();
    if (!configValidation.valid) {
      return {
        success: false,
        error: `Configuration errors: ${configValidation.errors.join(', ')}`,
      };
    }

    if (this.isRunning) {
      return { success: false, error: 'Phase 0 is already running' };
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.progress = {
      phase: 'exporting',
      step: 'Starting Phase 0...',
      progress: 0,
      contactsExported: 0,
      contactsAnalyzed: 0,
      contactsScored: 0,
      qualified: 0,
      filtered: 0,
      startTime: new Date(),
      estimatedTimeRemaining: null,
      errors: [],
    };

    try {
      console.log('='.repeat(60));
      console.log('LINKEDIN PHASE 0: CONTACT INTELLIGENCE & CLEANUP');
      console.log('='.repeat(60));
      console.log(`Target: Active 1st-degree connections in Europe & Americas`);
      console.log(`Activity threshold: ${targetingConfig.activityThreshold.maxInactiveDays} days`);
      console.log('='.repeat(60));

      // =====================================================================
      // STEP 1: EXPORT CONNECTIONS
      // =====================================================================
      if (!options?.skipExport) {
        this.progress.phase = 'exporting';
        this.progress.step = 'Exporting connections list...';
        console.log('\n[STEP 1/4] Exporting connections...');

        const scanResult = await contactScannerService.startScan();
        if (!scanResult.success) {
          throw new Error(`Failed to export connections: ${scanResult.error}`);
        }

        const basicContacts = contactScannerService.getContacts();
        this.progress.contactsExported = basicContacts.length;

        console.log(`Exported ${basicContacts.length} connections`);

        // Create initial contact objects
        this.contacts = basicContacts.map(basic => this.createInitialContact(basic));
      }

      if (this.shouldStop) {
        return { success: false, error: 'Phase 0 was stopped' };
      }

      // =====================================================================
      // STEP 2: QUICK FILTER BY LOCATION
      // =====================================================================
      this.progress.phase = 'analyzing';
      this.progress.step = 'Filtering by location...';
      console.log('\n[STEP 2/4] Quick location filtering...');

      let locationFilteredCount = 0;
      for (const contact of this.contacts) {
        // Parse location from basic info
        const locationInfo = locationParserService.parseLocation(contact.location.raw);
        contact.location = locationInfo;

        // Quick filter: if definitely not in target region, mark as filtered
        if (locationInfo.confidence > 0.7 && !locationInfo.isTargetRegion) {
          contact.status = 'filtered_region';
          contact.skipReason = `Outside target region: ${locationInfo.country || locationInfo.raw}`;
          locationFilteredCount++;
        }
      }

      const remainingForAnalysis = this.contacts.filter(c => c.status === 'pending');
      console.log(`Location filter: ${locationFilteredCount} filtered, ${remainingForAnalysis.length} remaining for analysis`);

      // =====================================================================
      // STEP 3: DEEP PROFILE ANALYSIS
      // =====================================================================
      if (!options?.skipAnalysis && remainingForAnalysis.length > 0) {
        this.progress.step = 'Analyzing profiles for activity...';
        console.log('\n[STEP 3/4] Deep profile analysis...');

        const maxToAnalyze = options?.maxProfilesToAnalyze || remainingForAnalysis.length;
        const profilesToAnalyze = remainingForAnalysis.slice(0, maxToAnalyze);

        console.log(`Will analyze ${profilesToAnalyze.length} profiles (limit: ${contactScanConfig.maxProfilesPerDay}/day)`);

        // Start analysis session
        humanBehaviorService.startSession();

        for (let i = 0; i < profilesToAnalyze.length; i++) {
          if (this.shouldStop) {
            console.log('Phase 0 stopped by user');
            break;
          }

          const contact = profilesToAnalyze[i];

          // Check daily limit
          const stats = profileAnalyzerService.getStats();
          if (stats.analyzedToday >= stats.dailyLimit) {
            console.log(`Daily limit reached (${stats.dailyLimit}). Stopping analysis.`);
            break;
          }

          // Analyze profile
          const profileData = await profileAnalyzerService.analyzeProfile(contact.profileUrl);

          if (profileData) {
            // Update contact with profile data
            this.updateContactWithProfileData(contact, profileData);
            contact.analysisComplete = true;
            contact.status = 'pending'; // Will be re-evaluated in scoring
          } else {
            contact.status = 'error';
            contact.skipReason = 'Failed to analyze profile';
          }

          this.progress.contactsAnalyzed = i + 1;
          this.progress.progress = ((i + 1) / profilesToAnalyze.length) * 60 + 20; // 20-80%

          // Update estimated time
          const elapsed = Date.now() - this.progress.startTime!.getTime();
          const perProfile = elapsed / (i + 1);
          const remaining = (profilesToAnalyze.length - i - 1) * perProfile;
          this.progress.estimatedTimeRemaining = humanBehaviorService.formatDuration(remaining);

          console.log(`Progress: ${i + 1}/${profilesToAnalyze.length} (${this.progress.estimatedTimeRemaining} remaining)`);
        }
      }

      if (this.shouldStop) {
        return { success: false, error: 'Phase 0 was stopped' };
      }

      // =====================================================================
      // STEP 4: SCORE AND PRIORITIZE
      // =====================================================================
      this.progress.phase = 'scoring';
      this.progress.step = 'Scoring and prioritizing contacts...';
      this.progress.progress = 80;
      console.log('\n[STEP 4/4] Scoring and prioritizing...');

      // Score all analyzed contacts
      const analyzedContacts = this.contacts.filter(c => c.analysisComplete);

      for (const contact of analyzedContacts) {
        const scores = contactScoringService.scoreContact(contact);
        contact.scores = scores;

        // Determine final status
        const status = contactScoringService.determineStatus(contact, scores);
        contact.status = status;

        if (status !== 'qualified') {
          contact.skipReason = contactScoringService.getSkipReason(contact, scores);
        }

        this.progress.contactsScored++;
      }

      // Count results
      const qualified = this.contacts.filter(c => c.status === 'qualified');
      const filtered = this.contacts.filter(c =>
        c.status === 'filtered_region' ||
        c.status === 'filtered_inactive' ||
        c.status === 'filtered_both' ||
        c.status === 'skip'
      );

      this.progress.qualified = qualified.length;
      this.progress.filtered = filtered.length;

      // Sort by priority
      this.contacts = contactScoringService.sortByPriority(this.contacts);

      // =====================================================================
      // GENERATE REPORT
      // =====================================================================
      this.progress.step = 'Generating report...';
      this.progress.progress = 95;

      this.report = contactScoringService.generateReport(this.contacts);

      // =====================================================================
      // COMPLETE
      // =====================================================================
      this.progress.phase = 'complete';
      this.progress.step = 'Phase 0 complete!';
      this.progress.progress = 100;
      this.isRunning = false;

      console.log('\n' + '='.repeat(60));
      console.log('PHASE 0 COMPLETE');
      console.log('='.repeat(60));
      console.log(`Total contacts: ${this.contacts.length}`);
      console.log(`Analyzed: ${analyzedContacts.length}`);
      console.log(`Qualified: ${qualified.length}`);
      console.log(`Filtered: ${filtered.length}`);
      console.log(`  - Wrong region: ${this.report.filterResults.filteredRegion}`);
      console.log(`  - Inactive: ${this.report.filterResults.filteredInactive}`);
      console.log(`  - Both: ${this.report.filterResults.filteredBoth}`);
      console.log(`High priority: ${this.report.priorityDistribution.high}`);
      console.log(`Medium priority: ${this.report.priorityDistribution.medium}`);
      console.log(`Estimated campaign duration: ${this.report.recommendations.estimatedCampaignDays} days`);
      console.log('='.repeat(60));

      return { success: true, report: this.report };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Phase 0 error:', errorMessage);

      this.progress.phase = 'error';
      this.progress.step = `Error: ${errorMessage}`;
      this.progress.errors.push(errorMessage);
      this.isRunning = false;

      return { success: false, error: errorMessage };

    } finally {
      // Clean up
      await linkedInAuthService.closeBrowser();
    }
  }

  /**
   * Stop the current run
   */
  stop(): void {
    this.shouldStop = true;
    contactScannerService.stopScan();
    console.log('Phase 0 stop requested');
  }

  /**
   * Create initial contact object from basic scan data
   */
  private createInitialContact(basic: any): LinkedInContact {
    const location = locationParserService.parseLocation(basic.location);

    return {
      linkedInId: basic.linkedInId,
      profileUrl: basic.profileUrl,
      publicIdentifier: basic.publicIdentifier,
      firstName: basic.fullName.split(' ')[0] || '',
      lastName: basic.fullName.split(' ').slice(1).join(' ') || '',
      fullName: basic.fullName,
      headline: basic.headline || '',
      currentCompany: null,
      currentRole: null,
      industry: null,
      location,
      activity: {
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
      },
      profilePhotoUrl: basic.profilePhotoUrl,
      bannerImageUrl: null,
      profile: {
        hasPhoto: !!basic.profilePhotoUrl,
        hasCustomHeadline: (basic.headline || '').length > 10,
        hasAboutSection: false,
        hasExperience: false,
        hasEducation: false,
        hasSkills: false,
        hasRecommendations: false,
        hasCustomBanner: false,
        experienceCount: 0,
        educationCount: 0,
        skillsCount: 0,
        recommendationsGivenCount: 0,
        recommendationsReceivedCount: 0,
        completenessScore: 0,
      },
      engagement: {
        isCreator: false,
        isPremium: false,
        isOpenToMessages: false,
        isInfluencer: false,
        followersCount: null,
        connectionsCount: '',
        connectionsNumeric: null,
      },
      connectionDate: basic.connectionDate ? new Date(basic.connectionDate) : null,
      connectionDegree: '1st',
      mutualConnectionsCount: 0,
      sharedGroupsCount: 0,
      hasMessaged: false,
      hasPreviousInteraction: false,
      scores: {
        activityScore: 0,
        profileQualityScore: 0,
        engagementScore: 0,
        relevanceScore: 0,
        redFlagPenalty: 0,
        totalScore: 0,
        priority: 'skip',
        breakdown: {
          activityRecency: 0,
          activityFrequency: 0,
          contentEngagement: 0,
          photoPoints: 0,
          headlinePoints: 0,
          aboutPoints: 0,
          experiencePoints: 0,
          creatorModePoints: 0,
          premiumPoints: 0,
          openToMessagesPoints: 0,
          noPhotopenalty: 0,
          inactivityPenalty: 0,
          incompleteProfilePenalty: 0,
          notes: [],
        },
      },
      status: 'pending',
      skipReason: null,
      scrapedAt: new Date(),
      lastUpdated: new Date(),
      analysisComplete: false,
      tags: [],
      notes: '',
    };
  }

  /**
   * Update contact with detailed profile data
   */
  private updateContactWithProfileData(contact: LinkedInContact, profileData: any): void {
    // Update activity
    contact.activity = {
      lastActivityDate: profileData.lastActivityDate,
      daysSinceActivity: profileData.lastActivityDate
        ? Math.floor((Date.now() - new Date(profileData.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24))
        : null,
      level: profileData.activityLevel || 'unknown',
      isActive: profileData.activityLevel !== 'inactive' && profileData.activityLevel !== 'unknown',
      hasRecentPost: false,
      hasRecentComment: false,
      hasRecentReaction: false,
      hasRecentProfileUpdate: false,
      postFrequency: profileData.postFrequency || 'unknown',
      estimatedPostsPerMonth: null,
    };

    // Update profile
    contact.profile = {
      hasPhoto: profileData.hasPhoto,
      hasCustomHeadline: (profileData.headline || '').length > 10,
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
      completenessScore: 0,
    };

    // Update engagement
    contact.engagement = {
      isCreator: profileData.isCreator,
      isPremium: profileData.isPremium,
      isOpenToMessages: profileData.isOpenToMessages,
      isInfluencer: profileData.isInfluencer,
      followersCount: profileData.followersCount,
      connectionsCount: profileData.connectionsCount,
      connectionsNumeric: null,
    };

    // Update relationship
    contact.mutualConnectionsCount = profileData.mutualConnectionsCount;
    contact.connectionDegree = profileData.connectionDegree;

    // Update location if we got better info
    if (profileData.location) {
      const newLocation = locationParserService.parseLocation(profileData.location);
      if (newLocation.confidence > contact.location.confidence) {
        contact.location = newLocation;
      }
    }

    contact.lastUpdated = new Date();
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    total: number;
    analyzed: number;
    qualified: number;
    highPriority: number;
    mediumPriority: number;
    filtered: number;
    byRegion: { europe: number; americas: number; other: number; unknown: number };
  } {
    const qualified = this.contacts.filter(c => c.status === 'qualified');
    const highPriority = qualified.filter(c => c.scores.priority === 'high');
    const mediumPriority = qualified.filter(c => c.scores.priority === 'medium');
    const filtered = this.contacts.filter(c =>
      c.status === 'filtered_region' ||
      c.status === 'filtered_inactive' ||
      c.status === 'filtered_both' ||
      c.status === 'skip'
    );

    const byRegion = { europe: 0, americas: 0, other: 0, unknown: 0 };
    for (const contact of this.contacts) {
      byRegion[contact.location.region]++;
    }

    return {
      total: this.contacts.length,
      analyzed: this.contacts.filter(c => c.analysisComplete).length,
      qualified: qualified.length,
      highPriority: highPriority.length,
      mediumPriority: mediumPriority.length,
      filtered: filtered.length,
      byRegion,
    };
  }
}

// Export singleton instance
export const linkedInPhase0 = new LinkedInPhase0();
