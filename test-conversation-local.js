// Simple script to test case agent conversations locally
// Run: node test-conversation-local.js

const { TotoAI } = require('./dist/index.js');

// Mock case data
const mockCaseData = {
  id: 'test-case-001',
  name: 'Rocky',
  description: 'Rocky fue atropellado por un auto y necesita cuidados médicos de emergencia y rehabilitación para recuperarse completamente.',
  status: 'urgent',
  animalType: 'perro',
  location: 'Buenos Aires',
  guardianId: 'guardian-001',
  guardianName: 'María González',
  guardianBankingAlias: 'dmartinez',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserContext = {
  userId: 'test-user-001',
  userRole: 'user',
  language: 'es',
  platform: 'mobile',
};

async function testConversation() {
  console.log('🧪 Testing Case Agent Conversation\n');
  console.log('=' .repeat(60));
  
  try {
    const totoAI = new TotoAI();
    const caseAgent = totoAI.getCaseAgent();
    
    // Test conversation flow
    const messages = [
      '¡Hola! Te presento a Rocky. Rocky fue atropellado por un auto y necesita cuidados médicos de emergencia y rehabilitación para recuperarse completamente. ¿Te gustaría ayudar a Rocky?',
      'Quiero donar.',
    ];
    
    let conversationContext = {
      conversationId: 'test-conv-001',
      userId: mockUserContext.userId,
      caseId: mockCaseData.id,
      platform: 'mobile',
      history: [],
      lastInteraction: new Date(),
    };
    
    for (let i = 0; i < messages.length; i++) {
      const userMessage = messages[i];
      console.log(`\n👤 User: ${userMessage}`);
      console.log('-'.repeat(60));
      
      const response = await caseAgent.processCaseInquiry(
        userMessage,
        mockCaseData,
        mockUserContext,
        conversationContext
      );
      
      console.log(`🤖 Agent: ${response.message}`);
      console.log(`   Intent: ${response.metadata?.intent || 'N/A'}`);
      console.log(`   Alias in metadata: ${response.metadata?.guardianBankingAlias || 'NOT SET'}`);
      console.log(`   Success: ${response.success}`);
      
      // Update conversation context
      conversationContext.history.push(
        { role: 'user', content: userMessage, timestamp: new Date() },
        { role: 'assistant', content: response.message, timestamp: new Date() }
      );
      
      // Check if alias is in message text (should NOT be)
      if (response.message.toLowerCase().includes('dmartinez')) {
        console.log('   ⚠️  WARNING: Alias found in message text!');
      } else {
        console.log('   ✅ Alias not in message text (correct)');
      }
      
      // Check if alias is in metadata (should be when donation intent)
      if (response.metadata?.intent === 'donate' && response.metadata?.guardianBankingAlias) {
        console.log('   ✅ Alias in metadata (correct)');
      } else if (response.metadata?.intent === 'donate' && !response.metadata?.guardianBankingAlias) {
        console.log('   ⚠️  WARNING: Donation intent but no alias in metadata!');
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run test
testConversation();

