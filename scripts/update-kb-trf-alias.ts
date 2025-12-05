/**
 * Update KB entries with correct TRF alias: toto.fondo.rescate
 * 
 * This script updates all KB entries that mention TRF to use the correct alias.
 * Replaces any incorrect references (betoto.pet, placeholders, etc.) with toto.fondo.rescate
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

const TRF_ALIAS = 'toto.fondo.rescate';

const initializeFirebase = (): admin.firestore.Firestore => {
  // Check if Firebase Admin is already initialized
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  // Try to initialize with service account key from environment variable first
  if (process.env.TOTO_BO_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.TOTO_BO_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      console.log('✅ Firebase Admin SDK initialized from TOTO_BO_SERVICE_ACCOUNT_KEY');
      return admin.firestore();
    } catch (error) {
      console.warn('⚠️ Failed to parse TOTO_BO_SERVICE_ACCOUNT_KEY, trying local files...');
    }
  }

  // Fallback to local service account files
  const fs = require('fs');
  const path = require('path');

  // Try staging first, then production
  const stagingPath = path.join(__dirname, '..', 'toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');
  const productionPath = path.join(__dirname, '..', 'toto-bo-firebase-adminsdk-fbsvc-138f229598.json');

  if (fs.existsSync(stagingPath)) {
    const serviceAccount = require(stagingPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    console.log('✅ Firebase Admin SDK initialized from staging service account');
    return admin.firestore();
  } else if (fs.existsSync(productionPath)) {
    const serviceAccount = require(productionPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    console.log('✅ Firebase Admin SDK initialized from production service account');
    return admin.firestore();
  } else {
    throw new Error('No Firebase service account credentials found');
  }
};

const db = initializeFirebase();
const KB_COLLECTION = 'knowledge_base';

// KB entries that mention TRF and need alias updates
const TRF_ENTRIES = [
  'kb-donations-013', // Banking Alias Provision
  'kb-donations-014', // Missing Alias Scenarios and Alternative Donation Methods
  'kb-1762552824068', // TRF (Toto Rescue Fund) - How to Donate (if exists)
];

async function updateTRFAlias() {
  try {
    console.log(`\n🔄 Updating TRF alias to: ${TRF_ALIAS}\n`);

    for (const entryId of TRF_ENTRIES) {
      const docRef = db.collection(KB_COLLECTION).doc(entryId);
      const doc = await docRef.get();

      if (!doc.exists) {
        console.log(`⚠️  Entry ${entryId} not found, skipping...`);
        continue;
      }

      const data = doc.data();
      let content = data?.content || '';
      let updated = false;

      // Replace incorrect aliases and placeholders
      const replacements = [
        { from: /betoto\.pet/gi, to: TRF_ALIAS },
        { from: /\[TRF_ALIAS_PLACEHOLDER\]/gi, to: TRF_ALIAS },
        { from: /TRF.*alias.*betoto/gi, to: `TRF alias is ${TRF_ALIAS}` },
        { from: /alias.*betoto\.pet/gi, to: `alias ${TRF_ALIAS}` },
      ];

      // Also check for mentions of TRF without specifying alias
      // Add alias specification if missing
      if (content.includes('TRF') || content.includes('Toto Rescue Fund') || content.includes('Fondo de Rescate')) {
        // Check if alias is already mentioned
        const hasAlias = content.includes(TRF_ALIAS) || 
                        content.includes('betoto.pet') ||
                        content.includes('[TRF_ALIAS_PLACEHOLDER]') ||
                        /alias.*toto\.fondo\.rescate/gi.test(content);

        if (!hasAlias) {
          // Add alias specification in key locations
          // After "How to Donate to TRF" or similar sections
          if (/how\s+to\s+donate\s+to\s+trf/gi.test(content) || 
              /cómo\s+donar\s+al\s+trf/gi.test(content) ||
              /trf\s+banking\s+alias/gi.test(content)) {
            // Add alias after the section header
            content = content.replace(
              /(TRF\s+Banking\s+Alias|TRF\s+banking\s+alias|alias\s+del\s+TRF)[:]*/gi,
              `$& ${TRF_ALIAS}`
            );
            updated = true;
          } else {
            // Add a note about the alias
            const aliasNote = `\n\n**TRF Banking Alias:** ${TRF_ALIAS}`;
            // Insert after first mention of TRF definition
            const trfDefinitionMatch = content.match(/(TRF\s+stands\s+for|TRF\s+es|TRF\s+\(Toto\s+Rescue\s+Fund\))/i);
            if (trfDefinitionMatch) {
              const insertIndex = content.indexOf(trfDefinitionMatch[0]) + trfDefinitionMatch[0].length;
              content = content.slice(0, insertIndex) + aliasNote + content.slice(insertIndex);
              updated = true;
            }
          }
        }
      }

      // Apply replacements
      for (const replacement of replacements) {
        if (replacement.from.test(content)) {
          content = content.replace(replacement.from, replacement.to);
          updated = true;
        }
      }

      if (updated) {
        await docRef.update({
          content,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`✅ Updated ${entryId}`);
      } else {
        console.log(`ℹ️  ${entryId} already has correct alias or no changes needed`);
      }
    }

    // Also check for any other entries that might mention TRF
    console.log(`\n🔍 Checking for other entries mentioning TRF...\n`);
    const allEntries = await db.collection(KB_COLLECTION)
      .where('category', 'in', ['donations', 'product_features'])
      .get();

    let otherUpdated = 0;
    for (const doc of allEntries.docs) {
      const entryId = doc.id;
      if (TRF_ENTRIES.includes(entryId)) {
        continue; // Already processed
      }

      const data = doc.data();
      let content = data?.content || '';
      
      // Check if mentions TRF but has wrong alias
      if ((content.includes('TRF') || content.includes('Toto Rescue Fund')) && 
          (content.includes('betoto.pet') || content.includes('[TRF_ALIAS_PLACEHOLDER]'))) {
        content = content.replace(/betoto\.pet/gi, TRF_ALIAS);
        content = content.replace(/\[TRF_ALIAS_PLACEHOLDER\]/gi, TRF_ALIAS);
        
        await doc.ref.update({
          content,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`✅ Updated ${entryId} (found TRF mention)`);
        otherUpdated++;
      }
    }

    console.log(`\n✅ Update complete!`);
    console.log(`   - Updated ${TRF_ENTRIES.length} primary entries`);
    console.log(`   - Updated ${otherUpdated} additional entries`);
    console.log(`   - TRF alias set to: ${TRF_ALIAS}\n`);

  } catch (error) {
    console.error('❌ Error updating TRF alias:', error);
    process.exit(1);
  }
}

// Run the update
updateTRFAlias()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

