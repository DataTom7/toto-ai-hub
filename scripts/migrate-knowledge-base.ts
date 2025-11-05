/**
 * Migration script to move hardcoded knowledge base entries to Firestore
 * 
 * This script migrates KB entries to the SHARED KB location (toto-bo Firestore)
 * to ensure all environments (staging and production) access the same KB.
 * 
 * Usage:
 *   npx ts-node scripts/migrate-knowledge-base.ts [target-project]
 * 
 * Default target: toto-bo (shared KB location)
 * Options: toto-bo, toto-bo-stg, toto-f9d2f-stg
 */

import * as admin from 'firebase-admin';
import { TotoAPIGateway } from '../src/gateway/TotoAPIGateway';
import * as path from 'path';
import * as fs from 'fs';

// Get target project from command line or use default
const targetProject = process.argv[2] || 'toto-bo';
const COLLECTION = 'knowledge_base';

// Determine which service account file to use based on target project
let serviceAccountPath: string;
let projectId: string;

switch (targetProject) {
  case 'toto-bo':
    // Production toto-bo (shared KB location)
    // Try production service account first, fallback to staging
    const prodPath = path.join(__dirname, '../toto-bo-firebase-adminsdk-fbsvc-138f229598.json');
    const stgPath = path.join(__dirname, '../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');
    if (fs.existsSync(prodPath)) {
      serviceAccountPath = prodPath;
      projectId = 'toto-bo';
      console.log('📚 Migrating to SHARED KB location: toto-bo (production)');
    } else if (fs.existsSync(stgPath)) {
      serviceAccountPath = stgPath;
      projectId = 'toto-bo-stg';
      console.log('📚 Migrating to SHARED KB location: toto-bo-stg (using staging file)');
    } else {
      console.error('❌ No toto-bo service account file found');
      console.error('   Expected: toto-bo-firebase-adminsdk-fbsvc-138f229598.json');
      console.error('   Or: toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');
      process.exit(1);
    }
    break;
  case 'toto-bo-stg':
    serviceAccountPath = path.join(__dirname, '../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');
    projectId = 'toto-bo-stg';
    console.log('📚 Migrating to: toto-bo-stg');
    break;
  case 'toto-f9d2f-stg':
    serviceAccountPath = path.join(__dirname, '../toto-f9d2f-stg-firebase-adminsdk-fbsvc-d4bdd9b852.json');
    projectId = 'toto-f9d2f-stg';
    console.log('📚 Migrating to: toto-f9d2f-stg');
    break;
  default:
    console.error(`❌ Unknown target project: ${targetProject}`);
    console.log('Valid options: toto-bo, toto-bo-stg, toto-f9d2f-stg');
    process.exit(1);
}

// Initialize Firebase Admin
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Service account file not found: ${serviceAccountPath}`);
  console.log('Please ensure the service account JSON file exists for the target project');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: projectId
});

const db = admin.firestore();

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

