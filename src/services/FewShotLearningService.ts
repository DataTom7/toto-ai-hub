/**
 * Few-Shot Learning Service
 *
 * Loads golden conversations and selects relevant examples to inject into prompts.
 * Improves AI response quality by showing the model ideal interaction patterns.
 *
 * How it works:
 * 1. Load reviewed golden conversations from dataset
 * 2. Select 3-5 most relevant examples based on intent and language
 * 3. Format examples for inclusion in system prompt
 * 4. AI learns patterns and mimics golden conversation quality
 */

import {
  loadReviewedGoldenConversations,
  getGoldenConversationsByIntent,
  getGoldenConversationsByLanguage,
  type GoldenConversation,
} from '../data/golden-conversations';

export interface FewShotExample {
  userMessage: string;
  agentResponse: string;
  intent: string;
  quickActions?: {
    showBankingAlias?: boolean;
    showAmountOptions?: boolean;
    showShareActions?: boolean;
    showHelpActions?: boolean;
  };
  kbUsed?: boolean;
  notes?: string;
}

export interface FewShotSelectionCriteria {
  intent?: 'donation' | 'share' | 'help' | 'information' | 'unknown';
  language?: 'es' | 'en';
  hasAmount?: boolean;
  complexity?: 'simple' | 'medium' | 'complex';
  maxExamples?: number;
}

/**
 * Few-Shot Learning Service
 *
 * Manages loading and selection of golden conversation examples
 * for few-shot learning in AI prompts.
 */
export class FewShotLearningService {
  private goldenConversations: GoldenConversation[] = [];
  private isInitialized = false;

  /**
   * Initialize the service by loading golden conversations
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load only reviewed conversations (quality assured)
      this.goldenConversations = loadReviewedGoldenConversations();

      console.log(`[FewShotLearning] ✅ Loaded ${this.goldenConversations.length} reviewed golden conversations`);

      // Log statistics
      const stats = {
        donation: this.goldenConversations.filter(c => c.metadata.intent === 'donation').length,
        share: this.goldenConversations.filter(c => c.metadata.intent === 'share').length,
        help: this.goldenConversations.filter(c => c.metadata.intent === 'help').length,
        information: this.goldenConversations.filter(c => c.metadata.intent === 'information').length,
        es: this.goldenConversations.filter(c => c.metadata.language === 'es').length,
        en: this.goldenConversations.filter(c => c.metadata.language === 'en').length,
      };

      console.log(`[FewShotLearning] Coverage:`, stats);

      this.isInitialized = true;
    } catch (error) {
      console.error('[FewShotLearning] ❌ Failed to load golden conversations:', error);
      // Don't throw - service should gracefully degrade if golden conversations unavailable
      this.goldenConversations = [];
      this.isInitialized = true;
    }
  }

  /**
   * Select relevant golden conversation examples for few-shot learning
   *
   * @param criteria - Selection criteria (intent, language, etc.)
   * @returns Array of formatted few-shot examples
   */
  selectExamples(criteria: FewShotSelectionCriteria = {}): FewShotExample[] {
    if (!this.isInitialized) {
      console.warn('[FewShotLearning] Service not initialized. Call initialize() first.');
      return [];
    }

    if (this.goldenConversations.length === 0) {
      console.warn('[FewShotLearning] No golden conversations available');
      return [];
    }

    const {
      intent,
      language = 'es',
      hasAmount,
      complexity,
      maxExamples = 5,
    } = criteria;

    // Filter conversations based on criteria
    let candidates = this.goldenConversations;

    // Filter by intent (most important)
    if (intent) {
      candidates = candidates.filter(c => c.metadata.intent === intent);
    }

    // Filter by language (important for response style)
    candidates = candidates.filter(c => c.metadata.language === language);

    // Filter by complexity if specified
    if (complexity) {
      candidates = candidates.filter(c => c.metadata.complexity === complexity);
    }

    // For donation intent, filter by whether amount is present
    if (intent === 'donation' && hasAmount !== undefined) {
      candidates = candidates.filter(c => {
        // Check if conversation includes amount in user messages
        const userMessages = c.conversation.filter(m => m.role === 'user').map(m => m.message);
        const hasAmountInConv = userMessages.some(msg => /\$\d+|\d+\s*pesos|\d{3,}/.test(msg));
        return hasAmountInConv === hasAmount;
      });
    }

    // If no candidates after filtering, fall back to language-only match
    if (candidates.length === 0) {
      console.warn(`[FewShotLearning] No exact matches for criteria, using language-only fallback`);
      candidates = this.goldenConversations.filter(c => c.metadata.language === language);
    }

    // Prioritize simpler conversations for few-shot learning (clearer patterns)
    candidates.sort((a, b) => {
      const complexityOrder = { simple: 0, medium: 1, complex: 2 };
      return complexityOrder[a.metadata.complexity] - complexityOrder[b.metadata.complexity];
    });

    // Select top N candidates
    const selected = candidates.slice(0, maxExamples);

    console.log(`[FewShotLearning] Selected ${selected.length} examples for intent=${intent}, language=${language}`);

    // Convert to few-shot examples
    return selected.map(conv => this.convertToFewShotExample(conv));
  }

