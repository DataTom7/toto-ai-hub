/**
 * LinkedIn Batch Workflow Service
 *
 * Implements a safe, incremental daily workflow:
 *
 * DAY N:
 *   - Message qualified contacts from batch N-1 (reviewed yesterday)
 *   - Analyze batch N (20 contacts) for manual review
 *
 * This approach is:
 *   - Very slow (20 profiles + <20 messages per day)
 *   - Manual review in the loop
 *   - Language detection for personalization
 *   - Virtually undetectable
 */

import { Page } from 'puppeteer';
import { linkedInAuthService } from './LinkedInAuthService';
import { humanBehaviorService } from './HumanBehaviorService';
import { locationParserService } from './LocationParserService';
import { contactScoringService } from './ContactScoringService';
import { linkedInDataExportService } from './LinkedInDataExportService';
import { linkedInConfig, linkedInSelectors } from '../../config/linkedin.config';
import { targetingConfig } from '../../config/targeting.config';
import { LinkedInContact, ContactScores } from '../../types/linkedin.types';

// ============================================================================
// TYPES
// ============================================================================

export interface AnalyzedContact {
  // Basic info
  linkedInId: string;
  profileUrl: string;
  fullName: string;
  firstName: string;
  lastName: string;
  headline: string;

  // From CSV
  company: string | null;
  position: string | null;
  email: string | null;
  connectionDate: Date | null;
  previouslyMessaged: boolean;

  // From profile visit
  location: {
    raw: string;
    country: string | null;
    region: 'europe' | 'americas' | 'other' | 'unknown';
    isTargetRegion: boolean;
  };

  activity: {
    level: 'very_active' | 'active' | 'moderate' | 'low' | 'inactive' | 'unknown';
    daysSinceActivity: number | null;
    isActive: boolean;
  };

  profile: {
    hasPhoto: boolean;
    hasAbout: boolean;
    experienceCount: number;
    isPremium: boolean;
    isCreator: boolean;
    isOpenToMessages: boolean;
  };

  // Language detection
  language: {
    detected: string | null;        // 'en', 'es', 'pt', 'de', etc.
    confidence: number;             // 0-1
    indicators: string[];           // What we used to detect
  };

  // Scoring
  scores: {
    total: number;
    priority: 'high' | 'medium' | 'low' | 'skip';
    breakdown: string[];            // Human-readable reasons
  };

  // Review status
  status: 'pending_review' | 'approved' | 'rejected' | 'messaged' | 'error';
  reviewNotes: string;
  analyzedAt: Date;
}

export interface BatchResult {
  batchNumber: number;
  date: Date;
  contacts: AnalyzedContact[];
  summary: {
    total: number;
    qualified: number;
    filtered: number;
    byRegion: { europe: number; americas: number; other: number; unknown: number };
    byActivity: { active: number; moderate: number; inactive: number; unknown: number };
    byLanguage: Record<string, number>;
    avgScore: number;
  };
}

export interface DailyWorkflowResult {
  date: Date;

  // Morning: Message yesterday's approved contacts
  messaging: {
    attempted: number;
    sent: number;
    failed: number;
    skipped: number;
  };

  // Afternoon: Analyze new batch
  analysis: BatchResult;
}

// ============================================================================
// SERVICE
// ============================================================================

export class LinkedInBatchService {
  private batches: BatchResult[] = [];
  private currentBatchIndex: number = 0;
  private isRunning: boolean = false;

  constructor() {
    console.log('LinkedInBatchService initialized');
  }

  // ==========================================================================
  // BATCH ANALYSIS (Phase 0 for 20 contacts)
  // ==========================================================================

