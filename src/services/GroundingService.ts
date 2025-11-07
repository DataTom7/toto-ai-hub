/**
 * Grounding Service
 *
 * Provides controlled grounding capabilities for Gemini models.
 * 
 * IMPORTANT: By default, web search is DISABLED to prevent hallucinations.
 * The service only uses your documentation and knowledge base.
 * 
 * To enable web search (not recommended for production):
 * - Set ENABLE_GOOGLE_SEARCH_GROUNDING=true in environment variables
 * 
 * Features:
 * - Documentation/knowledge base only (default - safe)
 * - Optional Google Search grounding (if explicitly enabled)
 * - Automatic grounding decision logic
 * - Confidence threshold-based routing
 * - Query classification (internal vs external knowledge)
 * - Grounding usage tracking and analytics
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

/**
 * Grounding query parameters
 */
export interface GroundingQuery {
  query: string;
  context?: string;
  maxResults?: number;
}

/**
 * Grounding result
 */
export interface GroundingResult {
  answer: string;
  sources?: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  confidence: number;
  groundingUsed: boolean;
  metadata?: {
    queryTime: number;
    modelUsed: string;
  };
}

/**
 * Grounding decision based on query analysis
 */
export interface GroundingDecision {
  useGrounding: boolean;
  reason: string;
  confidence: number;
  queryType: 'real-time' | 'external' | 'internal' | 'ambiguous';
}

/**
 * Grounding analytics
 */
export interface GroundingAnalytics {
  totalQueries: number;
  groundingUsed: number;
  groundingRate: number;
  averageConfidence: number;
  queryTypeDistribution: {
    [key: string]: number;
  };
}

/**
 * GroundingService - Google Search integration for real-time information
 */
