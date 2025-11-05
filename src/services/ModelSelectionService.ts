/**
 * ModelSelectionService - Intelligent model selection based on task complexity
 *
 * This service optimizes costs and performance by selecting the appropriate
 * Gemini model for each task:
 * - Gemini 2.0 Flash: Fast, cost-effective for simple tasks
 * - Gemini 2.0 PRO: Advanced reasoning for complex tasks
 * - Gemini 1.5 Flash: Legacy alternative
 * - Gemini 1.5 PRO: Legacy advanced model
 *
 * Estimated Cost Savings: 30-50% on simple tasks
 */

export interface ModelConfig {
  name: string;
  displayName: string;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens: number;
  averageLatencyMs: number;
  maxTokens: number;
  capabilities: string[];
}

export interface TaskComplexity {
  level: 'simple' | 'medium' | 'complex';
  score: number; // 0-1 scale
  factors: {
    conversationTurns?: number;
    contentLength?: number;
    requiresReasoning?: boolean;
    requiresCreativity?: boolean;
    requiresMultipleSteps?: boolean;
    urgency?: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface ModelRecommendation {
  modelName: string;
  confidence: number; // 0-1
  reasoning: string;
  estimatedCost: number;
  estimatedLatency: number;
  alternative?: string;
}

export interface ModelUsageStats {
  modelName: string;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  averageLatency: number;
  successRate: number;
  failureCount: number;
}

export type TaskType =
  | 'intent_detection'
  | 'urgency_classification'
  | 'simple_routing'
  | 'social_media_analysis'
  | 'case_conversation'
  | 'detailed_summarization'
  | 'knowledge_retrieval_embedding'
  | 'knowledge_retrieval_response'
  | 'image_analysis'
  | 'multi_turn_conversation';

/**
 * Model configurations with pricing and capabilities
 */
const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gemini-2.0-flash-001': {
    name: 'gemini-2.0-flash-001',
    displayName: 'Gemini 2.0 Flash',
    costPerMillionInputTokens: 0.075,
    costPerMillionOutputTokens: 0.30,
    averageLatencyMs: 500,
    maxTokens: 8192,
    capabilities: [
      'fast_processing',
      'intent_detection',
      'classification',
      'routing',
      'simple_qa',
      'function_calling',
    ],
  },
  'gemini-2.0-pro-001': {
    name: 'gemini-2.0-pro-001',
    displayName: 'Gemini 2.0 PRO',
    costPerMillionInputTokens: 1.25, // Estimated, adjust when available
    costPerMillionOutputTokens: 5.0, // Estimated, adjust when available
    averageLatencyMs: 1500,
    maxTokens: 32768,
    capabilities: [
      'advanced_reasoning',
      'complex_analysis',
      'creative_generation',
      'multi_step_logic',
      'detailed_summarization',
      'function_calling',
    ],
  },
  'gemini-1.5-flash-001': {
    name: 'gemini-1.5-flash-001',
    displayName: 'Gemini 1.5 Flash',
    costPerMillionInputTokens: 0.075,
    costPerMillionOutputTokens: 0.30,
    averageLatencyMs: 600,
    maxTokens: 1048576, // 1M context
    capabilities: [
      'fast_processing',
      'large_context',
      'intent_detection',
      'classification',
    ],
  },
  'gemini-1.5-pro-001': {
    name: 'gemini-1.5-pro-001',
    displayName: 'Gemini 1.5 PRO',
    costPerMillionInputTokens: 1.25,
    costPerMillionOutputTokens: 5.0,
    averageLatencyMs: 2000,
    maxTokens: 2097152, // 2M context
    capabilities: [
      'advanced_reasoning',
      'very_large_context',
      'complex_analysis',
      'multi_step_logic',
    ],
  },
};

/**
 * Task type to complexity mapping
 */
const TASK_COMPLEXITY_MAP: Record<TaskType, Partial<TaskComplexity>> = {
  intent_detection: {
    level: 'simple',
    score: 0.2,
  },
  urgency_classification: {
    level: 'simple',
    score: 0.3,
  },
  simple_routing: {
    level: 'simple',
    score: 0.2,
  },
  social_media_analysis: {
    level: 'medium',
    score: 0.5,
  },
  case_conversation: {
    level: 'complex',
    score: 0.7,
  },
  detailed_summarization: {
    level: 'complex',
    score: 0.8,
  },
  knowledge_retrieval_embedding: {
    level: 'simple',
    score: 0.3,
  },
  knowledge_retrieval_response: {
    level: 'complex',
    score: 0.7,
  },
  image_analysis: {
    level: 'medium',
    score: 0.6,
  },
  multi_turn_conversation: {
    level: 'complex',
    score: 0.8,
  },
};

export class ModelSelectionService {
  private usageStats: Map<string, ModelUsageStats> = new Map();
  private defaultModel: string = 'gemini-2.0-flash-001';

