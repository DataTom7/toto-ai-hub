import * as admin from 'firebase-admin';

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors
      if (error instanceof Error && (error.message.includes('permission') || error.message.includes('not found'))) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export interface SocialMediaPost {
  id: string;
  platform: 'twitter' | 'instagram';
  guardianId: string;
  guardianName: string;
  postId: string;
  postContent: string;
  postUrl?: string;
  images: string[];
  imageFileNames?: string[]; // Store file names for deletion on dismiss
  analysisResult: any; // PostAnalysis or TweetAnalysis
  recommendedAction: 'create_case' | 'create_update' | 'dismiss';
  matchedCaseId?: string;
  matchedCaseName?: string;
  caseId?: string; // For updates
  status: 'pending' | 'approved' | 'rejected' | 'dismissed';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  createdAt: admin.firestore.FieldValue | Date;
  reviewedAt?: admin.firestore.FieldValue | Date;
  reviewedBy?: string;
  reviewNotes?: string;
  metadata?: {
    tweetData?: any;
    instagramPost?: any;
    originalPlatformData?: any;
  };
}

/**
 * Service for persisting and managing social media posts in toto-bo Firestore
 */
export class SocialMediaPostService {
  private readonly COLLECTION_NAME = 'socialMediaPosts';

  /**
   * Get toto-bo Firestore instance
   */
  private getFirestore(): admin.firestore.Firestore | null {
    const getTotoBoFirestore = (global as any).getTotoBoFirestore as (() => admin.firestore.Firestore | null) | undefined;
    
    if (!getTotoBoFirestore) {
      console.warn('getTotoBoFirestore not available - Firebase Admin not initialized for toto-bo');
      return null;
    }

    return getTotoBoFirestore();
  }

  /**
   * Save a social media post to Firestore (with API fallback for local dev)
   */
  async savePost(post: Omit<SocialMediaPost, 'id' | 'createdAt'>): Promise<string | null> {
    try {
      console.log(`🔄 Attempting to save post: ${post.postId} (${post.platform})`);
      
      const db = this.getFirestore();
      if (!db) {
        console.warn('⚠️ toto-bo Firestore not available - falling back to API');
        return await this.savePostViaAPI(post);
      }

      console.log(`✅ Firestore connection obtained, saving to collection: ${this.COLLECTION_NAME}`);

      const postData: Omit<SocialMediaPost, 'id'> = {
        ...post,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Use postId as document ID to prevent duplicates
      const docRef = db.collection(this.COLLECTION_NAME).doc(post.postId);

      // Save with retry logic
      await retryWithBackoff(async () => {
        await docRef.set(postData);
      });

      console.log(`✅ Successfully saved social media post to Firestore: ${post.postId}`);
      return docRef.id;
    } catch (error) {
      console.error(`❌ Error saving social media post ${post.postId}:`, error);
      if (error instanceof Error) {
        console.error(`   Error message: ${error.message}`);
        console.error(`   Error stack: ${error.stack}`);
      }
      // Try API fallback on error
      console.log('🔄 Trying API fallback after Firestore error...');
      return await this.savePostViaAPI(post);
    }
  }

  /**
   * Save post via API call to toto-bo (fallback for local development)
   */
  private async savePostViaAPI(post: Omit<SocialMediaPost, 'id' | 'createdAt'>): Promise<string | null> {
    try {
      const totoBoUrl = process.env.TOTO_BO_URL || 'http://localhost:5000';
      console.log(`📡 Saving post via API to: ${totoBoUrl}/api/social-media/posts`);

      // API call with retry logic
      const data = await retryWithBackoff(async () => {
        const response = await fetch(`${totoBoUrl}/api/social-media/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(post),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API returned ${response.status}: ${errorText}`);
        }

        return await response.json();
      }, 5, 2000); // More retries for API calls, longer initial delay

      console.log(`✅ Successfully saved post via API: ${data.id || post.postId}`);
      return data.id || post.postId;
    } catch (error) {
      console.error(`❌ Error saving post via API:`, error);
      if (error instanceof Error) {
        console.error(`   Error message: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Get a post by ID
   */
  async getPost(postId: string): Promise<SocialMediaPost | null> {
    try {
      const db = this.getFirestore();
      if (!db) {
        return null;
      }

      const docRef = db.collection(this.COLLECTION_NAME).doc(postId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data()
      } as SocialMediaPost;
    } catch (error) {
      console.error(`Error fetching post ${postId}:`, error);
      return null;
    }
  }

  /**
   * Get posts with filtering
   */
  async getPosts(filters?: {
    guardianId?: string;
    platform?: 'twitter' | 'instagram';
    status?: 'pending' | 'approved' | 'rejected' | 'dismissed';
    limit?: number;
    offset?: number;
  }): Promise<SocialMediaPost[]> {
    try {
      const db = this.getFirestore();
      if (!db) {
        return [];
      }

      let query: admin.firestore.Query = db.collection(this.COLLECTION_NAME);

      if (filters?.guardianId) {
        query = query.where('guardianId', '==', filters.guardianId);
      }

      if (filters?.platform) {
        query = query.where('platform', '==', filters.platform);
      }

      if (filters?.status) {
        query = query.where('status', '==', filters.status);
      }

      query = query.orderBy('createdAt', 'desc');

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SocialMediaPost[];
    } catch (error) {
      console.error('Error fetching posts:', error);
      return [];
    }
  }

  /**
   * Update post status
   */
  async updatePostStatus(
    postId: string,
    status: 'pending' | 'approved' | 'rejected' | 'dismissed',
    reviewedBy?: string,
    reviewNotes?: string
  ): Promise<boolean> {
    try {
      const db = this.getFirestore();
      if (!db) {
        return false;
      }

      const updateData: any = {
        status,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (reviewedBy) {
        updateData.reviewedBy = reviewedBy;
      }

      if (reviewNotes) {
        updateData.reviewNotes = reviewNotes;
      }

      // Update with retry logic
      await retryWithBackoff(async () => {
        await db.collection(this.COLLECTION_NAME).doc(postId).update(updateData);
      });

      console.log(`✅ Updated post ${postId} status to ${status}`);
      return true;
    } catch (error) {
      console.error(`Error updating post ${postId} status:`, error);
      return false;
    }
  }

  /**
   * Update matched case information
   */
  async updateMatchedCase(postId: string, caseId: string, caseName: string): Promise<boolean> {
    try {
      const db = this.getFirestore();
      if (!db) {
        return false;
      }

      // Update with retry logic
      await retryWithBackoff(async () => {
        await db.collection(this.COLLECTION_NAME).doc(postId).update({
          matchedCaseId: caseId,
          matchedCaseName: caseName,
          caseId: caseId // Also set caseId for updates
        });
      });

      console.log(`✅ Updated post ${postId} with matched case: ${caseId}`);
      return true;
    } catch (error) {
      console.error(`Error updating matched case for post ${postId}:`, error);
      return false;
    }
  }
}

