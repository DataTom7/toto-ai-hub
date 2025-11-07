/**
 * Script to add new KB entries from markdown files to Firestore
 * Run with: npx ts-node scripts/add-new-kb-entries.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountKey = process.env.TOTO_BO_SERVICE_ACCOUNT_KEY;
if (!serviceAccountKey) {
  throw new Error('TOTO_BO_SERVICE_ACCOUNT_KEY environment variable is required');
}

let app: admin.app.App;
try {
  const serviceAccount = JSON.parse(serviceAccountKey);
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
  process.exit(1);
}

const db = admin.firestore();
const KB_COLLECTION = 'knowledge_base';

interface KBEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  agentTypes: string[];
  audience: string[];
}

/**
 * Parse markdown file to extract KB entry structure
 */
function parseKBEntry(filePath: string): KBEntry | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Extract JSON structure from markdown
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    console.error(`No JSON structure found in ${filePath}`);
    return null;
  }
  
  try {
    const structure = JSON.parse(jsonMatch[1]);
    
    // Extract content (everything after "## Content" heading)
    const contentMatch = content.match(/## Content\s*\n\n([\s\S]*?)(?=\n## |$)/);
    if (!contentMatch) {
      console.error(`No content section found in ${filePath}`);
      return null;
    }
    
    return {
      id: structure.id,
      title: structure.title,
      content: contentMatch[1].trim(),
      category: structure.category,
      agentTypes: structure.agentTypes || [],
      audience: structure.audience || []
    };
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

/**
 * Add KB entry to Firestore
 */
async function addKBEntry(entry: KBEntry): Promise<void> {
  const docRef = db.collection(KB_COLLECTION).doc(entry.id);
  
  // Check if entry already exists
  const existing = await docRef.get();
  if (existing.exists) {
    console.log(`⚠️  Entry ${entry.id} already exists. Skipping...`);
    return;
  }
  
  const firestoreData = {
    title: entry.title,
    content: entry.content,
    category: entry.category,
    agentTypes: entry.agentTypes,
    audience: entry.audience,
    lastUpdated: new Date().toISOString(),
    usageCount: 0,
    createdAt: new Date().toISOString()
  };
  
  await docRef.set(firestoreData);
  console.log(`✅ Added KB entry: ${entry.id} - ${entry.title}`);
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Adding new KB entries to Firestore...\n');
  
  const kbFiles = [
    'KB_ENTRY_SHARING_PROCESS.md',
    'KB_ENTRY_DONATION_VERIFICATION.md',
    'KB_ENTRY_TRF_DONATION.md',
    'KB_ENTRY_ADOPTION_PROCESS.md'
  ];
  
  const entries: KBEntry[] = [];
  
  // Parse all markdown files
  for (const file of kbFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      continue;
    }
    
    const entry = parseKBEntry(filePath);
    if (entry) {
      entries.push(entry);
    }
  }
  
  if (entries.length === 0) {
    console.error('❌ No valid KB entries found');
    process.exit(1);
  }
  
  console.log(`📚 Found ${entries.length} KB entries to add\n`);
  
  // Add entries to Firestore
  for (const entry of entries) {
    try {
      await addKBEntry(entry);
    } catch (error) {
      console.error(`❌ Error adding ${entry.id}:`, error);
    }
  }
  
  console.log(`\n✅ Completed! Added ${entries.length} KB entries.`);
  console.log('\n💡 Next steps:');
  console.log('   1. Restart the toto-ai-hub server to load new entries');
  console.log('   2. Run test conversations to verify entries are being used');
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

