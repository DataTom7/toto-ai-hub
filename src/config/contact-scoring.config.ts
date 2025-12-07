/**
 * Contact Scoring Configuration
 *
 * Defines the scoring algorithm weights and thresholds
 * for prioritizing LinkedIn contacts.
 *
 * Since we're targeting ACTIVE users in Europe/Americas,
 * activity is heavily weighted.
 */

import { ScoringConfig } from '../types/linkedin.types';

/**
 * Main scoring configuration
 */
export const scoringConfig: ScoringConfig = {
  // Category weights (must sum to 1.0)
  weights: {
    activity: 0.40,         // 40% - Most important since we want active users
    profileQuality: 0.15,   // 15% - Basic profile quality
    engagement: 0.25,       // 25% - Will they respond?
    relevance: 0.20,        // 20% - Are they worth reaching out to?
  },

  // Priority thresholds (0-100 scale)
  thresholds: {
    highPriority: 70,       // Score >= 70 = High priority
    mediumPriority: 45,     // Score >= 45 = Medium priority
    lowPriority: 20,        // Score >= 20 = Low priority
    // Below 20 = Skip
  },

  // Activity scoring points
  activityPoints: {
    last30Days: 40,         // Very active: posted/engaged in last 30 days
    last90Days: 25,         // Active: posted/engaged in last 90 days
    postsWeekly: 20,        // Posts weekly or more
    postsMonthly: 10,       // Posts monthly
    creatorMode: 15,        // Has creator mode enabled
    engagesWithOthers: 10,  // Comments/reacts on others' posts
    profileUpdated: 10,     // Updated profile recently
    premium: 5,             // Has Premium account
  },

  // Penalties (negative points)
  penalties: {
    noPhoto: -50,           // No profile photo (major red flag)
    noActivity6Months: -20, // No activity in 6+ months
    noActivity12Months: -40, // No activity in 12+ months
    incompleteProfile: -15, // Very incomplete profile
    oldConnection: -10,     // Connected 3+ years ago, never interacted
    suspicious: -100,       // Suspicious/fake account indicators
  },
};

/**
 * Activity level thresholds (in days)
 */
export const activityThresholds = {
  veryActive: 7,      // Activity within 7 days
  active: 30,         // Activity within 30 days
  moderate: 90,       // Activity within 90 days
  low: 180,           // Activity within 180 days
  inactive: Infinity, // No activity in 180+ days
};

/**
 * Profile completeness scoring
 */
export const profileCompletenessPoints = {
  hasPhoto: 20,
  hasCustomHeadline: 10,
  hasAboutSection: 15,
  hasExperience: 15,
  hasEducation: 10,
  hasSkills: 10,
  hasRecommendations: 10,
  hasCustomBanner: 5,
  // Bonus for multiple items
  experienceBonus: 2,       // Per additional experience (max 10 bonus)
  skillsBonus: 0.5,         // Per skill (max 10 bonus)
  recommendationsBonus: 3,  // Per recommendation (max 15 bonus)
};

/**
 * Engagement scoring
 */
export const engagementPoints = {
  isCreator: 20,
  isPremium: 10,
  isOpenToMessages: 15,
  isInfluencer: 25,
  followersBonus: {
    // Bonus based on follower count (if creator)
    100: 5,
    500: 10,
    1000: 15,
    5000: 20,
    10000: 25,
  },
  mutualConnectionsBonus: {
    // Bonus based on mutual connections
    1: 5,
    5: 10,
    10: 15,
    20: 20,
    50: 25,
  },
};

/**
 * Relevance scoring (optional filters)
 */
export const relevancePoints = {
  // Match bonuses
  industryMatch: 20,
  companyMatch: 15,
  roleMatch: 15,
  locationMatch: 10,

  // Relationship bonuses
  recentConnection: 15,     // Connected in last 6 months
  hasPreviousInteraction: 25,
  sharedGroups: 10,
};

/**
 * Red flag indicators for suspicious accounts
 */
export const redFlagIndicators = {
  // Name patterns that might indicate fake accounts
  suspiciousNamePatterns: [
    /^[A-Z]{2,4}\s[A-Z]{2,4}$/,  // All caps initials
    /\d{4,}$/,                    // Ends with many numbers
    /^[a-z]+\d+$/i,               // Name followed by numbers
  ],

  // Headline patterns
  suspiciousHeadlinePatterns: [
    /^$/,                         // Empty headline
    /^[-]+$/,                     // Just dashes
    /^student$/i,                 // Just "student" (often incomplete)
    /looking for opportunities/i, // Generic seeking text (not inherently bad, but skip)
  ],

  // Other indicators
  maxConnectionsThreshold: 30000, // Extremely high connections (might be a bot)
  minConnectionsThreshold: 5,     // Very few connections (inactive or new)
};

/**
 * Calculate activity score based on last activity date
 */
export function calculateActivityScore(daysSinceActivity: number | null): number {
  if (daysSinceActivity === null) {
    return 0; // Unknown activity
  }

  if (daysSinceActivity <= activityThresholds.veryActive) {
    return scoringConfig.activityPoints.last30Days + 10; // Bonus for very recent
  }

  if (daysSinceActivity <= activityThresholds.active) {
    return scoringConfig.activityPoints.last30Days;
  }

  if (daysSinceActivity <= activityThresholds.moderate) {
    return scoringConfig.activityPoints.last90Days;
  }

  if (daysSinceActivity <= activityThresholds.low) {
    return scoringConfig.activityPoints.last90Days / 2;
  }

  // Inactive
  return 0;
}

/**
 * Calculate profile completeness score
 */
export function calculateProfileScore(profile: {
  hasPhoto: boolean;
  hasCustomHeadline: boolean;
  hasAboutSection: boolean;
  experienceCount: number;
  educationCount: number;
  skillsCount: number;
  recommendationsCount: number;
  hasCustomBanner: boolean;
}): number {
  let score = 0;

  if (profile.hasPhoto) score += profileCompletenessPoints.hasPhoto;
  if (profile.hasCustomHeadline) score += profileCompletenessPoints.hasCustomHeadline;
  if (profile.hasAboutSection) score += profileCompletenessPoints.hasAboutSection;
  if (profile.experienceCount > 0) score += profileCompletenessPoints.hasExperience;
  if (profile.educationCount > 0) score += profileCompletenessPoints.hasEducation;
  if (profile.skillsCount > 0) score += profileCompletenessPoints.hasSkills;
  if (profile.recommendationsCount > 0) score += profileCompletenessPoints.hasRecommendations;
  if (profile.hasCustomBanner) score += profileCompletenessPoints.hasCustomBanner;

  // Bonuses
  score += Math.min(profile.experienceCount * profileCompletenessPoints.experienceBonus, 10);
  score += Math.min(profile.skillsCount * profileCompletenessPoints.skillsBonus, 10);
  score += Math.min(profile.recommendationsCount * profileCompletenessPoints.recommendationsBonus, 15);

  // Normalize to 0-100
  return Math.min(score, 100);
}

/**
 * Calculate engagement score
 */
