/**
 * Migration script to convert suggestedActions to messages format
 *
 * Run with: node migrate-to-messages-format.js
 */

const fs = require('fs');
const path = require('path');

const categories = ['share', 'help', 'information', 'edge-cases'];

function migrateConversation(conv) {
  // If already using messages format, skip
  if (conv.expectedResponse.messages) {
    console.log(`  ✓ Already using messages format: ${conv.id}`);
    return conv;
  }

  // Extract the last agent message from conversation
  const lastAgentMessage = conv.conversation
    .filter(msg => msg.role === 'agent')
    .pop()?.message || '';

  // Convert suggestedActions to quickActions
  const suggestedActions = conv.expectedResponse.suggestedActions || [];

  let quickActions = {};

  // Determine quick action type based on intent and actions
  if (conv.metadata.intent === 'share') {
    quickActions.showShareActions = true;
    quickActions.shareButtons = suggestedActions.map(action => ({
      platform: action.data?.platform || 'unknown',
      label: action.label
    }));
  } else if (conv.metadata.intent === 'help') {
    quickActions.showHelpActions = true;
    quickActions.helpButtons = suggestedActions.map(action => ({
      type: action.type,
      label: action.label
    }));
  } else if (conv.metadata.intent === 'donation') {
    // Check if asking for amount
    if (lastAgentMessage.includes('monto') || lastAgentMessage.includes('amount')) {
      quickActions.showAmountOptions = true;
      quickActions.amountOptions = suggestedActions.map(action => ({
        label: action.label,
        amount: action.data?.amount ?? null
      }));
    }
  } else if (conv.metadata.intent === 'information') {
    // Information intent usually has help buttons
    quickActions.showHelpActions = true;
    quickActions.helpButtons = suggestedActions.map(action => ({
      type: action.type,
      label: action.label
    }));
  }

  // Create new messages format
  const newExpectedResponse = {
    intent: conv.expectedResponse.intent,
    confidence: conv.expectedResponse.confidence,
    messages: [
      {
        message: lastAgentMessage,
        quickActions: Object.keys(quickActions).length > 0 ? quickActions : undefined,
        shouldIncludeKB: conv.expectedResponse.shouldIncludeKB,
      }
    ],
    shouldIncludeKB: conv.expectedResponse.shouldIncludeKB,
  };

  // Remove undefined fields
  if (!newExpectedResponse.messages[0].quickActions) {
    delete newExpectedResponse.messages[0].quickActions;
  }
  if (!newExpectedResponse.messages[0].shouldIncludeKB) {
    delete newExpectedResponse.messages[0].shouldIncludeKB;
  }

  return {
    ...conv,
    expectedResponse: newExpectedResponse
  };
}

function migrateCategory(category) {
  const categoryDir = path.join(__dirname, category);

  if (!fs.existsSync(categoryDir)) {
    console.log(`Category not found: ${category}`);
    return;
  }

  const files = fs.readdirSync(categoryDir).filter(f => f.endsWith('.json'));

  console.log(`\nMigrating ${category}/ (${files.length} files)...`);

  let migrated = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(categoryDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const conversation = JSON.parse(content);

    const original = JSON.stringify(conversation);
    const updated = migrateConversation(conversation);

    if (JSON.stringify(updated) !== original) {
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
      console.log(`  ✓ Migrated: ${file}`);
      migrated++;
    } else {
      skipped++;
    }
  }

  console.log(`  Summary: ${migrated} migrated, ${skipped} skipped`);
}

// Run migration
console.log('=== Golden Conversation Format Migration ===');
console.log('Converting suggestedActions to messages format...\n');

for (const category of categories) {
  migrateCategory(category);
}

console.log('\n=== Migration Complete ===');
console.log('All conversations now use the messages format.');
