# Knowledge Base Staging Troubleshooting

## Issue
toto-bo Knowledge Base UI in staging shows 0 entries, but works locally.

## Root Cause Analysis

### Data Migration
- ✅ Migration script ran successfully locally
- ✅ 28 entries migrated to Firestore `toto-f9d2f-stg` project
- ✅ Local API endpoint returns 28 entries

### Potential Issues

1. **Staging Backend Not Restarted**
   - The toto-ai-hub backend in staging needs to be restarted/redeployed after migration
   - The KnowledgeBaseService initializes on server startup
   - If the backend was deployed before migration, it won't have the data

2. **Firebase Project Mismatch**
   - Migration used `toto-f9d2f-stg` Firestore project
   - Staging backend must be configured to use the same project
   - Check `TOTO_APP_STG_SERVICE_ACCOUNT_KEY` environment variable

3. **Initialization Error**
   - Added enhanced logging to diagnose initialization failures
   - Check Cloud Run logs for error messages

## Solution Steps

### Step 1: Verify Data in Firestore
1. Go to Firebase Console → Firestore
2. Select `toto-f9d2f-stg` project
3. Check `knowledge_base` collection
4. Should see 28 documents

### Step 2: Check Staging Backend Logs
1. Go to Cloud Run → toto-ai-hub-backend
2. Check logs for:
   - `📚 Initializing Knowledge Base Service...`
   - `✅ Loaded X knowledge base entries from Firestore`
   - Any error messages

### Step 3: Redeploy toto-ai-hub
The staging backend needs to be redeployed to:
- Pick up the new logging code
- Reinitialize the KnowledgeBaseService
- Load data from Firestore

### Step 4: Test API Endpoint
```bash
# Test staging endpoint directly
curl https://toto-ai-hub-backend--toto-ai-hub.us-central1.hosted.app/api/ai/knowledge
```

Should return array of 28 entries.

## Enhanced Logging Added

### Server.js
- Added logging in `/api/ai/knowledge` endpoint
- Added logging in API Gateway initialization

### KnowledgeBaseService.ts
- Added Firestore connection diagnostics
- Added document count logging
- Added error details with project ID

## Next Steps

1. **Redeploy toto-ai-hub to staging**
   - This will trigger reinitialization
   - Check logs for initialization messages

2. **Verify API endpoint**
   - Test `/api/ai/knowledge` directly
   - Should return 28 entries

3. **Check toto-bo staging**
   - Verify `TOTO_AI_HUB_URL` environment variable is set correctly
   - Check browser console for API errors
   - Verify network tab shows successful API call

## Expected Behavior

After redeployment:
- Server logs should show: `✅ Loaded 28 knowledge base entries from Firestore`
- API endpoint should return 28 entries
- toto-bo UI should display all entries

## If Still Not Working

1. Check Cloud Run logs for initialization errors
2. Verify Firebase Admin SDK is initialized correctly
3. Verify service account has Firestore read permissions
4. Check if there are multiple Firestore projects being used