  constructor() {
    // Initialize stats for all models
    Object.keys(MODEL_CONFIGS).forEach((modelName) => {
      this.usageStats.set(modelName, {
        modelName,
        totalCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        successRate: 1.0,
        failureCount: 0,
      });
    });
  }

  /**
   * Select the best model for a given task type
   */
  selectModelForTask(taskType: TaskType, overrides?: Partial<TaskComplexity>): ModelRecommendation {
    const complexity = this.calculateComplexity(taskType, overrides);
    return this.selectModelByComplexity(complexity);
  }

  /**
   * Calculate task complexity
   */
  private calculateComplexity(taskType: TaskType, overrides?: Partial<TaskComplexity>): TaskComplexity {
    const baseComplexity = TASK_COMPLEXITY_MAP[taskType] || {
      level: 'medium' as const,
      score: 0.5,
    };

    let adjustedScore = baseComplexity.score || 0.5;
    const factors = overrides?.factors || {};

    // Adjust complexity based on factors
    if (factors.conversationTurns && factors.conversationTurns > 5) {
      adjustedScore += 0.1;
    }
    if (factors.contentLength && factors.contentLength > 1000) {
      adjustedScore += 0.1;
    }
    if (factors.requiresReasoning) {
      adjustedScore += 0.2;
    }
    if (factors.requiresCreativity) {
      adjustedScore += 0.15;
    }
    if (factors.requiresMultipleSteps) {
      adjustedScore += 0.2;
    }
    if (factors.urgency === 'critical') {
      // Critical urgency might prefer faster model despite complexity
      adjustedScore -= 0.1;
    }

    // Clamp to 0-1
    adjustedScore = Math.max(0, Math.min(1, adjustedScore));

    // Determine level based on final score
    let level: 'simple' | 'medium' | 'complex';
    if (adjustedScore < 0.4) {
      level = 'simple';
    } else if (adjustedScore < 0.7) {
      level = 'medium';
    } else {
      level = 'complex';
    }

    return {
      level,
      score: adjustedScore,
      factors: factors,
    };
  }

  /**
   * Select model based on complexity
   */
  private selectModelByComplexity(complexity: TaskComplexity): ModelRecommendation {
    let selectedModel: string;
    let reasoning: string;

    if (complexity.score < 0.4) {
      // Simple tasks -> Flash
      selectedModel = 'gemini-2.0-flash-001';
      reasoning = 'Simple task - using fast, cost-effective Flash model';
    } else if (complexity.score < 0.7) {
      // Medium complexity -> Flash (still efficient)
      selectedModel = 'gemini-2.0-flash-001';
      reasoning = 'Medium complexity - Flash model provides good balance';
    } else {
      // Complex tasks -> PRO
      selectedModel = 'gemini-2.0-pro-001';
      reasoning = 'Complex task requiring advanced reasoning - using PRO model';
    }

    // Special case: critical urgency prefers Flash for speed
    if (complexity.factors.urgency === 'critical' && complexity.score < 0.8) {
      selectedModel = 'gemini-2.0-flash-001';
      reasoning += ' (prioritizing speed for critical urgency)';
    }

    const config = MODEL_CONFIGS[selectedModel];
    const estimatedInputTokens = 500; // Rough estimate
    const estimatedOutputTokens = 200; // Rough estimate

    const estimatedCost =
      (estimatedInputTokens / 1_000_000) * config.costPerMillionInputTokens +
      (estimatedOutputTokens / 1_000_000) * config.costPerMillionOutputTokens;

    // Determine alternative
    let alternative: string | undefined;
    if (selectedModel === 'gemini-2.0-flash-001' && complexity.score > 0.5) {
      alternative = 'gemini-2.0-pro-001';
    } else if (selectedModel === 'gemini-2.0-pro-001' && complexity.score < 0.75) {
      alternative = 'gemini-2.0-flash-001';
    }

    return {
      modelName: selectedModel,
      confidence: this.calculateConfidence(complexity, selectedModel),
      reasoning,
      estimatedCost,
      estimatedLatency: config.averageLatencyMs,
      alternative,
    };
  }

  /**
   * Calculate confidence in model selection
   */
  private calculateConfidence(complexity: TaskComplexity, selectedModel: string): number {
    const config = MODEL_CONFIGS[selectedModel];
    const stats = this.usageStats.get(selectedModel);

    let confidence = 0.8; // Base confidence

    // Adjust based on historical success rate
    if (stats && stats.totalCalls > 10) {
      confidence = (confidence + stats.successRate) / 2;
    }

    // Adjust based on complexity match
    if (complexity.level === 'simple' && selectedModel.includes('flash')) {
      confidence += 0.1;
    } else if (complexity.level === 'complex' && selectedModel.includes('pro')) {
      confidence += 0.1;
    }

    return Math.min(0.99, confidence);
  }

  /**
   * Get model configuration
   */
  getModelConfig(modelName: string): ModelConfig | undefined {
    return MODEL_CONFIGS[modelName];
  }

