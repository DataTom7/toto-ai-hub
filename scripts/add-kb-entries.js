/**
 * Script to add new KB entries to Firestore via API
 * Run with: node scripts/add-kb-entries.js
 * 
 * Requires: TOTO_AI_HUB_URL environment variable (defaults to http://localhost:8080)
 */

const fs = require('fs');
const path = require('path');

const AI_HUB_URL = process.env.TOTO_AI_HUB_URL || 'http://localhost:8080';

// KB entries to add
const KB_ENTRIES = [
  {
    id: 'kb-sharing-process-001',
    title: 'How to Share Cases on Social Media',
    file: 'KB_ENTRY_SHARING_PROCESS.md',
    category: 'social-media',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },
  {
    id: 'kb-donation-verification-001',
    title: 'How to Verify Donations',
    file: 'KB_ENTRY_DONATION_VERIFICATION.md',
    category: 'donations',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },
  {
    id: 'kb-trf-donation-001',
    title: 'TRF (Toto Rescue Fund) - How to Donate',
    file: 'KB_ENTRY_TRF_DONATION.md',
    category: 'donations',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  },
  {
    id: 'kb-adoption-process-001',
    title: 'Adoption Process - How It Works',
    file: 'KB_ENTRY_ADOPTION_PROCESS.md',
    category: 'case-management',
    agentTypes: ['CaseAgent'],
    audience: ['donors']
  }
];

/**
 * Extract content from markdown file
 */
function extractContent(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Extract content section (everything after "## Content")
  // Try multiple patterns to handle different markdown formats
  let contentMatch = content.match(/## Content\s*\n\n([\s\S]*?)(?=\n## |$)/);
  
  // If that doesn't work, try without double newline
  if (!contentMatch) {
    contentMatch = content.match(/## Content\s*\n([\s\S]*?)(?=\n## |$)/);
  }
  
  // If still not found, get everything after the first "## Content" line
  if (!contentMatch) {
    const contentIndex = content.indexOf('## Content');
    if (contentIndex !== -1) {
      const afterContent = content.substring(contentIndex);
      contentMatch = afterContent.match(/## Content\s*\n+([\s\S]*)/);
    }
  }
  
  if (!contentMatch) {
    // Fallback: get everything after the JSON structure block
    const jsonEnd = content.indexOf('```', content.indexOf('```json') + 7);
    if (jsonEnd !== -1) {
      const afterJson = content.substring(jsonEnd + 3).trim();
      // Remove any remaining headers and get the actual content
      const contentStart = afterJson.indexOf('## Content');
      if (contentStart !== -1) {
        const actualContent = afterJson.substring(contentStart);
        contentMatch = actualContent.match(/## Content\s*\n+([\s\S]*)/);
      }
    }
  }
  
  if (!contentMatch) {
    throw new Error(`No content section found in ${filePath}. File length: ${content.length}`);
  }
  
  return contentMatch[1].trim();
}

/**
 * Add KB entry via API
 */
async function addKBEntry(entry) {
  const filePath = path.join(__dirname, '..', entry.file);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const content = extractContent(filePath);
  
  const response = await fetch(`${AI_HUB_URL}/api/ai/knowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: entry.title,
      content: content,
      category: entry.category,
      agentTypes: entry.agentTypes,
      audience: entry.audience
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API error: ${error.error || response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Adding new KB entries to Firestore...\n');
  console.log(`📡 Using AI Hub URL: ${AI_HUB_URL}\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const entry of KB_ENTRIES) {
    try {
      console.log(`📝 Adding: ${entry.title}...`);
      const result = await addKBEntry(entry);
      console.log(`✅ Added: ${result.id} - ${result.title}\n`);
      successCount++;
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log(`⚠️  Entry already exists: ${entry.id} - ${entry.title}\n`);
      } else {
        console.error(`❌ Error adding ${entry.id}:`, error.message);
        console.error(`   File: ${entry.file}\n`);
        errorCount++;
      }
    }
  }
  
  console.log('========================================');
  console.log(`✅ Successfully added: ${successCount} entries`);
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount} entries`);
  }
  console.log('========================================\n');
  
  console.log('💡 Next steps:');
  console.log('   1. Restart the toto-ai-hub server to load new entries');
  console.log('   2. Run test conversations: .\\test-conversations-v2.ps1');
  console.log('   3. Optionally sync to Vertex AI Search: npm run sync-kb-to-vertex');
}

// Run script
main()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

