import * as admin from 'firebase-admin';

export interface AgentFeedback {
  id?: string;
  postId: string;
  platform: 'twitter' | 'instagram';
  predictedAction: 'create_case' | 'create_update' | 'dismiss';
  actualAction: 'create_case' | 'create_update' | 'dismiss' | 'rejected';
  confidence: number;
  userDecision: 'approved' | 'rejected' | 'dismissed';
  timestamp: admin.firestore.FieldValue | Date;
  guardianId?: string;
  caseId?: string;
  metadata?: {
    analysisResult?: any;
    notes?: string;
  };
}

export interface LearningStats {
  totalFeedback: number;
  accuracyRate: number;
  averageConfidence: number;
  accuracyByAction: {
    [key: string]: {
      correct: number;
      total: number;
      accuracy: number;
    };
  };
  confidenceBuckets: {
    [key: string]: {
      correct: number;
      total: number;
      accuracy: number;
    };
  };
}

/**
 * Service for collecting and analyzing agent feedback for learning
 */
export class AgentFeedbackService {
  private readonly COLLECTION_NAME = 'agentFeedback';

  /**
   * Get toto-bo Firestore instance
   */
  private getFirestore(): admin.firestore.Firestore | null {
    const getTotoBoFirestore = (global as any).getTotoBoFirestore as (() => admin.firestore.Firestore | null) | undefined;
    
    if (!getTotoBoFirestore) {
      console.warn('getTotoBoFirestore not available - cannot save feedback');
      return null;
    }

    return getTotoBoFirestore();
  }

  /**
   * Save feedback for agent learning
   */
  async saveFeedback(feedback: Omit<AgentFeedback, 'id' | 'timestamp'>): Promise<string | null> {
    try {
      const db = this.getFirestore();
      if (!db) {
        console.error('toto-bo Firestore not available - cannot save feedback');
        return null;
      }

      const feedbackData: Omit<AgentFeedback, 'id'> = {
        ...feedback,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection(this.COLLECTION_NAME).add(feedbackData);
      console.log(`✅ Saved agent feedback: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Error saving agent feedback:', error);
      return null;
    }
  }

  /**
   * Get learning statistics
   */
  async getLearningStats(platform?: 'twitter' | 'instagram', days: number = 30): Promise<LearningStats> {
    try {
      const db = this.getFirestore();
      if (!db) {
        return this.getEmptyStats();
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      let query: admin.firestore.Query = db.collection(this.COLLECTION_NAME)
        .where('timestamp', '>=', cutoffDate);

      if (platform) {
        query = query.where('platform', '==', platform);
      }

      const snapshot = await query.get();
      const feedbacks = snapshot.docs.map(doc => doc.data() as AgentFeedback);

      return this.calculateStats(feedbacks);
    } catch (error) {
      console.error('Error getting learning stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Calculate statistics from feedback array
   */
  private calculateStats(feedbacks: AgentFeedback[]): LearningStats {
    if (feedbacks.length === 0) {
      return this.getEmptyStats();
    }

    const accuracyByAction: { [key: string]: { correct: number; total: number; accuracy: number } } = {};
    const confidenceBuckets: { [key: string]: { correct: number; total: number; accuracy: number } } = {};

    let totalCorrect = 0;
    let totalConfidence = 0;

    feedbacks.forEach(feedback => {
      // Check accuracy (predicted matches actual)
      const isCorrect = feedback.predictedAction === feedback.actualAction;
      if (isCorrect) {
        totalCorrect++;
      }
      totalConfidence += feedback.confidence;

      // Track by action type
      if (!accuracyByAction[feedback.predictedAction]) {
        accuracyByAction[feedback.predictedAction] = { correct: 0, total: 0, accuracy: 0 };
      }
      accuracyByAction[feedback.predictedAction].total++;
      if (isCorrect) {
        accuracyByAction[feedback.predictedAction].correct++;
      }

      // Track by confidence bucket
      const bucket = this.getConfidenceBucket(feedback.confidence);
      if (!confidenceBuckets[bucket]) {
        confidenceBuckets[bucket] = { correct: 0, total: 0, accuracy: 0 };
      }
      confidenceBuckets[bucket].total++;
      if (isCorrect) {
        confidenceBuckets[bucket].correct++;
      }
    });

    // Calculate accuracy rates
    Object.keys(accuracyByAction).forEach(action => {
      const stats = accuracyByAction[action];
      stats.accuracy = stats.total > 0 ? stats.correct / stats.total : 0;
    });

    Object.keys(confidenceBuckets).forEach(bucket => {
      const stats = confidenceBuckets[bucket];
      stats.accuracy = stats.total > 0 ? stats.correct / stats.total : 0;
    });

    return {
      totalFeedback: feedbacks.length,
      accuracyRate: feedbacks.length > 0 ? totalCorrect / feedbacks.length : 0,
      averageConfidence: feedbacks.length > 0 ? totalConfidence / feedbacks.length : 0,
      accuracyByAction,
      confidenceBuckets
    };
  }

  /**
   * Get confidence bucket string
   */
  private getConfidenceBucket(confidence: number): string {
    if (confidence >= 0.9) return '0.9-1.0';
    if (confidence >= 0.8) return '0.8-0.9';
    if (confidence >= 0.7) return '0.7-0.8';
    if (confidence >= 0.6) return '0.6-0.7';
    return '0.0-0.6';
  }

  /**
   * Get empty stats structure
   */
  private getEmptyStats(): LearningStats {
    return {
      totalFeedback: 0,
      accuracyRate: 0,
      averageConfidence: 0,
      accuracyByAction: {},
      confidenceBuckets: {}
    };
  }

  /**
   * Get learned patterns (feedback that can help improve predictions)
   */
  async getLearnedPatterns(platform?: 'twitter' | 'instagram'): Promise<any[]> {
    try {
      const db = this.getFirestore();
      if (!db) {
        return [];
      }

      let query: admin.firestore.Query = db.collection(this.COLLECTION_NAME)
        .orderBy('timestamp', 'desc')
        .limit(100);

      if (platform) {
        query = query.where('platform', '==', platform);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting learned patterns:', error);
      return [];
    }
  }
}

