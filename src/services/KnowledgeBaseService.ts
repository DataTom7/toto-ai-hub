import * as admin from 'firebase-admin';
import { getFirestore } from '../config/firestore.config';

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  agentTypes: string[];
  audience: string[];
  lastUpdated: string;
  usageCount: number;
  createdAt?: string;
  embedding?: number[]; // Cached embedding vector for RAG performance
  metadata?: {
    guardianId?: string;
    guardianName?: string;
    isGuardianSpecific?: boolean;
    [key: string]: any;
  };
}

/**
 * KnowledgeBaseService - Centralized service for managing knowledge base entries
 * Stores entries in Firestore and provides access to all agents
 * 
 * Uses a shared Firestore instance (typically toto-bo) to ensure KB is accessible
 * across all environments (staging and production) without duplication
 */
export class KnowledgeBaseService {
  private db: admin.firestore.Firestore;
  private readonly COLLECTION = 'knowledge_base';
  private cache: Map<string, KnowledgeItem> = new Map();
  private cacheInitialized: boolean = false;

  /**
   * @param sharedKbFirestore - Optional Firestore instance for shared KB
   *                            If not provided, uses default admin.firestore()
   *                            Should be set to toto-bo Firestore for cross-environment access
   */
  constructor(sharedKbFirestore?: admin.firestore.Firestore) {
    this.db = sharedKbFirestore || getFirestore();
    if (sharedKbFirestore) {
      console.log('📚 KnowledgeBaseService using shared Firestore instance for cross-environment KB access');
    }
  }

  /**
   * Initialize knowledge base from Firestore
   * Loads all entries and initializes default entries if collection is empty
   */
  async initialize(): Promise<void> {
    try {
      console.log('📚 Initializing Knowledge Base Service...');
      console.log(`🔍 Firestore instance: ${this.db ? 'available' : 'null'}`);
      
      if (!this.db) {
        const error = new Error('Firestore instance is not available. Check TOTO_BO_SERVICE_ACCOUNT_KEY configuration.');
        console.error('❌', error.message);
        throw error;
      }
      
      console.log(`🔍 Collection: ${this.COLLECTION}`);
      console.log(`🔍 Project ID: ${(this.db as any)?.projectId || 'unknown'}`);
      
      // Load existing entries from Firestore
      const snapshot = await this.db.collection(this.COLLECTION).get();
      console.log(`📊 Firestore query result: ${snapshot.size} documents found`);
      
      if (snapshot.empty) {
        console.log('📝 Knowledge base is empty, initializing with default entries...');
        await this.initializeDefaultEntries();
      } else {
        console.log(`✅ Loaded ${snapshot.size} knowledge base entries from Firestore`);
        snapshot.forEach(doc => {
          const data = doc.data();
          this.cache.set(doc.id, {
            id: doc.id,
            ...data
          } as KnowledgeItem);
        });
      }
      
      this.cacheInitialized = true;
      console.log(`✅ Knowledge Base Service initialized with ${this.cache.size} entries in cache`);
    } catch (error) {
      const err = error as Error & { code?: string };
      console.error('❌ Error initializing Knowledge Base Service:', error);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        code: err.code,
        name: err.name,
        projectId: this.db ? ((this.db as any)?.projectId || 'unknown') : 'null'
      });
      
