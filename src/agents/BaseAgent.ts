import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { AgentConfig, AgentResponse, UserContext } from "../types";

export abstract class BaseAgent {
  protected model: GenerativeModel;
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
    this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
  }

  /**
   * Get the system prompt for this agent
   */
  protected abstract getSystemPrompt(): string;

  /**
   * Process a user message
   */
  async processMessage(
    message: string,
    context: UserContext,
    conversationContext?: any
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      const systemPrompt = this.getSystemPrompt();
      const fullPrompt = `${systemPrompt}\n\nUser Context: ${JSON.stringify(context)}\n\nUser Message: ${message}`;

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        },
      });

      const response = result.response;
      const text = response.text();

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        message: text || 'I understand your request.',
        metadata: {
          agentType: this.config.name,
          confidence: 0.8,
          processingTime,
        },
      };

    } catch (error) {
      console.error(`Error in ${this.config.name}:`, error);
      
      return {
        success: false,
        message: this.getErrorMessage(),
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          agentType: this.config.name,
          confidence: 0,
          processingTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Get error message for this agent
   */
  protected getErrorMessage(): string {
    return 'I apologize, but I encountered an issue processing your request. Please try again.';
  }

  /**
   * Get agent information
   */
  getAgentInfo(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Check if agent is enabled
   */
  isEnabled(): boolean {
    return this.config.isEnabled;
  }

  /**
   * Enable/disable agent
   */
  setEnabled(enabled: boolean): void {
    this.config.isEnabled = enabled;
  }
}
