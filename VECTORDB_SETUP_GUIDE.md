# Vector Database Setup & Migration Guide

This guide explains how to set up and use the VectorDBService for unlimited, scalable vector storage.

**Date**: 2025-11-05
**Status**: ✅ Complete

---

## Overview

The Vector Database Service provides abstraction for vector storage and retrieval, supporting two backends:

1. **In-Memory** (default): Fast, simple, good for development and small datasets
2. **Vertex AI Vector Search**: Production-grade, unlimited storage, scalable to millions of vectors

---

## Features

✅ **Unlimited Vector Storage** - No 1,000 chunk limitation
✅ **Metadata Filtering** - Filter by category, audience, tags, source, timestamp
✅ **Hybrid Search** - Combine vector similarity with metadata filters
✅ **Batch Operations** - Efficient bulk upsert and delete
✅ **Automatic Retry** - Exponential backoff for network failures
✅ **Connection Pooling** - Optimized for high throughput
✅ **Dual Backend Support** - Switch between in-memory and Vertex AI seamlessly

---

## Quick Start

### Option 1: In-Memory Backend (Default)

```typescript
import { RAGService } from './services/RAGService';

// Initialize with in-memory backend (no configuration needed)
const ragService = new RAGService();

// Add knowledge chunks - no limit!
await ragService.addKnowledgeChunks(chunks);

// Search with filters
const results = await ragService.retrieveKnowledge({
  query: 'How do I donate?',
  agentType: 'CaseAgent',
  audience: 'donors',
  maxResults: 5,
});
```

### Option 2: Vertex AI Backend (Production)

```typescript
import { RAGService } from './services/RAGService';

// Initialize with Vertex AI backend
const ragService = new RAGService({
  backend: 'vertex-ai',
  projectId: 'your-gcp-project',
  location: 'us-central1',
  indexId: 'your-index-id',
  indexEndpointId: 'your-endpoint-id',
});

// Same API - unlimited scalability!
await ragService.addKnowledgeChunks(chunks);
```

---

## Vertex AI Setup

### Prerequisites

1. Google Cloud Platform account
2. Project with billing enabled
3. Vertex AI API enabled

### Step 1: Enable Vertex AI API

```bash
gcloud services enable aiplatform.googleapis.com
```

### Step 2: Create Vector Search Index

```bash
# Set your project
export PROJECT_ID="your-gcp-project"
export LOCATION="us-central1"

# Create index
gcloud ai indexes create \
  --display-name="toto-knowledge-base" \
  --description="Knowledge base vectors for Toto AI agents" \
  --index-update-method=STREAM_UPDATE \
  --dimensions=768 \
  --distance-measure-type=COSINE \
  --project=$PROJECT_ID \
  --region=$LOCATION
```

Note the `INDEX_ID` from the output.

### Step 3: Deploy Index to Endpoint

```bash
# Create endpoint
gcloud ai index-endpoints create \
  --display-name="toto-kb-endpoint" \
  --project=$PROJECT_ID \
  --region=$LOCATION

# Note the ENDPOINT_ID from output

# Deploy index to endpoint
gcloud ai index-endpoints deploy-index $ENDPOINT_ID \
  --deployed-index-id="toto-kb-deployed" \
  --index=$INDEX_ID \
  --display-name="toto-kb-deployed" \
  --project=$PROJECT_ID \
  --region=$LOCATION
```

### Step 4: Set Environment Variables

```bash
# Add to .env file
VERTEX_AI_PROJECT_ID=your-gcp-project
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_INDEX_ID=your-index-id
VERTEX_AI_INDEX_ENDPOINT_ID=your-endpoint-id
```

### Step 5: Install Required Packages

```bash
npm install @google-cloud/aiplatform google-auth-library
```

### Step 6: Test Connection

```typescript
import { VectorDBService } from './services/VectorDBService';

const vectorDB = new VectorDBService({
  backend: 'vertex-ai',
  projectId: process.env.VERTEX_AI_PROJECT_ID,
  location: process.env.VERTEX_AI_LOCATION,
  indexId: process.env.VERTEX_AI_INDEX_ID,
  indexEndpointId: process.env.VERTEX_AI_INDEX_ENDPOINT_ID,
});

// Test with a simple upsert
await vectorDB.upsert({
  id: 'test-1',
  embedding: new Array(768).fill(0.1),
  content: 'Test document',
  metadata: {
    category: 'test',
    audience: ['admin'],
    source: 'test',
    timestamp: new Date(),
    version: '1.0',
  },
});

console.log('✅ Vertex AI connected successfully!');
```

---

## Migration from Old RAGService

### Option 1: Automatic Migration Script

```bash
# Run migration script
ts-node src/scripts/migrate-to-vectordb.ts --backend=in-memory

# Or for Vertex AI (requires setup above)
ts-node src/scripts/migrate-to-vectordb.ts --backend=vertex-ai

# Dry run to preview
ts-node src/scripts/migrate-to-vectordb.ts --backend=vertex-ai --dry-run
```

### Option 2: Manual Migration

```typescript
import { RAGService } from './services/RAGService';

// Initialize new RAGService with VectorDB
const newRAG = new RAGService({ backend: 'in-memory' });

// Load your existing chunks (from Firestore, JSON, etc.)
const existingChunks = await loadExistingChunks();

// Batch migrate
await newRAG.addKnowledgeChunks(existingChunks);

console.log('✅ Migration complete!');
```

---

## Vector Document Schema

```typescript
interface VectorDocument {
  id: string;                    // Unique identifier
  embedding: number[];           // 768-dimensional vector (Gemini embeddings)
  content: string;               // Original text content
  metadata: {
    category: string;            // e.g., 'donation_process', 'case_management'
    audience: string[];          // e.g., ['donors', 'guardians']
    source: string;              // e.g., 'admin', 'documentation'
    timestamp: Date;             // When added/updated
    version: string;             // Version tracking
    tags?: string[];             // Optional tags for filtering
  };
}
```

---

## Search Examples

### Basic Search

```typescript
const results = await ragService.retrieveKnowledge({
  query: 'How do I make a donation?',
  agentType: 'CaseAgent',
  maxResults: 3,
});
```

### Search with Audience Filtering

```typescript
// Boost relevance for donor-specific content
const results = await ragService.retrieveKnowledge({
  query: 'What are totitos?',
  agentType: 'CaseAgent',
  audience: 'donors',  // Boosts donor-relevant results
  maxResults: 5,
});
```

### Advanced Filtering

```typescript
import { VectorDBService } from './services/VectorDBService';

const vectorDB = new VectorDBService({ backend: 'in-memory' });

// Search with multiple filters
const results = await vectorDB.search({
  embedding: queryEmbedding,
  topK: 10,
  filters: {
    category: 'donation_process',
    audience: ['donors', 'investors'],  // OR logic
    tags: ['TRF', 'banking'],           // OR logic
    minTimestamp: new Date('2024-01-01'),
  },
  minScore: 0.7,  // Only high-confidence results
});
```

---

## Performance Optimization

### Batch Operations

```typescript
// Efficient batch upsert
const result = await vectorDB.upsertBatch(documents);
console.log(`Processed: ${result.processedCount}, Failed: ${result.failedCount}`);

// Efficient batch delete
await vectorDB.deleteBatch(idsToDelete);
```

### Caching

```typescript
// RAGService automatically caches usage counts
// Cache is cleaned up when it exceeds 100 entries (configurable)

const stats = await ragService.getMemoryStats();
console.log(`Cache size: ${stats.cacheSize}`);
```

### Connection Pooling

VectorDBService automatically uses connection pooling for Vertex AI:
- Reuses authentication tokens
- Keeps connections alive
- Automatic retry with exponential backoff

---

## Monitoring & Analytics

### Get Statistics

```typescript
const stats = await ragService.getMemoryStats();

console.log(stats);
// {
//   chunks: -1,  // -1 indicates unlimited (Vertex AI)
//   unlimited: true,
//   cacheSize: 42,
//   memoryUsage: 'Unlimited (VectorDB backend)'
// }
```

### Check Vector Count

```typescript
const count = await vectorDB.count();

// With filters
const filteredCount = await vectorDB.count({
  category: 'donation_process',
  audience: ['donors'],
});
```

---

## Cost Estimation

### In-Memory Backend
- **Cost**: $0 (free)
- **Limitations**: No persistence, limited by server RAM
- **Best for**: Development, testing, small datasets (<10,000 vectors)

### Vertex AI Backend
- **Cost**: Pay-as-you-go
- **Pricing** (as of 2024):
  - Index storage: $0.30/GB/month
  - Query cost: $0.01 per 1,000 queries
  - Approximate: $50-200/month for typical usage
- **Benefits**: Unlimited storage, auto-scaling, 99.9% SLA
- **Best for**: Production, large datasets (>10,000 vectors)

**Example Cost Calculation**:
```
10,000 vectors × 768 dimensions × 4 bytes = 30.7 MB
Storage: 30.7 MB × $0.30/GB/month = ~$0.01/month
Queries: 100,000 queries/month × $0.01/1000 = $1.00/month
Total: ~$1.01/month for 10,000 vectors
```

---

## Troubleshooting

### Error: "Package @google-cloud/aiplatform not installed"

**Solution**:
```bash
npm install @google-cloud/aiplatform google-auth-library
```

### Error: "Vertex AI project ID and index ID are required"

**Solution**: Set environment variables in `.env`:
```bash
VERTEX_AI_PROJECT_ID=your-project
VERTEX_AI_INDEX_ID=your-index-id
VERTEX_AI_INDEX_ENDPOINT_ID=your-endpoint-id
```

### Error: "Authentication failed"

**Solution**: Set up Google Cloud authentication:
```bash
# Option 1: Application Default Credentials
gcloud auth application-default login

# Option 2: Service Account
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### Slow Search Performance

**Solutions**:
1. Reduce `topK` value (fewer results = faster)
2. Add more specific filters (category, audience, tags)
3. Increase `minScore` threshold (skip low-relevance results)
4. Use batch operations instead of individual calls

### High Costs

**Solutions**:
1. Switch to in-memory backend for development
2. Add more aggressive filtering to reduce query costs
3. Implement client-side caching
4. Use smaller `topK` values

---

## Migration Checklist

- [ ] Choose backend (in-memory or Vertex AI)
- [ ] If Vertex AI: Complete Vertex AI setup steps
- [ ] If Vertex AI: Set environment variables
- [ ] If Vertex AI: Install @google-cloud/aiplatform package
- [ ] Update RAGService initialization in your code
- [ ] Run migration script (or manual migration)
- [ ] Test search functionality
- [ ] Monitor performance and costs
- [ ] Update any code that calls `getAllKnowledgeChunks()` (now async)
- [ ] Update any code that calls `clearKnowledgeChunks()` (now async)
- [ ] Update any code that calls `deleteKnowledgeChunk()` (now async)
- [ ] Update any code that calls `getMemoryStats()` (now async)

---

## API Changes

### Breaking Changes

1. **getAllKnowledgeChunks()**: Now async, returns empty array (not supported by Vertex AI)
2. **clearKnowledgeChunks()**: Now async
3. **deleteKnowledgeChunk()**: Now async, returns Promise<boolean>
4. **getMemoryStats()**: Now async, returns different structure

### Migration Example

**Before**:
```typescript
const chunks = ragService.getAllKnowledgeChunks();
ragService.clearKnowledgeChunks();
ragService.deleteKnowledgeChunk('chunk-1');
const stats = ragService.getMemoryStats();
```

**After**:
```typescript
const chunks = await ragService.getAllKnowledgeChunks();
await ragService.clearKnowledgeChunks();
await ragService.deleteKnowledgeChunk('chunk-1');
const stats = await ragService.getMemoryStats();
```

---

## Support

For issues or questions:
1. Check this guide
2. Review error messages in console logs
3. Check Vertex AI documentation: https://cloud.google.com/vertex-ai/docs/vector-search
4. Contact the development team

---

**Last Updated**: 2025-11-05
**Version**: 1.0
**Status**: Production Ready
