import { BaseAgent } from './BaseAgent';
import { 
  AgentConfig, 
  CaseData, 
  CaseResponse, 
  UserContext, 
  AgentAction,
  ConversationContext 
} from "../types";

export class CaseAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'CaseAgent',
      description: 'Handles case-specific user interactions and provides case information',
      version: '1.0.0',
      capabilities: [
        'case_information',
        'action_suggestions',
        'related_cases',
        'donation_guidance',
        'adoption_information',
      ],
      isEnabled: true,
      maxRetries: 3,
      timeout: 30000, // 30 seconds
    };

    super(config);
  }

  protected getSystemPrompt(): string {
    return `You are Toto, a helpful AI assistant specialized in pet rescue cases. You engage in natural, conversational interactions about specific cases.

Your role:
- Have natural conversations about pet rescue cases
- Provide information gradually, not all at once
- Ask follow-up questions to understand what the user wants to know
- Suggest ways to help based on the conversation context
- Be encouraging and supportive
- Always respond in the user's preferred language (Spanish or English)

Conversation style:
- Start with a brief, friendly greeting about the case
- Ask what the user would like to know
- Provide information in digestible chunks
- Ask follow-up questions to keep the conversation flowing
- Be warm, caring, and conversational
- Avoid dumping all information at once

Guidelines:
- Keep responses concise (2-3 sentences typically)
- Ask questions to understand user intent
- Provide specific, actionable suggestions
- Be encouraging about the impact of help
- Use a natural, conversational tone

Always be helpful, friendly, and conversational.`;
  }

  /**
   * Process a case-specific inquiry
   */
  async processCaseInquiry(
    message: string,
    caseData: CaseData,
    context: UserContext,
    conversationContext?: ConversationContext
  ): Promise<CaseResponse> {
    const startTime = Date.now();

    try {
      // Build conversation context
      let conversationHistory = '';
      if (conversationContext?.history && conversationContext.history.length > 0) {
        conversationHistory = '\n\nPrevious conversation:\n';
        conversationContext.history.forEach((msg, index) => {
          const sender = msg.sender === 'user' ? 'User' : 'Toto';
          conversationHistory += `${sender}: ${msg.message}\n`;
        });
      }

      // Enhance the message with case context and conversation history
      const enhancedMessage = `Case: ${caseData.name} (${caseData.id})
Status: ${caseData.status}
Animal: ${caseData.animalType}
Location: ${caseData.location}
Guardian: ${caseData.guardianName}
Description: ${caseData.description}${conversationHistory}

Current user message: ${message}

Remember: Be conversational, ask follow-up questions, and don't dump all information at once.`;

      const result = await this.processMessage(enhancedMessage, context, conversationContext);

      const processingTime = Date.now() - startTime;

      // Parse the result to extract actions
      const actions = this.extractActions(result.message || '');

      return {
        success: result.success,
        message: result.message,
        caseData,
        actions,
        suggestions: this.generateSuggestions(caseData, context),
        metadata: {
          agentType: this.config.name,
          confidence: 0.9,
          processingTime,
        },
        error: result.error,
      };

    } catch (error) {
      console.error('Error in CaseAgent:', error);
      
      return {
        success: false,
        message: this.getErrorMessage(),
        caseData,
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
   * Extract actions from agent response
   */
  private extractActions(response: string): AgentAction[] {
    const actions: AgentAction[] = [];

    // Simple action extraction - in production, this could be more sophisticated
    if (response.toLowerCase().includes('donate') || response.toLowerCase().includes('donation')) {
      actions.push({
        type: 'donate',
        payload: { action: 'donate' },
        label: 'Donate',
        description: 'Make a donation to help this case',
      });
    }

    if (response.toLowerCase().includes('share') || response.toLowerCase().includes('compartir')) {
      actions.push({
        type: 'share',
        payload: { action: 'share' },
        label: 'Share',
        description: 'Share this case with others',
      });
    }

    if (response.toLowerCase().includes('adopt') || response.toLowerCase().includes('adoptar')) {
      actions.push({
        type: 'adopt',
        payload: { action: 'adopt' },
        label: 'Adopt',
        description: 'Learn about adoption process',
      });
    }

    if (response.toLowerCase().includes('contact') || response.toLowerCase().includes('contactar')) {
      actions.push({
        type: 'contact',
        payload: { action: 'contact' },
        label: 'Contact Guardian',
        description: 'Get in touch with the case guardian',
      });
    }

    return actions;
  }

  /**
   * Generate suggestions based on case data and user context
   */
  private generateSuggestions(caseData: CaseData, context: UserContext): string[] {
    const suggestions: string[] = [];

    if (caseData.status === 'urgent') {
      suggestions.push('This case is marked as urgent and needs immediate help.');
    }

    if (caseData.targetAmount && caseData.currentAmount) {
      const progress = (caseData.currentAmount / caseData.targetAmount) * 100;
      suggestions.push(`Funding progress: ${progress.toFixed(1)}% of target reached.`);
    }

    if (context.userRole === 'user') {
      suggestions.push('You can help by donating, sharing, or learning about adoption.');
    }

    return suggestions;
  }

  protected getErrorMessage(): string {
    return 'I apologize, but I encountered an issue getting information about this case. Please try again or contact support.';
  }
}
