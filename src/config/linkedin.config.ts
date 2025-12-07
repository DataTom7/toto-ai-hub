/**
 * LinkedIn Bot Configuration
 *
 * Main configuration for the LinkedIn messaging bot.
 * Credentials are loaded from environment variables.
 */

import { LinkedInConfig, HumanBehaviorConfig } from '../types/linkedin.types';

/**
 * Main LinkedIn configuration
 */
export const linkedInConfig: LinkedInConfig = {
  // Credentials (loaded from environment)
  email: process.env.LINKEDIN_EMAIL || '',
  password: process.env.LINKEDIN_PASSWORD || '',

  // Daily limits (conservative to avoid detection)
  maxMessagesPerDay: parseInt(process.env.LINKEDIN_MAX_DAILY_MESSAGES || '25', 10),
  maxProfilesPerDay: parseInt(process.env.LINKEDIN_MAX_PROFILES_PER_DAY || '80', 10),
  maxConnectionsPerDay: 20,

  // Session behavior (in minutes)
  sessionDuration: { min: 15, max: 45 },
  breakBetweenSessions: { min: 60, max: 180 },

  // Message timing (in minutes)
  delayBetweenMessages: { min: 3, max: 12 },
  typingSpeedWPM: { min: 35, max: 55 },

  // Working hours
  workingHours: {
    start: 9,                     // 9 AM
    end: 19,                      // 7 PM
    daysOfWeek: [1, 2, 3, 4, 5],  // Monday to Friday
    timezone: process.env.LINKEDIN_TIMEZONE || 'America/Argentina/Buenos_Aires',
  },

  // Randomization probabilities (0-1)
  viewProfileBeforeMessage: 0.85,
  scrollFeedProbability: 0.30,
  takeBreakProbability: 0.15,

  // Safety
  pauseOnWarning: true,
  maxConsecutiveErrors: 3,
  dryRunMode: process.env.LINKEDIN_DRY_RUN === 'true',
};

/**
 * Human behavior simulation configuration
 */
export const humanBehaviorConfig: HumanBehaviorConfig = {
  // Mouse movement
  mouseMovementEnabled: true,
  mouseSpeedVariation: { min: 0.5, max: 2.0 },

  // Scrolling
  scrollEnabled: true,
  scrollSpeedVariation: { min: 100, max: 400 },  // pixels per scroll
  scrollPauseChance: 0.2,

  // Typing
  typingSpeedWPM: { min: 35, max: 55 },
  typingMistakeChance: 0.02,  // 2% chance of making a typo
  typingPauseChance: 0.1,     // 10% chance of pausing mid-word

  // Delays (in milliseconds)
  pageLoadDelay: { min: 2000, max: 5000 },
  actionDelay: { min: 500, max: 2000 },
  readingTimePerWord: { min: 150, max: 300 },

  // Sessions (in minutes)
  sessionDuration: { min: 15, max: 45 },
  breakDuration: { min: 30, max: 120 },
  breakProbability: 0.15,
};

/**
 * Contact scanning specific configuration
 */
export const contactScanConfig = {
  // Connections list scraping
  connectionListScrollDelay: { min: 1000, max: 3000 },  // ms between scrolls
  maxScrollAttempts: 100,  // Max scroll attempts to load all connections

  // Profile visiting for analysis
  profilesPerSession: { min: 15, max: 25 },
  delayBetweenProfiles: { min: 45, max: 120 },  // seconds
  profileViewDuration: { min: 8, max: 25 },      // seconds on each profile

  // Daily limits
  maxProfilesPerDay: 80,  // Conservative to avoid detection

  // Sessions
  sessionDuration: { min: 20, max: 40 },  // minutes
  breakBetweenSessions: { min: 90, max: 240 },  // minutes

  // Safety
  pauseOnProfileViewWarning: true,
  maxConsecutiveErrors: 3,

  // Resume capability
  saveProgressEvery: 10,  // Save progress every N profiles
};

/**
 * Browser configuration for Puppeteer
 */