  /**
   * Analyze a batch of contacts (default 20)
   * Returns detailed results for manual review
   */
  async analyzeBatch(
    batchSize: number = 20,
    options?: {
      startIndex?: number;
      onProgress?: (current: number, total: number, contact: AnalyzedContact) => void;
    }
  ): Promise<BatchResult> {

    if (this.isRunning) {
      throw new Error('Batch analysis already running');
    }

    // Check if data export is loaded
    if (!linkedInDataExportService.isLoaded()) {
      throw new Error('LinkedIn data export not loaded. Call linkedInDataExportService.loadExport() first.');
    }

    this.isRunning = true;
    const startIndex = options?.startIndex ?? this.currentBatchIndex * batchSize;

    console.log('='.repeat(60));
    console.log(`BATCH ANALYSIS - Batch #${this.batches.length + 1}`);
    console.log('='.repeat(60));
    console.log(`Analyzing contacts ${startIndex + 1} to ${startIndex + batchSize}`);
    console.log('='.repeat(60));

    const result: BatchResult = {
      batchNumber: this.batches.length + 1,
      date: new Date(),
      contacts: [],
      summary: {
        total: 0,
        qualified: 0,
        filtered: 0,
        byRegion: { europe: 0, americas: 0, other: 0, unknown: 0 },
        byActivity: { active: 0, moderate: 0, inactive: 0, unknown: 0 },
        byLanguage: {},
        avgScore: 0,
      },
    };

    try {
      // Get connections from CSV
      const allConnections = linkedInDataExportService.getConnections();

      // Pre-filter to exclude already messaged
      const filtered = linkedInDataExportService.preFilterConnections({
        excludePreviouslyMessaged: true,
      });

      // Get this batch
      const batch = filtered.slice(startIndex, startIndex + batchSize);

      if (batch.length === 0) {
        console.log('No more contacts to analyze');
        this.isRunning = false;
        return result;
      }

      console.log(`Found ${batch.length} contacts for this batch\n`);

      // Start browser session
      humanBehaviorService.startSession();

      // Maybe browse feed first (natural)
      if (Math.random() < 0.3) {
        console.log('Browsing feed first (natural behavior)...');
        await this.browseFeedBriefly();
      }

      // Analyze each contact
      for (let i = 0; i < batch.length; i++) {
        const connection = batch[i];

        console.log(`\n[${i + 1}/${batch.length}] Analyzing: ${connection.firstName} ${connection.lastName}`);

        try {
          const analyzed = await this.analyzeContact(connection);
          result.contacts.push(analyzed);

          // Update summary
          result.summary.byRegion[analyzed.location.region]++;
          if (analyzed.activity.isActive) result.summary.byActivity.active++;
          else if (analyzed.activity.level === 'moderate') result.summary.byActivity.moderate++;
          else if (analyzed.activity.level === 'inactive') result.summary.byActivity.inactive++;
          else result.summary.byActivity.unknown++;

          if (analyzed.language.detected) {
            result.summary.byLanguage[analyzed.language.detected] =
              (result.summary.byLanguage[analyzed.language.detected] || 0) + 1;
          }

          // Progress callback
          if (options?.onProgress) {
            options.onProgress(i + 1, batch.length, analyzed);
          }

          // Log quick summary
          const statusIcon = analyzed.scores.priority === 'high' ? '🟢' :
                            analyzed.scores.priority === 'medium' ? '🟡' :
                            analyzed.scores.priority === 'low' ? '🟠' : '🔴';
          console.log(`   ${statusIcon} Score: ${analyzed.scores.total.toFixed(0)} | ` +
                     `Region: ${analyzed.location.region} | ` +
                     `Activity: ${analyzed.activity.level} | ` +
                     `Language: ${analyzed.language.detected || '?'}`);

        } catch (error) {
          console.error(`   ❌ Error analyzing: ${error}`);
          result.contacts.push(this.createErrorContact(connection, error));
        }

        // Natural delay between profiles
        if (i < batch.length - 1) {
          const delay = humanBehaviorService.getProfileViewDelay();
          console.log(`   Waiting ${humanBehaviorService.formatDuration(delay)}...`);
          await humanBehaviorService.sleep(delay);

          // Occasional short break
          if (humanBehaviorService.shouldTakeBreak()) {
            const breakTime = humanBehaviorService.getRandomDelay(60000, 180000);
            console.log(`\n   ☕ Taking a short break (${humanBehaviorService.formatDuration(breakTime)})...`);
            await humanBehaviorService.sleep(breakTime);
          }
        }
      }

      // Calculate final summary
      result.summary.total = result.contacts.length;
      result.summary.qualified = result.contacts.filter(c =>
        c.scores.priority === 'high' || c.scores.priority === 'medium'
      ).length;
      result.summary.filtered = result.contacts.filter(c =>
        c.scores.priority === 'skip'
      ).length;

      const totalScore = result.contacts.reduce((sum, c) => sum + c.scores.total, 0);
      result.summary.avgScore = result.contacts.length > 0 ? totalScore / result.contacts.length : 0;

      // Store batch
      this.batches.push(result);
      this.currentBatchIndex++;

      this.printBatchSummary(result);

    } finally {
      this.isRunning = false;
      await linkedInAuthService.closeBrowser();
    }

    return result;
  }

