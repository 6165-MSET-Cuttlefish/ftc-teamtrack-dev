/**
 * A list of sessions read a page at a time, newest first.
 *
 * A list can come from more than one query (a team's list is everything
 * filed under the team plus the viewer's own sessions that aren't), each
 * read through its own cursor. Merged, the list only ever shows sessions
 * down to the point every query has read to, so nothing turns up later in
 * the middle of what is already on screen: an older page only ever adds to
 * the end.
 *
 * Every query orders by `createdAt` alone (Firestore adds the document ID
 * after it), so paging needs no index beyond the ones a single page uses.
 *
 * Where a page ends, and whether anything is left after it, is only ever
 * taken from the server. The local cache holds whatever other lists
 * happened to read (a team's list caches the viewer's own sessions filed
 * under it), so a page made from it can end far past sessions never read,
 * or short of ones that exist.
 *
 * Offline, a list read earlier in the visit is shown as it was last read
 * (see `remembered`) rather than not at all, marked `offline`, and read
 * again once the connection is back.
 */

import {
  collection,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { logger, toDate } from '@/lib';
import { normalizeSession } from '@/lib/sessionNormalize';
import type { Session } from '@/types';

/**
 * Upper bound on reads for one page. The season filter runs on the client,
 * after Firestore's `limit`, so a page of last season's sessions keeps
 * nothing and the next one is read; this is only reached by an account
 * with thousands of older-season sessions newer than its current ones.
 */
export const MAX_PAGE_READS = 20;

/** One query's worth of sessions to list: where to look and what to keep. */
export interface SessionSource {
  constraints: QueryConstraint[];
  /**
   * Documents one read takes (it asks for one more, to see whether any are
   * left after them), and the sessions a page holds at least
   */
  pageSize: number;
  keep: (session: Session) => boolean;
  /** What to call the source in `SessionFeedState.unread` */
  name?: string;
}

/** What a list holds right now. */
export interface SessionFeedState {
  /**
   * Newest first and without gaps: no session newer than the oldest one
   * here is missing from it.
   */
  sessions: Session[];
  /**
   * Every session read so far, newest first: `sessions` and any held back
   * from it until the sessions dated between them are read too
   */
  read: Session[];
  /** Older sessions remain to be read */
  hasMore: boolean;
  /** The named sources with more to read */
  unread: string[];
  /**
   * Every session recorded after this moment is in `sessions`; null once
   * the list holds them all.
   */
  completeAfter: Date | null;
  /**
   * The server can't be reached: this is the list as it was last read
   * during this visit, and it is read again once the connection is back.
   */
  offline: boolean;
}

/**
 * The list each feed key (an account and its team) last showed during this
 * visit. A page opened while the connection is down shows it, rather than
 * a list with nothing in it that reads as "no sessions".
 */
const remembered = new Map<string, SessionFeedState>();

/** How often a list shown offline tries the server again */
const OFFLINE_RETRY_MS = 15_000;

/**
 * How long a followed list waits for the server's first answer before it
 * is taken to be offline
 */
const FIRST_ANSWER_TIMEOUT_MS = 10_000;

/** Whether a failed read failed for want of a connection. */
const isOffline = (error?: unknown): boolean =>
  (error as { code?: string } | null)?.code === 'unavailable' ||
  (typeof navigator !== 'undefined' && navigator.onLine === false);

/** What a list that couldn't be read at all rejects with, offline */
const offlineError = (): Error =>
  Object.assign(new Error("Can't reach the server"), { code: 'unavailable' });

/** Where a document sits in the order: time, then ID, both descending. */
interface Position {
  seconds: number;
  nanos: number;
  id: string;
}

const toSession = (snapshot: QueryDocumentSnapshot): Session =>
  normalizeSession(snapshot.data(), snapshot.id);

/** A stored time as Firestore orders it: to the nanosecond when it has one. */
const timeOf = (value: unknown): { seconds: number; nanos: number } => {
  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    'nanoseconds' in value
  ) {
    return { seconds: Number(value.seconds), nanos: Number(value.nanoseconds) };
  }
  const ms = toDate(value).getTime();
  return { seconds: Math.floor(ms / 1000), nanos: (ms % 1000) * 1e6 };
};

const positionOfSession = (session: Session): Position => ({
  ...timeOf(session.createdAt),
  id: session.id,
});

const positionOfDoc = (snapshot: QueryDocumentSnapshot): Position => ({
  ...timeOf(snapshot.get('createdAt')),
  id: snapshot.id,
});

