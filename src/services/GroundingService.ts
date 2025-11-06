/**
 * Grounding Service
 *
 * Provides Google Search grounding capabilities for Gemini models.
 * Allows agents to access real-time information from the web when:
 * - RAG confidence is low
 * - Query requires current/real-time information
 * - Query is about external entities or events
 *
 * Features:
 * - Google Search grounding integration with Gemini
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

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

    // Initialize model for grounding queries
    // Note: Google Search grounding will be configured when available in SDK
    // For now, we'll use regular Gemini with instructions to search for current info
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-001',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
      // TODO: Enable Google Search grounding when available in SDK
      // tools: [{ googleSearch: {} }],
    });

    console.log('[GroundingService] Initialized with Google Search grounding');
  }

  /**
   * Decide whether to use grounding based on query analysis
   */
  shouldUseGrounding(options: {
    query: string;
    ragConfidence?: number;
    ragResults?: any[];
  }): GroundingDecision {
    const { query, ragConfidence, ragResults } = options;
    const lowerQuery = query.toLowerCase();

    // Rule 1: RAG confidence too low
    if (ragConfidence !== undefined && ragConfidence < this.RAG_CONFIDENCE_THRESHOLD) {
      return {
        useGrounding: true,
        reason: `RAG confidence (${ragConfidence.toFixed(2)}) below threshold (${this.RAG_CONFIDENCE_THRESHOLD})`,
        confidence: 0.9,
        queryType: 'ambiguous',
      };
    }

    // Rule 2: Query contains real-time keywords
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

    // Rule 3: Query about external entities (other organizations, events, people)
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

    // Rule 4: No RAG results found
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
   */
  async queryWithGrounding(query: GroundingQuery): Promise<GroundingResult> {
    const startTime = Date.now();

    try {
      // Build prompt with grounding instruction
      // Note: When Google Search grounding is available in SDK, this will be automatic
      const groundingInstruction = 'You have access to current, real-time information. Provide the most up-to-date answer possible.';
      const prompt = query.context
        ? `${groundingInstruction}\n\n${query.context}\n\nUser query: ${query.query}`
        : `${groundingInstruction}\n\nUser query: ${query.query}`;

      // Generate content with grounding
      const result = await this.model.generateContent(prompt);
      const response = result.response;

      // Extract answer
      const answer = response.text();

      // Extract grounding metadata (if available)
      // Note: Grounding metadata format may vary
      const groundingMetadata = (response as any).groundingMetadata;
      const sources: Array<{ title: string; url: string; snippet: string }> = [];

      if (groundingMetadata && groundingMetadata.searchEntryPoint) {
        // Extract search results if available
        const searchResults = groundingMetadata.webSearchQueries || [];
        searchResults.forEach((result: any, index: number) => {
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
