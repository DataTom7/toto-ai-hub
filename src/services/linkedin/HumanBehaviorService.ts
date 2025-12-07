/**
 * Human Behavior Simulation Service
 *
 * Simulates human-like behavior patterns to avoid bot detection.
 * Includes timing randomization, typing simulation, and natural browsing patterns.
 */

import { humanBehaviorConfig, linkedInConfig } from '../../config/linkedin.config';

/**
 * Gaussian (normal) distribution random number generator
 * More natural than uniform random - clusters around the mean
 */
function gaussianRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

/**
 * Get a random number within a range using gaussian distribution
 */
function getGaussianInRange(min: number, max: number): number {
  const mean = (min + max) / 2;
  const stdDev = (max - min) / 6; // 99.7% of values within range
  let value = gaussianRandom(mean, stdDev);
  // Clamp to range
  return Math.max(min, Math.min(max, value));
}

/**
 * Get a random integer within a range
 */
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class HumanBehaviorService {
  private sessionStartTime: Date | null = null;
  private actionsPerformed: number = 0;
  private lastActionTime: Date | null = null;

  constructor() {
    console.log('HumanBehaviorService initialized');
  }

  // ============================================================================
  // TIMING METHODS
  // ============================================================================

  /**
   * Get a random delay between actions (milliseconds)
   * Uses gaussian distribution for more natural patterns
   */
  getRandomDelay(minMs: number, maxMs: number): number {
    return Math.round(getGaussianInRange(minMs, maxMs));
  }

  /**
   * Get delay between profile views (milliseconds)
   * Longer than action delays, simulates reading/browsing
   */
  getProfileViewDelay(): number {
    const { delayBetweenProfiles } = require('../../config/linkedin.config').contactScanConfig;
    // Convert seconds to milliseconds
    return this.getRandomDelay(
      delayBetweenProfiles.min * 1000,
      delayBetweenProfiles.max * 1000
    );
  }

  /**
   * Get time to spend on a profile (milliseconds)
   */
  getProfileViewDuration(): number {
    const { profileViewDuration } = require('../../config/linkedin.config').contactScanConfig;
    return this.getRandomDelay(
      profileViewDuration.min * 1000,
      profileViewDuration.max * 1000
    );
  }

  /**
   * Get delay between messages (milliseconds)
   */
  getMessageDelay(): number {
    const { delayBetweenMessages } = linkedInConfig;
    // Convert minutes to milliseconds
    return this.getRandomDelay(
      delayBetweenMessages.min * 60 * 1000,
      delayBetweenMessages.max * 60 * 1000
    );
  }

  /**
   * Get page load waiting time (milliseconds)
   */
  getPageLoadDelay(): number {
    const { pageLoadDelay } = humanBehaviorConfig;
    return this.getRandomDelay(pageLoadDelay.min, pageLoadDelay.max);
  }

  /**
   * Get general action delay (milliseconds)
   */
  getActionDelay(): number {
    const { actionDelay } = humanBehaviorConfig;
    return this.getRandomDelay(actionDelay.min, actionDelay.max);
  }

  // ============================================================================
  // TYPING SIMULATION
  // ============================================================================

  /**
   * Calculate typing delay for a message based on its length
   * Returns total milliseconds to type the message
   */
  getTypingDuration(messageLength: number): number {
    const { typingSpeedWPM } = humanBehaviorConfig;

    // Average word length in English is ~5 characters
    const wordCount = messageLength / 5;

    // Get random WPM within range
    const wpm = getGaussianInRange(typingSpeedWPM.min, typingSpeedWPM.max);

    // Calculate base time in milliseconds
    const baseTimeMs = (wordCount / wpm) * 60 * 1000;

    // Add some random variation (thinking pauses)
    const variation = baseTimeMs * (Math.random() * 0.3); // Up to 30% variation

    return Math.round(baseTimeMs + variation);
  }

  /**
   * Get delays for each character in a message
   * Returns array of delays in milliseconds
   */
  getCharacterDelays(message: string): number[] {
    const { typingSpeedWPM, typingMistakeChance, typingPauseChance } = humanBehaviorConfig;

    const delays: number[] = [];
    const avgCharPerMinute = ((typingSpeedWPM.min + typingSpeedWPM.max) / 2) * 5; // chars per minute
    const baseDelayMs = 60000 / avgCharPerMinute;

    for (let i = 0; i < message.length; i++) {
      let delay = getGaussianInRange(baseDelayMs * 0.5, baseDelayMs * 1.5);

      // Longer pause after punctuation
      if (['.', '!', '?', ',', ';', ':'].includes(message[i])) {
        delay *= 1.5 + Math.random();
      }

      // Longer pause after spaces (thinking between words)
      if (message[i] === ' ') {
        delay *= 1.2 + Math.random() * 0.5;
      }

      // Occasional thinking pauses
      if (Math.random() < typingPauseChance) {
        delay += getRandomInt(500, 2000);
      }

      delays.push(Math.round(delay));
    }

    return delays;
  }

  /**
   * Simulate reading time based on content length
   */
  getReadingTime(contentLength: number): number {
    const { readingTimePerWord } = humanBehaviorConfig;
    const wordCount = contentLength / 5;
    const avgTimePerWord = (readingTimePerWord.min + readingTimePerWord.max) / 2;
    return Math.round(wordCount * avgTimePerWord);
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Start a new session
   */
  startSession(): void {
    this.sessionStartTime = new Date();
    this.actionsPerformed = 0;
    console.log(`Session started at ${this.sessionStartTime.toISOString()}`);
  }

  /**
   * Get suggested session duration (milliseconds)
   */
  getSessionDuration(): number {
    const { sessionDuration } = humanBehaviorConfig;
    // Convert minutes to milliseconds
    return this.getRandomDelay(
      sessionDuration.min * 60 * 1000,
      sessionDuration.max * 60 * 1000
    );
  }

  /**
   * Get break duration between sessions (milliseconds)
   */
  getBreakDuration(): number {
    const { breakDuration } = humanBehaviorConfig;
    // Convert minutes to milliseconds
    return this.getRandomDelay(
      breakDuration.min * 60 * 1000,
      breakDuration.max * 60 * 1000
    );
  }

  /**
   * Check if session has exceeded recommended duration
   */
  shouldEndSession(): boolean {
    if (!this.sessionStartTime) return false;

    const { sessionDuration } = humanBehaviorConfig;
    const maxDurationMs = sessionDuration.max * 60 * 1000;
    const elapsed = Date.now() - this.sessionStartTime.getTime();

    return elapsed >= maxDurationMs;
  }

  /**
   * Check if we should take a short break
   * Based on probability and actions performed
   */
  shouldTakeBreak(): boolean {
    const { breakProbability } = humanBehaviorConfig;

    // More likely to take break after many actions
    const actionFactor = Math.min(this.actionsPerformed / 20, 1);
    const adjustedProbability = breakProbability * (1 + actionFactor);

    return Math.random() < adjustedProbability;
  }

  /**
   * Record that an action was performed
   */
  recordAction(): void {
    this.actionsPerformed++;
    this.lastActionTime = new Date();
  }

  /**
   * Get session stats
   */
  getSessionStats(): {
    duration: number;
    actions: number;
    actionsPerMinute: number;
  } {
    if (!this.sessionStartTime) {
      return { duration: 0, actions: 0, actionsPerMinute: 0 };
    }

    const durationMs = Date.now() - this.sessionStartTime.getTime();
    const durationMinutes = durationMs / 60000;

    return {
      duration: durationMs,
      actions: this.actionsPerformed,
      actionsPerMinute: durationMinutes > 0 ? this.actionsPerformed / durationMinutes : 0,
    };
  }

  // ============================================================================
  // WORKING HOURS
  // ============================================================================

  /**
   * Check if current time is within working hours
   */
  isWithinWorkingHours(): boolean {
    const { workingHours } = linkedInConfig;

    // Get current time in configured timezone
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      hour12: false,
      timeZone: workingHours.timezone,
    };
    const hourStr = new Intl.DateTimeFormat('en-US', options).format(now);
    const currentHour = parseInt(hourStr, 10);

    // Check day of week
    const dayOptions: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      timeZone: workingHours.timezone,
    };
    const dayStr = new Intl.DateTimeFormat('en-US', dayOptions).format(now);
    const dayMap: Record<string, number> = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    const currentDay = dayMap[dayStr] ?? new Date().getDay();

    // Check if within working days
    if (!workingHours.daysOfWeek.includes(currentDay)) {
      return false;
    }

    // Check if within working hours
    return currentHour >= workingHours.start && currentHour < workingHours.end;
  }

  /**
   * Get milliseconds until next working hours window
   */
  getMsUntilWorkingHours(): number {
    const { workingHours } = linkedInConfig;

    const now = new Date();

    // Get current time in configured timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: workingHours.timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

    // If before working hours today
    if (currentHour < workingHours.start) {
      const msUntilStart = ((workingHours.start - currentHour) * 60 - currentMinute) * 60 * 1000;
      return msUntilStart;
    }

    // If after working hours today, wait until tomorrow
    const hoursUntilMidnight = 24 - currentHour;
    const hoursFromMidnightToStart = workingHours.start;
    const totalHours = hoursUntilMidnight + hoursFromMidnightToStart;
    const msUntilStart = (totalHours * 60 - currentMinute) * 60 * 1000;

    return msUntilStart;
  }

  // ============================================================================
  // PROBABILITY HELPERS
  // ============================================================================

  /**
   * Should we view profile before messaging?
   */
  shouldViewProfileFirst(): boolean {
    return Math.random() < linkedInConfig.viewProfileBeforeMessage;
  }

  /**
   * Should we scroll the feed randomly?
   */
  shouldScrollFeed(): boolean {
    return Math.random() < linkedInConfig.scrollFeedProbability;
  }

  // ============================================================================
  // MOUSE MOVEMENT PATTERNS
  // ============================================================================

  /**
   * Generate a natural mouse movement path between two points
   * Uses bezier curves for smooth, human-like movement
   */
  generateMousePath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    steps: number = 20
  ): Array<{ x: number; y: number; delay: number }> {
    const path: Array<{ x: number; y: number; delay: number }> = [];

    // Generate control points for bezier curve (adds natural curve)
    const cp1x = startX + (endX - startX) * 0.3 + getRandomInt(-50, 50);
    const cp1y = startY + (endY - startY) * 0.1 + getRandomInt(-50, 50);
    const cp2x = startX + (endX - startX) * 0.7 + getRandomInt(-50, 50);
    const cp2y = startY + (endY - startY) * 0.9 + getRandomInt(-50, 50);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      // Cubic bezier formula
      const x = Math.pow(1 - t, 3) * startX +
                3 * Math.pow(1 - t, 2) * t * cp1x +
                3 * (1 - t) * Math.pow(t, 2) * cp2x +
                Math.pow(t, 3) * endX;

      const y = Math.pow(1 - t, 3) * startY +
                3 * Math.pow(1 - t, 2) * t * cp1y +
                3 * (1 - t) * Math.pow(t, 2) * cp2y +
                Math.pow(t, 3) * endY;

      // Variable delay - faster in middle, slower at start/end
      const speedFactor = 1 - Math.abs(t - 0.5) * 0.5;
      const baseDelay = 10 + Math.random() * 20;
      const delay = baseDelay / speedFactor;

      path.push({
        x: Math.round(x),
        y: Math.round(y),
        delay: Math.round(delay),
      });
    }

    return path;
  }

  // ============================================================================
  // SCROLL PATTERNS
  // ============================================================================

  /**
   * Get scroll amount for natural scrolling
   */
  getScrollAmount(): number {
    const { scrollSpeedVariation } = humanBehaviorConfig;
    return getRandomInt(scrollSpeedVariation.min, scrollSpeedVariation.max);
  }

  /**
   * Should we pause after scrolling?
   */
  shouldPauseAfterScroll(): boolean {
    return Math.random() < humanBehaviorConfig.scrollPauseChance;
  }

  /**
   * Get scroll pause duration (milliseconds)
   */
  getScrollPauseDuration(): number {
    return getRandomInt(500, 2000);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Sleep for a random duration within a range
   */
  async randomSleep(minMs: number, maxMs: number): Promise<void> {
    const delay = this.getRandomDelay(minMs, maxMs);
    await this.sleep(delay);
  }

  /**
   * Sleep for a specific duration
   */
  async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    if (ms < 3600000) {
      return `${(ms / 60000).toFixed(1)}min`;
    }
    return `${(ms / 3600000).toFixed(1)}h`;
  }
}

// Export singleton instance
export const humanBehaviorService = new HumanBehaviorService();
