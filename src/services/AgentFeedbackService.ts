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

/**
 * Enhanced feedback schema for general agent interactions
 * Supports fine-tuning dataset generation
 */
export interface EnhancedAgentFeedback {
  id?: string;
  interactionId: string;
  agentType: 'case' | 'twitter' | 'instagram';
  userQuery: string;
  agentResponse: string;
  rating: 'good' | 'bad' | 'excellent';
  correctedResponse?: string;  // For fine-tuning: what the response should have been
  feedbackNotes?: string;
  timestamp: admin.firestore.FieldValue | Date;
  userId?: string;
  sessionId?: string;
  metadata?: {
    context?: any;
    caseId?: string;
    platform?: string;
    userSatisfactionScore?: number;  // 1-5 stars
  };
}

/**
 * Fine-tuning training example
 */
export interface FineTuningExample {
  input: string;
  output: string;
  context?: string;
  category: string;
  quality: 'good' | 'excellent';
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
 * Enhanced learning stats with satisfaction metrics
 */
export interface EnhancedLearningStats extends LearningStats {
  userSatisfactionStats: {
    averageRating: number;  // 1-5 stars
    totalRatings: number;
    ratingDistribution: { [key: number]: number };  // star rating -> count
    goodResponses: number;
    badResponses: number;
    excellentResponses: number;
  };
  improvementSuggestions: string[];
}

/**
 * Service for collecting and analyzing agent feedback for learning and fine-tuning
 */
export class AgentFeedbackService {
  private readonly COLLECTION_NAME = 'agentFeedback';
  private readonly ENHANCED_COLLECTION_NAME = 'enhancedAgentFeedback';

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

  // ===== ENHANCED FEEDBACK METHODS =====

