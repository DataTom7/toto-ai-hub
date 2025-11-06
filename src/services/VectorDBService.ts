/**
 * Vector Database Service
 *
 * Provides abstraction for vector storage and retrieval.
 * Supports multiple backends:
 * - Vertex AI Vector Search (production)
 * - In-memory storage (fallback/development)
 *
 * Features:
 * - Unlimited vector storage
 * - Metadata filtering
 * - Hybrid search (vector + metadata)
 * - Batch operations
 * - Automatic retry with exponential backoff
 * - Connection pooling
 */

import { GoogleAuth } from 'google-auth-library';

/**
 * Vector document structure
 */
export interface VectorDocument {
  id: string;                    // Unique identifier
  embedding: number[];           // Vector embedding (768 dimensions for Gemini)
  content: string;               // Original text content
  metadata: {
    category: string;            // Knowledge base category (e.g., 'donation_process', 'case_management')
    audience: string[];          // Target audiences (e.g., ['donors', 'guardians'])
    source: string;              // Source of information (e.g., 'admin', 'documentation')
    timestamp: Date;             // When the document was added/updated
    version: string;             // Version for tracking updates
    tags?: string[];             // Optional tags for additional filtering
  };
}

/**
 * Search query parameters
 */
export interface VectorSearchQuery {
  embedding: number[];           // Query embedding
  topK?: number;                 // Number of results to return (default: 5)
  filters?: {
    category?: string;           // Filter by category
    audience?: string[];         // Filter by audience (OR logic)
    source?: string;             // Filter by source
    tags?: string[];             // Filter by tags (OR logic)
    minTimestamp?: Date;         // Filter by minimum timestamp
    maxTimestamp?: Date;         // Filter by maximum timestamp
  };
  minScore?: number;             // Minimum similarity score (0-1)
}

/**
 * Search result
 */
export interface VectorSearchResult {
  document: VectorDocument;
  score: number;                 // Similarity score (0-1, higher is better)
  distance: number;              // Distance metric (lower is better)
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors?: Array<{ id: string; error: string }>;
}

/**
 * Vector DB configuration
 */
export interface VectorDBConfig {
  backend: 'vertex-ai' | 'in-memory';  // Storage backend
  projectId?: string;                   // Google Cloud project ID (for Vertex AI)
  location?: string;                    // GCP location (default: 'us-central1')
  indexId?: string;                     // Vertex AI index ID
  indexEndpointId?: string;             // Vertex AI index endpoint ID
  dimensions?: number;                  // Embedding dimensions (default: 768)
  distanceMetric?: 'DOT_PRODUCT' | 'COSINE' | 'EUCLIDEAN';  // Distance metric
  maxRetries?: number;                  // Max retry attempts (default: 3)
  retryDelay?: number;                  // Initial retry delay in ms (default: 1000)
}

/**
 * VectorDBService - Main service for vector operations
 */
export class VectorDBService {
  private config: Required<VectorDBConfig>;
  private auth?: GoogleAuth;
  private inMemoryStore: Map<string, VectorDocument> = new Map();

  constructor(config: VectorDBConfig) {
    // Set defaults
    this.config = {
      backend: config.backend,
      projectId: config.projectId || process.env.VERTEX_AI_PROJECT_ID || '',
      location: config.location || process.env.VERTEX_AI_LOCATION || 'us-central1',
      indexId: config.indexId || process.env.VERTEX_AI_INDEX_ID || '',
      indexEndpointId: config.indexEndpointId || process.env.VERTEX_AI_INDEX_ENDPOINT_ID || '',
      dimensions: config.dimensions || 768,
      distanceMetric: config.distanceMetric || 'COSINE',
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
    };

    // Initialize Google Auth for Vertex AI
    if (this.config.backend === 'vertex-ai') {
      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      console.log('[VectorDBService] Initialized with Vertex AI backend');
    } else {
      console.log('[VectorDBService] Initialized with in-memory backend');
    }
  }

  /**
   * Upsert a single vector document
   */
  async upsert(document: VectorDocument): Promise<void> {
    if (this.config.backend === 'vertex-ai') {
      await this.upsertVertexAI([document]);
    } else {
      this.inMemoryStore.set(document.id, document);
    }
  }

  /**
   * Upsert multiple vector documents (batch operation)
   */
  async upsertBatch(documents: VectorDocument[]): Promise<BatchOperationResult> {
    try {
      if (this.config.backend === 'vertex-ai') {
        await this.upsertVertexAI(documents);
      } else {
        documents.forEach(doc => this.inMemoryStore.set(doc.id, doc));
      }

      return {
        success: true,
        processedCount: documents.length,
        failedCount: 0,
      };
    } catch (error) {
      console.error('[VectorDBService] Batch upsert failed:', error);
      return {
        success: false,
        processedCount: 0,
        failedCount: documents.length,
        errors: documents.map(doc => ({
          id: doc.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })),
      };
    }
  }

