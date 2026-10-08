import {
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  runTransaction,
  writeBatch,
  getDocFromServer,
  getDocsFromServer,
  getCountFromServer,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getFirebase, logger, isAbortError, toDate } from '@/lib';
import {
  LEGACY_SEASON,
  normalizeSession,
  seasonOf,
} from '@/lib/sessionNormalize';
import { CURRENT_SEASON, SESSION_PAGE_SIZES } from '@/constants';
import type { Session, CreateSessionData, Match, Team } from '@/types';
import {
  SessionFeed,
  mergeSessions,
  readSessionPage,
  type SessionFeedState,
  type SessionSource,
} from './sessionFeed';
import { teamService } from './teamService';

/** What a list calls the user's own sessions (see `SessionFeedState.unread`) */
export const OWN_SESSIONS = 'own';

/** Firestore allows at most 500 writes in one batch. */
const BATCH_SIZE = 500;

/** Thrown by the delete paths when they can't confirm what exists. */
const UNREACHABLE_MESSAGE =
  "Couldn't reach the server, so nothing was deleted. Check your connection and try again.";

/** A share link as listed for someone who can take it down */
export interface ShareLink {
  /** The short ID in the link's URL */
  id: string;
  sessionName: string;
  matchCount: number;
  /** Null on a link saved without a date */
  createdAt: Date | null;
  /** False for a link a teammate made from one of the user's sessions */
  madeByUser: boolean;
}

/**
 * Only the current season's sessions are listed. Older seasons stay in
 * Firestore (nothing is deleted) but their scoring fields mean nothing to
 * this season's analysis, so they are left out of every list and chart.
 */
const isCurrentSeason = (session: Session): boolean =>
  session.season === CURRENT_SEASON;

/** Firestore rejects `undefined`; drop it from plain objects and arrays. */
const withoutUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(withoutUndefined) as T;
  if (
    typeof value === 'object' &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, withoutUndefined(entry)])
    ) as T;
  }
  return value;
};

/** String IDs of the matches in a stored `matches` value. */
const matchIdsOf = (matches: unknown): string[] =>
  Array.isArray(matches)
    ? matches
        .map(match => (match as { id?: unknown } | null)?.id)
        .filter((id): id is string => typeof id === 'string' && id !== '')
    : [];

/**
 * Whether a share link saved before links recorded their `sessionId` was
 * made from this session. Match IDs are unique to a session, so one in
 * common settles it; a snapshot with no matches has only its name and notes
 * to go by.
 */
