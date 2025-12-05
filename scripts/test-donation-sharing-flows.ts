/**
 * Comprehensive Test Script for Donation and Sharing Flows
 * 
 * This script tests 100% of both flows to ensure they work correctly:
 * 
 * DONATION FLOW:
 * 1. User: "Cómo puedo ayudar?" → Agent: Shows Donate/Share buttons
 * 2. User: "Quiero donar" → Agent: Asks for amount, shows amount buttons
 * 3. User: "$1000" → Agent: Provides alias, asks about Totitos
 * 
 * SHARING FLOW:
 * 1. User: "Cómo puedo ayudar?" → Agent: Shows Donate/Share buttons
 * 2. User: Clicks "Share" → Agent: Shows social media buttons
 * 
 * Usage: npm run test-flows
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { TotoAPIGateway } from '../dist/gateway/TotoAPIGateway';
import { CaseData, UserContext } from '../dist/types';

// Load environment variables
dotenv.config();

// Initialize Firebase (same logic as other scripts)
function initializeFirebase() {
  if (admin.apps.length === 0) {
    const fs = require('fs');
    const path = require('path');
    
    // Check for environment variable first (production/staging)
    const serviceAccountKey = process.env.TOTO_BO_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      try {
        const serviceAccount = JSON.parse(serviceAccountKey);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || 'toto-bo'
        });
        console.log(`✅ Connected to ${serviceAccount.project_id || 'toto-bo'} Firestore (from env)`);
        return admin.firestore();
      } catch (error) {
        console.warn('Failed to parse TOTO_BO_SERVICE_ACCOUNT_KEY, trying local files...');
      }
    }
    
    // Try local service account files
    const prodKeyPath = path.join(__dirname, '../toto-bo-firebase-adminsdk-fbsvc-138f229598.json');
    const stagingKeyPath = path.join(__dirname, '../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');
    
    if (fs.existsSync(prodKeyPath)) {
      const serviceAccount = require(prodKeyPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'toto-bo'
      });
      console.log('✅ Connected to toto-bo (production) Firestore');
    } else if (fs.existsSync(stagingKeyPath)) {
      const serviceAccount = require(stagingKeyPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'toto-bo-stg'
      });
      console.log('✅ Connected to toto-bo-stg (staging) Firestore');
    } else {
      console.warn('⚠️  No Firestore credentials found - tests may fail');
      // Initialize with default (will fail on actual Firestore calls)
      admin.initializeApp({
        projectId: 'toto-bo'
      });
    }
  }
  return admin.firestore();
}

interface TestResult {
  step: string;
  passed: boolean;
  message: string;
  details?: any;
}

interface FlowTest {
  name: string;
  steps: Array<{
    userMessage: string;
    expectedIntent?: string;
    expectedQuickActions?: {
      showHelpActions?: boolean;
      showDonationIntent?: boolean;
      showBankingAlias?: boolean;
      showSocialMedia?: boolean;
      suggestedDonationAmounts?: number[];
    };
    expectedResponseContains?: string[];
    expectedResponseNotContains?: string[];
    expectedKBEntries?: string[];
  }>;
}

const DONATION_FLOW: FlowTest = {
  name: 'Donation Flow',
  steps: [
    {
      userMessage: 'Cómo puedo ayudar?',
      expectedIntent: 'help',
      expectedQuickActions: {
        showHelpActions: true
      },
      expectedResponseContains: ['ayudar', 'donar', 'compartir'],
      expectedResponseNotContains: ['alias', 'TRF', 'totitos'],
      expectedKBEntries: ['flow-help-seeking', 'cases-010']
    },
    {
      userMessage: 'Quiero donar',
      expectedIntent: 'donate',
      expectedQuickActions: {
        showDonationIntent: true,
        suggestedDonationAmounts: [500, 1000, 2500, 5000]
      },
      expectedResponseContains: ['donar', 'monto', 'cuánto'],
      expectedResponseNotContains: ['alias', 'TRF', 'totitos', 'transferencia'],
      expectedKBEntries: ['flow-donation-intent']
    },
    {
      userMessage: 'Quiero donar $1000',
      expectedIntent: 'donate',
      expectedQuickActions: {
        showBankingAlias: true
      },
      expectedResponseContains: ['1000', 'totitos', 'verificar'],
      expectedResponseNotContains: ['cuánto', 'monto'],
      expectedKBEntries: ['flow-donation-amount-selected']
    }
  ]
};

const SHARING_FLOW: FlowTest = {
  name: 'Sharing Flow',
  steps: [
    {
      userMessage: 'Cómo puedo ayudar?',
      expectedIntent: 'help',
      expectedQuickActions: {
        showHelpActions: true
      },
      expectedResponseContains: ['ayudar', 'donar', 'compartir'],
      expectedResponseNotContains: ['alias', 'TRF'],
      expectedKBEntries: ['flow-help-seeking', 'cases-010']
    },
    {
      userMessage: 'Quiero compartir',
      expectedIntent: 'share',
      expectedQuickActions: {
        showSocialMedia: true
      },
      expectedResponseContains: ['compartir', 'instagram', 'twitter', 'facebook'],
      expectedResponseNotContains: ['alias', 'donar'],
      expectedKBEntries: ['flow-sharing-intent', 'social-002']
    }
  ]
};

// Mock case data
const mockCaseData: CaseData = {
  id: 'test-case-001',
  name: 'Luna',
  description: 'Luna es una perrita joven que necesita ayuda médica.',
  status: 'active',
  priority: 'normal',
  category: 'rescue',
  donationsReceived: 0,
  location: 'Buenos Aires, Argentina',
  guardianId: 'test-guardian-001',
  guardianName: 'Test Guardian',
  guardianBankingAlias: 'test.alias.123',
  guardianInstagram: 'https://instagram.com/test_guardian',
  guardianTwitter: 'https://twitter.com/test_guardian',
  guardianFacebook: 'https://facebook.com/test_guardian',
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockUserContext: UserContext = {
  userId: 'test-user-001',
  userRole: 'user',
  language: 'es'
};

async function testFlow(apiGateway: TotoAPIGateway, flow: FlowTest): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const totoAI = apiGateway.getTotoAI();
  const caseAgent = totoAI.getCaseAgent();

  console.log(`\n🧪 Testing ${flow.name}...\n`);

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i];
    console.log(`\n📝 Step ${i + 1}: "${step.userMessage}"`);

    try {
      // Clear console logs to capture KB retrieval
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => {
        logs.push(args.join(' '));
        originalLog(...args);
      };

      const response = await caseAgent.processCaseInquiry(
        step.userMessage,
        mockCaseData,
        mockUserContext
      );

      // Restore console.log
      console.log = originalLog;

      // Extract KB entries from logs
      const retrievedKBEntries: string[] = [];
      logs.forEach(log => {
        if (log.includes('KB entries for query')) {
          // Extract KB entry IDs from logs
          const kbMatches = log.match(/\[(\d+)\]\s+([^(]+)\s+\(ID:\s+([^)]+)\)/g);
          if (kbMatches) {
            kbMatches.forEach(match => {
              const idMatch = match.match(/ID:\s+([^)]+)/);
              if (idMatch) {
                retrievedKBEntries.push(idMatch[1]);
              }
            });
          }
        }
      });

      // Test intent
      if (step.expectedIntent) {
        const intentMatch = response.metadata?.intent === step.expectedIntent;
        results.push({
          step: `Step ${i + 1}: Intent detection`,
          passed: intentMatch,
          message: intentMatch 
            ? `✅ Intent correctly detected as "${step.expectedIntent}"`
            : `❌ Expected intent "${step.expectedIntent}", got "${response.metadata?.intent}"`
        });
      }

      // Test quick actions (metadata may have quickActions as any)
      if (step.expectedQuickActions) {
        const metadata = response.metadata as any;
        const quickActions = metadata?.quickActions || {};
        Object.keys(step.expectedQuickActions).forEach(key => {
          const expected = step.expectedQuickActions![key as keyof typeof step.expectedQuickActions];
          const actual = quickActions[key as keyof typeof quickActions];
          const passed = JSON.stringify(actual) === JSON.stringify(expected);
          results.push({
            step: `Step ${i + 1}: Quick action ${key}`,
            passed,
            message: passed
              ? `✅ ${key} = ${JSON.stringify(actual)}`
              : `❌ Expected ${key} = ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
            details: { expected, actual }
          });
        });
      }

      // Test response content
      if (step.expectedResponseContains) {
        step.expectedResponseContains.forEach(phrase => {
          const contains = response.message?.toLowerCase().includes(phrase.toLowerCase());
          results.push({
            step: `Step ${i + 1}: Response contains "${phrase}"`,
            passed: contains,
            message: contains
              ? `✅ Response contains "${phrase}"`
              : `❌ Response should contain "${phrase}"`
          });
        });
      }

      if (step.expectedResponseNotContains) {
        step.expectedResponseNotContains.forEach(phrase => {
          const notContains = !response.message?.toLowerCase().includes(phrase.toLowerCase());
          results.push({
            step: `Step ${i + 1}: Response does NOT contain "${phrase}"`,
            passed: notContains,
            message: notContains
              ? `✅ Response correctly excludes "${phrase}"`
              : `❌ Response should NOT contain "${phrase}"`
          });
        });
      }

      // Test KB entries
      if (step.expectedKBEntries) {
        step.expectedKBEntries.forEach(kbId => {
          const retrieved = retrievedKBEntries.some(id => id.includes(kbId));
          results.push({
            step: `Step ${i + 1}: KB entry "${kbId}" retrieved`,
            passed: retrieved,
            message: retrieved
              ? `✅ KB entry "${kbId}" was retrieved`
              : `❌ KB entry "${kbId}" was NOT retrieved. Retrieved: ${retrievedKBEntries.join(', ')}`
          });
        });
      }

      console.log(`   Response: ${response.message?.substring(0, 100)}...`);
      console.log(`   Intent: ${response.metadata?.intent}`);
      const metadata = response.metadata as any;
      console.log(`   Quick Actions:`, JSON.stringify(metadata?.quickActions, null, 2));

    } catch (error: any) {
      results.push({
        step: `Step ${i + 1}: Execution`,
        passed: false,
        message: `❌ Error: ${error.message}`,
        details: error
      });
    }
  }

  return results;
}

async function runTests() {
  console.log('🚀 Starting Comprehensive Flow Tests\n');
  console.log('=' .repeat(60));

  try {
    // Initialize Firebase
    const db = initializeFirebase();

    // Initialize API Gateway
    const apiGateway = new TotoAPIGateway(db);
    await apiGateway.initialize();
    console.log('✅ API Gateway initialized\n');

    // Run donation flow tests
    const donationResults = await testFlow(apiGateway, DONATION_FLOW);

    // Run sharing flow tests
    const sharingResults = await testFlow(apiGateway, SHARING_FLOW);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 TEST SUMMARY\n');

    const allResults = [...donationResults, ...sharingResults];
    const passed = allResults.filter(r => r.passed).length;
    const failed = allResults.filter(r => !r.passed).length;
    const total = allResults.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    // Print failed tests
    if (failed > 0) {
      console.log('❌ FAILED TESTS:\n');
      allResults.filter(r => !r.passed).forEach(result => {
        console.log(`  ${result.step}`);
        console.log(`  ${result.message}`);
        if (result.details) {
          console.log(`  Details:`, JSON.stringify(result.details, null, 2));
        }
        console.log('');
      });
    }

    // Print all results
    console.log('\n📋 ALL TEST RESULTS:\n');
    allResults.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.step}: ${result.message}`);
    });

    process.exit(failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests();

