/**
 * LinkedIn Bot Types
 *
 * Type definitions for the LinkedIn messaging bot and contact analysis system.
 */

// ============================================================================
// REGION & LOCATION TYPES
// ============================================================================

export type TargetRegion = 'europe' | 'americas' | 'other' | 'unknown';

export interface LocationInfo {
  raw: string;                    // Original location string from LinkedIn
  country: string | null;         // Parsed country name
  city: string | null;            // Parsed city name
  region: TargetRegion;           // Classified region
  isTargetRegion: boolean;        // Is in Europe or Americas
  confidence: number;             // Confidence in the parsing (0-1)
}

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export type ActivityLevel = 'very_active' | 'active' | 'moderate' | 'low' | 'inactive' | 'unknown';

export interface ActivityInfo {
  lastActivityDate: Date | null;
  daysSinceActivity: number | null;
  level: ActivityLevel;
  isActive: boolean;              // Activity within threshold (90 days)

  // Activity indicators
  hasRecentPost: boolean;         // Posted in last 30 days
  hasRecentComment: boolean;      // Commented in last 30 days
  hasRecentReaction: boolean;     // Reacted in last 30 days
  hasRecentProfileUpdate: boolean; // Updated profile in last 90 days

  // Content patterns
  postFrequency: 'daily' | 'weekly' | 'monthly' | 'rare' | 'none' | 'unknown';
  estimatedPostsPerMonth: number | null;
}

// ============================================================================
// PROFILE TYPES
// ============================================================================

export interface ProfileCompleteness {
  hasPhoto: boolean;
  hasCustomHeadline: boolean;
  hasAboutSection: boolean;
  hasExperience: boolean;
  hasEducation: boolean;
  hasSkills: boolean;
  hasRecommendations: boolean;
  hasCustomBanner: boolean;

  // Counts
  experienceCount: number;
  educationCount: number;
  skillsCount: number;
  recommendationsGivenCount: number;
  recommendationsReceivedCount: number;

  // Score (0-100)
  completenessScore: number;
}

export interface EngagementIndicators {
  isCreator: boolean;             // Creator mode enabled
  isPremium: boolean;             // Premium account
  isOpenToMessages: boolean;      // Open to InMail
  isInfluencer: boolean;          // LinkedIn Top Voice or similar

  followersCount: number | null;  // If creator mode
  connectionsCount: string;       // "500+", "1K+", etc.
  connectionsNumeric: number | null; // Parsed numeric value
}

// ============================================================================
// CONTACT TYPES
// ============================================================================

export interface LinkedInContact {
  // Identity
  linkedInId: string;
  profileUrl: string;
  publicIdentifier: string;       // The URL slug (e.g., "john-doe-123")

  // Basic info
  firstName: string;
  lastName: string;
  fullName: string;
  headline: string;

  // Professional
  currentCompany: string | null;
  currentRole: string | null;
  industry: string | null;

  // Location
  location: LocationInfo;

  // Activity
  activity: ActivityInfo;

  // Profile
  profilePhotoUrl: string | null;
  bannerImageUrl: string | null;
  profile: ProfileCompleteness;
  engagement: EngagementIndicators;

  // Connection details
  connectionDate: Date | null;
  connectionDegree: '1st' | '2nd' | '3rd' | 'out_of_network';
  mutualConnectionsCount: number;
  sharedGroupsCount: number;

  // Relationship
  hasMessaged: boolean;           // Have we messaged before
  hasPreviousInteraction: boolean; // Any previous interaction

  // Scoring
  scores: ContactScores;

  // Status
  status: ContactStatus;
  skipReason: string | null;

  // Metadata
  scrapedAt: Date;
  lastUpdated: Date;
  analysisComplete: boolean;

  // Custom fields
  tags: string[];
  notes: string;
}

export type ContactStatus =
  | 'pending'        // Not yet analyzed
  | 'analyzing'      // Currently being analyzed
  | 'qualified'      // Passes all filters
  | 'filtered_region' // Filtered: wrong region
  | 'filtered_inactive' // Filtered: inactive
  | 'filtered_both'  // Filtered: wrong region AND inactive
  | 'skip'           // Skip for other reasons
  | 'queued'         // Queued for messaging
  | 'contacted'      // Message sent
  | 'responded'      // They responded
  | 'error';         // Error during analysis

