/**
 * The signed-in user's session list (their team's, in a team), read a page
 * at a time, newest first — or this browser's guest sessions, all at once.
 * What Sessions, Charts and Compare list.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth, useTeam } from '@/contexts';
import { firebaseService } from '@/services';
import { OWN_SESSIONS } from '@/services/firebaseService';
import type { SessionFeed, SessionFeedState } from '@/services/sessionFeed';
import { failureReason, isAbortError, logger, readGuestSessions } from '@/lib';
import { onSessionDeleted } from '@/lib/pendingSessionDeletes';
import { UI_TIMING } from '@/constants';
import type { Session } from '@/types';

export interface SessionList {
  /**
   * Newest first, and without gaps: older sessions not read yet all come
   * after the last one. Sessions waiting out a delete's undo window are
   * still in it.
   */
  sessions: Session[];
  /**
   * Every session read so far: `sessions` and any held back from it until
   * the ones dated between them are read too
   */
  sessionsRead: Session[];
  /** The first page is on its way */
  loading: boolean;
  /** The list couldn't be read, so an empty one doesn't mean "no sessions" */
  loadFailed: boolean;
  /**
   * The server can't be reached: the list is as it was last read in this
   * visit (or, with `loadFailed`, couldn't be read at all), and it is read
   * again by itself once the connection is back.
   */
  offline: boolean;
  /** Older sessions exist that aren't in `sessions` yet */
  hasMore: boolean;
  /**
   * Some of the user's own sessions may not be read yet: in a team, ones
   * not filed under it can be missing from `sessionsRead`
   */
  ownUnread: boolean;
  /** Older sessions are being read */
  loadingOlder: boolean;
  /**
   * The last read of older sessions failed (and said so): nothing reads
   * them again by itself until asked to.
   */
  olderFailed: boolean;
  /** Every session recorded after this is in the list; null once all are */
  completeAfter: Date | null;
  /** Read about one page further back */
  loadOlder: () => Promise<void>;
  /**
   * Read every session not read yet. Resolves with the whole list, or null
   * when it couldn't be read (which a toast has said).
   */
  loadAll: () => Promise<Session[] | null>;
  /** Change the sessions in the list, as this page has just changed them */
  patch: (change: (sessions: Session[]) => Session[]) => void;
  /** Read the list again from its newest page */
  reload: () => void;
}

/** How often a list that couldn't be read offline tries again */
const OFFLINE_RETRY_MS = 15_000;

const EMPTY: SessionFeedState = {
  sessions: [],
  read: [],
  hasMore: false,
  unread: [],
  completeAfter: null,
  offline: false,
};

/** Whether a failed read failed for want of a connection. */
const isOfflineError = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === 'unavailable' ||
  navigator.onLine === false;

/**
 * `live` keeps a team's list in step with the server while it is open
 * (teammates' new sessions arrive by themselves); a personal list, and any
 * list without `live`, is read once.
 */
