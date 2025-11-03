import * as admin from 'firebase-admin';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface MonitoringJob {
  id: string;
  type: 'social_media_monitoring';
  status: JobStatus;
  guardianId?: string;
  triggeredBy: string;
  triggeredByEmail?: string;
  createdAt: admin.firestore.Timestamp | Date;
  startedAt?: admin.firestore.Timestamp | Date;
  completedAt?: admin.firestore.Timestamp | Date;
  result?: {
    success: boolean;
    postsAnalyzed?: number;
    postsCreated?: number;
    error?: string;
    details?: any;
  };
  error?: string;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Job worker service that polls for and processes monitoring jobs
 */
export class JobWorkerService {
  private readonly COLLECTION_NAME = 'monitoringJobs';
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private schedulerService: any;

  constructor(schedulerService: any) {
    this.schedulerService = schedulerService;
  }

  /**
   * Get toto-bo Firestore instance
   */
  private getFirestore(): admin.firestore.Firestore | null {
    const getTotoBoFirestore = (global as any).getTotoBoFirestore as (() => admin.firestore.Firestore | null) | undefined;

    if (!getTotoBoFirestore) {
      console.warn('getTotoBoFirestore not available - Job worker cannot access jobs');
      return null;
    }

    return getTotoBoFirestore();
  }

  /**
   * Start the job worker
   */
  start(intervalMs: number = 10000): void {
    if (this.isRunning) {
      console.log('⚠️ Job worker already running');
      return;
    }

    this.isRunning = true;
    console.log(`🔄 Starting job worker (polling every ${intervalMs}ms)...`);

    // Poll for jobs periodically
    this.pollInterval = setInterval(() => {
      this.processJobs().catch((error) => {
        console.error('❌ Error processing jobs:', error);
      });
    }, intervalMs);

    // Process immediately on start
    this.processJobs().catch((error) => {
      console.error('❌ Error processing jobs:', error);
    });
  }

  /**
   * Stop the job worker
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping job worker...');
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Process pending jobs
   */
  private async processJobs(): Promise<void> {
    const db = this.getFirestore();
    if (!db) {
      return;
    }

    try {
      // Get pending jobs (limit 5 at a time to avoid overload)
      const snapshot = await db
        .collection(this.COLLECTION_NAME)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'asc')
        .limit(5)
        .get();

      if (snapshot.empty) {
        return; // No jobs to process
      }

      console.log(`📋 Found ${snapshot.size} pending job(s) to process`);

      // Process each job
      for (const doc of snapshot.docs) {
        const job = {
          id: doc.id,
          ...doc.data(),
        } as MonitoringJob;

        await this.processJob(job);
      }
    } catch (error) {
      console.error('Error fetching pending jobs:', error);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: MonitoringJob): Promise<void> {
    const db = this.getFirestore();
    if (!db) {
      return;
    }

    console.log(`🔄 Processing job ${job.id} (guardian: ${job.guardianId || 'all'})`);

    try {
      // Mark as processing
      await db.collection(this.COLLECTION_NAME).doc(job.id).update({
        status: 'processing',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Execute the monitoring
      const result = await this.schedulerService.triggerSocialMediaMonitoring(
        job.guardianId
      );

      // Mark as completed
      await db.collection(this.COLLECTION_NAME).doc(job.id).update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        result: {
          success: true,
          postsAnalyzed: result?.postsAnalyzed || 0,
          postsCreated: result?.postsCreated || 0,
          details: result,
        },
      });

      console.log(`✅ Job ${job.id} completed successfully`);
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);

      const retryCount = (job.retryCount || 0) + 1;
      const maxRetries = job.maxRetries || 3;

      if (retryCount < maxRetries) {
        // Retry the job
        console.log(`🔄 Retrying job ${job.id} (attempt ${retryCount + 1}/${maxRetries})`);
        await db.collection(this.COLLECTION_NAME).doc(job.id).update({
          status: 'pending',
          retryCount,
        });
      } else {
        // Mark as failed
        await db.collection(this.COLLECTION_NAME).doc(job.id).update({
          status: 'failed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          result: {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }
}
