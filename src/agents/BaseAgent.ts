import { GoogleGenerativeAI, GenerativeModel, FunctionDeclaration, FunctionCall, Part } from "@google/generative-ai";
import { AgentConfig, AgentResponse, UserContext } from "../types";
import { ModelSelectionService, getModelSelectionService, TaskType } from "../services/ModelSelectionService";

export abstract class BaseAgent {
  protected model: GenerativeModel;
  protected config: AgentConfig;
  protected genAI: GoogleGenerativeAI;
  protected modelSelectionService: ModelSelectionService;

  constructor(config: AgentConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
    this.modelSelectionService = getModelSelectionService();
  }

  /**
   * Get function declarations for this agent (optional)
   * Override this in subclasses to enable function calling
   */
  protected getFunctionDeclarations(): FunctionDeclaration[] | undefined {
    return undefined;
  }

  /**
   * Create a model instance with optional function declarations
   */
  protected createModel(modelName: string = "gemini-2.0-flash-001", tools?: FunctionDeclaration[]): GenerativeModel {
    if (tools && tools.length > 0) {
      return this.genAI.getGenerativeModel({
        model: modelName,
        tools: [{ functionDeclarations: tools }]
      });
    }
    return this.genAI.getGenerativeModel({ model: modelName });
  }

  /**
   * Select the appropriate model for a task
   */
  protected selectModelForTask(taskType: TaskType, complexityOverrides?: any): string {
    const recommendation = this.modelSelectionService.selectModelForTask(taskType, complexityOverrides);
    console.log(`🤖 Model Selection: ${recommendation.modelName} (confidence: ${(recommendation.confidence * 100).toFixed(1)}%)`);
    console.log(`   Reasoning: ${recommendation.reasoning}`);
    console.log(`   Estimated cost: $${recommendation.estimatedCost.toFixed(6)}, latency: ${recommendation.estimatedLatency}ms`);
    return recommendation.modelName;
  }

  /**
   * Record model usage after generation
   */
  protected recordModelUsage(
    modelName: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs: number,
    success: boolean
  ): void {
    this.modelSelectionService.recordUsage(modelName, inputTokens, outputTokens, latencyMs, success);
  }

  /**
   * Get the system prompt for this agent
   */
  protected abstract getSystemPrompt(): string;

  /**
   * Process a user message with optional function calling
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

      // Get function declarations if agent supports them
      const functionDeclarations = this.getFunctionDeclarations();
      const modelToUse = functionDeclarations
        ? this.createModel("gemini-2.0-flash-001", functionDeclarations)
        : this.model;

      const result = await modelToUse.generateContent({
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
   * Process a message with function calling enabled
   * Returns both text response and function calls
   */
  async processMessageWithFunctions(
    message: string,
    context: UserContext,
    conversationContext?: any
  ): Promise<{ response: AgentResponse; functionCalls?: FunctionCall[] }> {
    const startTime = Date.now();

    try {
      const systemPrompt = this.getSystemPrompt();
      const fullPrompt = `${systemPrompt}\n\nUser Context: ${JSON.stringify(context)}\n\nUser Message: ${message}`;

      const functionDeclarations = this.getFunctionDeclarations();
      if (!functionDeclarations || functionDeclarations.length === 0) {
        // Fall back to regular processing if no functions defined
        const response = await this.processMessage(message, context, conversationContext);
        return { response };
      }

      const modelWithFunctions = this.createModel("gemini-2.0-flash-001", functionDeclarations);

      const result = await modelWithFunctions.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        },
      });

      const response = result.response;

      // Extract function calls
      const functionCalls: FunctionCall[] = [];
      const candidates = response.candidates || [];

      for (const candidate of candidates) {
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if ('functionCall' in part && part.functionCall) {
              functionCalls.push(part.functionCall);
            }
          }
        }
      }

      // Get text response (if any)
      let textResponse = '';
      try {
        textResponse = response.text();
      } catch (e) {
        // No text response, only function calls
        textResponse = '';
      }

      const processingTime = Date.now() - startTime;

      const agentResponse: AgentResponse = {
        success: true,
        message: textResponse || 'I understand your request.',
        metadata: {
          agentType: this.config.name,
          confidence: 0.9, // Higher confidence with function calling
          processingTime,
        },
      };

      return {
        response: agentResponse,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      };

    } catch (error) {
      console.error(`Error in ${this.config.name} with function calling:`, error);

      return {
        response: {
          success: false,
          message: this.getErrorMessage(),
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            agentType: this.config.name,
            confidence: 0,
            processingTime: Date.now() - startTime,
          },
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
