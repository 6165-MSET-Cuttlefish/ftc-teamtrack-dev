import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteField,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  runTransaction,
  writeBatch,
  getDocFromServer,
  getDocsFromServer,
  getCountFromServer,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebase, logger, isAbortError, toDate } from '@/lib';
import {
  LEGACY_SEASON,
  normalizeSession,
  seasonOf,
} from '@/lib/sessionNormalize';
import { CURRENT_SEASON, SESSION_LIMITS } from '@/constants';
import type { Session, CreateSessionData, Match, Team } from '@/types';
import { teamService } from './teamService';

/** Firestore allows at most 500 writes in one batch. */
const BATCH_SIZE = 500;

/**
 * Upper bound on pages read to fill one list. Only reached by an account
 * with thousands of older-season sessions newer than its current ones.
 */
const MAX_LIST_PAGES = 20;

/** Thrown by the delete paths when they can't confirm what exists. */
const UNREACHABLE_MESSAGE =
  "Couldn't reach the server, so nothing was deleted. Check your connection and try again.";

/** One query's worth of sessions to list: where to look and what to keep. */
interface SessionSource {
  constraints: QueryConstraint[];
  /** Page size, and the most sessions this source contributes */
  max: number;
  keep: (session: Session) => boolean;
}

const toSession = (snapshot: QueryDocumentSnapshot): Session =>
  normalizeSession(snapshot.data(), snapshot.id);

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

