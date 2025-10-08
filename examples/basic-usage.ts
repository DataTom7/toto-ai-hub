import { TotoAI, CaseData, UserContext } from '../src';

// Example usage of toto-ai
async function example() {
  // Initialize TotoAI
  const totoAI = new TotoAI();

  // Example case data
  const caseData: CaseData = {
    id: 'case-123',
    name: 'Luna - Urgent Medical Care',
    description: 'Luna is a 2-year-old dog who needs urgent surgery for a broken leg. She was found on the street and needs immediate medical attention.',
    status: 'urgent',
    animalType: 'Dog',
    location: 'Madrid, Spain',
    guardianId: 'guardian-456',
    guardianName: 'María García',
    targetAmount: 2000,
    currentAmount: 500,
    imageUrl: 'https://example.com/luna.jpg',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
  };

  // Example user context
  const userContext: UserContext = {
    userId: 'user-789',
    userRole: 'user',
    language: 'es',
    location: 'Madrid',
    preferences: {
      notifications: true,
      communicationStyle: 'casual',
    },
  };

  // Process a case-related message
  const response = await totoAI.processCaseMessage(
    'I want to help Luna. What can I do?',
    caseData,
    userContext
  );

  console.log('Agent Response:', response);
  console.log('Success:', response.success);
  console.log('Message:', response.message);
  console.log('Actions:', response.actions);
  console.log('Suggestions:', response.suggestions);

  // Get available agents
  const agents = totoAI.getAvailableAgents();
  console.log('Available Agents:', agents);
}

// Run the example
if (require.main === module) {
  example().catch(console.error);
}
