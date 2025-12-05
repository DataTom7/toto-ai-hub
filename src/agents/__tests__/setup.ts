import { CaseAgent } from '../CaseAgent';
import { RAGService } from '../../services/RAGService';
import { CaseData, UserContext, ConversationMemory } from '../../types';

export function createMockRAGService(): jest.Mocked<RAGService> {
  return {
    retrieveKnowledge: jest.fn(),
    addKnowledgeChunks: jest.fn(),
    generateEmbedding: jest.fn(),
  } as any;
}

export function createTestCaseAgent(ragService?: RAGService): CaseAgent {
  const agent = new CaseAgent();
  if (ragService) {
    agent.setRAGService(ragService);
  }
  return agent;
}

export const mockCaseData: CaseData = {
  id: 'case-123',
  name: 'Luna',
  description: 'Rescued dog needs surgery',
  status: 'active',
  priority: 'urgent',
  category: 'surgery',
  guardianId: 'guardian-456',
  donationsReceived: 5000,
  imageUrl: 'https://example.com/luna.jpg',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockUserContext: UserContext = {
  userId: 'user-789',
  userRole: 'user',
  language: 'es',
};

export const mockConversationMemory: ConversationMemory = {
  sessionId: 'session-123',
  userId: 'user-789',
  caseId: 'case-123',
  conversationHistory: [],
  userPreferences: {
    language: 'es',
    preferredActions: [],
    communicationStyle: 'empathetic',
    interests: []
  },
  contextSummary: '',
  lastInteraction: new Date(),
};

