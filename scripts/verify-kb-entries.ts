/**
 * Verify KB Entries Exist in Firestore
 * 
 * Checks if all hardcoded KB entries exist in Firestore before removal
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { TotoAPIGateway } from '../src/gateway/TotoAPIGateway';

dotenv.config();

// Initialize Firebase - Use same logic as migration script
const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    // Use same priority as migration script: production first, then staging
    const prodPath = path.join(__dirname, '../toto-bo-firebase-adminsdk-fbsvc-138f229598.json');
    const stgPath = path.join(__dirname, '../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');
    
    if (fs.existsSync(prodPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'toto-bo'
      });
      console.log(`✅ Using production service account: ${path.basename(prodPath)}`);
      return admin.firestore();
    } else if (fs.existsSync(stgPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(stgPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'toto-bo-stg'
      });
      console.log(`✅ Using staging service account: ${path.basename(stgPath)}`);
      return admin.firestore();
    } else {
      throw new Error('No Firebase credentials found');
    }
  }
  return admin.firestore();
};

const db = initializeFirebase();
const KB_COLLECTION = 'knowledge_base';

async function verifyKBEntries() {
  try {
    console.log('🔍 Verifying KB entries in Firestore...\n');
    
    // Get hardcoded entries
    const apiGateway = new TotoAPIGateway();
    const hardcodedEntries = apiGateway.getHardcodedKnowledgeBase();
    
    console.log(`📚 Found ${hardcodedEntries.length} hardcoded entries\n`);
    
    // Get all Firestore entries
    const snapshot = await db.collection(KB_COLLECTION).get();
    const firestoreIds = new Set(snapshot.docs.map(doc => doc.id));
    
    console.log(`📊 Found ${firestoreIds.size} entries in Firestore\n`);
    
    const missing: string[] = [];
    const found: string[] = [];
    
    for (const entry of hardcodedEntries) {
      if (firestoreIds.has(entry.id)) {
        found.push(entry.id);
        console.log(`✅ ${entry.id} - ${entry.title}`);
      } else {
        missing.push(entry.id);
        console.log(`❌ ${entry.id} - ${entry.title} - MISSING!`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Found: ${found.length}`);
    console.log(`   ❌ Missing: ${missing.length}`);
    
    if (missing.length > 0) {
      console.log(`\n⚠️  Missing entries:`);
      missing.forEach(id => console.log(`   - ${id}`));
      console.log(`\n💡 Run: npm run migrate-knowledge-base`);
      process.exit(1);
    } else {
      console.log(`\n✅ All entries verified! Safe to remove hardcoded entries.`);
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Error verifying KB entries:', error);
    process.exit(1);
  }
}

verifyKBEntries();

