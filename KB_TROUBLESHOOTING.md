# Knowledge Base Troubleshooting Guide

## Current Issue: KB Not Working in Production

**Symptoms:**
- Production toto-bo UI shows 0 KB entries
- Staging toto-bo UI shows 1 entry (should show 28)
- Enhanced error logging has been added to diagnose the issue

## Root Cause

Production `toto-ai-hub` cannot access the shared KB in `toto-bo` Firestore because:
1. The `TOTO_BO_SERVICE_ACCOUNT_KEY` secret may not be configured in Google Secret Manager
2. Or the secret may not be accessible to the `toto-ai-hub` App Hosting service
3. Or the service account JSON format is incorrect

## Diagnosis Steps

### 1. Check Production Logs

After deploying toto-ai-hub, check the server logs for these messages:

**✅ Success:**
```
✅ Using toto-bo service account from Secret Manager (TOTO_BO_SERVICE_ACCOUNT_KEY)
✅ Firebase Admin SDK initialized for toto-bo (shared KB access)
   Project ID: toto-bo
📚 KnowledgeBaseService using shared Firestore instance for cross-environment KB access
✅ Loaded 28 knowledge base entries from Firestore
```

**❌ Failure (Missing Secret):**
```
⚠️ TOTO_BO_SERVICE_ACCOUNT_KEY not found in Secret Manager
   Local service account file also not found
   Shared KB will not be available - using default Firestore
```

**❌ Failure (Invalid Secret):**
```
❌ Failed to parse TOTO_BO_SERVICE_ACCOUNT_KEY: [error message]
   Please ensure the secret contains valid JSON
```

### 2. Verify Secret Configuration

**In Google Cloud Console:**

1. Go to **Secret Manager** → `toto-ai-hub` project (or the project where toto-ai-hub is deployed)
2. Check if secret `toto-bo-service-account` exists
3. Verify the secret contains:
   - Complete service account JSON for `toto-bo` project
   - Entire JSON as a **single-line string** (minified)
   - Valid JSON format

4. Check **IAM permissions**:
   - Secret should be accessible to `toto-ai-hub` App Hosting service account
   - Service account role: `Secret Manager Secret Accessor`

### 3. Verify Service Account Permissions

**In Google Cloud Console → `toto-bo` project:**

1. Go to **IAM & Admin → Service Accounts**
2. Find the service account used for `toto-ai-hub`
3. Verify it has:
   - Role: `Cloud Datastore User` (for Firestore access)
   - Access to `knowledge_base` collection

## Solution

### Option 1: Create/Update Secret (Recommended)

1. **Get Production Service Account:**
   - Download `toto-bo-firebase-adminsdk-fbsvc-138f229598.json` from toto-bo project
   - Or create a new service account in `toto-bo` project

2. **Create Secret in Secret Manager:**
   ```bash
   # Using gcloud CLI
   gcloud secrets create toto-bo-service-account \
     --project=toto-ai-hub \
     --data-file=toto-bo-firebase-adminsdk-fbsvc-138f229598.json
   ```

   Or manually:
   - Go to Secret Manager in `toto-ai-hub` project
   - Create secret: `toto-bo-service-account`
   - Copy entire JSON content (minified, single line)
   - Paste as secret value

3. **Grant Access:**
   ```bash
   # Grant access to App Hosting service account
   gcloud secrets add-iam-policy-binding toto-bo-service-account \
     --project=toto-ai-hub \
     --member="serviceAccount:toto-ai-hub@appspot.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

4. **Redeploy toto-ai-hub:**
   ```bash
   cd toto-ai-hub
   git push origin main
   ```

### Option 2: Verify Migration

If the secret is configured but KB still shows 0 entries:

1. **Verify Migration:**
   ```bash
   cd toto-ai-hub
   npx ts-node scripts/migrate-knowledge-base.ts toto-bo
   ```
   
   Should show: `✅ Migration completed! - Added: 27 - Updated: 1`

2. **Check Firestore:**
   - Go to Firebase Console → `toto-bo` project
   - Firestore Database → `knowledge_base` collection
   - Should see 28 documents

## Testing

After fixing the secret:

1. **Check Production Logs:**
   - Look for initialization messages
   - Verify `sharedKbFirestore` is available

2. **Test Endpoint:**
   ```bash
   curl https://toto-ai-hub-backend--toto-ai-hub.us-central1.hosted.app/api/ai/knowledge
   ```
   
   Should return array of 28 KB entries

3. **Check UI:**
   - Production toto-bo: `https://bo.betoto.pet/dashboard/ai-hub/knowledge`
   - Should show 28 entries

## Enhanced Logging

The enhanced logging will show:
- Whether `sharedKbFirestore` is available
- Whether `KnowledgeBaseService` initialized successfully
- How many entries were loaded
- Specific error messages if initialization fails

## Quick Fix Checklist

- [ ] Secret `toto-bo-service-account` exists in Secret Manager (`toto-ai-hub` project)
- [ ] Secret contains complete `toto-bo` service account JSON (minified)
- [ ] Secret is accessible to App Hosting service account
- [ ] Service account has `Cloud Datastore User` role in `toto-bo` project
- [ ] Migration completed (28 entries in `toto-bo` Firestore)
- [ ] toto-ai-hub redeployed after secret configuration
- [ ] Production logs show successful KB initialization


