import { GoogleGenerativeAI } from '@google/generative-ai';
import { VectorDBService, VectorDocument, VectorSearchQuery } from './VectorDBService';

export interface KnowledgeChunk {
  id: string;
  title: string;
  content: string;
  category: string;
  agentTypes: string[];
  audience: string[]; // Target audience/recipients (e.g., ["donors", "investors", "guardians", "partners"]) or ["admin"] for internal
  embedding?: number[];
  lastUpdated: string;
  usageCount: number;
}

export interface RAGQuery {
  query: string;
  agentType: string;
  context?: string;
  audience?: string; // Target audience for relevance scoring (e.g., 'guardians', 'donors')
  maxResults?: number;
}

export interface RAGResult {
  chunks: KnowledgeChunk[];
  totalResults: number;
  query: string;
  agentType: string;
}

/**
 * RAG Service for dynamic knowledge retrieval with vector embeddings
 * Integrates with Gemini 2.0 Flash for semantic similarity search
 * Now supports unlimited vector storage via VectorDBService (Vertex AI or in-memory)
 */
export class RAGService {
  private genAI: GoogleGenerativeAI;
  private embeddingModel: any;
  private vectorDB: VectorDBService;
  private usageCountCache: Map<string, number> = new Map(); // Cache usage counts
  private maxCacheSize: number = 100; // Limit cache size

  constructor(vectorDBConfig?: { backend: 'vertex-ai' | 'in-memory'; projectId?: string; location?: string; indexId?: string; indexEndpointId?: string }) {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
    this.initializeEmbeddingModel();

    // Initialize VectorDBService with configuration
    this.vectorDB = new VectorDBService(vectorDBConfig || { backend: 'in-memory' });

    console.log('[RAGService] Initialized with unlimited vector storage via VectorDBService');
  }

