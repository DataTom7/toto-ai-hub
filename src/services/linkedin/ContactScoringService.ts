/**
 * Contact Scoring Service
 *
 * Scores and prioritizes LinkedIn contacts based on activity,
 * profile quality, engagement potential, and relevance.
 */

import {
  LinkedInContact,
  ContactScores,
  ContactPriority,
  ScoreBreakdown,
  ContactAnalysisReport,
  ContactStatus,
} from '../../types/linkedin.types';
import {
  scoringConfig,
  calculateActivityScore,
  calculateProfileScore,
  calculateEngagementScore,
  calculateRedFlagPenalty,
  calculatePriority,
} from '../../config/contact-scoring.config';
import { targetingConfig } from '../../config/targeting.config';

export class ContactScoringService {
  private scoredContacts: Map<string, ContactScores> = new Map();

  constructor() {
    console.log('ContactScoringService initialized');
  }

  /**
   * Score a single contact
   */
  scoreContact(contact: LinkedInContact): ContactScores {
    const breakdown: ScoreBreakdown = {
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
    };

    // =========================================================================
    // ACTIVITY SCORE (40% weight)
    // =========================================================================
    let activityScore = 0;

    // Activity recency
    if (contact.activity.daysSinceActivity !== null) {
      const recencyScore = calculateActivityScore(contact.activity.daysSinceActivity);
      breakdown.activityRecency = recencyScore;
      activityScore += recencyScore;

      if (contact.activity.daysSinceActivity <= 7) {
        breakdown.notes.push('Very active (activity in last 7 days)');
      } else if (contact.activity.daysSinceActivity <= 30) {
        breakdown.notes.push('Active (activity in last 30 days)');
      } else if (contact.activity.daysSinceActivity <= 90) {
        breakdown.notes.push('Moderately active (activity in last 90 days)');
      }
    }

    // Post frequency
    const { postFrequency } = contact.activity;
    if (postFrequency === 'weekly' || postFrequency === 'daily') {
      activityScore += scoringConfig.activityPoints.postsWeekly;
      breakdown.activityFrequency = scoringConfig.activityPoints.postsWeekly;
      breakdown.notes.push('Posts weekly or more');
    } else if (postFrequency === 'monthly') {
      activityScore += scoringConfig.activityPoints.postsMonthly;
      breakdown.activityFrequency = scoringConfig.activityPoints.postsMonthly;
      breakdown.notes.push('Posts monthly');
    }

    // Engagement with others
    if (contact.activity.hasRecentComment || contact.activity.hasRecentReaction) {
      activityScore += scoringConfig.activityPoints.engagesWithOthers;
      breakdown.contentEngagement = scoringConfig.activityPoints.engagesWithOthers;
      breakdown.notes.push('Engages with others\' content');
    }

    // Normalize to 0-100
    activityScore = Math.min(activityScore, 100);

    // =========================================================================
    // PROFILE QUALITY SCORE (15% weight)
    // =========================================================================
    const profileQualityScore = calculateProfileScore({
      hasPhoto: contact.profile.hasPhoto,
      hasCustomHeadline: contact.profile.hasCustomHeadline,
      hasAboutSection: contact.profile.hasAboutSection,
      experienceCount: contact.profile.experienceCount,
      educationCount: contact.profile.educationCount,
      skillsCount: contact.profile.skillsCount,
      recommendationsCount: contact.profile.recommendationsReceivedCount,
      hasCustomBanner: contact.profile.hasCustomBanner,
    });

    // Update breakdown
    if (contact.profile.hasPhoto) {
      breakdown.photoPoints = 20;
    }
    if (contact.profile.hasCustomHeadline) {
      breakdown.headlinePoints = 10;
    }
    if (contact.profile.hasAboutSection) {
      breakdown.aboutPoints = 15;
    }
    if (contact.profile.experienceCount > 0) {
      breakdown.experiencePoints = 15;
    }

    // =========================================================================
    // ENGAGEMENT SCORE (25% weight)
    // =========================================================================
    const engagementScore = calculateEngagementScore({
      isCreator: contact.engagement.isCreator,
      isPremium: contact.engagement.isPremium,
      isOpenToMessages: contact.engagement.isOpenToMessages,
      isInfluencer: contact.engagement.isInfluencer,
      followersCount: contact.engagement.followersCount,
      mutualConnectionsCount: contact.mutualConnectionsCount,
    });

    // Update breakdown
    if (contact.engagement.isCreator) {
      breakdown.creatorModePoints = 20;
      breakdown.notes.push('Creator mode enabled');
    }
    if (contact.engagement.isPremium) {
      breakdown.premiumPoints = 10;
      breakdown.notes.push('Premium account');
    }
    if (contact.engagement.isOpenToMessages) {
      breakdown.openToMessagesPoints = 15;
      breakdown.notes.push('Open to messages');
    }

    // =========================================================================
    // RELEVANCE SCORE (20% weight)
    // =========================================================================
    let relevanceScore = 50; // Base score

    // Location relevance
    if (contact.location.isTargetRegion) {
      relevanceScore += 25;
      breakdown.notes.push(`In target region: ${contact.location.region}`);
    } else if (contact.location.region === 'unknown') {
      // Neutral if unknown
    } else {
      relevanceScore -= 25;
      breakdown.notes.push(`Outside target region: ${contact.location.region}`);
    }

    // Connection recency
    if (contact.connectionDate) {
      const connectionAgeMonths = (Date.now() - contact.connectionDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (connectionAgeMonths <= 6) {
        relevanceScore += 15;
        breakdown.notes.push('Recent connection (< 6 months)');
      }
    }

    // Mutual connections
    if (contact.mutualConnectionsCount > 10) {
      relevanceScore += 10;
      breakdown.notes.push(`${contact.mutualConnectionsCount} mutual connections`);
    }

    relevanceScore = Math.min(Math.max(relevanceScore, 0), 100);

    // =========================================================================
    // RED FLAG PENALTIES
    // =========================================================================
    const connectionAgeMonths = contact.connectionDate
      ? (Date.now() - contact.connectionDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      : null;

    const { penalty, reasons } = calculateRedFlagPenalty({
      fullName: contact.fullName,
      headline: contact.headline,
      hasPhoto: contact.profile.hasPhoto,
      connectionsCount: contact.engagement.connectionsCount,
      daysSinceActivity: contact.activity.daysSinceActivity,
      connectionAgeMonths,
    });

    // Update breakdown with penalties
    if (!contact.profile.hasPhoto) {
      breakdown.noPhotopenalty = scoringConfig.penalties.noPhoto;
    }
    if (contact.activity.daysSinceActivity && contact.activity.daysSinceActivity > 180) {
      breakdown.inactivityPenalty = scoringConfig.penalties.noActivity6Months;
    }

    // Add penalty reasons to notes
    breakdown.notes.push(...reasons);

    // =========================================================================
    // CALCULATE TOTAL SCORE
    // =========================================================================
    const { weights } = scoringConfig;
    const weightedScore = (
      activityScore * weights.activity +
      profileQualityScore * weights.profileQuality +
      engagementScore * weights.engagement +
      relevanceScore * weights.relevance
    );

    const totalScore = Math.max(0, Math.min(100, weightedScore - penalty));
    const priority = calculatePriority(totalScore);

    const scores: ContactScores = {
      activityScore,
      profileQualityScore,
      engagementScore,
      relevanceScore,
      redFlagPenalty: penalty,
      totalScore,
      priority,
      breakdown,
    };

    // Cache the scores
    this.scoredContacts.set(contact.linkedInId, scores);

    return scores;
  }

  /**
   * Score multiple contacts
   */
  scoreContacts(contacts: LinkedInContact[]): Map<string, ContactScores> {
    const results = new Map<string, ContactScores>();

    for (const contact of contacts) {
      const scores = this.scoreContact(contact);
      results.set(contact.linkedInId, scores);
    }

    return results;
  }

  /**
   * Filter contacts based on targeting criteria
   */
  filterContacts(contacts: LinkedInContact[]): {
    qualified: LinkedInContact[];
    filteredRegion: LinkedInContact[];
    filteredInactive: LinkedInContact[];
    filteredBoth: LinkedInContact[];
    unknown: LinkedInContact[];
  } {
    const result = {
      qualified: [] as LinkedInContact[],
      filteredRegion: [] as LinkedInContact[],
      filteredInactive: [] as LinkedInContact[],
      filteredBoth: [] as LinkedInContact[],
      unknown: [] as LinkedInContact[],
    };

    const { activityThreshold } = targetingConfig;

    for (const contact of contacts) {
      const isInTargetRegion = contact.location.isTargetRegion;
      const regionKnown = contact.location.confidence > 0.5;

      const isActive = contact.activity.daysSinceActivity === null
        ? false
        : contact.activity.daysSinceActivity <= activityThreshold.maxInactiveDays;
      const activityKnown = contact.activity.level !== 'unknown';

      // Can't determine anything
      if (!regionKnown && !activityKnown) {
        result.unknown.push(contact);
        continue;
      }

      // Check filters
      const failsRegion = regionKnown && !isInTargetRegion;
      const failsActivity = activityKnown && !isActive;

      if (failsRegion && failsActivity) {
        result.filteredBoth.push(contact);
      } else if (failsRegion) {
        result.filteredRegion.push(contact);
      } else if (failsActivity) {
        result.filteredInactive.push(contact);
      } else {
        result.qualified.push(contact);
      }
    }

    return result;
  }

  /**
   * Determine contact status based on filters and scores
   */
  determineStatus(contact: LinkedInContact, scores: ContactScores): ContactStatus {
    const { activityThreshold } = targetingConfig;

    // Check region
    const isInTargetRegion = contact.location.isTargetRegion;
    const regionKnown = contact.location.confidence > 0.5;

    // Check activity
    const isActive = contact.activity.daysSinceActivity === null
      ? false
      : contact.activity.daysSinceActivity <= activityThreshold.maxInactiveDays;
    const activityKnown = contact.activity.level !== 'unknown';

    // Determine status
    const failsRegion = regionKnown && !isInTargetRegion;
    const failsActivity = activityKnown && !isActive;

    if (failsRegion && failsActivity) {
      return 'filtered_both';
    }
    if (failsRegion) {
      return 'filtered_region';
    }
    if (failsActivity) {
      return 'filtered_inactive';
    }
    if (scores.priority === 'skip') {
      return 'skip';
    }

    return 'qualified';
  }

  /**
   * Get skip reason for a contact
   */
  getSkipReason(contact: LinkedInContact, scores: ContactScores): string | null {
    const reasons: string[] = [];

    // Region
    if (!contact.location.isTargetRegion && contact.location.confidence > 0.5) {
      reasons.push(`Wrong region: ${contact.location.country || contact.location.raw || 'Unknown'}`);
    }

    // Activity
    const { activityThreshold } = targetingConfig;
    if (contact.activity.daysSinceActivity !== null &&
        contact.activity.daysSinceActivity > activityThreshold.maxInactiveDays) {
      reasons.push(`Inactive for ${contact.activity.daysSinceActivity} days`);
    }

    // Score too low
    if (scores.priority === 'skip') {
      reasons.push(`Score too low: ${scores.totalScore.toFixed(1)}`);
    }

    // Red flags
    if (scores.breakdown.notes.some(n => n.includes('No profile photo'))) {
      reasons.push('No profile photo');
    }

    return reasons.length > 0 ? reasons.join('; ') : null;
  }

  /**
   * Sort contacts by priority and score
   */
  sortByPriority(contacts: LinkedInContact[]): LinkedInContact[] {
    const priorityOrder: Record<ContactPriority, number> = {
      high: 0,
      medium: 1,
      low: 2,
      skip: 3,
    };

    return [...contacts].sort((a, b) => {
      const scoreA = this.scoredContacts.get(a.linkedInId);
      const scoreB = this.scoredContacts.get(b.linkedInId);

      if (!scoreA || !scoreB) return 0;

      // First by priority
      const priorityDiff = priorityOrder[scoreA.priority] - priorityOrder[scoreB.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by total score (higher first)
      return scoreB.totalScore - scoreA.totalScore;
    });
  }

  /**
   * Generate analysis report
   */
  generateReport(contacts: LinkedInContact[]): ContactAnalysisReport {
    const now = new Date();

    const report: ContactAnalysisReport = {
      generatedAt: now,
      totalContacts: contacts.length,
      analyzedContacts: contacts.filter(c => c.analysisComplete).length,
      analysisProgress: 0,
      priorityDistribution: { high: 0, medium: 0, low: 0, skip: 0 },
      filterResults: {
        qualified: 0,
        filteredRegion: 0,
        filteredInactive: 0,
        filteredBoth: 0,
        unknown: 0,
      },
      skipReasons: {
        wrongRegion: 0,
        inactive: 0,
        noPhoto: 0,
        incompleteProfile: 0,
        suspicious: 0,
        restricted: 0,
        other: 0,
      },
      activityLevels: {
        veryActive: 0,
        active: 0,
        moderate: 0,
        low: 0,
        inactive: 0,
        unknown: 0,
      },
      regionDistribution: { europe: 0, americas: 0, other: 0, unknown: 0 },
      topCountries: [],
      topIndustries: [],
      topCompanies: [],
      topRoles: [],
      connectionAgeDistribution: {
        lessThan1Month: 0,
        lessThan6Months: 0,
        lessThan1Year: 0,
        lessThan2Years: 0,
        moreThan2Years: 0,
        unknown: 0,
      },
      recommendations: {
        estimatedQualityContacts: 0,
        recommendedDailyOutreach: 25,
        estimatedCampaignDays: 0,
        topPriorityContacts: [],
      },
    };

    // Count containers
    const countryCount = new Map<string, number>();
    const industryCount = new Map<string, number>();
    const companyCount = new Map<string, number>();
    const roleCount = new Map<string, number>();

    for (const contact of contacts) {
      const scores = this.scoredContacts.get(contact.linkedInId);

      // Priority distribution
      if (scores) {
        report.priorityDistribution[scores.priority]++;
      }

      // Filter results
      const status = contact.status;
      if (status === 'qualified' || status === 'queued' || status === 'contacted') {
        report.filterResults.qualified++;
      } else if (status === 'filtered_region') {
        report.filterResults.filteredRegion++;
      } else if (status === 'filtered_inactive') {
        report.filterResults.filteredInactive++;
      } else if (status === 'filtered_both') {
        report.filterResults.filteredBoth++;
      } else {
        report.filterResults.unknown++;
      }

      // Activity levels
      const level = contact.activity.level;
      if (level === 'very_active') report.activityLevels.veryActive++;
      else if (level === 'active') report.activityLevels.active++;
      else if (level === 'moderate') report.activityLevels.moderate++;
      else if (level === 'low') report.activityLevels.low++;
      else if (level === 'inactive') report.activityLevels.inactive++;
      else report.activityLevels.unknown++;

      // Region distribution
      const region = contact.location.region;
      report.regionDistribution[region]++;

      // Country count
      if (contact.location.country) {
        countryCount.set(
          contact.location.country,
          (countryCount.get(contact.location.country) || 0) + 1
        );
      }

      // Industry count
      if (contact.industry) {
        industryCount.set(contact.industry, (industryCount.get(contact.industry) || 0) + 1);
      }

      // Company count
      if (contact.currentCompany) {
        companyCount.set(contact.currentCompany, (companyCount.get(contact.currentCompany) || 0) + 1);
      }

      // Role count (simplify headline to role)
      if (contact.currentRole) {
        roleCount.set(contact.currentRole, (roleCount.get(contact.currentRole) || 0) + 1);
      }

      // Connection age
      if (contact.connectionDate) {
        const ageMonths = (now.getTime() - contact.connectionDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (ageMonths < 1) report.connectionAgeDistribution.lessThan1Month++;
        else if (ageMonths < 6) report.connectionAgeDistribution.lessThan6Months++;
        else if (ageMonths < 12) report.connectionAgeDistribution.lessThan1Year++;
        else if (ageMonths < 24) report.connectionAgeDistribution.lessThan2Years++;
        else report.connectionAgeDistribution.moreThan2Years++;
      } else {
        report.connectionAgeDistribution.unknown++;
      }

      // Skip reasons
      if (contact.skipReason) {
        const reason = contact.skipReason.toLowerCase();
        if (reason.includes('region')) report.skipReasons.wrongRegion++;
        else if (reason.includes('inactive') || reason.includes('activity')) report.skipReasons.inactive++;
        else if (reason.includes('photo')) report.skipReasons.noPhoto++;
        else if (reason.includes('incomplete') || reason.includes('profile')) report.skipReasons.incompleteProfile++;
        else if (reason.includes('suspicious')) report.skipReasons.suspicious++;
        else if (reason.includes('restricted')) report.skipReasons.restricted++;
        else report.skipReasons.other++;
      }
    }

    // Calculate progress
    report.analysisProgress = contacts.length > 0
      ? (report.analyzedContacts / contacts.length) * 100
      : 0;

    // Sort and get top items
    report.topCountries = this.getTopItems(countryCount, 10);
    report.topIndustries = this.getTopItems(industryCount, 10);
    report.topCompanies = this.getTopItems(companyCount, 10);
    report.topRoles = this.getTopItems(roleCount, 10);

    // Calculate recommendations
    const qualityContacts = report.priorityDistribution.high + report.priorityDistribution.medium;
    report.recommendations.estimatedQualityContacts = qualityContacts;
    report.recommendations.estimatedCampaignDays = Math.ceil(qualityContacts / 25);

    // Get top priority contacts
    const sorted = this.sortByPriority(contacts);
    report.recommendations.topPriorityContacts = sorted
      .filter(c => {
        const scores = this.scoredContacts.get(c.linkedInId);
        return scores && scores.priority === 'high';
      })
      .slice(0, 20)
      .map(c => c.linkedInId);

    return report;
  }

  /**
   * Get top N items from a count map
   */
  private getTopItems(countMap: Map<string, number>, limit: number): { name: string; count: number }[] {
    return Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  }

  /**
   * Get cached scores for a contact
   */
  getScores(contactId: string): ContactScores | null {
    return this.scoredContacts.get(contactId) || null;
  }

  /**
   * Clear scoring cache
   */
  clearCache(): void {
    this.scoredContacts.clear();
    console.log('Scoring cache cleared');
  }
}

// Export singleton instance
export const contactScoringService = new ContactScoringService();
