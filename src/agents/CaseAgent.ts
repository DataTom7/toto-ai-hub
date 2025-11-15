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
import { RAGService } from '../services/RAGService';

// Enhanced Case Agent with memory, analytics, and intelligent context understanding

/**
 * CaseAgent - Handles case-related conversations with users
 * Default Audience: 'donors' (can be overridden based on userRole)
 * This agent serves primarily donor-facing interactions, but adapts to guardian/admin roles
 */
export class CaseAgent extends BaseAgent {
  private conversationMemory: Map<string, ConversationMemory> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private ragService?: RAGService;
  // Default audience for KB retrieval - primarily serves donors
  private readonly DEFAULT_AUDIENCE = 'donors';
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

  /**
   * Set RAG service for knowledge retrieval
   */
  setRAGService(ragService: RAGService): void {
    this.ragService = ragService;
  }

  /**
   * Retrieve relevant knowledge using RAG
   */
  private async retrieveRelevantKnowledge(message: string, context?: string, userContext?: UserContext): Promise<string> {
    if (!this.ragService) {
      return '';
    }

    try {
      // Determine audience from user context (default to 'donors' for CaseAgent)
      // CaseAgent primarily serves donors, but adapts based on user role
      let audience = this.DEFAULT_AUDIENCE;
      if (userContext?.userRole) {
        // Map user roles to audience types
        if (userContext.userRole === 'guardian' || userContext.userRole === 'admin') {
          audience = 'guardians';
        } else if (userContext.userRole === 'investor' || userContext.userRole === 'lead_investor') {
          audience = 'investors';
        } else if (userContext.userRole === 'partner') {
          audience = 'partners';
        }
      }

      const result = await this.ragService.retrieveKnowledge({
        query: message,
        agentType: 'CaseAgent',
        context,
        audience, // Pass audience for relevance scoring
        maxResults: 3
      });

      if (result.chunks.length === 0) {
        return '';
      }

      // Format knowledge chunks for the system prompt
      const knowledgeContext = result.chunks.map(chunk => 
        `**${chunk.title}**\n${chunk.content}`
      ).join('\n\n');

      return knowledgeContext;
    } catch (error) {
      console.error('Error retrieving knowledge:', error);
      return '';
    }
  }

