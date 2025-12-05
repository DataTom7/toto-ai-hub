/**
 * Update KB Entries in Firestore from Hardcoded Entries
 * 
 * This script updates specific KB entries in Firestore with the latest
 * content from the hardcoded entries in TotoAPIGateway.ts
 * 
 * Run: npm run update-kb-from-hardcoded
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { TotoAPIGateway } from '../src/gateway/TotoAPIGateway';

dotenv.config();

// Initialize Firebase
const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    const totoBoKeyPath = process.env.TOTO_BO_SERVICE_ACCOUNT_KEY;

    if (totoBoKeyPath) {
      try {
        const serviceAccount = JSON.parse(totoBoKeyPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        }, 'toto-bo');
        return admin.app('toto-bo').firestore();
      } catch (error) {
        console.error('❌ Failed to initialize with toto-bo credentials');
        throw error;
      }
    } else {
      const localPaths = [
        path.join(__dirname, '../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json'),
        path.join(__dirname, '../toto-bo-firebase-adminsdk-fbsvc-138f229598.json')
      ];

      for (const localPath of localPaths) {
        if (fs.existsSync(localPath)) {
          const serviceAccount = JSON.parse(fs.readFileSync(localPath, 'utf8'));
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
          console.log(`✅ Using local service account: ${path.basename(localPath)}`);
          return admin.firestore();
        }
      }

      throw new Error('No Firebase credentials found');
    }
  }
  return admin.firestore();
};

const db = initializeFirebase();
const KB_COLLECTION = 'knowledge_base';

// List of KB entry IDs to update (the ones we've been modifying)
const ENTRIES_TO_UPDATE = [
  'kb-donations-013',  // Banking Alias Provision
  'kb-cases-007',      // Agent Conversation Behavior
  'kb-cases-010',      // Ways to Help
];

async function updateKBEntries() {
  try {
    console.log('🔄 Updating KB entries from hardcoded entries...\n');
    
    // Get hardcoded entries from TotoAPIGateway
    const apiGateway = new TotoAPIGateway();
    const hardcodedEntries = apiGateway.getHardcodedKnowledgeBase();
    
    console.log(`📚 Found ${hardcodedEntries.length} hardcoded entries\n`);
    
    let updated = 0;
    let notFound = 0;
    let skipped = 0;
    
    for (const entryId of ENTRIES_TO_UPDATE) {
      const hardcodedEntry = hardcodedEntries.find(e => e.id === entryId);
      
      if (!hardcodedEntry) {
        console.log(`⚠️  Entry ${entryId} not found in hardcoded entries - skipping`);
        skipped++;
        continue;
      }
      
      const docRef = db.collection(KB_COLLECTION).doc(entryId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        console.log(`⚠️  Entry ${entryId} not found in Firestore - creating new entry`);
        await docRef.set({
          ...hardcodedEntry,
          createdAt: new Date().toISOString()
        });
        console.log(`✅ Created new KB entry: ${entryId}`);
        updated++;
      } else {
        const currentData = doc.data();
        console.log(`📝 Updating KB entry: ${entryId}`);
        console.log(`   Current title: ${currentData?.title}`);
        
        await docRef.update({
          title: hardcodedEntry.title,
          content: hardcodedEntry.content,
          category: hardcodedEntry.category,
          agentTypes: hardcodedEntry.agentTypes,
          audience: hardcodedEntry.audience,
          lastUpdated: new Date().toISOString()
          // Preserve usageCount and createdAt
        });
        
        console.log(`✅ Updated KB entry: ${entryId}`);
        updated++;
      }
    }
    
    console.log(`\n✨ Update complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Not found in hardcoded: ${notFound}`);
    
  } catch (error) {
    console.error('❌ Error updating KB entries:', error);
    process.exit(1);
  }
}

// Run update
updateKBEntries().then(() => {
  console.log('\n✅ All done!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

