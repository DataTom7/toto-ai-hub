# Shared Knowledge Base Setup Guide

## Quick Start

The Knowledge Base is now configured to use a **shared Firestore** (`toto-bo`) so all environments access the same KB entries.

## Setup Steps

### 1. Create/Update Firebase Secret in Secret Manager

**In Google Cloud Console**:

1. Go to `toto-bo` Firebase project
2. IAM & Admin → Service Accounts
3. Create a service account for `toto-ai-hub` (or use existing)
4. Grant roles:
   - `Cloud Datastore User` (for Firestore read/write)
5. Create key (JSON) and download
6. Store in Google Secret Manager:
   - **Secret name**: `toto-bo-service-account`
   - **Value**: Entire JSON content as a **single-line string** (no formatting)
   - **Project**: `toto-ai-hub` (or the project where toto-ai-hub is deployed)

**Important**: The entire JSON must be stored as a single string. When copying the JSON:
- Remove all line breaks
- Keep it as one continuous string
- Or use a tool to minify the JSON

**Example**:
```json
{"type":"service_account","project_id":"toto-bo","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

### 2. Update apphosting.yaml

Already done! The `apphosting.yaml` now includes:

```yaml
env:
  - variable: TOTO_BO_SERVICE_ACCOUNT_KEY
    secret: toto-bo-service-account
    availability:
      - BUILD
      - RUNTIME
```

### 3. Migrate Existing KB Entries

If you have existing KB entries in `toto-f9d2f-stg`, migrate them to the shared location:

```bash
cd toto-ai-hub
npx ts-node scripts/migrate-knowledge-base.ts toto-bo
```

This will:
- Copy all hardcoded entries to `toto-bo` Firestore
- Preserve existing entries if they exist
- Update entries with latest content

### 4. Deploy

After migration, deploy toto-ai-hub:

```bash
git add .
git commit -m "Implement shared KB architecture"
git push origin main
```

Firebase App Hosting will automatically deploy.

### 5. Verify

After deployment, check logs:

```bash
# Should see:
✅ Using toto-bo service account from environment variable
✅ Firebase Admin SDK initialized for toto-bo (shared KB access)
📚 Using shared KB Firestore (toto-bo) for cross-environment access
✅ Loaded X knowledge base entries from Firestore
```

Test API:
```bash
curl https://toto-ai-hub-backend--toto-ai-hub.us-central1.hosted.app/api/ai/knowledge
```

## Local Development

For local development, you have two options:

### Option 1: Use Secret Manager (Recommended)
Set `TOTO_BO_SERVICE_ACCOUNT_KEY` environment variable in your local `.env` file:
```bash
TOTO_BO_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"toto-bo",...}'
```

### Option 2: Use Local File (Fallback)
Copy the service account file to `toto-ai-hub` root:
```bash
cp toto-bo/toto-bo-firebase-adminsdk-fbsvc-138f229598.json toto-ai-hub/
```

The server will:
1. Try Secret Manager (environment variable) first
2. Fall back to local file if available
3. Use default Firestore if neither available

## Architecture Benefits

✅ **Single Source of Truth**: One KB for all environments  
✅ **No Duplication**: Staging and production share entries  
✅ **Consistent Behavior**: Agents work identically everywhere  
✅ **Easy Management**: Update once in toto-bo UI, available everywhere  

## Troubleshooting

### "Shared KB will not be available" warning

**Cause**: toto-bo service account not found

**Fix**:
1. Verify `TOTO_BO_SERVICE_ACCOUNT_KEY` environment variable is set
2. Check secret exists in Secret Manager
3. Verify service account has Firestore permissions

### Empty KB after migration

**Cause**: Migration targeted wrong project or failed

**Fix**:
1. Check Firebase Console → `toto-bo` → Firestore
2. Verify `knowledge_base` collection exists
3. Re-run migration script if needed

### KB not updating

**Cause**: Cache not refreshed

**Fix**:
- KB updates are real-time (no cache refresh needed)
- Check Firestore directly to verify entries exist
- Restart toto-ai-hub if needed

## Next Steps

1. ✅ Set up `toto-bo-service-account` secret in Google Secret Manager
2. ✅ Run migration script to copy KB to shared location
3. ✅ Deploy toto-ai-hub
4. ✅ Verify KB access from both staging and production
5. ✅ Test KB updates via toto-bo UI