      // Re-throw with more context
      if (!this.db) {
        throw new Error('Firestore instance not available. Ensure TOTO_BO_SERVICE_ACCOUNT_KEY secret is configured in Secret Manager.');
      }
      throw error;
    }
  }

  /**
   * Get all knowledge base items
   */
  async getAll(): Promise<KnowledgeItem[]> {
    if (!this.cacheInitialized) {
      await this.initialize();
    }
    return Array.from(this.cache.values());
  }

  /**
   * Get knowledge base item by ID
   */
  async getById(id: string): Promise<KnowledgeItem | null> {
    if (!this.cacheInitialized) {
      await this.initialize();
    }
    return this.cache.get(id) || null;
  }

  /**
   * Get knowledge base items by category
   */
  async getByCategory(category: string): Promise<KnowledgeItem[]> {
    if (!this.cacheInitialized) {
      await this.initialize();
    }
    return Array.from(this.cache.values()).filter(item => item.category === category);
  }

  /**
   * Get knowledge base items by agent type
   * Note: Empty agentTypes array means available to all agents
   * All entries are accessible, but relevance should be determined by audience
   */
  async getByAgentType(agentType: string): Promise<KnowledgeItem[]> {
    if (!this.cacheInitialized) {
      await this.initialize();
    }
    // Return entries where agentTypes is empty (available to all) or includes this agent type
    return Array.from(this.cache.values()).filter(item => 
      item.agentTypes.length === 0 || item.agentTypes.includes(agentType)
    );
  }

  /**
   * Get knowledge base items by audience
   */
  async getByAudience(audience: string): Promise<KnowledgeItem[]> {
    if (!this.cacheInitialized) {
      await this.initialize();
    }
    return Array.from(this.cache.values()).filter(item => 
      item.audience.includes(audience)
    );
  }

  /**
   * Add a new knowledge base item
   */
  async add(item: Omit<KnowledgeItem, 'id' | 'lastUpdated' | 'usageCount' | 'createdAt'> & { id?: string }): Promise<KnowledgeItem> {
    const id = item.id || `kb-${Date.now()}`;
    const newItem: KnowledgeItem = {
      id,
      title: item.title.trim(),
      content: item.content.trim(),
      category: item.category,
      agentTypes: item.agentTypes || [],
      audience: item.audience || [],
      lastUpdated: new Date().toISOString(),
      usageCount: 0,
      createdAt: new Date().toISOString(),
      metadata: item.metadata || undefined
    };

    // Save to Firestore
    const firestoreData: any = {
      title: newItem.title,
      content: newItem.content,
      category: newItem.category,
      agentTypes: newItem.agentTypes,
      audience: newItem.audience,
      lastUpdated: newItem.lastUpdated,
      usageCount: newItem.usageCount,
      createdAt: newItem.createdAt
    };
    
    // Add metadata if present
    if (newItem.metadata) {
      firestoreData.metadata = newItem.metadata;
    }
    
    await this.db.collection(this.COLLECTION).doc(id).set(firestoreData);

    // Update cache
    this.cache.set(id, newItem);

    console.log(`✅ Added knowledge base entry: ${id}`);
    return newItem;
  }

  /**
   * Update an existing knowledge base item
   */
  async update(id: string, updates: Partial<Omit<KnowledgeItem, 'id' | 'createdAt'>>): Promise<KnowledgeItem> {
    const existing = this.cache.get(id);
    if (!existing) {
      throw new Error(`Knowledge base item ${id} not found`);
    }

    const updatedItem: KnowledgeItem = {
      ...existing,
      ...updates,
      id,
      lastUpdated: new Date().toISOString(),
      createdAt: existing.createdAt
    };

    // Update Firestore
    await this.db.collection(this.COLLECTION).doc(id).update({
      ...updates,
      lastUpdated: updatedItem.lastUpdated
    });

    // Update cache
    this.cache.set(id, updatedItem);

    console.log(`✅ Updated knowledge base entry: ${id}`);
    return updatedItem;
  }

  /**
   * Delete a knowledge base item
   */
  async delete(id: string): Promise<void> {
    // Delete from Firestore
    await this.db.collection(this.COLLECTION).doc(id).delete();

    // Remove from cache
    this.cache.delete(id);

    console.log(`✅ Deleted knowledge base entry: ${id}`);
  }

  /**
   * Increment usage count for an item
   */
  async incrementUsage(id: string): Promise<void> {
    const item = this.cache.get(id);
    if (item) {
      item.usageCount = (item.usageCount || 0) + 1;
      await this.db.collection(this.COLLECTION).doc(id).update({
        usageCount: item.usageCount
      });
    }
  }

  /**
   * Initialize default knowledge base entries
   * This should only be called when the collection is empty
   */
  private async initializeDefaultEntries(): Promise<void> {
    // Import default entries from TotoAPIGateway
    // For now, we'll create a minimal set - the full initialization should be done via migration
    const defaultEntries = [
      {
        id: 'kb-donations-001',
        title: 'Banking Alias System',
        content: `BANKING ALIAS SETUP
- Each guardian/admin must complete their banking alias when creating their guardian profile
- Banking aliases follow Argentina's national banking alias system (each guardian creates their own unique alias)
- Aliases are stored in the guardian's Firestore document and are guardian-specific (not case-specific)

DONOR ACCESS TO BANKING ALIASES
- In toto-app: The case agent provides the banking alias and basic bank transfer instructions when users show donation intent
- In toto-bo: Banking aliases are displayed in case details for guardians/admin users
- Users can make a standard transfer from their bank account or wallet using the guardian alias

DONATION PROCESS - CRITICAL: NOT "THROUGH THE PLATFORM"
- Donations are DIRECT bank transfers from donor's bank account or wallet to guardian's banking alias
- Do NOT say "through our platform" or "through the platform" - this is incorrect
- Say: "direct transfer to the guardian's banking alias" or "transfer from your bank/wallet to the guardian's alias"
- There is NO platform processing - money goes directly from donor to guardian
- Each guardian has one banking alias for all their cases
- No intermediary processing - 100% of donations go directly to the guardian
- The agent only provides the banking alias and instructions - the actual transfer happens outside the platform`,
        category: 'donations',
        agentTypes: ['CaseAgent', 'DonationAgent'],
        audience: ['donors']
      }
      // More entries should be added here or via migration script
    ];

    const batch = this.db.batch();
    
    for (const entry of defaultEntries) {
      const docRef = this.db.collection(this.COLLECTION).doc(entry.id);
      batch.set(docRef, {
        title: entry.title,
        content: entry.content,
        category: entry.category,
        agentTypes: entry.agentTypes,
        audience: entry.audience,
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        createdAt: new Date().toISOString()
      });
      
      const cachedItem: KnowledgeItem = {
        id: entry.id,
        title: entry.title,
        content: entry.content,
        category: entry.category,
        agentTypes: entry.agentTypes,
        audience: entry.audience,
        lastUpdated: new Date().toISOString(),
        usageCount: 0,
        createdAt: new Date().toISOString()
      };
      this.cache.set(entry.id, cachedItem);
    }

    await batch.commit();
    console.log(`✅ Initialized ${defaultEntries.length} default knowledge base entries`);
  }

  /**
   * Refresh cache from Firestore
   */
  async refreshCache(): Promise<void> {
    console.log('🔄 Refreshing knowledge base cache...');
    this.cache.clear();

    const snapshot = await this.db.collection(this.COLLECTION).get();
    snapshot.forEach(doc => {
      const data = doc.data();
      this.cache.set(doc.id, {
        id: doc.id,
        ...data
      } as KnowledgeItem);
    });

    console.log(`✅ Cache refreshed: ${this.cache.size} entries`);
  }

  /**
   * Cache embeddings for KB entries to improve startup performance
   * Only updates the embedding field, doesn't touch other fields
   */
  async cacheEmbeddings(embeddings: Array<{ id: string; embedding: number[] }>): Promise<void> {
    const batch = this.db.batch();
    let count = 0;

    for (const { id, embedding } of embeddings) {
      const docRef = this.db.collection(this.COLLECTION).doc(id);
      batch.update(docRef, { embedding });
      count++;

      // Firestore batch limit is 500 operations
      if (count % 500 === 0) {
        await batch.commit();
      }
    }

    // Commit remaining operations
    if (count % 500 !== 0) {
      await batch.commit();
    }

    // Update cache
    for (const { id, embedding } of embeddings) {
      const cached = this.cache.get(id);
      if (cached) {
        cached.embedding = embedding;
      }
    }

    console.log(`✅ Cached ${embeddings.length} embeddings to Firestore`);
  }
}

