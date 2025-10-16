import { BaseAgent } from './BaseAgent';
import { 
  AgentConfig, 
  CaseData, 
  CaseResponse, 
  UserContext, 
  AgentAction,
  ConversationContext,
  EnhancedCaseData,
  ConversationMemory,
  UserProfile,
  IntentAnalysis,
  AgentAnalytics
} from "../types";

// Enhanced Case Agent with memory, analytics, and intelligent context understanding

export class CaseAgent extends BaseAgent {
  private conversationMemory: Map<string, ConversationMemory> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private analytics: AgentAnalytics = {
    totalInteractions: 0,
    successfulInteractions: 0,
    averageResponseTime: 0,
    userSatisfaction: 0,
    actionSuccessRate: new Map(),
    totalSessions: 0,
    totalUsers: 0,
    averageSessionLength: 0,
    topActions: [],
    userEngagementDistribution: { low: 0, medium: 0, high: 0 }
  };

  constructor() {
    const config: AgentConfig = {
      name: 'CaseAgent',
      description: 'Advanced case-specific AI agent with memory, analytics, and intelligent context understanding',
      version: '2.0.0',
      capabilities: [
        'case_information',
        'action_suggestions',
        'related_cases',
        'donation_guidance',
        'adoption_information',
        'conversation_memory',
        'user_profiling',
        'intent_recognition',
        'emotional_intelligence',
        'performance_analytics',
        'context_persistence',
        'smart_actions',
        'multi_language_support'
      ],
      isEnabled: true,
      maxRetries: 3,
      timeout: 30000, // 30 seconds
    };

    super(config);
  }

  protected getSystemPrompt(): string {
    return `You are Toto, an advanced AI assistant specialized in pet rescue cases with emotional intelligence, memory, and contextual understanding.

🎯 CORE CAPABILITIES:
- Natural, empathetic conversations about pet rescue cases
- Memory of previous interactions and user preferences
- Intelligent intent recognition and context awareness
- Dynamic action suggestions based on conversation flow
- Multi-language support (Spanish/English) with cultural adaptation
- Emotional intelligence to match user's emotional state
- Performance analytics and continuous learning

🧠 INTELLIGENT CONVERSATION:
- FIRST MESSAGE: Brief, warm case summary (2-3 sentences) with animal's name, main issue, and current status. NO thanks for asking (automatic welcome).
- SUBSEQUENT MESSAGES: Context-aware responses based on conversation history and user intent.
- MEMORY INTEGRATION: Reference previous interactions naturally when relevant.
- EMOTIONAL MATCHING: Adapt tone to user's emotional state (concerned, excited, sad, etc.).
- INTENT RECOGNITION: Understand what user really wants (donate, adopt, learn, help, etc.).

🗣️ COMMUNICATION STYLE:
- Language: Respond in user's preferred language (Spanish/English) - NEVER mix languages
- Tone: Warm, caring, conversational, and empathetic
- Length: Concise (2-3 sentences) unless more detail is requested
- Structure: Information in digestible chunks, avoid information dumps
- Questions: Ask follow-up questions to understand user intent and keep conversation flowing
- Personalization: Adapt to user's communication style and preferences

🎯 ACTION INTELLIGENCE:
- Context-Aware Actions: Suggest actions based on case urgency, user history, and conversation flow
- Smart Suggestions: Recommend most relevant actions (donate, share, adopt, contact, learn more)
- Action Chaining: Suggest logical next steps based on user's current action
- Urgency Detection: Prioritize urgent cases and suggest immediate help options

📊 ENHANCED CONTEXT UNDERSTANDING:
- Case Richness: Use medical history, treatment plans, progress updates, guardian experience
- Related Cases: Reference similar cases when helpful for context
- Funding Progress: Highlight funding status and urgency when relevant
- Guardian Context: Consider guardian's experience and specialties
- User Profile: Adapt to user's interaction history and preferences

🔒 SAFETY & ETHICS:
- Medical Advice: NEVER provide medical diagnosis or treatment advice
- Promises: No guarantees about adoption timelines or outcomes
- Privacy: Respect user data and maintain confidentiality
- Transparency: Be honest about donation usage and platform policies

🎨 RESPONSE ADAPTATION:
- User Preferences: Adapt to user's preferred communication style
- Engagement Level: Match user's engagement level (low/medium/high)
- Cultural Context: Use appropriate cultural references and language nuances
- Emotional Intelligence: Respond appropriately to user's emotional state

Always be helpful, empathetic, and contextually aware. Use your memory and intelligence to provide the most relevant and personalized experience.`;
  }

