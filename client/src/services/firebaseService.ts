import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import getFirebase from '@/lib/firebase';
import { isAbortError } from '@/lib/utils';
import type { Session, CreateSessionData } from '@/types';

// Re-export Session type for backwards compatibility
export type SessionData = Session;

// ============================================================================
// Firebase Service Class
// ============================================================================

class FirebaseService {
  private dbInstance: Firestore | null = null;

  /** Get Firestore database instance (lazy initialization) */
  private async getDB(): Promise<Firestore> {
    if (this.dbInstance) return this.dbInstance;

    const firebase = await getFirebase();
    if (!firebase?.db) {
      throw new Error('Firebase not initialized');
    }
    
    this.dbInstance = firebase.db;
    return this.dbInstance;
  }

  /** Safely execute a database operation with abort error handling */
  private async safeExecute<T>(
    operation: () => Promise<T>,
    fallback: T,
    errorMessage: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isAbortError(error)) {
        return fallback;
      }
      console.error(errorMessage, error);
      return fallback;
    }
  }

  // ==========================================================================
  // Session CRUD Operations
  // ==========================================================================

  /** Create a new session */
  async createSession(sessionData: CreateSessionData): Promise<SessionData | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const newSession = {
          ...sessionData,
          createdAt: Timestamp.now(),
        };
        const docRef = await addDoc(collection(db, 'sessions'), newSession);
        return { id: docRef.id, ...newSession } as SessionData;
      },
      null,
      'Error creating session:'
    );
  }

  /** Get all sessions for a specific user */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const q = query(
          collection(db, 'sessions'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as SessionData[];
      },
      [],
      'Error fetching user sessions:'
    );
  }

  /** Get a single session by ID */
  async getSession(sessionId: string): Promise<SessionData | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'sessions', sessionId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) return null;
        
        return { id: docSnap.id, ...docSnap.data() } as SessionData;
      },
      null,
      'Error fetching session:'
    );
  }

  /** Get all sessions (admin/comparison view) */
  async getAllSessions(): Promise<SessionData[]> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const q = query(
          collection(db, 'sessions'),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as SessionData[];
      },
      [],
      'Error fetching all sessions:'
    );
  }

  /** Update an existing session */
  async updateSession(
    sessionId: string,
    updates: Partial<SessionData>
  ): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'sessions', sessionId);
        await updateDoc(docRef, updates);
        return true;
      },
      false,
      'Error updating session:'
    );
  }

  /** Delete a session */
  async deleteSession(sessionId: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'sessions', sessionId);
        await deleteDoc(docRef);
        return true;
      },
      false,
      'Error deleting session:'
    );
  }
}

// Export singleton instance
export const firebaseService = new FirebaseService();
