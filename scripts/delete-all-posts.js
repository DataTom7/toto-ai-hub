#!/usr/bin/env node

/**
 * Script to delete all social media posts from both production and staging databases
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function deleteAllPosts() {
  console.log('🗑️  Deleting all social media posts from both databases...\n');

  const results = {
    production: { deleted: 0, errors: [] },
    staging: { deleted: 0, errors: [] }
  };

  // Delete from PRODUCTION (toto-bo)
  try {
    console.log('📦 Connecting to PRODUCTION database (toto-bo)...');
    const prodServiceAccountPath = path.join(__dirname, '..', 'toto-bo-firebase-adminsdk-fbsvc-138f229598.json');
    
    if (!fs.existsSync(prodServiceAccountPath)) {
      console.log('⚠️  Production service account file not found, skipping production database');
    } else {
      const prodServiceAccount = JSON.parse(fs.readFileSync(prodServiceAccountPath, 'utf8'));
      
      let prodApp;
      try {
        prodApp = admin.app('toto-bo-prod-delete');
      } catch {
        prodApp = admin.initializeApp({
          credential: admin.credential.cert(prodServiceAccount),
          projectId: 'toto-bo'
        }, 'toto-bo-prod-delete');
      }

      const prodDb = admin.firestore(prodApp);
      
      console.log('   Querying posts...');
      const prodSnapshot = await prodDb.collection('socialMediaPosts').get();
      console.log(`   Found ${prodSnapshot.size} posts in production`);
      
      if (prodSnapshot.size > 0) {
        const batch = prodDb.batch();
        let batchCount = 0;
        const batchSize = 500; // Firestore batch limit
        
        for (const doc of prodSnapshot.docs) {
          batch.delete(doc.ref);
          batchCount++;
          
          if (batchCount >= batchSize) {
            await batch.commit();
            results.production.deleted += batchCount;
            console.log(`   Deleted batch of ${batchCount} posts...`);
            batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
          results.production.deleted += batchCount;
          console.log(`   Deleted final batch of ${batchCount} posts`);
        }
        
        console.log(`   ✅ Deleted ${results.production.deleted} posts from production\n`);
      } else {
        console.log('   ℹ️  No posts to delete in production\n');
      }
    }
  } catch (error) {
    console.error(`   ❌ Error deleting from production: ${error.message}`);
    results.production.errors.push(error.message);
  }

  // Delete from STAGING (toto-bo-stg)
  try {
    console.log('📦 Connecting to STAGING database (toto-bo-stg)...');
    const stgServiceAccountPath = path.join(__dirname, '..', 'toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');
    
    if (!fs.existsSync(stgServiceAccountPath)) {
      console.log('⚠️  Staging service account file not found, skipping staging database');
    } else {
      const stgServiceAccount = JSON.parse(fs.readFileSync(stgServiceAccountPath, 'utf8'));
      
      let stgApp;
      try {
        stgApp = admin.app('toto-bo-stg-delete');
      } catch {
        stgApp = admin.initializeApp({
          credential: admin.credential.cert(stgServiceAccount),
          projectId: 'toto-bo-stg'
        }, 'toto-bo-stg-delete');
      }

      const stgDb = admin.firestore(stgApp);
      
      console.log('   Querying posts...');
      const stgSnapshot = await stgDb.collection('socialMediaPosts').get();
      console.log(`   Found ${stgSnapshot.size} posts in staging`);
      
      if (stgSnapshot.size > 0) {
        const batch = stgDb.batch();
        let batchCount = 0;
        const batchSize = 500; // Firestore batch limit
        
        for (const doc of stgSnapshot.docs) {
          batch.delete(doc.ref);
          batchCount++;
          
          if (batchCount >= batchSize) {
            await batch.commit();
            results.staging.deleted += batchCount;
            console.log(`   Deleted batch of ${batchCount} posts...`);
            batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
          results.staging.deleted += batchCount;
          console.log(`   Deleted final batch of ${batchCount} posts`);
        }
        
        console.log(`   ✅ Deleted ${results.staging.deleted} posts from staging\n`);
      } else {
        console.log('   ℹ️  No posts to delete in staging\n');
      }
    }
  } catch (error) {
    console.error(`   ❌ Error deleting from staging: ${error.message}`);
    results.staging.errors.push(error.message);
  }

  // Summary
  console.log('📊 Summary:');
  console.log(`   Production: ${results.production.deleted} posts deleted`);
  if (results.production.errors.length > 0) {
    console.log(`   Production errors: ${results.production.errors.join(', ')}`);
  }
  console.log(`   Staging: ${results.staging.deleted} posts deleted`);
  if (results.staging.errors.length > 0) {
    console.log(`   Staging errors: ${results.staging.errors.join(', ')}`);
  }
  console.log(`\n✅ Total deleted: ${results.production.deleted + results.staging.deleted} posts`);
  
  // Clean up apps
  try {
    await admin.app('toto-bo-prod-delete').delete();
  } catch {}
  try {
    await admin.app('toto-bo-stg-delete').delete();
  } catch {}
}

deleteAllPosts().catch(console.error);