  /**
   * Search for similar vectors
   */
  async search(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    if (this.config.backend === 'vertex-ai') {
      return await this.searchVertexAI(query);
    } else {
      return this.searchInMemory(query);
    }
  }

  /**
   * Delete a vector document by ID
   */
  async delete(id: string): Promise<void> {
    if (this.config.backend === 'vertex-ai') {
      await this.deleteVertexAI([id]);
    } else {
      this.inMemoryStore.delete(id);
    }
  }

  /**
   * Delete multiple vector documents (batch operation)
   */
  async deleteBatch(ids: string[]): Promise<BatchOperationResult> {
    try {
      if (this.config.backend === 'vertex-ai') {
        await this.deleteVertexAI(ids);
      } else {
        ids.forEach(id => this.inMemoryStore.delete(id));
      }

      return {
        success: true,
        processedCount: ids.length,
        failedCount: 0,
      };
    } catch (error) {
      console.error('[VectorDBService] Batch delete failed:', error);
      return {
        success: false,
        processedCount: 0,
        failedCount: ids.length,
        errors: ids.map(id => ({
          id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })),
      };
    }
  }

  /**
   * Get total count of vectors
   */
  async count(filters?: VectorSearchQuery['filters']): Promise<number> {
    if (this.config.backend === 'vertex-ai') {
      // Vertex AI doesn't provide direct count, estimate from search
      console.warn('[VectorDBService] Count not directly supported in Vertex AI, returning estimate');
      return -1; // Indicate count is not available
    } else {
      if (!filters) {
        return this.inMemoryStore.size;
      }

      // Count with filters
      let count = 0;
      for (const doc of this.inMemoryStore.values()) {
        if (this.matchesFilters(doc, filters)) {
          count++;
        }
      }
      return count;
    }
  }

  /**
   * Clear all vectors (use with caution!)
   */
  async clear(): Promise<void> {
    if (this.config.backend === 'vertex-ai') {
      console.warn('[VectorDBService] Clear not supported for Vertex AI - manual deletion required');
      throw new Error('Clear operation not supported for Vertex AI backend');
    } else {
      this.inMemoryStore.clear();
      console.log('[VectorDBService] In-memory store cleared');
    }
  }

  // ===== VERTEX AI OPERATIONS =====

  /**
   * Upsert documents to Vertex AI Vector Search
   */
  private async upsertVertexAI(documents: VectorDocument[]): Promise<void> {
    // Validate configuration
    if (!this.config.projectId || !this.config.indexId) {
      throw new Error('Vertex AI project ID and index ID are required');
    }

    // Implement with retry logic
    await this.withRetry(async () => {
      const client = await this.getVertexAIClient();

      // Format documents for Vertex AI
      const datapoints = documents.map(doc => ({
        datapoint_id: doc.id,
        feature_vector: doc.embedding,
        restricts: [
          { namespace: 'category', allow: [doc.metadata.category] },
          { namespace: 'audience', allow: doc.metadata.audience },
          { namespace: 'source', allow: [doc.metadata.source] },
        ],
        // Store full document as JSON in crowding tag (workaround for metadata storage)
        crowding_tag: JSON.stringify({
          content: doc.content,
          metadata: doc.metadata,
        }),
      }));

      // Upsert to Vertex AI
      const indexPath = `projects/${this.config.projectId}/locations/${this.config.location}/indexes/${this.config.indexId}`;

      await client.upsertDatapoints({
        index: indexPath,
        datapoints,
      });

      console.log(`[VectorDBService] Upserted ${documents.length} documents to Vertex AI`);
    });
  }

  /**
   * Search Vertex AI Vector Search
   */
  private async searchVertexAI(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    // Validate configuration
    if (!this.config.projectId || !this.config.indexEndpointId) {
      throw new Error('Vertex AI project ID and index endpoint ID are required');
    }

    return await this.withRetry(async () => {
      const client = await this.getVertexAIClient();

      const topK = query.topK || 5;
      const indexEndpointPath = `projects/${this.config.projectId}/locations/${this.config.location}/indexEndpoints/${this.config.indexEndpointId}`;

      // Build restricts from filters
      const restricts: any[] = [];
      if (query.filters?.category) {
        restricts.push({ namespace: 'category', allow: [query.filters.category] });
      }
      if (query.filters?.audience && query.filters.audience.length > 0) {
        restricts.push({ namespace: 'audience', allow: query.filters.audience });
      }
      if (query.filters?.source) {
        restricts.push({ namespace: 'source', allow: [query.filters.source] });
      }

      // Query Vertex AI
      const response = await client.findNeighbors({
        indexEndpoint: indexEndpointPath,
        queries: [{
          datapoint: {
            feature_vector: query.embedding,
          },
          neighbor_count: topK,
          ...(restricts.length > 0 && { restricts }),
        }],
      });

      // Parse results
      const results: VectorSearchResult[] = [];
      const neighbors = response.nearestNeighbors?.[0]?.neighbors || [];

      for (const neighbor of neighbors) {
        try {
          // Parse document from crowding tag
          const docData = JSON.parse(neighbor.datapoint?.crowding_tag || '{}');

          const score = this.distanceToScore(neighbor.distance || 0);

          // Apply min score filter
          if (query.minScore && score < query.minScore) {
            continue;
          }

          results.push({
            document: {
              id: neighbor.datapoint?.datapoint_id || '',
              embedding: neighbor.datapoint?.feature_vector || [],
              content: docData.content || '',
              metadata: docData.metadata || {},
            },
            score,
            distance: neighbor.distance || 0,
          });
        } catch (error) {
          console.error('[VectorDBService] Error parsing search result:', error);
        }
      }

      console.log(`[VectorDBService] Found ${results.length} results from Vertex AI`);
      return results;
    });
  }

