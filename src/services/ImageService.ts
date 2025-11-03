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
      // Get toto-bo Storage instance
      const getTotoBoStorage = (global as any).getTotoBoStorage as (() => admin.storage.Storage | null) | undefined;
      
      if (!getTotoBoStorage) {
        console.error('getTotoBoStorage not available - Firebase Admin not initialized for toto-bo');
        return null;
      }

      const storage = getTotoBoStorage();
      if (!storage) {
        console.error('toto-bo Storage not available');
        return null;
      }

      // Download image
      console.log(`Downloading image from ${imageUrl}...`);
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        console.error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
        return null;
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const originalSize = imageBuffer.length;

      // Optimize image
      console.log(`Optimizing image... (${originalSize} bytes)`);
      const optimizedBuffer = await this.optimizeImage(imageBuffer);
      const optimizedSize = optimizedBuffer.length;

      console.log(`✅ Image optimized: ${originalSize} → ${optimizedSize} bytes (${((1 - optimizedSize / originalSize) * 100).toFixed(1)}% reduction)`);

      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = IMAGE_CONFIG.OUTPUT_FORMAT === 'webp' ? 'webp' : 'jpg';
      const fileName = `social-media-posts/${platform}/${postId}/${timestamp}_${index}.${fileExtension}`;

      // Upload to Firebase Storage
      const bucket = storage.bucket();
      const fileUpload = bucket.file(fileName);
      
      const downloadToken = randomUUID();
      const contentType = IMAGE_CONFIG.OUTPUT_FORMAT === 'webp' ? 'image/webp' : 'image/jpeg';

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

      // Generate public URL
      const bucketName = bucket.name;
      const encodedFileName = encodeURIComponent(fileName);
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedFileName}?alt=media&token=${downloadToken}`;

      console.log(`✅ Image uploaded to toto-bo Storage: ${publicUrl}`);

      return {
        url: publicUrl,
        fileName,
        originalSize,
        optimizedSize
      };
    } catch (error) {
      console.error(`Error processing image ${imageUrl}:`, error);
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
      const getTotoBoStorage = (global as any).getTotoBoStorage as (() => admin.storage.Storage | null) | undefined;
      
      if (!getTotoBoStorage) {
        console.error('getTotoBoStorage not available');
        return false;
      }

      const storage = getTotoBoStorage();
      if (!storage) {
        console.error('toto-bo Storage not available');
        return false;
      }

      const bucket = storage.bucket();
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
}