  /**
   * Process message with knowledge context
   */
  private async processMessageWithKnowledge(
    message: string,
    context: UserContext,
    conversationContext?: ConversationContext,
    knowledgeContext?: string
  ): Promise<any> {
    const startTime = Date.now();

    try {
      const systemPrompt = this.getSystemPrompt(knowledgeContext);
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

  protected getSystemPrompt(knowledgeContext?: string): string {
    const basePrompt = `You are Toto, an advanced AI assistant specialized in pet rescue cases with emotional intelligence, memory, and contextual understanding.

🚨 CRITICAL RULE: USE ONLY PROVIDED CASE DATA
- You receive case information in the "Case Information" section below
- ONLY use the exact case details provided: name, description, status, animal type, location, guardian name, banking alias
- NEVER make up, invent, or assume case details that are not explicitly provided
- If something is not in the case data, say "no tengo esa información disponible" or "esa información no está disponible"
- NEVER confuse one case with another or mix up case details
- If banking alias is missing from Case Information, say "el alias no está disponible" and immediately offer TRF
- CRITICAL: If you don't know something, say you don't know. Do NOT make it up.

🚨 CRITICAL: TRF DEFINITION (NEVER INVENT TRANSLATIONS)
- TRF = "Toto Rescue Fund" (English) or "Fondo de Rescate de Toto" (Spanish)
- When explaining TRF, ALWAYS say: "TRF (Toto Rescue Fund)" or "TRF (Fondo de Rescate de Toto)"
- NEVER translate TRF as "Transferencia Rápida de Fondos" - this is WRONG
- NEVER invent other Spanish translations like "Transferencia de Rescate Felino" or "Transferencia Rápida y Fácil" - these are WRONG
- If you mention TRF, you MUST clarify: "TRF es el Fondo de Rescate de Toto" or "TRF (Toto Rescue Fund)"

🚨 CRITICAL: DONATION PROCESS (NEVER SAY "THROUGH THE PLATFORM")
- Donations are DIRECT bank transfers from donor's bank account/wallet to guardian's banking alias
- NEVER say "through our platform", "through the platform", "directly through our platform", or "a través de la plataforma" - this is WRONG
- CORRECT: "transferencia directa desde tu banco/billetera al alias del guardián" or "direct transfer to the guardian's banking alias"
- The platform ONLY provides the banking alias - money goes directly from donor to guardian, NO platform processing
- 🚨 WHEN USER SHOWS DONATION INTENT (says "quiero donar", "donar", "donate", etc.):
  * Immediately explain the donation process: "Puedes hacer una transferencia directa desde tu cuenta bancaria o billetera al alias del guardián"
  * Mention there's no minimum amount: "No hay un monto mínimo, ¡cada ayuda cuenta!"
  * Offer to explain verification/totitos: "¿Te gustaría saber cómo verificar tu donación y obtener totitos?"
  * NEVER include the actual banking alias value in your message text. Only mention "al alias del guardián" without the alias itself. The alias will be provided separately via quick action button.

🚨 CRITICAL: TOTITOS SYSTEM (ALWAYS EXPLAIN WHEN ASKED)
- Totitos are a loyalty/reward system for verified donations and sharing cases
- Users earn totitos for verified donations (amount doesn't matter, only that it's verified)
- Sharing cases on social media also earns totitos
- User rating (1-5 stars) multiplies totitos: 1 star = 1x, 2 stars = 2x, etc.
- Totitos can be exchanged for goods or services for pets
- Users can see totitos in their profile (bottom navbar)
- When asked about totitos, explain: "Totitos son un sistema de recompensas por donaciones verificadas"

🚨 CRITICAL: MINIMUM DONATION AMOUNT
- There is NO minimum donation amount - NEVER say there is a minimum
- Say: "No hay un monto mínimo para donar, ¡cada ayuda cuenta!" or "You can donate any amount - every donation helps!"
- Every donation helps, regardless of size
- Never mention "$10 minimum" or any minimum amount

🚨 CRITICAL: SOCIAL MEDIA SHARING PROCESS
- When users show intent to share a case, ask which platform they prefer (Instagram, Twitter/X, Facebook)
- If user specifies a platform: Acknowledge their choice and provide encouragement
- If user says "all" or "todas": Acknowledge they want to share on all platforms
- 🚨 CRITICAL: NEVER include actual social media handles (e.g., @omfa_refugio) or URLs in your message text
- 🚨 CRITICAL: NEVER mention the guardian's social media handle or profile name in the message text
- The social media URLs will be provided separately via quick action buttons
- Keep your response focused on encouraging sharing and explaining the impact
- Do NOT mix donation information with sharing information in the same message
- Example CORRECT response: "¡Qué bueno que quieras compartir el caso de Mía! Compartir es una excelente manera de ayudarla a llegar a más personas que puedan colaborar."
- Example WRONG response: "Puedes encontrar a Puchi Lagarzasosa en Instagram como @omfa_refugio" (DO NOT include handles/URLs)

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
- AFFIRMATIVE RESPONSES: When user says "Si", "Yes", "Ok" after you've already introduced the case:
  * If you've provided case info already: Progress to explaining HOW to help (donation steps, sharing options, adoption info)
  * Ask specific follow-up questions: "¿Cómo te gustaría ayudar?" or "¿Qué te gustaría saber más?"
  * Offer concrete next steps: Explain donation process, sharing options, or adoption requirements
  * NEVER repeat the same case summary you already gave
- CONVERSATION PROGRESSION: Each message should advance the conversation. If you've covered case basics, move to actionable steps.
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
- Case Richness: Use ONLY the medical history, treatment plans, progress updates provided in Case Information
- Related Cases: Reference similar cases when helpful for context (but only if mentioned in context)
- Funding Progress: Highlight funding status and urgency when relevant (from Case Information)
- Guardian Context: Use guardian name and alias from Case Information only
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

Always be helpful, empathetic, and contextually aware. Use your memory and intelligence to provide the most relevant and personalized experience. NEVER invent case details.`;

    // Add knowledge context if provided
    if (knowledgeContext) {
      return `${basePrompt}

📚 RELEVANT KNOWLEDGE BASE INFORMATION:
${knowledgeContext}

Use this knowledge base information to provide accurate, up-to-date responses about donations, case management, and social media processes. Always reference this information when relevant to user questions.`;
    }

    return basePrompt;
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
    // Use conversationContext.conversationId if available, otherwise create stable sessionId
    // This ensures conversation memory persists across multiple messages in the same conversation
    const sessionId = conversationContext?.conversationId 
      ? conversationContext.conversationId 
      : `${context.userId}_${caseData.id}`;

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

      // Retrieve relevant knowledge using RAG (pass user context for audience determination)
      const knowledgeContext = await this.retrieveRelevantKnowledge(message, JSON.stringify({
        caseData: enhancedCaseData,
        userContext: context,
        conversationHistory: memory.conversationHistory
      }), context);

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

      // Process with enhanced context and knowledge
      const result = await this.processMessageWithKnowledge(enhancedMessage, context, conversationContext, knowledgeContext);

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

      // Add guardian banking alias to metadata if donation intent detected and alias is available
      const metadata: any = {
        agentType: this.config.name,
        confidence: this.calculateConfidence(intentAnalysis, emotionalState),
        processingTime,
        sessionId,
        intent: intentAnalysis.intent,
        emotionalState,
        userEngagement: userProfile.engagementLevel,
      };
      
      // Include banking alias in metadata when donation intent is detected
      if (intentAnalysis.intent === 'donate' && enhancedCaseData.guardianBankingAlias) {
        metadata.guardianBankingAlias = enhancedCaseData.guardianBankingAlias;
      }
      
      // Include social media URLs in metadata when sharing intent is detected
      if (intentAnalysis.intent === 'share') {
        const lowerMessage = message.toLowerCase();
        const wantsAll = lowerMessage.includes('all') || lowerMessage.includes('todas') || lowerMessage.includes('todos');
        
        const socialUrls: any = {};
        
        // If user says "all", include all available platforms
        // Otherwise, include all available platforms (frontend will show all buttons)
        // The agent should ask which platform, but if user says "all", provide all
        if (enhancedCaseData.guardianInstagram) {
          // If it's already a URL, use it; otherwise construct from handle
          socialUrls.instagram = enhancedCaseData.guardianInstagram.startsWith('http') 
            ? enhancedCaseData.guardianInstagram 
            : `https://instagram.com/${enhancedCaseData.guardianInstagram.replace('@', '')}`;
        }
        if (enhancedCaseData.guardianTwitter) {
          socialUrls.twitter = enhancedCaseData.guardianTwitter.startsWith('http')
            ? enhancedCaseData.guardianTwitter
            : `https://twitter.com/${enhancedCaseData.guardianTwitter.replace('@', '')}`;
        }
        if (enhancedCaseData.guardianFacebook) {
          socialUrls.facebook = enhancedCaseData.guardianFacebook.startsWith('http')
            ? enhancedCaseData.guardianFacebook
            : `https://facebook.com/${enhancedCaseData.guardianFacebook}`;
        }
        
        // Only add if at least one URL exists
        if (Object.keys(socialUrls).length > 0) {
          metadata.socialMediaUrls = socialUrls;
        }
      }

      return {
        success: result.success,
        message: result.message,
        caseData: enhancedCaseData,
        actions,
        suggestions,
        metadata,
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

  /**
   * Fetch guardian banking alias from Firestore if not provided in caseData
   */
  private async fetchGuardianBankingAlias(guardianId: string): Promise<string | undefined> {
    if (!guardianId || guardianId === 'unknown') {
      return undefined;
    }

    try {
      const admin = (await import('firebase-admin')).default;
      const db = admin.firestore(); // Uses default app (toto-app-stg)
      
      const guardianDoc = await db.collection('users').doc(guardianId).get();
      
      if (guardianDoc.exists) {
        const guardianData = guardianDoc.data();
        // Get primary alias (first in array or legacy field)
        return guardianData?.bankingAccountAlias || 
          (guardianData?.bankingAccountAliases && guardianData.bankingAccountAliases.length > 0 
            ? guardianData.bankingAccountAliases[0] 
            : undefined);
      }
      
      return undefined;
    } catch (error) {
      console.warn(`Could not fetch guardian banking alias for guardian ${guardianId}:`, error);
      return undefined;
    }
  }

  private async enhanceCaseData(caseData: CaseData): Promise<EnhancedCaseData> {
    // Fetch guardian banking alias from Firestore if not provided
    let guardianBankingAlias = caseData.guardianBankingAlias;
    
    if (!guardianBankingAlias && caseData.guardianId) {
      guardianBankingAlias = await this.fetchGuardianBankingAlias(caseData.guardianId);
    }

    const enhanced: EnhancedCaseData = {
      ...caseData,
      guardianBankingAlias: guardianBankingAlias, // Ensure it's set from Firestore if missing
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
    const lowerMessage = message.toLowerCase().trim();
    
    // Check for affirmative responses that indicate user wants to continue/progress
    const affirmativePatterns = ['si', 'sí', 'yes', 'ok', 'okay', 'vale', 'claro', 'por supuesto', 'of course', 'sure'];
    const isAffirmative = affirmativePatterns.some(pattern => 
      lowerMessage === pattern || lowerMessage === `${pattern}.` || lowerMessage === `${pattern}!`
    );
    
    // If it's an affirmative response and we have conversation history, interpret as "continue/progress"
    if (isAffirmative && memory.conversationHistory.length > 0) {
      // Check what was last discussed to determine next step
      const lastAssistantMessage = memory.conversationHistory
        .filter(msg => msg.role === 'assistant')
        .slice(-1)[0]?.message?.toLowerCase() || '';
      
      // If we've already introduced the case, user likely wants to know how to help
      if (lastAssistantMessage.includes('nina') || lastAssistantMessage.includes('perrita') || 
          lastAssistantMessage.includes('caso') || lastAssistantMessage.includes('ayuda')) {
        return {
          intent: 'help',
          confidence: 0.9,
          suggestedActions: ['donate', 'share', 'learn'],
          emotionalTone: 'neutral',
          urgency: 'medium'
        };
      }
    }
    
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
    ) || (isAffirmative ? 'help' : 'general');

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
    
    // Detect if case information has already been provided
    const hasProvidedCaseInfo = memory.conversationHistory.some(msg => 
      msg.role === 'assistant' && (
        msg.message.toLowerCase().includes(enhancedCaseData.name?.toLowerCase() || '') ||
        msg.message.toLowerCase().includes('perrita') ||
        msg.message.toLowerCase().includes('perro') ||
        msg.message.toLowerCase().includes('gato') ||
        msg.message.toLowerCase().includes('caso')
      )
    );
    
    // Check if user is giving affirmative response after case info was provided
    const isAffirmativeAfterIntro = intentAnalysis.intent === 'help' && 
      memory.conversationHistory.length >= 2 &&
      hasProvidedCaseInfo &&
      ['si', 'sí', 'yes', 'ok', 'okay', 'vale', 'claro'].some(affirm => 
        message.toLowerCase().trim().startsWith(affirm)
      );

    const progressionContext = isAffirmativeAfterIntro 
      ? `\n⚠️ IMPORTANT: User has already been introduced to the case and is now saying "Si/Yes" to proceed. 
DO NOT repeat the case introduction. Instead:
- Explain HOW they can help (donation process, sharing steps, adoption info)
- Ask what specific aspect they want to know more about
- Provide actionable next steps
- Progress the conversation forward`
      : '';

    return `${this.getSystemPrompt()}

${caseContext}

${userContext}

${conversationHistory}

${intentContext}

${progressionContext}

Current user message: ${message}

Remember: Be conversational, empathetic, and contextually aware. Use the conversation history and user profile to provide personalized responses. ${isAffirmativeAfterIntro ? 'PROGRESS THE CONVERSATION - do not repeat what you already said.' : ''}`;
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
                instagram: enhancedCaseData.guardianInstagram,
                facebook: enhancedCaseData.guardianFacebook
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
${enhancedCaseData.guardianInstagram ? `- Guardian Instagram: @${enhancedCaseData.guardianInstagram}` : ''}
${enhancedCaseData.guardianFacebook ? `- Guardian Facebook: ${enhancedCaseData.guardianFacebook}` : ''}`;
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