  /**
   * Analyze a single contact (visit profile, extract data)
   */
  private async analyzeContact(connection: any): Promise<AnalyzedContact> {
    const profileUrl = connection.profileUrl ||
      `https://www.linkedin.com/in/${connection.firstName?.toLowerCase()}-${connection.lastName?.toLowerCase()}`;

    // Navigate to profile
    const navResult = await linkedInAuthService.navigateTo(profileUrl);
    if (!navResult.success) {
      throw new Error(navResult.error || 'Navigation failed');
    }

    const page = await linkedInAuthService.getPage();

    // Wait for profile to load
    await humanBehaviorService.randomSleep(2000, 4000);

    // Extract profile data
    const profileData = await this.extractFullProfileData(page);

    // Detect language
    const language = await this.detectProfileLanguage(page, profileData);

    // Parse location
    const locationInfo = locationParserService.parseLocation(profileData.location);

    // Calculate activity
    let daysSinceActivity: number | null = null;
    if (profileData.activityLevel === 'very_active') daysSinceActivity = 3;
    else if (profileData.activityLevel === 'active') daysSinceActivity = 15;
    else if (profileData.activityLevel === 'moderate') daysSinceActivity = 60;
    else if (profileData.activityLevel === 'low') daysSinceActivity = 120;
    else if (profileData.activityLevel === 'inactive') daysSinceActivity = 200;

    const isActive = daysSinceActivity !== null && daysSinceActivity <= targetingConfig.activityThreshold.maxInactiveDays;

    // Calculate score
    const scoreBreakdown: string[] = [];

    let score = 50; // Base score

    // Activity scoring
    if (profileData.activityLevel === 'very_active') {
      score += 25;
      scoreBreakdown.push('+25 Very active');
    } else if (profileData.activityLevel === 'active') {
      score += 15;
      scoreBreakdown.push('+15 Active');
    } else if (profileData.activityLevel === 'moderate') {
      score += 5;
      scoreBreakdown.push('+5 Moderately active');
    } else if (profileData.activityLevel === 'inactive') {
      score -= 20;
      scoreBreakdown.push('-20 Inactive');
    }

    // Region scoring
    if (locationInfo.isTargetRegion) {
      score += 15;
      scoreBreakdown.push(`+15 Target region (${locationInfo.region})`);
    } else if (locationInfo.region !== 'unknown') {
      score -= 30;
      scoreBreakdown.push(`-30 Outside target region (${locationInfo.region})`);
    }

    // Profile quality
    if (profileData.hasPhoto) {
      score += 5;
      scoreBreakdown.push('+5 Has photo');
    } else {
      score -= 15;
      scoreBreakdown.push('-15 No photo');
    }

    if (profileData.isCreator) {
      score += 10;
      scoreBreakdown.push('+10 Creator mode');
    }

    if (profileData.isPremium) {
      score += 5;
      scoreBreakdown.push('+5 Premium account');
    }

    // Determine priority
    let priority: 'high' | 'medium' | 'low' | 'skip';
    if (score >= 70) priority = 'high';
    else if (score >= 50) priority = 'medium';
    else if (score >= 30) priority = 'low';
    else priority = 'skip';

    // Simulate reading the profile
    await this.simulateProfileReading(page);

    return {
      linkedInId: connection.profileUrl?.match(/\/in\/([^/]+)/)?.[1] || '',
      profileUrl,
      fullName: `${connection.firstName} ${connection.lastName}`.trim(),
      firstName: connection.firstName || '',
      lastName: connection.lastName || '',
      headline: profileData.headline || connection.position || '',

      company: connection.company,
      position: connection.position,
      email: connection.emailAddress,
      connectionDate: connection.connectedOn,
      previouslyMessaged: linkedInDataExportService.hasPreviouslyMessaged(profileUrl),

      location: {
        raw: profileData.location,
        country: locationInfo.country,
        region: locationInfo.region,
        isTargetRegion: locationInfo.isTargetRegion,
      },

      activity: {
        level: profileData.activityLevel,
        daysSinceActivity,
        isActive,
      },

      profile: {
        hasPhoto: profileData.hasPhoto,
        hasAbout: profileData.hasAbout,
        experienceCount: profileData.experienceCount,
        isPremium: profileData.isPremium,
        isCreator: profileData.isCreator,
        isOpenToMessages: profileData.isOpenToMessages,
      },

      language,

      scores: {
        total: Math.max(0, Math.min(100, score)),
        priority,
        breakdown: scoreBreakdown,
      },

      status: 'pending_review',
      reviewNotes: '',
      analyzedAt: new Date(),
    };
  }

