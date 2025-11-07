# Automatic KB Sync to Vertex AI Search

## Overview

KB entries are now **automatically synced** to Vertex AI Search - no manual sync needed!

## When Sync Happens

### ✅ **Automatic Sync**

1. **On Server Startup** - KB is synced when server starts
   - Happens after `apiGateway.initialize()`
   - Non-blocking (doesn't delay server startup)
   - Logs success/failure

2. **After Adding KB Entry** - Syncs immediately after creation
   - Triggered by `POST /api/ai/knowledge`
   - Non-blocking (API responds immediately)
   - Sync happens in background

3. **After Updating KB Entry** - Syncs immediately after update
   - Triggered by `PUT /api/ai/knowledge/:id`
   - Non-blocking (API responds immediately)
   - Sync happens in background

4. **After Deleting KB Entry** - Syncs immediately after deletion
   - Triggered by `DELETE /api/ai/knowledge/:id`
   - Non-blocking (API responds immediately)
   - Sync happens in background

### 🔄 **How It Works**

```typescript
// In TotoAPIGateway
async syncKBToVertexAI(): Promise<{ success: number; failed: number }> {
  // Gets all KB entries from Firestore
  // Converts to searchable documents
  // Indexes in Vertex AI Search
  // Returns result
}
```

## Implementation Details

### Server Startup

```javascript
// server.js - initialization
await apiGateway.initialize();
// → Automatically calls syncKBToVertexAI() (non-blocking)
```

### API Endpoints

```javascript
// POST /api/ai/knowledge
const newItem = await apiGateway.addKnowledgeItem(...);
apiGateway.syncKBToVertexAI(); // Automatic sync

// PUT /api/ai/knowledge/:id
await knowledgeBaseService.update(...);
apiGateway.syncKBToVertexAI(); // Automatic sync

// DELETE /api/ai/knowledge/:id
await knowledgeBaseService.delete(...);
apiGateway.syncKBToVertexAI(); // Automatic sync
```

## Benefits

✅ **No Manual Steps** - Sync happens automatically  
✅ **Always Up-to-Date** - Vertex AI Search stays in sync  
✅ **Non-Blocking** - Doesn't slow down API responses  
✅ **Error Resilient** - Failures don't break the system  

## Manual Sync (If Needed)

If you need to manually trigger sync (e.g., after bulk changes):

```bash
# Via API endpoint (if you add one)
curl -X POST http://localhost:8080/api/ai/knowledge/sync-vertex

# Or via script
npm run sync-kb-to-vertex
```

## Monitoring

Check server logs for sync status:

```
✅ KB sync complete: 28 indexed, 0 failed
⚠️  KB sync after add failed (non-critical): [error]
```

## Troubleshooting

### Sync Fails on Startup

- **Not critical** - Server continues to start
- Sync will happen on next KB change
- Can manually run `npm run sync-kb-to-vertex`

### Sync Fails After KB Change

- **Not critical** - API still responds successfully
- KB entry is saved in Firestore
- RAGService will pick it up (loads from Firestore)
- Vertex AI Search will sync on next change or restart

### Check Sync Status

Look for these log messages:
- `🔄 Syncing Knowledge Base to Vertex AI Search...`
- `✅ KB sync complete: X indexed, Y failed`
- `⚠️  KB sync after [action] failed (non-critical)`

## Summary

**You don't need to run `sync-kb-to-vertex` manually anymore!**

- ✅ Syncs on server startup
- ✅ Syncs when KB entries change
- ✅ Non-blocking and error-resilient
- ✅ Always keeps Vertex AI Search up-to-date

The manual sync script (`npm run sync-kb-to-vertex`) is still available for:
- Initial setup verification
- Troubleshooting
- Bulk operations

