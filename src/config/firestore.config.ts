/**
 * Firestore Connection Manager
 *
 * Centralized Firestore client management with singleton pattern.
 * Ensures only one Firestore instance is created per app, preventing
 * connection exhaustion and improving performance.
 */

import * as admin from 'firebase-admin';

/**
 * Firestore connection manager singleton
 */
class FirestoreConnectionManager {
  private static instance: FirestoreConnectionManager;
  private firestoreInstances: Map<string, admin.firestore.Firestore> = new Map();
  private defaultAppInitialized: boolean = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): FirestoreConnectionManager {
    if (!FirestoreConnectionManager.instance) {
      FirestoreConnectionManager.instance = new FirestoreConnectionManager();
    }
    return FirestoreConnectionManager.instance;
  }

  /**
   * Initialize Firebase Admin SDK if not already initialized
   *
   * @param serviceAccountKey - Optional service account credentials
   * @returns True if initialized, false if already initialized
   */
  public initializeFirebase(serviceAccountKey?: any): boolean {
    // Check if default app is already initialized
    if (this.defaultAppInitialized || admin.apps.length > 0) {
      console.log('[FirestoreConnectionManager] Firebase Admin already initialized');
      return false;
    }

    try {
      if (serviceAccountKey) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountKey),
          projectId: serviceAccountKey.project_id,
        });
      } else if (process.env.TOTO_BO_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(process.env.TOTO_BO_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id,
        });
      } else {
        // Use Application Default Credentials
        admin.initializeApp();
      }

      this.defaultAppInitialized = true;
      console.log('[FirestoreConnectionManager] ✅ Firebase Admin initialized');
      return true;
    } catch (error) {
      console.error('[FirestoreConnectionManager] ❌ Failed to initialize Firebase Admin:', error);
      throw error;
    }
  }

  /**
   * Get Firestore instance (singleton per app)
   *
   * @param appName - Optional app name for multi-tenancy (default: '[DEFAULT]')
   * @returns Firestore instance
   */
  public getFirestore(appName: string = '[DEFAULT]'): admin.firestore.Firestore {
    // Check if we have a cached instance
    if (this.firestoreInstances.has(appName)) {
      return this.firestoreInstances.get(appName)!;
    }

    // Ensure Firebase is initialized
    if (!this.defaultAppInitialized && admin.apps.length === 0) {
      this.initializeFirebase();
    }

    // Create new Firestore instance
    const app = appName === '[DEFAULT]' ? admin.app() : admin.app(appName);
    const firestore = app.firestore();

    // Configure Firestore settings
    firestore.settings({
      ignoreUndefinedProperties: true,
      // Connection pool settings (Node.js SDK handles this internally)
    });

    // Cache the instance
    this.firestoreInstances.set(appName, firestore);

    console.log(`[FirestoreConnectionManager] ✅ Firestore instance created for app: ${appName}`);

    return firestore;
  }

  /**
   * Get default Firestore instance
   */
  public getDefaultFirestore(): admin.firestore.Firestore {
    return this.getFirestore('[DEFAULT]');
  }

  /**
   * Clear cached instances (for testing)
   */
  public clearCache(): void {
    this.firestoreInstances.clear();
    console.log('[FirestoreConnectionManager] Cache cleared');
  }
}

/**
 * Get Firestore instance (convenience function)
 *
 * @param appName - Optional app name
 * @returns Firestore instance
 *
 * @example
 * const db = getFirestore();
 * const collection = db.collection('users');
 */
export function getFirestore(appName?: string): admin.firestore.Firestore {
  return FirestoreConnectionManager.getInstance().getFirestore(appName);
}

/**
 * Initialize Firebase Admin SDK
 *
 * @param serviceAccountKey - Optional service account credentials
 *
 * @example
 * initializeFirebase(serviceAccountJson);
 */
export function initializeFirebase(serviceAccountKey?: any): void {
  FirestoreConnectionManager.getInstance().initializeFirebase(serviceAccountKey);
}

/**
 * Export the manager for advanced use cases
 */
export const firestoreManager = FirestoreConnectionManager.getInstance();