  /**
   * Record model usage for analytics
   */
  recordUsage(
    modelName: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs: number,
    success: boolean
  ): void {
    const stats = this.usageStats.get(modelName);
    if (!stats) return;

    const config = MODEL_CONFIGS[modelName];
    if (!config) return;

    const cost =
      (inputTokens / 1_000_000) * config.costPerMillionInputTokens +
      (outputTokens / 1_000_000) * config.costPerMillionOutputTokens;

    stats.totalCalls++;
    stats.totalInputTokens += inputTokens;
    stats.totalOutputTokens += outputTokens;
    stats.totalCost += cost;

    // Update average latency
    stats.averageLatency =
      (stats.averageLatency * (stats.totalCalls - 1) + latencyMs) / stats.totalCalls;

    // Update success rate
    if (!success) {
      stats.failureCount++;
    }
    stats.successRate = (stats.totalCalls - stats.failureCount) / stats.totalCalls;

    this.usageStats.set(modelName, stats);
  }

  /**
   * Get usage statistics for all models
   */
  getUsageStats(): ModelUsageStats[] {
    return Array.from(this.usageStats.values());
  }

  /**
   * Get usage statistics for a specific model
   */
  getModelStats(modelName: string): ModelUsageStats | undefined {
    return this.usageStats.get(modelName);
  }

  /**
   * Get total cost across all models
   */
  getTotalCost(): number {
    return Array.from(this.usageStats.values()).reduce((sum, stats) => sum + stats.totalCost, 0);
  }

  /**
   * Get cost breakdown by model
   */
  getCostBreakdown(): { modelName: string; cost: number; percentage: number }[] {
    const total = this.getTotalCost();
    return Array.from(this.usageStats.values())
      .map((stats) => ({
        modelName: stats.modelName,
        cost: stats.totalCost,
        percentage: total > 0 ? (stats.totalCost / total) * 100 : 0,
      }))
      .sort((a, b) => b.cost - a.cost);
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats(): void {
    Object.keys(MODEL_CONFIGS).forEach((modelName) => {
      this.usageStats.set(modelName, {
        modelName,
        totalCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        successRate: 1.0,
        failureCount: 0,
      });
    });
  }

  /**
   * Get analytics summary
   */
  getAnalyticsSummary(): {
    totalCalls: number;
    totalCost: number;
    averageCostPerCall: number;
    mostUsedModel: string;
    costSavingsEstimate: number;
  } {
    const stats = this.getUsageStats();
    const totalCalls = stats.reduce((sum, s) => sum + s.totalCalls, 0);
    const totalCost = stats.reduce((sum, s) => sum + s.totalCost, 0);

    // Find most used model
    const mostUsed = stats.reduce((max, s) => (s.totalCalls > max.totalCalls ? s : max), stats[0]);

    // Estimate savings by comparing actual cost to if we used PRO for everything
    const proConfig = MODEL_CONFIGS['gemini-2.0-pro-001'];
    const flashStats = stats.filter((s) => s.modelName.includes('flash'));
    const flashTokens = flashStats.reduce(
      (sum, s) => sum + s.totalInputTokens + s.totalOutputTokens,
      0
    );

    const hypotheticalProCost =
      (flashTokens / 1_000_000) *
      (proConfig.costPerMillionInputTokens + proConfig.costPerMillionOutputTokens);
    const actualFlashCost = flashStats.reduce((sum, s) => sum + s.totalCost, 0);
    const costSavings = hypotheticalProCost - actualFlashCost;

    return {
      totalCalls,
      totalCost,
      averageCostPerCall: totalCalls > 0 ? totalCost / totalCalls : 0,
      mostUsedModel: mostUsed?.modelName || 'none',
      costSavingsEstimate: Math.max(0, costSavings),
    };
  }

  /**
   * Get recommended model for specific scenarios
   */
  getRecommendationForScenario(scenario: string): ModelRecommendation {
    const scenarioMap: Record<string, TaskType> = {
      'detect user intent': 'intent_detection',
      'classify urgency': 'urgency_classification',
      'route request': 'simple_routing',
      'analyze social media post': 'social_media_analysis',
      'chat with user about case': 'case_conversation',
      'summarize case details': 'detailed_summarization',
      'generate embeddings': 'knowledge_retrieval_embedding',
      'answer with knowledge': 'knowledge_retrieval_response',
      'analyze image': 'image_analysis',
      'multi-turn conversation': 'multi_turn_conversation',
    };

    const taskType = scenarioMap[scenario.toLowerCase()] || 'case_conversation';
    return this.selectModelForTask(taskType);
  }
}

/**
 * Singleton instance
 */
let modelSelectionServiceInstance: ModelSelectionService | null = null;

export function getModelSelectionService(): ModelSelectionService {
  if (!modelSelectionServiceInstance) {
    modelSelectionServiceInstance = new ModelSelectionService();
  }
  return modelSelectionServiceInstance;
}
