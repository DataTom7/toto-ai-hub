/**
 * Knowledge Base to Vertex AI Search Sync Script
 * 
 * Syncs user-facing Knowledge Base entries from Firestore to Vertex AI Search
 * This is the RECOMMENDED approach - KB is already user-facing and structured
 * 
 * Usage:
 *   npm run sync-kb-to-vertex
 */

import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { VertexAISearchService, SearchableDocument } from '../src/services/VertexAISearchService';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
const projectId = process.env.TOTO_BO_PROJECT_ID || 'toto-bo';
const serviceAccountKey = process.env.TOTO_BO_SERVICE_ACCOUNT_KEY;

if (!serviceAccountKey) {
  console.error('❌ TOTO_BO_SERVICE_ACCOUNT_KEY environment variable is required');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountKey);
} catch (error) {
  console.error('❌ Failed to parse TOTO_BO_SERVICE_ACCOUNT_KEY as JSON');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: projectId
});

const db = admin.firestore();
const KB_COLLECTION = 'knowledge_base';

async function syncKBToVertex() {
  console.log('🚀 Starting Knowledge Base to Vertex AI Search sync...\n');

  try {
    // Initialize Vertex AI Search service
    const searchService = new VertexAISearchService();
    await searchService.initialize();

    // Load all KB entries from Firestore
    console.log('📚 Loading Knowledge Base entries from Firestore...');
    const snapshot = await db.collection(KB_COLLECTION).get();
    
    if (snapshot.empty) {
      console.log('⚠️  No Knowledge Base entries found in Firestore');
      console.log('💡 Add entries via toto-bo UI or migration script');
      return;
    }

    console.log(`📊 Found ${snapshot.size} Knowledge Base entries\n`);

    // Convert KB entries to searchable documents
    const documents: SearchableDocument[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Create searchable document from KB entry
      const document: SearchableDocument = {
        id: `kb-${data.id || doc.id}`,
        title: data.title || 'Untitled',
        content: data.content || '',
        source: `knowledge_base/${doc.id}`,
        category: data.category || 'general',
        metadata: {
          kbId: doc.id,
          agentTypes: data.agentTypes || [],
          audience: data.audience || [],
          lastUpdated: data.lastUpdated || new Date().toISOString(),
          usageCount: data.usageCount || 0,
        },
      };
      
      documents.push(document);
    });

    console.log(`📝 Converting ${documents.length} KB entries to searchable documents...\n`);

    // Index documents
    const result = await searchService.indexDocuments(documents);

    console.log('\n✅ Knowledge Base sync complete!');
    console.log(`   Successfully indexed: ${result.success} entries`);
    console.log(`   Failed: ${result.failed} entries\n`);

    // Show statistics
    const stats = searchService.getStats();
    console.log('📊 Index Statistics:');
    console.log(`   Total documents: ${stats.totalDocuments}`);
    console.log('   Categories:');
    for (const [category, count] of Object.entries(stats.categories)) {
      console.log(`     - ${category}: ${count}`);
    }

    // Show audience breakdown
    const audienceCounts: Record<string, number> = {};
    documents.forEach(doc => {
      const audiences = doc.metadata?.audience as string[] || [];
      audiences.forEach(audience => {
        audienceCounts[audience] = (audienceCounts[audience] || 0) + 1;
      });
    });

    if (Object.keys(audienceCounts).length > 0) {
      console.log('\n👥 Audience Breakdown:');
      for (const [audience, count] of Object.entries(audienceCounts)) {
        console.log(`     - ${audience}: ${count} entries`);
      }
    }

    console.log('\n✨ Knowledge Base entries are now searchable via Vertex AI Search!');
    console.log('💡 This is the recommended approach - KB is already user-facing and structured');
  } catch (error) {
    console.error('❌ Error syncing Knowledge Base:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  syncKBToVertex();
}

export { syncKBToVertex };

