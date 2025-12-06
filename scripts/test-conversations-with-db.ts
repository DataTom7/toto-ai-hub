/**
 * Enhanced Test Script for Conversations with Database Saving
 * 
 * This script:
 * 1. Runs 10 test conversations (5 donation flows, 5 sharing flows)
 * 2. Saves each conversation to Firestore
 * 3. Generates a detailed report showing full conversations with pass/fail for each step
 * 
 * Usage: npm run test-conversations-db
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { TotoAPIGateway } from '../dist/gateway/TotoAPIGateway';
import { CaseData, UserContext } from '../dist/types';

// Load environment variables
dotenv.config();

// Initialize Firebase
function initializeFirebase() {
  if (admin.apps.length === 0) {
    const fs = require('fs');
    const path = require('path');
    
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
      admin.initializeApp({
        projectId: 'toto-bo'
      });
    }
  }
  return admin.firestore();
}

interface ConversationTestResult {
  conversationId: string;
  flowName: string;
  testSessionId: string;
  passed: boolean;
  steps: Array<{
    stepNumber: number;
    userMessage: string;
    agentResponse: string;
    intent?: string;
    quickActions?: any;
    passed: boolean;
    failures: string[];
    kbEntriesRetrieved?: string[];
  }>;
  summary: {
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
    successRate: number;
  };
}

interface TestConversation {
  flowName: string;
  caseData: CaseData;
  userContext: UserContext;
  messages: Array<{
    userMessage: string;
    expectedIntent?: string;
    expectedQuickActions?: any;
    expectedResponseContains?: string[];
    expectedResponseNotContains?: string[];
    expectedKBEntries?: string[];
  }>;
}

// Test conversations (10 total: 5 donation, 5 sharing)
const TEST_CONVERSATIONS: TestConversation[] = [
  // Donation Flow 1
  {
    flowName: 'Donation Flow - Standard',
    caseData: {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    userContext: {
      userId: 'test-user-001',
      userRole: 'user',
      language: 'es'
    },
    messages: [
      {
        userMessage: 'Cómo puedo ayudar?',
        expectedIntent: 'help',
        expectedQuickActions: { showHelpActions: true },
        expectedResponseContains: ['ayudar', 'donar', 'compartir'],
        expectedResponseNotContains: ['alias', 'TRF'],
        expectedKBEntries: ['flow-help-seeking']
      },
      {
        userMessage: 'Quiero donar',
        expectedIntent: 'donate',
        expectedQuickActions: { showDonationIntent: true, suggestedDonationAmounts: [500, 1000, 2500, 5000] },
        expectedResponseContains: ['donar', 'cuánto'],
        expectedResponseNotContains: ['alias', 'TRF'],
        expectedKBEntries: ['flow-donation-intent']
      },
      {
        userMessage: 'Quiero donar $1000',
        expectedIntent: 'donate',
        expectedQuickActions: { showBankingAlias: true },
        expectedResponseContains: ['1000', 'totitos'],
        expectedKBEntries: ['flow-donation-amount-selected']
      }
    ]
  },
  // Donation Flow 2 - Different amounts
  {
    flowName: 'Donation Flow - Amount $500',
    caseData: {
      id: 'test-case-002',
      name: 'Max',
      description: 'Max necesita cirugía urgente.',
      status: 'active',
      priority: 'urgent',
      category: 'rescue',
      donationsReceived: 0,
      location: 'Córdoba, Argentina',
      guardianId: 'test-guardian-002',
      guardianName: 'Test Guardian 2',
      guardianBankingAlias: 'test.alias.456',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    userContext: {
      userId: 'test-user-002',
      userRole: 'user',
      language: 'es'
    },
    messages: [
      { userMessage: 'Cómo puedo ayudar?', expectedIntent: 'help' },
      { userMessage: 'Quiero donar', expectedIntent: 'donate' },
      { userMessage: 'Quiero donar $500', expectedIntent: 'donate', expectedQuickActions: { showBankingAlias: true } }
    ]
  },
  // Donation Flow 3 - Direct amount
  {
    flowName: 'Donation Flow - Direct Amount',
    caseData: {
      id: 'test-case-003',
      name: 'Bella',
      description: 'Bella necesita tratamiento.',
      status: 'active',
      priority: 'normal',
      category: 'rescue',
      donationsReceived: 0,
      location: 'Rosario, Argentina',
      guardianId: 'test-guardian-003',
      guardianName: 'Test Guardian 3',
      guardianBankingAlias: 'test.alias.789',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    userContext: {
      userId: 'test-user-003',
      userRole: 'user',
      language: 'es'
    },
    messages: [
      { userMessage: 'Quiero donar $2500', expectedIntent: 'donate' }
    ]
  },
  // Donation Flow 4 - Help then donate
  {
    flowName: 'Donation Flow - Help to Donate',
    caseData: {
      id: 'test-case-004',
      name: 'Rocky',
      description: 'Rocky necesita hogar.',
      status: 'active',
      priority: 'normal',
      category: 'rescue',
      donationsReceived: 0,
      location: 'Mendoza, Argentina',
      guardianId: 'test-guardian-004',
      guardianName: 'Test Guardian 4',
      guardianBankingAlias: 'test.alias.101',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    userContext: {
      userId: 'test-user-004',
      userRole: 'user',
      language: 'es'
    },
    messages: [
      { userMessage: 'Cómo puedo ayudar?', expectedIntent: 'help' },
      { userMessage: 'Quiero donar', expectedIntent: 'donate' },
      { userMessage: 'Quiero donar $1000', expectedIntent: 'donate' }
    ]
  },
  // Donation Flow 5 - Large amount
  {
    flowName: 'Donation Flow - Large Amount',
    caseData: {
      id: 'test-case-005',
      name: 'Sofía',
      description: 'Sofía necesita ayuda.',
      status: 'active',
      priority: 'normal',
      category: 'rescue',
      donationsReceived: 0,
      location: 'La Plata, Argentina',
      guardianId: 'test-guardian-005',
      guardianName: 'Test Guardian 5',
      guardianBankingAlias: 'test.alias.202',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    userContext: {
      userId: 'test-user-005',
      userRole: 'user',
      language: 'es'
    },
    messages: [
      { userMessage: 'Quiero donar $5000', expectedIntent: 'donate' }
    ]
  },
  // Sharing Flow 1
  {
    flowName: 'Sharing Flow - Standard',
    caseData: {
      id: 'test-case-006',
      name: 'Luna',
      description: 'Luna es una perrita joven que necesita ayuda médica.',
      status: 'active',
      priority: 'normal',
      category: 'rescue',
      donationsReceived: 0,
      location: 'Buenos Aires, Argentina',
      guardianId: 'test-guardian-006',
      guardianName: 'Test Guardian',
      guardianInstagram: 'https://instagram.com/test_guardian',
      guardianTwitter: 'https://twitter.com/test_guardian',
      guardianFacebook: 'https://facebook.com/test_guardian',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    userContext: {
      userId: 'test-user-006',
      userRole: 'user',
      language: 'es'
    },
    messages: [
      { userMessage: 'Cómo puedo ayudar?', expectedIntent: 'help' },
      { userMessage: 'Quiero compartir', expectedIntent: 'share', expectedQuickActions: { showSocialMedia: true } }
    ]
  },
  // Sharing Flow 2
  {
    flowName: 'Sharing Flow - Direct Share',
    caseData: {
      id: 'test-case-007',
      name: 'Max',
      description: 'Max necesita ayuda.',
      status: 'active',
      priority: 'normal',
      category: 'rescue',
      donationsReceived: 0,
      location: 'Córdoba, Argentina',
      guardianId: 'test-guardian-007',
      guardianName: 'Test Guardian 2',
      guardianInstagram: 'https://instagram.com/test_guardian',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    userContext: {
      userId: 'test-user-007',
      userRole: 'user',
      language: 'es'
    },
    messages: [
      { userMessage: 'Quiero compartir este caso', expectedIntent: 'share' }
    ]
  },
  // Sharing Flow 3
  {
    flowName: 'Sharing Flow - Help to Share',
    caseData: {
      id: 'test-case-008',
      name: 'Bella',
      description: 'Bella necesita tratamiento.',
      status: 'active',
      priority: 'normal',
      category: 'rescue',
      donationsReceived: 0,
      location: 'Rosario, Argentina',
      guardianId: 'test-guardian-008',
      guardianName: 'Test Guardian 3',
      guardianTwitter: 'https://twitter.com/test_guardian',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    userContext: {
      userId: 'test-user-008',
      userRole: 'user',
      language: 'es'
    },
    messages: [
      { userMessage: 'Cómo puedo ayudar?', expectedIntent: 'help' },
      { userMessage: 'Quiero compartir', expectedIntent: 'share' }
    ]
  },
  // Sharing Flow 4
  {
    flowName: 'Sharing Flow - Share on Social',
    caseData: {
      id: 'test-case-009',
      name: 'Rocky',
      description: 'Rocky necesita hogar.',
      status: 'active',
      priority: 'normal',
      category: 'rescue',
      donationsReceived: 0,
      location: 'Mendoza, Argentina',
      guardianId: 'test-guardian-009',
      guardianName: 'Test Guardian 4',
      guardianFacebook: 'https://facebook.com/test_guardian',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    userContext: {
      userId: 'test-user-009',
      userRole: 'user',
      language: 'es'
    },
    messages: [
      { userMessage: 'Quiero compartir en redes sociales', expectedIntent: 'share' }
    ]
  },
  // Sharing Flow 5
  {
    flowName: 'Sharing Flow - Spread the Word',
    caseData: {
      id: 'test-case-010',
      name: 'Sofía',
      description: 'Sofía necesita ayuda.',
      status: 'active',
      priority: 'normal',
      category: 'rescue',
      donationsReceived: 0,
      location: 'La Plata, Argentina',
      guardianId: 'test-guardian-010',
      guardianName: 'Test Guardian 5',
      guardianInstagram: 'https://instagram.com/test_guardian',
      guardianTwitter: 'https://twitter.com/test_guardian',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    userContext: {
      userId: 'test-user-010',
      userRole: 'user',
      language: 'es'
    },
    messages: [
      { userMessage: 'Cómo puedo ayudar?', expectedIntent: 'help' },
      { userMessage: 'Compartir su historia', expectedIntent: 'share' }
    ]
  }
];

async function saveConversationToDB(
  db: admin.firestore.Firestore,
  testResult: ConversationTestResult,
  testConversation: TestConversation
): Promise<string> {
  const { Timestamp } = admin.firestore;
  const testSessionId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const messages = [];
  
  // Add system message (case introduction)
  messages.push({
    id: `msg-${Date.now()}-intro`,
    type: 'system',
    message: `Te presento a ${testConversation.caseData.name}. ${testConversation.caseData.description}`,
    timestamp: Timestamp.now(),
    metadata: {
      isTest: true,
      testSessionId,
      testedBy: 'test-script'
    }
  });
  
  // Add conversation messages
  testResult.steps.forEach((step, idx) => {
    // User message
    messages.push({
      id: `msg-${Date.now()}-${idx}-user`,
      type: 'user',
      message: step.userMessage,
      timestamp: Timestamp.now(),
      metadata: {
        isTest: true,
        testSessionId,
        testedBy: 'test-script',
        intent: step.intent,
        stepNumber: step.stepNumber,
        testPassed: step.passed,
        testFailures: step.failures
      }
    });
    
    // Agent response
    messages.push({
      id: `msg-${Date.now()}-${idx}-agent`,
      type: 'system',
      message: step.agentResponse,
      timestamp: Timestamp.now(),
      metadata: {
        isTest: true,
        testSessionId,
        testedBy: 'test-script',
        agentType: 'CaseAgent',
        intent: step.intent,
        quickActions: step.quickActions,
        stepNumber: step.stepNumber,
        testPassed: step.passed,
        testFailures: step.failures,
        kbEntriesRetrieved: step.kbEntriesRetrieved
      }
    });
  });
  
  const conversationDoc: any = {
    userId: testConversation.userContext.userId,
    caseId: testConversation.caseData.id,
    caseName: testConversation.caseData.name,
    messages,
    actionTaken: 'test',
    createdAt: Timestamp.now(),
    lastMessageAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    platform: ['testing'],
    isArchived: false,
    isTest: true,
    testSessionId,
    testedBy: 'test-script',
    testMetadata: {
      flowName: testResult.flowName,
      passed: testResult.passed,
      summary: testResult.summary
    }
  };
  
  if (testConversation.caseData.imageUrl) {
    conversationDoc.caseImageUrl = testConversation.caseData.imageUrl;
  }
  
  const docRef = await db.collection('conversations').add(conversationDoc);
  return docRef.id;
}

async function runTestConversation(
  apiGateway: TotoAPIGateway,
  testConversation: TestConversation,
  testSessionId: string
): Promise<ConversationTestResult> {
  const totoAI = apiGateway.getTotoAI();
  const caseAgent = totoAI.getCaseAgent();
  
  const steps: ConversationTestResult['steps'] = [];
  const logs: string[] = [];
  const originalLog = console.log;
  
  // Capture logs for KB entry detection (but filter out verbose logs)
  console.log = (...args: any[]) => {
    const logLine = args.join(' ');
    // Only capture relevant logs (KB entries, retrieval info)
    if (logLine.includes('KB entries') || logLine.includes('Retrieved') || logLine.includes('ID:')) {
      logs.push(logLine);
    }
    // Always output to console
    originalLog(...args);
  };
  
  try {
    for (let i = 0; i < testConversation.messages.length; i++) {
      const message = testConversation.messages[i];
      const stepNumber = i + 1;
      
      console.log(`\n📝 Step ${stepNumber}: "${message.userMessage}"`);
      console.log(`   ⏳ Processing...`);
      
      const startTime = Date.now();
      const response = await caseAgent.processCaseInquiry(
        message.userMessage,
        testConversation.caseData,
        testConversation.userContext,
        {
          conversationId: testSessionId,
          userId: testConversation.userContext.userId,
          platform: 'web' as const,
          history: steps.map((s, idx) => ({
            id: `msg-${Date.now()}-${idx}`,
            role: 'user' as const,
            content: s.userMessage,
            timestamp: new Date()
          })),
          lastInteraction: new Date()
        }
      );
      
      const processingTime = Date.now() - startTime;
      console.log(`   ✅ Response received (${processingTime}ms)`);
      
      // Extract KB entries from logs
      const retrievedKBEntries: string[] = [];
      logs.forEach(log => {
        const idMatches = log.match(/\(ID:\s+([^)]+)\)/g);
        if (idMatches) {
          idMatches.forEach(match => {
            const idMatch = match.match(/ID:\s+([^)]+)/);
            if (idMatch) {
              const kbId = idMatch[1].trim();
              if (kbId && !retrievedKBEntries.includes(kbId)) {
                retrievedKBEntries.push(kbId);
              }
            }
          });
        }
        const kbPatternMatches = log.match(/\bkb-[a-z0-9-]+/gi);
        if (kbPatternMatches) {
          kbPatternMatches.forEach(match => {
            const kbId = match.trim();
            if (kbId && !retrievedKBEntries.includes(kbId)) {
              retrievedKBEntries.push(kbId);
            }
          });
        }
      });
      
      // Validate step
      const failures: string[] = [];
      const metadata = response.metadata as any;
      const quickActions = metadata?.quickActions || {};
      
      if (message.expectedIntent && response.metadata?.intent !== message.expectedIntent) {
        failures.push(`Expected intent "${message.expectedIntent}", got "${response.metadata?.intent}"`);
      }
      
      if (message.expectedQuickActions) {
        Object.keys(message.expectedQuickActions).forEach(key => {
          const expected = message.expectedQuickActions![key as keyof typeof message.expectedQuickActions];
          const actual = quickActions[key as keyof typeof quickActions];
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            failures.push(`Expected ${key} = ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
          }
        });
      }
      
      if (message.expectedResponseContains) {
        message.expectedResponseContains.forEach(phrase => {
          if (!response.message?.toLowerCase().includes(phrase.toLowerCase())) {
            failures.push(`Response should contain "${phrase}"`);
          }
        });
      }
      
      if (message.expectedResponseNotContains) {
        message.expectedResponseNotContains.forEach(phrase => {
          if (response.message?.toLowerCase().includes(phrase.toLowerCase())) {
            failures.push(`Response should NOT contain "${phrase}"`);
          }
        });
      }
      
      if (message.expectedKBEntries) {
        message.expectedKBEntries.forEach(kbId => {
          const retrieved = retrievedKBEntries.some(id => 
            id.includes(kbId) || id.includes(`kb-${kbId}`) || id === kbId || id === `kb-${kbId}`
          );
          if (!retrieved) {
            failures.push(`KB entry "${kbId}" was NOT retrieved. Retrieved: ${retrievedKBEntries.join(', ') || 'none'}`);
          }
        });
      }
      
      steps.push({
        stepNumber,
        userMessage: message.userMessage,
        agentResponse: response.message || '',
        intent: response.metadata?.intent,
        quickActions,
        passed: failures.length === 0,
        failures,
        kbEntriesRetrieved: retrievedKBEntries
      });
    }
  } finally {
    console.log = originalLog;
  }
  
  const passedSteps = steps.filter(s => s.passed).length;
  const totalSteps = steps.length;
  
  return {
    conversationId: '', // Will be set after saving
    flowName: testConversation.flowName,
    testSessionId,
    passed: passedSteps === totalSteps,
    steps,
    summary: {
      totalSteps,
      passedSteps,
      failedSteps: totalSteps - passedSteps,
      successRate: (passedSteps / totalSteps) * 100
    }
  };
}

async function generateReport(results: ConversationTestResult[]): Promise<string> {
  let report = '\n' + '='.repeat(80) + '\n';
  report += '📊 DETAILED TEST CONVERSATION REPORT\n';
  report += '='.repeat(80) + '\n\n';
  
  const totalConversations = results.length;
  const passedConversations = results.filter(r => r.passed).length;
  const failedConversations = totalConversations - passedConversations;
  
  report += `Total Conversations: ${totalConversations}\n`;
  report += `✅ Passed: ${passedConversations}\n`;
  report += `❌ Failed: ${failedConversations}\n`;
  report += `Success Rate: ${((passedConversations / totalConversations) * 100).toFixed(1)}%\n\n`;
  
  results.forEach((result, idx) => {
    const icon = result.passed ? '✅' : '❌';
    report += `${icon} Conversation ${idx + 1}: ${result.flowName}\n`;
    report += `   Conversation ID: ${result.conversationId}\n`;
    report += `   Test Session ID: ${result.testSessionId}\n`;
    report += `   Status: ${result.passed ? 'PASSED' : 'FAILED'}\n`;
    report += `   Steps: ${result.summary.passedSteps}/${result.summary.totalSteps} passed (${result.summary.successRate.toFixed(1)}%)\n\n`;
    
    result.steps.forEach(step => {
      const stepIcon = step.passed ? '✅' : '❌';
      report += `   ${stepIcon} Step ${step.stepNumber}: "${step.userMessage}"\n`;
      report += `      Intent: ${step.intent || 'N/A'}\n`;
      report += `      Response: ${step.agentResponse.substring(0, 100)}${step.agentResponse.length > 100 ? '...' : ''}\n`;
      
      if (step.quickActions && Object.keys(step.quickActions).length > 0) {
        report += `      Quick Actions: ${JSON.stringify(step.quickActions)}\n`;
      }
      
      if (step.kbEntriesRetrieved && step.kbEntriesRetrieved.length > 0) {
        report += `      KB Entries: ${step.kbEntriesRetrieved.join(', ')}\n`;
      }
      
      if (!step.passed && step.failures.length > 0) {
        report += `      Failures:\n`;
        step.failures.forEach(failure => {
          report += `        - ${failure}\n`;
        });
      }
      
      report += '\n';
    });
    
    report += '\n';
  });
  
  return report;
}

async function runTests() {
  console.log('🚀 Starting Test Conversations with Database Saving\n');
  console.log('='.repeat(80));
  
  try {
    console.log('📡 Initializing Firebase...');
    const db = initializeFirebase();
    console.log('📡 Initializing API Gateway...');
    const apiGateway = new TotoAPIGateway(db);
    
    try {
      await apiGateway.initialize();
      console.log('✅ API Gateway initialized\n');
    } catch (error: any) {
      console.error('❌ Failed to initialize API Gateway:', error.message);
      throw error;
    }
    
    const results: ConversationTestResult[] = [];
    
    console.log(`\n📋 Running ${TEST_CONVERSATIONS.length} test conversations...\n`);
    
    for (let i = 0; i < TEST_CONVERSATIONS.length; i++) {
      const testConversation = TEST_CONVERSATIONS[i];
      const testSessionId = `test-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`\n🧪 Testing Conversation ${i + 1}/${TEST_CONVERSATIONS.length}: ${testConversation.flowName}`);
      
      try {
        const result = await runTestConversation(apiGateway, testConversation, testSessionId);
        result.testSessionId = testSessionId;
        
        // Save to database
        try {
          const conversationId = await saveConversationToDB(db, result, testConversation);
          result.conversationId = conversationId;
          console.log(`   ✅ Saved to database: ${conversationId}`);
        } catch (error: any) {
          console.error(`   ❌ Failed to save to database: ${error.message}`);
          result.conversationId = 'SAVE_FAILED';
        }
        
        results.push(result);
      } catch (error: any) {
        console.error(`   ❌ Error testing conversation: ${error.message}`);
        // Create a failed result
        results.push({
          conversationId: 'ERROR',
          flowName: testConversation.flowName,
          testSessionId,
          passed: false,
          steps: [],
          summary: {
            totalSteps: testConversation.messages.length,
            passedSteps: 0,
            failedSteps: testConversation.messages.length,
            successRate: 0
          }
        });
      }
    }
    
    // Generate and print report
    const report = await generateReport(results);
    console.log(report);
    
    // Save report to file
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, `../test-reports/conversation-test-${Date.now()}.txt`);
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Report saved to: ${reportPath}\n`);
    
    const totalPassed = results.filter(r => r.passed).length;
    process.exit(totalPassed === results.length ? 0 : 1);
  } catch (error: any) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

runTests();

