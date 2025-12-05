# KB Storage Clarification

**Last Updated:** January 2025

---

## Current Architecture

### KB Storage Location
- **KB is stored in**: `toto-bo` Firestore (Production)
- **Collection**: `knowledge_base`
- **Project ID**: `toto-bo` (not `toto-bo-stg`)

### Who Accesses the KB

1. **toto-ai-hub** (Production/Main only)
   - Only has one environment: `main` (production)
   - Accesses KB from `toto-bo` (production) Firestore
   - Uses service account: `TOTO_BO_SERVICE_ACCOUNT_KEY`

2. **toto-bo** (Backoffice - has staging and production)
   - **toto-bo-stg** (Staging UI): Can access KB from `toto-bo` (production) Firestore
   - **toto-bo** (Production UI): Accesses KB from `toto-bo` (production) Firestore
   - Both UIs manage the same KB

---

## Key Points

✅ **Single KB**: There is ONE KB in `toto-bo` (production) Firestore  
✅ **Shared Access**: Both `toto-bo-stg` and `toto-bo` UIs access the same KB  
✅ **toto-ai-hub**: Only production/main, accesses the same KB  

❌ **No Separate KBs**: There is NOT a separate KB in `toto-bo-stg` Firestore  
❌ **No Staging KB**: `toto-ai-hub` has no staging environment, so no staging KB needed  

---

## Migration Script Behavior

The migration script (`migrate-knowledge-base.ts`) writes to:
- **Default**: `toto-bo` (production) - ✅ Correct
- **Can target**: `toto-bo-stg` if explicitly specified, but this is NOT recommended

**Recommendation**: Always use `toto-bo` (production) as the KB storage location.

---

## Why This Architecture?

1. **Single Source of Truth**: One KB for all environments
2. **No Duplication**: Don't need to sync KB between staging and production
3. **Consistent Behavior**: All environments use the same KB entries
4. **Simplified Management**: Manage KB in one place (`toto-bo` production)

---

## Verification

To verify which Firestore the KB is in:
```bash
npm run check-firestore
```

This will show:
- Which Firestore instance scripts are connecting to
- Total KB entries in that Firestore
- Whether the 32 hardcoded entries exist

---

## Summary

**Question**: Are staging and production KB the same?  
**Answer**: Yes! There is only ONE KB in `toto-bo` (production) Firestore. Both `toto-bo-stg` (staging UI) and `toto-bo` (production UI) access the same KB. `toto-ai-hub` (production only) also accesses the same KB.

