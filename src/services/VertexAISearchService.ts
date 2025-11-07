/**
 * Vertex AI Search Service
 *
 * Provides Vertex AI Search capabilities for indexing and searching documentation.
 * This service indexes toto-docs and provides semantic search as a fallback
 * when VectorDB confidence is low.
 *
 * Features:
 * - Document indexing from toto-docs
 * - Semantic search with relevance scoring
 * - Integration with Grounded Generation API
 * - Automatic fallback when VectorDB confidence is low
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GoogleAuth } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Document to index in Vertex AI Search
 */
export interface SearchableDocument {
  id: string;
  title: string;
  content: string;
  source: string; // e.g., 'toto-docs/app/docs/ecosystem/fundraising-system.md'
  category?: string;
  metadata?: Record<string, any>;
}

/**
 * Search result from Vertex AI Search
 */
export interface VertexAISearchResult {
  document: SearchableDocument;
  score: number; // Relevance score (0-1)
  snippet?: string; // Relevant snippet from document
  metadata?: Record<string, any>;
}

/**
 * Search query parameters
 */
export interface VertexAISearchQuery {
  query: string;
  maxResults?: number;
  category?: string;
  minScore?: number;
}

/**
 * Vertex AI Search Service
 */
export class VertexAISearchService {
  private genAI: GoogleGenerativeAI;
  private auth: GoogleAuth;
  private projectId: string;
  private location: string;
  private dataStoreId?: string;
  private searchEngineId?: string;
  private isInitialized: boolean = false;

  // In-memory document store (fallback when Vertex AI Search is not configured)
  private documentStore: Map<string, SearchableDocument> = new Map();

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 
                     process.env.VERTEX_AI_PROJECT_ID || 
                     process.env.GCP_PROJECT_ID || '';
    this.location = process.env.VERTEX_AI_LOCATION || 'us-central1';
    this.dataStoreId = process.env.VERTEX_AI_DATA_STORE_ID;
    this.searchEngineId = process.env.VERTEX_AI_SEARCH_ENGINE_ID;

