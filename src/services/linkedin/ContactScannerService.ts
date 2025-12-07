/**
 * Contact Scanner Service
 *
 * Scrapes the LinkedIn connections list and exports all 1st-degree contacts.
 * Uses human-like behavior to avoid detection.
 */

import { Page } from 'puppeteer';
import { linkedInAuthService } from './LinkedInAuthService';
import { humanBehaviorService } from './HumanBehaviorService';
import { linkedInUrls, linkedInSelectors, contactScanConfig } from '../../config/linkedin.config';
import { LinkedInContact, ScanProgress, ScanSession } from '../../types/linkedin.types';

interface BasicContactInfo {
  linkedInId: string;
  profileUrl: string;
  publicIdentifier: string;
  fullName: string;
  headline: string;
  location: string;
  profilePhotoUrl: string | null;
  connectionDate: string | null;
}

export class ContactScannerService {
  private scanProgress: ScanProgress = {
    phase: 'idle',
    totalContacts: 0,
    exportedContacts: 0,
    analyzedContacts: 0,
    scoredContacts: 0,
    currentBatch: 0,
    totalBatches: 0,
    startTime: null,
    estimatedCompletion: null,
    errors: [],
    warnings: [],
  };

  private currentSession: ScanSession | null = null;
  private contacts: BasicContactInfo[] = [];
  private abortController: AbortController | null = null;

  constructor() {
    console.log('ContactScannerService initialized');
  }

  /**
   * Get current scan progress
   */
  getProgress(): ScanProgress {
    return { ...this.scanProgress };
  }

  /**
   * Get exported contacts
   */
  getContacts(): BasicContactInfo[] {
    return [...this.contacts];
  }