/** Negative when `a` comes first (is newer), positive when `b` does. */
const comparePositions = (a: Position, b: Position): number =>
  b.seconds - a.seconds ||
  b.nanos - a.nanos ||
  (a.id > b.id ? -1 : a.id < b.id ? 1 : 0);

const newestFirst = (a: Session, b: Session): number =>
  comparePositions(positionOfSession(a), positionOfSession(b));

/**
 * Several lists as one: each session once, newest first. Where two lists
 * hold the same session, the first list's copy is kept.
 */
export const mergeSessions = (lists: Session[][]): Session[] => {
  const byId = new Map<string, Session>();
  for (const session of lists.flat()) {
    if (!byId.has(session.id)) byId.set(session.id, session);
  }
  return [...byId.values()].sort(newestFirst);
};

/** What one read of a source found. */
export interface SessionPage {
  /** The sessions the source keeps, newest first */
  sessions: Session[];
  /** The last document read, kept or not: the next page starts after it */
  cursor: QueryDocumentSnapshot | null;
  /** Nothing is left after `cursor` */
  done: boolean;
}

/**
 * Read a source after `cursor` (from the newest without one) until at least
 * `need` sessions are kept, the query runs out, or `maxReads` reads are
 * done. Every session of every page read is kept, so a page can hold more
 * than `need`: those documents were paid for either way.
 *
 * Stopping short of the end, a read asks for one document past the page:
 * without it, a page that happens to end on the last document leaves
 * "Show older" up for a press that finds nothing. Read to the end, the end
 * says so itself. Answered by the server or not at all: offline, a page
 * from the cache could end the list early, so the read fails instead.
 */
export const readSessionPage = async (
  db: Firestore,
  source: SessionSource,
  {
    cursor = null,
    need = source.pageSize,
    maxReads = MAX_PAGE_READS,
  }: {
    cursor?: QueryDocumentSnapshot | null;
    need?: number;
    maxReads?: number;
  } = {}
): Promise<SessionPage> => {
  const sessions: Session[] = [];
  let last = cursor;
  const peek = Number.isFinite(need) ? 1 : 0;
  for (let read = 0; read < maxReads && sessions.length < need; read++) {
    const snapshot = await getDocsFromServer(
      query(
        collection(db, 'sessions'),
        ...source.constraints,
        orderBy('createdAt', 'desc'),
        ...(last ? [startAfter(last)] : []),
        limit(source.pageSize + peek)
      )
    );
    const docs = snapshot.docs.slice(0, source.pageSize);
    for (const docSnapshot of docs) {
      const session = toSession(docSnapshot);
      if (source.keep(session)) sessions.push(session);
    }
    if (docs.length > 0) last = docs[docs.length - 1];
    if (snapshot.docs.length < source.pageSize + peek) {
      return { sessions, cursor: last, done: true };
    }
  }
  return { sessions, cursor: last, done: false };
};

/** How far one source of a feed has been read. */
interface SourceState {
  source: SessionSource;
  /**
   * Whether a failed read ends the list. When it doesn't (the viewer's
   * own sessions beside a team's), the source is dropped instead.
   */
  required: boolean;
  /** What the source keeps of everything read so far, newest first */
  loaded: Session[];
  cursor: QueryDocumentSnapshot | null;
  done: boolean;
  /** Answered once, its first page complete */
  ready: boolean;
}

/** Rounds of reading one "Show older" press may take to add a page. */
const MAX_OLDER_ROUNDS = 4;

/**
 * A session list read in pages. `ready` settles once the first page of
 * every source is in; `onChange` hears every change after that.
 */
export class SessionFeed {
  private readonly db: Firestore;
  private readonly onChange: (state: SessionFeedState) => void;
  private readonly states: SourceState[];
  private readonly unsubscribes: Unsubscribe[] = [];
  /** Where the list is remembered for a visit offline (see `remembered`) */
  private readonly key: string | undefined;
  private closed = false;
  /** Stops waiting for the connection to come back, while it waits */
  private stopRetrying: (() => void) | null = null;
  private state: SessionFeedState = {
    sessions: [],
    read: [],
    hasMore: false,
    unread: [],
    completeAfter: null,
    offline: false,
  };
  /** "Show older" and "load all" run one at a time, in order */
  private queue: Promise<unknown> = Promise.resolve();
  readonly ready: Promise<void>;

