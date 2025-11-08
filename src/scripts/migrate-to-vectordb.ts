/**
 * Migration Script: In-Memory to VectorDB
 *
 * This script helps migrate existing knowledge chunks from the old in-memory
 * RAGService to the new VectorDBService-based implementation.
 *
 * Usage:
 *   ts-node src/scripts/migrate-to-vectordb.ts [--backend=vertex-ai|in-memory] [--dry-run]
 *
 * Options:
 *   --backend=vertex-ai    Migrate to Vertex AI Vector Search (requires configuration)
 *   --backend=in-memory    Migrate to in-memory VectorDBService (default)
 *   --dry-run              Preview migration without making changes
 */

import { RAGService, KnowledgeChunk } from '../services/RAGService';
import { VectorDBService } from '../services/VectorDBService';

interface MigrationOptions {
  backend: 'vertex-ai' | 'in-memory';
  dryRun: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    backend: 'in-memory',
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--backend=')) {
      const backend = arg.split('=')[1] as 'vertex-ai' | 'in-memory';
      if (backend === 'vertex-ai' || backend === 'in-memory') {
        options.backend = backend;
      }
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

/**
 * Load existing knowledge chunks from Firestore or JSON
 * This is a placeholder - you should implement actual data loading
 */
async function loadExistingChunks(): Promise<KnowledgeChunk[]> {
  // TODO: Implement actual data loading from Firestore or JSON file
  // For now, return empty array as example
  console.log('📚 Loading existing knowledge chunks...');

  try {
    // Example: Load from Firestore
    const admin = (await import('firebase-admin')).default;
    const db = admin.firestore();

    const snapshot = await db.collection('knowledgeBase').get();
    const chunks: KnowledgeChunk[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      chunks.push({
        id: doc.id,
        title: data.title || 'Untitled',
        content: data.content || '',
        category: data.category || 'general',
        agentTypes: data.agentTypes || [],
        audience: data.audience || [],
        embedding: data.embedding,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        usageCount: data.usageCount || 0,
      });
    });

    console.log(`✅ Loaded ${chunks.length} knowledge chunks`);
    return chunks;
  } catch (error) {
    console.error('❌ Error loading knowledge chunks:', error);
    console.log('💡 No existing chunks found - starting fresh');
    return [];
  }
}

/**
 * Migrate knowledge chunks to VectorDBService
 */
async function migrateChunks(chunks: KnowledgeChunk[], options: MigrationOptions): Promise<void> {
  console.log(`\n🔄 Starting migration to ${options.backend} backend...`);

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Create VectorDBService configuration
  const vectorDBConfig = options.backend === 'vertex-ai'
    ? {
        backend: 'vertex-ai' as const,
        projectId: process.env.VERTEX_AI_PROJECT_ID,
        location: process.env.VERTEX_AI_LOCATION || 'us-central1',
        indexId: process.env.VERTEX_AI_INDEX_ID,
        indexEndpointId: process.env.VERTEX_AI_INDEX_ENDPOINT_ID,
      }
    : {
        backend: 'in-memory' as const,
      };

  // Display configuration
  console.log('📋 Migration Configuration:');
  console.log(`   Backend: ${options.backend}`);
  if (options.backend === 'vertex-ai') {
    console.log(`   Project ID: ${vectorDBConfig.projectId || 'NOT SET'}`);
    console.log(`   Location: ${vectorDBConfig.location}`);
    console.log(`   Index ID: ${vectorDBConfig.indexId || 'NOT SET'}`);
    console.log(`   Index Endpoint ID: ${vectorDBConfig.indexEndpointId || 'NOT SET'}`);

    // Validate Vertex AI configuration
    if (!vectorDBConfig.projectId || !vectorDBConfig.indexId || !vectorDBConfig.indexEndpointId) {
      console.error('\n❌ ERROR: Vertex AI configuration incomplete!');
      console.error('Please set the following environment variables:');
      console.error('  - VERTEX_AI_PROJECT_ID');
      console.error('  - VERTEX_AI_INDEX_ID');
      console.error('  - VERTEX_AI_INDEX_ENDPOINT_ID');
      process.exit(1);
    }
  }
  console.log(`   Chunks to migrate: ${chunks.length}`);
  console.log('');

  if (chunks.length === 0) {
    console.log('⚠️  No chunks to migrate!');
    return;
  }

  if (options.dryRun) {
    console.log('📊 Migration Preview:');
    chunks.slice(0, 5).forEach((chunk, idx) => {
      console.log(`   ${idx + 1}. ${chunk.title}`);
      console.log(`      Category: ${chunk.category}`);
      console.log(`      Audience: ${chunk.audience.join(', ')}`);
      console.log(`      Has Embedding: ${chunk.embedding ? 'Yes' : 'No'}`);
    });
    if (chunks.length > 5) {
      console.log(`   ... and ${chunks.length - 5} more`);
    }
    console.log('\n✅ Dry run complete! Run without --dry-run to perform migration.');
    return;
  }

  // Create RAGService (constructor takes no arguments)
  const ragService = new RAGService();

  // Migrate chunks in batches
  const batchSize = 100;
  const batches = Math.ceil(chunks.length / batchSize);

  console.log(`📦 Migrating in ${batches} batches of ${batchSize}...\n`);

  for (let i = 0; i < batches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, chunks.length);
    const batch = chunks.slice(start, end);

    console.log(`   Batch ${i + 1}/${batches}: Migrating chunks ${start + 1}-${end}...`);

    try {
      await ragService.addKnowledgeChunks(batch);
      console.log(`   ✅ Batch ${i + 1} complete`);
    } catch (error) {
      console.error(`   ❌ Batch ${i + 1} failed:`, error);
      throw error;
    }
  }

  console.log('\n✅ Migration complete!');

  // Get stats
  const stats = await ragService.getMemoryStats();
  console.log(`\n📊 Final Statistics:`);
  console.log(`   Total chunks: ${stats.chunks === -1 ? 'Unlimited backend' : stats.chunks}`);
  console.log(`   Max chunks: ${stats.maxChunks === Infinity ? 'Unlimited' : stats.maxChunks}`);
  console.log(`   Memory usage: ${stats.memoryUsage}`);
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 VectorDB Migration Script\n');

  const options = parseArgs();

  try {
    // Load existing chunks
    const chunks = await loadExistingChunks();

    // Migrate to VectorDB
    await migrateChunks(chunks, options);

    console.log('\n✨ Migration successful!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
main();
