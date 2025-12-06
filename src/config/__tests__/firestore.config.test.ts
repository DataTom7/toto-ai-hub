import { getFirestore, firestoreManager } from '../firestore.config';
import * as admin from 'firebase-admin';

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const mockFirestore = {
    settings: jest.fn(),
    collection: jest.fn(),
  };

  const mockApp = {
    firestore: jest.fn(() => mockFirestore),
  };

  return {
    apps: [],
    initializeApp: jest.fn(),
    app: jest.fn(() => mockApp),
    credential: {
      cert: jest.fn(),
    },
  };
});

describe('Firestore Connection Manager', () => {
  beforeEach(() => {
    // Clear cache before each test
    firestoreManager.clearCache();
    jest.clearAllMocks();
    // Reset apps array
    (admin as any).apps = [];
  });

  describe('getFirestore', () => {
    it('should return singleton instance', () => {
      const db1 = getFirestore();
      const db2 = getFirestore();

      expect(db1).toBe(db2);
      expect(admin.app().firestore).toHaveBeenCalledTimes(1);
    });

    it('should create separate instances for different apps', () => {
      const db1 = getFirestore('[DEFAULT]');
      const db2 = getFirestore('secondary');

      expect(db1).not.toBe(db2);
    });

    it('should configure Firestore settings', () => {
      const db = getFirestore();
      const mockFirestore = admin.app().firestore();

      expect(mockFirestore.settings).toHaveBeenCalledWith({
        ignoreUndefinedProperties: true,
      });
    });
  });

  describe('Connection pooling', () => {
    it('should reuse cached instances', () => {
      const db1 = getFirestore();
      const db2 = getFirestore();
      const db3 = getFirestore();

      // Should only create one instance
      expect(admin.app().firestore).toHaveBeenCalledTimes(1);
      expect(db1).toBe(db2);
      expect(db2).toBe(db3);
    });
  });
});