export function calculateEngagementScore(engagement: {
  isCreator: boolean;
  isPremium: boolean;
  isOpenToMessages: boolean;
  isInfluencer: boolean;
  followersCount: number | null;
  mutualConnectionsCount: number;
}): number {
  let score = 0;

  if (engagement.isCreator) score += engagementPoints.isCreator;
  if (engagement.isPremium) score += engagementPoints.isPremium;
  if (engagement.isOpenToMessages) score += engagementPoints.isOpenToMessages;
  if (engagement.isInfluencer) score += engagementPoints.isInfluencer;

  // Followers bonus (if creator)
  if (engagement.isCreator && engagement.followersCount) {
    const thresholds = Object.entries(engagementPoints.followersBonus)
      .map(([k, v]) => [parseInt(k), v] as [number, number])
      .sort((a, b) => b[0] - a[0]);

    for (const [threshold, bonus] of thresholds) {
      if (engagement.followersCount >= threshold) {
        score += bonus;
        break;
      }
    }
  }

  // Mutual connections bonus
  const mutualThresholds = Object.entries(engagementPoints.mutualConnectionsBonus)
    .map(([k, v]) => [parseInt(k), v] as [number, number])
    .sort((a, b) => b[0] - a[0]);

  for (const [threshold, bonus] of mutualThresholds) {
    if (engagement.mutualConnectionsCount >= threshold) {
      score += bonus;
      break;
    }
  }

  // Normalize to 0-100
  return Math.min(score, 100);
}

/**
 * Check for red flags and return penalty points
 */
export function calculateRedFlagPenalty(contact: {
  fullName: string;
  headline: string;
  hasPhoto: boolean;
  connectionsCount: string;
  daysSinceActivity: number | null;
  connectionAgeMonths: number | null;
}): { penalty: number; reasons: string[] } {
  let penalty = 0;
  const reasons: string[] = [];

  // No photo
  if (!contact.hasPhoto) {
    penalty += Math.abs(scoringConfig.penalties.noPhoto);
    reasons.push('No profile photo');
  }

  // Inactivity
  if (contact.daysSinceActivity !== null) {
    if (contact.daysSinceActivity > 365) {
      penalty += Math.abs(scoringConfig.penalties.noActivity12Months);
      reasons.push('No activity in 12+ months');
    } else if (contact.daysSinceActivity > 180) {
      penalty += Math.abs(scoringConfig.penalties.noActivity6Months);
      reasons.push('No activity in 6+ months');
    }
  }

  // Old connection with no interaction
  if (contact.connectionAgeMonths && contact.connectionAgeMonths > 36) {
    penalty += Math.abs(scoringConfig.penalties.oldConnection);
    reasons.push('Old connection (3+ years)');
  }

  // Suspicious name patterns
  for (const pattern of redFlagIndicators.suspiciousNamePatterns) {
    if (pattern.test(contact.fullName)) {
      penalty += Math.abs(scoringConfig.penalties.suspicious);
      reasons.push('Suspicious name pattern');
      break;
    }
  }

  // Suspicious headline
  for (const pattern of redFlagIndicators.suspiciousHeadlinePatterns) {
    if (pattern.test(contact.headline)) {
      penalty += 10; // Minor penalty
      reasons.push('Generic/empty headline');
      break;
    }
  }

  // Connection count extremes
  const connectionsNum = parseConnectionsCount(contact.connectionsCount);
  if (connectionsNum !== null) {
    if (connectionsNum > redFlagIndicators.maxConnectionsThreshold) {
      penalty += 15;
      reasons.push('Unusually high connection count');
    } else if (connectionsNum < redFlagIndicators.minConnectionsThreshold) {
      penalty += 10;
      reasons.push('Very few connections');
    }
  }

  return { penalty, reasons };
}

/**
 * Parse connections count string to number
 */
function parseConnectionsCount(count: string): number | null {
  if (!count) return null;

  // Handle "500+", "1K+", "10K+", etc.
  const cleaned = count.replace(/[+,]/g, '').trim().toLowerCase();

  if (cleaned.endsWith('k')) {
    return parseInt(cleaned) * 1000;
  }

  const parsed = parseInt(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Calculate final priority based on total score
 */
export function calculatePriority(totalScore: number): 'high' | 'medium' | 'low' | 'skip' {
  if (totalScore >= scoringConfig.thresholds.highPriority) {
    return 'high';
  }
  if (totalScore >= scoringConfig.thresholds.mediumPriority) {
    return 'medium';
  }
  if (totalScore >= scoringConfig.thresholds.lowPriority) {
    return 'low';
  }
  return 'skip';
}