// ============================================================================
// SCORING TYPES
// ============================================================================

export interface ContactScores {
  // Individual scores (0-100)
  activityScore: number;
  profileQualityScore: number;
  engagementScore: number;
  relevanceScore: number;

  // Penalties
  redFlagPenalty: number;

  // Final
  totalScore: number;
  priority: ContactPriority;

  // Breakdown for debugging
  breakdown: ScoreBreakdown;
}

export type ContactPriority = 'high' | 'medium' | 'low' | 'skip';

export interface ScoreBreakdown {
  // Activity breakdown
  activityRecency: number;        // Points for recent activity
  activityFrequency: number;      // Points for posting frequency
  contentEngagement: number;      // Points for engaging with others

  // Profile breakdown
  photoPoints: number;
  headlinePoints: number;
  aboutPoints: number;
  experiencePoints: number;

  // Engagement breakdown
  creatorModePoints: number;
  premiumPoints: number;
  openToMessagesPoints: number;

  // Penalties
  noPhotopenalty: number;
  inactivityPenalty: number;
  incompleteProfilePenalty: number;

  // Notes
  notes: string[];
}

// ============================================================================
// SCANNING & ANALYSIS TYPES
// ============================================================================

export interface ScanProgress {
  phase: 'idle' | 'exporting_connections' | 'analyzing_profiles' | 'scoring' | 'complete' | 'error';
  totalContacts: number;
  exportedContacts: number;
  analyzedContacts: number;
  scoredContacts: number;

  currentBatch: number;
  totalBatches: number;

  startTime: Date | null;
  estimatedCompletion: Date | null;

  errors: ScanError[];
  warnings: string[];
}

export interface ScanError {
  contactId: string | null;
  phase: string;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

export interface ScanSession {
  sessionId: string;
  startTime: Date;
  endTime: Date | null;

  profilesScanned: number;
  profilesPerHour: number;

  status: 'active' | 'paused' | 'completed' | 'error' | 'warning';
  pauseReason: string | null;

  // Stats
  qualified: number;
  filteredRegion: number;
  filteredInactive: number;
  errors: number;
}

// ============================================================================
// REPORT TYPES
// ============================================================================

export interface ContactAnalysisReport {
  // Summary
  generatedAt: Date;
  totalContacts: number;
  analyzedContacts: number;
  analysisProgress: number;       // percentage

  // Priority distribution
  priorityDistribution: {
    high: number;
    medium: number;
    low: number;
    skip: number;
  };

  // Filter results
  filterResults: {
    qualified: number;            // Passed all filters
    filteredRegion: number;       // Wrong region
    filteredInactive: number;     // Inactive
    filteredBoth: number;         // Both issues
    unknown: number;              // Could not determine
  };

  // Skip reasons breakdown
  skipReasons: {
    wrongRegion: number;
    inactive: number;
    noPhoto: number;
    incompleteProfile: number;
    suspicious: number;
    restricted: number;
    other: number;
  };

  // Activity distribution
  activityLevels: {
    veryActive: number;
    active: number;
    moderate: number;
    low: number;
    inactive: number;
    unknown: number;
  };

  // Region distribution
  regionDistribution: {
    europe: number;
    americas: number;
    other: number;
    unknown: number;
  };

  // Top items
  topCountries: { name: string; count: number }[];
  topIndustries: { name: string; count: number }[];
  topCompanies: { name: string; count: number }[];
  topRoles: { name: string; count: number }[];

  // Connection age distribution
  connectionAgeDistribution: {
    lessThan1Month: number;
    lessThan6Months: number;
    lessThan1Year: number;
    lessThan2Years: number;
    moreThan2Years: number;
    unknown: number;
  };

  // Recommendations
  recommendations: {
    estimatedQualityContacts: number;
    recommendedDailyOutreach: number;
    estimatedCampaignDays: number;
    topPriorityContacts: string[];  // Contact IDs
  };
}

// ============================================================================
// MESSAGING TYPES (Phase 1+)
// ============================================================================

export interface MessageTemplate {
  id: string;
  name: string;
  category: 'reconnect' | 'introduction' | 'followup' | 'custom';

