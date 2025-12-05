/**
 * Add Flow KB Entries to Firestore
 * 
 * Adds the critical flow KB entries that are needed for donation and sharing flows:
 * - kb-flow-help-seeking
 * - kb-flow-donation-intent
 * - kb-flow-donation-amount-selected
 * - kb-flow-sharing-intent
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase
function initializeFirebase() {
  if (admin.apps.length === 0) {
    const prodPath = path.join(__dirname, '../toto-bo-firebase-adminsdk-fbsvc-138f229598.json');
    const stgPath = path.join(__dirname, '../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');
    
    if (fs.existsSync(prodPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'toto-bo'
      });
      console.log('✅ Connected to toto-bo (production) Firestore');
    } else if (fs.existsSync(stgPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(stgPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'toto-bo-stg'
      });
      console.log('✅ Connected to toto-bo-stg (staging) Firestore');
    } else {
      throw new Error('No Firestore credentials found');
    }
  }
  return admin.firestore();
}

const db = initializeFirebase();
const KB_COLLECTION = 'knowledge_base';

// Read flow entries from JSON files
const flowEntriesDir = path.join(__dirname, '../kb-entries-to-review/conversation-flows');

const flowEntries = [
  {
    file: '01-donation-intent.json',
    id: 'kb-flow-donation-intent'
  },
  {
    file: '02-donation-amount-selected.json',
    id: 'kb-flow-donation-amount-selected'
  },
  {
    file: '04-sharing-intent.json',
    id: 'kb-flow-sharing-intent'
  },
  {
    file: '05-help-seeking.json',
    id: 'kb-flow-help-seeking'
  }
];

async function addFlowEntries() {
  try {
    console.log('🔄 Adding flow KB entries to Firestore...\n');

    for (const entry of flowEntries) {
      const filePath = path.join(flowEntriesDir, entry.file);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${entry.file}`);
        continue;
      }

      const entryData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Check if entry already exists
      const existingDoc = await db.collection(KB_COLLECTION).doc(entry.id).get();
      
      if (existingDoc.exists) {
        console.log(`⏭️  Entry ${entry.id} already exists, skipping...`);
        continue;
      }

      // Prepare entry for Firestore
      const firestoreEntry = {
        id: entryData.id,
        title: entryData.title,
        content: entryData.content,
        category: entryData.category || 'conversation_flows',
        agentTypes: entryData.agentTypes || ['CaseAgent'],
        audience: entryData.audience || ['donors'],
        language: entryData.language || 'en',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        usageCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Add to Firestore
      await db.collection(KB_COLLECTION).doc(entry.id).set(firestoreEntry);
      console.log(`✅ Added ${entry.id}: ${entryData.title}`);
    }

    console.log('\n✅ Flow KB entries added successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Total entries processed: ${flowEntries.length}`);
    
    // Verify entries were added
    const verifyPromises = flowEntries.map(e => db.collection(KB_COLLECTION).doc(e.id).get());
    const verifyResults = await Promise.all(verifyPromises);
    const addedCount = verifyResults.filter(r => r.exists).length;
    console.log(`   - Entries in Firestore: ${addedCount}`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error adding flow entries:', error);
    process.exit(1);
  }
}

addFlowEntries();

