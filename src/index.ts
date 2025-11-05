// Main exports for toto-ai

// Agents
export { BaseAgent } from './agents/BaseAgent';
export { CaseAgent } from './agents/CaseAgent';
export { TwitterAgent } from './agents/TwitterAgent';
export { InstagramAgent } from './agents/InstagramAgent';

// Types
export * from './types';

// Services
export { RAGService } from './services/RAGService';
export { SocialMediaPostService } from './services/SocialMediaPostService';
export { ImageService } from './services/ImageService';
export { AgentFeedbackService } from './services/AgentFeedbackService';
export { GuardianInsightsService } from './services/GuardianInsightsService';
// export { OrchestratorService } from './services/OrchestratorService';
// export { FirebaseService } from './services/FirebaseService';

// Import for internal use
import { CaseAgent } from './agents/CaseAgent';
import { TwitterAgent } from './agents/TwitterAgent';
import { InstagramAgent } from './agents/InstagramAgent';
import { RAGService } from './services/RAGService';
import { AgentConfig } from './types';

// Main class for easy integration
export class TotoAI {
  private caseAgent: CaseAgent;
  private twitterAgent: TwitterAgent;
  private instagramAgent: InstagramAgent;
  private ragService: RAGService;

  constructor() {
    this.ragService = new RAGService();
    this.caseAgent = new CaseAgent();
    this.twitterAgent = new TwitterAgent();
    this.instagramAgent = new InstagramAgent();
    
    // Set RAG service for agents
    this.caseAgent.setRAGService(this.ragService);
  }

  /**
   * Get the case agent
   */
  getCaseAgent(): CaseAgent {
    return this.caseAgent;
  }

  /**
   * Get the Twitter agent
   */
  getTwitterAgent(): TwitterAgent {
    return this.twitterAgent;
  }

  /**
   * Get the Instagram agent
   */
  getInstagramAgent(): InstagramAgent {
    return this.instagramAgent;
  }

  /**
   * Get the RAG service
   */
  getRAGService(): RAGService {
    return this.ragService;
  }

  /**
   * Process a case-related message
   */
  async processCaseMessage(
    message: string,
    caseData: any,
    userContext: any,
    conversationContext?: any
  ) {
    return await this.caseAgent.processCaseInquiry(
      message,
      caseData,
      userContext,
      conversationContext
    );
  }

  /**
   * Get all available agents
   */
  getAvailableAgents(): AgentConfig[] {
    return [
      this.caseAgent.getAgentInfo(),
      this.twitterAgent.getAgentInfo(),
      this.instagramAgent.getAgentInfo(),
    ];
  }
}

// Default export
export default TotoAI;