  /**
   * Save enhanced feedback for fine-tuning and learning
   */
  async saveEnhancedFeedback(feedback: Omit<EnhancedAgentFeedback, 'id' | 'timestamp'>): Promise<string | null> {
    try {
      const db = this.getFirestore();
      if (!db) {
        console.error('toto-bo Firestore not available - cannot save enhanced feedback');
        return null;
      }

      const feedbackData: Omit<EnhancedAgentFeedback, 'id'> = {
        ...feedback,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection(this.ENHANCED_COLLECTION_NAME).add(feedbackData);
      console.log(`✅ Saved enhanced agent feedback: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Error saving enhanced feedback:', error);
      return null;
    }
  }

  /**
   * Get enhanced learning statistics with satisfaction metrics
   */
  async getEnhancedLearningStats(agentType?: 'case' | 'twitter' | 'instagram', days: number = 30): Promise<EnhancedLearningStats> {
    try {
      const db = this.getFirestore();
      if (!db) {
        return this.getEmptyEnhancedStats();
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      let query: admin.firestore.Query = db.collection(this.ENHANCED_COLLECTION_NAME)
        .where('timestamp', '>=', cutoffDate);

      if (agentType) {
        query = query.where('agentType', '==', agentType);
      }

      const snapshot = await query.get();
      const feedbacks = snapshot.docs.map(doc => doc.data() as EnhancedAgentFeedback);

      return this.calculateEnhancedStats(feedbacks);
    } catch (error) {
      console.error('Error getting enhanced learning stats:', error);
      return this.getEmptyEnhancedStats();
    }
  }

  /**
   * Calculate enhanced statistics from feedback
   */
  private calculateEnhancedStats(feedbacks: EnhancedAgentFeedback[]): EnhancedLearningStats {
    if (feedbacks.length === 0) {
      return this.getEmptyEnhancedStats();
    }

    // Calculate satisfaction stats
    let totalSatisfactionScore = 0;
    let totalRatings = 0;
    const ratingDistribution: { [key: number]: number } = {};
    let goodResponses = 0;
    let badResponses = 0;
    let excellentResponses = 0;

    feedbacks.forEach(feedback => {
      // Count rating types
      if (feedback.rating === 'good') goodResponses++;
      if (feedback.rating === 'bad') badResponses++;
      if (feedback.rating === 'excellent') excellentResponses++;

      // Calculate user satisfaction score
      if (feedback.metadata?.userSatisfactionScore) {
        totalSatisfactionScore += feedback.metadata.userSatisfactionScore;
        totalRatings++;

        const score = feedback.metadata.userSatisfactionScore;
        ratingDistribution[score] = (ratingDistribution[score] || 0) + 1;
      }
    });

    const averageRating = totalRatings > 0 ? totalSatisfactionScore / totalRatings : 0;

    // Generate improvement suggestions
    const improvementSuggestions = this.generateImprovementSuggestions({
      averageRating,
      badResponses,
      totalFeedback: feedbacks.length,
    });

    return {
      ...this.getEmptyStats(),
      totalFeedback: feedbacks.length,
      accuracyRate: 0,  // Not applicable for enhanced feedback
      averageConfidence: 0,  // Not applicable for enhanced feedback
      userSatisfactionStats: {
        averageRating,
        totalRatings,
        ratingDistribution,
        goodResponses,
        badResponses,
        excellentResponses,
      },
      improvementSuggestions,
    };
  }

  /**
   * Generate improvement suggestions based on feedback
   */
  private generateImprovementSuggestions(stats: {
    averageRating: number;
    badResponses: number;
    totalFeedback: number;
  }): string[] {
    const suggestions: string[] = [];

    if (stats.averageRating < 3.0) {
      suggestions.push('Average user satisfaction is low - review recent bad responses for patterns');
    }

    if (stats.badResponses / stats.totalFeedback > 0.3) {
      suggestions.push('High percentage of bad responses - consider prompt optimization or fine-tuning');
    }

    if (stats.totalFeedback < 100) {
      suggestions.push('Collect more feedback to improve fine-tuning dataset quality');
    }

    return suggestions;
  }

  /**
   * Get empty enhanced stats structure
   */
  private getEmptyEnhancedStats(): EnhancedLearningStats {
    return {
      ...this.getEmptyStats(),
      userSatisfactionStats: {
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: {},
        goodResponses: 0,
        badResponses: 0,
        excellentResponses: 0,
      },
      improvementSuggestions: [],
    };
  }

  /**
   * Export fine-tuning dataset from feedback
   * Returns high-quality examples for training
   */
  async exportFineTuningDataset(options?: {
    agentType?: 'case' | 'twitter' | 'instagram';
    minQuality?: 'good' | 'excellent';
    limit?: number;
  }): Promise<FineTuningExample[]> {
    try {
      const db = this.getFirestore();
      if (!db) {
        return [];
      }

      const minQuality = options?.minQuality || 'good';
      const limit = options?.limit || 1000;

      let query: admin.firestore.Query = db.collection(this.ENHANCED_COLLECTION_NAME)
        .orderBy('timestamp', 'desc')
        .limit(limit);

      if (options?.agentType) {
        query = query.where('agentType', '==', options.agentType);
      }

      // Filter by quality
      if (minQuality === 'excellent') {
        query = query.where('rating', '==', 'excellent');
      } else {
        query = query.where('rating', 'in', ['good', 'excellent']);
      }

      const snapshot = await query.get();
      const examples: FineTuningExample[] = [];

      snapshot.docs.forEach(doc => {
        const feedback = doc.data() as EnhancedAgentFeedback;

        // Use corrected response if available, otherwise use original
        const output = feedback.correctedResponse || feedback.agentResponse;

        examples.push({
          input: feedback.userQuery,
          output,
          context: feedback.metadata?.context ? JSON.stringify(feedback.metadata.context) : undefined,
          category: feedback.agentType,
          quality: feedback.rating as 'good' | 'excellent',
        });
      });

      console.log(`✅ Exported ${examples.length} fine-tuning examples`);
      return examples;
    } catch (error) {
      console.error('Error exporting fine-tuning dataset:', error);
      return [];
    }
  }

  /**
   * Get feedback that needs review (bad responses or corrections)
   */
  async getFeedbackForReview(limit: number = 50): Promise<EnhancedAgentFeedback[]> {
    try {
      const db = this.getFirestore();
      if (!db) {
        return [];
      }

      const snapshot = await db.collection(this.ENHANCED_COLLECTION_NAME)
        .where('rating', '==', 'bad')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as EnhancedAgentFeedback,
      }));
    } catch (error) {
      console.error('Error getting feedback for review:', error);
      return [];
    }
  }
}