    console.log('[VertexAISearchService] Initialized');
    console.log(`[VertexAISearchService] Project: ${this.projectId}`);
    console.log(`[VertexAISearchService] Location: ${this.location}`);
    console.log(`[VertexAISearchService] Data Store ID: ${this.dataStoreId || 'Not configured'}`);
    console.log(`[VertexAISearchService] Search Engine ID: ${this.searchEngineId || 'Not configured'}`);
  }

  /**
   * Initialize Vertex AI Search (create data store if needed)
   * This should be called once during setup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // If Vertex AI Search is not configured, use in-memory fallback
      if (!this.dataStoreId && !this.searchEngineId) {
        console.log('[VertexAISearchService] Vertex AI Search not configured, using in-memory fallback');
        this.isInitialized = true;
        return;
      }

      // TODO: Initialize Vertex AI Search data store if needed
      // This would typically involve creating a data store via the Discovery Engine API
      // For now, we'll use Gemini's grounding capabilities as the primary method

      this.isInitialized = true;
      console.log('[VertexAISearchService] Initialization complete');
    } catch (error) {
      console.error('[VertexAISearchService] Initialization error:', error);
      // Continue with in-memory fallback
      this.isInitialized = true;
    }
  }

  /**
   * Index a document (add to in-memory store for now)
   * In production, this would index to Vertex AI Search
   */
  async indexDocument(document: SearchableDocument): Promise<boolean> {
    try {
      this.documentStore.set(document.id, document);
      console.log(`[VertexAISearchService] Indexed document: ${document.id}`);
      return true;
    } catch (error) {
      console.error('[VertexAISearchService] Error indexing document:', error);
      return false;
    }
  }

  /**
   * Index multiple documents
   */
  async indexDocuments(documents: SearchableDocument[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const doc of documents) {
      const result = await this.indexDocument(doc);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    console.log(`[VertexAISearchService] Indexed ${success} documents, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Search documents using semantic search
   * Uses Gemini for semantic similarity when Vertex AI Search is not configured
   */
  async search(query: VertexAISearchQuery): Promise<VertexAISearchResult[]> {
    try {
      const { query: searchQuery, maxResults = 5, category, minScore = 0.5 } = query;

      // If no documents indexed, return empty
      if (this.documentStore.size === 0) {
        console.log('[VertexAISearchService] No documents indexed, returning empty results');
        return [];
      }

      // Use Gemini for semantic search
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-001',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      });

      // Build document context
      const documents = Array.from(this.documentStore.values())
        .filter(doc => !category || doc.category === category);

      if (documents.length === 0) {
        return [];
      }

      // Create a prompt to find relevant documents
      const documentsText = documents.map((doc, idx) => 
        `[${idx}] ${doc.title}\n${doc.content.substring(0, 500)}...`
      ).join('\n\n');

      const searchPrompt = `Given the following query: "${searchQuery}"

Find the most relevant documents from this list and rank them by relevance (0.0 to 1.0):

${documentsText}

Return a JSON array with format: [{"index": 0, "score": 0.95, "reason": "explanation"}]
Only include documents with score >= ${minScore}.`;

      const result = await model.generateContent(searchPrompt);
      const response = result.response.text();

      // Parse response (simplified - in production, use structured output)
      const results: VertexAISearchResult[] = [];
      try {
        // Extract JSON from response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const rankings = JSON.parse(jsonMatch[0]);
          
          for (const ranking of rankings.slice(0, maxResults)) {
            if (ranking.score >= minScore && documents[ranking.index]) {
              const doc = documents[ranking.index];
              results.push({
                document: doc,
                score: ranking.score,
                snippet: doc.content.substring(0, 200),
                metadata: doc.metadata,
              });
            }
          }
        }
      } catch (parseError) {
        console.error('[VertexAISearchService] Error parsing search results:', parseError);
        // Fallback: simple keyword matching
        return this.fallbackKeywordSearch(searchQuery, documents, maxResults, minScore);
      }

      return results;
    } catch (error) {
      console.error('[VertexAISearchService] Search error:', error);
      return [];
    }
  }

  /**
   * Fallback keyword search when semantic search fails
   */
  private fallbackKeywordSearch(
    query: string,
    documents: SearchableDocument[],
    maxResults: number,
    minScore: number
  ): VertexAISearchResult[] {
    const queryWords = query.toLowerCase().split(/\s+/);
    
    const scored = documents.map(doc => {
      const content = (doc.title + ' ' + doc.content).toLowerCase();
      let matches = 0;
      
      for (const word of queryWords) {
        if (content.includes(word)) {
          matches++;
        }
      }
      
      const score = matches / queryWords.length;
      return { doc, score };
    })
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(item => ({
      document: item.doc,
      score: item.score,
      snippet: item.doc.content.substring(0, 200),
      metadata: item.doc.metadata,
    }));

    return scored;
  }

  /**
   * Load and index documentation from toto-docs directory
   */
  async indexDocumentation(docsPath: string): Promise<{ success: number; failed: number }> {
    try {
      const documents: SearchableDocument[] = [];
      
      // Recursively read markdown files
      const files = this.getAllMarkdownFiles(docsPath);
      
      for (const filePath of files) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const relativePath = path.relative(docsPath, filePath);
          
          // Extract title from content (first # heading or filename)
          const titleMatch = content.match(/^#\s+(.+)/m);
          const title = titleMatch ? titleMatch[1] : path.basename(filePath, '.md');
          
          // Determine category from path
          const category = this.extractCategory(relativePath);
          
          const document: SearchableDocument = {
            id: `doc-${relativePath.replace(/[^a-zA-Z0-9]/g, '-')}`,
            title,
            content,
            source: relativePath,
            category,
            metadata: {
              filePath: relativePath,
              indexedAt: new Date().toISOString(),
            },
          };
          
          documents.push(document);
        } catch (error) {
          console.error(`[VertexAISearchService] Error reading file ${filePath}:`, error);
        }
      }
      
      return await this.indexDocuments(documents);
    } catch (error) {
      console.error('[VertexAISearchService] Error indexing documentation:', error);
      return { success: 0, failed: 0 };
    }
  }

  /**
   * Get all markdown files recursively
   */
  private getAllMarkdownFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip node_modules, .git, build directories
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' || 
            entry.name === 'build') {
          continue;
        }
        
        if (entry.isDirectory()) {
          files.push(...this.getAllMarkdownFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`[VertexAISearchService] Error reading directory ${dir}:`, error);
    }
    
    return files;
  }

  /**
   * Extract category from file path
   */
  private extractCategory(filePath: string): string {
    const parts = filePath.split(path.sep);
    
    // Look for common category patterns
    if (parts.includes('user-guides')) return 'user-guides';
    if (parts.includes('ecosystem')) return 'ecosystem';
    if (parts.includes('ai-system')) return 'ai-system';
    if (parts.includes('development')) return 'development';
    if (parts.includes('deployment')) return 'deployment';
    if (parts.includes('architecture')) return 'architecture';
    
    // Check if it's from knowledge base
    if (filePath.includes('knowledge_base')) {
      // Extract category from metadata if available
      return 'knowledge-base';
    }
    
    return 'general';
  }

  /**
   * Get statistics about indexed documents
   */
  getStats(): { totalDocuments: number; categories: Record<string, number> } {
    const categories: Record<string, number> = {};
    
    for (const doc of this.documentStore.values()) {
      const category = doc.category || 'general';
      categories[category] = (categories[category] || 0) + 1;
    }
    
    return {
      totalDocuments: this.documentStore.size,
      categories,
    };
  }

  /**
   * Clear all indexed documents
   */
  clearIndex(): void {
    this.documentStore.clear();
    console.log('[VertexAISearchService] Index cleared');
  }
}

