/**
 * LinkedIn Data Export Service
 *
 * Parses CSV files from LinkedIn's native data export feature.
 * This is the SAFEST way to get your connections list - zero detection risk.
 *
 * How to export:
 * 1. LinkedIn Settings → Data Privacy → Get a copy of your data
 * 2. Select: Connections, Messages, Profile
 * 3. Download ZIP and extract
 * 4. Point this service to the extracted folder
 */

import * as fs from 'fs';
import * as path from 'path';
import { locationParserService } from './LocationParserService';
import { LinkedInContact } from '../../types/linkedin.types';

interface ConnectionCSVRow {
  firstName: string;
  lastName: string;
  emailAddress: string | null;
  company: string | null;
  position: string | null;
  connectedOn: Date | null;
  profileUrl: string;
}

interface MessageCSVRow {
  conversationId: string;
  participantProfiles: string[];  // Profile URLs
  date: Date;
  senderProfile: string;
  content: string;
}

interface ExportSummary {
  connectionsCount: number;
  withEmail: number;
  withCompany: number;
  messagesCount: number;
  uniqueConversations: number;
  previouslyMessaged: Set<string>;  // Profile URLs we've messaged before
}

export class LinkedInDataExportService {
  private connections: ConnectionCSVRow[] = [];
  private messages: MessageCSVRow[] = [];
  private previouslyMessaged: Set<string> = new Set();
  private loaded: boolean = false;

  constructor() {
    console.log('LinkedInDataExportService initialized');
  }

  /**
   * Load and parse LinkedIn data export from a directory
   */
  async loadExport(exportPath: string): Promise<{ success: boolean; summary?: ExportSummary; error?: string }> {
    try {
      console.log(`Loading LinkedIn export from: ${exportPath}`);

      // Check if directory exists
      if (!fs.existsSync(exportPath)) {
        return { success: false, error: `Directory not found: ${exportPath}` };
      }

      // Find and parse Connections.csv
      const connectionsPath = this.findFile(exportPath, 'Connections.csv');
      if (connectionsPath) {
        this.connections = await this.parseConnectionsCSV(connectionsPath);
        console.log(`Loaded ${this.connections.length} connections`);
      } else {
        console.warn('Connections.csv not found');
      }

      // Find and parse messages.csv
      const messagesPath = this.findFile(exportPath, 'messages.csv');
      if (messagesPath) {
        this.messages = await this.parseMessagesCSV(messagesPath);
        console.log(`Loaded ${this.messages.length} messages`);

        // Build set of previously messaged profiles
        this.buildPreviouslyMessagedSet();
      } else {
        console.warn('messages.csv not found');
      }

      this.loaded = true;

      const summary = this.getSummary();
      console.log('Export loaded successfully');
      console.log(`  Connections: ${summary.connectionsCount}`);
      console.log(`  With email: ${summary.withEmail}`);
      console.log(`  Previously messaged: ${summary.previouslyMessaged.size}`);

      return { success: true, summary };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error loading export:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Find a file in directory (case-insensitive)
   */
  private findFile(dir: string, filename: string): string | null {
    try {
      const files = fs.readdirSync(dir);
      const match = files.find(f => f.toLowerCase() === filename.toLowerCase());
      return match ? path.join(dir, match) : null;
    } catch {
      return null;
    }
  }

  /**
   * Parse Connections.csv
   *
   * Expected format:
   * First Name,Last Name,Email Address,Company,Position,Connected On
   */
  private async parseConnectionsCSV(filePath: string): Promise<ConnectionCSVRow[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    if (lines.length < 2) {
      return [];
    }

    // Parse header to find column indices
    const header = this.parseCSVLine(lines[0]);
    const indices = {
      firstName: this.findColumnIndex(header, ['first name', 'firstname']),
      lastName: this.findColumnIndex(header, ['last name', 'lastname']),
      email: this.findColumnIndex(header, ['email', 'email address', 'emailaddress']),
      company: this.findColumnIndex(header, ['company']),
      position: this.findColumnIndex(header, ['position', 'title', 'job title']),
      connectedOn: this.findColumnIndex(header, ['connected on', 'connectedon', 'connection date']),
      url: this.findColumnIndex(header, ['url', 'profile url', 'profileurl', 'profile']),
    };

    const connections: ConnectionCSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseCSVLine(line);

        const firstName = indices.firstName >= 0 ? values[indices.firstName]?.trim() || '' : '';
        const lastName = indices.lastName >= 0 ? values[indices.lastName]?.trim() || '' : '';

        // Skip if no name
        if (!firstName && !lastName) continue;

        // Parse connection date
        let connectedOn: Date | null = null;
        if (indices.connectedOn >= 0 && values[indices.connectedOn]) {
          connectedOn = this.parseDate(values[indices.connectedOn]);
        }

        // Build profile URL if not provided
        let profileUrl = '';
        if (indices.url >= 0 && values[indices.url]) {
          profileUrl = values[indices.url].trim();
        }

        connections.push({
          firstName,
          lastName,
          emailAddress: indices.email >= 0 ? values[indices.email]?.trim() || null : null,
          company: indices.company >= 0 ? values[indices.company]?.trim() || null : null,
          position: indices.position >= 0 ? values[indices.position]?.trim() || null : null,
          connectedOn,
          profileUrl,
        });

      } catch (e) {
        console.warn(`Error parsing line ${i}: ${e}`);
      }
    }

    return connections;
  }

