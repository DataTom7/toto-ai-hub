/**
 * Script to check if the service account has all necessary Storage permissions
 * 
 * This script verifies that the service account can:
 * - Read bucket metadata
 * - Upload files
 * - Delete files
 * - Read files
 */

const admin = require('firebase-admin');
const path = require('path');

// Load service account
let totoBoServiceAccount;
let projectId = 'toto-bo-stg';
let bucketName = 'toto-bo-stg.appspot.com';

try {
  // Try to load from environment variable first
  if (process.env.TOTO_BO_SERVICE_ACCOUNT_KEY) {
    totoBoServiceAccount = JSON.parse(process.env.TOTO_BO_SERVICE_ACCOUNT_KEY);
    projectId = totoBoServiceAccount.project_id || projectId;
    console.log('✅ Using service account from TOTO_BO_SERVICE_ACCOUNT_KEY');
  } else {
    // Fallback to file
    const serviceAccountPath = path.join(__dirname, '../toto-bo-firebase-adminsdk-fbsvc-138f229598.json');
    if (require('fs').existsSync(serviceAccountPath)) {
      totoBoServiceAccount = require(serviceAccountPath);
      projectId = totoBoServiceAccount.project_id || projectId;
      console.log('✅ Using service account from local file');
    } else {
      console.error('❌ No service account found');
      console.error('   Set TOTO_BO_SERVICE_ACCOUNT_KEY or provide service account file');
      process.exit(1);
    }
  }
} catch (error) {
  console.error('❌ Failed to load service account:', error.message);
  process.exit(1);
}

console.log(`\n📋 Service Account Information:`);
console.log(`   Email: ${totoBoServiceAccount.client_email}`);
console.log(`   Project ID: ${projectId}`);
console.log(`   Bucket: ${bucketName}`);

// Initialize Firebase Admin
let app;
try {
  app = admin.initializeApp({
    credential: admin.credential.cert(totoBoServiceAccount),
    projectId: projectId,
    storageBucket: bucketName
  }, 'storage-permission-checker');
  console.log('\n✅ Firebase Admin initialized');
} catch (error) {
  if (error.code === 'app/duplicate-app') {
    app = admin.app('storage-permission-checker');
    console.log('\n✅ Using existing Firebase Admin app');
  } else {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
  }
}

const storage = admin.storage(app);
const bucket = storage.bucket(bucketName);

// Test results
const results = {
  bucketExists: false,
  canReadBucket: false,
  canUploadFile: false,
  canReadFile: false,
  canDeleteFile: false,
  errors: []
};