export class GroundingService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  // Analytics
  private analytics: GroundingAnalytics = {
    totalQueries: 0,
    groundingUsed: 0,
    groundingRate: 0,
    averageConfidence: 0,
    queryTypeDistribution: {},
  };

  // Grounding decision thresholds
  private readonly RAG_CONFIDENCE_THRESHOLD = 0.6;
  private readonly GROUNDING_KEYWORDS = [
    'current', 'latest', 'today', 'now', 'recent', 'news',
    'actual', 'último', 'reciente', 'actual', 'hoy',
  ];

  private enableWebSearch: boolean;

  constructor(enableWebSearch: boolean = false) {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
    
    // Check environment variable - default to false (no web search)
    // Set ENABLE_GOOGLE_SEARCH_GROUNDING=true to enable web search
    this.enableWebSearch = enableWebSearch || 
                          process.env.ENABLE_GOOGLE_SEARCH_GROUNDING === 'true';

    // Initialize model - only enable Google Search if explicitly enabled
    // By default, NO web search - only use our own documentation/knowledge base
    const modelConfig: any = {
      model: 'gemini-2.0-flash-001',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };

    // Only enable web search if explicitly configured
    if (this.enableWebSearch) {
      modelConfig.tools = [{ googleSearchRetrieval: {} }];
      console.log('[GroundingService] Initialized with Google Search grounding ENABLED (web search active)');
    } else {
      console.log('[GroundingService] Initialized WITHOUT web search - using only documentation/knowledge base');
      console.log('[GroundingService] Set ENABLE_GOOGLE_SEARCH_GROUNDING=true to enable web search');
    }

    this.model = this.genAI.getGenerativeModel(modelConfig);
  }

  /**
   * Decide whether to use grounding based on query analysis
   * IMPORTANT: If web search is disabled, this will NEVER return useGrounding=true
   * to prevent hallucinations from external sources
   */
  shouldUseGrounding(options: {
    query: string;
    ragConfidence?: number;
    ragResults?: any[];
  }): GroundingDecision {
    // If web search is disabled, NEVER use grounding (prevent hallucinations)
    if (!this.enableWebSearch) {
      return {
        useGrounding: false,
        reason: 'Web search is disabled - using only documentation/knowledge base',
        confidence: 0.9,
        queryType: 'internal',
      };
    }

    const { query, ragConfidence, ragResults } = options;
    const lowerQuery = query.toLowerCase();

    // Rule 1: RAG confidence too low (only if web search enabled)
    if (ragConfidence !== undefined && ragConfidence < this.RAG_CONFIDENCE_THRESHOLD) {
      return {
        useGrounding: true,
        reason: `RAG confidence (${ragConfidence.toFixed(2)}) below threshold (${this.RAG_CONFIDENCE_THRESHOLD})`,
        confidence: 0.9,
        queryType: 'ambiguous',
      };
    }

    // Rule 2: Query contains real-time keywords (only if web search enabled)
    const hasRealTimeKeyword = this.GROUNDING_KEYWORDS.some(keyword =>
      lowerQuery.includes(keyword)
    );
    if (hasRealTimeKeyword) {
      return {
        useGrounding: true,
        reason: 'Query contains real-time keywords (current, latest, today, etc.)',
        confidence: 0.95,
        queryType: 'real-time',
      };
    }

    // Rule 3: Query about external entities (only if web search enabled)
    const externalKeywords = [
      'organization', 'event', 'conference', 'news', 'company',
      'organización', 'evento', 'conferencia', 'noticia', 'empresa',
    ];
    const isExternalQuery = externalKeywords.some(keyword => lowerQuery.includes(keyword));
    if (isExternalQuery) {
      return {
        useGrounding: true,
        reason: 'Query about external entities or events',
        confidence: 0.85,
        queryType: 'external',
      };
    }

    // Rule 4: No RAG results found (only if web search enabled)
    if (ragResults !== undefined && ragResults.length === 0) {
      return {
        useGrounding: true,
        reason: 'No RAG results found',
        confidence: 0.8,
        queryType: 'external',
      };
    }

    // Default: Use RAG for internal knowledge
    return {
      useGrounding: false,
      reason: 'Query appears to be about internal knowledge',
      confidence: 0.7,
      queryType: 'internal',
    };
  }

  /**
   * Query with Google Search grounding
   * WARNING: Only works if web search is enabled
   * If disabled, this will return an error to prevent hallucinations
   */
  async queryWithGrounding(query: GroundingQuery): Promise<GroundingResult> {
    const startTime = Date.now();

    // Safety check: If web search is disabled, don't allow grounding
    if (!this.enableWebSearch) {
      console.warn('[GroundingService] Web search is disabled - refusing to use grounding to prevent hallucinations');
      return {
        answer: 'I can only provide information from our documentation and knowledge base. Web search is disabled for accuracy.',
        confidence: 0,
        groundingUsed: false,
        metadata: {
          queryTime: Date.now() - startTime,
          modelUsed: 'gemini-2.0-flash-001',
        },
      };
    }

    try {
      // Build prompt - Google Search grounding is automatic when tool is enabled
      const prompt = query.context
        ? `${query.context}\n\nUser query: ${query.query}`
        : query.query;

      // Generate content with grounding (Google Search is automatic)
      const result = await this.model.generateContent(prompt);
      const response = result.response;

      // Extract answer
      const answer = response.text();

      // Extract grounding metadata and sources
      const sources: Array<{ title: string; url: string; snippet: string }> = [];
      
      // Check for grounding chunks in the response (type-safe access)
      const responseAny = response as any;
      const groundingChunks = responseAny.groundingMetadata?.groundingChunks || [];
      
      for (const chunk of groundingChunks) {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || 'Web Source',
            url: chunk.web.uri || '',
            snippet: chunk.web.snippet || '',
          });
        }
      }

      // Also check for grounding metadata in the response
      const groundingMetadata = responseAny.groundingMetadata;
      if (groundingMetadata && !sources.length) {
        // Try alternative metadata structure
        const webQueries = groundingMetadata.webSearchQueries || [];
        webQueries.forEach((result: any, index: number) => {
          sources.push({
            title: result.title || `Source ${index + 1}`,
            url: result.uri || '',
            snippet: result.snippet || '',
          });
        });
      }

      const queryTime = Date.now() - startTime;

      // Update analytics
      this.analytics.totalQueries++;
      this.analytics.groundingUsed++;
      this.analytics.groundingRate = this.analytics.groundingUsed / this.analytics.totalQueries;

      console.log(`[GroundingService] Query completed in ${queryTime}ms with ${sources.length} sources`);

      return {
        answer,
        sources: sources.length > 0 ? sources : undefined,
        confidence: 0.85, // High confidence for grounded responses
        groundingUsed: true,
        metadata: {
          queryTime,
          modelUsed: 'gemini-2.0-flash-001',
        },
      };
    } catch (error) {
      console.error('[GroundingService] Error with grounding:', error);

      // Update analytics
      this.analytics.totalQueries++;

      return {
        answer: 'Lo siento, no pude obtener información actualizada en este momento.',
        confidence: 0,
        groundingUsed: false,
        metadata: {
          queryTime: Date.now() - startTime,
          modelUsed: 'gemini-2.0-flash-001',
        },
      };
    }
  }

  /**
   * Query without grounding (regular RAG)
   */
  async queryWithoutGrounding(query: string, context?: string): Promise<GroundingResult> {
    const startTime = Date.now();

    try {
      // Use regular model without grounding
      const regularModel = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-001',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });

      const prompt = context
        ? `${context}\n\nUser query: ${query}`
        : query;

      const result = await regularModel.generateContent(prompt);
      const answer = result.response.text();

      const queryTime = Date.now() - startTime;

      // Update analytics
      this.analytics.totalQueries++;

      return {
        answer,
        confidence: 0.75, // Medium confidence for non-grounded responses
        groundingUsed: false,
        metadata: {
          queryTime,
          modelUsed: 'gemini-2.0-flash-001',
        },
      };
    } catch (error) {
      console.error('[GroundingService] Error without grounding:', error);

      return {
        answer: 'Lo siento, no pude procesar tu consulta.',
        confidence: 0,
        groundingUsed: false,
        metadata: {
          queryTime: Date.now() - startTime,
          modelUsed: 'gemini-2.0-flash-001',
        },
      };
    }
  }

  /**
   * Intelligent query routing: RAG vs Grounding
   */
  async intelligentQuery(options: {
    query: string;
    context?: string;
    ragConfidence?: number;
    ragResults?: any[];
  }): Promise<GroundingResult> {
    // Decide whether to use grounding
    const decision = this.shouldUseGrounding(options);

    // Track query type
    this.analytics.queryTypeDistribution[decision.queryType] =
      (this.analytics.queryTypeDistribution[decision.queryType] || 0) + 1;

    console.log(`[GroundingService] Decision: ${decision.useGrounding ? 'USE GROUNDING' : 'USE RAG'}`);
    console.log(`[GroundingService] Reason: ${decision.reason}`);
    console.log(`[GroundingService] Query type: ${decision.queryType}`);

    if (decision.useGrounding) {
      return await this.queryWithGrounding({
        query: options.query,
        context: options.context,
      });
    } else {
      return await this.queryWithoutGrounding(options.query, options.context);
    }
  }

  /**
   * Get grounding analytics
   */
  getAnalytics(): GroundingAnalytics {
    return { ...this.analytics };
  }

  /**
   * Reset analytics
   */
  resetAnalytics(): void {
    this.analytics = {
      totalQueries: 0,
      groundingUsed: 0,
      groundingRate: 0,
      averageConfidence: 0,
      queryTypeDistribution: {},
    };
    console.log('[GroundingService] Analytics reset');
  }
}
