// Core types for toto-ai

export interface CaseData {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'urgent' | 'completed' | 'paused';
  animalType: string;
  location: string;
  guardianId: string;
  guardianName: string;
  targetAmount?: number;
  currentAmount?: number;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  // Guardian information for donations and social media
  guardianBankingAlias?: string;
  guardianTwitter?: string;
  guardianInstagram?: string;
  guardianFacebook?: string;
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