  /**
   * Convert a golden conversation to a few-shot example format
   * 
   * FIXED: Now includes ALL agent messages from expectedResponse.messages[]
   * to show the LLM the correct multi-message pattern for donation-with-amount
   */
  private convertToFewShotExample(conversation: GoldenConversation): FewShotExample {
    // Get the last user message
    const userMessages = conversation.conversation.filter(m => m.role === 'user');
    const userMessage = userMessages[userMessages.length - 1]?.message || '';

    // For multi-message responses, include ALL agent messages from expectedResponse
    // This ensures the LLM learns the correct message sequence
    let agentResponse = '';
    const quickActions: any = {};

    if (conversation.expectedResponse.messages && conversation.expectedResponse.messages.length > 0) {
      // Build response from expectedResponse.messages[] (the correct structure)
      const messages = conversation.expectedResponse.messages;

      if (messages.length === 1) {
        // Single message response
        agentResponse = messages[0].message;
        if (messages[0].quickActions) {
          quickActions.showBankingAlias = messages[0].quickActions.showBankingAlias;
          quickActions.showAmountOptions = messages[0].quickActions.showAmountOptions;
          quickActions.showShareActions = messages[0].quickActions.showShareActions;
          quickActions.showHelpActions = messages[0].quickActions.showHelpActions;
        }
      } else {
        // Multi-message response - format all messages (quick actions are indicated separately in metadata)
        // Don't include inline markers - LLM might copy them into the actual response
        const formattedMessages = messages.map((msg, idx) => {
          return msg.message; // Just the message text, no inline markers
        });

        agentResponse = formattedMessages.join('\n\n');

        // For the top-level quickActions, use the first message's actions
        // (this is what CaseAgent should set in metadata)
        if (messages[0].quickActions) {
          quickActions.showBankingAlias = messages[0].quickActions.showBankingAlias;
          quickActions.showAmountOptions = messages[0].quickActions.showAmountOptions;
          quickActions.showShareActions = messages[0].quickActions.showShareActions;
          quickActions.showHelpActions = messages[0].quickActions.showHelpActions;
        }
      }
    } else {
      // Fallback: use conversation history (old format)
      const agentMessages = conversation.conversation.filter(m => m.role === 'agent');
      agentResponse = agentMessages[agentMessages.length - 1]?.message || '';
    }

    return {
      userMessage,
      agentResponse,
      intent: conversation.metadata.intent,
      quickActions: Object.keys(quickActions).length > 0 ? quickActions : undefined,
      kbUsed: conversation.expectedResponse.shouldIncludeKB,
      notes: conversation.notes,
    };
  }

  /**
   * Format few-shot examples for inclusion in a prompt
   *
   * @param examples - Array of few-shot examples
   * @returns Formatted string for prompt inclusion
   */
  formatExamplesForPrompt(examples: FewShotExample[]): string {
    if (examples.length === 0) {
      return '';
    }

    const formattedExamples = examples.map((example, index) => {
      let formatted = `EXAMPLE ${index + 1} (${example.intent} intent):\n`;
      formatted += `User: "${example.userMessage}"\n`;
      formatted += `Your Response: "${example.agentResponse}"\n`;

      // Add quick actions info
      if (example.quickActions) {
        const actions: string[] = [];
        if (example.quickActions.showBankingAlias) actions.push('Show banking alias');
        if (example.quickActions.showAmountOptions) actions.push('Show amount options ($1.000, $5.000, $10.000, Otro)');
        if (example.quickActions.showShareActions) actions.push('Show share buttons (Instagram, Twitter, Facebook)');
        if (example.quickActions.showHelpActions) actions.push('Show help buttons (Donar, Compartir)');

        if (actions.length > 0) {
          formatted += `Quick Actions: ${actions.join(', ')}\n`;
        }
      }

      // Add KB usage note
      if (example.kbUsed) {
        formatted += `Knowledge Base: Used to provide detailed information\n`;
      }

      return formatted;
    }).join('\n');

    return `
GOLDEN CONVERSATION EXAMPLES
============================
These are examples of ideal interactions. Follow these patterns for tone, structure, and quick actions:

${formattedExamples}

============================
Now respond to the current user message following these patterns.
`.trim();
  }

  /**
   * Get statistics about loaded golden conversations
   */
  getStatistics() {
    return {
      total: this.goldenConversations.length,
      byIntent: {
        donation: this.goldenConversations.filter(c => c.metadata.intent === 'donation').length,
        share: this.goldenConversations.filter(c => c.metadata.intent === 'share').length,
        help: this.goldenConversations.filter(c => c.metadata.intent === 'help').length,
        information: this.goldenConversations.filter(c => c.metadata.intent === 'information').length,
        unknown: this.goldenConversations.filter(c => c.metadata.intent === 'unknown').length,
      },
      byLanguage: {
        es: this.goldenConversations.filter(c => c.metadata.language === 'es').length,
        en: this.goldenConversations.filter(c => c.metadata.language === 'en').length,
      },
      byComplexity: {
        simple: this.goldenConversations.filter(c => c.metadata.complexity === 'simple').length,
        medium: this.goldenConversations.filter(c => c.metadata.complexity === 'medium').length,
        complex: this.goldenConversations.filter(c => c.metadata.complexity === 'complex').length,
      },
      reviewed: this.goldenConversations.filter(c => c.metadata.reviewed).length,
    };
  }
}

// Singleton instance
let fewShotService: FewShotLearningService | null = null;

/**
 * Get the few-shot learning service singleton
 */
export function getFewShotLearningService(): FewShotLearningService {
  if (!fewShotService) {
    fewShotService = new FewShotLearningService();
  }
  return fewShotService;
}
