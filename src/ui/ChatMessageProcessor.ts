/**
 * ChatMessageProcessor - Centralized message processing for chat UI
 * 
 * This class processes backend responses and generates render-ready messages
 * that the frontend can directly use. It follows the golden conversation
 * structure exactly, ensuring consistency between backend and frontend.
 * 
 * Key principles:
 * - Each message knows its own quick actions
 * - Quick actions are always rendered after the message that contains them
 * - No "last bubble" detection needed - backend structure is trusted
 * - Message formatting uses backend's formatting hints
 */

import {
  RenderableMessage,
  RenderableQuickActions,
  QuickActionConfig,
  BankingAliasConfig,
  SocialMediaConfig,
  DonationAmountsConfig,
  HelpActionsConfig,
  GuardianContactConfig,
  CaseResponseForUI,
} from './types';
import { CaseResponse } from '../types';

export class ChatMessageProcessor {
  /**
   * Process backend response and generate render-ready messages
   * 
   * This is the main entry point. It takes a CaseResponse from the backend
   * and converts it into RenderableMessage objects that the frontend can
   * directly render.
   * 
   * @param response - Backend response from CaseAgent
   * @param messageId - Unique ID for this message (frontend generates)
   * @returns Array of render-ready messages
   */
  static processBackendResponse(
    response: CaseResponse,
    messageId: string
  ): RenderableMessage[] {
    if (!response.success || !response.message) {
      // Handle error responses
      return [];
    }

    // If backend already sends messages[] array (future), prefer that
    if ((response as any).messages && Array.isArray((response as any).messages)) {
      return this.processMessagesArray((response as any).messages, messageId);
    }

    const messages: RenderableMessage[] = [];
    const metadata = response.metadata as any;

    // IMPORTANT: suggestedChunks are for paragraph splitting WITHIN a single message,
    // NOT for creating multiple separate messages. Only use messages[] array for that.
    // Split message into paragraphs (suggestedChunks are used here for paragraph splitting)
    const paragraphs = this.splitIntoParagraphs(
      response.message,
      metadata?.formattingHints
    );
    const quickActions = this.extractQuickActions(metadata);

    messages.push({
      id: messageId,
      text: response.message,
      role: 'agent',
      timestamp: new Date(),
      paragraphs,
      quickActions,
      formatting: {
        shouldShowTyping: metadata?.flowHints?.shouldShowTyping ?? true,
        typingSpeed: 50,
        animationDelay: 0,
      },
      metadata: response.metadata,
    });

    return messages;
  }

  /**
   * Extract quick actions from backend metadata
   * 
   * Follows the golden conversation structure exactly. Each quick action type
   * is checked in priority order, and the first matching type is returned.
   * 
   * Priority order (matches golden conversations):
   * 1. Banking alias (donation flow)
   * 2. Social media (share flow)
   * 3. Donation amounts (donation flow - asking for amount)
   * 4. Help actions (help flow)
   * 5. Guardian contact (contact flow)
   * 
   * @param metadata - Backend response metadata
   * @returns Renderable quick actions or undefined
   */
  private static extractQuickActions(
    metadata?: any
  ): RenderableQuickActions | undefined {
    if (!metadata?.quickActions) {
      return undefined;
    }

    const qa = metadata.quickActions;

    // 1. Banking alias (highest priority for donation flow)
    if (qa.showBankingAlias && metadata.guardianBankingAlias) {
      return {
        type: 'banking_alias',
        config: {
          alias: metadata.guardianBankingAlias,
          label: 'Copiar alias',
        } as BankingAliasConfig,
        position: 'after_message',
      };
    }

    // 2. Social media (share flow)
    if (qa.showSocialMedia && metadata.socialMediaUrls) {
      const platforms = Object.entries(metadata.socialMediaUrls)
        .filter(([_, url]) => !!url)
        .map(([platform, url]) => ({
          platform: platform as 'instagram' | 'twitter' | 'facebook',
          url: url as string,
        }));

      if (platforms.length > 0) {
        return {
          type: 'social_media',
          config: {
            platforms,
          } as SocialMediaConfig,
          position: 'after_message',
        };
      }
    }

    // 3. Donation amounts (donation flow - asking for amount)
    if (qa.showDonationIntent && qa.suggestedDonationAmounts && qa.suggestedDonationAmounts.length > 0) {
      return {
        type: 'donation_amounts',
        config: {
          amounts: qa.suggestedDonationAmounts,
          currency: 'ARS', // Default to ARS (Argentine Peso)
        } as DonationAmountsConfig,
        position: 'after_message',
      };
    }

    // 4. Help actions (help flow)
    if (qa.showHelpActions) {
      return {
        type: 'help_actions',
        config: {
          actions: [
            { type: 'donate', label: 'Donar' },
            { type: 'share', label: 'Compartir' },
          ],
        } as HelpActionsConfig,
        position: 'after_message',
      };
    }

    // 5. Guardian contact (contact flow)
    if (qa.showGuardianContact && metadata.guardianContactInfo) {
      const contacts = Object.entries(metadata.guardianContactInfo)
        .filter(([_, value]) => !!value)
        .map(([channel, url]) => ({
          channel: channel as 'email' | 'phone' | 'whatsapp' | 'instagram' | 'twitter' | 'facebook',
          url: url as string, // Backend already formats URLs (mailto:, tel:, https://wa.me/, etc.)
        }));

      if (contacts.length > 0) {
        return {
          type: 'guardian_contact',
          config: {
            contacts,
          } as GuardianContactConfig,
          position: 'after_message',
        };
      }
    }

    return undefined;
  }

