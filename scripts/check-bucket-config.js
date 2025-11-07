#!/usr/bin/env node

/**
 * Diagnostic script to check Storage bucket configuration
 * This helps identify which bucket is being used and if it exists
 */

require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function checkBucketConfig() {
  console.log('🔍 Checking Storage bucket configuration...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`   ENVIRONMENT: ${process.env.ENVIRONMENT || 'not set'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log('');

  // Try to load toto-bo service account
  let totoBoServiceAccount = null;
  const totoBoServiceAccountJson = process.env.TOTO_BO_SERVICE_ACCOUNT_KEY;
  
  if (totoBoServiceAccountJson) {
    try {
      totoBoServiceAccount = JSON.parse(totoBoServiceAccountJson);
      console.log('✅ Using toto-bo service account from TOTO_BO_SERVICE_ACCOUNT_KEY');
    } catch (parseError) {
      console.error('❌ Failed to parse TOTO_BO_SERVICE_ACCOUNT_KEY:', parseError.message);
    }
  } else {
    // Try local file
    const localPath = path.join(__dirname, '..', 'toto-bo-firebase-adminsdk-fbsvc-138f229598.json');
    if (fs.existsSync(localPath)) {
      const fileContent = fs.readFileSync(localPath, 'utf8');
      totoBoServiceAccount = JSON.parse(fileContent);
      console.log('✅ Using local toto-bo service account file');
    } else {
      console.log('⚠️ No toto-bo service account found (environment variable or local file)');
    }
  }

  if (!totoBoServiceAccount) {
    console.log('\n❌ Cannot proceed without service account');
    return;
  }

  const projectId = totoBoServiceAccount.project_id || 'unknown';
  console.log(`\n📦 Project ID: ${projectId}`);

  // Determine staging vs production
  const isStaging = process.env.ENVIRONMENT === 'staging' || 
                    process.env.NODE_ENV === 'staging' ||
                    projectId.includes('stg') ||
                    projectId === 'toto-bo-stg';
  
  // Use the correct bucket names - both .appspot.com and .firebasestorage.app work
  const expectedBucket = isStaging ? 'toto-bo-stg.firebasestorage.app' : 'toto-bo.firebasestorage.app';
  console.log(`   Environment: ${isStaging ? 'staging' : 'production'}`);
  console.log(`   Expected bucket: ${expectedBucket}`);
  console.log('');

  // Initialize Firebase Admin
  try {
    // Check if app already exists
    let app;
    try {
      app = admin.app('toto-bo');
      console.log('✅ toto-bo app already initialized');
    } catch {
      app = admin.initializeApp({
        credential: admin.credential.cert(totoBoServiceAccount),
        projectId: projectId,
        storageBucket: expectedBucket
      }, 'toto-bo');
      console.log('✅ Initialized toto-bo app');
    }

    const storage = admin.storage(app);
    const bucket = storage.bucket(expectedBucket);
    const bucketName = bucket.name;
    
    console.log(`\n📦 Storage Configuration:`);
    console.log(`   Bucket name: ${bucketName}`);
    console.log(`   App storageBucket option: ${app.options?.storageBucket || 'not set'}`);
    console.log('');

    // Try to check if bucket exists by attempting to get metadata
    console.log('🔍 Checking if bucket exists and is accessible...');
    try {
      const [exists] = await bucket.exists();
      if (exists) {
        console.log('✅ Bucket exists and is accessible');
        
        // Try to get bucket metadata
        try {
          const [metadata] = await bucket.getMetadata();
          console.log(`   Location: ${metadata.location || 'unknown'}`);
          console.log(`   Storage class: ${metadata.storageClass || 'unknown'}`);
        } catch (metaError) {
          console.log('⚠️ Could not retrieve bucket metadata (may not have permissions)');
        }
      } else {
        console.log(`❌ Bucket "${bucketName}" does not exist!`);
        console.log(`   Please create it in Firebase Console:`);
        console.log(`   https://console.firebase.google.com/project/${projectId}/storage`);
      }
    } catch (checkError) {
      console.log(`❌ Error checking bucket: ${checkError.message}`);
      if (checkError.code === 404 || checkError.message?.includes('not found')) {
        console.log(`   The bucket "${bucketName}" does not exist.`);
        console.log(`   Please create it in Firebase Console:`);
        console.log(`   https://console.firebase.google.com/project/${projectId}/storage`);
      } else if (checkError.code === 403 || checkError.message?.includes('permission')) {
        console.log(`   Permission denied. The service account may not have Storage permissions.`);
        console.log(`   Grant "Storage Object Admin" role to:`);
        console.log(`   ${totoBoServiceAccount.client_email}`);
      }
    }

    // Check service account permissions
    console.log('\n🔐 Service Account:');
    console.log(`   Email: ${totoBoServiceAccount.client_email}`);
    console.log(`   Project: ${totoBoServiceAccount.project_id}`);
    console.log('');
    console.log('💡 To grant Storage permissions, run:');
    console.log(`   gcloud projects add-iam-policy-binding ${projectId} \\`);
    console.log(`     --member="serviceAccount:${totoBoServiceAccount.client_email}" \\`);
    console.log(`     --role="roles/storage.objectAdmin"`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('   Stack:', error.stack);
  }
}

checkBucketConfig().catch(console.error);

