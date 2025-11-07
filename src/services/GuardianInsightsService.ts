import * as admin from 'firebase-admin';

export interface GuardianInsight {
  guardianId: string;
  extractedAt: Date;
  
  // Payment Methods
  paymentMethods?: {
    bankingAliases?: {
      value: string;
      type: 'mercado_pago' | 'banco_nacion' | 'paypal' | 'other';
      verified: boolean;
      source: string; // post URL or ID
      confidence: number;
      extractedAt: Date;
    }[];
    whatsappNumbers?: {
      value: string;
      verified: boolean;
      source: string;
      confidence: number;
      extractedAt: Date;
    }[];
    phoneNumbers?: {
      value: string;
      verified: boolean;
      source: string;
      confidence: number;
      extractedAt: Date;
    }[];
  };
  
  // Behavioral Insights
  behavioralPatterns?: {
    postingFrequency?: 'daily' | 'weekly' | 'monthly' | 'irregular';
    communicationStyle?: 'formal' | 'casual' | 'emotional' | 'professional';
    commonTopics?: string[];
    engagementLevel?: 'high' | 'medium' | 'low';
    preferredPlatform?: 'twitter' | 'instagram' | 'both';
  };
  
  // Knowledge Base References
  knowledgeBaseEntryIds?: string[];
  
  // Metadata
  lastAnalyzed?: Date;
  totalPostsAnalyzed?: number;
  insightsVersion?: number;
}

/**
 * Service for extracting and managing guardian insights from social media posts
 */
export class GuardianInsightsService {
  private db: admin.firestore.Firestore;
  private readonly COLLECTION = 'guardianInsights';

  constructor() {
    this.db = admin.firestore();
  }