  /**
   * Initialize the embedding model
   */
  private initializeEmbeddingModel() {
    try {
      // Use Gemini's embedding capabilities
      this.embeddingModel = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-001',
        generationConfig: {
          temperature: 0.1,
        }
      });
    } catch (error) {
      console.error('Error initializing embedding model:', error);
      throw new Error('Failed to initialize embedding model');
    }
  }

  /**
   * Add knowledge chunks to the RAG service
   * Now supports unlimited chunks via VectorDBService
   */
  async addKnowledgeChunks(chunks: KnowledgeChunk[]): Promise<void> {
    try {
      // Convert KnowledgeChunks to VectorDocuments
      const vectorDocs: VectorDocument[] = [];

      for (const chunk of chunks) {
        // Generate embedding if not provided
        if (!chunk.embedding) {
          chunk.embedding = await this.generateEmbedding(chunk.content);
        }

        // Convert to VectorDocument format
        const vectorDoc: VectorDocument = {
          id: chunk.id,
          embedding: chunk.embedding,
          content: chunk.content,
          metadata: {
            category: chunk.category,
            audience: chunk.audience,
            source: 'admin', // Default source
            timestamp: new Date(chunk.lastUpdated),
            version: '1.0',
            tags: [
              ...chunk.agentTypes,
              chunk.title, // Include title as tag for better searchability
            ],
          },
        };

        vectorDocs.push(vectorDoc);

        // Initialize usage count in cache
        this.usageCountCache.set(chunk.id, chunk.usageCount || 0);
      }

      // Batch upsert to vector database
      const result = await this.vectorDB.upsertBatch(vectorDocs);

      if (result.success) {
        console.log(`✅ Added ${chunks.length} knowledge chunks to VectorDB (unlimited storage)`);
      } else {
        console.error(`❌ Failed to add ${result.failedCount} chunks to VectorDB`);
        throw new Error(`Failed to add ${result.failedCount} chunks`);
      }
    } catch (error) {
      console.error('Error adding knowledge chunks:', error);
      throw new Error('Failed to add knowledge chunks');
    }
  }

  /**
   * Generate embedding for text using Gemini
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // For now, we'll use a simple approach with Gemini
      // In production, you might want to use a dedicated embedding model
      const prompt = `Generate a semantic embedding for this text: "${text}"`;
      
      const result = await this.embeddingModel.generateContent(prompt);
      const response = await result.response;
      const textResponse = response.text();
      
      // Parse the response to extract embedding vector
      // This is a simplified approach - in production you'd use proper embedding APIs
      const embedding = this.parseEmbeddingFromResponse(textResponse);
      
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Return a simple hash-based embedding as fallback
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Parse embedding from Gemini response (simplified)
   */
  private parseEmbeddingFromResponse(response: string): number[] {
    // This is a simplified approach - in production you'd use proper embedding APIs
    // For now, we'll generate a simple vector based on text characteristics
    const words = response.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0); // Standard embedding size
    
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      embedding[index % 384] += hash / 1000;
    });
    
    return embedding;
  }

  /**
   * Generate fallback embedding using simple hash
   */
  private generateFallbackEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0);
    
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      embedding[index % 384] += hash / 1000;
    });
    
    return embedding;
  }

  /**
   * Simple hash function for fallback embedding
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Retrieve relevant knowledge chunks based on query and agent type
   * All entries are accessible, but relevance is determined by audience and semantic similarity
   * Now uses VectorDBService for unlimited scalability
   */
  async retrieveKnowledge(query: RAGQuery): Promise<RAGResult> {
    try {
      const { query: userQuery, agentType, context, audience, maxResults = 3 } = query;

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(userQuery);

      // Build vector search query with filters
      // Note: We retrieve more results initially to allow for audience-based re-ranking
      const searchQuery: VectorSearchQuery = {
        embedding: queryEmbedding,
        topK: maxResults * 3, // Get more results for re-ranking
        filters: {
          tags: agentType ? [agentType] : undefined, // Filter by agent type via tags
        },
        minScore: 0.5, // Only return reasonably similar results
      };

      // Search vector database
      const searchResults = await this.vectorDB.search(searchQuery);

      // Convert VectorDocuments back to KnowledgeChunks and apply audience boosting
      const scoredChunks = searchResults.map(result => {
        let score = result.score;

        // Boost relevance if audience matches (but don't filter out - all entries are accessible)
        if (audience && result.document.metadata.audience.includes(audience)) {
          // Boost score by 20% for audience match
          score = score * 1.2;
        }

        // Convert VectorDocument to KnowledgeChunk
        const chunk: KnowledgeChunk = {
          id: result.document.id,
          title: result.document.metadata.tags?.[result.document.metadata.tags.length - 1] || 'Untitled',
          content: result.document.content,
          category: result.document.metadata.category,
          agentTypes: result.document.metadata.tags?.filter(tag =>
            ['CaseAgent', 'TwitterAgent', 'InstagramAgent'].includes(tag)
          ) || [],
          audience: result.document.metadata.audience,
          embedding: result.document.embedding,
          lastUpdated: result.document.metadata.timestamp.toISOString(),
          usageCount: this.usageCountCache.get(result.document.id) || 0,
        };

        return { chunk, score };
      });

      // Re-sort by boosted scores and get top results
      const topChunks = scoredChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(item => item.chunk);

      // Update usage count in cache
      topChunks.forEach(chunk => {
        const newCount = (this.usageCountCache.get(chunk.id) || 0) + 1;
        this.usageCountCache.set(chunk.id, newCount);
        chunk.usageCount = newCount;
      });

      // Clean cache if too large
      if (this.usageCountCache.size > this.maxCacheSize) {
        this.cleanupUsageCache();
      }

      return {
        chunks: topChunks,
        totalResults: searchResults.length,
        query: userQuery,
        agentType
      };
    } catch (error) {
      console.error('Error retrieving knowledge:', error);
      return {
        chunks: [],
        totalResults: 0,
        query: query.query,
        agentType: query.agentType
      };
    }
  }

  /**
   * Clean up usage count cache to prevent memory leaks
   */
  private cleanupUsageCache(): void {
    // Sort by usage count and keep the most used chunks
    const sorted = Array.from(this.usageCountCache.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.maxCacheSize);

    this.usageCountCache = new Map(sorted);
    console.log(`🧹 Cleaned up usage count cache, keeping ${this.usageCountCache.size} entries`);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Get all knowledge chunks (for debugging/admin purposes)
   * Note: This may be expensive with large vector databases
   */
  async getAllKnowledgeChunks(): Promise<KnowledgeChunk[]> {
    console.warn('[RAGService] getAllKnowledgeChunks not fully supported with VectorDB - returning empty array');
    return [];
    // Note: Vertex AI doesn't provide a way to list all vectors efficiently
    // For admin purposes, maintain a separate metadata store or use in-memory backend
  }

  /**
   * Clear all knowledge chunks
   */
  async clearKnowledgeChunks(): Promise<void> {
    try {
      await this.vectorDB.clear();
      this.usageCountCache.clear();
      console.log('[RAGService] Cleared all knowledge chunks from VectorDB');
    } catch (error) {
      console.error('Error clearing knowledge chunks:', error);
      throw new Error('Failed to clear knowledge chunks');
    }
  }

  /**
   * Update a specific knowledge chunk
   */
  async updateKnowledgeChunk(chunkId: string, updates: Partial<KnowledgeChunk>): Promise<boolean> {
    try {
      // For updates, we need to upsert the entire document
      // First, search for the existing chunk to get full data
      // Then apply updates and upsert

      // Generate new embedding if content changed
      let embedding = updates.embedding;
      if (updates.content && !embedding) {
        embedding = await this.generateEmbedding(updates.content);
      }

      // Create updated vector document
      // Note: This assumes we have all required fields in updates or use defaults
      const vectorDoc: VectorDocument = {
        id: chunkId,
        embedding: embedding || [],
        content: updates.content || '',
        metadata: {
          category: updates.category || 'general',
          audience: updates.audience || [],
          source: 'admin',
          timestamp: updates.lastUpdated ? new Date(updates.lastUpdated) : new Date(),
          version: '1.0',
          tags: [
            ...(updates.agentTypes || []),
            updates.title || '',
          ],
        },
      };

      // Upsert to vector database
      await this.vectorDB.upsert(vectorDoc);

      // Update usage count cache if provided
      if (updates.usageCount !== undefined) {
        this.usageCountCache.set(chunkId, updates.usageCount);
      }

      console.log(`✅ Updated knowledge chunk: ${chunkId}`);
      return true;
    } catch (error) {
      console.error('Error updating knowledge chunk:', error);
      return false;
    }
  }

  /**
   * Delete a knowledge chunk
   */
  async deleteKnowledgeChunk(chunkId: string): Promise<boolean> {
    try {
      await this.vectorDB.delete(chunkId);
      this.usageCountCache.delete(chunkId);
      console.log(`✅ Deleted knowledge chunk: ${chunkId}`);
      return true;
    } catch (error) {
      console.error('Error deleting knowledge chunk:', error);
      return false;
    }
  }

  /**
   * Get memory usage statistics
   */
  async getMemoryStats(): Promise<{ chunks: number; unlimited: boolean; cacheSize: number; memoryUsage: string }> {
    const count = await this.vectorDB.count();
    const cacheSize = this.usageCountCache.size;

    const memoryUsage = count === -1
      ? `Unlimited (VectorDB backend)`
      : `${count} chunks (unlimited storage)`;

    return {
      chunks: count,
      unlimited: true,
      cacheSize,
      memoryUsage
    };
  }

  /**
   * Force cleanup of memory
   */
  forceCleanup(): void {
    this.cleanupUsageCache();
    console.log('🧹 Forced memory cleanup completed (usage cache only)');
  }
}
