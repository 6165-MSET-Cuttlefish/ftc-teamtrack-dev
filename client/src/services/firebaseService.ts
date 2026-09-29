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
import {
  getFirebase,
  logger,
  isAbortError,
  isCurrentSeasonSession,
} from '@/lib';
import { CURRENT_SEASON, SESSION_LIMITS } from '@/constants';
import type { Session, CreateSessionData } from '@/types';

/**
 * Only the current season's sessions are listed. Older seasons stay in
 * Firestore (nothing is deleted) but their scoring fields mean nothing to
 * this season's analysis, so they are left out of every list and chart.
 */
const currentSeasonOnly = (sessions: Session[]): Session[] =>
  sessions.filter(isCurrentSeasonSession);

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
          season: CURRENT_SEASON,
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
        return currentSeasonOnly(snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || userId,
            sessionName: data.sessionName || 'Untitled Session',
            createdAt: data.createdAt,
            ...data,
          } as Session;
        }));
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
        return currentSeasonOnly(snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || '',
            sessionName: data.sessionName || 'Untitled Session',
            createdAt: data.createdAt,
            ...data,
          } as Session;
        }));
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
        onUpdate(currentSeasonOnly(sessions));
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
        return currentSeasonOnly(snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || '',
            sessionName: data.sessionName || 'Untitled Session',
            createdAt: data.createdAt,
            ...data,
          } as Session;
        }));
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

  /** Delete a session, and take down any share links made from it */
  async deleteSession(sessionId: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        // Links first: if that fails the session is kept, rather than
        // leaving links behind that nothing points at any more.
        await this.deleteSharedSessions(sessionId);
        await deleteDoc(doc(db, 'sessions', sessionId));
        return true;
      },
      false,
      'Error deleting session:',
      true
    );
  }

  /** UID of the signed-in user, or throw — share links are per-owner. */
  private async currentUid(): Promise<string> {
    const firebase = await getFirebase();
    const uid = firebase?.auth?.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    return uid;
  }

  /**
   * Delete share links for one session: every link anyone made from it if
   * the current user owns the session, otherwise the ones they made.
   */
  async deleteSharedSessions(sessionId: string): Promise<number> {
    const db = await this.getDB();
    const uid = await this.currentUid();
    const shared = collection(db, 'sharedSessions');
    // Two queries because Firestore rules only allow a list the requester
    // can be shown to own, by one field or the other.
    const snapshots = await Promise.all([
      getDocs(
        query(
          shared,
          where('sessionOwnerId', '==', uid),
          where('sessionId', '==', sessionId)
        )
      ),
      getDocs(
        query(
          shared,
          where('createdBy', '==', uid),
          where('sessionId', '==', sessionId)
        )
      ),
    ]);
    const refs = new Map(
      snapshots.flatMap(s => s.docs).map(d => [d.id, d.ref] as const)
    );
    await Promise.all([...refs.values()].map(ref => deleteDoc(ref)));
    return refs.size;
  }

  /**
   * Delete everything the given user owns: all their sessions (from every
   * season, not just the listed ones), every share link they made, and every
   * share link anyone made of their sessions.
   */
  async deleteAllUserData(userId: string): Promise<void> {
    const db = await this.getDB();
    const shared = collection(db, 'sharedSessions');
    const snapshots = await Promise.all([
      getDocs(query(shared, where('createdBy', '==', userId))),
      getDocs(query(shared, where('sessionOwnerId', '==', userId))),
      getDocs(query(collection(db, 'sessions'), where('userId', '==', userId))),
    ]);
    const refs = new Map(
      snapshots.flatMap(s => s.docs).map(d => [d.ref.path, d.ref] as const)
    );
    await Promise.all([...refs.values()].map(ref => deleteDoc(ref)));
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

  /**
   * Store a session snapshot in Firestore and return its short ID. The
   * snapshot records its source `sessionId` so it can be taken down later.
   */
  async createSharedSession(
    shareData: object & { sessionId: string; sessionOwnerId: string },
    userId: string
  ): Promise<string> {
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
