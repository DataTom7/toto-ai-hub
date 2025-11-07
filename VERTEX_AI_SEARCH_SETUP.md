# Vertex AI Search Integration Setup Guide

This guide explains how to set up and use Vertex AI Search and Google Search grounding in the toto-ai-hub.

## Overview

We've implemented Option A (Hybrid Approach):
- ✅ **VectorDB** - Continues to handle knowledge base entries (working well)
- ✅ **Vertex AI Search** - Indexes `toto-docs` documentation and serves as fallback when VectorDB confidence is low
- ✅ **Google Search Grounding** - Enabled for real-time information via Gemini 2.0

## Features Implemented

### 1. Vertex AI Search Service
- Indexes documentation from `toto-docs`
- Provides semantic search as fallback when VectorDB confidence < 0.6
- In-memory document store (can be upgraded to full Vertex AI Search API)

### 2. Google Search Grounding
- Enabled in `GroundingService` using Gemini 2.0's `googleSearchRetrieval` tool
- Automatically used when:
  - RAG confidence is low
  - Query contains real-time keywords (current, latest, today, etc.)
  - Query is about external entities or events
  - No RAG results found

### 3. Hybrid RAG System
- Primary: VectorDB for knowledge base entries
- Fallback: Vertex AI Search for documentation when confidence is low
- Automatic routing based on confidence scores

## Environment Variables

Add these to your `.env` file:

```env
# Google AI (required)
GOOGLE_AI_API_KEY=your_gemini_api_key

# Web Search Grounding (NOT RECOMMENDED - disabled by default)
# Set to true ONLY if you need web search (increases hallucination risk)
# ENABLE_GOOGLE_SEARCH_GROUNDING=false  # Default: false (safe mode)

# Vertex AI Search (optional - for full integration)
GOOGLE_CLOUD_PROJECT_ID=your_gcp_project_id
VERTEX_AI_PROJECT_ID=your_vertex_ai_project_id
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_DATA_STORE_ID=your_data_store_id
VERTEX_AI_SEARCH_ENGINE_ID=your_search_engine_id

# Documentation Path (optional)
TOTO_DOCS_PATH=../toto-docs/app/docs
```

**Important Safety Note**: 
- **Web search is DISABLED by default** to prevent hallucinations
- Models only use your documentation and knowledge base
- Set `ENABLE_GOOGLE_SEARCH_GROUNDING=true` only if you need web search (not recommended)
- See `SAFETY_AND_GROUNDING.md` for details

**Note**: If Vertex AI Search environment variables are not set, the system will use an in-memory fallback that still provides semantic search capabilities.

## Setup Steps

### 1. Install Dependencies

```bash
cd toto-ai-hub
npm install
```

This will install:
- `@google-cloud/discoveryengine` - Vertex AI Search SDK
- `ts-node` - For running TypeScript scripts

### 2. Index Documentation

Index your `toto-docs` documentation:

```bash
npm run index-docs
```

This will:
- Scan all markdown files in `toto-docs/app/docs`
- Extract titles, content, and categories
- Index them into Vertex AI Search (in-memory for now)

### 3. Verify Integration

The system is automatically integrated. When agents query knowledge:

1. **First**: VectorDB searches knowledge base entries
2. **If confidence < 0.6**: Vertex AI Search searches documentation
3. **If real-time info needed**: Google Search grounding is used

## Usage

### Automatic Usage

The hybrid system works automatically. No code changes needed in agents - they continue to use `RAGService.retrieveKnowledge()` as before.

### Manual Usage

#### Search Documentation Directly

```typescript
import { VertexAISearchService } from './services/VertexAISearchService';

const searchService = new VertexAISearchService();
await searchService.initialize();

const results = await searchService.search({
  query: 'How do donations work?',
  maxResults: 5,
  category: 'ecosystem',
  minScore: 0.6
});
```

#### Use Google Search Grounding

```typescript
import { GroundingService } from './services/GroundingService';

const groundingService = new GroundingService();

// Automatic decision
const result = await groundingService.intelligentQuery({
  query: 'What is the latest news about pet adoption?',
  ragConfidence: 0.4, // Low confidence triggers grounding
});

// Manual grounding
const groundedResult = await groundingService.queryWithGrounding({
  query: 'Current pet adoption statistics',
  context: 'User is asking about adoption trends',
});
```

## How It Works

### RAG Flow with Fallback

```
User Query
    ↓
VectorDB Search (Knowledge Base)
    ↓
Confidence Check
    ├─ High (≥ 0.6) → Return VectorDB results
    └─ Low (< 0.6) → Vertex AI Search (Documentation)
                      ↓
                      Return combined results
```

### Grounding Decision Flow

```
User Query
    ↓
Analyze Query
    ├─ Real-time keywords? → Use Google Search
    ├─ External entities? → Use Google Search
    ├─ Low RAG confidence? → Use Google Search
    └─ Internal knowledge → Use RAG
```

## Monitoring

### Check RAG Confidence

RAG results now include confidence scores:

```typescript
const result = await ragService.retrieveKnowledge({
  query: 'How do donations work?',
  agentType: 'CaseAgent',
});

console.log(`Confidence: ${result.confidence}`);
console.log(`Fallback used: ${result.fallbackUsed}`);
console.log(`Vertex AI results: ${result.vertexAISearchResults?.length || 0}`);
```

### Grounding Analytics

```typescript
const analytics = groundingService.getAnalytics();
console.log(`Grounding rate: ${analytics.groundingRate}`);
console.log(`Query types:`, analytics.queryTypeDistribution);
```

## Cost Management

### Using Your $1,000 Credits

The GenAI App Builder credits cover:
- **Vertex AI Search**: Indexing and search operations
- **Grounded Generation API**: Google Search grounding calls
- **Gemini API**: Model inference with grounding

### Cost Optimization Tips

1. **Selective Grounding**: Only uses Google Search when needed (real-time keywords, low confidence)
2. **In-Memory Fallback**: Documentation search uses in-memory store (no API costs) until you set up full Vertex AI Search
3. **Confidence Thresholds**: Adjust `VECTORDB_CONFIDENCE_THRESHOLD` (default: 0.6) to control fallback frequency

## Troubleshooting

### Documentation Not Found

- Ensure `npm run index-docs` was run successfully
- Check `TOTO_DOCS_PATH` environment variable
- Verify markdown files exist in the path

### Google Search Grounding Not Working

- **This is expected** - web search is disabled by default for safety
- If you need web search (not recommended), set `ENABLE_GOOGLE_SEARCH_GROUNDING=true`
- Verify `GOOGLE_AI_API_KEY` is set
- Check that you're using Gemini 2.0 models
- See `SAFETY_AND_GROUNDING.md` for why web search is disabled

### Low Confidence Scores

- This is expected for queries not in knowledge base
- System will automatically use Vertex AI Search fallback
- Consider adding more knowledge base entries for common queries

## Next Steps

### Full Vertex AI Search Integration

To upgrade from in-memory to full Vertex AI Search:

1. Create a Vertex AI Search data store in Google Cloud Console
2. Set environment variables (`VERTEX_AI_DATA_STORE_ID`, etc.)
3. Update `VertexAISearchService` to use Discovery Engine API
4. Re-index documentation

### Enhanced Features

- **Case Data Grounding**: Index case data from Firestore
- **Real-time Updates**: Auto-reindex when documentation changes
- **Analytics Dashboard**: Track search performance and costs

## Support

For issues or questions:
- Check logs for `[VertexAISearchService]` and `[GroundingService]` prefixes
- Review confidence scores in RAG results
- Monitor grounding analytics