  /**
   * Start scanning connections
   */
  async startScan(): Promise<{ success: boolean; error?: string }> {
    if (this.scanProgress.phase !== 'idle' && this.scanProgress.phase !== 'complete' && this.scanProgress.phase !== 'error') {
      return { success: false, error: 'Scan already in progress' };
    }

    this.abortController = new AbortController();
    this.contacts = [];

    this.scanProgress = {
      phase: 'exporting_connections',
      totalContacts: 0,
      exportedContacts: 0,
      analyzedContacts: 0,
      scoredContacts: 0,
      currentBatch: 0,
      totalBatches: 0,
      startTime: new Date(),
      estimatedCompletion: null,
      errors: [],
      warnings: [],
    };

    this.currentSession = {
      sessionId: `scan_${Date.now()}`,
      startTime: new Date(),
      endTime: null,
      profilesScanned: 0,
      profilesPerHour: 0,
      status: 'active',
      pauseReason: null,
      qualified: 0,
      filteredRegion: 0,
      filteredInactive: 0,
      errors: 0,
    };

    console.log(`Starting connection scan - Session: ${this.currentSession.sessionId}`);

    try {
      // Login and navigate to connections page
      const navResult = await linkedInAuthService.navigateTo(linkedInUrls.connections);
      if (!navResult.success) {
        throw new Error(navResult.error || 'Failed to navigate to connections page');
      }

      const page = await linkedInAuthService.getPage();

      // Wait for connections page to load
      await humanBehaviorService.randomSleep(3000, 5000);

      // Get total connections count
      const totalCount = await this.getTotalConnectionsCount(page);
      this.scanProgress.totalContacts = totalCount;
      console.log(`Total connections to scan: ${totalCount}`);

      // Scroll and extract all connections
      await this.scrollAndExtractConnections(page);

      this.scanProgress.phase = 'complete';
      this.currentSession.endTime = new Date();
      this.currentSession.status = 'completed';

      console.log(`Scan complete. Exported ${this.contacts.length} connections.`);

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown scan error';
      console.error('Scan error:', errorMessage);

      this.scanProgress.phase = 'error';
      this.scanProgress.errors.push({
        contactId: null,
        phase: 'exporting_connections',
        message: errorMessage,
        timestamp: new Date(),
        recoverable: true,
      });

      if (this.currentSession) {
        this.currentSession.status = 'error';
        this.currentSession.endTime = new Date();
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Stop the current scan
   */
  stopScan(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.scanProgress.phase = 'idle';
    if (this.currentSession) {
      this.currentSession.status = 'paused';
      this.currentSession.pauseReason = 'User stopped scan';
      this.currentSession.endTime = new Date();
    }
    console.log('Scan stopped by user');
  }

  /**
   * Get total connections count from page
   */
  private async getTotalConnectionsCount(page: Page): Promise<number> {
    try {
      const selector = linkedInSelectors.connections.totalConnectionsCount;

      await page.waitForSelector(selector, { timeout: 10000 });

      const countText = await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        return element?.textContent || '';
      }, selector);

      // Extract number from text like "1,234 Connections"
      const match = countText.match(/[\d,]+/);
      if (match) {
        return parseInt(match[0].replace(/,/g, ''), 10);
      }

      return 0;
    } catch (error) {
      console.warn('Could not get total connections count:', error);
      return 0;
    }
  }

  /**
   * Scroll through connections page and extract all contacts
   */
  private async scrollAndExtractConnections(page: Page): Promise<void> {
    const seenIds = new Set<string>();
    let scrollAttempts = 0;
    let noNewContactsCount = 0;
    const maxNoNewContacts = 5; // Stop if 5 consecutive scrolls yield no new contacts

    console.log('Starting to scroll and extract connections...');

    while (scrollAttempts < contactScanConfig.maxScrollAttempts) {
      // Check for abort
      if (this.abortController?.signal.aborted) {
        console.log('Scan aborted');
        break;
      }

      // Check if session should pause
      if (humanBehaviorService.shouldEndSession()) {
        console.log('Session duration reached, taking a break...');
        await this.takeBreak();
        humanBehaviorService.startSession();
      }

      // Extract visible connections
      const newContacts = await this.extractVisibleConnections(page, seenIds);

      if (newContacts.length > 0) {
        this.contacts.push(...newContacts);
        this.scanProgress.exportedContacts = this.contacts.length;
        noNewContactsCount = 0;

        console.log(`Extracted ${newContacts.length} new contacts (total: ${this.contacts.length})`);

        // Save progress periodically
        if (this.contacts.length % contactScanConfig.saveProgressEvery === 0) {
          await this.saveProgress();
        }
      } else {
        noNewContactsCount++;
        if (noNewContactsCount >= maxNoNewContacts) {
          console.log('No more contacts to load');
          break;
        }
      }

      // Scroll down
      await this.scrollDown(page);
      scrollAttempts++;

      // Random delay between scrolls
      const scrollDelay = humanBehaviorService.getRandomDelay(
        contactScanConfig.connectionListScrollDelay.min,
        contactScanConfig.connectionListScrollDelay.max
      );
      await humanBehaviorService.sleep(scrollDelay);

      // Occasionally pause to look natural
      if (humanBehaviorService.shouldPauseAfterScroll()) {
        const pauseDuration = humanBehaviorService.getScrollPauseDuration();
        console.log(`Pausing for ${pauseDuration}ms...`);
        await humanBehaviorService.sleep(pauseDuration);
      }

      // Try clicking "Show more" button if present
      await this.clickShowMoreIfPresent(page);
    }

    console.log(`Scroll complete after ${scrollAttempts} attempts. Total contacts: ${this.contacts.length}`);
  }

  /**
   * Extract visible connection cards from the page
   */
  private async extractVisibleConnections(page: Page, seenIds: Set<string>): Promise<BasicContactInfo[]> {
    const selectors = linkedInSelectors.connections;

    const contacts = await page.evaluate((sels) => {
      const cards = document.querySelectorAll(sels.connectionCard);
      const results: any[] = [];

      cards.forEach((card) => {
        try {
          // Get profile link
          const linkElement = card.querySelector(sels.connectionLink);
          if (!linkElement) return;

          const profileUrl = linkElement.getAttribute('href') || '';
          if (!profileUrl.includes('/in/')) return;

          // Extract public identifier from URL
          const urlMatch = profileUrl.match(/\/in\/([^/]+)/);
          const publicIdentifier = urlMatch ? urlMatch[1] : '';
          if (!publicIdentifier) return;

          // Use public identifier as unique ID
          const linkedInId = publicIdentifier;

          // Get name
          const nameElement = card.querySelector(sels.connectionName);
          const fullName = nameElement?.textContent?.trim() || '';

          // Get headline/occupation
          const headlineElement = card.querySelector(sels.connectionOccupation);
          const headline = headlineElement?.textContent?.trim() || '';

          // Try to find location in various places
          let location = '';
          const locationElement = card.querySelector('.member-insights__reason') ||
                                  card.querySelector('[class*="location"]') ||
                                  card.querySelector('.t-black--light');
          if (locationElement) {
            location = locationElement.textContent?.trim() || '';
          }

          // Get profile photo
          const photoElement = card.querySelector('img.presence-entity__image, img.EntityPhoto-circle-3');
          let profilePhotoUrl: string | null = null;
          if (photoElement) {
            profilePhotoUrl = photoElement.getAttribute('src') || null;
            // Filter out default/ghost images
            if (profilePhotoUrl && (
              profilePhotoUrl.includes('ghost') ||
              profilePhotoUrl.includes('default') ||
              profilePhotoUrl.includes('data:image')
            )) {
              profilePhotoUrl = null;
            }
          }

          // Try to find connection date
          let connectionDate: string | null = null;
          const timeElement = card.querySelector('time');
          if (timeElement) {
            connectionDate = timeElement.getAttribute('datetime') || null;
          }

          results.push({
            linkedInId,
            profileUrl: `https://www.linkedin.com${profileUrl}`,
            publicIdentifier,
            fullName,
            headline,
            location,
            profilePhotoUrl,
            connectionDate,
          });

        } catch (e) {
          // Skip this card on error
        }
      });

      return results;
    }, selectors);

    // Filter out already seen contacts
    const newContacts = contacts.filter((c: BasicContactInfo) => {
      if (seenIds.has(c.linkedInId)) {
        return false;
      }
      seenIds.add(c.linkedInId);
      return true;
    });

    return newContacts;
  }

  /**
   * Scroll down the page
   */
  private async scrollDown(page: Page): Promise<void> {
    const scrollAmount = humanBehaviorService.getScrollAmount();

    await page.evaluate((amount) => {
      window.scrollBy(0, amount);
    }, scrollAmount);
  }

  /**
   * Click "Show more" button if present
   */
  private async clickShowMoreIfPresent(page: Page): Promise<void> {
    try {
      const buttonSelector = linkedInSelectors.connections.loadMoreButton;
      const button = await page.$(buttonSelector);

      if (button) {
        const isVisible = await page.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }, button);

        if (isVisible) {
          console.log('Clicking "Show more" button...');
          await button.click();
          await humanBehaviorService.randomSleep(2000, 4000);
        }
      }
    } catch (error) {
      // Button might not exist, that's fine
    }
  }

  /**
   * Take a break between sessions
   */
  private async takeBreak(): Promise<void> {
    const breakDuration = humanBehaviorService.getBreakDuration();
    console.log(`Taking a ${humanBehaviorService.formatDuration(breakDuration)} break...`);

    if (this.currentSession) {
      this.currentSession.status = 'paused';
      this.currentSession.pauseReason = 'Scheduled break';
    }

    await humanBehaviorService.sleep(breakDuration);

    if (this.currentSession) {
      this.currentSession.status = 'active';
      this.currentSession.pauseReason = null;
    }
  }

  /**
   * Save progress (to be implemented with Firestore)
   */
  private async saveProgress(): Promise<void> {
    // TODO: Implement Firestore persistence
    console.log(`Progress saved: ${this.contacts.length} contacts exported`);
  }

  /**
   * Resume a previous scan from saved progress
   */
  async resumeScan(savedContacts: BasicContactInfo[]): Promise<{ success: boolean; error?: string }> {
    this.contacts = savedContacts;
    this.scanProgress.exportedContacts = savedContacts.length;
    console.log(`Resuming scan with ${savedContacts.length} previously exported contacts`);

    // Continue the scan
    return this.startScan();
  }

  /**
   * Get scan statistics
   */
  getStats(): {
    totalContacts: number;
    exportedContacts: number;
    withPhoto: number;
    withLocation: number;
    scanDuration: number | null;
    contactsPerMinute: number;
  } {
    const withPhoto = this.contacts.filter(c => c.profilePhotoUrl !== null).length;
    const withLocation = this.contacts.filter(c => c.location && c.location.trim() !== '').length;

    let scanDuration: number | null = null;
    let contactsPerMinute = 0;

    if (this.scanProgress.startTime) {
      const endTime = this.currentSession?.endTime || new Date();
      scanDuration = endTime.getTime() - this.scanProgress.startTime.getTime();
      const minutes = scanDuration / 60000;
      contactsPerMinute = minutes > 0 ? this.contacts.length / minutes : 0;
    }

    return {
      totalContacts: this.scanProgress.totalContacts,
      exportedContacts: this.contacts.length,
      withPhoto,
      withLocation,
      scanDuration,
      contactsPerMinute,
    };
  }
}

// Export singleton instance
export const contactScannerService = new ContactScannerService();