  /**
   * `live` follows each source's first page as it changes on the server
   * (sessions saved, renamed or deleted by anyone); older pages are read
   * once. The first source is the list itself: if it can't be read, the
   * list fails (`ready` rejects, or `onError` hears it later), unless it is
   * offline with a list remembered under `key` to show instead.
   */
  constructor(
    db: Firestore,
    sources: SessionSource[],
    onChange: (state: SessionFeedState) => void,
    {
      live = false,
      onError,
      key,
    }: {
      live?: boolean;
      onError?: (error: Error) => void;
      key?: string;
    } = {}
  ) {
    this.db = db;
    this.onChange = onChange;
    this.key = key;
    this.states = sources.map((source, index) => ({
      source,
      required: index === 0,
      loaded: [],
      cursor: null,
      done: false,
      ready: false,
    }));
    this.ready = live ? this.listen(onError) : this.firstPagesOrRemembered();
    // A failed first load is the caller's to report; it is not left unhandled.
    this.ready.catch(() => {});
  }

  /** Stop following the server. Reads still on their way are dropped. */
  close(): void {
    this.closed = true;
    this.unsubscribes.forEach(unsubscribe => unsubscribe());
    this.stopRetrying?.();
  }

  /**
   * Change the sessions already read, as the page has just changed them
   * itself (renamed, archived, deleted): a later page or snapshot keeps the
   * change rather than putting back the copy it read before.
   */
  patch(change: (sessions: Session[]) => Session[]): void {
    for (const state of this.states) state.loaded = change(state.loaded);
    if (this.state.offline) {
      // The list on screen is the remembered one: it takes the change too.
      this.state = {
        ...this.state,
        sessions: change(this.state.sessions),
        read: change(this.state.read),
      };
      this.onChange(this.state);
      return;
    }
    this.publish();
  }

  /** Read about one page further back. */
  loadOlder(): Promise<SessionFeedState> {
    return this.enqueue(async () => {
      // The list remembered offline has nowhere to read on from.
      if (this.state.offline) throw offlineError();
      const before = this.state.sessions.length;
      const target = Math.min(...this.states.map(s => s.source.pageSize));
      for (let round = 0; round < MAX_OLDER_ROUNDS; round++) {
        // The source read least far back holds the list up: read it on.
        const lagging = this.open().reduce<SourceState | null>(
          (newest, state) =>
            !newest || this.cursorCompare(state, newest) < 0 ? state : newest,
          null
        );
        if (!lagging) break;
        await this.readOn(lagging, lagging.source.pageSize, MAX_PAGE_READS);
        this.publish();
        if (this.state.sessions.length - before >= target) break;
      }
      return this.state;
    });
  }

  /** Read everything not read yet. Resolves with the whole list. */
  loadAll(): Promise<SessionFeedState> {
    return this.enqueue(async () => {
      if (this.state.offline) throw offlineError();
      await Promise.all(
        this.open().map(state => this.readOn(state, Infinity, Infinity))
      );
      this.publish();
      return this.state;
    });
  }

  private enqueue(
    task: () => Promise<SessionFeedState>
  ): Promise<SessionFeedState> {
    const run = this.queue.then(async () => {
      await this.ready;
      return this.closed ? this.state : task();
    });
    this.queue = run.catch(() => {});
    return run;
  }

  /** Sources with more to read */
  private open(): SourceState[] {
    return this.states.filter(state => state.ready && !state.done);
  }

  /** Which of two sources has read less far back (negative: `a`) */
  private cursorCompare(a: SourceState, b: SourceState): number {
    if (!a.cursor || !b.cursor) return a.cursor ? 1 : b.cursor ? -1 : 0;
    return comparePositions(positionOfDoc(a.cursor), positionOfDoc(b.cursor));
  }

  /** Read a source on from its cursor and take in what it found. */
  private async readOn(
    state: SourceState,
    need: number,
    maxReads: number
  ): Promise<void> {
    const page = await readSessionPage(this.db, state.source, {
      cursor: state.cursor,
      need,
      maxReads,
    });
    if (this.closed) return;
    // What is already here is fresher (a snapshot, or the page's own edit).
    state.loaded = mergeSessions([state.loaded, page.sessions]);
    if (
      page.cursor &&
      (!state.cursor ||
        comparePositions(
          positionOfDoc(page.cursor),
          positionOfDoc(state.cursor)
        ) > 0)
    ) {
      state.cursor = page.cursor;
    }
    state.done = state.done || page.done;
  }

