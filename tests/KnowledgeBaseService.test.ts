import { KnowledgeBaseService, KnowledgeItem } from '../src/services/KnowledgeBaseService';
import * as admin from 'firebase-admin';

// Mock Firebase Admin
jest.mock('firebase-admin', () => {
  const mockDoc = {
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockCollection = {
    doc: jest.fn(() => mockDoc),
    get: jest.fn(),
  };

  const mockFirestore = {
    collection: jest.fn(() => mockCollection),
    batch: jest.fn(() => ({
      set: jest.fn(),
      commit: jest.fn(),
    })),
  };

  return {
    firestore: jest.fn(() => mockFirestore),
    initializeApp: jest.fn(),
  };
});

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;
  let mockFirestore: any;
  let mockCollection: any;
  let mockDoc: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    mockDoc = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockCollection = {
      doc: jest.fn(() => mockDoc),
      get: jest.fn(),
    };

    mockFirestore = {
      collection: jest.fn(() => mockCollection),
      batch: jest.fn(() => ({
        set: jest.fn(),
        commit: jest.fn(),
      })),
    };

    (admin.firestore as jest.Mock) = jest.fn(() => mockFirestore);
    service = new KnowledgeBaseService();
  });

  describe('initialize', () => {
    it('should initialize with existing entries from Firestore', async () => {
      const mockSnapshot = {
        empty: false,
        size: 2,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Test 1', content: 'Content 1', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
          callback({ id: 'kb-2', data: () => ({ title: 'Test 2', content: 'Content 2', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
        }),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);

      await service.initialize();

      const allItems = await service.getAll();
      expect(allItems).toHaveLength(2);
      expect(allItems[0].title).toBe('Test 1');
    });

    it('should initialize default entries when collection is empty', async () => {
      const mockSnapshot = {
        empty: true,
        size: 0,
        forEach: jest.fn(),
      };

      const mockBatch = {
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      mockFirestore.batch.mockReturnValue(mockBatch);

      await service.initialize();

      expect(mockFirestore.batch).toHaveBeenCalled();
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockCollection.get.mockRejectedValue(new Error('Firestore error'));

      await expect(service.initialize()).rejects.toThrow('Firestore error');
    });
  });

  describe('getAll', () => {
    it('should return all cached items', async () => {
      const mockSnapshot = {
        empty: false,
        size: 2,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Test 1', content: 'Content 1', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
          callback({ id: 'kb-2', data: () => ({ title: 'Test 2', content: 'Content 2', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
        }),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      const items = await service.getAll();
      expect(items).toHaveLength(2);
    });

    it('should initialize if cache not initialized', async () => {
      const mockSnapshot = {
        empty: false,
        size: 1,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Test', content: 'Content', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
        }),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      const items = await service.getAll();
      expect(items).toHaveLength(1);
    });
  });

  describe('getById', () => {
    it('should return item by ID', async () => {
      const mockSnapshot = {
        empty: false,
        size: 1,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Test', content: 'Content', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
        }),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      const item = await service.getById('kb-1');
      expect(item).toBeDefined();
      expect(item?.title).toBe('Test');
    });

    it('should return null for non-existent ID', async () => {
      const mockSnapshot = {
        empty: false,
        size: 1,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Test', content: 'Content', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
        }),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      const item = await service.getById('kb-nonexistent');
      expect(item).toBeNull();
    });
  });

  describe('getByCategory', () => {
    it('should filter items by category', async () => {
      const mockSnapshot = {
        empty: false,
        size: 3,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Test 1', content: 'Content', category: 'donations', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
          callback({ id: 'kb-2', data: () => ({ title: 'Test 2', content: 'Content', category: 'cases', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
          callback({ id: 'kb-3', data: () => ({ title: 'Test 3', content: 'Content', category: 'donations', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
        }),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      const items = await service.getByCategory('donations');
      expect(items).toHaveLength(2);
      expect(items.every(item => item.category === 'donations')).toBe(true);
    });
  });

  describe('getByAgentType', () => {
    it('should return items for specific agent type', async () => {
      const mockSnapshot = {
        empty: false,
        size: 2,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Test 1', content: 'Content', category: 'test', agentTypes: ['CaseAgent'], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
          callback({ id: 'kb-2', data: () => ({ title: 'Test 2', content: 'Content', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
        }),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      const items = await service.getByAgentType('CaseAgent');
      expect(items).toHaveLength(2); // One specific + one empty (available to all)
    });

    it('should return items with empty agentTypes (available to all)', async () => {
      const mockSnapshot = {
        empty: false,
        size: 1,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Test', content: 'Content', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
        }),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      const items = await service.getByAgentType('TwitterAgent');
      expect(items).toHaveLength(1);
    });
  });

  describe('getByAudience', () => {
    it('should filter items by audience', async () => {
      const mockSnapshot = {
        empty: false,
        size: 2,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Test 1', content: 'Content', category: 'test', agentTypes: [], audience: ['donors'], lastUpdated: '2024-01-01', usageCount: 0 }) });
          callback({ id: 'kb-2', data: () => ({ title: 'Test 2', content: 'Content', category: 'test', agentTypes: [], audience: ['guardians'], lastUpdated: '2024-01-01', usageCount: 0 }) });
        }),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      const items = await service.getByAudience('donors');
      expect(items).toHaveLength(1);
      expect(items[0].audience).toContain('donors');
    });
  });

  describe('add', () => {
    it('should add new knowledge base item', async () => {
      const mockSnapshot = {
        empty: false,
        size: 0,
        forEach: jest.fn(),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      mockDoc.set.mockResolvedValue(undefined);

      const newItem = await service.add({
        title: 'New Item',
        content: 'New Content',
        category: 'test',
        agentTypes: ['CaseAgent'],
        audience: ['donors'],
      });

      expect(newItem.id).toBeDefined();
      expect(newItem.title).toBe('New Item');
      expect(newItem.content).toBe('New Content');
      expect(newItem.usageCount).toBe(0);
      expect(mockDoc.set).toHaveBeenCalled();
    });

    it('should use provided ID if given', async () => {
      const mockSnapshot = {
        empty: false,
        size: 0,
        forEach: jest.fn(),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      mockDoc.set.mockResolvedValue(undefined);

      const newItem = await service.add({
        id: 'custom-id',
        title: 'New Item',
        content: 'New Content',
        category: 'test',
        agentTypes: [],
        audience: [],
      });

      expect(newItem.id).toBe('custom-id');
    });

    it('should trim title and content', async () => {
      const mockSnapshot = {
        empty: false,
        size: 0,
        forEach: jest.fn(),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      mockDoc.set.mockResolvedValue(undefined);

      const newItem = await service.add({
        title: '  Trimmed Title  ',
        content: '  Trimmed Content  ',
        category: 'test',
        agentTypes: [],
        audience: [],
      });

      expect(newItem.title).toBe('Trimmed Title');
      expect(newItem.content).toBe('Trimmed Content');
    });
  });

  describe('update', () => {
    it('should update existing item', async () => {
      const mockSnapshot = {
        empty: false,
        size: 1,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Old Title', content: 'Old Content', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0, createdAt: '2024-01-01' }) });
        }),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      mockDoc.update.mockResolvedValue(undefined);

      const updated = await service.update('kb-1', {
        title: 'New Title',
        content: 'New Content',
      });

      expect(updated.title).toBe('New Title');
      expect(updated.content).toBe('New Content');
      expect(mockDoc.update).toHaveBeenCalled();
    });

    it('should throw error for non-existent item', async () => {
      const mockSnapshot = {
        empty: false,
        size: 0,
        forEach: jest.fn(),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      await expect(service.update('kb-nonexistent', { title: 'New' })).rejects.toThrow('not found');
    });
  });

  describe('delete', () => {
    it('should delete item from Firestore and cache', async () => {
      const mockSnapshot = {
        empty: false,
        size: 1,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Test', content: 'Content', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
        }),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      mockDoc.delete.mockResolvedValue(undefined);

      await service.delete('kb-1');

      expect(mockDoc.delete).toHaveBeenCalled();
      const item = await service.getById('kb-1');
      expect(item).toBeNull();
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage count', async () => {
      const mockSnapshot = {
        empty: false,
        size: 1,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Test', content: 'Content', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 5 }) });
        }),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      mockDoc.update.mockResolvedValue(undefined);

      await service.incrementUsage('kb-1');

      expect(mockDoc.update).toHaveBeenCalledWith({
        usageCount: 6,
      });
    });

    it('should handle item not in cache', async () => {
      const mockSnapshot = {
        empty: false,
        size: 0,
        forEach: jest.fn(),
      };

      mockCollection.get.mockResolvedValue(mockSnapshot);
      await service.initialize();

      await service.incrementUsage('kb-nonexistent');
      // Should not throw, just do nothing
    });
  });

  describe('refreshCache', () => {
    it('should refresh cache from Firestore', async () => {
      const mockSnapshot1 = {
        empty: false,
        size: 1,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Old', content: 'Content', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-01', usageCount: 0 }) });
        }),
      };

      const mockSnapshot2 = {
        empty: false,
        size: 2,
        forEach: jest.fn((callback) => {
          callback({ id: 'kb-1', data: () => ({ title: 'Updated', content: 'Content', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-02', usageCount: 0 }) });
          callback({ id: 'kb-2', data: () => ({ title: 'New', content: 'Content', category: 'test', agentTypes: [], audience: [], lastUpdated: '2024-01-02', usageCount: 0 }) });
        }),
      };

      mockCollection.get
        .mockResolvedValueOnce(mockSnapshot1)
        .mockResolvedValueOnce(mockSnapshot2);

      await service.initialize();
      const initialItems = await service.getAll();
      expect(initialItems).toHaveLength(1);

      await service.refreshCache();
      const refreshedItems = await service.getAll();
      expect(refreshedItems).toHaveLength(2);
      expect(refreshedItems.find(item => item.id === 'kb-1')?.title).toBe('Updated');
    });
  });
});

