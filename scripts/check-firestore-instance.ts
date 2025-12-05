/**
 * Check which Firestore instance is being used
 * 
 * Verifies which Firestore project the scripts are connecting to
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// Check migration script logic
console.log('🔍 Checking Firestore instances...\n');

// Migration script logic
const prodPath = path.join(__dirname, '../toto-bo-firebase-adminsdk-fbsvc-138f229598.json');
const stgPath = path.join(__dirname, '../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');

console.log('📁 Migration script logic:');
console.log(`   Production path: ${prodPath}`);
console.log(`   Exists: ${fs.existsSync(prodPath)}`);
console.log(`   Staging path: ${stgPath}`);
console.log(`   Exists: ${fs.existsSync(stgPath)}`);

if (fs.existsSync(prodPath)) {
  const prod = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
  console.log(`   ✅ Would use: ${prod.project_id} (production)`);
} else if (fs.existsSync(stgPath)) {
  const stg = JSON.parse(fs.readFileSync(stgPath, 'utf8'));
  console.log(`   ✅ Would use: ${stg.project_id} (staging)`);
}

console.log('\n📁 Verification script logic:');
const totoBoKeyPath = process.env.TOTO_BO_SERVICE_ACCOUNT_KEY;
if (totoBoKeyPath) {
  try {
    const serviceAccount = JSON.parse(totoBoKeyPath);
    console.log(`   ✅ Would use: ${serviceAccount.project_id} (from env)`);
  } catch (e) {
    console.log(`   ❌ Invalid env key`);
  }
} else {
  console.log(`   No TOTO_BO_SERVICE_ACCOUNT_KEY in env`);
  if (fs.existsSync(stgPath)) {
    const stg = JSON.parse(fs.readFileSync(stgPath, 'utf8'));
    console.log(`   ✅ Would use: ${stg.project_id} (staging file)`);
  } else if (fs.existsSync(prodPath)) {
    const prod = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
    console.log(`   ✅ Would use: ${prod.project_id} (production file)`);
  }
}

// Initialize and check actual connection
async function checkConnection() {
  console.log('\n🔌 Testing actual connection...');
  let db: admin.firestore.Firestore | null = null;

  if (admin.apps.length === 0) {
    if (totoBoKeyPath) {
      try {
        const serviceAccount = JSON.parse(totoBoKeyPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        }, 'toto-bo');
        db = admin.app('toto-bo').firestore();
        console.log(`   ✅ Connected via env: ${serviceAccount.project_id}`);
      } catch (error) {
        console.log(`   ❌ Failed to connect via env`);
      }
    } else {
      if (fs.existsSync(stgPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(stgPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        db = admin.firestore();
        console.log(`   ✅ Connected via staging file: ${serviceAccount.project_id}`);
      } else if (fs.existsSync(prodPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        db = admin.firestore();
        console.log(`   ✅ Connected via production file: ${serviceAccount.project_id}`);
      }
    }
  } else {
    db = admin.firestore();
    console.log(`   ✅ Using existing connection`);
  }

  if (db) {
    // Get project ID
    const projectId = (db as any).projectId || 'unknown';
    console.log(`\n📊 Actual Firestore project: ${projectId}`);
    
    // Count entries
    const snapshot = await db.collection('knowledge_base').get();
    console.log(`   Total KB entries: ${snapshot.size}`);
    
    // Check for the 3 missing entries
    const missingIds = ['kb-cases-010', 'kb-conversation-001', 'kb-conversation-002'];
    console.log(`\n🔍 Checking for missing entries:`);
    for (const id of missingIds) {
      const doc = await db.collection('knowledge_base').doc(id).get();
      if (doc.exists) {
        console.log(`   ✅ ${id} - EXISTS`);
      } else {
        console.log(`   ❌ ${id} - MISSING`);
      }
    }
  }
}

checkConnection().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

