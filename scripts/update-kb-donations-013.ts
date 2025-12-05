/**
 * Update KB Entry: kb-donations-013
 * 
 * Fixes:
 * 1. Better language for alias button: "podrás copiar el alias en el botón que verás a continuación"
 * 2. Clear rule: DO NOT mention TRF when alias is available
 * 3. Only mention TRF when alias is missing or user asks for alternatives
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

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
const ENTRY_ID = 'kb-donations-013';

const updatedContent = `AGENT RESPONSIBILITY
- The agent should retrieve the alias from the guardian's Firestore document (caseData.guardianId -> guardian document -> bankingAlias field)
- NEVER tell users to "find it in a profile" or "look in a section" - these don't exist in toto-app

CRITICAL: WHEN TO PROVIDE THE ALIAS
- DO NOT provide the alias immediately when donation intent is expressed
- ONLY provide the alias AFTER the user has selected or mentioned a donation amount
- Follow this strict order:
  1. User shows donation intent → Ask for amount (do NOT provide alias yet)
  2. User selects/mentions amount → THEN provide the alias
- This ensures users commit to an amount before receiving payment details

ALIAS FORMAT
- Banking aliases follow Argentina's national banking alias system
- Each guardian has one unique alias for all their cases
- When presenting the alias (AFTER amount is selected), use this language structure (translate to user's language):
  * "You can make your donation through the banking alias. You will be able to copy the alias in the button you'll see below."
- DO NOT mention "quick action buttons" - use "the button you'll see below" instead (translate appropriately)
- Provide basic transfer instructions: "You can make a standard transfer from your bank or wallet using this alias" (translate to user's language)
- CRITICAL: NEVER include the actual alias value in your text response - it's provided via quick action button only

CRITICAL: WHEN TO MENTION TRF
- DO NOT mention TRF (Toto Rescue Fund) when the guardian alias IS available
- ONLY mention TRF in these two scenarios:
  1. When the guardian alias is NOT available (missing from Firestore)
  2. When the user explicitly asks about alternative donation methods (e.g., "are there other ways to donate?", "can I donate another way?")
- If alias is available, focus ONLY on the alias - do NOT mention TRF as an alternative
- The response structure should be (translate to user's language): "You can make your donation through the banking alias. You will be able to copy the alias in the button you'll see below."
- DO NOT add "If you prefer, you can also donate through the Toto Rescue Fund (TRF)" when alias is available

IF ALIAS NOT FOUND
- If the guardian document doesn't have a bankingAlias field, inform the user (translate to user's language)
- Offer alternative: suggest donating to Toto Rescue Fund (TRF) which can be allocated to urgent cases
- Escalate: inform the user that the guardian needs to complete their banking alias setup
- Do NOT make up or guess an alias`;

async function updateKBEntry() {
  try {
    console.log(`🔄 Updating KB entry: ${ENTRY_ID}...`);
    
    const docRef = db.collection(KB_COLLECTION).doc(ENTRY_ID);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.error(`❌ KB entry ${ENTRY_ID} not found in Firestore!`);
      console.log('💡 This entry might need to be created first.');
      process.exit(1);
    }
    
    const currentData = doc.data();
    console.log(`📝 Current title: ${currentData?.title}`);
    console.log(`📝 Current content length: ${currentData?.content?.length || 0} characters`);
    
    await docRef.update({
      content: updatedContent,
      lastUpdated: new Date().toISOString()
    });
    
    console.log(`✅ Successfully updated KB entry: ${ENTRY_ID}`);
    console.log(`📝 New content length: ${updatedContent.length} characters`);
    
  } catch (error) {
    console.error('❌ Error updating KB entry:', error);
    process.exit(1);
  }
}

// Run update
updateKBEntry().then(() => {
  console.log('✨ Update complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