export const useSessionList = ({
  live = false,
}: { live?: boolean } = {}): SessionList => {
  const { user, isGuest } = useAuth();
  const { team, loading: teamLoading, refreshTeam } = useTeam();
  const [list, setList] = useState<SessionFeedState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  /** The list failed because the server couldn't be reached */
  const [failedOffline, setFailedOffline] = useState(false);
  const [olderReads, setOlderReads] = useState(0);
  const [olderFailed, setOlderFailed] = useState(false);
  const [reloads, setReloads] = useState(0);
  const feedRef = useRef<SessionFeed | null>(null);
  /**
   * The next read is a try at a list that couldn't be read offline: the
   * page keeps saying so meanwhile, rather than going back to loading.
   */
  const quietRetry = useRef(false);

  // Which list to read is only known once the team is: read before then,
  // a team member's list would be read twice, the personal one first.
  const [teamSettled, setTeamSettled] = useState(!teamLoading);
  useEffect(() => {
    if (!teamLoading) setTeamSettled(true);
  }, [teamLoading]);

  const uid = user?.uid;
  const teamId = isGuest ? undefined : team?.id;
  const following = live && !!teamId;

  /** The latest refreshTeam, for a listener that outlives its render. */
  const refreshTeamRef = useRef(refreshTeam);
  useEffect(() => {
    refreshTeamRef.current = refreshTeam;
  }, [refreshTeam]);

  useEffect(() => {
    // A guest's sessions live in this browser.
    if (isGuest) {
      const guestSessions = readGuestSessions();
      setList({ ...EMPTY, sessions: guestSessions, read: guestSessions });
      setLoadFailed(false);
      setLoading(false);
      return;
    }
    if (!uid || !teamSettled) return;

    let active = true;
    let feed: SessionFeed | null = null;
    let received = false;
    let deniedNotice: ReturnType<typeof setTimeout> | undefined;
    const quiet = quietRetry.current;
    quietRetry.current = false;
    if (!quiet) setLoading(true);
    setOlderReads(0);
    setOlderFailed(false);

    const show = (state: SessionFeedState) => {
      if (!active) return;
      received = true;
      setList(state);
      setLoadFailed(false);
      setFailedOffline(false);
      setLoading(false);
    };
    const fail = (offline = false) => {
      if (!active) return;
      setLoadFailed(true);
      setFailedOffline(offline);
      setLoading(false);
    };
    const open = async (follow: boolean) => {
      const opened = await firebaseService.openSessionFeed(
        { uid, teamId, live: follow },
        show,
        follow ? onLiveError : undefined
      );
      if (!active) {
        opened.close();
        return null;
      }
      feed?.close();
      feed = opened;
      feedRef.current = opened;
      return opened;
    };

    const syncFailed = () =>
      toast.error(
        "Couldn't sync your team's sessions. Check your connection and reload."
      );

    async function onLiveError(error: Error) {
      // A listener this effect has already let go of has nothing to say.
      if (!active) return;
      logger.error('Team sessions listener error:', { error: String(error) });

      // Offline with nothing read yet: the page says so, and the list is
      // read again once the connection is back (see below).
      if (!received && isOfflineError(error)) {
        fail(true);
        return;
      }

      if ((error as { code?: string } | null)?.code === 'permission-denied') {
        // Almost always means the user is no longer in this team (removed,
        // or left on another device). Re-checking membership clears the
        // stale team and says so, which tears this effect down and loads
        // the personal list. If the team is still here a moment later,
        // they are a member after all and the list just couldn't load.
        await refreshTeamRef.current();
        deniedNotice = setTimeout(() => {
          if (!active) return;
          syncFailed();
          fail();
        }, UI_TIMING.SHORT_DELAY);
        return;
      }

      if ((error?.message || '').includes('index')) {
        // A deploy without the team-sessions index: the link to create it is
        // in Firestore's own message, logged above; the user can only wait.
        toast.error("Couldn't load your team's sessions", {
          description: 'Try again later.',
        });
      } else {
        syncFailed();
      }
      if (received) return;
      // Never got a list from the listener: read it once instead.
      try {
        await (
          await open(false)
        )?.ready;
      } catch {
        fail();
      }
    }

    (async () => {
      try {
        await (
          await open(following)
        )?.ready;
      } catch (error) {
        // A followed list reports its failures to onLiveError.
        if (following || !active || isAbortError(error)) return;
        logger.error('Error loading sessions', error);
        if (isOfflineError(error)) {
          // Said once, not on every try; read again once back online
          if (!quiet) {
            toast.error("Can't load your sessions while offline", {
              id: 'sessions-offline',
              description: 'They load by themselves once you are back online.',
            });
          }
          fail(true);
          return;
        }
        toast.error("Couldn't load your sessions", {
          description: failureReason(error, { reading: true }),
        });
        fail();
      }
    })();

    return () => {
      active = false;
      clearTimeout(deniedNotice);
      feed?.close();
      if (feedRef.current === feed) feedRef.current = null;
    };
  }, [uid, teamId, isGuest, following, teamSettled, reloads]);

  const patch = useCallback((change: (sessions: Session[]) => Session[]) => {
    // A feed reports the change back through onChange.
    if (feedRef.current) feedRef.current.patch(change);
    else
      setList(prev => ({
        ...prev,
        sessions: change(prev.sessions),
        read: change(prev.read),
      }));
  }, []);

  useEffect(
    () =>
      onSessionDeleted(sessionId =>
        patch(sessions => sessions.filter(s => s.id !== sessionId))
      ),
    [patch]
  );

  /** Run a read of older sessions, saying so if it fails. */
  const readOlder = useCallback(
    async (
      read: (feed: SessionFeed) => Promise<SessionFeedState>
    ): Promise<Session[] | null> => {
      const feed = feedRef.current;
      if (!feed) return null;
      setOlderReads(n => n + 1);
      setOlderFailed(false);
      try {
        return (await read(feed)).sessions;
      } catch (error) {
        if (feedRef.current === feed && !isAbortError(error)) {
          logger.error('Error loading older sessions', error);
          toast.error(
            "Couldn't load older sessions. Check your connection and try again."
          );
          setOlderFailed(true);
        }
        return null;
      } finally {
        setOlderReads(n => Math.max(0, n - 1));
      }
    },
    []
  );

  const loadOlder = useCallback(async () => {
    await readOlder(feed => feed.loadOlder());
  }, [readOlder]);

  const loadAll = useCallback(
    async (): Promise<Session[] | null> =>
      // A guest's list is whole already.
      feedRef.current ? readOlder(feed => feed.loadAll()) : list.sessions,
    [readOlder, list.sessions]
  );

  const reload = useCallback(() => setReloads(n => n + 1), []);

  // A list that couldn't be read for want of a connection is read again
  // once the connection is back: when the browser says so, or every so
  // often (on a venue's Wi-Fi it can say "online" with no way out).
  useEffect(() => {
    if (!loadFailed || !failedOffline) return;
    const retry = () => {
      if (navigator.onLine === false) return;
      quietRetry.current = true;
      reload();
    };
    const timer = setInterval(retry, OFFLINE_RETRY_MS);
    window.addEventListener('online', retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', retry);
    };
  }, [loadFailed, failedOffline, reload]);

  return {
    sessions: list.sessions,
    sessionsRead: list.read,
    loading,
    loadFailed,
    offline: list.offline || (loadFailed && failedOffline),
    hasMore: list.hasMore,
    ownUnread: list.unread.includes(OWN_SESSIONS),
    loadingOlder: olderReads > 0,
    olderFailed,
    completeAfter: list.completeAfter,
    loadOlder,
    loadAll,
    patch,
    reload,
  };
};