const isLegacyLinkOf = (
  share: DocumentData,
  session: DocumentData
): boolean => {
  if (typeof share.sessionId === 'string') return false;
  const shared = matchIdsOf(share.matches);
  const current = new Set(matchIdsOf(session.matches));
  if (shared.length > 0) return shared.some(id => current.has(id));
  return (
    current.size === 0 &&
    typeof share.sessionName === 'string' &&
    share.sessionName === session.sessionName &&
    (share.notes || '') === (session.notes || '')
  );
};

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

  /**
   * Run a read that must be answered by the server. Plain `getDocs` falls
   * back to the (empty) local cache once the SDK decides it is offline, which
   * would make "found nothing to delete" indistinguishable from "couldn't
   * look" — so the delete paths read through here and fail loudly instead.
   */
  private async fromServer<T>(read: () => Promise<T>): Promise<T> {
    try {
      return await read();
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'unavailable') {
        throw new Error(UNREACHABLE_MESSAGE);
      }
      throw error;
    }
  }

  /**
   * Where a list's sessions come from. Without a team: the user's own.
   * In a team: everything filed under the team, plus the user's own
   * sessions that aren't (ones they chose not to import when they created
   * or joined it), which would otherwise vanish from every list the moment
   * they are on a team. Only this season's are kept.
   *
   * The season filter runs on the client: once scripts/backfill-sessions.mjs
   * has tagged every stored session with its season, `where('season', '==',
   * CURRENT_SEASON)` in the query can replace it (and the reads it skips).
   */
  private sessionSources(
    uid: string | null,
    teamId?: string | null
  ): SessionSource[] {
    const own = (keep: (session: Session) => boolean): SessionSource[] =>
      uid
        ? [
            {
              constraints: [where('userId', '==', uid)],
              pageSize: SESSION_PAGE_SIZES.OWN,
              keep,
              name: OWN_SESSIONS,
            },
          ]
        : [];
    if (!teamId) return own(isCurrentSeason);
    return [
      {
        constraints: [where('teamId', '==', teamId)],
        pageSize: SESSION_PAGE_SIZES.TEAM,
        keep: isCurrentSeason,
      },
      ...own(session => isCurrentSeason(session) && session.teamId !== teamId),
    ];
  }

  /** Every session a source keeps, newest first: read to the end. */
  private async readAll(db: Firestore, source: SessionSource) {
    const page = await readSessionPage(db, source, {
      need: Infinity,
      maxReads: Infinity,
    });
    return page.sessions;
  }

  /**
   * Create a new session. Under `id` when given, so a retry of the same save
   * writes over the first attempt rather than adding a second copy. Dated
   * `createdAt` when given (when it was played), else now.
   */
  async createSession(
    sessionData: CreateSessionData,
    id?: string,
    createdAt?: Date
  ): Promise<Session | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        // Strip undefined values — Firestore rejects them
        const clean = JSON.parse(JSON.stringify(sessionData));
        const newSession = {
          ...clean,
          season: CURRENT_SEASON,
          createdAt: createdAt
            ? Timestamp.fromDate(createdAt)
            : Timestamp.now(),
        };
        if (id) {
          await setDoc(doc(db, 'sessions', id), newSession);
          return normalizeSession(newSession, id);
        }
        const docRef = await addDoc(collection(db, 'sessions'), newSession);
        return normalizeSession(newSession, docRef.id);
      },
      null,
      'Error creating session:',
      true
    );
  }

  /**
   * Every one of this season's sessions the user owns, newest first, for
   * choosing which to share with a team (a list is read a page at a time:
   * see `openSessionFeed`). Throws when the query fails (no connection, a
   * missing index), so an empty list always means "none".
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const [own] = this.sessionSources(userId);
        return this.readAll(db, own);
      },
      [],
      'Error fetching user sessions:',
      true
    );
  }

  /**
   * Open a session list, read a page at a time, newest first: the user's
   * own, or in a team the team's (see `sessionSources`). `onChange` hears
   * the list once its first page is in and after every change; the feed's
   * `ready` settles then too, and rejects when the list can't be read (no
   * connection, a missing index, no longer in the team). With no connection
   * a list already read in this visit is shown as it was instead, marked
   * `offline`. `live` follows the first page as it changes on the server,
   * reporting failures after that to `onError`. Close the feed when done
   * with it.
   */
  async openSessionFeed(
    {
      uid,
      teamId,
      live = false,
    }: {
      uid: string;
      teamId?: string | null;
      live?: boolean;
    },
    onChange: (state: SessionFeedState) => void,
    onError?: (error: Error) => void
  ): Promise<SessionFeed> {
    const db = await this.getDB();
    return new SessionFeed(db, this.sessionSources(uid, teamId), onChange, {
      live,
      onError,
      // Live or not, the same account and team list the same sessions.
      key: `${uid}|${teamId ?? ''}`,
    });
  }

  /**
   * Get a single session by ID: null when it doesn't exist or this viewer
   * can't read it. By default a failed read is null too; pass `strict` to
   * have it throw instead, for a page that must not mistake being offline
   * for a session that isn't there.
   */
  async getSession(sessionId: string, strict = false): Promise<Session | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'sessions', sessionId);
        const docSnap = await getDoc(docRef).catch(error => {
          if (isPermissionDenied(error)) return null;
          throw error;
        });

        if (!docSnap?.exists()) return null;

        return normalizeSession(docSnap.data(), docSnap.id);
      },
      null,
      'Error fetching session:',
      strict
    );
  }

  /**
   * Where the sessions of earlier seasons come from: the user's own, plus
   * their team's when they are in one. Never listed or charted, but still
   * theirs to export.
   */
  private olderSeasonSources(userId: string, teamId?: string | null) {
    const older = (session: Session) => !isCurrentSeason(session);
    const sources: SessionSource[] = [
      {
        constraints: [where('userId', '==', userId)],
        pageSize: SESSION_PAGE_SIZES.OWN,
        keep: older,
      },
    ];
    if (teamId) {
      sources.push({
        constraints: [where('teamId', '==', teamId)],
        pageSize: SESSION_PAGE_SIZES.TEAM,
        keep: older,
      });
    }
    return sources;
  }

  /**
   * Whether the user (or their team) has sessions tagged with last season.
   * Counted by the server; sessions saved before the season tag existed only
   * count once scripts/backfill-sessions.mjs has tagged them.
   */
  async hasOlderSeasonSessions(
    userId: string,
    teamId?: string | null
  ): Promise<boolean> {
    const db = await this.getDB();
    const counts = await Promise.all(
      this.olderSeasonSources(userId, teamId).map(source =>
        getCountFromServer(
          query(
            collection(db, 'sessions'),
            ...source.constraints,
            where('season', '==', LEGACY_SEASON)
          )
        )
      )
    );
    return counts.some(snapshot => snapshot.data().count > 0);
  }

  /**
   * Every earlier-season session the user can read (their own and their
   * team's), newest first, tagged or not. Throws when they can't be read.
   */
  async getOlderSeasonSessions(
    userId: string,
    teamId?: string | null
  ): Promise<Session[]> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const lists = await Promise.all(
          this.olderSeasonSources(userId, teamId).map(source =>
            this.readAll(db, source)
          )
        );
        return mergeSessions(lists);
      },
      [],
      'Error fetching older-season sessions:',
      true
    );
  }

  /**
   * The season tag to add to a session that was saved without one, decided
   * from what is stored *before* the write. Without it, a write that changes
   * the matches could change which season the session is classified under.
   */
  private seasonTag(stored: DocumentData): { season?: string } {
    return typeof stored.season === 'string' && stored.season
      ? {}
      : { season: seasonOf(stored) };
  }

  /**
   * Update an existing session.
   *
   * The rules only let an author change a team session while they are still
   * in that team. Someone who has left it (or was removed) is refused, and
   * the session stays with the team as it was: a change never takes it out
   * of the team on the quiet. The lists show such a session as view-only.
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Session>
  ): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'sessions', sessionId);
        // If the stored session can't be read (offline, say) it is simply
        // left untagged; the update itself still goes ahead.
        const stored = await getDoc(docRef).catch(() => null);
        const data = stored?.exists() ? stored.data() : undefined;
        await updateDoc(docRef, {
          ...(withoutUndefined(updates) as Record<string, unknown>),
          ...(data ? this.seasonTag(data) : {}),
        });
        return true;
      },
      false,
      'Error updating session:',
      true
    );
  }

  /**
   * Change a session's matches based on what is stored right now, not on a
   * copy a page loaded earlier: `mutate` receives the current matches and
   * returns the new list, inside a transaction. Returns the matches written.
   * Throws if the session is missing, the write is denied, or the server
   * can't be reached. `mutate` may run more than once, so it must not have
   * side effects.
   *
   * Like `updateSession`, an author who is no longer in the session's team
   * is refused, and the session stays with the team.
   */
  async mutateSessionMatches(
    sessionId: string,
    mutate: (current: Match[]) => Match[]
  ): Promise<Match[]> {
    try {
      const db = await this.getDB();
      const docRef = doc(db, 'sessions', sessionId);
      return await runTransaction(db, async transaction => {
        const stored = await transaction.get(docRef);
        if (!stored.exists()) throw new Error('Session not found');
        const data = stored.data();
        const matches = withoutUndefined(
          mutate(normalizeSession(data, stored.id).matches)
        );
        transaction.update(docRef, { matches, ...this.seasonTag(data) });
        return matches;
      });
    } catch (error) {
      logger.error('Error updating session matches:', error);
      throw error;
    }
  }

  /** Delete documents in batches, each batch all-or-nothing. */
  private async deleteRefs(
    db: Firestore,
    refs: DocumentReference[]
  ): Promise<void> {
    for (let start = 0; start < refs.length; start += BATCH_SIZE) {
      const batch = writeBatch(db);
      refs.slice(start, start + BATCH_SIZE).forEach(ref => batch.delete(ref));
      await batch.commit();
    }
  }

  /**
   * Whether `uid` owns the team. The rules let a team's owner delete the
   * sessions filed under it; a team they aren't in can't even be read.
   */
  private async ownsTeam(
    db: Firestore,
    teamId: unknown,
    uid: string
  ): Promise<boolean> {
    if (typeof teamId !== 'string' || !teamId) return false;
    const team = await getDocFromServer(doc(db, 'teams', teamId)).catch(
      error => {
        if ((error as { code?: string } | null)?.code === 'unavailable') {
          throw new Error(UNREACHABLE_MESSAGE);
        }
        return null;
      }
    );
    return !!team?.exists() && teamService.ownerOf(team.data() as Team) === uid;
  }

  /**
   * Delete a session, and take down the share links made from it — everyone's,
   * whoever of the two is deleting. Only the person who recorded it (or the
   * owner of its team) can: the session is read from the server first, and
   * for anyone else this throws before a single link is touched.
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      const uid = await this.currentUid();
      const docRef = doc(db, 'sessions', sessionId);
      const stored = await this.fromServer(() => getDocFromServer(docRef));
      const session = stored.data();
      const asTeamOwner = !!session && session.userId !== uid;
      if (asTeamOwner && !(await this.ownsTeam(db, session.teamId, uid))) {
        throw new Error(
          "Only the person who recorded a session, or their team's owner, can delete it"
        );
      }
      const links = await this.sharedSessionRefs(
        db,
        uid,
        sessionId,
        session,
        asTeamOwner
      );
      // Links and session go in one batch: if the session can't be deleted
      // the links stay, and no link is left pointing at nothing.
      await this.deleteRefs(db, session ? [...links, docRef] : links);
      return true;
    } catch (error) {
      logger.error('Error deleting session:', error);
      throw error;
    }
  }

  /** UID of the signed-in user, or null */
  private async signedInUid(): Promise<string | null> {
    const firebase = await getFirebase();
    return firebase?.auth?.currentUser?.uid ?? null;
  }

  /** UID of the signed-in user, or throw — share links are per-owner. */
  private async currentUid(): Promise<string> {
    const uid = await this.signedInUid();
    if (!uid) throw new Error('Not authenticated');
    return uid;
  }

  /**
   * Share links for one session that `uid` may take down: every link anyone
   * made from it if they own the session, otherwise the ones they made.
   * `asTeamOwner` is for the owner of the session's team deleting it, who
   * gets every link too. `session` is the stored session, used to recognise
   * links saved before links recorded their `sessionId`. Always answered by
   * the server.
   */
  private async sharedSessionRefs(
    db: Firestore,
    uid: string,
    sessionId: string,
    session: DocumentData | undefined,
    asTeamOwner = false
  ): Promise<DocumentReference[]> {
    const shared = collection(db, 'sharedSessions');
    // Two queries because Firestore rules only allow a list the requester
    // can be shown to own, by one field or the other — or, for the team
    // owner, a list of one session's links, which the rules check against
    // that session's team. The second can't filter on sessionId: Firestore
    // has no query for "field is missing", and the links without one are
    // exactly the ones it needs to find.
    const [ofSession, madeByUser] = await this.fromServer(() =>
      Promise.all([
        getDocsFromServer(
          asTeamOwner
            ? query(shared, where('sessionId', '==', sessionId))
            : query(
                shared,
                where('sessionOwnerId', '==', uid),
                where('sessionId', '==', sessionId)
              )
        ),
        getDocsFromServer(query(shared, where('createdBy', '==', uid))),
      ])
    );
    const refs = new Map<string, DocumentReference>();
    ofSession.docs.forEach(d => refs.set(d.id, d.ref));
    madeByUser.docs.forEach(d => {
      const data = d.data();
      if (
        data.sessionId === sessionId ||
        (session && isLegacyLinkOf(data, session))
      ) {
        refs.set(d.id, d.ref);
      }
    });
    return [...refs.values()];
  }

  /**
   * Delete share links for one session: every link anyone made from it if
   * the current user owns the session, otherwise the ones they made.
   * Returns how many were deleted. Throws, deleting nothing, when the server
   * can't be reached.
   */
  async deleteSharedSessions(sessionId: string): Promise<number> {
    const db = await this.getDB();
    const uid = await this.currentUid();
    // Needed only to recognise older links; a session that is already gone
    // (which reads as "denied") just means there are none to recognise.
    const stored = await this.fromServer(() =>
      getDocFromServer(doc(db, 'sessions', sessionId))
    ).catch(error => {
      if ((error as Error).message === UNREACHABLE_MESSAGE) throw error;
      return null;
    });
    const refs = await this.sharedSessionRefs(
      db,
      uid,
      sessionId,
      stored?.data()
    );
    await this.deleteRefs(db, refs);
    return refs.length;
  }

  /**
   * Every share link the user can take down, whatever became of its session:
   * the ones they made, and the ones anyone made from their sessions. Always
   * answered by the server.
   */
  private async shareLinkDocs(
    db: Firestore,
    userId: string
  ): Promise<QueryDocumentSnapshot[]> {
    const shared = collection(db, 'sharedSessions');
    const snapshots = await this.fromServer(() =>
      Promise.all([
        getDocsFromServer(query(shared, where('createdBy', '==', userId))),
        getDocsFromServer(query(shared, where('sessionOwnerId', '==', userId))),
      ])
    );
    const docs = new Map(
      snapshots.flatMap(s => s.docs).map(d => [d.id, d] as const)
    );
    return [...docs.values()];
  }

  /**
   * The user's share links, newest first. This is the only place a link
   * shows up once its session is deleted, hidden (an older season) or has
   * no way to say which session it came from (links saved before they
   * recorded a `sessionId`). Throws when the server can't be reached.
   */
  async getShareLinks(userId: string): Promise<ShareLink[]> {
    const db = await this.getDB();
    const docs = await this.shareLinkDocs(db, userId);
    return docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          sessionName:
            typeof data.sessionName === 'string' ? data.sessionName : '',
          matchCount: Array.isArray(data.matches) ? data.matches.length : 0,
          createdAt: data.createdAt ? toDate(data.createdAt) : null,
          madeByUser: data.createdBy === userId,
        };
      })
      .sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
      );
  }

  /**
   * Delete the given share links of the user's. Returns how many were
   * deleted: a link already gone isn't one. Throws, deleting nothing, when
   * the server can't be reached.
   */
  async deleteShareLinks(userId: string, ids: string[]): Promise<number> {
    const db = await this.getDB();
    const wanted = new Set(ids);
    const refs = (await this.shareLinkDocs(db, userId))
      .filter(d => wanted.has(d.id))
      .map(d => d.ref);
    await this.deleteRefs(db, refs);
    return refs.length;
  }

  /**
   * IDs of every team the user belongs to, as the server sees it. Throws
   * when the server can't be reached, so account deletion can't mistake
   * "couldn't look" for "not on a team".
   */
  async getUserTeamIds(userId: string): Promise<string[]> {
    const db = await this.getDB();
    const snapshot = await this.fromServer(() =>
      getDocsFromServer(
        query(
          collection(db, 'teams'),
          where('memberIds', 'array-contains', userId)
        )
      )
    );
    return snapshot.docs.map(d => d.id);
  }

  /**
   * Delete everything the given user owns: all their sessions (from every
   * season, not just the listed ones), every share link they made, and every
   * share link anyone made of their sessions. Throws, deleting nothing, when
   * the server can't be reached.
   */
  async deleteAllUserData(userId: string): Promise<void> {
    const db = await this.getDB();
    const shared = collection(db, 'sharedSessions');
    const snapshots = await this.fromServer(() =>
      Promise.all([
        getDocsFromServer(query(shared, where('createdBy', '==', userId))),
        getDocsFromServer(query(shared, where('sessionOwnerId', '==', userId))),
        getDocsFromServer(
          query(collection(db, 'sessions'), where('userId', '==', userId))
        ),
      ])
    );
    const refs = new Map(
      snapshots.flatMap(s => s.docs).map(d => [d.ref.path, d.ref] as const)
    );
    await this.deleteRefs(db, [...refs.values()]);
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
    const db = await this.getDB();
    // Retry up to 3 times in the unlikely event of a collision
    for (let attempt = 0; attempt < 3; attempt++) {
      const shortId = this.generateShortId();
      const ref = doc(db, 'sharedSessions', shortId);
      try {
        await runTransaction(db, async transaction => {
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

  /**
   * Retrieve a shared session snapshot by short ID; returns null if not
   * found. Throws when it couldn't be read (offline), which says nothing
   * about whether the link still works.
   */
  async getSharedSession(
    shortId: string
  ): Promise<Record<string, unknown> | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const ref = doc(db, 'sharedSessions', shortId);
        const snap = await getDoc(ref).catch(error => {
          if (isPermissionDenied(error)) return null;
          throw error;
        });
        if (!snap?.exists()) return null;
        return snap.data() as Record<string, unknown>;
      },
      null,
      'Error fetching shared session:',
      true
    );
  }

  /** Import sessions to a team by setting their teamId */
  async importSessionsToTeam(
    sessionIds: string[],
    teamId: string
  ): Promise<number> {
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
