# Manual Setup Instructions for toto-bo-service-account Secret

## Prerequisites

1. Ensure you're authenticated with gcloud:
   ```bash
   gcloud auth login
   ```

2. Set the project:
   ```bash
   gcloud config set project toto-ai-hub
   ```

## Step 1: Create the Secret

```powershell
# Navigate to toto-ai-hub directory
cd C:\Users\tcost\VS\toto\toto-ai-hub

# Read and minify the service account JSON
$serviceAccountJson = Get-Content "..\toto-bo\toto-bo-firebase-adminsdk-fbsvc-138f229598.json" -Raw | ConvertFrom-Json | ConvertTo-Json -Compress

# Create the secret
echo $serviceAccountJson | gcloud secrets create toto-bo-service-account --data-file=- --project=toto-ai-hub
```

If the secret already exists and you want to update it:
```powershell
echo $serviceAccountJson | gcloud secrets versions add toto-bo-service-account --data-file=- --project=toto-ai-hub
```

## Step 2: Grant Access to App Hosting

### Option A: Using Firebase CLI (Recommended)

```bash
firebase apphosting:secrets:grantaccess toto-bo-service-account --backend toto-ai-hub-backend --project toto-ai-hub
```

### Option B: Using gcloud IAM

First, get the project number:
```bash
gcloud projects describe toto-ai-hub --format='value(projectNumber)'
```

Then grant access (replace PROJECT_NUMBER with the actual number):
```bash
gcloud secrets add-iam-policy-binding toto-bo-service-account \
    --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-firebaseapphosting.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=toto-ai-hub
```

## Step 3: Verify

```bash
# Check if secret exists
gcloud secrets describe toto-bo-service-account --project=toto-ai-hub

# Check IAM permissions
gcloud secrets get-iam-policy toto-bo-service-account --project=toto-ai-hub
```

## Summary

✅ **Secret Name**: `toto-bo-service-account`  
✅ **Project**: `toto-ai-hub`  
✅ **Backend**: `toto-ai-hub-backend`  
✅ **YAML**: Already configured in `apphosting.yaml`

