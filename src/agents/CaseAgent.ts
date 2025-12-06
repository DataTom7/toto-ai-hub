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
import { generateFormattingHints } from '../utils/responseFormatting';
import { normalizeCaseResponse } from '../utils/responseValidation';
import { createErrorResponse, getUserErrorMessage } from '../utils/errorResponses';
import { getActionMessageTemplate, getShareMessageConfig } from '../utils/actionConfig';
import { buildCaseAgentSystemPrompt } from '../prompts/caseAgentPrompts';
import { getTRFAlias, isValidBankingAlias } from '../config/banking.config';
import { CASE_AGENT_CONSTANTS } from '../config/constants';
import { hasAmount, hasAmountInHistory, extractAmount } from '../utils/amountDetection';
import { safeValidateProcessCaseInquiryInput } from '../validators/caseAgent.validators';
import { getFirestore } from '../config/firestore.config';
import { handleError } from '../utils/errorHandler';
import { getRateLimitService } from '../services/RateLimitService';
import { RateLimitError } from '../errors/AppErrors';
import { Cache, createCache } from '../utils/cache';
import { CACHE_CONSTANTS } from '../config/constants';
import { getMetricsService, MetricCategory } from '../services/MetricsService';
import { getFewShotLearningService } from '../services/FewShotLearningService';

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
  private translationCache: Map<string, string> = new Map(); // Cache for language-agnostic intent detection
  // Intent embeddings cache - pre-computed embeddings for multilingual intent detection
  private intentEmbeddingsCache: Map<string, number[][]> = new Map();
  // Intent detection cache
  private intentCache: Cache<IntentAnalysis>;
  // Default audience for KB retrieval - primarily serves donors
  private readonly DEFAULT_AUDIENCE = CASE_AGENT_CONSTANTS.DEFAULT_AUDIENCE;
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

    // Initialize intent cache
    this.intentCache = createCache<IntentAnalysis>(
      CACHE_CONSTANTS.INTENT_TTL_MS,
      CACHE_CONSTANTS.INTENT_MAX_SIZE,
      'intent'
    );

    console.log('[CaseAgent] ✅ Intent cache initialized');
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
      let audience: string = this.DEFAULT_AUDIENCE;
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
        console.warn(`[CaseAgent] No KB entries retrieved for query: "${message.substring(0, 50)}..."`);
        return '';
      }

      // Format knowledge chunks for the system prompt
      // Include both title and content so post-processing can detect help-seeking KB entry
      const knowledgeContext = result.chunks.map(chunk => 
        `**${chunk.title}**\n${chunk.content}`
      ).join('\n\n');

      // Enhanced KB retrieval logging for flow verification
      console.log(`[CaseAgent] Retrieved ${result.chunks.length} KB entries for query: "${message.substring(0, 50)}..." (confidence: ${result.confidence?.toFixed(2) || 'N/A'})`);
      result.chunks.forEach((chunk, idx) => {
        console.log(`  [${idx + 1}] ${chunk.title} (ID: ${chunk.id || 'N/A'})`);
        // Log if critical flow entries are retrieved
        if (chunk.id?.includes('flow-donation-intent')) {
          console.log(`    ✅ Donation intent flow KB retrieved`);
        }
        if (chunk.id?.includes('flow-donation-amount-selected')) {
          console.log(`    ✅ Donation amount selected flow KB retrieved`);
        }
        if (chunk.id?.includes('flow-help-seeking')) {
          console.log(`    ✅ Help-seeking flow KB retrieved`);
        }
        if (chunk.id?.includes('flow-sharing-intent')) {
          console.log(`    ✅ Sharing intent flow KB retrieved`);
        }
      });

      return knowledgeContext;
    } catch (error) {
      console.error('Error retrieving knowledge:', error);
      return '';
    }
  }

  /**
   * Process message with knowledge context
   * IMPORTANT: The 'message' parameter is actually the FULL enhanced context built by buildEnhancedContext()
   * It already includes system prompt, case context, conversation history, KB context, etc.
   * We should use it directly, not rebuild the prompt.
   */
  private async processMessageWithKnowledge(
    message: string, // This is actually the full enhanced context
    context: UserContext,
    conversationContext?: ConversationContext,
    knowledgeContext?: string
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // The 'message' parameter is already the complete enhanced context from buildEnhancedContext()
      // It includes: system prompt + case context + user context + conversation history + KB context + user message
      // We should use it directly instead of rebuilding
      const fullPrompt = message;

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

  protected getSystemPrompt(knowledgeContext?: string, fewShotExamples?: string): string {
    // Use new modular prompt builder with few-shot learning support
    return buildCaseAgentSystemPrompt(knowledgeContext, fewShotExamples);
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

    // Validate inputs
    const validationResult = safeValidateProcessCaseInquiryInput({
      message,
      caseData,
      userContext: context,
      conversationContext,
    });

    if (!validationResult.success) {
      console.error('[CaseAgent] Input validation failed:', validationResult.error.errors);
      const errorMessages = validationResult.error.errors.map(e => e.message).join(', ');
      const errorResponse = createErrorResponse('VALIDATION_ERROR', {
        validationErrors: errorMessages
      });
      return {
        success: false,
        message: errorResponse.userMessage[context?.language === 'en' ? 'en' : 'es'],
        error: errorResponse.message
      };
    }

    // Use validated data (trimmed, sanitized)
    const validated = validationResult.data;
    const validatedMessage = validated.message;
    // Use original caseData since it has the correct complete type
    const validatedCaseData = caseData;
    const validatedContext = validated.userContext;

    // Add rate limiting
    try {
      const rateLimitService = getRateLimitService();
      rateLimitService.checkLimit({
        userId: validatedContext.userId,
        userRole: validatedContext.userRole,
      });
    } catch (error) {
      if (error instanceof RateLimitError) {
        console.warn('[CaseAgent] ⚠️  Rate limit exceeded:', {
          userId: validatedContext.userId,
          limit: error.limit,
          retryAfterMs: error.retryAfterMs,
        });

        return {
          success: false,
          message: error.getUserMessage(validatedContext.language),
          error: 'RATE_LIMIT_EXCEEDED',
        } as CaseResponse;
      }
      throw error;
    }

    // Use conversationContext.conversationId if available, otherwise create stable sessionId
    // This ensures conversation memory persists across multiple messages in the same conversation
    const sessionId = conversationContext?.conversationId 
      ? conversationContext.conversationId 
      : `${validatedContext.userId}_${validatedCaseData.id}`;

    const metrics = getMetricsService();
    const stopTimer = metrics.startTimer('process_case_inquiry', MetricCategory.PERFORMANCE);

    try {
      // Update analytics
      this.analytics.totalInteractions++;

      // Get or create conversation memory
      const memory = this.getOrCreateConversationMemory(sessionId, validatedContext.userId, validatedCaseData.id);
      
      // Get or create user profile
      const userProfile = this.getOrCreateUserProfile(validatedContext.userId);

      // Enhance case data with additional context
      const enhancedCaseData = await this.enhanceCaseData(validatedCaseData);

      // Analyze user intent and emotional state
      const intentAnalysis = await this.analyzeUserIntent(validatedMessage, memory, userProfile);
      const emotionalState = await this.detectEmotionalState(validatedMessage);

      // Retrieve relevant knowledge using RAG (pass user context for audience determination)
      const knowledgeContextResult = await this.retrieveRelevantKnowledge(validatedMessage, JSON.stringify({
        caseData: enhancedCaseData,
        userContext: validatedContext,
        conversationHistory: memory.conversationHistory
      }), validatedContext);

      // Extract KB entry titles for post-processing detection
      const kbTitles = knowledgeContextResult ?
        knowledgeContextResult.split('\n').filter(line => line.startsWith('**')).map(line => line.replace(/\*\*/g, '').trim()).join(' ')
        : '';
      const knowledgeContext = knowledgeContextResult;

      // Select few-shot examples based on intent and language
      const fewShotService = getFewShotLearningService();
      await fewShotService.initialize(); // Initialize if not already done

      const fewShotExamples = fewShotService.selectExamples({
        intent: intentAnalysis.intent as any,
        language: validatedContext.language,
        hasAmount: hasAmount(validatedMessage) || hasAmountInHistory(memory),
        maxExamples: 3, // Keep token usage reasonable - 3 high-quality examples
      });

      const fewShotPrompt = fewShotService.formatExamplesForPrompt(fewShotExamples);

      console.log(`[CaseAgent] 📚 Few-shot learning: Selected ${fewShotExamples.length} examples for intent=${intentAnalysis.intent}, language=${validatedContext.language}`);

      // Build comprehensive context with few-shot examples
      const enhancedMessage = this.buildEnhancedContext(
        validatedMessage,
        enhancedCaseData,
        validatedContext,
        memory,
        userProfile,
        intentAnalysis,
        emotionalState,
        conversationContext,
        knowledgeContext,
        fewShotPrompt
      );

      // Process with enhanced context and knowledge
      const result = await this.processMessageWithKnowledge(enhancedMessage, validatedContext, conversationContext, knowledgeContext);

      // Post-process response to enforce KB rules (remove bullets, enforce help-seeking rules, etc.)
      if (result.message && result.success) {
        // Check if user has already selected a donation amount
        const currentMessageHasAmount = hasAmount(validatedMessage);
        const hasSelectedAmount = currentMessageHasAmount || hasAmountInHistory(memory);
        // Determine if banking alias or TRF alias will be shown (for Totitos question timing)
        const isAskingForAlternatives = /\b(otras?\s+formas?|other\s+ways?|alternativas?|alternative|múltiples?\s+casos?|multiple\s+cases?|más\s+urgentes?|most\s+urgent|donar\s+a\s+toto|donate\s+to\s+toto)\b/i.test(validatedMessage);
        const willShowBankingAlias = intentAnalysis.intent === 'donate' &&
                                    !!enhancedCaseData.guardianBankingAlias &&
                                    hasSelectedAmount &&
                                    !isAskingForAlternatives;
        const willShowTRFAlias = intentAnalysis.intent === 'donate' &&
                                hasSelectedAmount &&
                                (!enhancedCaseData.guardianBankingAlias || isAskingForAlternatives);
        const willShowAnyAlias = willShowBankingAlias || willShowTRFAlias;
        result.message = this.postProcessResponse(result.message, intentAnalysis.intent, knowledgeContext, kbTitles, hasSelectedAmount, willShowAnyAlias);
      }

      const processingTime = Date.now() - startTime;

      // Update conversation memory
      this.updateConversationMemory(memory, validatedMessage, result.message, intentAnalysis);

      // Update user profile
      this.updateUserProfile(userProfile, validatedCaseData.id, intentAnalysis);

      // Extract intelligent actions
      const actions = await this.extractIntelligentActions(result.message || '', intentAnalysis, enhancedCaseData);

      // Generate contextual suggestions
      const suggestions = this.generateContextualSuggestions(enhancedCaseData, context, userProfile, intentAnalysis);

      // Update analytics
      this.updateAnalytics(processingTime, result.success, actions);

      // Generate formatting hints for better UI rendering
      const formattingHints = generateFormattingHints(result.message || '');
      
      // Determine quick action triggers explicitly
      // Check if user has already selected a donation amount (from conversation history or current message)
      const currentMessageHasAmountCheck = hasAmount(validatedMessage);
      const hasSelectedAmountCheck = currentMessageHasAmountCheck || hasAmountInHistory(memory);

      // CORRECTED LOGIC: Show amount buttons when donation intent WITHOUT amount
      // Show banking alias when donation intent WITH amount
      const shouldShowAmountButtons = intentAnalysis.intent === 'donate' && !hasSelectedAmountCheck;

      // Check if user is asking for alternative donation methods
      const isAskingForAlternativesCheck = /\b(otras?\s+formas?|other\s+ways?|alternativas?|alternative|múltiples?\s+casos?|multiple\s+cases?|más\s+urgentes?|most\s+urgent|donar\s+a\s+toto|donate\s+to\s+toto)\b/i.test(validatedMessage);
      
      // Show guardian alias if available and amount selected, OR show TRF alias if:
      // 1. Guardian alias is missing, OR
      // 2. User explicitly asks for alternatives
      const shouldShowBankingAlias = intentAnalysis.intent === 'donate' &&
                                    !!enhancedCaseData.guardianBankingAlias &&
                                    hasSelectedAmountCheck &&
                                    !isAskingForAlternativesCheck; // Don't show guardian alias if user wants alternatives

      // Show TRF alias when:
      // 1. Guardian alias is missing AND amount selected, OR
      // 2. User asks for alternatives AND amount selected
      const shouldShowTRFAlias = intentAnalysis.intent === 'donate' &&
                                 hasSelectedAmountCheck &&
                                 (!enhancedCaseData.guardianBankingAlias || isAskingForAlternativesCheck);
      
      const shouldShowSocialMedia = intentAnalysis.intent === 'share';

      // For help-seeking intent, show generic donate and share buttons (not platform-specific)
      const shouldShowHelpActions = intentAnalysis.intent === 'help';

      // Check if user is asking about foster care or adoption
      const isFosterCareOrAdoptionQuestion = this.isFosterCareOrAdoptionQuestion(validatedMessage);
      const shouldShowGuardianContact = isFosterCareOrAdoptionQuestion && !!enhancedCaseData.guardianId;

      // Fetch guardian contact info if needed for foster care/adoption questions
      let guardianContactInfo: { email?: string; phone?: string; whatsapp?: string } = {};
      if (shouldShowGuardianContact && enhancedCaseData.guardianId) {
        guardianContactInfo = await this.fetchGuardianContactInfo(enhancedCaseData.guardianId);
      }

      // Build social media URLs ONLY for explicit share intent (not for help-seeking)
      let socialUrls: any = {};
      if (shouldShowSocialMedia) {
        if (enhancedCaseData.guardianInstagram) {
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
      }
      
      // Build guardian contact URLs for quick actions
      // All URL formatting is centralized here - clients just open these URLs
      let guardianContactUrls: any = {};
      if (shouldShowGuardianContact) {
        // Email: ensure mailto: prefix
        if (guardianContactInfo.email) {
          const email = guardianContactInfo.email.trim();
          if (email && email.includes('@')) {
            guardianContactUrls.email = email.startsWith('mailto:') ? email : `mailto:${email}`;
          }
        }
        
        // Phone: ensure tel: prefix and clean number
        if (guardianContactInfo.phone) {
          const phone = guardianContactInfo.phone.trim();
          if (phone) {
            // Remove tel: if already present, then clean and re-add
            const cleanPhone = phone.replace(/^tel:/, '').replace(/[^\d+]/g, '');
            if (cleanPhone) {
              guardianContactUrls.phone = `tel:${cleanPhone}`;
            }
          }
        }
        
        // WhatsApp: format as https://wa.me/ (remove + prefix for wa.me)
        if (guardianContactInfo.whatsapp) {
          const whatsapp = guardianContactInfo.whatsapp.trim();
          if (whatsapp) {
            // If already a wa.me URL, use as-is
            if (whatsapp.startsWith('https://wa.me/') || whatsapp.startsWith('http://wa.me/')) {
              guardianContactUrls.whatsapp = whatsapp.replace('http://', 'https://');
            } else {
              // Clean phone number: remove +, spaces, dashes, parentheses
              const cleanNumber = whatsapp.replace(/[+\s\-()]/g, '');
              if (cleanNumber) {
                guardianContactUrls.whatsapp = `https://wa.me/${cleanNumber}`;
              }
            }
          }
        }
        
        // Instagram: ensure proper URL format
        if (enhancedCaseData.guardianInstagram) {
          const instagram = enhancedCaseData.guardianInstagram.trim();
          if (instagram) {
            if (instagram.startsWith('http://') || instagram.startsWith('https://')) {
              guardianContactUrls.instagram = instagram.replace('http://', 'https://');
            } else {
              // Remove @ and format as URL
              const username = instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '');
              if (username) {
                guardianContactUrls.instagram = `https://instagram.com/${username}`;
              }
            }
          }
        }
        
        // Twitter: ensure proper URL format
        if (enhancedCaseData.guardianTwitter) {
          const twitter = enhancedCaseData.guardianTwitter.trim();
          if (twitter) {
            if (twitter.startsWith('http://') || twitter.startsWith('https://')) {
              // Normalize to twitter.com (not x.com) for consistency
              guardianContactUrls.twitter = twitter.replace('http://', 'https://').replace('x.com', 'twitter.com');
            } else {
              // Remove @ and format as URL
              const username = twitter.replace(/^@/, '').replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//, '');
              if (username) {
                guardianContactUrls.twitter = `https://twitter.com/${username}`;
              }
            }
          }
        }
        
        // Facebook: ensure proper URL format
        if (enhancedCaseData.guardianFacebook) {
          const facebook = enhancedCaseData.guardianFacebook.trim();
          if (facebook) {
            if (facebook.startsWith('http://') || facebook.startsWith('https://')) {
              guardianContactUrls.facebook = facebook.replace('http://', 'https://');
            } else {
              // Remove facebook.com if present, then format
              const username = facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//, '');
              if (username) {
                guardianContactUrls.facebook = `https://facebook.com/${username}`;
              }
            }
          }
        }
      }
      
      // Determine what quick actions are actually being shown (for tracking)
      const shownActions: string[] = [];
      if (shouldShowBankingAlias && enhancedCaseData.guardianBankingAlias) {
        shownActions.push('banking_alias');
      }
      if ((shouldShowSocialMedia || shouldShowHelpActions) && Object.keys(socialUrls).length > 0) {
        const socialPlatforms = Object.keys(socialUrls).filter(key => socialUrls[key]);
        if (socialPlatforms.length > 0) {
          shownActions.push(`social_media: ${socialPlatforms.join(', ')}`);
        }
      }
      if (shouldShowGuardianContact && Object.keys(guardianContactUrls).length > 0) {
        const contactChannels = Object.keys(guardianContactUrls).filter(key => guardianContactUrls[key]);
        if (contactChannels.length > 0) {
          shownActions.push(`guardian_contact: ${contactChannels.join(', ')}`);
        }
      }
      if (shouldShowAmountButtons) {
        const suggestedAmounts = [500, 1000, 2500, 5000];
        const amounts = suggestedAmounts.map((a: number) => `$${a.toLocaleString('es-AR')}`).join(', ');
        shownActions.push(`donation_amounts: ${amounts}`);
      }
      if (shouldShowHelpActions) {
        shownActions.push(`help_actions: Donate, Share`);
      }
      
      // Enhanced metadata with explicit quick action triggers
      const metadata: any = {
        agentType: this.config.name,
        confidence: this.calculateConfidence(intentAnalysis, emotionalState),
        processingTime,
        sessionId,
        intent: intentAnalysis.intent,
        emotionalState,
        userEngagement: userProfile.engagementLevel,
        formattingHints, // Include formatting hints for UI rendering
        
        // Explicit quick action triggers
        quickActions: {
          showBankingAlias: shouldShowBankingAlias,
          showTRFAlias: shouldShowTRFAlias, // TRF alias for alternative donations
          showSocialMedia: shouldShowSocialMedia && Object.keys(socialUrls).length > 0, // Only for share intent
          showAdoptionInfo: intentAnalysis.intent === 'adopt',
          showGuardianContact: shouldShowGuardianContact && Object.keys(guardianContactUrls).length > 0,
          // Show donation amounts when user expresses donation intent WITHOUT amount
          showDonationIntent: shouldShowAmountButtons,
          suggestedDonationAmounts: shouldShowAmountButtons ? [500, 1000, 2500, 5000] : undefined, // Suggested amounts in ARS
          // For help-seeking, show generic action buttons (donate/share text buttons)
          showHelpActions: shouldShowHelpActions,
          actionTriggers: intentAnalysis.intent ? [intentAnalysis.intent] : []
        },
        
        // Centralized tracking: what quick actions are being shown (for troubleshooting)
        quickActionsShown: shownActions.length > 0 ? {
          actions: shownActions,
          message: `Quick actions shown: ${shownActions.join('; ')}`
        } : undefined,
        
        // Conversation flow hints
        flowHints: {
          shouldSaveConversation: true, // Always save after AI response
          shouldShowTyping: true, // Always show typing animation
          isFirstMessage: memory.conversationHistory.length === 0,
          conversationStage: memory.conversationHistory.length === 0 ? 'introduction' : 
                            intentAnalysis.intent === 'donate' ? 'donation_flow' :
                            intentAnalysis.intent === 'share' ? 'sharing_flow' :
                            intentAnalysis.intent === 'adopt' ? 'adoption_flow' : 'general'
        }
      };
      
      // Include banking alias if trigger is true (for backward compatibility and quick access)
      if (shouldShowBankingAlias) {
        metadata.guardianBankingAlias = enhancedCaseData.guardianBankingAlias;
      }
      
      // Include TRF alias if trigger is true (for alternative donations)
      if (shouldShowTRFAlias) {
        metadata.trfBankingAlias = getTRFAlias();
      }
      
      // Include social media URLs ONLY for share intent (not for help-seeking)
      if (shouldShowSocialMedia && Object.keys(socialUrls).length > 0) {
          metadata.socialMediaUrls = socialUrls;
        }
      
      // Include guardian contact info if trigger is true (for foster care/adoption questions)
      if (shouldShowGuardianContact && Object.keys(guardianContactUrls).length > 0) {
        metadata.guardianContactInfo = guardianContactUrls;
      }
      
      // Include action configuration hints for toto-app
      // This centralizes action message templates and share message formatting
      metadata.actionConfig = {
        shareMessageTemplate: getShareMessageConfig().template,
        actionTemplates: {
          copy_alias: getActionMessageTemplate('copy_alias', 'banking_alias'),
          share: getActionMessageTemplate('share', 'social_media', { platform: 'social' }),
          contact: getActionMessageTemplate('contact', 'guardian'),
        },
      };

      // Build response and normalize structure
      const response = {
        success: result.success,
        message: result.message,
        caseData: enhancedCaseData,
        actions,
        suggestions,
        metadata,
        error: result.error,
      };

      // Normalize response to ensure consistent structure
      metrics.recordCounter('inquiry_success', MetricCategory.QUALITY);
      stopTimer();
      return normalizeCaseResponse(response);

    } catch (error) {
      // Handle and transform error
      const appError = handleError(error, {
        operation: 'CaseAgent.processCaseInquiry',
        caseId: validatedCaseData.id,
        userId: validatedContext.userId,
        messageLength: validatedMessage.length,
      });

      console.error('[CaseAgent] ❌ Processing failed:', appError.toJSON());

      metrics.recordCounter('inquiry_error', MetricCategory.ERROR);
      metrics.recordError(appError.category, appError.message, {
        caseId: validatedCaseData.id,
        userId: validatedContext.userId,
      });
      stopTimer();

      const processingTime = Date.now() - startTime;
      this.analytics.successfulInteractions--; // Decrement on error
      
      // Return user-friendly error message
      const userLanguage = validatedContext.language || 'es';
      const userMessage = appError.getUserMessage(userLanguage);
      
      return normalizeCaseResponse({
        success: false,
        message: userMessage,
        caseData: validatedCaseData,
        error: appError.message,
        category: appError.category,
        isRetryable: appError.isRetryable,
        metadata: {
          agentType: this.config.name,
          confidence: 0,
          processingTime,
          sessionId,
          quickActions: {
            showBankingAlias: false,
            showSocialMedia: false,
            showAdoptionInfo: false,
            actionTriggers: []
          },
          flowHints: {
            shouldSaveConversation: false,
            shouldShowTyping: false,
            isFirstMessage: false,
            conversationStage: 'error'
          }
        },
      });
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
      const db = getFirestore(); // Uses singleton connection pool
      
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

  /**
   * Fetch guardian contact information from Firestore
   */
  private async fetchGuardianContactInfo(guardianId: string): Promise<{
    email?: string;
    phone?: string;
    whatsapp?: string;
  }> {
    if (!guardianId || guardianId === 'unknown') {
      return {};
    }

    try {
      const db = getFirestore(); // Uses singleton connection pool
      
      const guardianDoc = await db.collection('users').doc(guardianId).get();
      
      if (guardianDoc.exists) {
        const guardianData = guardianDoc.data();
        return {
          email: guardianData?.email,
          phone: guardianData?.phone || guardianData?.contactInfo?.phone,
          whatsapp: guardianData?.contactInfo?.whatsapp || guardianData?.phone, // Use phone as WhatsApp if no specific WhatsApp field
        };
      }
      
      return {};
    } catch (error) {
      console.warn(`Could not fetch guardian contact info for guardian ${guardianId}:`, error);
      return {};
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

  /**
   * Check if message is asking about foster care or adoption
   */
  private isFosterCareOrAdoptionQuestion(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    const fosterCareKeywords = ['tránsito', 'transito', 'foster', 'hogar temporal', 'hogar de tránsito'];
    const adoptionKeywords = ['adoptar', 'adopt', 'adopción', 'adoption', 'hogar permanente'];
    
    return fosterCareKeywords.some(keyword => lowerMessage.includes(keyword)) ||
           adoptionKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  // ===== INTENT ANALYSIS =====

  private async analyzeUserIntent(message: string, memory: ConversationMemory, userProfile: UserProfile): Promise<IntentAnalysis> {
    // Normalize message for cache key (trim, lowercase)
    const cacheKey = message.trim().toLowerCase();

    const metrics = getMetricsService();

    // Check cache first
    if (CACHE_CONSTANTS.ENABLE_CACHING) {
      const cached = this.intentCache.get(cacheKey);
      if (cached) {
        metrics.recordCounter('cache_hit', MetricCategory.CACHE, 1, { cache: 'intent' });
        console.log('[CaseAgent] 🎯 Cache hit for intent detection:', cached.intent);
        return cached;
      } else {
        metrics.recordCounter('cache_miss', MetricCategory.CACHE, 1, { cache: 'intent' });
      }
    }

    const lowerMessage = message.toLowerCase().trim();

    // Language-agnostic affirmative detection - normalize to English first
    const normalizedMessage = await this.normalizeMessageForIntentDetection(lowerMessage);
    const affirmativePatterns = ['yes', 'ok', 'okay', 'of course', 'sure', 'absolutely', 'definitely'];
    const isAffirmative = affirmativePatterns.some(pattern =>
      normalizedMessage === pattern || normalizedMessage === `${pattern}.` || normalizedMessage === `${pattern}!`
    );

    // If it's an affirmative response and we have conversation history, maintain context
    if (isAffirmative && memory.conversationHistory.length > 0) {
      // Check recent conversation history to determine what user is agreeing to
      const lastUserMessage = memory.conversationHistory
        .filter(msg => msg.role === 'user')
        .slice(-2)[0]; // Get second-to-last user message (before "Si")

      const lastAssistantMessage = memory.conversationHistory
        .filter(msg => msg.role === 'assistant')
        .slice(-1)[0]?.message?.toLowerCase() || '';

      // CRITICAL: Maintain donation flow context
      // Use semantic detection instead of language-specific keywords
      // Normalize once and reuse for all checks
      const normalizedLastAssistant = await this.normalizeMessageForIntentDetection(lastAssistantMessage.toLowerCase());
      
      if (lastUserMessage?.intent === 'donate' ||
          normalizedLastAssistant.includes('donate') ||
          normalizedLastAssistant.includes('donation') ||
          normalizedLastAssistant.includes('how much') ||
          normalizedLastAssistant.includes('amount') ||
          normalizedLastAssistant.includes('alias') ||
          normalizedLastAssistant.includes('transfer')) {
        return {
          intent: 'donate',
          confidence: 0.95,
          suggestedActions: ['donate'],
          emotionalTone: 'neutral',
          urgency: 'medium'
        };
      }

      // If asking about sharing, maintain share intent
      if (normalizedLastAssistant.includes('share')) {
        return {
          intent: 'share',
          confidence: 0.95,
          suggestedActions: ['share'],
          emotionalTone: 'neutral',
          urgency: 'medium'
        };
      }

      // If asking about adoption, maintain adopt intent
      if (normalizedLastAssistant.includes('adopt')) {
        return {
          intent: 'adopt',
          confidence: 0.95,
          suggestedActions: ['adopt', 'contact'],
          emotionalTone: 'neutral',
          urgency: 'medium'
        };
      }

      // Default: If just introduced the case, user wants to help
      // Use semantic detection instead of language-specific keywords
      if (normalizedLastAssistant.includes('case') || normalizedLastAssistant.includes('help') || 
          normalizedLastAssistant.includes('introduce') || normalizedLastAssistant.includes('present')) {
        return {
          intent: 'help',
          confidence: 0.9,
          suggestedActions: ['donate', 'share', 'learn'],
          emotionalTone: 'neutral',
          urgency: 'medium'
        };
      }
    }
    
    // Multilingual intent detection using semantic embeddings
    // This approach works for any language supported by Vertex AI text-embedding-004 (100+ languages)
    // No translation needed - embeddings capture semantic meaning across languages
    
    try {
      const semanticIntent = await this.detectIntentUsingEmbeddings(message);
      if (semanticIntent) {
        return {
          intent: semanticIntent.intent,
          confidence: semanticIntent.confidence,
          suggestedActions: this.getSuggestedActionsForIntent(semanticIntent.intent),
          emotionalTone: this.detectEmotionalTone(message),
          urgency: this.detectUrgency(message)
        };
      }
    } catch (error) {
      console.warn('[CaseAgent] Semantic intent detection failed, falling back to keyword matching:', error);
    }

    // Fallback: Keyword-based intent detection (works but less robust)
    // Use English-only keywords for intent detection (language-agnostic)
    const intents = {
      donate: ['donate', 'donation', 'help financially', 'give money', 'contribute', 'payment'],
      adopt: ['adopt', 'take home', 'forever home', 'take care', 'foster'],
      share: ['share', 'tell others', 'spread the word', 'post', 'social media'],
      contact: ['contact', 'get in touch', 'talk to', 'reach out', 'message'],
      learn: ['learn', 'know more', 'information', 'details', 'tell me about'],
      help: ['help', 'assist', 'support', 'what can i do', 'how can i help'],
      urgent: ['urgent', 'emergency', 'asap', 'immediately', 'right now']
    };

    const detectedIntent = Object.keys(intents).find(intent => 
      intents[intent as keyof typeof intents].some(pattern => normalizedMessage.includes(pattern))
    ) || (isAffirmative ? 'help' : 'general');

    const confidence = this.calculateIntentConfidence(message, detectedIntent);
    const suggestedActions = this.getSuggestedActionsForIntent(detectedIntent);

    const result: IntentAnalysis = {
      intent: detectedIntent,
      confidence,
      suggestedActions,
      emotionalTone: this.detectEmotionalTone(message),
      urgency: this.detectUrgency(message)
    };

    // Cache result
    if (CACHE_CONSTANTS.ENABLE_CACHING) {
      this.intentCache.set(cacheKey, result);
    }

    return result;
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
    conversationContext?: ConversationContext,
    knowledgeContext?: string,
    fewShotExamples?: string
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

    return `${this.getSystemPrompt(knowledgeContext, fewShotExamples)}

${caseContext}

${userContext}

${conversationHistory}

${intentContext}

${progressionContext}

Current user message: ${message}

Remember: Be conversational, empathetic, and contextually aware. Use the conversation history and user profile to provide personalized responses. ${isAffirmativeAfterIntro ? 'PROGRESS THE CONVERSATION - do not repeat what you already said.' : ''}`;
  }

  // ===== INTELLIGENT ACTION EXTRACTION =====

  private async extractIntelligentActions(response: string, intentAnalysis: any, enhancedCaseData: EnhancedCaseData): Promise<AgentAction[]> {
    const actions: AgentAction[] = [];
    const lowerResponse = response.toLowerCase();

    // Language-agnostic action extraction - normalize response to English first
    const normalizedResponse = await this.normalizeMessageForIntentDetection(lowerResponse);
    const actionPatterns = {
      donate: {
        patterns: ['donate', 'donation', 'help financially', 'give money', 'contribute'],
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
        patterns: ['share', 'tell others', 'spread the word', 'post', 'social media'],
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
        patterns: ['adopt', 'take home', 'forever home', 'take care', 'foster'],
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
        patterns: ['contact', 'get in touch', 'reach out', 'talk to', 'message'],
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
      const hasPattern = config.patterns.some(pattern => normalizedResponse.includes(pattern));
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

  /**
   * Detect intent using semantic embeddings (multilingual)
   * Uses Vertex AI text-embedding-004 which supports 100+ languages natively
   * No translation needed - embeddings capture semantic meaning across languages
   */
  private async detectIntentUsingEmbeddings(message: string): Promise<{ intent: string; confidence: number } | null> {
    if (!this.ragService) {
      return null; // No RAG service available, fallback to keywords
    }

    try {
      // Intent examples in multiple languages (add more languages as needed)
      const INTENT_EXAMPLES: Record<string, string[]> = {
        donate: [
          'I want to donate',
          'Quiero donar',
          'Me gustaría donar',
          'How can I donate?',
          'Cómo puedo donar?',
          'I want to help financially',
          'Quiero ayudar económicamente',
          'I want to contribute',
          'Quiero contribuir',
          'I want to give money',
          'Quiero dar dinero'
        ],
        share: [
          'I want to share',
          'Quiero compartir',
          'How can I share?',
          'Cómo puedo compartir?',
          'Share on social media',
          'Compartir en redes sociales',
          'I want to tell others',
          'Quiero contar a otros',
          'Spread the word',
          'Difundir'
        ],
        adopt: [
          'I want to adopt',
          'Quiero adoptar',
          'How can I adopt?',
          'Cómo puedo adoptar?',
          'I want to take home',
          'Quiero llevarlo a casa',
          'Forever home',
          'Hogar permanente'
        ],
        contact: [
          'I want to contact',
          'Quiero contactar',
          'Get in touch',
          'Ponerse en contacto',
          'Talk to guardian',
          'Hablar con el guardián'
        ],
        learn: [
          'I want to learn more',
          'Quiero saber más',
          'Tell me more',
          'Cuéntame más',
          'More information',
          'Más información'
        ],
        help: [
          'How can I help?',
          'Cómo puedo ayudar?',
          'I want to help',
          'Quiero ayudar',
          'What can I do?',
          'Qué puedo hacer?'
        ]
      };

      // Initialize intent embeddings cache if empty
      if (this.intentEmbeddingsCache.size === 0) {
        await this.initializeIntentEmbeddings(INTENT_EXAMPLES);
      }

      // Generate embedding for user message
      const messageEmbedding = await this.ragService.generateEmbedding(message);

      // Find best matching intent using cosine similarity
      let bestMatch: { intent: string; similarity: number } | null = null;
      const SIMILARITY_THRESHOLD = CASE_AGENT_CONSTANTS.INTENT_SIMILARITY_THRESHOLD;

      for (const [intent, examples] of Object.entries(INTENT_EXAMPLES)) {
        const intentEmbeddings = this.intentEmbeddingsCache.get(intent);
        if (!intentEmbeddings) continue;

        // Calculate average similarity across all examples for this intent
        let totalSimilarity = 0;
        let count = 0;
        for (const exampleEmbedding of intentEmbeddings) {
          const similarity = this.cosineSimilarity(messageEmbedding, exampleEmbedding);
          totalSimilarity += similarity;
          count++;
        }
        const avgSimilarity = count > 0 ? totalSimilarity / count : 0;

        if (avgSimilarity >= SIMILARITY_THRESHOLD && (!bestMatch || avgSimilarity > bestMatch.similarity)) {
          bestMatch = { intent, similarity: avgSimilarity };
        }
      }

      if (bestMatch) {
        return {
          intent: bestMatch.intent,
          confidence: Math.min(bestMatch.similarity, 0.95) // Cap confidence at 0.95
        };
      }

      return null; // No match found, fallback to keyword matching
    } catch (error) {
      console.warn('[CaseAgent] Error in semantic intent detection:', error);
      return null; // Fallback to keyword matching
    }
  }

  /**
   * Initialize intent embeddings cache
   * Pre-computes embeddings for all intent examples (cached for performance)
   */
  private async initializeIntentEmbeddings(intentExamples: Record<string, string[]>): Promise<void> {
    if (!this.ragService) {
      console.warn('[CaseAgent] Cannot initialize intent embeddings: RAG service not available');
      return;
    }

    console.log('[CaseAgent] Initializing multilingual intent embeddings...');
    for (const [intent, examples] of Object.entries(intentExamples)) {
      const embeddings: number[][] = [];
      for (const example of examples) {
        try {
          const embedding = await this.ragService.generateEmbedding(example);
          embeddings.push(embedding);
        } catch (error) {
          console.warn(`[CaseAgent] Failed to generate embedding for intent "${intent}" example "${example}":`, error);
        }
      }
      if (embeddings.length > 0) {
        this.intentEmbeddingsCache.set(intent, embeddings);
        console.log(`[CaseAgent] Cached ${embeddings.length} embeddings for intent "${intent}"`);
      }
    }
    console.log(`[CaseAgent] ✅ Initialized intent embeddings for ${this.intentEmbeddingsCache.size} intents`);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Normalize message to English for keyword-based fallback intent detection
   * @deprecated Use detectIntentUsingEmbeddings instead (multilingual, no translation needed)
   */
  private async normalizeMessageForIntentDetection(message: string): Promise<string> {
    try {
      // Simple heuristic: if message contains mostly English characters, return as-is
      const isEnglish = /^[a-zA-Z0-9\s.,!?'"\-:;()]+$/.test(message.trim());
      if (isEnglish) {
        return message.toLowerCase();
      }

      // For non-English, translate to English using Gemini (fallback only)
      // Cache translations to avoid repeated API calls
      const cacheKey = `intent_translation_${message}`;
      if (this.translationCache.has(cacheKey)) {
        return this.translationCache.get(cacheKey)!;
      }

      const translatePrompt = `Translate the following text to English. Return ONLY the English translation, no explanations.

Text: "${message}"

English translation:`;

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: translatePrompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 256,
        },
      });

      const englishText = result.response.text().trim().toLowerCase();
      // Remove quotes if present
      const cleanText = englishText.replace(/^["']|["']$/g, '');

      // Cache the translation
      this.translationCache.set(cacheKey, cleanText);

      return cleanText;
    } catch (error) {
      console.warn('[CaseAgent] Translation failed for intent detection, using original message:', error);
      // Fallback: return original message (may have false negatives but won't break)
      return message.toLowerCase();
    }
  }


  private calculateIntentConfidence(message: string, intent: string): number {
    // Language-agnostic confidence calculation
    // Message should already be normalized to English via normalizeMessageForIntentDetection
    const intentKeywords = {
      donate: ['donate', 'donation', 'help financially', 'give money'],
      adopt: ['adopt', 'take home', 'forever home'],
      share: ['share', 'tell others', 'spread the word'],
      contact: ['contact', 'get in touch', 'reach out'],
      learn: ['learn', 'know more', 'information']
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
      .slice(-CASE_AGENT_CONSTANTS.MAX_CONVERSATION_HISTORY_ITEMS)
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
    // CRITICAL: Do NOT include social media handles or banking aliases in case context
    // These are provided via quick action buttons only, not in LLM text responses
    // Including them in context causes the LLM to include them in responses, violating safety rules
    return `\nCase Information:
- Name: ${enhancedCaseData.name} (${enhancedCaseData.id})
- Status: ${enhancedCaseData.status}
- Animal Type: ${enhancedCaseData.animalType}
- Location: ${enhancedCaseData.location}
- Guardian: ${enhancedCaseData.guardianName}
- Description: ${enhancedCaseData.description}
- Urgency Level: ${enhancedCaseData.urgencyLevel}
- Funding Progress: ${enhancedCaseData.fundingProgress ? `${enhancedCaseData.fundingProgress.percentage.toFixed(1)}%` : 'N/A'}
${enhancedCaseData.adoptionStatus ? `- Adoption Status: ${enhancedCaseData.adoptionStatus}` : ''}
${enhancedCaseData.guardianBankingAlias ? `- Banking Alias: Available (provided via quick actions only)` : ''}
${enhancedCaseData.guardianTwitter || enhancedCaseData.guardianInstagram || enhancedCaseData.guardianFacebook ? `- Social Media: Available (provided via quick actions only)` : ''}`;
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

  /**
   * Post-process response to enforce KB rules
   * - Remove bullet points and markdown formatting
   * - Enforce help-seeking response rules (2 sentences, no adoption/guardian contact)
   * - Convert lists to plain sentences
   */
  private postProcessResponse(response: string, intent: string, knowledgeContext?: string, kbTitles?: string, hasSelectedAmount?: boolean, willShowBankingAlias?: boolean): string {
    let cleaned = response;

    // Remove ALL markdown formatting
    // Remove bold/italic markers (**text**, *text*, __text__, _text_)
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1'); // **bold** -> bold
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1'); // *italic* -> italic
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1'); // __bold__ -> bold
    cleaned = cleaned.replace(/_([^_]+)_/g, '$1'); // _italic_ -> italic

    // Remove bullet points and markdown lists
    // Replace "* " or "- " at start of lines with nothing
    cleaned = cleaned.replace(/^[\s]*[\*\-]\s+/gm, '');
    // Remove any remaining markdown list markers
    cleaned = cleaned.replace(/^\d+\.\s+/gm, '');

    // For help-seeking intent, enforce strict rules
    // Check if intent is help OR if knowledgeContext/kbTitles mentions help-seeking
    const helpSeekingInContext = knowledgeContext?.toLowerCase().includes('help-seeking') || 
                                  kbTitles?.toLowerCase().includes('help-seeking') ||
                                  knowledgeContext?.toLowerCase().includes('help-seeking intent') ||
                                  kbTitles?.toLowerCase().includes('help-seeking intent') ||
                                  knowledgeContext?.toLowerCase().includes('ways to help') ||
                                  kbTitles?.toLowerCase().includes('ways to help');
    const isHelpSeeking = intent === 'help' || helpSeekingInContext;
    
    if (isHelpSeeking) {
      // Split into sentences (handle Spanish and English punctuation)
      const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      // Remove sentences that:
      // 1. Repeat case information (name, location, medical condition, description)
      // 2. Mention adoption, guardian contact, foster care
      // 3. Include greetings
      const filteredSentences = sentences.filter(s => {
        const lower = s.toLowerCase().trim();
        
        // Remove sentences that repeat case information
        const repeatsCaseInfo = 
          /es un (perro|perrita|gato|gatito|animal)/i.test(s) ||
          /(necesita|requiere|sufrió|tiene) (ayuda|cirugía|tratamiento|fractura|condición)/i.test(s) ||
          /(en|de) (córdoba|rosario|argentina|buenos aires)/i.test(s) ||
          /(joven|mayor|adulto|joven) (perro|perrita|gato|gatito)/i.test(s) ||
          lower.includes('es un perro') ||
          lower.includes('es una perrita') ||
          lower.includes('es un gato') ||
          lower.includes('necesita ayuda para') ||
          lower.includes('requiere intervención') ||
          lower.includes('sufrió una fractura') ||
          lower.includes('necesita tratamiento');
        
        // Remove sentences with forbidden content
        const hasForbiddenContent = 
          lower.includes('adopt') || 
          lower.includes('adopción') ||
          lower.includes('guardian') ||
          lower.includes('contactar') ||
          lower.includes('contact') ||
          lower.includes('foster') ||
          lower.includes('hogar temporal') ||
          lower.includes('hogar permanente') ||
          lower.includes('darle un hogar') ||
          lower.includes('dar hogar') ||
          lower.includes('proceso de adopción') ||
          lower.includes('adoption process') ||
          lower.startsWith('¡hola') ||
          lower.startsWith('hola') ||
          lower.startsWith('hello');
        
        return !repeatsCaseInfo && !hasForbiddenContent;
      });

      // Keep only first 2-3 sentences (gratitude + options)
      if (filteredSentences.length > 3) {
        cleaned = filteredSentences.slice(0, 3).join('. ').trim();
        if (!cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
          cleaned += '.';
        }
      } else if (filteredSentences.length > 0) {
        cleaned = filteredSentences.join('. ').trim();
        if (!cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
          cleaned += '.';
        }
      } else {
        // If all sentences were filtered, use a default help-seeking response
        cleaned = '¡Qué bueno que quieras ayudar! Podés donar para los gastos médicos o compartir su historia en redes sociales.';
      }
    }

    // For donation intent WITH amount selected AND alias being shown, ensure Totitos question is asked AFTER alias explanation
    // Totitos question should only appear AFTER alias is explained, not immediately after amount selection
    if (intent === 'donate' && hasSelectedAmount && willShowBankingAlias) {
      const lowerResponse = cleaned.toLowerCase();
      const mentionsAlias = 
        lowerResponse.includes('alias') ||
        lowerResponse.includes('banking alias') ||
        lowerResponse.includes('alias bancario') ||
        lowerResponse.includes('button you\'ll see') ||
        lowerResponse.includes('botón que verás');
      
      const mentionsTotitos = 
        lowerResponse.includes('totitos') ||
        lowerResponse.includes('totito') ||
        lowerResponse.includes('verificar') ||
        lowerResponse.includes('verification') ||
        lowerResponse.includes('verificar tu donación') ||
        lowerResponse.includes('verify your donation');
      
      // Only add Totitos question if alias is mentioned (alias explanation has occurred)
      // AND Totitos question is missing
      if (mentionsAlias && !mentionsTotitos) {
        const isSpanish = /[áéíóúñü]/.test(cleaned) || cleaned.toLowerCase().includes('donación') || cleaned.toLowerCase().includes('donar');
        const totitosQuestion = isSpanish 
          ? '¿Querés verificar tu donación y ganar Totitos?'
          : 'Would you like to verify your donation and earn Totitos?';
        
        // Add question at the end, ensuring proper punctuation
        if (cleaned.trim().endsWith('.')) {
          cleaned = cleaned.trim().slice(0, -1) + '. ' + totitosQuestion;
        } else if (cleaned.trim().endsWith('!')) {
          cleaned = cleaned.trim().slice(0, -1) + '! ' + totitosQuestion;
        } else {
          cleaned = cleaned.trim() + '. ' + totitosQuestion;
        }
      }
    }

    // For donation intent WITHOUT amount selected, remove alias/TRF mentions and ask for amount
    if (intent === 'donate' && !hasSelectedAmount) {
      const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      // Separate sentences that ask for amount from those that mention alias/TRF
      const amountQuestionSentences: string[] = [];
      const validSentences: string[] = [];
      
      sentences.forEach(s => {
        const lower = s.toLowerCase().trim();
        
        // Check if this sentence asks for amount (keep these!)
        const asksForAmount = 
          lower.includes('cuánto') ||
          lower.includes('how much') ||
          lower.includes('qué monto') ||
          lower.includes('what amount') ||
          lower.includes('monto') && (lower.includes('gustaría') || lower.includes('would you'));
        
        // Check if sentence mentions alias or TRF (remove these) - MORE AGGRESSIVE
        const mentionsAliasOrTRF = 
          lower.includes('alias bancario') ||
          lower.includes('alias') || // Remove ALL alias mentions (not just "alias bancario")
          lower.includes('botones de acción rápida') ||
          lower.includes('botón que verás') ||
          lower.includes('botones') && lower.includes('acción rápida') ||
          lower.includes('toto rescue fund') ||
          lower.includes('trf') ||
          lower.includes('fondo de rescate') ||
          lower.includes('banking alias') ||
          lower.includes('quick action buttons') ||
          lower.includes('button you\'ll see') ||
          lower.includes('disponible mediante') ||
          lower.includes('available through') ||
          lower.includes('transferencia') && lower.includes('directa') ||
          lower.includes('direct transfer') ||
          lower.includes('usando este alias') ||
          lower.includes('using this alias') ||
          lower.includes('el alias') ||
          lower.includes('the alias') ||
          lower.includes('puedes usar') && lower.includes('alias') ||
          lower.includes('you can use') && lower.includes('alias');
        
        if (asksForAmount) {
          amountQuestionSentences.push(s);
        } else if (!mentionsAliasOrTRF) {
          validSentences.push(s);
        }
        // Sentences with alias/TRF that don't ask for amount are filtered out
      });
      
      // Build response: valid sentences + amount question (if exists)
      const responseParts: string[] = [];
      
      // Add valid sentences (acknowledgment, no minimum, etc.)
      if (validSentences.length > 0) {
        responseParts.push(validSentences.join('. ').trim());
      }
      
      // Always include amount question (from KB or add if missing)
      if (amountQuestionSentences.length > 0) {
        responseParts.push(amountQuestionSentences.join('. ').trim());
      } else {
        // No amount question found - add it
        const isSpanish = /[áéíóúñü]/.test(cleaned) || cleaned.toLowerCase().includes('donación') || cleaned.toLowerCase().includes('donar');
        if (isSpanish) {
          responseParts.push('¿Cuánto te gustaría donar?');
        } else {
          responseParts.push('How much would you like to donate?');
        }
      }
      
      if (responseParts.length > 0) {
        cleaned = responseParts.join('. ').trim();
        // Ensure it ends with proper punctuation
        if (!cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
          cleaned += '.';
        }
        // Ensure it ends with a question if we added the amount question
        if (amountQuestionSentences.length === 0 && !cleaned.endsWith('?')) {
          cleaned = cleaned.replace(/[.!]$/, '') + '?';
        }
      } else {
        // Fallback: provide a simple response asking for amount
        const isSpanish = /[áéíóúñü]/.test(response) || response.toLowerCase().includes('donación') || response.toLowerCase().includes('donar');
        if (isSpanish) {
          cleaned = '¡Qué bien que quieras ayudar! No hay un monto mínimo, cada ayuda cuenta. ¿Cuánto te gustaría donar?';
        } else {
          cleaned = 'That\'s great that you want to help! There\'s no minimum amount - every donation helps! How much would you like to donate?';
        }
      }
    }

    // Clean up extra whitespace
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();
    cleaned = cleaned.replace(/\s+/g, ' ');

    return cleaned;
  }
}
