import * as admin from 'firebase-admin';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

// Image optimization configuration (matching toto-bo upload endpoint)
const IMAGE_CONFIG = {
  TARGET_WIDTH: 800,
  TARGET_HEIGHT: 600,
  WEBP_QUALITY: 85,
  JPEG_QUALITY: 85,
  OUTPUT_FORMAT: 'webp' as 'webp' | 'jpeg'
};

export interface ImageUploadResult {
  url: string;
  fileName: string;
  originalSize: number;
  optimizedSize: number;
}

export interface VideoUploadResult {
  url: string;
  fileName: string;
  size: number;
}

/**
 * Service for downloading, optimizing, and uploading images to Firebase Storage
 */
export class ImageService {
  /**
   * Download, optimize, and upload image to toto-bo Firebase Storage
   */
  async processAndUploadImage(
    imageUrl: string,
    platform: 'twitter' | 'instagram',
    postId: string,
    index: number
  ): Promise<ImageUploadResult | null> {
    try {
      // Skip video files - they can't be processed with sharp
      const lowerUrl = imageUrl.toLowerCase();
      if (lowerUrl.includes('.mp4') || 
          lowerUrl.includes('video') || 
          lowerUrl.includes('/o1/v/t2/f2/')) {
        // Return null to indicate this should use original URL (videos are handled separately)
        return null;
      }

      // Get toto-bo Storage bucket instance
      // getTotoBoStorage() returns a bucket instance (admin.storage().bucket())
      const getTotoBoStorage = (global as any).getTotoBoStorage as (() => ReturnType<ReturnType<typeof admin.storage>['bucket']> | null) | undefined;
      
      if (!getTotoBoStorage) {
        console.error('getTotoBoStorage not available - Firebase Admin not initialized for toto-bo');
        return null;
      }

      const bucket = getTotoBoStorage();
      if (!bucket) {
        console.error('toto-bo Storage bucket not available');
        return null;
      }

      // Log bucket name for debugging
      const bucketName = bucket.name;
      console.log(`📦 Attempting to upload to bucket: ${bucketName}`);
      console.log(`   📥 Processing image [${index}]: ${imageUrl.substring(0, 100)}${imageUrl.length > 100 ? '...' : ''}`);

      // Download image
      console.log(`3. Image processing: downloading...`);
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        console.error(`⚠️ Image download failed: ${imageResponse.status}`);
        return null;
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const originalSize = imageBuffer.length;

      // Optimize image
      console.log(`4. Image processing: optimizing...`);
      const optimizedBuffer = await this.optimizeImage(imageBuffer);
      const optimizedSize = optimizedBuffer.length;

      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = IMAGE_CONFIG.OUTPUT_FORMAT === 'webp' ? 'webp' : 'jpg';
      const fileName = `social-media-posts/${platform}/${postId}/${timestamp}_${index}.${fileExtension}`;
      console.log(`   📝 Generated filename: ${fileName}`);

      // Upload to Firebase Storage
      // getTotoBoStorage() returns a bucket instance directly
      const fileUpload = bucket.file(fileName);
      
      const downloadToken = randomUUID();
      const contentType = IMAGE_CONFIG.OUTPUT_FORMAT === 'webp' ? 'image/webp' : 'image/jpeg';

      // Attempt to upload with better error handling
      try {
        await fileUpload.save(optimizedBuffer, {
          metadata: {
            contentType,
            metadata: {
              firebaseStorageDownloadTokens: downloadToken,
              optimized: 'true',
              originalFormat: imageResponse.headers.get('content-type') || 'unknown',
              optimizedAt: new Date().toISOString(),
              platform,
              postId
            }
          }
        });
      } catch (uploadError: any) {
        // Check if it's a bucket not found error
        if (uploadError?.code === 404 || 
            uploadError?.error?.code === 404 ||
            uploadError?.message?.includes('does not exist') ||
            uploadError?.message?.includes('not found')) {
          console.error(`❌ Storage bucket "${bucketName}" does not exist or is not accessible.`);
          console.error(`   Check that the bucket exists in Firebase Console and the service account has Storage permissions.`);
          console.error(`   Expected bucket: ${bucketName}`);
          throw new Error(`Storage bucket "${bucketName}" does not exist. Please create it in Firebase Console or check service account permissions.`);
        }
        throw uploadError; // Re-throw other errors
      }

      // Generate public URL (bucketName already defined above)
      const encodedFileName = encodeURIComponent(fileName);
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedFileName}?alt=media&token=${downloadToken}`;

      console.log(`5. Image processing: uploaded`);
      console.log(`   ✅ Uploaded: ${fileName} (${originalSize} → ${optimizedSize} bytes, ${((1 - optimizedSize/originalSize) * 100).toFixed(1)}% reduction)`);
      console.log(`   🔗 Public URL: ${publicUrl.substring(0, 100)}...`);

      return {
        url: publicUrl,
        fileName,
        originalSize,
        optimizedSize
      };
    } catch (error: any) {
      // If bucket doesn't exist or upload fails, log but return null
      // The calling code will fall back to original URL
      if (error?.error?.code === 404 && error?.error?.message?.includes('bucket')) {
        // GaxiosError format
        console.error(`Storage bucket not found. Check bucket configuration. Image will use original URL.`);
      } else if (error?.response?.data?.error?.code === 404 && error?.response?.data?.error?.message?.includes('bucket')) {
        // Alternative error format
        console.error(`Storage bucket not found. Check bucket configuration. Image will use original URL.`);
      } else if (error?.message?.includes('unsupported image format')) {
        // Video file detected during optimization
        console.error(`Video file detected, skipping optimization. Will use original URL.`);
      } else {
        console.error(`Error processing image ${imageUrl}:`, error.message || error);
      }
      return null;
    }
  }

  /**
   * Optimize image using sharp
   */
  private async optimizeImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      let sharpInstance = sharp(imageBuffer);

      // Resize image
      sharpInstance = sharpInstance.resize(IMAGE_CONFIG.TARGET_WIDTH, IMAGE_CONFIG.TARGET_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true
      });

      // Apply optimization based on output format
      if (IMAGE_CONFIG.OUTPUT_FORMAT === 'webp') {
        return await sharpInstance.webp({ quality: IMAGE_CONFIG.WEBP_QUALITY }).toBuffer();
      } else {
        return await sharpInstance.jpeg({ quality: IMAGE_CONFIG.JPEG_QUALITY }).toBuffer();
      }
    } catch (error) {
      throw new Error(`Image optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download and upload video to toto-bo Firebase Storage
   * Videos are stored as-is without optimization
   */
  async processAndUploadVideo(
    videoUrl: string,
    platform: 'twitter' | 'instagram',
    postId: string,
    index: number
  ): Promise<VideoUploadResult | null> {
    try {
      // Get toto-bo Storage bucket instance
      const getTotoBoStorage = (global as any).getTotoBoStorage as (() => ReturnType<ReturnType<typeof admin.storage>['bucket']> | null) | undefined;
      
      if (!getTotoBoStorage) {
        console.error('getTotoBoStorage not available - Firebase Admin not initialized for toto-bo');
        return null;
      }

      const bucket = getTotoBoStorage();
      if (!bucket) {
        console.error('toto-bo Storage bucket not available');
        return null;
      }

      const bucketName = bucket.name;
      console.log(`📦 Attempting to upload video to bucket: ${bucketName}`);

      // Download video
      console.log(`📹 Video processing: downloading...`);
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        console.error(`⚠️ Video download failed: ${videoResponse.status}`);
        return null;
      }

      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      const videoSize = videoBuffer.length;
      console.log(`📹 Video downloaded: ${(videoSize / 1024 / 1024).toFixed(2)} MB`);

      // Determine file extension from URL or content type
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
      const downloadToken = randomUUID();

      try {
        await fileUpload.save(videoBuffer, {
          metadata: {
            contentType,
            metadata: {
              firebaseStorageDownloadTokens: downloadToken,
              originalFormat: contentType,
              uploadedAt: new Date().toISOString(),
              platform,
              postId,
              mediaType: 'video'
            }
          }
        });
      } catch (uploadError: any) {
        if (uploadError?.code === 404 || 
            uploadError?.error?.code === 404 ||
            uploadError?.message?.includes('does not exist') ||
            uploadError?.message?.includes('not found')) {
          console.error(`❌ Storage bucket "${bucketName}" does not exist or is not accessible.`);
          console.error(`   Check that the bucket exists in Firebase Console and the service account has Storage permissions.`);
          throw new Error(`Storage bucket "${bucketName}" does not exist. Please create it in Firebase Console or check service account permissions.`);
        }
        throw uploadError;
      }

      // Generate public URL
      const encodedFileName = encodeURIComponent(fileName);
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedFileName}?alt=media&token=${downloadToken}`;

      console.log(`✅ Video processing: uploaded to ${fileName}`);

      return {
        url: publicUrl,
        fileName,
        size: videoSize
      };
    } catch (error: any) {
      console.error(`Error processing video ${videoUrl}:`, error.message || error);
      return null;
    }
  }

  /**
   * Process multiple images and return URLs
   */
  async processMultipleImages(
    imageUrls: string[],
    platform: 'twitter' | 'instagram',
    postId: string
  ): Promise<string[]> {
    const results: string[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const result = await this.processAndUploadImage(imageUrls[i], platform, postId, i);
      if (result) {
        results.push(result.url);
      }
    }

    return results;
  }

  /**
   * Delete image from toto-bo Firebase Storage
   */
  async deleteImage(fileName: string): Promise<boolean> {
    try {
      // getTotoBoStorage() returns a bucket instance (admin.storage().bucket())
      const getTotoBoStorage = (global as any).getTotoBoStorage as (() => ReturnType<ReturnType<typeof admin.storage>['bucket']> | null) | undefined;
      
      if (!getTotoBoStorage) {
        console.error('getTotoBoStorage not available');
        return false;
      }

      const bucket = getTotoBoStorage();
      if (!bucket) {
        console.error('toto-bo Storage bucket not available');
        return false;
      }

      // getTotoBoStorage() returns a bucket instance directly
      const file = bucket.file(fileName);
      
      await file.delete();
      console.log(`✅ Deleted image: ${fileName}`);
      return true;
    } catch (error) {
      console.error(`Error deleting image ${fileName}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple images
   */
  async deleteMultipleImages(fileNames: string[]): Promise<boolean> {
    let allSuccess = true;
    
    for (const fileName of fileNames) {
      const success = await this.deleteImage(fileName);
      if (!success) {
        allSuccess = false;
      }
    }

    return allSuccess;
  }

  /**
   * Delete video from toto-bo Firebase Storage
   */
  async deleteVideo(fileName: string): Promise<boolean> {
    try {
      const getTotoBoStorage = (global as any).getTotoBoStorage as (() => ReturnType<ReturnType<typeof admin.storage>['bucket']> | null) | undefined;
      
      if (!getTotoBoStorage) {
        console.error('getTotoBoStorage not available');
        return false;
      }

      const bucket = getTotoBoStorage();
      if (!bucket) {
        console.error('toto-bo Storage bucket not available');
        return false;
      }

      const file = bucket.file(fileName);
      await file.delete();
      console.log(`✅ Deleted video: ${fileName}`);
      return true;
    } catch (error) {
      console.error(`Error deleting video ${fileName}:`, error);
      return false;
    }
  }
}

