# When to Sync KB to Vertex AI Search

## ✅ **AUTOMATIC SYNC IS NOW ENABLED!**

**You don't need to manually sync anymore!** KB entries are automatically synced to Vertex AI Search:

- ✅ **On Server Startup** - Syncs automatically when server starts
- ✅ **After Adding KB Entry** - Syncs automatically after creation
- ✅ **After Updating KB Entry** - Syncs automatically after update
- ✅ **After Deleting KB Entry** - Syncs automatically after deletion

## Manual Sync (Only if Needed)

Run `npm run sync-kb-to-vertex` only in these situations:

1. **Troubleshooting** - If automatic sync fails
2. **Bulk Operations** - After importing many entries at once
3. **Initial Verification** - To verify sync is working

## Detailed Scenarios

### 1. Initial Setup (Required)

**When**: First time using Vertex AI Search integration

**Why**: Vertex AI Search needs to be populated with KB entries from Firestore

**Command**:
```bash
cd toto-ai-hub
npm run sync-kb-to-vertex
```

**Result**: All KB entries are indexed in Vertex AI Search

---

### 2. After Adding New KB Entry (Recommended)

**When**: You add a new KB entry via toto-bo UI (`/dashboard/ai-hub/knowledge`)

**Why**: New entries need to be available in Vertex AI Search fallback

**Example**:
- You add a new entry: "How to verify donations"
- Run sync to make it searchable in Vertex AI Search

**Command**:
```bash
npm run sync-kb-to-vertex
```

**Note**: RAGService will pick up new entries automatically (loads from Firestore), but Vertex AI Search needs manual sync

---

### 3. After Updating KB Entry (Recommended)

**When**: You modify an existing KB entry via toto-bo UI

**Why**: Updated content needs to be reflected in Vertex AI Search

**Example**:
- You update "Donation Process" entry with new information
- Run sync to update Vertex AI Search

**Command**:
```bash
npm run sync-kb-to-vertex
```

---

### 4. After Deleting KB Entry (Recommended)

**When**: You delete a KB entry via toto-bo UI

**Why**: Deleted entries should be removed from Vertex AI Search

**Command**:
```bash
npm run sync-kb-to-vertex
```

**Note**: The sync script re-indexes all entries, so deleted ones will be removed

---

### 5. Periodic Maintenance (Optional)

**When**: Weekly or monthly, or after bulk changes

**Why**: Ensures Vertex AI Search is in sync with Firestore

**Command**:
```bash
npm run sync-kb-to-vertex
```

---

## How It Works

### Two Systems, One Source

```
Firestore (Source of Truth)
    ├─→ RAGService (Primary)
    │   └─ Loads KB entries on startup
    │   └─ Auto-updates when server restarts
    │   └─ In-memory (up to 1000 entries)
    │
    └─→ Vertex AI Search (Fallback)
        └─ Needs manual sync
        └─ Unlimited entries
        └─ Used when RAGService confidence is low
```

### Why Manual Sync?

- **RAGService**: Loads directly from Firestore on startup (automatic)
- **Vertex AI Search**: Uses in-memory store (needs manual sync)
- **Future**: Could be automated with webhooks or scheduled jobs

---

## Do You Need to Sync Every Time?

### ✅ **Yes, sync when**:
- Adding new KB entries
- Updating existing entries
- Deleting entries
- Initial setup

### ⚠️ **Maybe sync when**:
- Bulk changes (multiple entries at once)
- After long period without sync
- If agents seem to miss information

### ❌ **No sync needed when**:
- Just querying KB (RAGService handles this)
- No KB changes made
- Only using RAGService (not using Vertex AI Search fallback)

---

## Current Limitations

### Manual Process

Currently, sync is **manual** - you need to run the command after KB changes.

### Future Automation (Possible)

Could be automated with:
1. **Webhook**: Trigger sync when KB entry is added/updated in toto-bo
2. **Scheduled Job**: Daily/weekly automatic sync
3. **Real-time Sync**: Sync immediately when KB changes

---

## Quick Reference

```bash
# Automatic sync happens - no manual steps needed!

# Only run manually if:
# - Troubleshooting sync issues
# - After bulk imports
# - To verify sync is working
npm run sync-kb-to-vertex
```

## See Also

- `AUTOMATIC_KB_SYNC.md` - Details on automatic sync implementation
- `USER_FACING_DOCUMENTATION_STRATEGY.md` - KB-only approach

---

## Troubleshooting

### "No Knowledge Base entries found"

- Check that KB entries exist in Firestore
- Verify `TOTO_BO_SERVICE_ACCOUNT_KEY` is set
- Check Firestore collection: `knowledge_base`

### "Sync completed but agents don't see new entries"

- RAGService loads on startup - restart server
- Vertex AI Search is fallback - check if RAGService confidence is high enough
- Verify entries are actually in Firestore

### "Sync is slow"

- Normal for large KB (100+ entries)
- Sync re-indexes all entries (not incremental)
- Consider incremental sync in future

---

## Summary

**Run sync when KB changes** - that's it!

- ✅ Initial setup
- ✅ After KB changes (add/update/delete)
- ✅ Periodic maintenance

**Don't sync if**:
- ❌ No KB changes
- ❌ Just querying (RAGService handles this)

The sync ensures Vertex AI Search (fallback) has the latest KB entries when RAGService confidence is low.

