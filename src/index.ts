// Main exports for toto-ai

// Agents
export { BaseAgent } from './agents/BaseAgent';
export { CaseAgent } from './agents/CaseAgent';

// Types
export * from './types';

// Services (to be implemented)
// export { OrchestratorService } from './services/OrchestratorService';
// export { FirebaseService } from './services/FirebaseService';

// Import for internal use
import { CaseAgent } from './agents/CaseAgent';
import { AgentConfig } from './types';

// Main class for easy integration
export class TotoAI {
  private caseAgent: CaseAgent;

  constructor() {
    this.caseAgent = new CaseAgent();
  }

  /**
   * Get the case agent
   */
  getCaseAgent(): CaseAgent {
    return this.caseAgent;
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
    ];
  }
}

// Default export
export default TotoAI;
