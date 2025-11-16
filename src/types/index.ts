// Core types for toto-ai

/**
 * Base Case Data Interface
 * 
 * This extends the BaseCase model from toto-docs with AI-specific fields.
 * Guardian information (name, banking alias, social links) is fetched from
 * users collection and added to context when processing case messages.
 */
export interface CaseData {
  // Core fields from BaseCase
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'urgent' | 'completed';
  priority: 'urgent' | 'normal';
  category: 'rescue' | 'surgery' | 'treatment' | 'transit' | 'foster';
  guardianId: string;
  donationsReceived: number;
  imageUrl?: string;
  additionalImages?: string[];
  location?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  publishedAt?: string;
  completedAt?: string;
  assignedTo?: string;
  tags?: string[];
  medicalNeeds?: string[];
  specialNeeds?: string[];
  adoptionStatus?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  
  // AI-specific: Guardian info fetched from users collection (not stored in case)
  guardianName?: string;           // Fetched from users.name
  guardianImageUrl?: string;        // Fetched from users.imageUrl
  guardianBankingAlias?: string;    // Fetched from users.bankingAccountAlias
  guardianTwitter?: string;         // Fetched from users.contactInfo.socialLinks.twitter
  guardianInstagram?: string;       // Fetched from users.contactInfo.socialLinks.instagram
  guardianFacebook?: string;        // Fetched from users.contactInfo.socialLinks.facebook
  
  // Legacy compatibility aliases (deprecated, for migration only)
  /** @deprecated Use donationsReceived instead */
  targetAmount?: number;
  /** @deprecated Use donationsReceived instead */
  currentAmount?: number;
  /** @deprecated Removed - cases only work with dogs */
  animalType?: string;
}

export interface UserContext {
  userId: string;
  userRole: 'user' | 'guardian' | 'admin' | 'investor' | 'lead_investor' | 'partner';
  language: 'es' | 'en';
  location?: string;
  preferences?: {
    notifications: boolean;
    communicationStyle: 'formal' | 'casual';
  };
}

export interface AgentResponse {
  success: boolean;
  message: string;
  actions?: AgentAction[];
  metadata?: {
    agentType: string;
    confidence: number;
    processingTime: number;
    sessionId?: string;
    intent?: string;
    emotionalState?: string;
    userEngagement?: 'low' | 'medium' | 'high';
    guardianBankingAlias?: string; // Banking alias for quick action button (when donation intent detected)
    socialMediaUrls?: {
      instagram?: string;
      twitter?: string;
      facebook?: string;
    }; // Social media URLs for quick action buttons (when sharing intent detected)
  };
  error?: string;
}

export interface AgentAction {
  type: 'donate' | 'share' | 'adopt' | 'contact' | 'update' | 'navigate' | 'learn';
  payload: any;
  label: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface CaseResponse extends AgentResponse {
  caseData?: CaseData;
  suggestions?: string[];
  relatedCases?: CaseData[];
}

export interface ConversationContext {
  conversationId: string;
  userId: string;
  caseId?: string;
  platform: 'web' | 'mobile' | 'whatsapp';
  history: ConversationMessage[];
  lastInteraction: Date;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: string;
    confidence?: number;
    actions?: AgentAction[];
  };
}

// Agent configuration
export interface AgentConfig {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  isEnabled: boolean;
  maxRetries: number;
  timeout: number;
}

// Learning and feedback
export interface AgentFeedback {
  conversationId: string;
  userId: string;
  rating: number; // 1-5
  comment?: string;
  helpful: boolean;
  timestamp: Date;
}

export interface LearningData {
  agentType: string;
  interaction: ConversationMessage[];
  feedback?: AgentFeedback;
  outcome: 'success' | 'failure' | 'partial';
  timestamp: Date;
}

// ===== ENHANCED TYPES FOR ADVANCED CASE AGENT =====

export interface EnhancedCaseData extends CaseData {
  medicalHistory?: string[];
  treatmentPlan?: string;
  progressUpdates?: Array<{
    date: string;
    update: string;
    type: 'medical' | 'behavioral' | 'adoption' | 'funding';
  }>;
  relatedCases?: Array<{
    id: string;
    name: string;
    similarity: number;
    reason: string;
  }>;
  guardianExperience?: {
    yearsActive: number;
    casesHandled: number;
    successRate: number;
    specialties: string[];
  };
  urgencyLevel?: 'low' | 'medium' | 'high' | 'critical';
  fundingProgress?: {
    target: number;
    current: number;
    percentage: number;
    daysRemaining?: number;
  };
  adoptionRequirements?: string[];
  behavioralNotes?: string[];
  medicalNotes?: string[];
}

export interface ConversationMemory {
  sessionId: string;
  userId: string;
  caseId: string;
  conversationHistory: Array<{
    timestamp: Date;
    role: 'user' | 'assistant';
    message: string;
    intent?: string;
    actions?: AgentAction[];
  }>;
  userPreferences: {
    language: 'es' | 'en';
    preferredActions: string[];
    communicationStyle: 'formal' | 'casual' | 'empathetic';
    interests: string[];
  };
  contextSummary: string;
  lastInteraction: Date;
}

export interface UserProfile {
  userId: string;
  interactionHistory: Array<{
    caseId: string;
    actions: string[];
    satisfaction: number;
    timestamp: Date;
  }>;
  preferences: {
    animalTypes: string[];
    actionTypes: string[];
    communicationStyle: string;
    language: string;
  };
  engagementLevel: 'low' | 'medium' | 'high';
  lastActive: Date;
}

export interface IntentAnalysis {
  intent: string;
  confidence: number;
  suggestedActions: string[];
  emotionalTone: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface AgentAnalytics {
  totalInteractions: number;
  successfulInteractions: number;
  averageResponseTime: number;
  userSatisfaction: number;
  actionSuccessRate: Map<string, number>;
  totalSessions: number;
  totalUsers: number;
  averageSessionLength: number;
  topActions: Array<{ action: string; count: number }>;
  userEngagementDistribution: { low: number; medium: number; high: number };
}

export interface TestResponse {
  success: boolean;
  response: string;
  metadata: {
    agentType: string;
    confidence: number;
    processingTime: number;
    timestamp: string;
  };
}

export interface TrainingResult {
  success: boolean;
  agentId: string;
  trainingTime: number;
  accuracy: number;
  timestamp: string;
}