async function checkPermissions() {
  console.log(`\n🔍 Checking Storage permissions for bucket: ${bucketName}\n`);

  // Test 1: Check if bucket exists and can read metadata
  console.log('1️⃣  Testing: Read bucket metadata...');
  try {
    const [metadata] = await bucket.getMetadata();
    results.bucketExists = true;
    results.canReadBucket = true;
    console.log(`   ✅ SUCCESS - Bucket exists and is accessible`);
    console.log(`      Location: ${metadata.location}`);
    console.log(`      Storage Class: ${metadata.storageClass}`);
  } catch (error) {
    results.errors.push({ test: 'Read bucket metadata', error: error.message, code: error.code });
    if (error.code === 404) {
      console.log(`   ❌ FAILED - Bucket does not exist: ${bucketName}`);
      console.log(`      Action: Create the bucket in Firebase Console`);
    } else if (error.code === 403) {
      console.log(`   ❌ FAILED - Permission denied`);
      console.log(`      Required permission: storage.buckets.get`);
    } else {
      console.log(`   ❌ FAILED - ${error.message} (code: ${error.code})`);
    }
  }

  if (!results.bucketExists) {
    console.log(`\n⚠️  Bucket does not exist. Skipping file operation tests.`);
    printPermissionRequirements();
    return;
  }

  // Test 2: Upload a test file
  console.log('\n2️⃣  Testing: Upload file...');
  const testFileName = `permission-test-${Date.now()}.txt`;
  const testFile = bucket.file(testFileName);
  
  try {
    await testFile.save('This is a test file for permission checking', {
      metadata: {
        contentType: 'text/plain',
        metadata: {
          purpose: 'permission-test',
          createdAt: new Date().toISOString()
        }
      }
    });
    results.canUploadFile = true;
    console.log(`   ✅ SUCCESS - File uploaded: ${testFileName}`);
  } catch (error) {
    results.errors.push({ test: 'Upload file', error: error.message, code: error.code });
    if (error.code === 403) {
      console.log(`   ❌ FAILED - Permission denied`);
      console.log(`      Required permission: storage.objects.create`);
    } else {
      console.log(`   ❌ FAILED - ${error.message} (code: ${error.code})`);
    }
  }

  // Test 3: Read the test file
  console.log('\n3️⃣  Testing: Read file...');
  try {
    const [exists] = await testFile.exists();
    if (exists) {
      const [metadata] = await testFile.getMetadata();
      results.canReadFile = true;
      console.log(`   ✅ SUCCESS - File is readable`);
      console.log(`      Size: ${metadata.size} bytes`);
    } else {
      console.log(`   ⚠️  File does not exist (upload may have failed)`);
    }
  } catch (error) {
    results.errors.push({ test: 'Read file', error: error.message, code: error.code });
    if (error.code === 403) {
      console.log(`   ❌ FAILED - Permission denied`);
      console.log(`      Required permission: storage.objects.get`);
    } else {
      console.log(`   ❌ FAILED - ${error.message} (code: ${error.code})`);
    }
  }

  // Test 4: Delete the test file
  console.log('\n4️⃣  Testing: Delete file...');
  try {
    await testFile.delete();
    results.canDeleteFile = true;
    console.log(`   ✅ SUCCESS - File deleted: ${testFileName}`);
  } catch (error) {
    results.errors.push({ test: 'Delete file', error: error.message, code: error.code });
    if (error.code === 403) {
      console.log(`   ❌ FAILED - Permission denied`);
      console.log(`      Required permission: storage.objects.delete`);
    } else if (error.code === 404) {
      console.log(`   ⚠️  File not found (may have been deleted already)`);
    } else {
      console.log(`   ❌ FAILED - ${error.message} (code: ${error.code})`);
    }
  }

  // Summary
  console.log(`\n📊 Permission Check Summary:`);
  console.log(`   Bucket exists: ${results.bucketExists ? '✅' : '❌'}`);
  console.log(`   Can read bucket: ${results.canReadBucket ? '✅' : '❌'}`);
  console.log(`   Can upload files: ${results.canUploadFile ? '✅' : '❌'}`);
  console.log(`   Can read files: ${results.canReadFile ? '✅' : '❌'}`);
  console.log(`   Can delete files: ${results.canDeleteFile ? '✅' : '❌'}`);

  const allPassed = results.bucketExists && 
                   results.canReadBucket && 
                   results.canUploadFile && 
                   results.canReadFile && 
                   results.canDeleteFile;

  if (allPassed) {
    console.log(`\n✅ All permissions are correctly configured!`);
  } else {
    console.log(`\n⚠️  Some permissions are missing. See requirements below.`);
    printPermissionRequirements();
  }

  if (results.errors.length > 0) {
    console.log(`\n❌ Errors encountered:`);
    results.errors.forEach(err => {
      console.log(`   - ${err.test}: ${err.error} (code: ${err.code})`);
    });
  }
}

function printPermissionRequirements() {
  console.log(`\n📋 Required IAM Roles for Service Account:`);
  console.log(`\n   Service Account: ${totoBoServiceAccount.client_email}`);
  console.log(`   Project: ${projectId}`);
  console.log(`\n   Minimum Required Role: Storage Object Admin`);
  console.log(`   Role ID: roles/storage.objectAdmin`);
  console.log(`\n   This role includes:`);
  console.log(`   - storage.objects.create (upload files)`);
  console.log(`   - storage.objects.delete (delete files)`);
  console.log(`   - storage.objects.get (read files)`);
  console.log(`   - storage.objects.list (list files)`);
  console.log(`   - storage.objects.update (update file metadata)`);
  console.log(`\n   Optional (for bucket management): Storage Admin`);
  console.log(`   Role ID: roles/storage.admin`);
  console.log(`   (Only needed if you want to create/manage buckets)`);
  
  console.log(`\n🔧 How to Grant Permissions:`);
  console.log(`\n   1. Go to Google Cloud Console:`);
  console.log(`      https://console.cloud.google.com/iam-admin/iam?project=${projectId}`);
  console.log(`\n   2. Find the service account: ${totoBoServiceAccount.client_email}`);
  console.log(`\n   3. Click the pencil icon (Edit) next to the service account`);
  console.log(`\n   4. Click "ADD ANOTHER ROLE"`);
  console.log(`\n   5. Select: "Storage Object Admin" (roles/storage.objectAdmin)`);
  console.log(`\n   6. Click "SAVE"`);
  console.log(`\n   OR use gcloud CLI:`);
  console.log(`   gcloud projects add-iam-policy-binding ${projectId} \\`);
  console.log(`     --member="serviceAccount:${totoBoServiceAccount.client_email}" \\`);
  console.log(`     --role="roles/storage.objectAdmin"`);
}

// Run the checks
checkPermissions()
  .then(() => {
    console.log('\n✅ Permission check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Permission check failed:', error);
    process.exit(1);
  });