  // Template variations (for A/B testing and variety)
  variations: string[];

  // Variables that can be replaced
  variables: string[];  // e.g., ['firstName', 'company', 'mutualConnections']

  // Metadata
  createdAt: Date;
  usageCount: number;
  responseRate: number | null;
}

export interface MessageQueueItem {
  id: string;
  contactId: string;
  templateId: string;
  personalizedMessage: string;

  priority: number;
  scheduledFor: Date;

  status: 'pending' | 'in_progress' | 'sent' | 'failed' | 'skipped';
  sentAt: Date | null;
  error: string | null;

  retryCount: number;
  maxRetries: number;
}

export interface MessagingSession {
  sessionId: string;
  startTime: Date;
  endTime: Date | null;

  messagesSent: number;
  messagesAttempted: number;
  messagesFailed: number;

  status: 'active' | 'paused' | 'completed' | 'error' | 'daily_limit' | 'warning';
  pauseReason: string | null;

  // Behavior tracking
  profilesViewed: number;
  averageTypingTime: number;
  averageDelayBetweenMessages: number;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface LinkedInConfig {
  // Credentials (loaded from env)
  email: string;
  password: string;

  // Limits
  maxMessagesPerDay: number;
  maxProfilesPerDay: number;
  maxConnectionsPerDay: number;

  // Session behavior
  sessionDuration: { min: number; max: number };
  breakBetweenSessions: { min: number; max: number };

  // Message timing
  delayBetweenMessages: { min: number; max: number };
  typingSpeedWPM: { min: number; max: number };

  // Working hours
  workingHours: {
    start: number;
    end: number;
    daysOfWeek: number[];
    timezone: string;
  };

  // Randomization
  viewProfileBeforeMessage: number;  // probability 0-1
  scrollFeedProbability: number;
  takeBreakProbability: number;

  // Safety
  pauseOnWarning: boolean;
  maxConsecutiveErrors: number;
  dryRunMode: boolean;
}

export interface TargetingConfig {
  // Connection degree
  connectionDegree: '1st' | '2nd' | 'all';

  // Regions
  targetRegions: TargetRegion[];
  europeCountries: string[];
  americasCountries: string[];

  // Activity
  activityThreshold: {
    maxInactiveDays: number;
    minimumActivityScore: number;
  };

  // Optional filters
  industries: string[] | null;
  companies: string[] | null;
  roles: string[] | null;
  excludeKeywords: string[];
}

export interface ScoringConfig {
  weights: {
    activity: number;
    profileQuality: number;
    engagement: number;
    relevance: number;
  };

  thresholds: {
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
  };

  activityPoints: {
    last30Days: number;
    last90Days: number;
    postsWeekly: number;
    postsMonthly: number;
    creatorMode: number;
    engagesWithOthers: number;
    profileUpdated: number;
    premium: number;
  };

  penalties: {
    noPhoto: number;
    noActivity6Months: number;
    noActivity12Months: number;
    incompleteProfile: number;
    oldConnection: number;
    suspicious: number;
  };
}

// ============================================================================
// BROWSER AUTOMATION TYPES
// ============================================================================

export interface BrowserSession {
  sessionId: string;
  startTime: Date;
  lastActivity: Date;

  isLoggedIn: boolean;
  loginAttempts: number;
  lastLoginAttempt: Date | null;

  pagesVisited: number;
  actionsPerformed: number;

  warnings: string[];
  errors: string[];

  status: 'initializing' | 'active' | 'paused' | 'cooldown' | 'error' | 'closed';
}

export interface HumanBehaviorConfig {
  // Mouse movement
  mouseMovementEnabled: boolean;
  mouseSpeedVariation: { min: number; max: number };

  // Scrolling
  scrollEnabled: boolean;
  scrollSpeedVariation: { min: number; max: number };
  scrollPauseChance: number;

  // Typing
  typingSpeedWPM: { min: number; max: number };
  typingMistakeChance: number;
  typingPauseChance: number;

  // Delays
  pageLoadDelay: { min: number; max: number };
  actionDelay: { min: number; max: number };
  readingTimePerWord: { min: number; max: number };

  // Sessions
  sessionDuration: { min: number; max: number };
  breakDuration: { min: number; max: number };
  breakProbability: number;
}