export const browserConfig = {
  headless: true,  // Set to false for debugging

  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--window-size=1920,1080',
  ],

  viewport: {
    width: 1920,
    height: 1080,
  },

  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

  // Timeouts
  navigationTimeout: 30000,
  waitForSelectorTimeout: 10000,

  // Proxy (optional)
  proxyUrl: process.env.LINKEDIN_PROXY_URL || null,
};

/**
 * LinkedIn URLs
 */
export const linkedInUrls = {
  base: 'https://www.linkedin.com',
  login: 'https://www.linkedin.com/login',
  feed: 'https://www.linkedin.com/feed/',
  myNetwork: 'https://www.linkedin.com/mynetwork/',
  connections: 'https://www.linkedin.com/mynetwork/invite-connect/connections/',
  messaging: 'https://www.linkedin.com/messaging/',
  profile: (identifier: string) => `https://www.linkedin.com/in/${identifier}/`,
  search: 'https://www.linkedin.com/search/results/people/',
};

/**
 * Selectors for LinkedIn elements (may need updates as LinkedIn changes)
 */
export const linkedInSelectors = {
  // Login page
  login: {
    usernameInput: '#username',
    passwordInput: '#password',
    submitButton: 'button[type="submit"]',
    errorMessage: '.form__label--error',
  },

  // Connections page
  connections: {
    connectionsList: '.mn-connections',
    connectionCard: '.mn-connection-card',
    connectionName: '.mn-connection-card__name',
    connectionOccupation: '.mn-connection-card__occupation',
    connectionLink: '.mn-connection-card__link',
    loadMoreButton: 'button.scaffold-finite-scroll__load-button',
    totalConnectionsCount: '.mn-connections__header h1',
  },

  // Profile page
  profile: {
    name: 'h1.text-heading-xlarge',
    headline: '.text-body-medium.break-words',
    location: '.text-body-small.inline.t-black--light.break-words',
    about: '#about ~ div.display-flex span[aria-hidden="true"]',
    experience: '#experience',
    education: '#education',
    skills: '#skills',
    activity: '.pv-recent-activity-section',
    connectionDegree: '.dist-value',
    mutualConnections: '.member-insights a',
    profilePhoto: '.pv-top-card-profile-picture__image',
    premiumBadge: '.premium-icon',
    creatorBadge: '.creator-badge',
    openToWork: '.pv-open-to-work-card',
    messageButton: '.message-anywhere-button',
  },

  // Activity section
  activity: {
    activityTab: 'a[href*="/recent-activity/"]',
    postDate: '.feed-shared-actor__sub-description',
    activityItem: '.feed-shared-update-v2',
  },

  // Messaging
  messaging: {
    composeButton: '.msg-overlay-bubble-header__button',
    conversationList: '.msg-conversations-container__conversations-list',
    messageInput: '.msg-form__contenteditable',
    sendButton: '.msg-form__send-button',
  },

  // Common elements
  common: {
    spinner: '.artdeco-spinner',
    modal: '.artdeco-modal',
    modalClose: '.artdeco-modal__dismiss',
    toast: '.artdeco-toast-item',
  },
};

/**
 * Rate limiting configuration
 */
export const rateLimitConfig = {
  // Requests per window
  profileViewsPerHour: 30,
  messagesPerHour: 10,
  searchesPerHour: 20,

  // Cooldown periods (in milliseconds)
  afterWarning: 30 * 60 * 1000,      // 30 minutes
  afterRateLimit: 60 * 60 * 1000,    // 1 hour
  afterBlock: 24 * 60 * 60 * 1000,   // 24 hours

  // Backoff
  initialBackoff: 5000,              // 5 seconds
  maxBackoff: 300000,                // 5 minutes
  backoffMultiplier: 2,
};

/**
 * Validate configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!linkedInConfig.email) {
    errors.push('LINKEDIN_EMAIL environment variable is required');
  }

  if (!linkedInConfig.password) {
    errors.push('LINKEDIN_PASSWORD environment variable is required');
  }

  if (linkedInConfig.maxMessagesPerDay > 50) {
    errors.push('maxMessagesPerDay should not exceed 50 to avoid detection');
  }

  if (linkedInConfig.maxProfilesPerDay > 150) {
    errors.push('maxProfilesPerDay should not exceed 150 to avoid detection');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
