# Create Staging Storage Bucket

The staging bucket `toto-bo-stg.appspot.com` needs to be created in the Firebase Console.

## Option 1: Firebase Console (Recommended)

1. **Open Firebase Console**
   - Go to https://console.firebase.google.com/
   - Select the **toto-bo-stg** project

2. **Navigate to Storage**
   - Click on **Storage** in the left sidebar
   - If you see "Get started", click it
   - If Storage is already enabled, you'll see the buckets list

3. **Create the Bucket**
   - Click **"Get started"** or **"Add bucket"**
   - Bucket name: `toto-bo-stg.appspot.com`
   - Location: Choose `us-central1` (or your preferred region)
   - Storage class: `Standard`
   - Click **"Create"**

4. **Set Permissions (Optional)**
   - After creation, you can set public access rules if needed
   - For social media images, you may want to allow public read access

## Option 2: Firebase CLI

If you have Firebase CLI installed and are authenticated:

```bash
# Make sure you're using the correct project
firebase use toto-bo-stg

# Create the bucket using gcloud (if you have gcloud CLI)
gcloud storage buckets create gs://toto-bo-stg.appspot.com \
  --project=toto-bo-stg \
  --location=us-central1 \
  --storage-class=STANDARD
```

## Option 3: Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Select project: **toto-bo-stg**
3. Navigate to **Cloud Storage** → **Buckets**
4. Click **"Create bucket"**
5. Name: `toto-bo-stg.appspot.com`
6. Location: `us-central1`
7. Storage class: `Standard`
8. Click **"Create"**

## Verify

After creating the bucket, the script will automatically detect it on the next run. You can also verify by:

1. Checking Firebase Console → Storage
2. Running the monitoring again - the 404 errors should disappear

## Notes

- The bucket name must match exactly: `toto-bo-stg.appspot.com`
- The bucket is automatically created when you first enable Storage in Firebase Console
- If Storage is already enabled, you may need to create the bucket manually