  /**
   * Enhanced process case inquiry with memory, analytics, and intelligent context
   */
  async processCaseInquiry(
    message: string,
    caseData: CaseData,
    context: UserContext,
    conversationContext?: ConversationContext
  ): Promise<CaseResponse> {
    const startTime = Date.now();
    const sessionId = `${context.userId}_${caseData.id}_${Date.now()}`;

    try {
      // Update analytics
      this.analytics.totalInteractions++;

      // Get or create conversation memory
      const memory = this.getOrCreateConversationMemory(sessionId, context.userId, caseData.id);
      
      // Get or create user profile
      const userProfile = this.getOrCreateUserProfile(context.userId);

      // Enhance case data with additional context
      const enhancedCaseData = await this.enhanceCaseData(caseData);

      // Analyze user intent and emotional state
      const intentAnalysis = await this.analyzeUserIntent(message, memory, userProfile);
      const emotionalState = await this.detectEmotionalState(message);

      // Build comprehensive context
      const enhancedMessage = this.buildEnhancedContext(
        message,
        enhancedCaseData,
        context,
        memory,
        userProfile,
        intentAnalysis,
        emotionalState,
        conversationContext
      );

      // Process with enhanced context
      const result = await this.processMessage(enhancedMessage, context, conversationContext);

      const processingTime = Date.now() - startTime;

      // Update conversation memory
      this.updateConversationMemory(memory, message, result.message, intentAnalysis);

      // Update user profile
      this.updateUserProfile(userProfile, caseData.id, intentAnalysis);

      // Extract intelligent actions
      const actions = this.extractIntelligentActions(result.message || '', intentAnalysis, enhancedCaseData);

      // Generate contextual suggestions
      const suggestions = this.generateContextualSuggestions(enhancedCaseData, context, userProfile, intentAnalysis);

      // Update analytics
      this.updateAnalytics(processingTime, result.success, actions);

      return {
        success: result.success,
        message: result.message,
        caseData: enhancedCaseData,
        actions,
        suggestions,
        metadata: {
          agentType: this.config.name,
          confidence: this.calculateConfidence(intentAnalysis, emotionalState),
          processingTime,
          sessionId,
          intent: intentAnalysis.intent,
          emotionalState,
          userEngagement: userProfile.engagementLevel,
        },
        error: result.error,
      };

    } catch (error) {
      console.error('Error in enhanced CaseAgent:', error);
      
      const processingTime = Date.now() - startTime;
      this.analytics.successfulInteractions--; // Decrement on error
      
      return {
        success: false,
        message: this.getErrorMessage(),
        caseData,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          agentType: this.config.name,
          confidence: 0,
          processingTime,
          sessionId,
        },
      };
    }
  }

  // ===== MEMORY MANAGEMENT =====

  private getOrCreateConversationMemory(sessionId: string, userId: string, caseId: string): ConversationMemory {
    if (!this.conversationMemory.has(sessionId)) {
      this.conversationMemory.set(sessionId, {
        sessionId,
        userId,
        caseId,
        conversationHistory: [],
        userPreferences: {
          language: 'es', // Default to Spanish
          preferredActions: [],
          communicationStyle: 'empathetic',
          interests: []
        },
        contextSummary: '',
        lastInteraction: new Date()
      });
    }
    return this.conversationMemory.get(sessionId)!;
  }

  private getOrCreateUserProfile(userId: string): UserProfile {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        userId,
        interactionHistory: [],
        preferences: {
          animalTypes: [],
          actionTypes: [],
          communicationStyle: 'empathetic',
          language: 'es'
        },
        engagementLevel: 'medium',
        lastActive: new Date()
      });
    }
    return this.userProfiles.get(userId)!;
  }

  private updateConversationMemory(
    memory: ConversationMemory, 
    userMessage: string, 
    assistantMessage: string, 
    intentAnalysis: any
  ): void {
    memory.conversationHistory.push({
      timestamp: new Date(),
      role: 'user',
      message: userMessage,
      intent: intentAnalysis.intent
    });
    
    memory.conversationHistory.push({
      timestamp: new Date(),
      role: 'assistant',
      message: assistantMessage
    });

    memory.lastInteraction = new Date();
    memory.contextSummary = this.generateContextSummary(memory);
  }

  private updateUserProfile(userProfile: UserProfile, caseId: string, intentAnalysis: any): void {
    userProfile.interactionHistory.push({
      caseId,
      actions: intentAnalysis.suggestedActions || [],
      satisfaction: 0.8, // Default satisfaction, could be improved with feedback
      timestamp: new Date()
    });

    userProfile.lastActive = new Date();
    userProfile.engagementLevel = this.calculateEngagementLevel(userProfile);
  }

  // ===== ENHANCED CASE DATA =====

  private async enhanceCaseData(caseData: CaseData): Promise<EnhancedCaseData> {
    const enhanced: EnhancedCaseData = {
      ...caseData,
      urgencyLevel: this.determineUrgencyLevel(caseData),
      fundingProgress: this.calculateFundingProgress(caseData),
      medicalHistory: this.extractMedicalHistory(caseData),
      treatmentPlan: this.generateTreatmentPlan(caseData),
      progressUpdates: this.getProgressUpdates(caseData),
      relatedCases: await this.findRelatedCases(caseData),
      guardianExperience: await this.getGuardianExperience(caseData),
      adoptionRequirements: this.generateAdoptionRequirements(caseData),
      behavioralNotes: this.extractBehavioralNotes(caseData),
      medicalNotes: this.extractMedicalNotes(caseData)
    };

    return enhanced;
  }

  // ===== INTENT ANALYSIS =====

  private async analyzeUserIntent(message: string, memory: ConversationMemory, userProfile: UserProfile): Promise<IntentAnalysis> {
    const lowerMessage = message.toLowerCase();
    
    // Intent patterns
    const intents = {
      donate: ['donate', 'donation', 'donar', 'donación', 'help financially', 'ayudar económicamente'],
      adopt: ['adopt', 'adoptar', 'take home', 'llevar a casa', 'forever home', 'hogar permanente'],
      share: ['share', 'compartir', 'tell others', 'contar a otros', 'spread the word', 'difundir'],
      contact: ['contact', 'contactar', 'get in touch', 'ponerse en contacto', 'talk to', 'hablar con'],
      learn: ['learn', 'aprender', 'know more', 'saber más', 'information', 'información', 'details', 'detalles'],
      help: ['help', 'ayudar', 'assist', 'asistir', 'support', 'apoyar'],
      urgent: ['urgent', 'urgente', 'emergency', 'emergencia', 'asap', 'immediately', 'inmediatamente']
    };

    const detectedIntent = Object.keys(intents).find(intent => 
      intents[intent as keyof typeof intents].some(pattern => lowerMessage.includes(pattern))
    ) || 'general';

    const confidence = this.calculateIntentConfidence(message, detectedIntent);
    const suggestedActions = this.getSuggestedActionsForIntent(detectedIntent);

    return {
      intent: detectedIntent,
      confidence,
      suggestedActions,
      emotionalTone: this.detectEmotionalTone(message),
      urgency: this.detectUrgency(message)
    };
  }

  private async detectEmotionalState(message: string): Promise<string> {
    const emotionalKeywords = {
      concerned: ['worried', 'worried', 'preocupado', 'preocupada', 'anxious', 'ansioso'],
      sad: ['sad', 'triste', 'heartbroken', 'desconsolado', 'crying', 'llorando'],
      excited: ['excited', 'emocionado', 'thrilled', 'emocionado', 'happy', 'feliz'],
      angry: ['angry', 'enojado', 'furious', 'furioso', 'mad', 'molesto'],
      hopeful: ['hopeful', 'esperanzado', 'optimistic', 'optimista', 'positive', 'positivo']
    };

    const lowerMessage = message.toLowerCase();
    const detectedEmotion = Object.keys(emotionalKeywords).find(emotion =>
      emotionalKeywords[emotion as keyof typeof emotionalKeywords].some(keyword => 
        lowerMessage.includes(keyword)
      )
    ) || 'neutral';

    return detectedEmotion;
  }

  // ===== CONTEXT BUILDING =====

  private buildEnhancedContext(
    message: string,
    enhancedCaseData: EnhancedCaseData,
    context: UserContext,
    memory: ConversationMemory,
    userProfile: UserProfile,
    intentAnalysis: any,
    emotionalState: string,
    conversationContext?: ConversationContext
  ): string {
    const conversationHistory = this.buildConversationHistory(memory);
    const userContext = this.buildUserContext(userProfile, context);
    const caseContext = this.buildCaseContext(enhancedCaseData);
    const intentContext = this.buildIntentContext(intentAnalysis, emotionalState);

    return `${this.getSystemPrompt()}

${caseContext}

${userContext}

${conversationHistory}

${intentContext}

Current user message: ${message}

Remember: Be conversational, empathetic, and contextually aware. Use the conversation history and user profile to provide personalized responses.`;
  }

  // ===== INTELLIGENT ACTION EXTRACTION =====

  private extractIntelligentActions(response: string, intentAnalysis: any, enhancedCaseData: EnhancedCaseData): AgentAction[] {
    const actions: AgentAction[] = [];
    const lowerResponse = response.toLowerCase();

    // Enhanced action extraction based on intent and context
    const actionPatterns = {
      donate: {
        patterns: ['donate', 'donation', 'donar', 'donación', 'help financially', 'ayudar económicamente'],
        action: {
          type: 'donate' as const,
          payload: { 
            action: 'donate',
            caseId: enhancedCaseData.id,
            urgency: enhancedCaseData.urgencyLevel,
            amount: enhancedCaseData.fundingProgress?.target || 0
          },
        label: 'Donate',
        description: 'Make a donation to help this case',
          priority: enhancedCaseData.urgencyLevel === 'critical' ? 'high' as const : 'medium' as const
        }
      },
      share: {
        patterns: ['share', 'compartir', 'tell others', 'contar a otros', 'spread the word', 'difundir'],
        action: {
          type: 'share' as const,
          payload: { 
            action: 'share',
            caseId: enhancedCaseData.id,
            socialMedia: {
              twitter: enhancedCaseData.guardianTwitter,
              instagram: enhancedCaseData.guardianInstagram
            }
          },
        label: 'Share',
        description: 'Share this case with others',
          priority: 'medium' as const
        }
      },
      adopt: {
        patterns: ['adopt', 'adoptar', 'take home', 'llevar a casa', 'forever home', 'hogar permanente'],
        action: {
          type: 'adopt' as const,
          payload: { 
            action: 'adopt',
            caseId: enhancedCaseData.id,
            requirements: enhancedCaseData.adoptionRequirements
          },
        label: 'Adopt',
        description: 'Learn about adoption process',
          priority: 'high' as const
        }
      },
      contact: {
        patterns: ['contact', 'contactar', 'get in touch', 'ponerse en contacto', 'talk to', 'hablar con'],
        action: {
          type: 'contact' as const,
          payload: { 
            action: 'contact',
            caseId: enhancedCaseData.id,
            guardianId: enhancedCaseData.guardianId
          },
        label: 'Contact Guardian',
        description: 'Get in touch with the case guardian',
          priority: 'medium' as const
        }
      },
      learn: {
        patterns: ['learn', 'aprender', 'know more', 'saber más', 'information', 'información', 'details', 'detalles'],
        action: {
          type: 'learn' as const,
          payload: { 
            action: 'learn',
            caseId: enhancedCaseData.id,
            topics: ['medical', 'behavioral', 'adoption', 'funding']
          },
          label: 'Learn More',
          description: 'Get more information about this case',
          priority: 'low' as const
        }
      }
    };

    // Extract actions based on response content and intent
    Object.entries(actionPatterns).forEach(([actionType, config]) => {
      const hasPattern = config.patterns.some(pattern => lowerResponse.includes(pattern));
      const matchesIntent = intentAnalysis.intent === actionType;
      
      if (hasPattern || matchesIntent) {
        actions.push(config.action);
      }
    });

    // Add contextual actions based on case urgency and user profile
    if (enhancedCaseData.urgencyLevel === 'critical' && !actions.find(a => a.type === 'donate')) {
      actions.unshift({
        type: 'donate' as const,
        payload: { action: 'donate', caseId: enhancedCaseData.id, urgency: 'critical' },
        label: 'Urgent Donation',
        description: 'This case needs immediate help',
        priority: 'critical' as const
      });
    }

    return actions;
  }

  // ===== CONTEXTUAL SUGGESTIONS =====

  private generateContextualSuggestions(
    enhancedCaseData: EnhancedCaseData, 
    context: UserContext, 
    userProfile: UserProfile, 
    intentAnalysis: any
  ): string[] {
    const suggestions: string[] = [];

    // Urgency-based suggestions
    if (enhancedCaseData.urgencyLevel === 'critical') {
      suggestions.push('🚨 This case is critical and needs immediate help!');
    } else if (enhancedCaseData.urgencyLevel === 'high') {
      suggestions.push('⚠️ This case needs urgent attention.');
    }

    // Funding progress suggestions
    if (enhancedCaseData.fundingProgress) {
      const { current, target, percentage } = enhancedCaseData.fundingProgress;
      if (percentage < 50) {
        suggestions.push(`💰 Funding progress: ${percentage.toFixed(1)}% of $${target} target reached.`);
      } else if (percentage < 100) {
        suggestions.push(`🎯 Great progress! ${percentage.toFixed(1)}% of funding goal reached.`);
      } else {
        suggestions.push(`🎉 Funding goal reached! Additional support still helps.`);
      }
    }

    // User-specific suggestions
    if (userProfile.engagementLevel === 'high') {
      suggestions.push('Thank you for your continued support!');
    } else if (userProfile.engagementLevel === 'low') {
      suggestions.push('Every little bit helps make a difference.');
    }

    // Intent-based suggestions
    switch (intentAnalysis.intent) {
      case 'donate':
        suggestions.push('Your donation will directly help this animal receive the care they need.');
        break;
      case 'adopt':
        suggestions.push('Adoption requirements and process information available.');
        break;
      case 'share':
        suggestions.push('Sharing helps reach more potential supporters.');
        break;
    }

    return suggestions;
  }

  // ===== ANALYTICS & PERFORMANCE =====

  private updateAnalytics(processingTime: number, success: boolean, actions: AgentAction[]): void {
    if (success) {
      this.analytics.successfulInteractions++;
    }

    // Update average response time
    const totalTime = this.analytics.averageResponseTime * (this.analytics.totalInteractions - 1) + processingTime;
    this.analytics.averageResponseTime = totalTime / this.analytics.totalInteractions;

    // Update action success rates
    actions.forEach(action => {
      const currentRate = this.analytics.actionSuccessRate.get(action.type) || 0;
      this.analytics.actionSuccessRate.set(action.type, currentRate + 0.1);
    });
  }

  private calculateConfidence(intentAnalysis: any, emotionalState: string): number {
    let confidence = intentAnalysis.confidence || 0.8;
    
    // Adjust confidence based on emotional state
    if (emotionalState === 'neutral') {
      confidence += 0.1;
    } else if (['concerned', 'sad', 'angry'].includes(emotionalState)) {
      confidence -= 0.1;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  // ===== HELPER METHODS =====

  private determineUrgencyLevel(caseData: CaseData): 'low' | 'medium' | 'high' | 'critical' {
    if (caseData.status === 'urgent') return 'critical';
    if (caseData.status === 'active') return 'medium';
    return 'low';
  }

  private calculateFundingProgress(caseData: CaseData) {
    if (!caseData.targetAmount || !caseData.currentAmount) return undefined;
    
    return {
      target: caseData.targetAmount,
      current: caseData.currentAmount,
      percentage: (caseData.currentAmount / caseData.targetAmount) * 100
    };
  }

  private extractMedicalHistory(caseData: CaseData): string[] {
    // This would integrate with medical records in a real implementation
    return ['Initial health assessment completed', 'Vaccination schedule updated'];
  }

  private generateTreatmentPlan(caseData: CaseData): string {
    // This would integrate with veterinary records in a real implementation
    return 'Ongoing medical care and monitoring as needed';
  }

  private getProgressUpdates(caseData: CaseData) {
    return [
      {
        date: new Date().toISOString(),
        update: 'Case is progressing well',
        type: 'medical' as const
      }
    ];
  }

  private async findRelatedCases(caseData: CaseData) {
    // This would query the database for similar cases
    return [
      {
        id: 'related-001',
        name: 'Similar Case',
        similarity: 0.8,
        reason: 'Same animal type and condition'
      }
    ];
  }

  private async getGuardianExperience(caseData: CaseData) {
    return {
      yearsActive: 3,
      casesHandled: 15,
      successRate: 0.9,
      specialties: ['dogs', 'cats']
    };
  }

  private generateAdoptionRequirements(caseData: CaseData): string[] {
    return ['Stable home environment', 'Regular veterinary care', 'Love and attention'];
  }

  private extractBehavioralNotes(caseData: CaseData): string[] {
    return ['Friendly and social', 'Good with children'];
  }

  private extractMedicalNotes(caseData: CaseData): string[] {
    return ['Up to date on vaccinations', 'No known health issues'];
  }

  private calculateIntentConfidence(message: string, intent: string): number {
    // Simple confidence calculation based on keyword matches
    const intentKeywords = {
      donate: ['donate', 'donation', 'donar', 'donación'],
      adopt: ['adopt', 'adoptar', 'take home', 'llevar a casa'],
      share: ['share', 'compartir', 'tell others', 'contar a otros'],
      contact: ['contact', 'contactar', 'get in touch', 'ponerse en contacto'],
      learn: ['learn', 'aprender', 'know more', 'saber más']
    };

    const keywords = intentKeywords[intent as keyof typeof intentKeywords] || [];
    const matches = keywords.filter(keyword => message.toLowerCase().includes(keyword)).length;
    
    return Math.min(matches / keywords.length + 0.5, 1);
  }

  private getSuggestedActionsForIntent(intent: string): string[] {
    const actionMap = {
      donate: ['donate', 'share'],
      adopt: ['adopt', 'contact', 'learn'],
      share: ['share', 'donate'],
      contact: ['contact', 'learn'],
      learn: ['learn', 'adopt', 'donate'],
      help: ['donate', 'share', 'adopt', 'contact'],
      urgent: ['donate', 'contact', 'share']
    };

    return actionMap[intent as keyof typeof actionMap] || ['donate', 'share', 'adopt'];
  }

  private detectEmotionalTone(message: string): string {
    // Simple emotional tone detection
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('!') || lowerMessage.includes('excited')) return 'excited';
    if (lowerMessage.includes('?') || lowerMessage.includes('worried')) return 'concerned';
    if (lowerMessage.includes('sad') || lowerMessage.includes('triste')) return 'sad';
    
    return 'neutral';
  }

  private detectUrgency(message: string): 'low' | 'medium' | 'high' {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('urgent') || lowerMessage.includes('emergency')) return 'high';
    if (lowerMessage.includes('asap') || lowerMessage.includes('immediately')) return 'high';
    if (lowerMessage.includes('soon') || lowerMessage.includes('pronto')) return 'medium';
    
    return 'low';
  }

  private generateContextSummary(memory: ConversationMemory): string {
    const recentMessages = memory.conversationHistory.slice(-4);
    return recentMessages.map(msg => `${msg.role}: ${msg.message.substring(0, 50)}...`).join(' | ');
  }

  private calculateEngagementLevel(userProfile: UserProfile): 'low' | 'medium' | 'high' {
    const recentInteractions = userProfile.interactionHistory.filter(
      interaction => Date.now() - interaction.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );

    if (recentInteractions.length >= 5) return 'high';
    if (recentInteractions.length >= 2) return 'medium';
    return 'low';
  }

  private buildConversationHistory(memory: ConversationMemory): string {
    if (memory.conversationHistory.length === 0) return '';
    
    return `\nConversation History:\n${memory.conversationHistory
      .slice(-6) // Last 6 messages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Toto'}: ${msg.message}`)
      .join('\n')}`;
  }

  private buildUserContext(userProfile: UserProfile, context: UserContext): string {
    return `\nUser Profile:
