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
}

export interface UserContext {
  userId: string;
  userRole: 'user' | 'guardian' | 'admin';
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
  };
  error?: string;
}

export interface AgentAction {
  type: 'donate' | 'share' | 'adopt' | 'contact' | 'update' | 'navigate';
  payload: any;
  label: string;
  description: string;
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
