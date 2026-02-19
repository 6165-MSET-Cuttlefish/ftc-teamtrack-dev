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
  onSnapshot,
  Timestamp,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import getFirebase from '@/lib/firebase';
import { isAbortError } from '@/lib/utils';
import { SESSION_LIMITS } from '@/constants';
import type { Session, CreateSessionData } from '@/types';

// Re-export Session type for backwards compatibility
export type SessionData = Session;

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

  /**
   * Safely execute a database operation with abort error handling
   * @param operation - The async operation to execute
   * @param fallback - Value to return on error (if not throwing)
   * @param errorMessage - Message to log on error
   * @param throwOnError - If true, re-throws errors after logging (for critical operations)
   */
  private async safeExecute<T>(
    operation: () => Promise<T>,
    fallback: T,
    errorMessage: string,
    throwOnError = false
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isAbortError(error)) {
        return fallback;
      }
      const { logger } = await import('@/lib/logger');
      logger.error(errorMessage, error);
      if (throwOnError) {
        throw error;
      }
      return fallback;
    }
  }

  /** Create a new session */
  async createSession(
    sessionData: CreateSessionData
  ): Promise<SessionData | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        // Strip undefined values — Firestore rejects them
        const clean = JSON.parse(JSON.stringify(sessionData));
        const newSession = {
          ...clean,
          createdAt: Timestamp.now(),
        };
        const docRef = await addDoc(collection(db, 'sessions'), newSession);
        return { id: docRef.id, ...newSession } as SessionData;
      },
      null,
      'Error creating session:',
      true // Throw errors for session creation
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
          limit(SESSION_LIMITS.MAX_SESSIONS_PER_USER)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
          const data = doc.data();
          // Basic validation to ensure required fields exist
          return {
            id: doc.id,
            userId: data.userId || userId,
            sessionName: data.sessionName || 'Untitled Session',
            createdAt: data.createdAt,
            ...data,
          } as SessionData;
        });
      },
      [],
      'Error fetching user sessions:'
    );
  }

  /** Get all sessions for a specific team */
  async getTeamSessions(teamId: string): Promise<SessionData[]> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const q = query(
          collection(db, 'sessions'),
          where('teamId', '==', teamId),
          orderBy('createdAt', 'desc'),
          limit(SESSION_LIMITS.MAX_SESSIONS_PER_USER * 5) // Allow more for teams
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || '',
            sessionName: data.sessionName || 'Untitled Session',
            createdAt: data.createdAt,
            ...data,
          } as SessionData;
        });
      },
      [],
      'Error fetching team sessions:'
    );
  }

  /** Subscribe to real-time team session updates */
  async subscribeTeamSessions(
    teamId: string,
    onUpdate: (sessions: SessionData[]) => void,
    onError?: (error: Error) => void
  ): Promise<Unsubscribe> {
    const db = await this.getDB();
    const q = query(
      collection(db, 'sessions'),
      where('teamId', '==', teamId),
      orderBy('createdAt', 'desc'),
      limit(SESSION_LIMITS.MAX_SESSIONS_PER_USER * 5)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const sessions = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || '',
            sessionName: data.sessionName || 'Untitled Session',
            createdAt: data.createdAt,
            ...data,
          } as SessionData;
        });
        onUpdate(sessions);
      },
      (error) => {
        console.error('Error in team sessions listener:', error);
        onError?.(error);
      }
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
          limit(SESSION_LIMITS.ALL_SESSIONS_QUERY_LIMIT)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || '',
            sessionName: data.sessionName || 'Untitled Session',
            createdAt: data.createdAt,
            ...data,
          } as SessionData;
        });
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
        await updateDoc(docRef, updates as Record<string, unknown>);
        return true;
      },
      false,
      'Error updating session:',
      true // Throw errors for updates
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
      'Error deleting session:',
      true // Throw errors for deletes
    );
  }

  /** Import sessions to a team by setting their teamId */
  async importSessionsToTeam(sessionIds: string[], teamId: string): Promise<number> {
    const db = await this.getDB();
    let updated = 0;
    for (const sessionId of sessionIds) {
      try {
        const docRef = doc(db, 'sessions', sessionId);
        await updateDoc(docRef, { teamId });
        updated++;
      } catch (error) {
        console.error(`Failed to import session ${sessionId}:`, error);
      }
    }
    return updated;
  }
}

export const firebaseService = new FirebaseService();
