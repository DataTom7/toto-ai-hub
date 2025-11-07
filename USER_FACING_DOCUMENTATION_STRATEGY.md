# User-Facing Documentation Strategy

## Problem

We initially indexed all of `toto-docs`, which includes:
- ❌ **Technical documentation** (for developers)
- ❌ **Architecture docs** (for developers)
- ❌ **API references** (for developers)

**Issue**: AI agents interact with end users (donors, guardians), not developers. They need user-facing content, not tech docs.

## Solution: Knowledge Base Only

### ✅ **Why Knowledge Base Only?**

**KB is already**:
- ✅ User-facing (donations, cases, social media)
- ✅ Structured for agents
- ✅ Stored in Firestore (easy to manage)
- ✅ Already being used by agents via RAGService
- ✅ Single source of truth

**No need for fallback** because:
- KB is comprehensive and user-focused
- Easy to enrich via toto-bo UI
- Structured specifically for agents
- No parsing needed

## Recommended Approach

### **Knowledge Base Only**

1. **Sync KB to Vertex AI Search**:
   ```bash
   npm run sync-kb-to-vertex
   ```

2. **How it works**:
   - **Primary**: RAGService searches KB entries (in-memory, up to 1000)
   - **Fallback**: Vertex AI Search searches KB entries (unlimited, when confidence low)
   - **Both use KB** - no external docs needed

3. **Enrich KB** when needed:
   - Add entries via toto-bo UI
   - Extract content from user-guides if needed
   - Structure for agents

4. **Benefits**:
   - ✅ KB is already user-facing
   - ✅ Easy to manage
   - ✅ Structured for agents
   - ✅ Single source of truth
   - ✅ No complexity from multiple sources

## Implementation

### Current Setup

- ✅ `sync-kb-to-vertex.ts` - Syncs KB from Firestore (USE THIS)
- ⚠️ `index-user-guides.ts` - Not needed (KB is sufficient)
- ⚠️ `index-documentation.ts` - Deprecated (includes tech docs)

### Migration Steps

1. **Clear current index** (removes tech docs):
   ```typescript
   // In VertexAISearchService
   searchService.clearIndex();
   ```

2. **Sync KB only**:
   ```bash
   npm run sync-kb-to-vertex
   ```

3. **Done!** - KB is now the single source of truth

## Knowledge Base Structure

KB entries are already user-facing:

```typescript
{
  id: 'kb-donations-001',
  title: 'Banking Alias System',
  content: '...', // User-facing explanation
  category: 'donations',
  audience: ['donors'], // User-facing
  agentTypes: ['CaseAgent']
}
```

## User Guides Structure

User guides are also user-facing:

```
user-guides/
├── main-app.md          # For end users
├── ai-assistant.md      # For end users
├── wallet.md            # For end users
└── backoffice.md        # For admins (still user-facing)
```

## Best Practice

1. **Only**: Use KB (already user-facing, structured)
2. **Enrich**: Add more entries to KB when needed (via toto-bo UI)
3. **Avoid**: Indexing any external docs (tech docs or user-guides)

## Commands

```bash
# Use this: Sync KB (user-facing, structured, single source of truth)
npm run sync-kb-to-vertex

# Don't use: Index user-guides (not needed - KB is sufficient)
npm run index-user-guides  # Deprecated

# Don't use: Index all docs (includes tech docs)
npm run index-docs  # Deprecated
```

## Next Steps

1. ✅ Run `npm run sync-kb-to-vertex` to sync KB
2. ✅ Review KB entries - ensure they're comprehensive
3. ✅ Add more entries to KB via toto-bo UI when needed
4. ✅ Done! - KB is the single source of truth

## Architecture

```
User Query
    ↓
RAGService (Primary)
    ├─ Searches KB entries (in-memory, up to 1000)
    └─ If confidence low → Vertex AI Search (Fallback)
         └─ Searches KB entries (unlimited, from Firestore)
```

**Both use KB** - no external documentation needed!