  /**
   * Extract full profile data from page
   */
  private async extractFullProfileData(page: Page): Promise<any> {
    return await page.evaluate(() => {
      const getText = (selector: string): string => {
        const el = document.querySelector(selector);
        return el?.textContent?.trim() || '';
      };

      const exists = (selector: string): boolean => {
        return document.querySelector(selector) !== null;
      };

      // Basic info
      const name = getText('h1.text-heading-xlarge');
      const headline = getText('.text-body-medium.break-words');
      const location = getText('.text-body-small.inline.t-black--light.break-words');

      // About section
      const aboutSection = document.querySelector('#about');
      let about = '';
      if (aboutSection) {
        const aboutText = aboutSection.parentElement?.querySelector('.display-flex span[aria-hidden="true"]');
        about = aboutText?.textContent?.trim() || '';
      }

      // Photo
      const photoEl = document.querySelector('.pv-top-card-profile-picture__image');
      let hasPhoto = false;
      if (photoEl) {
        const src = photoEl.getAttribute('src') || '';
        hasPhoto = !src.includes('ghost') && !src.includes('default') && src.length > 0;
      }

      // Experience count
      const expSection = document.querySelector('#experience');
      let experienceCount = 0;
      if (expSection) {
        experienceCount = expSection.parentElement?.querySelectorAll('li.artdeco-list__item').length || 0;
      }

      // Badges
      const isPremium = exists('.premium-icon') || exists('.pv-member-badge--premium');
      const isCreator = exists('.creator-badge') || exists('[data-test-badge="creator"]');
      const isOpenToMessages = exists('.message-anywhere-button') || exists('.pv-top-card-v2-ctas .artdeco-button--primary');

      // Activity level
      let activityLevel: 'very_active' | 'active' | 'moderate' | 'low' | 'inactive' | 'unknown' = 'unknown';

      const activitySection = document.querySelector('.pv-recent-activity-section');
      if (activitySection) {
        const timeEl = activitySection.querySelector('time');
        if (timeEl) {
          const datetime = timeEl.getAttribute('datetime');
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

        // If no time found but section exists, assume some activity
        if (activityLevel === 'unknown' && activitySection.querySelectorAll('.feed-shared-update-v2').length > 0) {
          activityLevel = 'moderate';
        }
      }

      return {
        name,
        headline,
        location,
        about,
        hasPhoto,
        hasAbout: about.length > 0,
        experienceCount,
        isPremium,
        isCreator,
        isOpenToMessages,
        activityLevel,
      };
    });
  }

  /**
   * Detect profile language from various indicators
   */
  private async detectProfileLanguage(page: Page, profileData: any): Promise<{
    detected: string | null;
    confidence: number;
    indicators: string[];
  }> {
    const indicators: string[] = [];
    const languageScores: Record<string, number> = {};

    // 1. Check HTML lang attribute
    const htmlLang = await page.evaluate(() => {
      return document.documentElement.lang || '';
    });

    if (htmlLang) {
      const lang = htmlLang.split('-')[0].toLowerCase();
      languageScores[lang] = (languageScores[lang] || 0) + 2;
      indicators.push(`HTML lang: ${htmlLang}`);
    }

    // 2. Analyze headline text
    if (profileData.headline) {
      const headlineLang = this.detectTextLanguage(profileData.headline);
      if (headlineLang) {
        languageScores[headlineLang] = (languageScores[headlineLang] || 0) + 3;
        indicators.push(`Headline suggests: ${headlineLang}`);
      }
    }

    // 3. Analyze about section
    if (profileData.about) {
      const aboutLang = this.detectTextLanguage(profileData.about);
      if (aboutLang) {
        languageScores[aboutLang] = (languageScores[aboutLang] || 0) + 4;
        indicators.push(`About section suggests: ${aboutLang}`);
      }
    }

    // 4. Check location for language hints
    const location = profileData.location?.toLowerCase() || '';
    if (location.includes('brazil') || location.includes('brasil')) {
      languageScores['pt'] = (languageScores['pt'] || 0) + 2;
      indicators.push('Location: Brazil (Portuguese)');
    } else if (location.includes('spain') || location.includes('españa') ||
               location.includes('mexico') || location.includes('argentina')) {
      languageScores['es'] = (languageScores['es'] || 0) + 2;
      indicators.push('Location: Spanish-speaking country');
    } else if (location.includes('germany') || location.includes('deutschland')) {
      languageScores['de'] = (languageScores['de'] || 0) + 2;
      indicators.push('Location: Germany (German)');
    } else if (location.includes('france')) {
      languageScores['fr'] = (languageScores['fr'] || 0) + 2;
      indicators.push('Location: France (French)');
    } else if (location.includes('united states') || location.includes('usa') ||
               location.includes('uk') || location.includes('united kingdom') ||
               location.includes('canada') || location.includes('australia')) {
      languageScores['en'] = (languageScores['en'] || 0) + 2;
      indicators.push('Location: English-speaking country');
    }

    // Find the language with highest score
    let detected: string | null = null;
    let maxScore = 0;

    for (const [lang, score] of Object.entries(languageScores)) {
      if (score > maxScore) {
        maxScore = score;
        detected = lang;
      }
    }

    // Calculate confidence
    const totalScore = Object.values(languageScores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0;

    return {
      detected,
      confidence,
      indicators,
    };
  }

  /**
   * Simple text language detection
   */
  private detectTextLanguage(text: string): string | null {
    const lower = text.toLowerCase();

    // Spanish indicators
    const spanishWords = ['de', 'en', 'con', 'para', 'por', 'una', 'del', 'los', 'las', 'empresa', 'años', 'experiencia'];
    const spanishChars = /[áéíóúñ¿¡]/;

    // Portuguese indicators
    const portugueseWords = ['de', 'em', 'com', 'para', 'uma', 'dos', 'das', 'empresa', 'anos', 'experiência'];
    const portugueseChars = /[ãõç]/;

    // German indicators
    const germanWords = ['und', 'der', 'die', 'mit', 'für', 'bei', 'von'];
    const germanChars = /[äöüß]/;

    // French indicators
    const frenchWords = ['de', 'et', 'en', 'avec', 'pour', 'dans', 'chez'];
    const frenchChars = /[àâçéèêëïîôùûüÿœæ]/;

    // Count matches
    let enScore = 0, esScore = 0, ptScore = 0, deScore = 0, frScore = 0;

    // Check for special characters first (strong indicators)
    if (spanishChars.test(text) && !portugueseChars.test(text)) esScore += 5;
    if (portugueseChars.test(text)) ptScore += 5;
    if (germanChars.test(text)) deScore += 5;
    if (frenchChars.test(text)) frScore += 5;

    // Check common words
    const words = lower.split(/\s+/);
    for (const word of words) {
      if (spanishWords.includes(word)) esScore++;
      if (portugueseWords.includes(word)) ptScore++;
      if (germanWords.includes(word)) deScore++;
      if (frenchWords.includes(word)) frScore++;
    }

    // English is default for ambiguous cases with no special chars
    const hasSpecialChars = spanishChars.test(text) || portugueseChars.test(text) ||
                           germanChars.test(text) || frenchChars.test(text);

    if (!hasSpecialChars && esScore < 3 && ptScore < 3 && deScore < 3 && frScore < 3) {
      enScore = 3;
    }

    const scores: Record<string, number> = { en: enScore, es: esScore, pt: ptScore, de: deScore, fr: frScore };
    const maxLang = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b);

    return maxLang[1] > 0 ? maxLang[0] : null;
  }

  /**
   * Simulate reading a profile naturally
   */
  private async simulateProfileReading(page: Page): Promise<void> {
    const duration = humanBehaviorService.getRandomDelay(8000, 20000);
    const endTime = Date.now() + duration;

    while (Date.now() < endTime) {
      // Scroll down
      if (Math.random() < 0.5) {
        await page.evaluate(() => {
          window.scrollBy(0, 150 + Math.random() * 300);
        });
      }
      // Scroll up a bit
      else if (Math.random() < 0.3) {
        await page.evaluate(() => {
          window.scrollBy(0, -(50 + Math.random() * 150));
        });
      }

      await humanBehaviorService.randomSleep(800, 2500);
    }
  }

  /**
   * Browse feed briefly (natural behavior)
   */
  private async browseFeedBriefly(): Promise<void> {
    try {
      await linkedInAuthService.navigateTo('https://www.linkedin.com/feed/');
      const page = await linkedInAuthService.getPage();

      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, 400 + Math.random() * 300);
        });
        await humanBehaviorService.randomSleep(2000, 4000);
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Create error contact entry
   */
  private createErrorContact(connection: any, error: any): AnalyzedContact {
    return {
      linkedInId: '',
      profileUrl: connection.profileUrl || '',
      fullName: `${connection.firstName} ${connection.lastName}`.trim(),
      firstName: connection.firstName || '',
      lastName: connection.lastName || '',
      headline: connection.position || '',
      company: connection.company,
      position: connection.position,
      email: connection.emailAddress,
      connectionDate: connection.connectedOn,
      previouslyMessaged: false,
      location: { raw: '', country: null, region: 'unknown', isTargetRegion: false },
      activity: { level: 'unknown', daysSinceActivity: null, isActive: false },
      profile: { hasPhoto: false, hasAbout: false, experienceCount: 0, isPremium: false, isCreator: false, isOpenToMessages: false },
      language: { detected: null, confidence: 0, indicators: [] },
      scores: { total: 0, priority: 'skip', breakdown: [`Error: ${error}`] },
      status: 'error',
      reviewNotes: `Error: ${error instanceof Error ? error.message : error}`,
      analyzedAt: new Date(),
    };
  }

