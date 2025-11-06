/**
 * Streaming Service
 *
 * Provides streaming response capabilities for real-time user experience.
 * Allows agents to stream responses token-by-token instead of waiting
 * for full completion.
 *
 * Features:
 * - Real-time token streaming
 * - Progress callbacks
 * - Error handling with graceful fallback
 * - Automatic retry for interrupted streams
 * - Stream analytics
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

/**
 * Stream chunk
 */
export interface StreamChunk {
  text: string;
  isComplete: boolean;
  index: number;
  timestamp: number;
}

/**
 * Stream options
 */
export interface StreamOptions {
  onChunk?: (chunk: StreamChunk) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Stream result
 */
export interface StreamResult {
  fullText: string;
  chunks: StreamChunk[];
  duration: number;
  tokenCount: number;
  interrupted: boolean;
}

/**
 * Stream analytics
 */
export interface StreamAnalytics {
  totalStreams: number;
  successfulStreams: number;
  failedStreams: number;
  interruptedStreams: number;
  averageDuration: number;
  averageTokenCount: number;
  successRate: number;
}

/**
 * StreamingService - Real-time response streaming
 */
export class StreamingService {
  private genAI: GoogleGenerativeAI;

  // Analytics
  private analytics: StreamAnalytics = {
    totalStreams: 0,
    successfulStreams: 0,
    failedStreams: 0,
    interruptedStreams: 0,
    averageDuration: 0,
    averageTokenCount: 0,
    successRate: 0,
  };

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
    console.log('[StreamingService] Initialized');
  }

  /**
   * Stream a response from Gemini
   */
  async streamResponse(prompt: string, options: StreamOptions = {}): Promise<StreamResult> {
    const startTime = Date.now();
    this.analytics.totalStreams++;

    const chunks: StreamChunk[] = [];
    let fullText = '';
    let interrupted = false;

    try {
      // Create model with streaming config
      const model: GenerativeModel = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-001',
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxOutputTokens ?? 2048,
        },
      });

      // Generate content stream
      const result = await model.generateContentStream(prompt);

      let index = 0;
      for await (const chunk of result.stream) {
        const text = chunk.text();

        if (text) {
          fullText += text;

          const streamChunk: StreamChunk = {
            text,
            isComplete: false,
            index: index++,
            timestamp: Date.now(),
          };

          chunks.push(streamChunk);

          // Call progress callback
          if (options.onChunk) {
            try {
              options.onChunk(streamChunk);
            } catch (callbackError) {
              console.warn('[StreamingService] Chunk callback error:', callbackError);
            }
          }
        }
      }

      // Mark last chunk as complete
      if (chunks.length > 0) {
        chunks[chunks.length - 1].isComplete = true;
      }

      const duration = Date.now() - startTime;
      const tokenCount = this.estimateTokenCount(fullText);

      // Update analytics
      this.analytics.successfulStreams++;
      this.updateAnalytics(duration, tokenCount);

      // Call completion callback
      if (options.onComplete) {
        try {
          options.onComplete(fullText);
        } catch (callbackError) {
          console.warn('[StreamingService] Complete callback error:', callbackError);
        }
      }

      console.log(`[StreamingService] Stream completed: ${chunks.length} chunks, ${duration}ms, ~${tokenCount} tokens`);

      return {
        fullText,
        chunks,
        duration,
        tokenCount,
        interrupted: false,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error('[StreamingService] Stream error:', error);

      // Update analytics
      if (error instanceof Error && error.message.includes('interrupt')) {
        this.analytics.interruptedStreams++;
        interrupted = true;
      } else {
        this.analytics.failedStreams++;
      }

      this.updateAnalytics(duration, 0);

      // Call error callback
      if (options.onError) {
        try {
          options.onError(error instanceof Error ? error : new Error(String(error)));
        } catch (callbackError) {
          console.warn('[StreamingService] Error callback error:', callbackError);
        }
      }

      // Return partial result if we got some chunks
      if (chunks.length > 0) {
        return {
          fullText,
          chunks,
          duration,
          tokenCount: this.estimateTokenCount(fullText),
          interrupted: true,
        };
      }

      // Otherwise throw
      throw error;
    }
  }

  /**
   * Stream with automatic retry on interruption
   */
  async streamWithRetry(
    prompt: string,
    options: StreamOptions = {},
    maxRetries: number = 2
  ): Promise<StreamResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.streamResponse(prompt, options);

        if (!result.interrupted) {
          return result;
        }

        // If interrupted and we have retries left, try again
        if (attempt < maxRetries) {
          console.log(`[StreamingService] Stream interrupted, retrying (${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
          continue;
        }

        // Out of retries but got partial result
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          console.log(`[StreamingService] Stream failed, retrying (${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Stream failed after retries');
  }

  /**
   * Stream with fallback to non-streaming
   */
  async streamWithFallback(prompt: string, options: StreamOptions = {}): Promise<StreamResult> {
    try {
      return await this.streamResponse(prompt, options);
    } catch (error) {
      console.warn('[StreamingService] Streaming failed, falling back to non-streaming...');

      // Fallback to regular non-streaming generation
      const startTime = Date.now();

      try {
        const model = this.genAI.getGenerativeModel({
          model: 'gemini-2.0-flash-001',
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 2048,
          },
        });

        const result = await model.generateContent(prompt);
        const fullText = result.response.text();
        const duration = Date.now() - startTime;
        const tokenCount = this.estimateTokenCount(fullText);

        // Create single chunk for non-streaming result
        const chunk: StreamChunk = {
          text: fullText,
          isComplete: true,
          index: 0,
          timestamp: Date.now(),
        };

        // Call callbacks
        if (options.onChunk) {
          options.onChunk(chunk);
        }
        if (options.onComplete) {
          options.onComplete(fullText);
        }

        console.log(`[StreamingService] Fallback completed: ${duration}ms, ~${tokenCount} tokens`);

        return {
          fullText,
          chunks: [chunk],
          duration,
          tokenCount,
          interrupted: false,
        };
      } catch (fallbackError) {
        console.error('[StreamingService] Fallback also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Update analytics
   */
  private updateAnalytics(duration: number, tokenCount: number): void {
    const total = this.analytics.successfulStreams + this.analytics.failedStreams + this.analytics.interruptedStreams;

    if (total > 0) {
      // Update average duration (running average)
      this.analytics.averageDuration =
        (this.analytics.averageDuration * (total - 1) + duration) / total;

      // Update average token count
      this.analytics.averageTokenCount =
        (this.analytics.averageTokenCount * (total - 1) + tokenCount) / total;
    }

    // Update success rate
    this.analytics.successRate = this.analytics.totalStreams > 0
      ? this.analytics.successfulStreams / this.analytics.totalStreams
      : 0;
  }

  /**
   * Get streaming analytics
   */
  getAnalytics(): StreamAnalytics {
    return { ...this.analytics };
  }

  /**
   * Reset analytics
   */
  resetAnalytics(): void {
    this.analytics = {
      totalStreams: 0,
      successfulStreams: 0,
      failedStreams: 0,
      interruptedStreams: 0,
      averageDuration: 0,
      averageTokenCount: 0,
      successRate: 0,
    };
    console.log('[StreamingService] Analytics reset');
  }
}
