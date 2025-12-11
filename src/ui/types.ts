/**
 * Shared types for chat message processing and rendering
 * These types are used by both toto-ai-hub (backend) and toto-app (frontend)
 */

/**
 * A message that is ready to be rendered by the frontend
 * All processing logic has been applied by ChatMessageProcessor
 */
export interface RenderableMessage {
  id: string;
  text: string;
  role: 'user' | 'agent';
  timestamp: Date;
  paragraphs: string[]; // Pre-split paragraphs for rendering
  quickActions?: RenderableQuickActions;
  formatting?: {
    shouldShowTyping: boolean;
    typingSpeed?: number; // ms per word
    animationDelay?: number; // ms delay before starting
  };
  metadata?: any; // Original metadata from backend
}

/**
 * Quick actions that are ready to be rendered
 * Position is always 'after_message' - render immediately after the message
 */
export interface RenderableQuickActions {
  type: 'banking_alias' | 'social_media' | 'donation_amounts' | 'help_actions' | 'guardian_contact';
  config: QuickActionConfig;
  position: 'after_message'; // Always after the message that contains them
}

/**
 * Configuration for different types of quick actions
 */
export type QuickActionConfig =
  | BankingAliasConfig
  | SocialMediaConfig
  | DonationAmountsConfig
  | HelpActionsConfig
  | GuardianContactConfig;

export interface BankingAliasConfig {
  alias: string;
  label: string; // e.g., "Copiar alias"
}

export interface SocialMediaConfig {
  platforms: Array<{
    platform: 'instagram' | 'twitter' | 'facebook';
    url: string;
  }>;
}

export interface DonationAmountsConfig {
  amounts: (number | null)[]; // null indicates "Otro monto" / "Other amount"
  currency: 'ARS' | 'USD';
  otherAmountLabel?: string; // Label for "other amount" button (default: "Otro monto" / "Other amount")
}

export interface HelpActionsConfig {
  actions: Array<{
    type: 'donate' | 'share' | 'contact' | 'info';
    label: string;
  }>;
}

export interface GuardianContactConfig {
  contacts: Array<{
    channel: 'email' | 'phone' | 'whatsapp' | 'instagram' | 'twitter' | 'facebook';
    url: string; // Formatted URL (mailto:, tel:, https://wa.me/, etc.)
  }>;
}

/**
 * Backend response structure (what CaseAgent returns)
 * This is the input to ChatMessageProcessor
 * Note: This extends the CaseResponse from ../types to add UI-specific fields
 */
export interface CaseResponseForUI {
  success: boolean;
  message: string; // Single message (for now, will be messages[] array in future)
  metadata?: {
    agentType?: string;
    confidence?: number;
    processingTime?: number;
    sessionId?: string;
    intent?: string;
    emotionalState?: string;
    userEngagement?: 'low' | 'medium' | 'high';
    guardianBankingAlias?: string;
    socialMediaUrls?: {
      instagram?: string;
      twitter?: string;
      facebook?: string;
    };
    guardianContactInfo?: {
      email?: string;
      phone?: string;
      whatsapp?: string;
      instagram?: string;
      twitter?: string;
      facebook?: string;
    };
    formattingHints?: {
      suggestedChunks?: string[];
      questionPositions?: number[];
      [key: string]: any; // Allow additional formatting hints
    };
    quickActions?: {
      showBankingAlias?: boolean;
      showTRFAlias?: boolean;
      showSocialMedia?: boolean;
      showAdoptionInfo?: boolean;
      showGuardianContact?: boolean;
      showDonationIntent?: boolean;
      suggestedDonationAmounts?: number[];
      showHelpActions?: boolean;
      actionTriggers?: string[];
    };
    flowHints?: {
      shouldSaveConversation?: boolean;
      shouldShowTyping?: boolean;
      isFirstMessage?: boolean;
      conversationStage?: string;
    };
    [key: string]: any; // Allow additional metadata
  };
  error?: string;
}

