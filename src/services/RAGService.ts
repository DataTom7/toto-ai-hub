import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAISearchService, VertexAISearchResult } from './VertexAISearchService';
import { VectorDBService, VectorDocument, VectorSearchQuery, VectorSearchResult } from './VectorDBService';
import { PredictionServiceClient } from '@google-cloud/aiplatform';

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
  private predictionClient?: PredictionServiceClient;
  private readonly VECTORDB_CONFIDENCE_THRESHOLD = 0.6; // Use Vertex AI Search if confidence below this
  private embeddingDimensions: number = 768; // text-embedding-004 dimensions
  private useVertexAIEmbeddings: boolean = false;

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
    this.initializeVertexAIEmbeddings();
    console.log(`[RAGService] Initialized with VectorDBService (backend: ${backend}) - unlimited storage, no 1,000 chunk limit`);
    if (this.useVertexAIEmbeddings) {
      console.log(`[RAGService] Using Vertex AI text-embedding-004 for multilingual embeddings`);
    } else {
      console.log(`[RAGService] Using Gemini-based multilingual embeddings (fallback mode)`);
    }
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
   * Initialize Vertex AI text-embedding-004 for multilingual embeddings
   * Supports 100+ languages with semantic understanding
   */
  private initializeVertexAIEmbeddings() {
    try {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.VERTEX_AI_PROJECT_ID;
      const location = process.env.VERTEX_AI_LOCATION || 'us-central1';

      if (projectId) {
        this.predictionClient = new PredictionServiceClient({
          apiEndpoint: `${location}-aiplatform.googleapis.com`,
        });
        this.useVertexAIEmbeddings = true;
        console.log(`[RAGService] ✅ Vertex AI text-embedding-004 enabled (multilingual support)`);
        console.log(`[RAGService]    Project: ${projectId}, Location: ${location}`);
      } else {
        console.log(`[RAGService] ⚠️  Vertex AI not configured, using Gemini-based embeddings`);
        this.useVertexAIEmbeddings = false;
      }
    } catch (error) {
      console.warn('[RAGService] ⚠️  Failed to initialize Vertex AI embeddings, using fallback:', error);
      this.useVertexAIEmbeddings = false;
    }
  }

  /**
   * Add knowledge chunks to the RAG service
   * Now uses VectorDBService for unlimited storage (no 1,000 chunk limit)
   */
  async addKnowledgeChunks(chunks: KnowledgeChunk[], knowledgeBaseService?: any): Promise<void> {
    console.log(`[RAGService] addKnowledgeChunks() called with ${chunks.length} chunks`);
    try {
      if (chunks.length === 0) {
        console.warn('[RAGService] addKnowledgeChunks: No chunks provided!');
        return;
      }
      
      // Convert KnowledgeChunks to VectorDocuments and generate embeddings
      const vectorDocuments: VectorDocument[] = [];
      const chunksNeedingEmbedding: Array<{ id: string; embedding: number[] }> = [];
      let cachedCount = 0;
      let generatedCount = 0;

      for (const chunk of chunks) {
        // Generate embedding if not already present
        let embedding = chunk.embedding;
        if (!embedding || embedding.length === 0) {
          embedding = await this.generateEmbedding(chunk.content);
          generatedCount++;
          console.log(`[RAGService] Generated embedding for ${chunk.id}: ${embedding.length} dimensions`);
          // Track chunks that need embedding cached to Firestore
          chunksNeedingEmbedding.push({ id: chunk.id, embedding });
        } else {
          cachedCount++;
          console.log(`[RAGService] Using cached embedding for ${chunk.id}: ${embedding.length} dimensions`);
        }

        // Ensure embedding has correct dimensions
        if (embedding.length !== this.embeddingDimensions) {
          console.warn(`[RAGService] Embedding dimension mismatch for ${chunk.id}, regenerating...`);
          embedding = await this.generateEmbedding(chunk.content);
          generatedCount++;
          chunksNeedingEmbedding.push({ id: chunk.id, embedding });
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
      console.log(`[RAGService] Upserting ${vectorDocuments.length} vector documents to VectorDB...`);
      const result = await this.vectorDB.upsertBatch(vectorDocuments);

      if (result.success) {
        console.log(`✅ Added ${result.processedCount} knowledge chunks to VectorDB`);
        console.log(`   📊 Embeddings: ${cachedCount} cached, ${generatedCount} generated`);
        
        // Verify the documents were actually added
        const count = await this.vectorDB.count();
        console.log(`[RAGService] VectorDB now contains ${count} documents`);
      } else {
        console.warn(`⚠️  Some chunks failed to add: ${result.failedCount} failed`);
        if (result.errors) {
          result.errors.forEach(err => {
            console.error(`  - ${err.id}: ${err.error}`);
          });
        }
      }

      // Save newly generated embeddings back to Firestore for future use
      if (chunksNeedingEmbedding.length > 0 && knowledgeBaseService) {
        console.log(`💾 Caching ${chunksNeedingEmbedding.length} embeddings to Firestore...`);
        try {
          await knowledgeBaseService.cacheEmbeddings(chunksNeedingEmbedding);
          console.log(`✅ Embeddings cached successfully`);
        } catch (cacheError) {
          console.warn('⚠️  Failed to cache embeddings (non-critical):', cacheError);
          // Don't throw - caching is optimization, not critical
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
   * Generate embedding for text using multilingual embedding model
   * Priority: Vertex AI text-embedding-004 > Gemini-based > Hash-based fallback
   * Public method for use by other services (e.g., intent detection)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Try Vertex AI text-embedding-004 first (best multilingual support)
      // Currently disabled - will be enabled when GCP setup is complete
      if (this.useVertexAIEmbeddings) {
        try {
          return await this.generateVertexAIEmbedding(text, 'RETRIEVAL_DOCUMENT');
        } catch (error) {
          console.warn('[RAGService] Vertex AI embedding failed, falling back to translation-based:', error);
        }
      }

      // Fallback to Gemini-based multilingual embedding
      return await this.generateGeminiMultilingualEmbedding(text);
    } catch (error) {
      console.error('[RAGService] Error generating embedding, using hash-based fallback:', error);
      // Last resort: hash-based embedding
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Generate embedding using Vertex AI text-embedding-004 (multilingual)
   * Supports 100+ languages natively - no translation needed!
   * @param text The text to embed (any language)
   * @param taskType 'RETRIEVAL_DOCUMENT' for KB entries, 'RETRIEVAL_QUERY' for user queries
   */
  private async generateVertexAIEmbedding(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'): Promise<number[]> {
    if (!this.predictionClient) {
      throw new Error('Vertex AI client not initialized');
    }

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.VERTEX_AI_PROJECT_ID;
    const location = process.env.VERTEX_AI_LOCATION || 'us-central1';
    const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/text-embedding-004`;

    const instance = {
      structValue: {
        fields: {
          content: { stringValue: text },
          task_type: { stringValue: taskType },
        },
      },
    };

    const request = {
      endpoint,
      instances: [instance],
    };

    const [response] = await this.predictionClient.predict(request);
    const predictions = response?.predictions || [];

    if (!predictions || predictions.length === 0) {
      throw new Error('No embeddings returned from Vertex AI');
    }

    // Extract embedding values from prediction
    const prediction = predictions[0];
    const embeddingValues = (prediction as any)?.structValue?.fields?.embeddings?.structValue?.fields?.values?.listValue?.values;

    if (!embeddingValues) {
      throw new Error('Invalid response format from Vertex AI');
    }

    const embedding = embeddingValues.map((v: any) => v.numberValue);

    if (embedding.length !== this.embeddingDimensions) {
      throw new Error(`Unexpected embedding dimensions: ${embedding.length}, expected ${this.embeddingDimensions}`);
    }

    return embedding;
  }

  /**
   * Generate embedding for user queries (uses RETRIEVAL_QUERY task type)
   */
  private async generateQueryEmbedding(text: string): Promise<number[]> {
    try {
      // Try Vertex AI text-embedding-004 first (best multilingual support)
      if (this.useVertexAIEmbeddings) {
        console.log('[RAGService] Using Vertex AI for query embedding');
        try {
          return await this.generateVertexAIEmbedding(text, 'RETRIEVAL_QUERY');
        } catch (error) {
          console.warn('[RAGService] Vertex AI query embedding failed, falling back to Gemini:', error);
        }
      } else {
        console.log('[RAGService] Vertex AI NOT enabled, using Gemini fallback');
      }

      // Fallback to Gemini-based multilingual embedding
      console.log('[RAGService] Using Gemini for query embedding');
      return await this.generateGeminiMultilingualEmbedding(text);
    } catch (error) {
      console.error('[RAGService] Error generating query embedding, using hash-based fallback:', error);
      // Last resort: hash-based embedding
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Generate multilingual embedding using Gemini (fallback when Vertex AI not available)
   * Uses Gemini to create semantic embeddings that work across languages
   */
  private async generateGeminiMultilingualEmbedding(text: string): Promise<number[]> {
    try {
      // Use Gemini to generate a semantic representation
      // We'll use a prompt-based approach to get consistent embeddings
      const embeddingPrompt = `Generate a semantic embedding representation for the following text. 
The text may be in any language (Spanish, English, Portuguese, etc.).
Return only a JSON array of 768 numbers representing the semantic meaning.

Text: "${text}"

Return format: [0.123, -0.456, 0.789, ...] (768 numbers total)`;

      const result = await this.embeddingModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: embeddingPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      });

      const response = result.response.text();
      
      // Try to parse JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const embedding = JSON.parse(jsonMatch[0]);
        if (Array.isArray(embedding) && embedding.length === this.embeddingDimensions) {
          // Normalize the embedding
          const magnitude = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
          if (magnitude > 0) {
            return embedding.map((val: number) => val / magnitude);
          }
          return embedding;
        }
      }

      // If JSON parsing fails, use a hybrid approach: translate to English then hash
      return await this.generateTranslationBasedEmbedding(text);
    } catch (error) {
      console.warn('[RAGService] Gemini embedding generation failed, using translation-based approach:', error);
      return await this.generateTranslationBasedEmbedding(text);
    }
  }

  /**
   * Generate embedding by translating to English first, then using semantic hash
   * This provides basic multilingual support when proper embeddings aren't available
   */
  private async generateTranslationBasedEmbedding(text: string): Promise<number[]> {
    try {
      // Detect if text is already in English (simple heuristic)
      const isEnglish = /^[a-zA-Z0-9\s.,!?'"\-:;()]+$/.test(text.trim());
      
      let englishText = text;
      if (!isEnglish) {
        // Translate to English using Gemini
        const translatePrompt = `Translate the following text to English. Return ONLY the English translation, no explanations.

Text: "${text}"

English translation:`;

        const result = await this.embeddingModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: translatePrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
          },
        });

        englishText = result.response.text().trim();
        // Remove quotes if present
        englishText = englishText.replace(/^["']|["']$/g, '');
      }

      // Now use the English text with improved hash-based embedding
      // This ensures Spanish "Cómo puedo ayudar?" → English "How can I help?" → same embedding space
      return this.generateImprovedHashEmbedding(englishText);
    } catch (error) {
      console.warn('[RAGService] Translation-based embedding failed, using basic hash:', error);
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Improved hash-based embedding that works better with English text
   * Used after translation to ensure consistent embedding space
   */
  private generateImprovedHashEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(this.embeddingDimensions).fill(0);
    
    // Enhanced word hashing with semantic weighting
    const semanticWords: { [key: string]: number } = {
      'help': 0.9, 'ayudar': 0.9, 'donate': 0.8, 'donar': 0.8,
      'share': 0.7, 'compartir': 0.7, 'adopt': 0.6, 'adoptar': 0.6,
      'how': 0.5, 'cómo': 0.5, 'can': 0.4, 'puedo': 0.4,
    };

    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      const position = index % this.embeddingDimensions;
      
      // Apply semantic weight if word is in our semantic dictionary
      const semanticWeight = semanticWords[word] || 1.0;
      const normalizedHash = (hash % 2000) / 1000 - 1;
      embedding[position] += normalizedHash * semanticWeight * (1 / (words.length + 1));
    });
    
    // Normalize the embedding vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }
    
    return embedding;
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
      
      // Generate embedding for the query (use RETRIEVAL_QUERY task type)
      const queryEmbedding = await this.generateQueryEmbedding(userQuery);
      console.log(`[RAGService] Query embedding dimensions: ${queryEmbedding.length}`);

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
        minScore: 0.3, // Minimum similarity threshold for relevant results
      };
      
      const vectorResults = await this.vectorDB.search(vectorSearchQuery);

      console.log(`[RAGService] VectorDB returned ${vectorResults.length} results for query: "${userQuery.substring(0, 50)}..."`);
      if (vectorResults.length > 0) {
        console.log(`[RAGService] Top result score: ${vectorResults[0].score?.toFixed(3)}, title: ${(vectorResults[0].document.metadata as any)?.title}`);
      }

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
              lastUpdated: (() => {
                if (metadata.timestamp) {
                  const date = new Date(metadata.timestamp);
                  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
                }
                return new Date().toISOString();
              })(),
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
          lastUpdated: (() => {
            if (metadata.timestamp) {
              const date = new Date(metadata.timestamp);
              return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
            }
            return new Date().toISOString();
          })(),
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