  /**
   * Show the list as it was last read during this visit, marked offline,
   * when the server can't be reached (`error`, if a read said why) and
   * there is one to show. False otherwise: the list is left as it is.
   */
  private showRemembered(error?: unknown): boolean {
    const last = this.key === undefined ? undefined : remembered.get(this.key);
    if (this.closed || !last || !isOffline(error)) return false;
    this.state = { ...last, offline: true };
    this.onChange(this.state);
    return true;
  }

  /**
   * Run `retry` once the connection looks to be back: when the browser says
   * so, or at the next try every `OFFLINE_RETRY_MS` (a phone on a venue's
   * Wi-Fi can be "online" with no way out).
   */
  private retryWhenOnline(retry: () => void): void {
    if (this.closed || this.stopRetrying || typeof window === 'undefined') {
      return;
    }
    const attempt = () => {
      if (navigator.onLine === false) return;
      this.stopRetrying?.();
      retry();
    };
    const timer = setInterval(attempt, OFFLINE_RETRY_MS);
    window.addEventListener('online', attempt);
    this.stopRetrying = () => {
      clearInterval(timer);
      window.removeEventListener('online', attempt);
      this.stopRetrying = null;
    };
  }

  /**
   * The first pages, read once. Offline, the list remembered from earlier
   * in the visit stands in, and the pages are read again from the start
   * once the connection is back.
   */
  private async firstPagesOrRemembered(): Promise<void> {
    try {
      await this.readFirstPages();
    } catch (error) {
      if (!this.showRemembered(error)) throw error;
      this.retryWhenOnline(() => void this.readAgain());
    }
  }

  /** Read the first pages again, from scratch, for a list shown offline. */
  private readAgain(): Promise<SessionFeedState> {
    return this.enqueue(async () => {
      for (const state of this.states) {
        state.loaded = [];
        state.cursor = null;
        state.done = false;
        state.ready = false;
      }
      try {
        await this.readFirstPages();
      } catch (error) {
        logger.warn('Sessions still unreachable', { error: String(error) });
        this.retryWhenOnline(() => void this.readAgain());
      }
      return this.state;
    });
  }

  /** The first page of every source, read once. */
  private async readFirstPages(): Promise<void> {
    await Promise.all(
      this.states.map(async state => {
        try {
          await this.readOn(state, state.source.pageSize, MAX_PAGE_READS);
        } catch (error) {
          if (state.required) throw error;
          logger.error('Error fetching own sessions:', error);
          state.loaded = [];
          state.done = true;
        }
        state.ready = true;
      })
    );
    this.publish();
  }