  /**
   * Extract payment methods and contact info from post content
   */
  extractPaymentInfo(postContent: string): {
    bankingAliases: Array<{ value: string; type: string; confidence: number }>;
    whatsappNumbers: Array<{ value: string; confidence: number }>;
    phoneNumbers: Array<{ value: string; confidence: number }>;
  } {
    const bankingAliases: Array<{ value: string; type: string; confidence: number }> = [];
    const whatsappNumbers: Array<{ value: string; confidence: number }> = [];
    const phoneNumbers: Array<{ value: string; confidence: number }> = [];

    const content = postContent.toLowerCase();

    // Extract Mercado Pago aliases
    const mpPatterns = [
      /alias\s*mercado\s*pago[:\s]*([a-z0-9._-]+)/gi,
      /mp[:\s]*([a-z0-9._-]+)/gi,
      /mercado\s*pago[:\s]*([a-z0-9._-]+)/gi,
    ];
    mpPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const alias = match[1]?.trim();
        if (alias && alias.length > 3 && alias.length < 50) {
          bankingAliases.push({
            value: alias,
            type: 'mercado_pago',
            confidence: 0.9
          });
        }
      }
    });

    // Extract Banco Nación aliases
    const bnPatterns = [
      /alias\s*banco\s*nacion[:\s]*([a-z0-9._-]+)/gi,
      /banco\s*nacion[:\s]*([a-z0-9._-]+)/gi,
      /bn[:\s]*([a-z0-9._-]+)/gi,
    ];
    bnPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const alias = match[1]?.trim();
        if (alias && alias.length > 3 && alias.length < 50) {
          bankingAliases.push({
            value: alias,
            type: 'banco_nacion',
            confidence: 0.9
          });
        }
      }
    });

    // Extract PayPal
    const paypalPatterns = [
      /paypal[:\s]*([a-z0-9._@-]+)/gi,
      /paypal[:\s]*([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/gi,
    ];
    paypalPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const value = match[1]?.trim();
        if (value && value.length > 3) {
          bankingAliases.push({
            value: value,
            type: 'paypal',
            confidence: 0.85
          });
        }
      }
    });

    // Extract WhatsApp numbers (various formats)
    const whatsappPatterns = [
      /whatsapp[:\s]*(\+?54\s*9?\s*\d{2}\s*\d{4}\s*\d{4})/gi,
      /wa[:\s]*(\+?54\s*9?\s*\d{2}\s*\d{4}\s*\d{4})/gi,
      /(\+?54\s*9?\s*\d{2}\s*\d{4}\s*\d{4})/g, // Argentine phone pattern
      /(\d{2,4}\s*\d{4}\s*\d{4})/g, // Generic pattern
    ];
    whatsappPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const number = match[1]?.trim().replace(/\s+/g, '');
        if (number && number.length >= 10 && number.length <= 15) {
          whatsappNumbers.push({
            value: number,
            confidence: pattern.source.includes('whatsapp') || pattern.source.includes('wa') ? 0.9 : 0.7
          });
        }
      }
    });

    // Extract phone numbers (without WhatsApp context)
    const phonePatterns = [
      /tel[éfono]?[:\s]*(\+?54\s*9?\s*\d{2}\s*\d{4}\s*\d{4})/gi,
      /contacto[:\s]*(\+?54\s*9?\s*\d{2}\s*\d{4}\s*\d{4})/gi,
    ];
    phonePatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const number = match[1]?.trim().replace(/\s+/g, '');
        if (number && number.length >= 10 && number.length <= 15) {
          phoneNumbers.push({
            value: number,
            confidence: 0.8
          });
        }
      }
    });

    // Remove duplicates
    const uniqueAliases = Array.from(
      new Map(bankingAliases.map(a => [a.value.toLowerCase(), a])).values()
    );
    const uniqueWhatsApp = Array.from(
      new Map(whatsappNumbers.map(w => [w.value.replace(/\s+/g, ''), w])).values()
    );
    const uniquePhones = Array.from(
      new Map(phoneNumbers.map(p => [p.value.replace(/\s+/g, ''), p])).values()
    );

    return {
      bankingAliases: uniqueAliases,
      whatsappNumbers: uniqueWhatsApp,
      phoneNumbers: uniquePhones
    };
  }

  /**
   * Analyze behavioral patterns from posts
   */
  analyzeBehavioralPatterns(posts: Array<{ content: string; platform: string; createdAt: Date }>): {
    postingFrequency: 'daily' | 'weekly' | 'monthly' | 'irregular';
    communicationStyle: 'formal' | 'casual' | 'emotional' | 'professional';
    commonTopics: string[];
    engagementLevel: 'high' | 'medium' | 'low';
    preferredPlatform: 'twitter' | 'instagram' | 'both';
  } {
    if (posts.length === 0) {
      return {
        postingFrequency: 'irregular',
        communicationStyle: 'casual',
        commonTopics: [],
        engagementLevel: 'low',
        preferredPlatform: 'twitter'
      };
    }

    // Calculate posting frequency
    const now = new Date();
    const postsLast30Days = posts.filter(p => {
      const postDate = new Date(p.createdAt);
      const daysDiff = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30;
    }).length;

    let postingFrequency: 'daily' | 'weekly' | 'monthly' | 'irregular';
    if (postsLast30Days >= 20) {
      postingFrequency = 'daily';
    } else if (postsLast30Days >= 4) {
      postingFrequency = 'weekly';
    } else if (postsLast30Days >= 1) {
      postingFrequency = 'monthly';
    } else {
      postingFrequency = 'irregular';
    }

    // Analyze communication style
    const allContent = posts.map(p => p.content.toLowerCase()).join(' ');
    let communicationStyle: 'formal' | 'casual' | 'emotional' | 'professional';
    
    const emotionalWords = ['❤', '💔', '😢', '😟', '❤️', '💖', '🐾', '🐶', '😭'];
    const formalWords = ['solicitamos', 'requerimos', 'informamos', 'comunicamos'];
    const casualWords = ['hola', 'chicos', 'amigos', 'gente'];
    
    const emotionalCount = emotionalWords.filter(w => allContent.includes(w)).length;
    const formalCount = formalWords.filter(w => allContent.includes(w)).length;
    const casualCount = casualWords.filter(w => allContent.includes(w)).length;
    
    if (emotionalCount > 5) {
      communicationStyle = 'emotional';
    } else if (formalCount > casualCount) {
      communicationStyle = 'formal';
    } else if (allContent.includes('refugio') || allContent.includes('rescue')) {
      communicationStyle = 'professional';
    } else {
      communicationStyle = 'casual';
    }

    // Extract common topics (simple keyword extraction)
    const topicKeywords: Record<string, number> = {};
    const commonWords = ['alimento', 'comida', 'tratamiento', 'veterinario', 'rescate', 'adopción', 'donación', 'ayuda', 'emergencia', 'casita'];
    commonWords.forEach(word => {
      const count = (allContent.match(new RegExp(word, 'g')) || []).length;
      if (count > 0) {
        topicKeywords[word] = count;
      }
    });
    const commonTopics = Object.entries(topicKeywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    // Determine engagement level
    const avgPostLength = posts.reduce((sum, p) => sum + p.content.length, 0) / posts.length;
    let engagementLevel: 'high' | 'medium' | 'low';
    if (posts.length > 10 && avgPostLength > 200) {
      engagementLevel = 'high';
    } else if (posts.length > 5 || avgPostLength > 100) {
      engagementLevel = 'medium';
    } else {
      engagementLevel = 'low';
    }

    // Determine preferred platform
    const twitterCount = posts.filter(p => p.platform === 'twitter').length;
    const instagramCount = posts.filter(p => p.platform === 'instagram').length;
    let preferredPlatform: 'twitter' | 'instagram' | 'both';
    if (twitterCount > instagramCount * 1.5) {
      preferredPlatform = 'twitter';
    } else if (instagramCount > twitterCount * 1.5) {
      preferredPlatform = 'instagram';
    } else {
      preferredPlatform = 'both';
    }

    return {
      postingFrequency,
      communicationStyle,
      commonTopics,
      engagementLevel,
      preferredPlatform
    };
  }

  /**
   * Process posts and extract insights for a guardian
   */
  async processGuardianPosts(
    guardianId: string,
    posts: Array<{
      id: string;
      platform: string;
      postContent: string;
      postUrl?: string;
      createdAt: Date;
    }>
  ): Promise<GuardianInsight> {
    const now = new Date();
    const paymentMethods: GuardianInsight['paymentMethods'] = {
      bankingAliases: [],
      whatsappNumbers: [],
      phoneNumbers: []
    };

    // Extract payment info from all posts
    const seenAliases = new Set<string>();
    const seenWhatsApp = new Set<string>();
    const seenPhones = new Set<string>();

      for (const post of posts) {
      const extracted = this.extractPaymentInfo(post.postContent);
      
      // Validate and convert createdAt to a valid Date
      let postDate: Date;
      if (post.createdAt instanceof Date && !isNaN(post.createdAt.getTime())) {
        postDate = post.createdAt;
      } else if (typeof post.createdAt === 'string' || typeof post.createdAt === 'number') {
        postDate = new Date(post.createdAt);
        if (isNaN(postDate.getTime())) {
          postDate = new Date(); // Fallback to current date if invalid
        }
      } else {
        postDate = new Date(); // Fallback to current date if invalid
      }
      
      extracted.bankingAliases.forEach(alias => {
        const key = alias.value.toLowerCase();
        if (!seenAliases.has(key)) {
          seenAliases.add(key);
          paymentMethods.bankingAliases!.push({
            value: alias.value,
            type: alias.type as any,
            verified: false,
            source: post.postUrl || post.id,
            confidence: alias.confidence,
            extractedAt: postDate
          });
        }
      });

      extracted.whatsappNumbers.forEach(wa => {
        const key = wa.value.replace(/\s+/g, '');
        if (!seenWhatsApp.has(key)) {
          seenWhatsApp.add(key);
          paymentMethods.whatsappNumbers!.push({
            value: wa.value,
            verified: false,
            source: post.postUrl || post.id,
            confidence: wa.confidence,
            extractedAt: postDate
          });
        }
      });

      extracted.phoneNumbers.forEach(phone => {
        const key = phone.value.replace(/\s+/g, '');
        if (!seenPhones.has(key)) {
          seenPhones.add(key);
          paymentMethods.phoneNumbers!.push({
            value: phone.value,
            verified: false,
            source: post.postUrl || post.id,
            confidence: phone.confidence,
            extractedAt: postDate
          });
        }
      });
    }

    // Analyze behavioral patterns
    const behavioralPatterns = this.analyzeBehavioralPatterns(
      posts.map(p => ({
        content: p.postContent,
        platform: p.platform,
        createdAt: p.createdAt
      }))
    );

    const insight: GuardianInsight = {
      guardianId,
      extractedAt: now,
      paymentMethods,
      behavioralPatterns,
      lastAnalyzed: now,
      totalPostsAnalyzed: posts.length,
      insightsVersion: 1
    };

    // Save to Firestore
    await this.saveInsight(insight);

    return insight;
  }

  /**
   * Save or update guardian insight
   */
  async saveInsight(insight: GuardianInsight): Promise<void> {
    try {
      const docRef = this.db.collection(this.COLLECTION).doc(insight.guardianId);
      
      // Merge with existing data (don't overwrite verified info)
      const existing = await docRef.get();
      if (existing.exists) {
        const existingData = existing.data() as GuardianInsight;
        
        // Merge payment methods (keep verified ones, add new unverified ones)
        if (existingData.paymentMethods) {
          const existingAliases = new Map(
            existingData.paymentMethods.bankingAliases?.map(a => [a.value.toLowerCase(), a]) || []
          );
          const existingWhatsApp = new Map(
            existingData.paymentMethods.whatsappNumbers?.map(w => [w.value.replace(/\s+/g, ''), w]) || []
          );
          const existingPhones = new Map(
            existingData.paymentMethods.phoneNumbers?.map(p => [p.value.replace(/\s+/g, ''), p]) || []
          );

          // Add new aliases if not already present
          insight.paymentMethods?.bankingAliases?.forEach(alias => {
            const key = alias.value.toLowerCase();
            if (!existingAliases.has(key)) {
              existingAliases.set(key, alias);
            }
          });

          // Add new WhatsApp numbers if not already present
          insight.paymentMethods?.whatsappNumbers?.forEach(wa => {
            const key = wa.value.replace(/\s+/g, '');
            if (!existingWhatsApp.has(key)) {
              existingWhatsApp.set(key, wa);
            }
          });

          // Add new phone numbers if not already present
          insight.paymentMethods?.phoneNumbers?.forEach(phone => {
            const key = phone.value.replace(/\s+/g, '');
            if (!existingPhones.has(key)) {
              existingPhones.set(key, phone);
            }
          });

          insight.paymentMethods = {
            bankingAliases: Array.from(existingAliases.values()),
            whatsappNumbers: Array.from(existingWhatsApp.values()),
            phoneNumbers: Array.from(existingPhones.values())
          };
        }

        // Update behavioral patterns (use latest analysis)
        insight.behavioralPatterns = insight.behavioralPatterns || existingData.behavioralPatterns;
        
        // Preserve knowledge base entries (ensure it's always an array, never undefined)
        insight.knowledgeBaseEntryIds = insight.knowledgeBaseEntryIds || existingData.knowledgeBaseEntryIds || [];
      } else {
        // If no existing data, ensure knowledgeBaseEntryIds is at least an empty array
        if (!insight.knowledgeBaseEntryIds) {
          insight.knowledgeBaseEntryIds = [];
        }
      }

      // Remove undefined values and convert Date objects to Firestore Timestamps
      const cleanedInsight: any = {};
      for (const [key, value] of Object.entries(insight)) {
        if (value !== undefined) {
          // Convert Date objects to Firestore Timestamps
          if (value instanceof Date) {
            if (!isNaN(value.getTime())) {
              cleanedInsight[key] = admin.firestore.Timestamp.fromDate(value);
            } else {
              // Skip invalid dates
              continue;
            }
          } else if (key === 'paymentMethods' && value && typeof value === 'object') {
            // Recursively convert dates in paymentMethods
            const cleanedPaymentMethods: any = {};
            for (const [pmKey, pmValue] of Object.entries(value)) {
              if (Array.isArray(pmValue)) {
                cleanedPaymentMethods[pmKey] = pmValue.map((item: any) => {
                  if (item && typeof item === 'object' && item.extractedAt instanceof Date) {
                    if (!isNaN(item.extractedAt.getTime())) {
                      return {
                        ...item,
                        extractedAt: admin.firestore.Timestamp.fromDate(item.extractedAt)
                      };
                    }
                  }
                  return item;
                });
              } else {
                cleanedPaymentMethods[pmKey] = pmValue;
              }
            }
            cleanedInsight[key] = cleanedPaymentMethods;
          } else {
            cleanedInsight[key] = value;
          }
        }
      }

      await docRef.set({
        ...cleanedInsight,
        extractedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastAnalyzed: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log(`✅ Saved guardian insight for ${insight.guardianId}`);
    } catch (error) {
      console.error(`❌ Error saving guardian insight for ${insight.guardianId}:`, error);
      throw error;
    }
  }

  /**
   * Get insights for a guardian
   */
  async getGuardianInsight(guardianId: string): Promise<GuardianInsight | null> {
    try {
      const doc = await this.db.collection(this.COLLECTION).doc(guardianId).get();
      if (!doc.exists) {
        return null;
      }
      return {
        guardianId,
        ...doc.data()
      } as GuardianInsight;
    } catch (error) {
      console.error(`Error fetching guardian insight for ${guardianId}:`, error);
      return null;
    }
  }
}

