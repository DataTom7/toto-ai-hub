/**
 * Script to create the staging Storage bucket for toto-bo-stg
 * 
 * This script creates the bucket 'toto-bo-stg.appspot.com' in the toto-bo-stg Firebase project
 */

const admin = require('firebase-admin');
const path = require('path');

// Load staging service account
let totoBoStgServiceAccount;
try {
  // Try to load from environment variable first
  if (process.env.TOTO_BO_STG_SERVICE_ACCOUNT_KEY) {
    totoBoStgServiceAccount = JSON.parse(process.env.TOTO_BO_STG_SERVICE_ACCOUNT_KEY);
  } else {
    // Fallback to file
    const serviceAccountPath = path.join(__dirname, '../toto-f9d2f-stg-firebase-adminsdk-fbsvc-d4bdd9b852.json');
    totoBoStgServiceAccount = require(serviceAccountPath);
  }
} catch (error) {
  console.error('❌ Failed to load toto-bo-stg service account:', error.message);
  console.error('   Make sure TOTO_BO_STG_SERVICE_ACCOUNT_KEY is set or the service account file exists');
  process.exit(1);
}

// Initialize Firebase Admin with toto-bo-stg project
let totoBoStgApp;
try {
  totoBoStgApp = admin.initializeApp({
    credential: admin.credential.cert(totoBoStgServiceAccount),
    projectId: 'toto-bo-stg',
    storageBucket: 'toto-bo-stg.appspot.com'
  }, 'toto-bo-stg-bucket-creator');
  console.log('✅ Firebase Admin initialized for toto-bo-stg');
} catch (error) {
  if (error.code === 'app/duplicate-app') {
    totoBoStgApp = admin.app('toto-bo-stg-bucket-creator');
    console.log('✅ Using existing Firebase Admin app');
  } else {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
  }
}

async function createBucket() {
  try {
    const storage = admin.storage(totoBoStgApp);
    const bucketName = 'toto-bo-stg.appspot.com';
    
    console.log(`\n🔍 Checking if bucket '${bucketName}' exists...`);
    
    // Try to get the bucket
    const bucket = storage.bucket(bucketName);
    
    // Check if bucket exists by trying to get its metadata
    try {
      const [metadata] = await bucket.getMetadata();
      console.log(`✅ Bucket '${bucketName}' already exists!`);
      console.log(`   Location: ${metadata.location}`);
      console.log(`   Storage Class: ${metadata.storageClass}`);
      return;
    } catch (error) {
      if (error.code === 404) {
        console.log(`📦 Bucket '${bucketName}' does not exist. Creating...`);
      } else {
        throw error;
      }
    }
    
    // Create the bucket
    console.log(`\n🚀 Creating bucket '${bucketName}'...`);
    const [createdBucket] = await bucket.create({
      location: 'us-central1', // Default location, adjust if needed
      storageClass: 'STANDARD'
    });
    
    console.log(`✅ Successfully created bucket '${createdBucket.name}'!`);
    console.log(`   Location: ${createdBucket.metadata.location}`);
    console.log(`   Storage Class: ${createdBucket.metadata.storageClass}`);
    
    // Set public access (optional - adjust based on your needs)
    console.log(`\n🔐 Setting up bucket permissions...`);
    await bucket.makePublic();
    console.log(`✅ Bucket is now publicly accessible`);
    
    console.log(`\n✅ Bucket setup complete!`);
    
  } catch (error) {
    console.error(`\n❌ Error creating bucket:`, error.message);
    if (error.code === 409) {
      console.error('   Bucket already exists (this is okay)');
    } else if (error.code === 403) {
      console.error('   Permission denied. Make sure the service account has Storage Admin role');
    } else {
      console.error('   Error details:', error);
    }
    process.exit(1);
  }
}

// Run the script
createBucket()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

