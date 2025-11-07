#!/usr/bin/env node

/**
 * Diagnostic script to check if social media posts are saved in Firestore
 * and can be retrieved
 */

require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function checkPosts() {
  console.log('🔍 Checking social media posts in Firestore...\n');

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
      console.log('⚠️ No toto-bo service account found');
      return;
    }
  }

  const projectId = totoBoServiceAccount.project_id || 'unknown';
  console.log(`📦 Project ID: ${projectId}\n`);

  // Initialize Firebase Admin
  try {
    let app;
    try {
      app = admin.app('toto-bo');
      console.log('✅ toto-bo app already initialized');
    } catch {
      app = admin.initializeApp({
        credential: admin.credential.cert(totoBoServiceAccount),
        projectId: projectId
      }, 'toto-bo');
      console.log('✅ Initialized toto-bo app');
    }

    const db = admin.firestore(app);
    
    // Query posts
    console.log('\n📋 Querying socialMediaPosts collection...');
    const postsSnapshot = await db.collection('socialMediaPosts')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    console.log(`\n📊 Found ${postsSnapshot.size} posts in database\n`);

    if (postsSnapshot.size === 0) {
      console.log('⚠️ No posts found in database!');
      console.log('   This could mean:');
      console.log('   1. Posts are being saved to a different database/project');
      console.log('   2. Posts haven\'t been saved yet');
      console.log('   3. There\'s a permissions issue');
      return;
    }

    // Show sample posts
    console.log('📝 Sample posts:');
    postsSnapshot.docs.slice(0, 5).forEach((doc, index) => {
      const data = doc.data();
      let createdAtStr = 'unknown';
      try {
        const createdAt = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
        if (createdAt && !isNaN(createdAt.getTime())) {
          createdAtStr = createdAt.toISOString();
        }
      } catch (e) {
        createdAtStr = String(data.createdAt || 'invalid date');
      }
      console.log(`\n   ${index + 1}. Post ID: ${doc.id}`);
      console.log(`      Platform: ${data.platform || 'unknown'}`);
      console.log(`      Guardian: ${data.guardianName || data.guardianId || 'unknown'}`);
      console.log(`      Status: ${data.status || 'unknown'}`);
      console.log(`      Created: ${createdAtStr}`);
      console.log(`      Content: ${(data.postContent || '').substring(0, 60)}...`);
    });

    // Check for recent posts (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentPosts = postsSnapshot.docs.filter(doc => {
      const createdAt = doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt || 0);
      return createdAt >= oneHourAgo;
    });

    console.log(`\n⏰ Posts created in the last hour: ${recentPosts.length}`);

    // Check status distribution
    const statusCounts = {};
    postsSnapshot.docs.forEach(doc => {
      const status = doc.data().status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('\n📊 Status distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'permission-denied') {
      console.error('   Permission denied - check service account permissions');
    } else if (error.code === 'failed-precondition') {
      console.error('   Missing Firestore index - check error message for index creation link');
    }
    console.error('   Stack:', error.stack);
  }
}

checkPosts().catch(console.error);

