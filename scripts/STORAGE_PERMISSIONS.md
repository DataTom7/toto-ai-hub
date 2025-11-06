# Storage Permissions Guide

This document explains what permissions the service account needs for Storage operations in `toto-ai-hub`.

## Required Permissions

### Minimum Required Role: **Storage Object Admin**

**Role ID:** `roles/storage.objectAdmin`

This role provides all permissions needed for day-to-day storage operations:

- ✅ `storage.objects.create` - Upload files (images)
- ✅ `storage.objects.delete` - Delete files (cleanup)
- ✅ `storage.objects.get` - Read files and metadata
- ✅ `storage.objects.list` - List files in bucket
- ✅ `storage.objects.update` - Update file metadata

### Optional Role: **Storage Admin**

**Role ID:** `roles/storage.admin`

Only needed if you want to:
- Create new buckets
- Manage bucket settings
- Set bucket-level permissions

**Note:** For normal operations, you only need `Storage Object Admin`.

## Service Accounts by Environment

### Staging Environment

**Service Account:** `firebase-adminsdk-fbsvc@toto-bo-stg.iam.gserviceaccount.com`  
**Project:** `toto-bo-stg`  
**Bucket:** `toto-bo-stg.appspot.com`

### Production Environment

**Service Account:** `firebase-adminsdk-fbsvc@toto-bo.iam.gserviceaccount.com`  
**Project:** `toto-bo`  
**Bucket:** `toto-bo.appspot.com`

## How to Grant Permissions

### Method 1: Google Cloud Console (Recommended)

1. **Open IAM & Admin**
   - Go to: https://console.cloud.google.com/iam-admin/iam
   - Select the correct project:
     - **Staging:** `toto-bo-stg`
     - **Production:** `toto-bo`

2. **Find the Service Account**
   - Look for: `firebase-adminsdk-fbsvc@toto-bo-stg.iam.gserviceaccount.com` (staging)
   - Or: `firebase-adminsdk-fbsvc@toto-bo.iam.gserviceaccount.com` (production)

3. **Edit Permissions**
   - Click the **pencil icon (Edit)** next to the service account
   - Click **"ADD ANOTHER ROLE"**
   - Search for: `Storage Object Admin`
   - Select: `Storage Object Admin` (roles/storage.objectAdmin)
   - Click **"SAVE"**

### Method 2: gcloud CLI

**For Staging:**
```bash
gcloud projects add-iam-policy-binding toto-bo-stg \
  --member="serviceAccount:firebase-adminsdk-fbsvc@toto-bo-stg.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

**For Production:**
```bash
gcloud projects add-iam-policy-binding toto-bo \
  --member="serviceAccount:firebase-adminsdk-fbsvc@toto-bo.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

## Verify Permissions

Run the permission check script:

```bash
cd toto-ai-hub
node scripts/check-storage-permissions.js
```

This script will:
1. ✅ Check if bucket exists
2. ✅ Test reading bucket metadata
3. ✅ Test uploading a file
4. ✅ Test reading a file
5. ✅ Test deleting a file

## Common Issues

### Issue: "Permission denied" when uploading

**Solution:** Grant `Storage Object Admin` role to the service account.

### Issue: "Bucket does not exist"

**Solution:** Create the bucket in Firebase Console:
1. Go to Firebase Console → Storage
2. Click "Get started" (if first time)
3. Or manually create bucket: `toto-bo-stg.appspot.com`

### Issue: "Permission denied" when creating bucket

**Solution:** This is expected - bucket creation requires `Storage Admin` role, which is typically only for project owners. Create the bucket manually through Firebase Console instead.

## Storage Operations in toto-ai-hub

The following operations require Storage permissions:

1. **Image Upload** (`ImageService.processAndUploadImage`)
   - Downloads image from social media
   - Optimizes with sharp
   - Uploads to: `social-media-posts/{platform}/{postId}/{timestamp}_{index}.webp`
   - Requires: `storage.objects.create`

2. **Image Deletion** (`ImageService.deleteImage`)
   - Deletes images when posts are dismissed
   - Requires: `storage.objects.delete`

3. **File Metadata** (automatic)
   - Reading file metadata for URLs
   - Requires: `storage.objects.get`

## Security Best Practices

1. **Principle of Least Privilege**
   - Only grant `Storage Object Admin` (not `Storage Admin`)
   - This limits the service account to file operations only

2. **Bucket-Level Permissions**
   - Set bucket rules in Firebase Console
   - Use Firebase Storage Security Rules for fine-grained access

3. **Service Account Key Security**
   - Store keys in Secret Manager (not in code)
   - Rotate keys periodically
   - Never commit keys to git

## Quick Reference

| Operation | Required Permission | Role |
|-----------|-------------------|------|
| Upload file | `storage.objects.create` | Storage Object Admin |
| Delete file | `storage.objects.delete` | Storage Object Admin |
| Read file | `storage.objects.get` | Storage Object Admin |
| List files | `storage.objects.list` | Storage Object Admin |
| Create bucket | `storage.buckets.create` | Storage Admin |
| Manage bucket | `storage.buckets.*` | Storage Admin |