  /**
   * Print batch summary
   */
  private printBatchSummary(result: BatchResult): void {
    console.log('\n' + '='.repeat(60));
    console.log(`BATCH #${result.batchNumber} SUMMARY`);
    console.log('='.repeat(60));
    console.log(`Total analyzed: ${result.summary.total}`);
    console.log(`Qualified (high/medium): ${result.summary.qualified}`);
    console.log(`Filtered (skip): ${result.summary.filtered}`);
    console.log(`Average score: ${result.summary.avgScore.toFixed(1)}`);
    console.log('\nBy Region:');
    console.log(`  Europe: ${result.summary.byRegion.europe}`);
    console.log(`  Americas: ${result.summary.byRegion.americas}`);
    console.log(`  Other: ${result.summary.byRegion.other}`);
    console.log(`  Unknown: ${result.summary.byRegion.unknown}`);
    console.log('\nBy Activity:');
    console.log(`  Active: ${result.summary.byActivity.active}`);
    console.log(`  Moderate: ${result.summary.byActivity.moderate}`);
    console.log(`  Inactive: ${result.summary.byActivity.inactive}`);
    console.log(`  Unknown: ${result.summary.byActivity.unknown}`);
    console.log('\nBy Language:');
    for (const [lang, count] of Object.entries(result.summary.byLanguage)) {
      console.log(`  ${lang}: ${count}`);
    }
    console.log('='.repeat(60));
  }

