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
import { getFirebase, logger, isAbortError } from '@/lib';
import { SESSION_LIMITS } from '@/constants';
import type { Session, CreateSessionData } from '@/types';

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
  ): Promise<Session | null> {
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
        return { id: docRef.id, ...newSession } as Session;
      },
      null,
      'Error creating session:',
      true
    );
  }

  /** Get all sessions for a specific user */
  async getUserSessions(userId: string): Promise<Session[]> {
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
          return {
            id: doc.id,
            userId: data.userId || userId,
            sessionName: data.sessionName || 'Untitled Session',
            createdAt: data.createdAt,
            ...data,
          } as Session;
        });
      },
      [],
      'Error fetching user sessions:'
    );
  }

  /** Get all sessions for a specific team */
  async getTeamSessions(teamId: string): Promise<Session[]> {
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
          } as Session;
        });
      },
      [],
      'Error fetching team sessions:'
    );
  }

  /** Subscribe to real-time team session updates */
  async subscribeTeamSessions(
    teamId: string,
    onUpdate: (sessions: Session[]) => void,
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
          } as Session;
        });
        onUpdate(sessions);
      },
      (error) => {
        logger.error('Error in team sessions listener', error);
        onError?.(error);
      }
    );
  }

  /** Get a single session by ID */
  async getSession(sessionId: string): Promise<Session | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'sessions', sessionId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        return { id: docSnap.id, ...docSnap.data() } as Session;
      },
      null,
      'Error fetching session:'
    );
  }

  /** Get all sessions for the current user and their teams (comparison view) */
  async getAllSessions(userId: string): Promise<Session[]> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const q = query(
          collection(db, 'sessions'),
          where('userId', '==', userId),
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
          } as Session;
        });
      },
      [],
      'Error fetching all sessions:'
    );
  }

  /** Update an existing session */
  async updateSession(
    sessionId: string,
    updates: Partial<Session>
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
      true
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
      true
    );
  }

  /** Generate a random 7-character base62 string suitable for use as a short ID */
  private generateShortId(): string {
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const values = crypto.getRandomValues(new Uint32Array(7));
    let id = '';
    for (let i = 0; i < 7; i++) {
      id += chars[values[i] % chars.length];
    }
    return id;
  }

  /** Store a session snapshot in Firestore and return its short ID */
  async createSharedSession(shareData: object, userId: string): Promise<string> {
    const { runTransaction } = await import('firebase/firestore');
    const db = await this.getDB();
    // Retry up to 3 times in the unlikely event of a collision
    for (let attempt = 0; attempt < 3; attempt++) {
      const shortId = this.generateShortId();
      const ref = doc(db, 'sharedSessions', shortId);
      try {
        await runTransaction(db, async (transaction) => {
          const existing = await transaction.get(ref);
          if (existing.exists()) throw new Error('collision');
          transaction.set(ref, {
            ...JSON.parse(JSON.stringify(shareData)),
            createdBy: userId,
            createdAt: Timestamp.now(),
          });
        });
        return shortId;
      } catch (err) {
        if ((err as Error).message === 'collision') continue;
        throw err;
      }
    }
    throw new Error('Failed to create shared session after retries');
  }

  /** Retrieve a shared session snapshot by short ID; returns null if not found */
  async getSharedSession(shortId: string): Promise<Record<string, unknown> | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const ref = doc(db, 'sharedSessions', shortId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        return snap.data() as Record<string, unknown>;
      },
      null,
      'Error fetching shared session:'
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
        logger.error(`Failed to import session ${sessionId}`, error);
      }
    }
    return updated;
  }
}

export const firebaseService = new FirebaseService();
