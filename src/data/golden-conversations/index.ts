/**
 * Golden Conversations Loader
 *
 * Loads and validates all golden conversations for use in
 * few-shot learning and evaluation.
 */

import fs from 'fs';
import path from 'path';
import { GoldenConversation, validateGoldenConversation } from './schema';

// Re-export types for external use
export type { GoldenConversation } from './schema';

/**
 * Load all golden conversations from JSON files
 */
export function loadGoldenConversations(): GoldenConversation[] {
  const conversations: GoldenConversation[] = [];
  const baseDir = __dirname;

  // Categories to load
  const categories = ['donation', 'share', 'help', 'information', 'edge-cases'];

  for (const category of categories) {
    const categoryDir = path.join(baseDir, category);

    if (!fs.existsSync(categoryDir)) {
      console.warn(`Category directory not found: ${category}`);
      continue;
    }

    const files = fs.readdirSync(categoryDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(categoryDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const conversation = JSON.parse(content);

      if (!validateGoldenConversation(conversation)) {
        console.error(`Invalid golden conversation in ${file}`);
        continue;
      }

      conversations.push(conversation);
    }
  }

  return conversations;
}

/**
 * Load only reviewed golden conversations
 */
export function loadReviewedGoldenConversations(): GoldenConversation[] {
  const all = loadGoldenConversations();
  return all.filter(c => c.metadata.reviewed === true);
}

/**
 * Get golden conversations by intent
 */
export function getGoldenConversationsByIntent(
  intent: 'donation' | 'share' | 'help' | 'information' | 'unknown'
): GoldenConversation[] {
  const all = loadReviewedGoldenConversations();
  return all.filter(c => c.metadata.intent === intent);
}

/**
 * Get golden conversations by language
 */
export function getGoldenConversationsByLanguage(
  language: 'es' | 'en'
): GoldenConversation[] {
  const all = loadReviewedGoldenConversations();
  return all.filter(c => c.metadata.language === language);
}

/**
 * Get statistics about golden conversations
 */
export function getGoldenConversationStats() {
  const all = loadGoldenConversations();
  const reviewed = loadReviewedGoldenConversations();

  return {
    total: all.length,
    reviewed: reviewed.length,
    pending: all.length - reviewed.length,
    byIntent: {
      donation: all.filter(c => c.metadata.intent === 'donation').length,
      share: all.filter(c => c.metadata.intent === 'share').length,
      help: all.filter(c => c.metadata.intent === 'help').length,
      information: all.filter(c => c.metadata.intent === 'information').length,
      unknown: all.filter(c => c.metadata.intent === 'unknown').length,
    },
    byLanguage: {
      es: all.filter(c => c.metadata.language === 'es').length,
      en: all.filter(c => c.metadata.language === 'en').length,
    },
    byComplexity: {
      simple: all.filter(c => c.metadata.complexity === 'simple').length,
      medium: all.filter(c => c.metadata.complexity === 'medium').length,
      complex: all.filter(c => c.metadata.complexity === 'complex').length,
    },
  };
}