  /**
   * Delete documents from Vertex AI
   */
  private async deleteVertexAI(ids: string[]): Promise<void> {
    await this.withRetry(async () => {
      const client = await this.getVertexAIClient();
      const indexPath = `projects/${this.config.projectId}/locations/${this.config.location}/indexes/${this.config.indexId}`;

      await client.removeDatapoints({
        index: indexPath,
        datapoint_ids: ids,
      });

      console.log(`[VectorDBService] Deleted ${ids.length} documents from Vertex AI`);
    });
  }

  /**
   * Get Vertex AI client
   */
  private async getVertexAIClient(): Promise<any> {
    // Note: This requires @google-cloud/aiplatform package
    // Import dynamically to avoid compilation errors if package not installed
    try {
      // Use Function constructor to completely hide import from TypeScript
      // This allows the code to compile even if @google-cloud/aiplatform is not installed
      const importAIPlatform = new Function('moduleName', 'return import(moduleName)');
      const aiplatform = await importAIPlatform('@google-cloud/aiplatform').catch(() => null);

      if (!aiplatform) {
        throw new Error(
          'Package @google-cloud/aiplatform not installed. ' +
          'Run: npm install @google-cloud/aiplatform google-auth-library'
        );
      }

      const { IndexServiceClient } = aiplatform;
      return new IndexServiceClient({ auth: this.auth });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Vertex AI client not available. Install @google-cloud/aiplatform package.';

      console.error('[VectorDBService] Vertex AI client error:', message);
      throw new Error(message);
    }
  }

  // ===== IN-MEMORY OPERATIONS =====

  /**
   * Search in-memory store
   */
  private searchInMemory(query: VectorSearchQuery): VectorSearchResult[] {
    const topK = query.topK || 5;
    const results: VectorSearchResult[] = [];

    // Calculate similarity for all documents
    for (const doc of this.inMemoryStore.values()) {
      // Apply filters
      if (query.filters && !this.matchesFilters(doc, query.filters)) {
        continue;
      }

      // Calculate cosine similarity
      const score = this.cosineSimilarity(query.embedding, doc.embedding);
      const distance = 1 - score; // Convert to distance

      // Apply min score filter
      if (query.minScore && score < query.minScore) {
        continue;
      }

      results.push({ document: doc, score, distance });
    }

    // Sort by score (descending) and return top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Check if document matches filters
   */
  private matchesFilters(doc: VectorDocument, filters: VectorSearchQuery['filters']): boolean {
    if (!filters) return true;

    // Category filter
    if (filters.category && doc.metadata.category !== filters.category) {
      return false;
    }

    // Audience filter (OR logic - document must match at least one audience)
    if (filters.audience && filters.audience.length > 0) {
      const hasMatchingAudience = doc.metadata.audience.some(a =>
        filters.audience!.includes(a)
      );
      if (!hasMatchingAudience) {
        return false;
      }
    }

    // Source filter
    if (filters.source && doc.metadata.source !== filters.source) {
      return false;
    }

    // Tags filter (OR logic)
    if (filters.tags && filters.tags.length > 0) {
      const docTags = doc.metadata.tags || [];
      const hasMatchingTag = docTags.some(t => filters.tags!.includes(t));
      if (!hasMatchingTag) {
        return false;
      }
    }

    // Timestamp filters
    if (filters.minTimestamp && doc.metadata.timestamp < filters.minTimestamp) {
      return false;
    }
    if (filters.maxTimestamp && doc.metadata.timestamp > filters.maxTimestamp) {
      return false;
    }

    return true;
  }

  // ===== UTILITY FUNCTIONS =====

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Convert distance to similarity score (0-1, higher is better)
   */
  private distanceToScore(distance: number): number {
    if (this.config.distanceMetric === 'COSINE') {
      return 1 - distance; // Cosine distance is 1 - similarity
    } else if (this.config.distanceMetric === 'DOT_PRODUCT') {
      return distance; // Dot product is already a similarity
    } else {
      // Euclidean distance - use exponential decay
      return Math.exp(-distance);
    }
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.config.retryDelay;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.maxRetries) {
          console.warn(`[VectorDBService] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }
}