- Engagement Level: ${userProfile.engagementLevel}
- Preferred Language: ${userProfile.preferences.language}
- Communication Style: ${userProfile.preferences.communicationStyle}
- Animal Interests: ${userProfile.preferences.animalTypes.join(', ') || 'General'}
- Recent Actions: ${userProfile.interactionHistory.slice(-3).map(i => i.actions.join(', ')).join(' | ')}`;
  }

  private buildCaseContext(enhancedCaseData: EnhancedCaseData): string {
    return `\nCase Information:
- Name: ${enhancedCaseData.name} (${enhancedCaseData.id})
- Status: ${enhancedCaseData.status}
- Animal Type: ${enhancedCaseData.animalType}
- Location: ${enhancedCaseData.location}
- Guardian: ${enhancedCaseData.guardianName}
- Description: ${enhancedCaseData.description}
- Urgency Level: ${enhancedCaseData.urgencyLevel}
- Funding Progress: ${enhancedCaseData.fundingProgress ? `${enhancedCaseData.fundingProgress.percentage.toFixed(1)}%` : 'N/A'}
${enhancedCaseData.guardianBankingAlias ? `- Banking Alias: ${enhancedCaseData.guardianBankingAlias}` : ''}
${enhancedCaseData.guardianTwitter ? `- Guardian Twitter: @${enhancedCaseData.guardianTwitter}` : ''}
${enhancedCaseData.guardianInstagram ? `- Guardian Instagram: @${enhancedCaseData.guardianInstagram}` : ''}`;
  }

  private buildIntentContext(intentAnalysis: any, emotionalState: string): string {
    return `\nIntent Analysis:
