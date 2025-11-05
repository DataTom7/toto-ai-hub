/**
 * Tool definitions for Gemini Function Calling
 * These tools replace manual text parsing with structured, type-safe function calls
 */

import { FunctionDeclarationSchemaType } from "@google/generative-ai";

// ===== CASE AGENT TOOLS =====

/**
 * Tool for donation actions
 */
export const donateTool = {
  name: "donate",
  description: "Call this function when the user wants to make a donation to help a pet rescue case. Use this when the user expresses intent to donate, asks about donation process, or wants to help financially.",
  parameters: {
    type: FunctionDeclarationSchemaType.OBJECT,
    properties: {
      caseId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The ID of the case to donate to",
      },
      urgency: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The urgency level of the case (low, medium, high, critical)",
        enum: ["low", "medium", "high", "critical"],
      },
      amount: {
        type: FunctionDeclarationSchemaType.NUMBER,
        description: "Suggested donation amount based on case needs (optional)",
        nullable: true,
      },
      userMessage: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "Brief context about why user wants to donate (e.g., 'wants to help with medical expenses')",
      },
    },
    required: ["caseId", "urgency", "userMessage"],
  },
};

/**
 * Tool for adoption inquiries
 */
export const adoptPetTool = {
  name: "adoptPet",
  description: "Call this function when the user expresses interest in adopting a pet. Use this when user asks about adoption process, requirements, or wants to take the pet home.",
  parameters: {
    type: FunctionDeclarationSchemaType.OBJECT,
    properties: {
      caseId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The ID of the case/pet to adopt",
      },
      petId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The ID of the pet (if different from caseId)",
      },
      userContext: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "Brief context about user's adoption interest (e.g., 'has experience with dogs', 'first-time adopter')",
      },
    },
    required: ["caseId", "userContext"],
  },
};

/**
 * Tool for sharing cases on social media
 */
export const shareStoryTool = {
  name: "shareStory",
  description: "Call this function when the user wants to share a rescue case on social media. Use this when user wants to spread the word, tell others, or share the story.",
  parameters: {
    type: FunctionDeclarationSchemaType.OBJECT,
    properties: {
      caseId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The ID of the case to share",
      },
      platforms: {
        type: FunctionDeclarationSchemaType.ARRAY,
        description: "Social media platforms user wants to share on",
        items: {
          type: FunctionDeclarationSchemaType.STRING,
          enum: ["twitter", "instagram", "facebook", "whatsapp"],
        },
      },
    },
    required: ["caseId"],
  },
};

/**
 * Tool for contacting guardians
 */
export const requestHelpTool = {
  name: "requestHelp",
  description: "Call this function when the user wants to contact the guardian, get in touch, ask questions, or request more information. Use this for contact/communication requests.",
  parameters: {
    type: FunctionDeclarationSchemaType.OBJECT,
    properties: {
      caseId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The ID of the case",
      },
      guardianId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The ID of the guardian to contact",
      },
      contactReason: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "Why the user wants to contact (e.g., 'questions about medical treatment', 'visit the pet', 'adoption inquiry')",
      },
      preferredMethod: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "Preferred contact method if specified",
        enum: ["phone", "email", "whatsapp", "message"],
        nullable: true,
      },
    },
    required: ["caseId", "guardianId", "contactReason"],
  },
};

/**
 * Tool for learning more about a case
 */
export const learnMoreTool = {
  name: "learnMore",
  description: "Call this function when the user wants more detailed information about a case. Use this when user asks for details, medical history, treatment plan, or wants to know more.",
  parameters: {
    type: FunctionDeclarationSchemaType.OBJECT,
    properties: {
      caseId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The ID of the case",
      },
      topics: {
        type: FunctionDeclarationSchemaType.ARRAY,
        description: "Specific topics user wants to learn about",
        items: {
          type: FunctionDeclarationSchemaType.STRING,
          enum: ["medical", "behavioral", "adoption", "funding", "guardian", "history"],
        },
      },
    },
    required: ["caseId", "topics"],
  },
};

// ===== SOCIAL MEDIA AGENT TOOLS =====

/**
 * Tool for flagging urgent cases from social media
 */
export const flagUrgentCaseTool = {
  name: "flagUrgentCase",
  description: "Call this function when a social media post indicates an urgent or critical pet rescue situation that needs immediate attention.",
  parameters: {
    type: FunctionDeclarationSchemaType.OBJECT,
    properties: {
      postId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The ID of the social media post",
      },
      urgencyLevel: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The level of urgency detected",
        enum: ["high", "critical"],
      },
      reason: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "Explanation of why this is urgent (e.g., 'severe injury', 'emergency surgery needed')",
      },
      suggestedAction: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "Recommended action to take",
        enum: ["create_case", "update_existing_case", "notify_guardian", "escalate"],
      },
    },
    required: ["postId", "urgencyLevel", "reason", "suggestedAction"],
  },
};

/**
 * Tool for updating pet status from social media
 */
