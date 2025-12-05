# Knowledge Base Management Policy

**Last Updated:** January 2025  
**Status:** Active Policy

---

## 🎯 Core Principle

**All Knowledge Base (KB) entries MUST be stored in Firestore (toto-bo project).**

The `getHardcodedKnowledgeBase()` method in `TotoAPIGateway.ts` exists **ONLY** for migration purposes and should return an empty array after all entries are migrated.

---

## 📋 Policy Rules

### ✅ DO:
- Store all KB entries in Firestore (`knowledge_base` collection in toto-bo project)
- Access KB entries via `KnowledgeBaseService.getAll()`
- Update KB entries directly in Firestore or using update scripts
- Use migration scripts to sync hardcoded entries to Firestore when needed

### ❌ DON'T:
- Add new KB entries to `TotoAPIGateway.ts` hardcoded array
- Modify hardcoded entries expecting them to be used at runtime
- Keep duplicate entries in both hardcoded and Firestore

---

## 🔄 Migration Process

If you need to migrate hardcoded entries to Firestore:

1. **Run migration script:**
   ```bash
   npm run migrate-knowledge-base
   ```

2. **Verify entries in Firestore:**
   - Check toto-bo Firestore console
   - Verify all entries exist in `knowledge_base` collection

3. **Remove hardcoded entries:**
   - Remove entries from `getHardcodedKnowledgeBase()` method
   - Keep method returning empty array for backward compatibility
   - Update this policy if method is fully removed

---

## 📝 Update Workflow

### To Update an Existing KB Entry:

1. **Option A: Direct Firestore Update**
   - Go to toto-bo Firestore console
   - Navigate to `knowledge_base` collection
   - Edit the entry directly
   - Changes take effect after server restart (embeddings may need regeneration)

2. **Option B: Update Script**
   - Create/use update script (e.g., `update-kb-donations-013.ts`)
   - Run: `npm run update-kb-[entry-id]`
   - Script updates Firestore entry

### To Add a New KB Entry:

1. **Add to Firestore directly** (recommended)
   - Use toto-bo Firestore console
   - Or create an add script

2. **DO NOT add to hardcoded array** in `TotoAPIGateway.ts`

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│   Firestore (toto-bo)               │
│   knowledge_base collection          │  ← Source of Truth
└──────────────┬──────────────────────┘
               │
               │ KnowledgeBaseService.getAll()
               │
               ▼
┌─────────────────────────────────────┐
│   RAGService                        │
│   - Loads from KnowledgeBaseService │
│   - Generates embeddings            │
│   - Stores in VectorDB              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   CaseAgent / Other Agents          │
│   - Uses RAGService for retrieval   │
└─────────────────────────────────────┘
```

---

## ⚠️ Important Notes

- **Hardcoded entries are NOT used at runtime** - they are only for migration
- **Firestore is the single source of truth** for all KB entries
- **VectorDB** stores embeddings for semantic search, but content comes from Firestore
- **Embeddings** are cached in Firestore entries for performance

---

## 🔍 Verification

To verify KB entries are loaded correctly:

1. Check server logs on startup:
   ```
   [TotoAPIGateway] Loaded X knowledge base entries from Firestore
   ```

2. Check VectorDB count:
   ```
   [RAGService] VectorDB now contains X documents
   ```

3. If count is 0, check:
   - Firestore connection
   - KnowledgeBaseService initialization
   - RAGService initialization

---

## 📚 Related Documentation

- `scripts/migrate-knowledge-base.ts` - Migration script
- `src/services/KnowledgeBaseService.ts` - KB service implementation
- `src/services/RAGService.ts` - RAG service that uses KB entries

---

## 🚨 Breaking Changes

If you see this error:
```
[TotoAPIGateway] getHardcodedKnowledgeBase() called but all entries are in Firestore
```

This means:
- ✅ Migration is complete
- ✅ All entries are in Firestore
- ✅ System is working correctly

The warning can be ignored - it's just confirming the policy is being followed.

