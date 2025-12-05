// Clear all cached embeddings from Firestore KB entries
// Run this once to force regeneration with Vertex AI embeddings

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load service account
const serviceAccountPath = path.join(__dirname, 'toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'toto-bo-stg'
});

const db = admin.firestore();

async function clearEmbeddings() {
  console.log('🔄 Clearing cached embeddings from Firestore...');

  const snapshot = await db.collection('knowledge_base').get();
  console.log(`📊 Found ${snapshot.size} KB entries`);

  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    batch.update(doc.ref, { embedding: admin.firestore.FieldValue.delete() });
    count++;
  });

  await batch.commit();
  console.log(`✅ Cleared ${count} embeddings`);
  console.log('🚀 Restart server to regenerate with Vertex AI embeddings');
  process.exit(0);
}

clearEmbeddings().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
