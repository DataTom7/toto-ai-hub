/**
 * Migration script to move hardcoded knowledge base entries to Firestore
 * Run this once to seed the Firestore collection with all existing KB entries
 */

import * as admin from 'firebase-admin';
import { TotoAPIGateway } from '../src/gateway/TotoAPIGateway';

// Initialize Firebase Admin
const serviceAccount = require('../toto-f9d2f-stg-firebase-adminsdk-fbsvc-d4bdd9b852.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'toto-f9d2f-stg'
});

const db = admin.firestore();
const COLLECTION = 'knowledge_base';

async function migrateKnowledgeBase() {
  console.log('🔄 Starting Knowledge Base migration...\n');

  try {
    // Get all hardcoded entries from TotoAPIGateway
    const apiGateway = new TotoAPIGateway();
    const hardcodedEntries = apiGateway.getHardcodedKnowledgeBase();

    console.log(`📚 Found ${hardcodedEntries.length} hardcoded entries\n`);

    // Check existing entries in Firestore
    const existingSnapshot = await db.collection(COLLECTION).get();
    const existingIds = new Set(existingSnapshot.docs.map(doc => doc.id));
    
    console.log(`📊 Existing entries in Firestore: ${existingIds.size}\n`);

    let added = 0;
    let updated = 0;
    let skipped = 0;

    const batch = db.batch();

    for (const entry of hardcodedEntries) {
      const docRef = db.collection(COLLECTION).doc(entry.id);

      if (existingIds.has(entry.id)) {
        // Update existing entry (preserve usageCount if it exists)
        const existingDoc = await docRef.get();
        const existingData = existingDoc.data();
        
        batch.update(docRef, {
          title: entry.title,
          content: entry.content,
          category: entry.category,
          agentTypes: entry.agentTypes,
          audience: entry.audience || [],
          lastUpdated: new Date().toISOString(),
          // Preserve usageCount from existing entry
          usageCount: existingData?.usageCount || 0
        });
        updated++;
        console.log(`✏️  Updating: ${entry.id} - ${entry.title}`);
      } else {
        // Add new entry
        batch.set(docRef, {
          title: entry.title,
          content: entry.content,
          category: entry.category,
          agentTypes: entry.agentTypes,
          audience: entry.audience || [],
          lastUpdated: new Date().toISOString(),
          usageCount: 0,
          createdAt: new Date().toISOString()
        });
        added++;
        console.log(`➕ Adding: ${entry.id} - ${entry.title}`);
      }
    }

    // Commit batch
    await batch.commit();

    console.log(`\n✅ Migration completed!`);
    console.log(`   - Added: ${added}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log(`\n📊 Total entries in Firestore: ${existingIds.size + added}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
migrateKnowledgeBase();

