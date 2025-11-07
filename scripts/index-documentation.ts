/**
 * Documentation Indexing Script
 * 
 * Indexes toto-docs documentation into Vertex AI Search
 * Run this script to index all markdown files from toto-docs
 * 
 * Usage:
 *   npm run index-docs
 *   or
 *   ts-node scripts/index-documentation.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { VertexAISearchService } from '../src/services/VertexAISearchService';

// Load environment variables
dotenv.config();

async function indexDocumentation() {
  console.log('⚠️  WARNING: This script indexes ALL documentation including tech docs');
  console.log('💡 RECOMMENDED: Use "npm run sync-kb-to-vertex" to sync Knowledge Base instead');
  console.log('💡 Knowledge Base is user-facing and structured - no need for external docs\n');
  console.log('🚀 Starting documentation indexing...\n');

  try {
    // Initialize Vertex AI Search service
    const searchService = new VertexAISearchService();
    await searchService.initialize();

    // Determine toto-docs path
    // Assuming this script runs from toto-ai-hub directory
    // toto-docs should be at ../toto-docs
    const docsPath = process.env.TOTO_DOCS_PATH || 
                     path.join(__dirname, '../../toto-docs/app/docs');

    console.log(`📁 Indexing documentation from: ${docsPath}\n`);

    // Index all markdown files
    const result = await searchService.indexDocumentation(docsPath);

    console.log('\n✅ Indexing complete!');
    console.log(`   Successfully indexed: ${result.success} documents`);
    console.log(`   Failed: ${result.failed} documents\n`);

    // Show statistics
    const stats = searchService.getStats();
    console.log('📊 Index Statistics:');
    console.log(`   Total documents: ${stats.totalDocuments}`);
    console.log('   Categories:');
    for (const [category, count] of Object.entries(stats.categories)) {
      console.log(`     - ${category}: ${count}`);
    }

    console.log('\n✨ Documentation is now searchable via Vertex AI Search!');
  } catch (error) {
    console.error('❌ Error indexing documentation:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  indexDocumentation();
}

export { indexDocumentation };

