// Simulate a conversation to test KB coverage
// This helps identify what information the agent needs at each step

const { TotoAI } = require('./dist/index.js');

// Mock case data
const mockCaseData = {
  id: 'test-case-chloe',
  name: 'Chloe',
  description: 'Chloe es una perra desnutrida encontrada en mal estado. Necesita apoyo nutricional y cuidados médicos.',
  status: 'urgent',
  animalType: 'perro',
  location: 'Santa Fe, Argentina',
  guardianId: 'guardian-001',
  guardianName: 'Diego Martinez',
  guardianBankingAlias: 'dmartinez',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserContext = {
  userId: 'test-user-tomas',
  userRole: 'user',
  language: 'es',
  platform: 'mobile',
};

// Conversation flow to test
const conversationFlow = [
  {
    step: 1,
    user: "Quiero donar.",
    expectedKB: [
      "Donation process explanation",
      "Alias mention (not in text)",
      "No minimum amount",
      "Transition to totitos/verification"
    ],
    expectedResponse: "Should explain donation process once, mention alias via quick action, offer totitos info"
  },
  {
    step: 2,
    user: "Si, claro. Qué son?",
    expectedKB: [
      "What totitos are",
      "How to earn them",
      "Where to see them",
      "Rating multiplier"
    ],
    expectedResponse: "Should explain totitos clearly, not repeat donation process"
  },
  {
    step: 3,
    user: "Si.",
    expectedKB: [
      "Verification process",
      "How to upload receipt",
      "When verification happens",
      "What happens after"
    ],
    expectedResponse: "Should explain verification, NOT repeat donation instructions"
  },
  {
    step: 4,
    user: "Dale.",
    expectedKB: [
      "Step-by-step verification guide",
      "What to upload",
      "Where to upload",
      "Timeline expectations"
    ],
    expectedResponse: "Should provide detailed steps, NOT repeat donation process again"
  },
  {
    step: 5,
    user: "Si.",
    expectedKB: [
      "Conversation progression",
      "Avoiding repetition",
      "Next steps (sharing, other cases, close)"
    ],
    expectedResponse: "Should move forward, suggest sharing or close, NOT repeat anything"
  }
];

async function simulateConversation() {
  console.log('🧪 Simulating Conversation to Test KB Coverage\n');
  console.log('='.repeat(70));
  
  try {
    const totoAI = new TotoAI();
    const caseAgent = totoAI.getCaseAgent();
    
    let conversationContext = {
      conversationId: 'test-sim-001',
      userId: mockUserContext.userId,
      caseId: mockCaseData.id,
      platform: 'mobile',
      history: [],
      lastInteraction: new Date(),
    };
    
    // Add welcome message to history
    conversationContext.history.push({
      role: 'assistant',
      content: '¡Hola! Te presento a Chloe. Chloe es una perra desnutrida encontrada en mal estado. Necesita apoyo nutricional y cuidados médicos. ¿Te gustaría ayudar a Chloe?',
      timestamp: new Date()
    });
    
    console.log('\n📋 Conversation Flow Analysis:\n');
    
    for (const turn of conversationFlow) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`\nStep ${turn.step}: User says "${turn.user}"`);
      console.log(`\n📚 Expected KB Topics:`);
      turn.expectedKB.forEach((topic, i) => {
        console.log(`   ${i + 1}. ${topic}`);
      });
      
      console.log(`\n✅ Expected Behavior:`);
      console.log(`   ${turn.expectedResponse}`);
      
      // Simulate what KB entries would be retrieved
      // (In real scenario, RAG would retrieve these)
      console.log(`\n🔍 KB Entries That Should Be Retrieved:`);
      
      const relevantKB = identifyRelevantKB(turn.step, turn.user);
      relevantKB.forEach((kb, i) => {
        console.log(`   ${i + 1}. ${kb.id}: ${kb.title}`);
      });
      
      // Check for gaps
      const gaps = checkForGaps(turn.expectedKB, relevantKB);
      if (gaps.length > 0) {
        console.log(`\n⚠️  Potential Gaps:`);
        gaps.forEach((gap, i) => {
          console.log(`   ${i + 1}. ${gap}`);
        });
      } else {
        console.log(`\n✅ All expected topics covered by KB entries`);
      }
      
      // Note: We're not actually calling the agent here (would need API key)
      // This is just analyzing what KB should be available
    }
    
    console.log(`\n${'─'.repeat(70)}`);
    console.log('\n📊 Summary:\n');
    console.log('This simulation shows:');
    console.log('1. What KB entries should be retrieved at each step');
    console.log('2. Whether all expected topics are covered');
    console.log('3. Potential gaps in knowledge base');
    console.log('\n💡 Next Steps:');
    console.log('- Review identified gaps');
    console.log('- Test with actual agent (requires API key)');
    console.log('- Adjust KB entries based on real conversation results');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('GOOGLE_AI_API_KEY')) {
      console.log('\n💡 Note: This simulation analyzes KB coverage without calling the agent.');
      console.log('   To test with actual agent responses, set GOOGLE_AI_API_KEY environment variable.');
    }
  }
}

function identifyRelevantKB(step, userMessage) {
  const kbEntries = [];
  
  // Step 1: Donation intent
  if (step === 1) {
    kbEntries.push(
      { id: 'kb-donations-001', title: 'Donation Process' },
      { id: 'kb-donations-013', title: 'Banking Alias Provision' },
      { id: 'kb-conversation-001', title: 'Conversation Progression' }
    );
  }
  
  // Step 2: Totitos question
  if (step === 2 && userMessage.toLowerCase().includes('qué son') || userMessage.toLowerCase().includes('que son')) {
    kbEntries.push(
      { id: 'kb-donations-003', title: 'Totitos Loyalty System' },
      { id: 'kb-conversation-002', title: 'Handling Affirmative Responses' }
    );
  }
  
  // Step 3: Verification interest
  if (step === 3) {
    kbEntries.push(
      { id: 'kb-donations-002', title: 'Donation Verification Process' },
      { id: 'kb-donations-015', title: 'Donation Verification Step-by-Step Guide' },
      { id: 'kb-conversation-002', title: 'Handling Affirmative Responses' }
    );
  }
  
  // Step 4: Ready for steps
  if (step === 4) {
    kbEntries.push(
      { id: 'kb-donations-015', title: 'Donation Verification Step-by-Step Guide' },
      { id: 'kb-conversation-001', title: 'Conversation Progression' }
    );
  }
  
  // Step 5: Confirmation
  if (step === 5) {
    kbEntries.push(
      { id: 'kb-conversation-001', title: 'Conversation Progression' },
      { id: 'kb-conversation-002', title: 'Handling Affirmative Responses' }
    );
  }
  
  return kbEntries;
}

function checkForGaps(expectedTopics, kbEntries) {
  const gaps = [];
  
  // Simple check - in real scenario would be more sophisticated
  const kbTopics = kbEntries.map(kb => kb.title.toLowerCase());
  
  expectedTopics.forEach(topic => {
    const topicLower = topic.toLowerCase();
    const covered = kbTopics.some(kbTopic => 
      kbTopic.includes(topicLower) || topicLower.includes(kbTopic.split(' ')[0])
    );
    
    if (!covered) {
      gaps.push(`"${topic}" - may not be fully covered`);
    }
  });
  
  return gaps;
}

// Run simulation
simulateConversation();