  /**
   * Follow each source's first page. A snapshot replaces what the list
   * holds as far back as the page reaches; what was read beyond it stays (a
   * session pushed off the end by a newer one is still there, just no
   * longer followed). Where reading goes on from, and whether there is
   * anything more, is the server's first answer; a later page never ends
   * the list, as one can come up short for a moment (a session in it was
   * deleted here, and the server hasn't refilled it yet).
   */
  private listen(onError?: (error: Error) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (error: Error) => {
        if (this.closed) return;
        if (!settled) {
          settled = true;
          stopWatchingOffline();
          reject(error);
        }
        onError?.(error);
      };
      const publishFirst = () => {
        this.publish();
        if (!settled && this.states.every(state => state.ready)) {
          settled = true;
          stopWatchingOffline();
          resolve();
        }
      };
      // Offline before the server has answered (the browser says so, or the
      // server hasn't answered for a long while: a venue's Wi-Fi can be
      // "online" with no way out): the list remembered from earlier in the
      // visit stands in, or with none the list fails rather than load for as
      // long as the connection is down. Either way the listeners keep
      // waiting, and the server's first answer replaces it.
      const wentOffline = (timedOut = false) => {
        if (settled || this.closed) return;
        if (!timedOut && navigator.onLine !== false) return;
        if (this.showRemembered(offlineError())) {
          settled = true;
          stopWatchingOffline();
          resolve();
        } else {
          fail(offlineError());
        }
      };
      const onOffline = () => wentOffline();
      const noAnswer = setTimeout(
        () => wentOffline(true),
        FIRST_ANSWER_TIMEOUT_MS
      );
      const stopWatchingOffline = () => {
        clearTimeout(noAnswer);
        window.removeEventListener('offline', onOffline);
      };
      window.addEventListener('offline', onOffline);
      this.unsubscribes.push(stopWatchingOffline);
      queueMicrotask(onOffline);

      for (const state of this.states) {
        const { source } = state;
        /** The first page is being topped up; later snapshots wait for it */
        let filling = false;
        /** The server has answered once */
        let answered = false;
        /** The documents the last page held */
        let followed = new Set<string>();
        const stop = onSnapshot(
          query(
            collection(this.db, 'sessions'),
            ...source.constraints,
            orderBy('createdAt', 'desc'),
            // One past the page says whether anything is left after it.
            limit(source.pageSize + 1)
          ),
          // The server confirming a page the cache already showed is only a
          // change of metadata, and would otherwise never be heard.
          { includeMetadataChanges: true },
          async snapshot => {
            // A page from the cache is never taken (see the top of the
            // file): before the server answers it holds other lists'
            // sessions, and one the SDK refills from it after a delete here
            // can end on a session far past ones never read. It does say
            // the SDK has noticed when the connection is down.
            if (this.closed) return;
            if (snapshot.metadata.fromCache) {
              if (!answered) wentOffline();
              return;
            }
            const docs = snapshot.docs;
            const more = docs.length > source.pageSize;
            const last = docs[docs.length - 1];
            const reach = last ? positionOfDoc(last) : null;
            const ids = new Set(docs.map(docSnapshot => docSnapshot.id));
            state.loaded = mergeSessions([
              docs.map(toSession).filter(source.keep),
              state.loaded.filter(session => {
                if (ids.has(session.id)) return false;
                // Within the page's reach, yet not in it: gone
                if (
                  reach &&
                  comparePositions(positionOfSession(session), reach) <= 0
                ) {
                  return false;
                }
                // Past its end. A page with room to spare pushed nothing out,
                // so one that was in it last time is gone too.
                return more || !followed.has(session.id);
              }),
            ]);
            followed = ids;
            const end = docs[Math.min(docs.length, source.pageSize) - 1];
            if (!answered) {
              answered = true;
              state.cursor = end ?? null;
              state.done = !more;
            } else if (
              more &&
              end &&
              (!state.cursor ||
                comparePositions(
                  positionOfDoc(end),
                  positionOfDoc(state.cursor)
                ) > 0)
            ) {
              // Sessions above were deleted: the page reaches further back
              // than has been read.
              state.cursor = end;
            }
            if (state.ready) {
              this.publish();
              return;
            }
            if (filling) return;
            filling = true;
            // Anything thrown in here would otherwise vanish inside the SDK
            // and leave the page waiting on a list that never arrives.
            try {
              // The first page may be mostly last season's sessions: read on
              // until it holds a page of this season's.
              if (!state.done && state.loaded.length < source.pageSize) {
                await this.readOn(
                  state,
                  source.pageSize - state.loaded.length,
                  MAX_PAGE_READS - 1
                );
              }
            } catch (error) {
              if (state.required && !isOffline(error)) {
                logger.error('Error reading sessions', error);
                fail(error as Error);
                return;
              }
              logger.error('Error fetching own sessions:', error);
              // Offline, the server's first page stands as it is, and Show
              // older reads on once the connection is back. The viewer's
              // own sessions beside a team's are dropped instead.
              if (!state.required) state.done = true;
            } finally {
              filling = false;
            }
            state.ready = true;
            publishFirst();
          },
          error => {
            if (!state.required) {
              // The list still works without the extra sessions.
              logger.error('Error in own sessions listener', error);
              state.ready = true;
              state.done = true;
              publishFirst();
              return;
            }
            logger.error('Error in sessions listener', error);
            fail(error);
          }
        );
        this.unsubscribes.push(stop);
      }
    });
  }

  /**
   * Report the list: every source's sessions down to the newest point any
   * source with more to read has reached, so nothing is shown that a
   * session not read yet would belong above.
   */
  private publish(): void {
    if (this.closed || this.states.some(state => !state.ready)) return;
    let frontier: Position | null = null;
    for (const state of this.open()) {
      if (!state.cursor) continue;
      const position = positionOfDoc(state.cursor);
      if (!frontier || comparePositions(position, frontier) < 0) {
        frontier = position;
      }
    }
    const merged = mergeSessions(this.states.map(state => state.loaded));
    const reached = frontier;
    this.stopRetrying?.();
    this.state = {
      sessions: reached
        ? merged.filter(
            session =>
              comparePositions(positionOfSession(session), reached) <= 0
          )
        : merged,
      read: merged,
      hasMore: this.open().length > 0,
      unread: this.open().flatMap(({ source }) =>
        source.name ? [source.name] : []
      ),
      completeAfter: reached
        ? new Date(reached.seconds * 1000 + reached.nanos / 1e6)
        : null,
      offline: false,
    };
    if (this.key !== undefined) remembered.set(this.key, this.state);
    this.onChange(this.state);
  }
}