- Detected Intent: ${intentAnalysis.intent}
- Confidence: ${(intentAnalysis.confidence * 100).toFixed(1)}%
- Emotional State: ${emotionalState}
- Urgency: ${intentAnalysis.urgency}
- Suggested Actions: ${intentAnalysis.suggestedActions?.join(', ') || 'None'}`;
  }

  // ===== PUBLIC ANALYTICS METHODS =====

  public getAnalytics(): AgentAnalytics {
    return {
      ...this.analytics,
      totalSessions: this.conversationMemory.size,
      totalUsers: this.userProfiles.size,
      averageSessionLength: this.calculateAverageSessionLength(),
      topActions: this.getTopActions(),
      userEngagementDistribution: this.getUserEngagementDistribution()
    };
  }

  public getUserProfile(userId: string): UserProfile | undefined {
    return this.userProfiles.get(userId);
  }

  public getConversationMemory(sessionId: string): ConversationMemory | undefined {
    return this.conversationMemory.get(sessionId);
  }

  private calculateAverageSessionLength(): number {
    const sessions = Array.from(this.conversationMemory.values());
    if (sessions.length === 0) return 0;
    
    const totalMessages = sessions.reduce((sum, session) => sum + session.conversationHistory.length, 0);
    return totalMessages / sessions.length;
  }

  private getTopActions(): Array<{ action: string; count: number }> {
    const actionCounts = new Map<string, number>();
    
    this.userProfiles.forEach(profile => {
      profile.interactionHistory.forEach(interaction => {
        interaction.actions.forEach(action => {
          actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
        });
      });
    });

    return Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private getUserEngagementDistribution(): { low: number; medium: number; high: number } {
    const distribution = { low: 0, medium: 0, high: 0 };
    
    this.userProfiles.forEach(profile => {
      distribution[profile.engagementLevel]++;
    });

    return distribution;
  }

  protected getErrorMessage(): string {
    return 'I apologize, but I encountered an issue getting information about this case. Please try again or contact support.';
  }
}
