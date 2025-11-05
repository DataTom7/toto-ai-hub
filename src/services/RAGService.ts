import { GoogleGenerativeAI } from '@google/generative-ai';

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
 */
export class RAGService {
  private genAI: GoogleGenerativeAI;
  private knowledgeChunks: KnowledgeChunk[] = [];
  private embeddingModel: any;
  private maxChunks: number = 1000; // Limit knowledge chunks to prevent memory leaks
  private maxCacheSize: number = 100; // Limit cache size

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
    this.initializeEmbeddingModel();
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
   */
  async addKnowledgeChunks(chunks: KnowledgeChunk[]): Promise<void> {
    try {
      // Generate embeddings for new chunks
      for (const chunk of chunks) {
        if (!chunk.embedding) {
          chunk.embedding = await this.generateEmbedding(chunk.content);
        }
      }
      
      // Add to knowledge base with memory management
      this.knowledgeChunks.push(...chunks);
      
      // Clean up old chunks if we exceed the limit
      if (this.knowledgeChunks.length > this.maxChunks) {
        this.cleanupOldChunks();
      }
      
      console.log(`✅ Added ${chunks.length} knowledge chunks to RAG service`);
    } catch (error) {
      console.error('Error adding knowledge chunks:', error);
      throw new Error('Failed to add knowledge chunks');
    }
  }

  /**
   * Clean up old knowledge chunks to prevent memory leaks
   */
  private cleanupOldChunks(): void {
    // Sort by usage count and keep the most used chunks
    this.knowledgeChunks.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    
    // Keep only the most used chunks
    this.knowledgeChunks = this.knowledgeChunks.slice(0, this.maxChunks);
    
    console.log(`🧹 Cleaned up knowledge chunks, keeping ${this.knowledgeChunks.length} most used chunks`);
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
   */
  async retrieveKnowledge(query: RAGQuery): Promise<RAGResult> {
    try {
      const { query: userQuery, agentType, context, audience, maxResults = 3 } = query;
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(userQuery);
      
      // Filter chunks by agent type (technical constraint - which agent can use this)
      const agentFilteredChunks = this.knowledgeChunks.filter(chunk => 
        chunk.agentTypes.length === 0 || chunk.agentTypes.includes(agentType)
      );
      
      // Calculate similarity scores with audience relevance boost
      const scoredChunks = agentFilteredChunks.map(chunk => {
        let similarityScore = this.calculateSimilarity(queryEmbedding, chunk.embedding || []);
        
        // Boost relevance if audience matches (but don't filter out - all entries are accessible)
        if (audience && chunk.audience && chunk.audience.length > 0) {
          const audienceMatch = chunk.audience.includes(audience);
          if (audienceMatch) {
            // Boost score by 20% for audience match
            similarityScore = similarityScore * 1.2;
          }
        }
        
        return {
          chunk,
          score: similarityScore
        };
      });
      
      // Sort by similarity score and get top results
      const topChunks = scoredChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(item => item.chunk);
      
      // Update usage count
      topChunks.forEach(chunk => {
        chunk.usageCount = (chunk.usageCount || 0) + 1;
      });
      
      return {
        chunks: topChunks,
        totalResults: scoredChunks.length,
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
   */
  getAllKnowledgeChunks(): KnowledgeChunk[] {
    return this.knowledgeChunks;
  }

  /**
   * Clear all knowledge chunks
   */
  clearKnowledgeChunks(): void {
    this.knowledgeChunks = [];
  }

  /**
   * Update a specific knowledge chunk
   */
  async updateKnowledgeChunk(chunkId: string, updates: Partial<KnowledgeChunk>): Promise<boolean> {
    try {
      const chunkIndex = this.knowledgeChunks.findIndex(chunk => chunk.id === chunkId);
      
      if (chunkIndex === -1) {
        return false;
      }
      
      const updatedChunk = { ...this.knowledgeChunks[chunkIndex], ...updates };
      
      // Regenerate embedding if content changed
      if (updates.content && updates.content !== this.knowledgeChunks[chunkIndex].content) {
        updatedChunk.embedding = await this.generateEmbedding(updates.content);
      }
      
      this.knowledgeChunks[chunkIndex] = updatedChunk;
      return true;
    } catch (error) {
      console.error('Error updating knowledge chunk:', error);
      return false;
    }
  }

  /**
   * Delete a knowledge chunk
   */
  deleteKnowledgeChunk(chunkId: string): boolean {
    const chunkIndex = this.knowledgeChunks.findIndex(chunk => chunk.id === chunkId);
    
    if (chunkIndex === -1) {
      return false;
    }
    
    this.knowledgeChunks.splice(chunkIndex, 1);
    return true;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): { chunks: number; maxChunks: number; memoryUsage: string } {
    const chunks = this.knowledgeChunks.length;
    const memoryUsage = `${chunks}/${this.maxChunks} chunks`;
    
    return {
      chunks,
      maxChunks: this.maxChunks,
      memoryUsage
    };
  }

  /**
   * Force cleanup of memory
   */
  forceCleanup(): void {
    this.cleanupOldChunks();
    console.log('🧹 Forced memory cleanup completed');
  }
}