  // ==========================================================================
  // MANUAL REVIEW HELPERS
  // ==========================================================================

  /**
   * Get contacts pending review from latest batch
   */
  getPendingReview(): AnalyzedContact[] {
    const latestBatch = this.batches[this.batches.length - 1];
    if (!latestBatch) return [];

    return latestBatch.contacts.filter(c => c.status === 'pending_review');
  }

  /**
   * Approve a contact for messaging
   */
  approveContact(linkedInId: string, notes?: string): boolean {
    for (const batch of this.batches) {
      const contact = batch.contacts.find(c => c.linkedInId === linkedInId);
      if (contact) {
        contact.status = 'approved';
        if (notes) contact.reviewNotes = notes;
        return true;
      }
    }
    return false;
  }

  /**
   * Reject a contact (won't be messaged)
   */
  rejectContact(linkedInId: string, reason?: string): boolean {
    for (const batch of this.batches) {
      const contact = batch.contacts.find(c => c.linkedInId === linkedInId);
      if (contact) {
        contact.status = 'rejected';
        if (reason) contact.reviewNotes = reason;
        return true;
      }
    }
    return false;
  }

  /**
   * Get approved contacts ready for messaging
   */
  getApprovedContacts(): AnalyzedContact[] {
    const approved: AnalyzedContact[] = [];
    for (const batch of this.batches) {
      approved.push(...batch.contacts.filter(c => c.status === 'approved'));
    }
    return approved;
  }

