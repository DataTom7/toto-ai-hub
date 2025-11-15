/**
 * Quick script to check if Nina's guardian has a banking alias
 * Run: node check-nina-alias.js
 */

require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK (same as server.js)
let serviceAccount = null;

// Try environment variable first (for production)
const serviceAccountJson = process.env.TOTO_APP_STG_SERVICE_ACCOUNT_KEY;
if (serviceAccountJson) {
  serviceAccount = JSON.parse(serviceAccountJson);
  console.log('✅ Using toto-app-stg service account from environment variable');
} else {
  // Try local file (for development)
  const serviceAccountPath = path.join(__dirname, 'toto-f9d2f-stg-firebase-adminsdk-fbsvc-d4bdd9b852.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf8');
    serviceAccount = JSON.parse(serviceAccountFile);
    console.log('✅ Using local toto-app-stg service account file');
  }
}

if (!serviceAccount) {
  console.error('❌ No service account credentials found. Please set TOTO_APP_STG_SERVICE_ACCOUNT_KEY or place the service account file in the project root.');
  process.exit(1);
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'toto-f9d2f-stg'
  });
}

const db = admin.firestore();

async function checkNinaAlias() {
  try {
    console.log('🔍 Searching for Nina case...\n');
    
    // Search for Nina case
    const casesSnapshot = await db.collection('cases')
      .where('name', '==', 'Nina')
      .limit(1)
      .get();
    
    if (casesSnapshot.empty) {
      console.log('❌ No case found with name "Nina"');
      return;
    }
    
    const caseDoc = casesSnapshot.docs[0];
    const caseData = caseDoc.data();
    
    console.log(`✅ Found case: ${caseData.name}`);
    console.log(`   Case ID: ${caseDoc.id}`);
    console.log(`   Guardian ID: ${caseData.guardianId || 'N/A'}`);
    console.log(`   Guardian Name: ${caseData.guardianName || 'N/A'}\n`);
    
    if (!caseData.guardianId) {
      console.log('❌ No guardian ID found for this case');
      return;
    }
    
    // Fetch guardian document
    console.log('🔍 Fetching guardian information...\n');
    const guardianDoc = await db.collection('users').doc(caseData.guardianId).get();
    
    if (!guardianDoc.exists) {
      console.log('❌ Guardian document not found');
      return;
    }
    
    const guardianData = guardianDoc.data();
    
    // Check for banking alias
    const alias = guardianData?.bankingAccountAlias || 
      (guardianData?.bankingAccountAliases && guardianData.bankingAccountAliases.length > 0 
        ? guardianData.bankingAccountAliases[0] 
        : undefined);
    
    console.log('📋 Guardian Information:');
    console.log(`   Name: ${guardianData.displayName || guardianData.name || 'N/A'}`);
    console.log(`   Email: ${guardianData.email || 'N/A'}`);
    console.log(`   Banking Alias: ${alias || '❌ NOT SET'}`);
    
    if (guardianData.bankingAccountAliases && guardianData.bankingAccountAliases.length > 0) {
      console.log(`   All Aliases: ${guardianData.bankingAccountAliases.join(', ')}`);
    }
    
    if (!alias) {
      console.log('\n⚠️  Guardian does not have a banking alias configured');
    } else {
      console.log(`\n✅ Guardian has banking alias: ${alias}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkNinaAlias();