/** Several lists as one: each session once, newest first. */
const mergeNewestFirst = (lists: Session[][]): Session[] => {
  const byId = new Map<string, Session>();
  for (const session of lists.flat()) {
    if (!byId.has(session.id)) byId.set(session.id, session);
  }
  return [...byId.values()].sort(
    (a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()
  );
};

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

const isPermissionDenied = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === 'permission-denied';

/** Whether a stored session is filed under a team. */
const hasTeam = (stored: DocumentData | undefined): boolean =>
  typeof stored?.teamId === 'string' && stored.teamId !== '';

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
   * Read up to `source.max` sessions the source wants to keep, newest first.
   *
   * The season filter runs on the client, after Firestore's `limit`, so one
   * page is not enough: untagged older-season documents dated after the
   * current ones would fill the page and push real sessions out of the list.
   * Pages are read until the list is full or the collection runs out.
   * `firstPage` lets a snapshot listener supply the page it already has.
   *
   * Once scripts/backfill-sessions.mjs has tagged every stored session with
   * its season, `where('season', '==', CURRENT_SEASON)` in the query can
   * replace both the client-side filter and this paging.
   */
  private async collectSessions(
    db: Firestore,
    source: SessionSource,
    firstPage?: QueryDocumentSnapshot[]
  ): Promise<Session[]> {
    const kept: Session[] = [];
    let docs = firstPage;
    let cursor: QueryDocumentSnapshot | undefined;

    for (let page = 0; page < MAX_LIST_PAGES; page++) {
      if (!docs) {
        const snapshot = await getDocs(
          query(
            collection(db, 'sessions'),
            ...source.constraints,
            orderBy('createdAt', 'desc'),
            ...(cursor ? [startAfter(cursor)] : []),
            limit(source.max)
          )
        );
        docs = snapshot.docs;
      }
      for (const snapshot of docs) {
        const session = toSession(snapshot);
        if (!source.keep(session)) continue;
        kept.push(session);
        if (kept.length >= source.max) return kept;
      }
      if (docs.length < source.max) break;
      cursor = docs[docs.length - 1];
      docs = undefined;
    }
    return kept;
  }

  /**
   * Where a team member's sessions come from: everything filed under the
   * team, plus their own sessions that aren't (ones they chose not to import
   * when they created or joined it), which would otherwise vanish from every
   * list the moment they are on a team.
   */
  private teamSources(teamId: string, uid: string | null): SessionSource[] {
    const sources: SessionSource[] = [
      {
        constraints: [where('teamId', '==', teamId)],
        max: SESSION_LIMITS.MAX_SESSIONS_PER_USER * 5, // Allow more for teams
        keep: isCurrentSeason,
      },
    ];
    if (uid) {
      sources.push({
        constraints: [where('userId', '==', uid)],
        max: SESSION_LIMITS.MAX_SESSIONS_PER_USER,
        keep: session => isCurrentSeason(session) && session.teamId !== teamId,
      });
    }
    return sources;
  }

  /** Create a new session */
  async createSession(sessionData: CreateSessionData): Promise<Session | null> {
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
        return normalizeSession(newSession, docRef.id);
      },
      null,
      'Error creating session:',
      true
    );
  }

  /**
   * Get all sessions for a specific user. Throws when the query fails (no
   * connection, a missing index), so an empty list always means "none".
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        return this.collectSessions(db, {
          constraints: [where('userId', '==', userId)],
          max: SESSION_LIMITS.MAX_SESSIONS_PER_USER,
          keep: isCurrentSeason,
        });
      },
      [],
      'Error fetching user sessions:',
      true
    );
  }

  /**
   * How many current-season sessions the user owns, counted by the server
   * without downloading them. Throws when the server can't be reached.
   * Sessions saved before the season tag existed are not counted until
   * scripts/backfill-sessions.mjs has tagged them.
   */
  async countUserSessions(userId: string): Promise<number> {
    const db = await this.getDB();
    const snapshot = await getCountFromServer(
      query(
        collection(db, 'sessions'),
        where('userId', '==', userId),
        where('season', '==', CURRENT_SEASON)
      )
    );
    return snapshot.data().count;
  }

  /**
   * Get all sessions for a specific team, plus the current user's own
   * sessions that aren't filed under it. Throws when the team's list can't
   * be read.
   */
  async getTeamSessions(teamId: string): Promise<Session[]> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const [team, own] = this.teamSources(teamId, await this.signedInUid());
        const lists = await Promise.all([
          this.collectSessions(db, team),
          own
            ? this.collectSessions(db, own).catch(error => {
                logger.error('Error fetching own sessions:', error);
                return [];
              })
            : [],
        ]);
        return mergeNewestFirst(lists);
      },
      [],
      'Error fetching team sessions:',
      true
    );
  }

  /**
   * Subscribe to real-time team session updates. Like `getTeamSessions`, the
   * list includes the current user's own sessions that aren't filed under
   * the team.
   */
  async subscribeTeamSessions(
    teamId: string,
    onUpdate: (sessions: Session[]) => void,
    onError?: (error: Error) => void
  ): Promise<Unsubscribe> {
    const db = await this.getDB();
    const sources = this.teamSources(teamId, await this.signedInUid());
    const lists: Array<Session[] | null> = sources.map(() => null);
    const runs = sources.map(() => 0);
    let closed = false;

    // Nothing is reported until every source has answered once, so the list
    // doesn't flash empty (or half-full) while the second query is loading.
    const publish = () => {
      if (closed || lists.some(list => list === null)) return;
      onUpdate(mergeNewestFirst(lists as Session[][]));
    };

    const unsubscribes = sources.map((source, index) =>
      onSnapshot(
        query(
          collection(db, 'sessions'),
          ...source.constraints,
          orderBy('createdAt', 'desc'),
          limit(source.max)
        ),
        async snapshot => {
          const run = ++runs[index];
          // Anything thrown in here would otherwise vanish inside the SDK and
          // leave the page waiting on a list that never arrives.
          try {
            const sessions = await this.collectSessions(
              db,
              source,
              snapshot.docs
            );
            // A newer snapshot overtook this one while it was paging.
            if (run !== runs[index]) return;
            lists[index] = sessions;
            publish();
          } catch (error) {
            logger.error('Error reading team sessions', error);
            if (!closed) onError?.(error as Error);
          }
        },
        error => {
          if (index > 0) {
            // The team's own list still works without the extra sessions.
            logger.error('Error in own sessions listener', error);
            lists[index] = lists[index] ?? [];
            publish();
            return;
          }
          logger.error('Error in team sessions listener', error);
          onError?.(error);
        }
      )
    );

    return () => {
      closed = true;
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }

  /** Get a single session by ID */
  async getSession(sessionId: string): Promise<Session | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'sessions', sessionId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        return normalizeSession(docSnap.data(), docSnap.id);
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
        return this.collectSessions(db, {
          constraints: [where('userId', '==', userId)],
          max: SESSION_LIMITS.ALL_SESSIONS_QUERY_LIMIT,
          keep: isCurrentSeason,
        });
      },
      [],
      'Error fetching all sessions:'
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
        max: SESSION_LIMITS.ALL_SESSIONS_QUERY_LIMIT,
        keep: older,
      },
    ];
    if (teamId) {
      sources.push({
        constraints: [where('teamId', '==', teamId)],
        max: SESSION_LIMITS.MAX_SESSIONS_PER_USER * 5,
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
            this.collectSessions(db, source)
          )
        );
        return mergeNewestFirst(lists);
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
   * in that team. For someone who has left it (or was removed), the same
   * change is retried with the session taken out of the team, which the
   * rules do allow — otherwise they could never rename or edit their own
   * old sessions again.
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
        const changes = {
          ...(withoutUndefined(updates) as Record<string, unknown>),
          ...(data ? this.seasonTag(data) : {}),
        };
        try {
          await updateDoc(docRef, changes);
        } catch (error) {
          if (
            !isPermissionDenied(error) ||
            !hasTeam(data) ||
            'teamId' in changes
          ) {
            throw error;
          }
          await updateDoc(docRef, { ...changes, teamId: deleteField() });
        }
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
   * gets the edit by taking the session out of that team.
   */
  async mutateSessionMatches(
    sessionId: string,
    mutate: (current: Match[]) => Match[]
  ): Promise<Match[]> {
    try {
      const db = await this.getDB();
      const docRef = doc(db, 'sessions', sessionId);
      let inTeam = false;
      const write = (leaveTeam: boolean) =>
        runTransaction(db, async transaction => {
          const stored = await transaction.get(docRef);
          if (!stored.exists()) throw new Error('Session not found');
          const data = stored.data();
          inTeam = hasTeam(data);
          const matches = withoutUndefined(
            mutate(normalizeSession(data, stored.id).matches)
          );
          transaction.update(docRef, {
            matches,
            ...(leaveTeam ? { teamId: deleteField() } : {}),
            ...this.seasonTag(data),
          });
          return matches;
        });
      try {
        return await write(false);
      } catch (error) {
        if (!isPermissionDenied(error) || !inTeam) throw error;
        return await write(true);
      }
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

  /** Retrieve a shared session snapshot by short ID; returns null if not found */
  async getSharedSession(
    shortId: string
  ): Promise<Record<string, unknown> | null> {
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
