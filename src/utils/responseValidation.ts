/**
 * Response Validation Utilities
 * Ensures consistent response structure across all agents
 */

import { ChatMessageProcessor } from '../ui/ChatMessageProcessor';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate CaseResponse structure
 */
export function validateCaseResponse(response: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (typeof response.success !== 'boolean') {
    errors.push('Response must have a boolean "success" field');
  }

  if (response.success && !response.message) {
    errors.push('Successful response must have a "message" field');
  }

  // Metadata validation
  if (response.metadata) {
    if (typeof response.metadata !== 'object') {
      errors.push('Metadata must be an object');
    } else {
      // Validate metadata structure
      if (response.metadata.agentType && typeof response.metadata.agentType !== 'string') {
        errors.push('metadata.agentType must be a string');
      }

      if (response.metadata.confidence !== undefined && 
          (typeof response.metadata.confidence !== 'number' || 
           response.metadata.confidence < 0 || 
           response.metadata.confidence > 1)) {
        warnings.push('metadata.confidence should be a number between 0 and 1');
      }

      // Validate quickActions if present
      if (response.metadata.quickActions) {
        if (typeof response.metadata.quickActions.showBankingAlias !== 'boolean') {
          warnings.push('metadata.quickActions.showBankingAlias should be a boolean');
        }
        if (typeof response.metadata.quickActions.showSocialMedia !== 'boolean') {
          warnings.push('metadata.quickActions.showSocialMedia should be a boolean');
        }
      }

      // Validate formattingHints if present
      if (response.metadata.formattingHints) {
        if (!Array.isArray(response.metadata.formattingHints.suggestedChunks)) {
          warnings.push('metadata.formattingHints.suggestedChunks should be an array');
        }
      }
    }
  }

  // Error validation
  if (!response.success && !response.error) {
    warnings.push('Failed response should include an error field');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Normalize response to ensure consistent structure
 */
export function normalizeCaseResponse(response: any): any {
  const normalized: any = {
    success: response.success !== false,
    message: response.message || response.response || '',
    metadata: response.metadata || {},
    error: response.error,
    // IMPORTANT: Preserve messages[] array if present (for donation-with-amount flow)
    messages: response.messages && Array.isArray(response.messages) ? response.messages : undefined,
  };

  // Ensure metadata has required structure
  if (!normalized.metadata.agentType) {
    normalized.metadata.agentType = 'CaseAgent';
  }

  // Ensure quickActions structure exists
  if (!normalized.metadata.quickActions) {
    normalized.metadata.quickActions = {
      showBankingAlias: false,
      showSocialMedia: false,
      showAdoptionInfo: false,
      actionTriggers: []
    };
  }

  // Ensure flowHints structure exists
  if (!normalized.metadata.flowHints) {
    normalized.metadata.flowHints = {
      shouldSaveConversation: true,
      shouldShowTyping: true,
      isFirstMessage: false,
      conversationStage: 'general'
    };
  }

  // NEW: Process for UI rendering - generate render-ready messages
  if (normalized.success) {
    // Check if backend provided messages[] array (for donation-with-amount flow)
    if (normalized.messages && Array.isArray(normalized.messages) && normalized.messages.length > 0) {
      // Use messages[] array (matching golden conversation structure)
      try {
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        normalized.renderableMessages = ChatMessageProcessor.processMessagesArray(
          normalized.messages,
          messageId
        );
      } catch (error: any) {
        console.error('[ResponseValidation] Failed to process messages array:', error);
      }
    } else if (normalized.message) {
      // Fallback to single message processing
      try {
        // Generate render-ready messages using ChatMessageProcessor
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        normalized.renderableMessages = ChatMessageProcessor.processBackendResponse(
          normalized,
          messageId
        );
      } catch (error: any) {
        console.error('[ResponseValidation] Failed to process UI messages:', error);
        // Fallback: keep original format, frontend can handle it
        // Don't fail the response if UI processing fails
      }
    }
  }

  return normalized;
}

