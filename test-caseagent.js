/**
 * Local CaseAgent Testing Script
 *
 * Test the refactored CaseAgent with Spanish and English queries
 * to verify multi-language support and KB integration.
 *
 * Usage:
 *   node test-caseagent.js
 */

require('dotenv').config();
const { TotoAI } = require('./dist/index.js');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase for KB access
let serviceAccount;
const localPath = path.join(__dirname, 'toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');

if (fs.existsSync(localPath)) {
  serviceAccount = JSON.parse(fs.readFileSync(localPath, 'utf8'));
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'toto-bo-stg'
    });
  }
  console.log('✅ Firebase initialized for KB access\n');
} else {
  console.error('❌ Service account file not found');
  process.exit(1);
}

// Sample case data for testing
const testCaseData = {
  id: 'test-case-001',
  name: 'Luna',
  description: 'Luna es una perrita de 2 años que necesita ayuda con tratamiento veterinario. Es muy cariñosa y busca un hogar temporal.',
  status: 'active',
  animalType: 'dog',
  location: 'Ciudad de México',
  guardianName: 'Refugio Patitas Felices',
  bankingAlias: 'refugio.patitas.mp',
  adoptionStatus: 'available'
};

const testUserContext = {
  userId: 'test-user-001',
  userName: 'Test User',
  userRole: 'donor',
  preferredLanguage: 'es'
};

// Test queries in Spanish and English
const testQueries = {
  spanish: [
    {
      query: 'Hola, quiero ayudar',
      description: 'Initial greeting in Spanish'
    },
    {
      query: 'Quiero donar',
      description: 'Donation intent in Spanish'
    },
    {
      query: '$500',
      description: 'Donation amount selection'
    },
    {
      query: 'Cómo puedo ayudar?',
      description: 'Help-seeking intent'
    },
    {
      query: 'Cómo comparto el caso?',
      description: 'Sharing intent'
    }
  ],
  english: [
    {
      query: 'Hello, I want to help',
      description: 'Initial greeting in English'
    },
    {
      query: 'I want to donate',
      description: 'Donation intent in English'
    },
    {
      query: 'How can I help?',
      description: 'Help-seeking intent in English'
    },
    {
      query: 'How do I share this case?',
      description: 'Sharing intent in English'
    }
  ]
};

async function testCaseAgent() {
  console.log('🧪 Testing CaseAgent with Refactored Prompts\n');
  console.log('='.repeat(80));
  console.log('Test Case: Luna - Rescue Dog needing help');
  console.log('='.repeat(80));
  console.log();

  try {
    // Initialize TotoAI
    const totoAI = new TotoAI();
    await totoAI.initialize();
    console.log('✅ TotoAI initialized\n');

    // Test Spanish queries
    console.log('📝 TESTING SPANISH QUERIES');
    console.log('='.repeat(80));

    for (const test of testQueries.spanish) {
      console.log(`\n🔹 Test: ${test.description}`);
      console.log(`   Query: "${test.query}"`);
      console.log('   ---');

      try {
        const result = await totoAI.processCaseMessage(
          test.query,
          testCaseData,
          testUserContext
        );

        if (result.success) {
          console.log(`   ✅ Response:`);
          console.log(`   ${result.message}\n`);

          if (result.suggestedActions && result.suggestedActions.length > 0) {
            console.log(`   📋 Suggested Actions: ${result.suggestedActions.length}`);
            result.suggestedActions.forEach((action, i) => {
              console.log(`      ${i + 1}. ${action.type}: ${action.label}`);
            });
          }
        } else {
          console.log(`   ❌ Error: ${result.message}`);
        }
      } catch (error) {
        console.log(`   ❌ Exception: ${error.message}`);
      }

      console.log('   ' + '-'.repeat(76));
    }

    // Test English queries
    console.log('\n\n📝 TESTING ENGLISH QUERIES');
    console.log('='.repeat(80));

    // Update user context for English
    const englishUserContext = {
      ...testUserContext,
      preferredLanguage: 'en'
    };

    for (const test of testQueries.english) {
      console.log(`\n🔹 Test: ${test.description}`);
      console.log(`   Query: "${test.query}"`);
      console.log('   ---');

      try {
        const result = await totoAI.processCaseMessage(
          test.query,
          testCaseData,
          englishUserContext
        );

        if (result.success) {
          console.log(`   ✅ Response:`);
          console.log(`   ${result.message}\n`);

          if (result.suggestedActions && result.suggestedActions.length > 0) {
            console.log(`   📋 Suggested Actions: ${result.suggestedActions.length}`);
            result.suggestedActions.forEach((action, i) => {
              console.log(`      ${i + 1}. ${action.type}: ${action.label}`);
            });
          }
        } else {
          console.log(`   ❌ Error: ${result.message}`);
        }
      } catch (error) {
        console.log(`   ❌ Exception: ${error.message}`);
      }

      console.log('   ' + '-'.repeat(76));
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('✅ TESTING COMPLETE');
    console.log('='.repeat(80));
    console.log('\nVerify that:');
    console.log('  ✓ Spanish queries get Spanish responses');
    console.log('  ✓ English queries get English responses');
    console.log('  ✓ Donation flows follow KB guidelines');
    console.log('  ✓ Sharing flows explain HOW to share');
    console.log('  ✓ Help-seeking provides actionable options');
    console.log('  ✓ No hardcoded bilingual content appears');
    console.log();

  } catch (error) {
    console.error('\n❌ Testing failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testCaseAgent()
  .then(() => {
    console.log('✅ Test script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });
