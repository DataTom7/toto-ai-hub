/**
 * Update KB Entry: kb-flow-donation-intent
 * 
 * This entry defines the exact donation flow:
 * 1. User: "Quiero donar" / "I want to donate"
 * 2. Agent: Ask for amount (NO alias, NO TRF mention)
 * 3. User: "$1000" / amount selected
 * 4. Agent: Provide alias + ask about totitos
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase (same pattern as update-kb-donations-013.ts)
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

const ENTRY_ID = 'kb-flow-donation-intent';

const updatedContent = `WHEN USER SHOWS DONATION INTENT (WITHOUT AMOUNT)
User says: "quiero donar", "donate", "donar", "I want to donate", "me gustaría donar", etc.

🚨 CRITICAL: User wants to donate but HASN'T chosen an amount yet

RESPONSE STRUCTURE (STRICT - FOLLOW EXACTLY):
1. ACKNOWLEDGE INTENT (1 sentence)
   - Express that it's wonderful they want to help
   - Example (translate to user's language): "¡Qué bueno que quieras ayudar!" or "That's wonderful that you want to help!"

2. CLARIFY NO MINIMUM (1 sentence)
   - There's no minimum amount, every donation helps
   - Example (translate to user's language): "No hay un monto mínimo, cada ayuda cuenta." or "There's no minimum amount - every donation helps!"

3. ASK ABOUT AMOUNT (1 sentence)
   - Ask how much they'd like to donate
   - Example (translate to user's language): "¿Cuánto te gustaría donar?" or "How much would you like to donate?"
   - Quick action amount buttons will appear automatically

4. STOP - NO MORE TEXT
   - Amount buttons will guide the user
   - WAIT for user to select amount

CORRECT RESPONSE LENGTH: EXACTLY 3 sentences (acknowledge + no minimum + ask amount)

EXAMPLE GOOD RESPONSE (Spanish):
"¡Qué bueno que quieras ayudar! No hay un monto mínimo, cada ayuda cuenta. ¿Cuánto te gustaría donar?"

EXAMPLE GOOD RESPONSE (English):
"That's wonderful that you want to help! There's no minimum amount - every donation helps! How much would you like to donate?"

🚫 ABSOLUTELY FORBIDDEN - DO NOT DO THIS:
❌ Mention banking alias, transfer process, or payment methods
❌ Say "lo verás en el botón" or reference buttons in your text
❌ Mention TRF (Toto Rescue Fund) or alternative donation methods
❌ Explain what happens after amount selection
❌ Provide donation instructions or next steps
❌ More than 3 sentences
❌ Use bullet points, lists, or markdown formatting
❌ Repeat case information (name, location, medical condition)

CRITICAL RULES:
- EXACTLY 3 sentences: acknowledge + no minimum + ask amount
- ONLY ask for amount - nothing else
- DO NOT mention: alias, buttons, TRF, transfer process, next steps
- NEVER include actual banking alias value
- Quick action buttons will show amounts automatically
- Keep it conversational and pressure-free
- Trust the UI to show amount options
- Translate all examples to user's language`;

async function updateKBEntry() {
  try {
    console.log(`🔄 Updating KB entry: ${ENTRY_ID}...`);
    
    const docRef = db.collection(KB_COLLECTION).doc(ENTRY_ID);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log(`📝 Entry ${ENTRY_ID} not found - creating new entry...`);
      await docRef.set({
        id: ENTRY_ID,
        title: 'Donation Intent Response Flow',
        content: updatedContent,
        category: 'conversation_flows',
        agentTypes: ['CaseAgent'],
        audience: ['donors'],
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        usageCount: 0
      });
      console.log(`✅ Created new KB entry: ${ENTRY_ID}`);
    } else {
      const currentData = doc.data();
      console.log(`📝 Current title: ${currentData?.title}`);
      console.log(`📝 Current content length: ${currentData?.content?.length || 0} characters`);
      
      await docRef.update({
        title: 'Donation Intent Response Flow',
        content: updatedContent,
        lastUpdated: new Date().toISOString()
      });
      
      console.log(`✅ Successfully updated KB entry: ${ENTRY_ID}`);
      console.log(`📝 New content length: ${updatedContent.length} characters`);
    }
    
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