  /**
   * Get all batches
   */
  getBatches(): BatchResult[] {
    return [...this.batches];
  }

  /**
   * Format contacts for display/review
   */
  formatForReview(contacts: AnalyzedContact[]): string {
    let output = '';

    for (const c of contacts) {
      const statusIcon = c.scores.priority === 'high' ? '🟢' :
                        c.scores.priority === 'medium' ? '🟡' :
                        c.scores.priority === 'low' ? '🟠' : '🔴';

      output += `\n${statusIcon} ${c.fullName}\n`;
      output += `   ${c.headline || c.position || 'No headline'}\n`;
      output += `   Company: ${c.company || 'Unknown'}\n`;
      output += `   Location: ${c.location.raw} (${c.location.region})\n`;
      output += `   Activity: ${c.activity.level}`;
      if (c.activity.daysSinceActivity) {
        output += ` (~${c.activity.daysSinceActivity} days ago)`;
      }
      output += '\n';
      output += `   Language: ${c.language.detected || 'Unknown'} (${(c.language.confidence * 100).toFixed(0)}% confidence)\n`;
      output += `   Score: ${c.scores.total.toFixed(0)} (${c.scores.priority})\n`;
      output += `   Scoring: ${c.scores.breakdown.join(', ')}\n`;
      output += `   Profile: ${c.profileUrl}\n`;
      if (c.email) {
        output += `   Email: ${c.email}\n`;
      }
    }

    return output;
  }
}

// Export singleton instance
export const linkedInBatchService = new LinkedInBatchService();
