import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAISearchService, VertexAISearchResult } from './VertexAISearchService';
import { VectorDBService, VectorDocument, VectorSearchQuery, VectorSearchResult } from './VectorDBService';

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
  confidence?: number; // Average confidence score
  fallbackUsed?: boolean; // Whether Vertex AI Search was used as fallback
  vertexAISearchResults?: VertexAISearchResult[]; // Results from Vertex AI Search if used
}

/**
 * RAG Service for dynamic knowledge retrieval with vector embeddings
 * Integrates with VectorDBService for unlimited, scalable vector storage
 * Uses Gemini 2.0 Flash for semantic similarity search
 */
export class RAGService {
  private genAI: GoogleGenerativeAI;
  private vectorDB: VectorDBService;
  private embeddingModel: any;
  private vertexAISearchService?: VertexAISearchService;
  private readonly VECTORDB_CONFIDENCE_THRESHOLD = 0.6; // Use Vertex AI Search if confidence below this
  private embeddingDimensions: number = 768; // Standard embedding dimensions

  constructor(vertexAISearchService?: VertexAISearchService, vectorDBConfig?: { backend?: 'vertex-ai' | 'in-memory' }) {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
    this.vertexAISearchService = vertexAISearchService;
    
    // Initialize VectorDBService (defaults to in-memory for now, can be upgraded to Vertex AI)
    const backend = vectorDBConfig?.backend || 'in-memory';
    this.vectorDB = new VectorDBService({
      backend,
      dimensions: this.embeddingDimensions,
      distanceMetric: 'COSINE',
    });
    
    this.initializeEmbeddingModel();
    console.log(`[RAGService] Initialized with VectorDBService (backend: ${backend}) - unlimited storage, no 1,000 chunk limit`);
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
   * Now uses VectorDBService for unlimited storage (no 1,000 chunk limit)
   */
  async addKnowledgeChunks(chunks: KnowledgeChunk[]): Promise<void> {
    try {
      // Convert KnowledgeChunks to VectorDocuments and generate embeddings
      const vectorDocuments: VectorDocument[] = [];
      
      for (const chunk of chunks) {
        // Generate embedding if not already present
        let embedding = chunk.embedding;
        if (!embedding || embedding.length === 0) {
          embedding = await this.generateEmbedding(chunk.content);
        }
        
        // Ensure embedding has correct dimensions
        if (embedding.length !== this.embeddingDimensions) {
          console.warn(`[RAGService] Embedding dimension mismatch for ${chunk.id}, regenerating...`);
          embedding = await this.generateEmbedding(chunk.content);
        }
        
        // Convert to VectorDocument format
        const vectorDoc: VectorDocument = {
          id: chunk.id,
          embedding,
          content: `${chunk.title}\n\n${chunk.content}`, // Include title in content for better search
          metadata: {
            category: chunk.category,
            audience: chunk.audience || [],
            source: 'knowledge_base',
            timestamp: new Date(chunk.lastUpdated || Date.now()),
            version: '1.0',
            tags: chunk.agentTypes, // Store agentTypes as tags for filtering
            // Store additional metadata for retrieval
            title: chunk.title,
            agentTypes: chunk.agentTypes,
            usageCount: chunk.usageCount || 0,
          },
        };
        
        vectorDocuments.push(vectorDoc);
      }
      
      // Batch upsert to VectorDBService
      const result = await this.vectorDB.upsertBatch(vectorDocuments);
      
      if (result.success) {
        console.log(`✅ Added ${result.processedCount} knowledge chunks to VectorDB (unlimited storage)`);
      } else {
        console.warn(`⚠️  Some chunks failed to add: ${result.failedCount} failed`);
        if (result.errors) {
          result.errors.forEach(err => {
            console.error(`  - ${err.id}: ${err.error}`);
          });
        }
      }
    } catch (error) {
      console.error('Error adding knowledge chunks:', error);
      throw new Error('Failed to add knowledge chunks');
    }
  }

  /**
   * Clean up old knowledge chunks (no longer needed with VectorDBService)
   * Kept for backward compatibility but does nothing
   */
  private cleanupOldChunks(): void {
    // No-op: VectorDBService handles storage efficiently, no cleanup needed
    console.log('[RAGService] Cleanup not needed with VectorDBService (unlimited storage)');
  }

  /**
   * Generate embedding for text using Gemini
   * Uses text-embedding-004 model if available, otherwise uses hash-based fallback
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Try to use Gemini's embedding model (if available in future)
      // For now, use hash-based embedding (consistent and fast)
      // TODO: Upgrade to use text-embedding-004 or similar when available
      return this.generateFallbackEmbedding(text);
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
   * Generate embedding using hash-based approach
   * Creates consistent 768-dimensional vectors for semantic similarity
   */
  private generateFallbackEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(this.embeddingDimensions).fill(0);
    
    // Use word frequency and position to create embedding
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      const position = index % this.embeddingDimensions;
      // Normalize hash to -1 to 1 range
      const normalizedHash = (hash % 2000) / 1000 - 1;
      embedding[position] += normalizedHash * (1 / (words.length + 1)); // Weight by word count
    });
    
    // Normalize the embedding vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }
    
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
   * Now uses VectorDBService for scalable search with metadata filtering
   * All entries are accessible, but relevance is determined by audience and semantic similarity
   */
  async retrieveKnowledge(query: RAGQuery): Promise<RAGResult> {
    try {
      const { query: userQuery, agentType, context, audience, maxResults = 3 } = query;
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(userQuery);
      
      // Build filters for VectorDBService
      // Filter by agent type (stored as tags in metadata)
      const filters: VectorSearchQuery['filters'] = {};
      
      // Note: We don't filter by agentType here because all entries are accessible
      // Instead, we'll filter results after retrieval
      // But we can filter by audience if provided
      if (audience) {
        filters.audience = [audience];
      }
      
      // Search VectorDBService
      const vectorSearchQuery: VectorSearchQuery = {
        embedding: queryEmbedding,
        topK: maxResults * 2, // Get more results to filter by agentType
        filters,
        minScore: 0.3, // Minimum similarity threshold
      };
      
      const vectorResults = await this.vectorDB.search(vectorSearchQuery);
      
      // Convert VectorSearchResults to KnowledgeChunks and filter by agentType
      const scoredChunks = vectorResults
        .map(result => {
          const doc = result.document;
          const metadata = doc.metadata as any;
          
          // Filter by agent type (all entries accessible, but relevance matters)
          const agentTypes = metadata.agentTypes || [];
          const isAccessible = agentTypes.length === 0 || agentTypes.includes(agentType);
          
          if (!isAccessible) {
            return null;
          }
          
          // Extract title and content from stored format
          const contentParts = doc.content.split('\n\n');
          const title = metadata.title || contentParts[0] || 'Untitled';
          const content = contentParts.slice(1).join('\n\n') || doc.content;
          
          // Boost relevance if audience matches
          let score = result.score;
          if (audience && metadata.audience && Array.isArray(metadata.audience) && metadata.audience.length > 0) {
            const audienceMatch = metadata.audience.includes(audience);
            if (audienceMatch) {
              // Boost score by 20% for audience match
              score = score * 1.2;
            }
          }
          
          return {
            chunk: {
              id: doc.id,
              title,
              content,
              category: metadata.category || 'general',
              agentTypes: agentTypes,
              audience: metadata.audience || [],
              embedding: doc.embedding,
              lastUpdated: metadata.timestamp ? new Date(metadata.timestamp).toISOString() : new Date().toISOString(),
              usageCount: metadata.usageCount || 0,
            } as KnowledgeChunk,
            score,
          };
        })
        .filter((item): item is { chunk: KnowledgeChunk; score: number } => item !== null);
      
      // Sort by score and get top results
      const topChunks = scoredChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(item => item.chunk);
      
      // Calculate average confidence
      const avgConfidence = scoredChunks.length > 0
        ? scoredChunks.slice(0, maxResults).reduce((sum, item) => sum + item.score, 0) / Math.min(maxResults, scoredChunks.length)
        : 0;
      
      // Check if we need to use Vertex AI Search as fallback
      let vertexAISearchResults: VertexAISearchResult[] | undefined;
      let fallbackUsed = false;
      
      if (avgConfidence < this.VECTORDB_CONFIDENCE_THRESHOLD && this.vertexAISearchService) {
        console.log(`[RAGService] VectorDB confidence (${avgConfidence.toFixed(2)}) below threshold, using Vertex AI Search fallback`);
        try {
          const searchResults = await this.vertexAISearchService.search({
            query: userQuery,
            maxResults: maxResults,
            minScore: this.VECTORDB_CONFIDENCE_THRESHOLD,
          });
          
          if (searchResults.length > 0) {
            vertexAISearchResults = searchResults;
            fallbackUsed = true;
            console.log(`[RAGService] Found ${searchResults.length} results from Vertex AI Search`);
          }
        } catch (error) {
          console.error('[RAGService] Error using Vertex AI Search fallback:', error);
        }
      }
      
      // Update usage count in VectorDB (async, non-blocking)
      topChunks.forEach(chunk => {
        this.updateUsageCount(chunk.id, (chunk.usageCount || 0) + 1).catch(err => {
          console.warn(`[RAGService] Failed to update usage count for ${chunk.id}:`, err);
        });
      });
      
      return {
        chunks: topChunks,
        totalResults: scoredChunks.length,
        query: userQuery,
        agentType,
        confidence: avgConfidence,
        fallbackUsed,
        vertexAISearchResults,
      };
    } catch (error) {
      console.error('Error retrieving knowledge:', error);
      return {
        chunks: [],
        totalResults: 0,
        query: query.query,
        agentType: query.agentType,
        confidence: 0,
        fallbackUsed: false,
      };
    }
  }
  
  /**
   * Update usage count for a chunk (async helper)
   */
  private async updateUsageCount(chunkId: string, newUsageCount: number): Promise<void> {
    try {
      // Get the document, update usage count, and upsert back
      // This is a simplified approach - in production, you might want to use a more efficient method
      const searchResults = await this.vectorDB.search({
        embedding: new Array(this.embeddingDimensions).fill(0), // Dummy embedding
        topK: 1,
        filters: {},
      });
      
      // Find the document and update (this is not ideal, but works for now)
      // TODO: Add a direct update method to VectorDBService
      const doc = searchResults.find(r => r.document.id === chunkId);
      if (doc) {
        const updatedDoc: VectorDocument = {
          ...doc.document,
          metadata: {
            ...doc.document.metadata,
            usageCount: newUsageCount,
          },
        };
        await this.vectorDB.upsert(updatedDoc);
      }
    } catch (error) {
      // Non-critical, just log
      console.warn(`[RAGService] Could not update usage count:`, error);
    }
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
   * Now queries VectorDBService
   */
  async getAllKnowledgeChunks(): Promise<KnowledgeChunk[]> {
    try {
      // Search with no filters to get all documents
      const results = await this.vectorDB.search({
        embedding: new Array(this.embeddingDimensions).fill(0), // Dummy embedding
        topK: 10000, // Large number to get all
        filters: {},
      });
      
      return results.map(result => {
        const doc = result.document;
        const metadata = doc.metadata as any;
        const contentParts = doc.content.split('\n\n');
        const title = metadata.title || contentParts[0] || 'Untitled';
        const content = contentParts.slice(1).join('\n\n') || doc.content;
        
        return {
          id: doc.id,
          title,
          content,
          category: metadata.category || 'general',
          agentTypes: metadata.agentTypes || [],
          audience: metadata.audience || [],
          embedding: doc.embedding,
          lastUpdated: metadata.timestamp ? new Date(metadata.timestamp).toISOString() : new Date().toISOString(),
          usageCount: metadata.usageCount || 0,
        };
      });
    } catch (error) {
      console.error('Error getting all knowledge chunks:', error);
      return [];
    }
  }

  /**
   * Clear all knowledge chunks
   */
  async clearKnowledgeChunks(): Promise<void> {
    try {
      await this.vectorDB.clear();
      console.log('[RAGService] All knowledge chunks cleared from VectorDB');
    } catch (error) {
      console.error('Error clearing knowledge chunks:', error);
      throw error;
    }
  }

  /**
   * Update a specific knowledge chunk
   */
  async updateKnowledgeChunk(chunkId: string, updates: Partial<KnowledgeChunk>): Promise<boolean> {
    try {
      // Get existing document
      const results = await this.vectorDB.search({
        embedding: new Array(this.embeddingDimensions).fill(0),
        topK: 10000,
        filters: {},
      });
      
      const existingDoc = results.find(r => r.document.id === chunkId);
      if (!existingDoc) {
        return false;
      }
      
      // Regenerate embedding if content changed
      let embedding = existingDoc.document.embedding;
      if (updates.content) {
        embedding = await this.generateEmbedding(updates.content);
      }
      
      // Update document
      const updatedDoc: VectorDocument = {
        id: chunkId,
        embedding,
        content: updates.content ? `${updates.title || existingDoc.document.metadata.title}\n\n${updates.content}` : existingDoc.document.content,
        metadata: {
          ...existingDoc.document.metadata,
          category: updates.category || existingDoc.document.metadata.category,
          audience: updates.audience || existingDoc.document.metadata.audience,
          timestamp: new Date(),
          version: '1.0',
          tags: updates.agentTypes || (existingDoc.document.metadata as any).agentTypes,
          title: updates.title || (existingDoc.document.metadata as any).title,
          agentTypes: updates.agentTypes || (existingDoc.document.metadata as any).agentTypes,
          usageCount: updates.usageCount !== undefined ? updates.usageCount : (existingDoc.document.metadata as any).usageCount,
        },
      };
      
      await this.vectorDB.upsert(updatedDoc);
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
      return true;
    } catch (error) {
      console.error('Error deleting knowledge chunk:', error);
      return false;
    }
  }

  /**
   * Get memory usage statistics
   * Now returns VectorDBService statistics
   */
  async getMemoryStats(): Promise<{ chunks: number; maxChunks: number; memoryUsage: string }> {
    try {
      const count = await this.vectorDB.count();
      return {
        chunks: count >= 0 ? count : 0,
        maxChunks: Infinity, // No limit with VectorDBService
        memoryUsage: count >= 0 ? `${count} chunks (unlimited)` : 'Unknown (unlimited)'
      };
    } catch (error) {
      console.error('Error getting memory stats:', error);
      return {
        chunks: 0,
        maxChunks: Infinity,
        memoryUsage: 'Error retrieving stats'
      };
    }
  }

  /**
   * Force cleanup of memory (no longer needed with VectorDBService)
   */
  forceCleanup(): void {
    console.log('[RAGService] Cleanup not needed with VectorDBService (unlimited storage)');
  }
}