  /**
   * Split message into paragraphs using backend formatting hints
   * 
   * Priority:
   * 1. Use backend's suggestedChunks if available (most accurate)
   * 2. Fall back to local paragraph splitting logic
   * 
   * The backend should always provide formatting hints, but we have
   * a fallback for safety.
   * 
   * @param message - Full message text
   * @param formattingHints - Backend formatting hints
   * @returns Array of paragraph strings
   */
  private static splitIntoParagraphs(
    message: string,
    formattingHints?: any
  ): string[] {
    // Priority 1: Use backend's suggested chunks (most accurate)
    if (formattingHints?.suggestedChunks && Array.isArray(formattingHints.suggestedChunks) && formattingHints.suggestedChunks.length > 0) {
      return formattingHints.suggestedChunks.filter((chunk: string) => chunk.trim().length > 0);
    }

    // Priority 2: Fall back to local paragraph splitting
    // This handles common patterns:
    // - Double newlines (paragraph breaks)
    // - Bullet points (each bullet is a paragraph)
    // - Questions (separate into own paragraph)

    // First, handle double newlines (explicit paragraph breaks)
    if (message.includes('\n\n')) {
      return message
        .split('\n\n')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }

    // Handle bullet points (markdown-style)
    const bulletPattern = /^[\s]*[\*\-\•]|^[\s]*\d+[\.\)]/gm;
    if (bulletPattern.test(message)) {
      const lines = message.split('\n');
      const paragraphs: string[] = [];
      let currentParagraph = '';

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (bulletPattern.test(trimmedLine)) {
          // Save previous paragraph if exists
          if (currentParagraph.trim()) {
            paragraphs.push(currentParagraph.trim());
            currentParagraph = '';
          }

          // Clean up bullet point formatting
          const cleanLine = trimmedLine
            .replace(/^[\*\-\•\d]+[\.\)]\s*/, '') // Remove bullet markers
            .replace(/\*\*/g, '') // Remove bold markers
            .replace(/\*/g, '') // Remove remaining asterisks
            .trim();

          paragraphs.push(cleanLine);
        } else if (trimmedLine) {
          // Regular text - add to current paragraph
          if (currentParagraph) {
            currentParagraph += ' ' + trimmedLine;
          } else {
            currentParagraph = trimmedLine;
          }
        }
      }

      // Add remaining paragraph
      if (currentParagraph.trim()) {
        paragraphs.push(currentParagraph.trim());
      }

      return paragraphs.filter((p) => p.length > 0);
    }

    // Default: Split by sentences, group into paragraphs of max 2 sentences
    // But always separate questions (starting with ¿) into their own paragraph
    const sentencePattern = /[.!?]+(?=\s|¿|$)/g;
    const sentences: string[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = sentencePattern.exec(message)) !== null) {
      const sentence = message.substring(lastIndex, match.index + match[0].length).trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text if any
    if (lastIndex < message.length) {
      const remaining = message.substring(lastIndex).trim();
      if (remaining.length > 0) {
        sentences.push(remaining);
      }
    }

    // Group sentences into paragraphs
    const paragraphs: string[] = [];
    let currentParagraph: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const isQuestion = sentence.trim().startsWith('¿');

      // If it's a question, start a new paragraph
      if (isQuestion && currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' ').trim());
        currentParagraph = [sentence];
      } else {
        currentParagraph.push(sentence);

        // If we have 2 sentences, save as paragraph
        if (currentParagraph.length >= 2) {
          paragraphs.push(currentParagraph.join(' ').trim());
          currentParagraph = [];
        }
      }
    }

    // Add remaining sentences
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join(' ').trim());
    }

    return paragraphs.filter((p) => p.length > 0);
  }

  /**
   * Process multiple messages (for future use when backend sends messages[] array)
   * 
   * This method will be used when CaseAgent is updated to return messages[] array
   * matching the golden conversation structure.
   * 
   * @param messages - Array of messages from backend
   * @param baseMessageId - Base ID for generating unique message IDs
   * @returns Array of render-ready messages
   */
  static processMessagesArray(
    messages: Array<{
      message: string;
      quickActions?: any;
      guardianBankingAlias?: string;
      shouldIncludeKB?: boolean;
    }>,
    baseMessageId: string
  ): RenderableMessage[] {
    return messages.map((msg, index) => {
      const messageId = `${baseMessageId}-${index}`;
      const paragraphs = this.splitIntoParagraphs(msg.message);
      
      // Extract quick actions only if this message has them
      // For donation-with-amount flow: first message (index 0) has alias, second (index 1) has none
      // IMPORTANT: Only extract if msg.quickActions exists AND guardianBankingAlias is present
      let quickActions: RenderableQuickActions | undefined = undefined;
      if (msg.quickActions && msg.guardianBankingAlias) {
        // Build metadata object that extractQuickActions expects
        const metadataForExtraction = {
          quickActions: msg.quickActions,
          guardianBankingAlias: msg.guardianBankingAlias,
        };
        quickActions = this.extractQuickActions(metadataForExtraction);
      }
      // Explicitly set to undefined for messages without quickActions to prevent inheritance
      if (!quickActions) {
        quickActions = undefined;
      }

      return {
        id: messageId,
        text: msg.message,
        role: 'agent',
        timestamp: new Date(),
        paragraphs,
        quickActions, // Only first message (index 0) should have quick actions
        formatting: {
          shouldShowTyping: true,
          typingSpeed: 50,
          animationDelay: index * 300, // Stagger messages slightly
        },
        // IMPORTANT: Don't include parent metadata - each message is independent
        // This prevents quickActions from being inherited by subsequent messages
        metadata: {
          originalMessageId: messageId,
        },
      };
    });
  }
}

