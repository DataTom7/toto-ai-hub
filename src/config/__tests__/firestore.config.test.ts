import { getFirestore, firestoreManager } from '../firestore.config';
import * as admin from 'firebase-admin';

// Mock firebase-admin
const mockApps: any[] = [];
const mockFirestoreInstances = new Map<string, any>();

const createMockFirestore = (appName: string) => ({
  settings: jest.fn(),
  collection: jest.fn(),
  _appName: appName, // For testing purposes
});

const createMockApp = (appName: string) => ({
  firestore: jest.fn(() => {
    if (!mockFirestoreInstances.has(appName)) {
      mockFirestoreInstances.set(appName, createMockFirestore(appName));
    }
    return mockFirestoreInstances.get(appName);
  }),
  name: appName,
});

jest.mock('firebase-admin', () => ({
  get apps() {
    return mockApps;
  },
  initializeApp: jest.fn(() => {
    mockApps.push({ name: '[DEFAULT]' });
  }),
  app: jest.fn((appName?: string) => {
    const name = appName || '[DEFAULT]';
    return createMockApp(name);
  }),
  credential: {
    cert: jest.fn(),
  },
}));

describe('Firestore Connection Manager', () => {
  beforeEach(() => {
    // Clear cache before each test
    firestoreManager.clearCache();
    jest.clearAllMocks();
    // Reset apps array and firestore instances
    mockApps.length = 0;
    mockFirestoreInstances.clear();
  });

  describe('getFirestore', () => {
    it('should return singleton instance', () => {
      const db1 = getFirestore();
      const db2 = getFirestore();

      expect(db1).toBe(db2);
    });

    it('should create separate instances for different apps', () => {
      const db1 = getFirestore('[DEFAULT]');
      const db2 = getFirestore('secondary');

      expect(db1).not.toBe(db2);
    });

    it('should configure Firestore settings', () => {
      const db = getFirestore();
      
      // Verify settings was called (check the cached instance)
      expect(db.settings).toHaveBeenCalledWith({
        ignoreUndefinedProperties: true,
      });
    });
  });

  describe('Connection pooling', () => {
    it('should reuse cached instances', () => {
      const db1 = getFirestore();
      const db2 = getFirestore();
      const db3 = getFirestore();

      // Should reuse the same instance
      expect(db1).toBe(db2);
      expect(db2).toBe(db3);
    });
  });
});