export const updatePetStatusTool = {
  name: "updatePetStatus",
  description: "Call this function when a social media post contains an update about a pet's status, condition, or progress.",
  parameters: {
    type: FunctionDeclarationSchemaType.OBJECT,
    properties: {
      postId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The ID of the social media post",
      },
      caseId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The ID of the case (if known)",
        nullable: true,
      },
      petId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The ID of the pet (if known)",
        nullable: true,
      },
      statusType: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "Type of status update",
        enum: ["medical_update", "behavioral_update", "adoption_update", "emergency", "milestone", "general_note"],
      },
      details: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "Summary of the status update",
      },
      confidence: {
        type: FunctionDeclarationSchemaType.NUMBER,
        description: "Confidence level (0-1) that this is a legitimate status update",
      },
    },
    required: ["postId", "statusType", "details", "confidence"],
  },
};

/**
 * Tool for dismissing irrelevant posts
 */
export const dismissPostTool = {
  name: "dismissPost",
  description: "Call this function when a social media post is not related to pet rescue cases or is irrelevant.",
  parameters: {
    type: FunctionDeclarationSchemaType.OBJECT,
    properties: {
      postId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The ID of the social media post",
      },
      reason: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "Why this post is being dismissed",
        enum: ["not_case_related", "spam", "duplicate", "personal_content", "promotional"],
      },
    },
    required: ["postId", "reason"],
  },
};

/**
 * Tool for creating new cases from social media
 */
export const createCaseFromPostTool = {
  name: "createCaseFromPost",
  description: "Call this function when a social media post describes a new pet rescue case that should be created in the system.",
  parameters: {
    type: FunctionDeclarationSchemaType.OBJECT,
    properties: {
      postId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "The ID of the social media post",
      },
      petName: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "Name of the pet (if mentioned)",
        nullable: true,
      },
      animalType: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "Type of animal (dog, cat, etc.)",
      },
      urgency: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "Urgency level",
        enum: ["low", "medium", "high", "critical"],
      },
      summary: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "Brief summary of the case from the post",
      },
      guardianId: {
        type: FunctionDeclarationSchemaType.STRING,
        description: "ID of the guardian posting (if known)",
      },
      confidence: {
        type: FunctionDeclarationSchemaType.NUMBER,
        description: "Confidence level (0-1) that this should be a new case",
      },
    },
    required: ["postId", "animalType", "urgency", "summary", "guardianId", "confidence"],
  },
};

// ===== TOOL COLLECTIONS =====

/**
 * All Case Agent tools for function calling
 */
export const caseAgentTools = [
  donateTool,
  adoptPetTool,
  shareStoryTool,
  requestHelpTool,
  learnMoreTool,
];

/**
 * All Social Media Agent tools for function calling
 */
export const socialMediaAgentTools = [
  flagUrgentCaseTool,
  updatePetStatusTool,
  dismissPostTool,
  createCaseFromPostTool,
];

// ===== TOOL RESULT TYPES =====

/**
 * TypeScript interfaces for tool call results
 */

export interface DonateToolCall {
  name: "donate";
  args: {
    caseId: string;
    urgency: "low" | "medium" | "high" | "critical";
    amount?: number;
    userMessage: string;
  };
}

export interface AdoptPetToolCall {
  name: "adoptPet";
  args: {
    caseId: string;
    petId?: string;
    userContext: string;
  };
}

export interface ShareStoryToolCall {
  name: "shareStory";
  args: {
    caseId: string;
    platforms?: ("twitter" | "instagram" | "facebook" | "whatsapp")[];
  };
}

export interface RequestHelpToolCall {
  name: "requestHelp";
  args: {
    caseId: string;
    guardianId: string;
    contactReason: string;
    preferredMethod?: "phone" | "email" | "whatsapp" | "message";
  };
}

export interface LearnMoreToolCall {
  name: "learnMore";
  args: {
    caseId: string;
    topics: ("medical" | "behavioral" | "adoption" | "funding" | "guardian" | "history")[];
  };
}

export interface FlagUrgentCaseToolCall {
  name: "flagUrgentCase";
  args: {
    postId: string;
    urgencyLevel: "high" | "critical";
    reason: string;
    suggestedAction: "create_case" | "update_existing_case" | "notify_guardian" | "escalate";
  };
}

export interface UpdatePetStatusToolCall {
  name: "updatePetStatus";
  args: {
    postId: string;
    caseId?: string;
    petId?: string;
    statusType: "medical_update" | "behavioral_update" | "adoption_update" | "emergency" | "milestone" | "general_note";
    details: string;
    confidence: number;
  };
}

export interface DismissPostToolCall {
  name: "dismissPost";
  args: {
    postId: string;
    reason: "not_case_related" | "spam" | "duplicate" | "personal_content" | "promotional";
  };
}

export interface CreateCaseFromPostToolCall {
  name: "createCaseFromPost";
  args: {
    postId: string;
    petName?: string;
    animalType: string;
    urgency: "low" | "medium" | "high" | "critical";
    summary: string;
    guardianId: string;
    confidence: number;
  };
}

/**
 * Union type of all possible tool calls
 */
export type ToolCall =
  | DonateToolCall
  | AdoptPetToolCall
  | ShareStoryToolCall
  | RequestHelpToolCall
  | LearnMoreToolCall
  | FlagUrgentCaseToolCall
  | UpdatePetStatusToolCall
  | DismissPostToolCall
  | CreateCaseFromPostToolCall;

/**
 * Helper type guard to check if a tool call is a specific type
 */
export function isToolCall<T extends ToolCall>(
  toolCall: ToolCall,
  name: T["name"]
): toolCall is T {
  return toolCall.name === name;
}
