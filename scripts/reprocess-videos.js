#!/usr/bin/env node

/**
 * Script to reprocess existing posts and migrate videos from Instagram CDN to Firebase Storage
 * This updates posts that were created before video storage was implemented
 * 
 * Usage: node scripts/reprocess-videos.js [staging|production]
 * Default: staging
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Determine environment
const env = process.argv[2] || 'staging';
const isStaging = env === 'staging';

// Initialize Firebase Admin
const stagingServiceAccountPath = path.join(__dirname, '../toto-bo-stg-firebase-adminsdk-fbsvc-369557e118.json');
const productionServiceAccountPath = path.join(__dirname, '../toto-bo-firebase-adminsdk-fbsvc-138f229598.json');

let serviceAccountPath;
let projectId;
let storageBucket;
let appName;

if (isStaging) {
  serviceAccountPath = stagingServiceAccountPath;
  projectId = 'toto-bo-stg';
  storageBucket = 'toto-bo-stg.firebasestorage.app';
  appName = 'toto-bo-stg';
} else {
  serviceAccountPath = productionServiceAccountPath;
  projectId = 'toto-bo';
  storageBucket = 'toto-bo.firebasestorage.app';
  appName = 'toto-bo';
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Service account file not found: ${serviceAccountPath}`);
  console.error(`   Environment: ${env}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

console.log(`🔧 Initializing Firebase Admin for ${env} (${projectId})`);

// Initialize Firebase Admin
const totoBoApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: projectId,
  storageBucket: storageBucket
}, appName);

const db = admin.firestore(totoBoApp);
const storage = admin.storage(totoBoApp);
const bucket = storage.bucket(storageBucket);

// Helper function to detect if URL is a video
function isVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('.mp4') || 
         lowerUrl.includes('video') || 
         lowerUrl.includes('/o1/v/t2/f2/') ||
         lowerUrl.includes('cdninstagram.com');
}

// Helper function to detect if URL is from Instagram CDN
function isInstagramCDN(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('cdninstagram.com');
}

// Process and upload video
async function processAndUploadVideo(videoUrl, platform, postId, index) {
  try {
    console.log(`📹 Downloading video ${index} from: ${videoUrl.substring(0, 80)}...`);
    
    // Use node-fetch or built-in fetch (Node.js 18+)
    let fetch;
    try {
      fetch = (await import('node-fetch')).default;
    } catch {
      // Node.js 18+ has built-in fetch
      fetch = globalThis.fetch;
    }
    
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      console.error(`⚠️ Video download failed: ${videoResponse.status}`);
      return null;
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    const videoSize = videoBuffer.length;
    console.log(`📹 Video downloaded: ${(videoSize / 1024 / 1024).toFixed(2)} MB`);

    // Determine file extension
    const contentType = videoResponse.headers.get('content-type') || 'video/mp4';
    let fileExtension = 'mp4';
    if (contentType.includes('webm')) {
      fileExtension = 'webm';
    } else if (contentType.includes('quicktime') || contentType.includes('mov')) {
      fileExtension = 'mov';
    } else if (videoUrl.toLowerCase().includes('.webm')) {
      fileExtension = 'webm';
    } else if (videoUrl.toLowerCase().includes('.mov')) {
      fileExtension = 'mov';
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `social-media-posts/${platform}/${postId}/${timestamp}_${index}.${fileExtension}`;

    // Upload to Firebase Storage
    const fileUpload = bucket.file(fileName);
    const { randomUUID } = require('crypto');
    const downloadToken = randomUUID();

    await fileUpload.save(videoBuffer, {
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          originalFormat: contentType,
          uploadedAt: new Date().toISOString(),
          platform,
          postId,
          mediaType: 'video',
          migrated: 'true' // Mark as migrated
        }
      }
    });

    // Generate public URL
    const encodedFileName = encodeURIComponent(fileName);
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedFileName}?alt=media&token=${downloadToken}`;

    console.log(`✅ Video uploaded to: ${fileName}`);
    return { url: publicUrl, fileName };
  } catch (error) {
    console.error(`❌ Error processing video:`, error.message);
    return null;
  }
}

// Main reprocessing function
async function reprocessPosts() {
  try {
    console.log('🔍 Fetching all social media posts...');
    const postsSnapshot = await db.collection('socialMediaPosts').get();
    
    if (postsSnapshot.empty) {
      console.log('✅ No posts found');
      return;
    }

    console.log(`📋 Found ${postsSnapshot.size} posts to check`);
    
    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const doc of postsSnapshot.docs) {
      const post = doc.data();
      const postId = doc.id;
      
      if (!post.images || !Array.isArray(post.images) || post.images.length === 0) {
        continue;
      }

      // Check if any images are Instagram CDN videos
      const instagramCDNVideos = post.images.filter(url => 
        isVideoUrl(url) && isInstagramCDN(url)
      );

      if (instagramCDNVideos.length === 0) {
        continue; // No Instagram CDN videos to migrate
      }

      processedCount++;
      console.log(`\n📝 Processing post ${postId} (${post.platform})`);
      console.log(`   Found ${instagramCDNVideos.length} Instagram CDN video(s) to migrate`);

      const updatedImages = [...post.images];
      const updatedFileNames = [...(post.imageFileNames || [])];
      let hasUpdates = false;

      // Process each Instagram CDN video
      for (let i = 0; i < post.images.length; i++) {
        const url = post.images[i];
        if (isVideoUrl(url) && isInstagramCDN(url)) {
          const result = await processAndUploadVideo(
            url,
            post.platform,
            post.postId,
            i
          );

          if (result) {
            updatedImages[i] = result.url;
            updatedFileNames.push(result.fileName);
            hasUpdates = true;
            console.log(`   ✅ Migrated video ${i + 1}/${instagramCDNVideos.length}`);
          } else {
            console.log(`   ⚠️ Failed to migrate video ${i + 1}, keeping original URL`);
          }
        }
      }

      // Update post if any videos were migrated
      if (hasUpdates) {
        try {
          await db.collection('socialMediaPosts').doc(postId).update({
            images: updatedImages,
            imageFileNames: updatedFileNames,
            videoMigrated: true,
            videoMigratedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          updatedCount++;
          console.log(`   ✅ Post updated successfully`);
        } catch (updateError) {
          console.error(`   ❌ Error updating post:`, updateError.message);
          errorCount++;
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Posts checked: ${postsSnapshot.size}`);
    console.log(`   Posts with Instagram CDN videos: ${processedCount}`);
    console.log(`   Posts successfully updated: ${updatedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log('\n✅ Migration complete!');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

// Run migration
reprocessPosts()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

