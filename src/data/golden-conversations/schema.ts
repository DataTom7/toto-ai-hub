/**
 * Golden Conversation Schema
 *
 * Defines the structure for curated example conversations
 * used in few-shot learning and evaluation.
 */

export interface GoldenConversation {
  id: string;

  metadata: {
    intent: 'donation' | 'share' | 'help' | 'information' | 'unknown';
    language: 'es' | 'en';
    category: 'rescue' | 'surgery' | 'treatment' | 'transit' | 'foster';
    complexity: 'simple' | 'medium' | 'complex';
    hasContext: boolean;
    multiTurn: boolean;
    reviewed: boolean;  // User marks true after manual review
    reviewNotes?: string;
    qualityScore?: number; // 1-5, assigned during review
  };

  conversation: Array<{
    role: 'user' | 'agent';
    message: string;
    timestamp?: string;
  }>;

  caseData: {
    id: string;
    name: string;
    description: string;
    status: 'draft' | 'active' | 'urgent' | 'completed';
    priority: 'urgent' | 'normal';
    category: 'rescue' | 'surgery' | 'treatment' | 'transit' | 'foster';
    guardianId: string;
    donationsReceived: number;
    imageUrl?: string;
    location?: string;
  };

  userContext: {
    userId: string;
    userRole: 'user' | 'guardian' | 'admin';
    language: 'es' | 'en';
  };

  expectedResponse: {
    intent: string;
    confidence: number;
    suggestedActions: Array<{
      type: 'donation_amount' | 'donation_proof' | 'share' | 'help' | 'contact' | 'more_info';
      label: string;
      data?: any;
    }>;
    shouldIncludeKB?: boolean;
  };

  notes?: string; // Why this is a good example
}

/**
 * Validate a golden conversation
 */
export function validateGoldenConversation(conv: any): conv is GoldenConversation {
  // Basic validation
  if (!conv.id || !conv.metadata || !conv.conversation || !conv.caseData ||
    !conv.userContext || !conv.expectedResponse) {
    return false;
  }

  // At least one exchange
  if (conv.conversation.length < 2) {
    return false;
  }

  // Valid intent
  const validIntents = ['donation', 'share', 'help', 'information', 'unknown'];
  if (!validIntents.includes(conv.metadata.intent)) {
    return false;
  }

  return true;
}