  /**
   * Parse messages.csv
   */
  private async parseMessagesCSV(filePath: string): Promise<MessageCSVRow[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    if (lines.length < 2) {
      return [];
    }

    const header = this.parseCSVLine(lines[0]);
    const indices = {
      conversationId: this.findColumnIndex(header, ['conversation id', 'conversationid']),
      participants: this.findColumnIndex(header, ['participant profiles', 'participants']),
      date: this.findColumnIndex(header, ['date', 'sent date', 'timestamp']),
      sender: this.findColumnIndex(header, ['sender', 'sender profile', 'from']),
      content: this.findColumnIndex(header, ['content', 'message', 'body']),
    };

    const messages: MessageCSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseCSVLine(line);

        const conversationId = indices.conversationId >= 0 ? values[indices.conversationId] || '' : '';
        const participantsRaw = indices.participants >= 0 ? values[indices.participants] || '' : '';
        const participantProfiles = participantsRaw.split(',').map(p => p.trim()).filter(p => p);

        let date: Date = new Date();
        if (indices.date >= 0 && values[indices.date]) {
          const parsed = this.parseDate(values[indices.date]);
          if (parsed) date = parsed;
        }

        messages.push({
          conversationId,
          participantProfiles,
          date,
          senderProfile: indices.sender >= 0 ? values[indices.sender] || '' : '',
          content: indices.content >= 0 ? values[indices.content] || '' : '',
        });

      } catch (e) {
        // Skip malformed lines
      }
    }

    return messages;
  }

  /**
   * Build set of profile URLs we've previously messaged
   */
  private buildPreviouslyMessagedSet(): void {
    this.previouslyMessaged.clear();

    for (const msg of this.messages) {
      for (const profile of msg.participantProfiles) {
        // Extract the public identifier from the URL
        const match = profile.match(/linkedin\.com\/in\/([^/]+)/i);
        if (match) {
          this.previouslyMessaged.add(match[1].toLowerCase());
        }
      }
    }
  }

  /**
   * Parse a CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  /**
   * Find column index by possible names (case-insensitive)
   */
  private findColumnIndex(header: string[], possibleNames: string[]): number {
    const headerLower = header.map(h => h.toLowerCase().trim());
    for (const name of possibleNames) {
      const idx = headerLower.indexOf(name.toLowerCase());
      if (idx >= 0) return idx;
    }
    return -1;
  }

  /**
   * Parse date from various formats
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    const cleaned = dateStr.trim();

    // Try standard formats
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/,                    // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})$/,                  // MM/DD/YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/,                    // DD-MM-YYYY
      /^(\d{1,2})\s+(\w+)\s+(\d{4})$/,                // D Mon YYYY
      /^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/,              // Mon D, YYYY
    ];

    // Try ISO format first
    const isoDate = new Date(cleaned);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try DD Mon YYYY format (LinkedIn often uses this)
    const monthNames: Record<string, number> = {
      'jan': 0, 'january': 0,
      'feb': 1, 'february': 1,
      'mar': 2, 'march': 2,
      'apr': 3, 'april': 3,
      'may': 4,
      'jun': 5, 'june': 5,
      'jul': 6, 'july': 6,
      'aug': 7, 'august': 7,
      'sep': 8, 'september': 8,
      'oct': 9, 'october': 9,
      'nov': 10, 'november': 10,
      'dec': 11, 'december': 11,
    };

    const ddMonYYYY = cleaned.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/i);
    if (ddMonYYYY) {
      const month = monthNames[ddMonYYYY[2].toLowerCase()];
      if (month !== undefined) {
        return new Date(parseInt(ddMonYYYY[3]), month, parseInt(ddMonYYYY[1]));
      }
    }

    return null;
  }

  /**
   * Get export summary
   */
  getSummary(): ExportSummary {
    const withEmail = this.connections.filter(c => c.emailAddress).length;
    const withCompany = this.connections.filter(c => c.company).length;

    const uniqueConversations = new Set(this.messages.map(m => m.conversationId)).size;

    return {
      connectionsCount: this.connections.length,
      withEmail,
      withCompany,
      messagesCount: this.messages.length,
      uniqueConversations,
      previouslyMessaged: this.previouslyMessaged,
    };
  }

  /**
   * Get all connections
   */
  getConnections(): ConnectionCSVRow[] {
    return [...this.connections];
  }

  /**
   * Check if we've previously messaged someone
   */
  hasPreviouslyMessaged(profileUrl: string): boolean {
    const match = profileUrl.match(/linkedin\.com\/in\/([^/]+)/i);
    if (match) {
      return this.previouslyMessaged.has(match[1].toLowerCase());
    }
    return false;
  }

  /**
   * Pre-filter connections based on CSV data (before any profile visits)
   */
  preFilterConnections(options?: {
    excludeCompanies?: string[];
    includeCompanies?: string[];
    excludePositions?: string[];
    includePositions?: string[];
    minConnectionAge?: number;  // months
    maxConnectionAge?: number;  // months
    excludePreviouslyMessaged?: boolean;
    requireEmail?: boolean;
  }): ConnectionCSVRow[] {
    let filtered = [...this.connections];

    // Exclude previously messaged
    if (options?.excludePreviouslyMessaged) {
      filtered = filtered.filter(c => !this.hasPreviouslyMessaged(c.profileUrl));
    }

    // Require email
    if (options?.requireEmail) {
      filtered = filtered.filter(c => !!c.emailAddress);
    }

    // Company filters
    if (options?.excludeCompanies?.length) {
      const excluded = options.excludeCompanies.map(c => c.toLowerCase());
      filtered = filtered.filter(c => {
        if (!c.company) return true;
        return !excluded.some(ex => c.company!.toLowerCase().includes(ex));
      });
    }

    if (options?.includeCompanies?.length) {
      const included = options.includeCompanies.map(c => c.toLowerCase());
      filtered = filtered.filter(c => {
        if (!c.company) return false;
        return included.some(inc => c.company!.toLowerCase().includes(inc));
      });
    }

    // Position filters
    if (options?.excludePositions?.length) {
      const excluded = options.excludePositions.map(p => p.toLowerCase());
      filtered = filtered.filter(c => {
        if (!c.position) return true;
        return !excluded.some(ex => c.position!.toLowerCase().includes(ex));
      });
    }

    if (options?.includePositions?.length) {
      const included = options.includePositions.map(p => p.toLowerCase());
      filtered = filtered.filter(c => {
        if (!c.position) return false;
        return included.some(inc => c.position!.toLowerCase().includes(inc));
      });
    }

    // Connection age filters
    if (options?.minConnectionAge && options.minConnectionAge > 0) {
      const minDate = new Date();
      minDate.setMonth(minDate.getMonth() - options.minConnectionAge);
      filtered = filtered.filter(c => {
        if (!c.connectedOn) return true;
        return c.connectedOn <= minDate;
      });
    }

    if (options?.maxConnectionAge && options.maxConnectionAge > 0) {
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() - options.maxConnectionAge);
      filtered = filtered.filter(c => {
        if (!c.connectedOn) return true;
        return c.connectedOn >= maxDate;
      });
    }

    return filtered;
  }

  /**
   * Convert CSV connection to initial LinkedInContact
   */
  toLinkedInContact(row: ConnectionCSVRow): Partial<LinkedInContact> {
    const publicIdentifier = row.profileUrl.match(/\/in\/([^/]+)/)?.[1] || '';

    return {
      linkedInId: publicIdentifier,
      profileUrl: row.profileUrl || `https://www.linkedin.com/in/${publicIdentifier}`,
      publicIdentifier,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: `${row.firstName} ${row.lastName}`.trim(),
      headline: row.position || '',
      currentCompany: row.company,
      currentRole: row.position,
      connectionDate: row.connectedOn,
      connectionDegree: '1st',
      hasMessaged: this.hasPreviouslyMessaged(row.profileUrl),
      status: 'pending',
      analysisComplete: false,
      scrapedAt: new Date(),
      lastUpdated: new Date(),
      tags: [],
      notes: row.emailAddress ? `Email: ${row.emailAddress}` : '',
    };
  }

  /**
   * Check if export is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}

// Export singleton instance
export const linkedInDataExportService = new LinkedInDataExportService();
