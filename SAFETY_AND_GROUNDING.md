# Safety and Grounding Configuration

## Overview

This document explains how we prevent hallucinations by **disabling web search by default** and ensuring models only use your controlled documentation and knowledge base.

## The Problem with Web Search Grounding

When Google Search grounding is enabled, models can:
- ✅ Access real-time information
- ❌ Mix web information with hallucinations
- ❌ Use outdated or incorrect web sources
- ❌ Provide information not from your controlled sources
- ❌ Create responses that don't match your documentation

## Our Solution: Documentation-Only Mode (Default)

**By default, web search is DISABLED.** The system only uses:
1. **VectorDB** - Your knowledge base entries
2. **Vertex AI Search** - Your `toto-docs` documentation
3. **No web search** - Prevents hallucinations from external sources

## How It Works

### Default Behavior (Safe Mode)

```
User Query
    ↓
VectorDB Search (Knowledge Base)
    ↓
Confidence Check
    ├─ High (≥ 0.6) → Return VectorDB results
    └─ Low (< 0.6) → Vertex AI Search (Your Documentation)
                      ↓
                      Return results from YOUR documentation only
```

**No web search = No hallucinations from external sources**

### If Web Search Were Enabled (Not Recommended)

```
User Query
    ↓
RAG Search
    ↓
Low Confidence?
    ↓
Google Search → External Web Sources
    ↓
Risk of hallucinations from uncontrolled sources
```

## Configuration

### Safe Mode (Default - Recommended)

```env
# No web search - only your documentation
# ENABLE_GOOGLE_SEARCH_GROUNDING is not set or set to false
```

**Result**: Models only use your VectorDB + Vertex AI Search (your docs)

### Web Search Mode (Not Recommended)

```env
# Enable web search (use with caution)
ENABLE_GOOGLE_SEARCH_GROUNDING=true
```

**Result**: Models can search the web, which may introduce hallucinations

## Code Implementation

### GroundingService

The `GroundingService` checks the environment variable:

```typescript
// Default: NO web search
this.enableWebSearch = process.env.ENABLE_GOOGLE_SEARCH_GROUNDING === 'true';
```

If disabled:
- `shouldUseGrounding()` always returns `useGrounding: false`
- `queryWithGrounding()` refuses to search the web
- Models only use your documentation

### RAGService

The `RAGService` uses:
1. **VectorDB** (your knowledge base) - Primary
2. **Vertex AI Search** (your documentation) - Fallback
3. **No web search** - Never used

## Best Practices

### ✅ Recommended

1. **Keep web search disabled** (default)
2. **Index all your documentation** using `npm run index-docs`
3. **Maintain your knowledge base** in Firestore
4. **Monitor confidence scores** - if low, add more documentation

### ❌ Not Recommended

1. **Enabling web search** for production use
2. **Relying on web search** instead of your documentation
3. **Allowing external sources** without verification

## What Happens When Confidence is Low?

### Current Behavior (Safe)

1. VectorDB search returns low confidence (< 0.6)
2. System tries Vertex AI Search (your documentation)
3. If found in docs → Return documentation results
4. If not found → Return "I don't have that information"
5. **Never searches the web**

### If Web Search Were Enabled (Not Recommended)

1. VectorDB search returns low confidence
2. System tries Vertex AI Search
3. If still low → Google Search (external web)
4. **Risk**: External sources may be incorrect or outdated

## Monitoring

### Check if Web Search is Enabled

```typescript
const groundingService = new GroundingService();
// Check logs for:
// "[GroundingService] Initialized WITHOUT web search" ✅ Safe
// "[GroundingService] Initialized with Google Search grounding ENABLED" ⚠️ Web search active
```

### Check RAG Confidence

```typescript
const result = await ragService.retrieveKnowledge({...});
console.log(`Confidence: ${result.confidence}`);
console.log(`Fallback used: ${result.fallbackUsed}`); // Vertex AI Search, not web
```

## FAQ

### Q: Will models hallucinate if web search is disabled?

**A**: No. Models can only use:
- Your knowledge base (VectorDB)
- Your documentation (Vertex AI Search)
- No external web sources

If information isn't in your docs, the model will say "I don't have that information" instead of making something up.

### Q: What if I need real-time information?

**A**: You have two options:
1. **Add it to your documentation** - Best practice
2. **Enable web search temporarily** - Use with caution, monitor responses

### Q: How do I ensure models use my documentation?

**A**: 
1. Keep `ENABLE_GOOGLE_SEARCH_GROUNDING` unset or `false`
2. Index all documentation: `npm run index-docs`
3. Maintain knowledge base entries in Firestore
4. Monitor confidence scores

### Q: Can I enable web search for specific queries only?

**A**: Yes, but it's not recommended. You can:
1. Create a separate service instance with web search enabled
2. Use it only for specific, monitored queries
3. Always verify responses

## Summary

✅ **Default**: Web search disabled - only your documentation  
✅ **Safe**: No hallucinations from external sources  
✅ **Controlled**: All responses come from your knowledge base/docs  
⚠️ **Optional**: Web search can be enabled, but not recommended

**Recommendation**: Keep web search disabled and ensure all information is in your documentation and knowledge base.

