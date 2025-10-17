import { CaseAgent } from '../src/agents/CaseAgent';
import { CaseData, UserContext } from '../src/types';

describe('CaseAgent', () => {
  let caseAgent: CaseAgent;
  let mockCaseData: CaseData;
  let mockUserContext: UserContext;

  beforeEach(() => {
    caseAgent = new CaseAgent();
    
    mockCaseData = {
      id: 'test-case-1',
      name: 'Luna - Urgent Medical Care',
      description: 'Luna needs urgent medical care for a broken leg',
      status: 'urgent',
      animalType: 'Dog',
      location: 'Madrid, Spain',
      guardianId: 'guardian-1',
      guardianName: 'María García',
      targetAmount: 2000,
      currentAmount: 500,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUserContext = {
      userId: 'user-1',
      userRole: 'user',
      language: 'es',
      location: 'Madrid',
      preferences: {
        notifications: true,
        communicationStyle: 'casual',
      },
    };
  });

  test('should initialize with correct configuration', () => {
    const config = caseAgent.getAgentInfo();
    expect(config.name).toBe('CaseAgent');
    expect(config.isEnabled).toBe(true);
    expect(config.capabilities).toContain('case_information');
  });

  test('should process case inquiry successfully', async () => {
    // Mock the Google AI API key for testing
    process.env.GOOGLE_AI_API_KEY = 'test-key';
    
    const response = await caseAgent.processCaseInquiry(
      'Tell me about this case',
      mockCaseData,
      mockUserContext
    );

    expect(response).toBeDefined();
    expect(response.caseData).toEqual(mockCaseData);
    expect(response.suggestions).toBeDefined();
    expect(Array.isArray(response.suggestions)).toBe(true);
  });

  test('should extract actions from response', () => {
    const response = 'You can donate to help Luna or share this case with others.';
    const actions = (caseAgent as any).extractActions(response);
    
    expect(Array.isArray(actions)).toBe(true);
  });

  test('should generate suggestions based on case data', () => {
    const suggestions = (caseAgent as any).generateSuggestions(mockCaseData, mockUserContext);
    
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});





