import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import { useSessionCore, useTheme, useAuth, useTeam } from '@/contexts';
import { firebaseService } from '@/services';
import {
  saveMatchEdit,
  matchEditFailure,
  newMatchId,
  type MatchEdit,
} from '@/services/matchEdits';
import {
  generateShareableLink,
  copyShareLink,
  calculateTotal,
  emptyScoringFields,
  pickScoringFields,
  isGuestSessionId,
  readGuestSessions,
  writeGuestSessions,
  robotsOf,
  DEFAULT_ROBOT_COUNT,
  isCurrentSeasonSession,
  matchScore,
  sessionMatchType,
  buildSessionsCsv,
  buildLegacySessionsCsv,
  csvFileName,
  downloadCsv,
  logger,
} from '@/lib';
import { readAllGuestSessions } from '@/lib/guestSessions';
import { filedUnderName, teamFiling, viewOnlyNote } from '@/lib/sessionAccess';
import { countShareLinks } from '@/lib/shareService';
import {
  APP_CONFIG,
  CURRENT_SEASON,
  ROUTES,
  STORAGE_KEYS,
  UI_TIMING,
} from '@/constants';
import { PAGE_CONTAINER } from '@/constants/layout';
import type {
  Match,
  Session,
  SessionFormData,
  SessionType,
  TimestampValue,
} from '@/types';
import { MatchForm } from '@/components';
import { RenameDialog } from '@/components/session/RenameDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ChevronDown,
  Plus,
  Link2,
  Link2Off,
  Check,
  Loader2,
  Download,
  Lock,
  LogIn,
  Pencil,
  RotateCw,
  Share2,
  WifiOff,
} from 'lucide-react';
import { PAGE_TITLE_CLASS } from '@/components/ui/page-header';
import { SignUpToShare } from './SignUpToShare';
import {
  SummaryTab,
  MatchDetailTab,
  CompareTab,
  AnalysisTabBar,
  LegacySeasonView,
  SessionMeta,
  SessionNotes,
  computeStats,
  tabButtonId,
  tabPanelId,
  useAnalysisNav,
} from '@/components/session/AnalysisTabs';

/** What a `sessionId` in the URL turned out to be */
interface LoadedSession {
  /** The session and the viewer this was loaded for */
  id: string;
  viewer: string | null;
  /** Null when the session doesn't exist or this viewer can't read it */
  session: SessionFormData | null;
  /** Author of a saved session; empty for a guest one */
  ownerId: string;
  /** As stored - absent on sessions saved before the type was recorded */
  sessionType?: SessionType;
  /**
   * When it was recorded and by whom, as stored. The form-shaped `session`
   * has no place for these, and a CSV export without them would date every
   * row today.
   */
  createdAt?: Session['createdAt'];
  userEmail?: string;
  /** The team it is filed under, as stored */
  teamId?: string;
  /** Season tag of a session recorded before this season, else null */
  legacySeason: string | null;
  /**
   * It couldn't be read at all (no connection), which says nothing about
   * whether it exists: the page offers to try again, not "not found".
   */
  failed?: boolean;
}

/** Shown while a session loads, and when it can't be: never someone else's. */
const EMPTY_SESSION: SessionFormData = {
  ...emptyScoringFields(),
  sessionName: '',
  sessionType: 'Practice',
  sessionDuration: '',
  matchType: '',
  isSessionCompleted: true,
  selectedFeature: '',
  notes: '',
  matches: [],
};

const MATCH_TYPES = ['Full Game', 'Autonomous', 'Teleop'];

/** The fields a saved session can be changed in from this page */
type SessionChanges = Partial<Pick<Session, 'sessionName' | 'notes'>>;

/**
 * How long saving a name or notes waits for the server before the page
 * shows the change anyway. Offline, Firestore holds the write until the
 * connection is back and only then says it landed, which can't be waited
 * out in a dialog.
 */
const SAVE_WAIT_MS = 2000;

/** Which Share button copied the link it says Copied for */
type CopiedFrom = 'button' | 'menu';

/** A row in the Share menu: big enough for a thumb, icon then text. */
const MENU_ITEM =
  'flex items-center gap-2 cursor-pointer [@media(pointer:coarse)]:min-h-11';

/** How many share links of the loaded session this viewer can take down */
interface ShareLinkCount {
  /** The session and viewer it was counted for */
  key: string;
  /** Null when they couldn't be counted (offline, say) */
  count: number | null;
}

const readSession = async (sessionId: string): Promise<Session | null> =>
  isGuestSessionId(sessionId)
    ? // Older-season guest sessions are hidden from every list but still
      // open by link, read-only.
      (readAllGuestSessions().find(s => s.id === sessionId) ?? null)
    : // Strict: offline is "couldn't load", never "not found"
      firebaseService.getSession(sessionId, true);

const toLoaded = (
  id: string,
  viewer: string | null,
  session: Session | null
): LoadedSession => ({
  id,
  viewer,
  // The scoring fields on a loaded session are only placeholders -
  // every figure on this page is aggregated from `matches`.
  session: session && {
    ...EMPTY_SESSION,
    sessionName: session.sessionName || '',
    sessionType: session.sessionType || 'Practice',
    sessionDuration: session.sessionDuration || '',
    matchType: session.matchType || '',
    selectedFeature: session.selectedFeature || '',
    notes: session.notes || '',
    matches: session.matches || [],
  },
  ownerId: session?.userId ?? '',
  sessionType: session?.sessionType,
  createdAt: session?.createdAt,
  userEmail: session?.userEmail,
  teamId: session?.teamId,
  legacySeason:
    session && !isCurrentSeasonSession(session)
      ? session.season || 'decode'
      : null,
});

const Analysis = () => {
  const { sessionData: contextSessionData } = useSessionCore();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { team, loading: teamLoading, unconfirmedTeamId } = useTeam();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const sessionId = searchParams.get('sessionId');
  const viewer = user?.uid ?? null;
  const [loaded, setLoaded] = useState<LoadedSession | null>(null);
  const { activeTab, setActiveTab, selectedIdx, setSelectedIdx, openMatch } =
    useAnalysisNav();
  const [isMatchFormOpen, setIsMatchFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  /** While Share says Copied: which of its buttons copied the link */
  const [copiedFrom, setCopiedFrom] = useState<CopiedFrom | null>(null);
  const linkCopied = copiedFrom !== null;
  /** A link is being copied: a second press waits for it */
  const copyingRef = useRef(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLinkCount | null>(null);
  /** Bumped to count the share links again after one is made */
  const [shareLinksTick, setShareLinksTick] = useState(0);
  /** Bumped by Try again, to read the session once more */
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isRenaming, setIsRenaming] = useState(false);
  /** A match delete is being written */
  const deletingRef = useRef(false);
  /** The Share button on screen (the plain one or the menu's) */
  const shareNodeRef = useRef<HTMLButtonElement | null>(null);
  /** It had the focus as it went: the one taking its place gets it */
  const shareFocusRef = useRef(false);

  /**
   * Both Share buttons. Share is a plain button until there is a link to
   * take down, then a menu's; when one takes the other's place with the
   * focus on it, the focus moves to the new one instead of to the page.
   * (A ref is let go while its button is still in the page.)
   */
  const shareButtonRef = useCallback((node: HTMLButtonElement | null) => {
    if (node) {
      if (shareFocusRef.current) node.focus();
      shareFocusRef.current = false;
    } else {
      shareFocusRef.current =
        !!shareNodeRef.current &&
        document.activeElement === shareNodeRef.current;
    }
    shareNodeRef.current = node;
  }, []);

  // Only what was loaded for the session in the URL, by this viewer, is ever
  // shown under that URL: a previous session's data must not linger under a
  // new id while (or after) the new one fails to load.
  const current =
    sessionId && loaded?.id === sessionId && loaded.viewer === viewer
      ? loaded
      : null;
  const loading = !!sessionId && !current;
  const loadFailed = !!current?.failed;
  const notFound = !!current && !current.session && !loadFailed;

  // Without a sessionId this is the session in progress on /active, which
  // has nowhere to save an edit to: it is shown read-only.
  const stateData = (location.state as { sessionData?: SessionFormData } | null)
    ?.sessionData;
  const sessionData = sessionId
    ? (current?.session ?? EMPTY_SESSION)
    : (stateData ?? contextSessionData);

  // Each session's tab and history entry carries its name, as a shared one
  // does; while it loads, or with none to show, the tab says Analysis.
  const pageName = sessionData.sessionName;
  useEffect(() => {
    document.title = `${pageName || 'Analysis'} - ${APP_CONFIG.name}`;
  }, [pageName]);
  const sessionType = sessionId
    ? current?.sessionType
    : sessionData.sessionType;
  const legacySeason = current?.legacySeason ?? null;
  const createdAt = current?.createdAt;

  const isGuestSession = !!sessionId && isGuestSessionId(sessionId);
  /**
   * Their own session filed under a team they are no longer in stays with
   * that team, view-only for them (see lib/sessionAccess)
   */
  const filing = current
    ? teamFiling(current, { teamId: team?.id, teamLoading, unconfirmedTeamId })
    : 'here';
  /**
   * A saved session this viewer may change: their own, in this season, not
   * left with a team they are no longer in
   */
  const canEdit =
    !!current?.session &&
    !legacySeason &&
    (isGuestSession ||
      (!!viewer && current.ownerId === viewer && filing === 'here'));
  /**
   * The saved session this page shows, needed to make a revocable share link
   * and to take its links down. Of any season: an older one can't be shared
   * from here, but the links made of it before still open.
   */
  const savedSession = useMemo(
    () =>
      current?.session && !isGuestSession
        ? { id: current.id, userId: current.ownerId }
        : null,
    [current, isGuestSession]
  );

  /**
   * The links Stop sharing would take down: undefined until they have been
   * counted for the session on screen, null when they couldn't be.
   */
  const shareKey =
    savedSession && viewer ? `${savedSession.id}|${viewer}` : null;
  const linkCount =
    shareKey && shareLinks?.key === shareKey ? shareLinks.count : undefined;

  // Counted with the session, and again whenever it is (re)loaded: links can
  // be made or taken down from Sessions, Profile or another device. The
  // server counts them, so that is one read however many links there are.
  useEffect(() => {
    if (!shareKey || !savedSession || !current?.session) return;
    let live = true;
    countShareLinks({
      ...savedSession,
      sessionName: current.session.sessionName,
      notes: current.session.notes,
      matches: current.session.matches,
    }).then(
      count => {
        if (live) setShareLinks({ key: shareKey, count });
      },
      error => {
        logger.warn('Could not count share links', { error: String(error) });
        if (live) setShareLinks({ key: shareKey, count: null });
      }
    );
    return () => {
      live = false;
    };
  }, [shareKey, savedSession, current, shareLinksTick]);

  // Matches saved without a type of their own ran as the session's type,
  // which decides which periods count toward their score.
  const sessionMatches = useMemo(() => {
    const fallback = sessionData.matchType;
    const matches = sessionData.matches ?? [];
    if (!MATCH_TYPES.includes(fallback)) return matches;
    return matches.map(m => (m.matchType ? m : { ...m, matchType: fallback }));
  }, [sessionData.matches, sessionData.matchType]);

  const stats = useMemo(
    () => (legacySeason ? null : computeStats(sessionMatches)),
    [sessionMatches, legacySeason]
  );

  /**
   * What a match added here starts as: the session's own match type (in a
   * Mixed session the last match's), and the robots its last match was
   * played with, so a run added to an Autonomous session for one robot is
   * one, unless changed in the form.
   */
  const lastMatch = sessionMatches[sessionMatches.length - 1];
  const newMatchType = MATCH_TYPES.includes(sessionData.matchType)
    ? sessionData.matchType
    : lastMatch?.matchType || 'Full Game';
  const newRobotCount = lastMatch ? robotsOf(lastMatch) : DEFAULT_ROBOT_COUNT;

  useEffect(() => {
    if (!sessionId) return;
    let mounted = true;

    const load = async (isRefresh: boolean) => {
      let session: Session | null = null;
      let failed = false;
      try {
        session = await readSession(sessionId);
      } catch (error) {
        // Not "not found": the read itself didn't get through
        logger.error('Error loading session', error);
        failed = true;
      }
      if (!mounted) return;
      // A refresh that comes back empty may only be a dropped connection,
      // which is no reason to take away what is already on screen.
      if (isRefresh && !session) return;
      setLoaded({ ...toLoaded(sessionId, viewer, session), failed });
    };

    load(false);

    // Another tab or device may have edited the session since: pick that up
    // when this tab is looked at again, or when a guest session changes.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(true);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.GUEST_SESSIONS) load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    if (isGuestSessionId(sessionId)) {
      window.addEventListener('storage', onStorage);
    }
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, [sessionId, viewer, loadAttempt]);

  /** Read the session again after it couldn't be read */
  const retryLoad = () => {
    setLoaded(null);
    setLoadAttempt(attempt => attempt + 1);
  };

  /**
   * Save a change to the stored session (its name or notes), show it and say
   * so with `savedMessage`. Resolves to whether the editor can close: false
   * when it wasn't saved (a toast says why), so what was typed stays.
   *
   * A write the server hasn't answered within SAVE_WAIT_MS (offline, or a
   * connection that slow) waits in Firestore for the connection, and can't
   * be called off: the change shows at once, a toast says it saves once the
   * connection is back, and another when it has. If the server turns it
   * down after all, the page goes back to what is stored.
   */
  const saveSessionChanges = async (
    changes: SessionChanges,
    what: string,
    savedMessage: string
  ): Promise<boolean> => {
    if (!sessionId || !canEdit) return false;
    /**
     * One toast per kind of change, each replacing the last (a toast put in
     * another's place keeps what it doesn't set, so each sets a description)
     */
    const toastId = `save-session-${what}`;
    const saved = () =>
      toast.success(savedMessage, { id: toastId, description: undefined });
    const failed = (error: unknown) => {
      logger.error(`Error saving ${what}`, error);
      toast.error(`Couldn't save the ${what}`, {
        id: toastId,
        description: matchEditFailure(error),
      });
    };
    const keys = Object.keys(changes) as (keyof SessionChanges)[];
    const before: SessionChanges = {};
    for (const key of keys) before[key] = current?.session?.[key];
    const show = (values: SessionChanges, onlyIf?: SessionChanges) =>
      setLoaded(prev => {
        if (!prev || prev.id !== sessionId || !prev.session) return prev;
        const session = { ...prev.session };
        for (const key of keys) {
          // Not over a change made since
          if (onlyIf && session[key] !== onlyIf[key]) continue;
          session[key] = values[key] ?? '';
        }
        return { ...prev, session };
      });

    if (isGuestSessionId(sessionId)) {
      try {
        const sessions = readGuestSessions();
        if (!sessions.some(s => s.id === sessionId)) {
          throw new Error('Session not found');
        }
        writeGuestSessions(
          sessions.map(s => (s.id === sessionId ? { ...s, ...changes } : s))
        );
      } catch (error) {
        failed(error);
        return false;
      }
      show(changes);
      saved();
      return true;
    }

    const write = firebaseService.updateSession(sessionId, changes).then(ok => {
      if (!ok) throw new Error('Not saved');
    });
    const answer = await Promise.race([
      write.then(() => 'saved' as const),
      new Promise<'waiting'>(resolve =>
        setTimeout(
          () => resolve('waiting'),
          navigator.onLine ? SAVE_WAIT_MS : 0
        )
      ),
    ]).catch((error: unknown) => {
      failed(error);
      return 'failed' as const;
    });
    if (answer === 'failed') return false;
    show(changes);
    if (answer === 'saved') {
      saved();
      return true;
    }
    toast.message(`The ${what} will save once the connection is back`, {
      id: toastId,
      description: `It shows here already. Keep ${APP_CONFIG.name} open until then.`,
    });
    write.then(saved, error => {
      show(before, changes);
      failed(error);
    });
    return true;
  };

  const handleSaveNotes = (notes: string) =>
    saveSessionChanges(
      { notes },
      'notes',
      notes ? 'Notes saved' : 'Notes removed'
    );

  const handleRename = (sessionName: string) =>
    saveSessionChanges({ sessionName }, 'name', `Renamed to ${sessionName}`);

  const handleCopyLink = useCallback(
    async (from: CopiedFrom) => {
      // Without a saved session the button is locked, with the reason beside it.
      if (!sessionData || !savedSession || copyingRef.current) return;
      copyingRef.current = true;
      setIsCopyingLink(true);
      try {
        const link = await generateShareableLink({
          ...savedSession,
          // Only this season's sessions are shared from here.
          season: CURRENT_SEASON,
          sessionName: sessionData.sessionName,
          sessionType,
          sessionDuration: sessionData.sessionDuration,
          createdAt,
          matchType: sessionData.matchType,
          selectedFeature: sessionData.selectedFeature,
          notes: sessionData.notes || '',
          matches: sessionData.matches || [],
        });
        await copyShareLink(link, () => {
          setCopiedFrom(from);
          toast.success('Share link copied', {
            // A link is a snapshot; one copied again unchanged is the same
            // link. Anyone with it reads the notes too, so it says so.
            description: sessionData.notes
              ? 'Shows the session as it is now, notes included. Copy again after edits.'
              : 'Shows the session as it is now. Copy again after edits.',
          });
          setTimeout(() => setCopiedFrom(null), 2500);
        });
        // It may be a new link: Stop sharing now has one more to take down.
        setShareLinksTick(tick => tick + 1);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to generate share link'
        );
      } finally {
        copyingRef.current = false;
        setIsCopyingLink(false);
      }
    },
    [sessionData, sessionType, createdAt, savedSession]
  );

  /**
   * Export just this session, through the same builder as the Sessions
   * page's export of its season (this season's list, or last season's), so
   * its rows are the ones that export has for it.
   */
  const handleExportSession = () => {
    if (sessionMatches.length === 0) {
      toast.error('No matches to export');
      return;
    }

    const sessionName = sessionData.sessionName || 'Untitled Session';
    const session: Session = {
      id: sessionId ?? '',
      userId: current?.ownerId ?? viewer ?? '',
      // A session still in progress has no stored author or date yet. A
      // saved one keeps what it has, even no date, as the list export does.
      userEmail: sessionId ? current?.userEmail : (user?.email ?? undefined),
      sessionName,
      sessionType,
      matchType: sessionData.matchType,
      sessionDuration: sessionData.sessionDuration,
      createdAt: sessionId ? (createdAt as TimestampValue) : new Date(),
      notes: sessionData.notes,
      matches: sessionData.matches ?? [],
      ...(legacySeason ? { season: legacySeason } : {}),
    };

    // A session from an earlier season goes out in that season's columns:
    // this season's would all be blank for it.
    downloadCsv(
      csvFileName(sessionName),
      legacySeason
        ? buildLegacySessionsCsv([session])
        : buildSessionsCsv([session])
    );
    toast.success(
      `Exported ${sessionMatches.length} match${sessionMatches.length === 1 ? '' : 'es'} to CSV`
    );
  };

  /** Take down the share links made from this session */
  const handleStopSharing = async () => {
    if (!savedSession) return;
    const isOwner = savedSession.userId === viewer;
    setIsRevoking(true);
    try {
      const count = await firebaseService.deleteSharedSessions(savedSession.id);
      if (shareKey) setShareLinks({ key: shareKey, count: 0 });
      if (count === 0) {
        toast.info(
          isOwner
            ? 'This session has no share links'
            : "You haven't shared this session"
        );
      } else {
        toast.success(
          `Removed ${count} share link${count === 1 ? '' : 's'}${isOwner ? '' : ' you made'}`,
          {
            description:
              count === 1
                ? 'It no longer opens for anyone.'
                : 'They no longer open for anyone.',
          }
        );
      }
    } catch (error) {
      logger.error('Error removing share links', error);
      toast.error('Failed to remove share links', {
        // Firestore errors carry a code; anything else is one of our own
        // messages, written to be shown.
        description:
          error instanceof Error && !('code' in error)
            ? error.message
            : undefined,
      });
    } finally {
      setIsRevoking(false);
    }
  };

  const handleAddMatch = () => {
    setEditingMatch(null);
    setIsMatchFormOpen(true);
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatch(match);
    setIsMatchFormOpen(true);
  };

  /**
   * Apply one edit to the stored session and show what was written. The edit
   * is made against the stored matches, not this page's copy of them.
   */
  const applyEdit = async (id: string, edit: MatchEdit) => {
    const result = await saveMatchEdit(id, edit);
    setLoaded(prev =>
      prev && prev.id === id && prev.session
        ? { ...prev, session: { ...prev.session, matches: result.matches } }
        : prev
    );
    return result;
  };

  const handleDeleteMatch = async (matchId: string) => {
    // One at a time: a second press while the first is being written would
    // find the match gone and say so with a toast of its own.
    if (!sessionId || !canEdit || deletingRef.current) return;
    deletingRef.current = true;

    setIsUpdating(true);
    try {
      const { removed } = await applyEdit(sessionId, {
        kind: 'delete',
        matchId,
      });

      // A delete with an Undo is news, not a success
      toast.message(
        removed
          ? `Match ${removed.match.matchNumber} deleted`
          : 'Match deleted',
        {
          duration: UI_TIMING.UNDO_WINDOW,
          action: removed && {
            label: 'Undo',
            onClick: async () => {
              try {
                await applyEdit(sessionId, { kind: 'restore', ...removed });
                setSelectedIdx(removed.index);
                toast.success(`Match ${removed.match.matchNumber} restored`);
              } catch (error) {
                logger.error('Error restoring match', error);
                toast.error('Failed to restore match', {
                  description: matchEditFailure(error),
                });
              }
            },
          },
        }
      );
    } catch (error) {
      logger.error('Error deleting match', error);
      toast.error('Failed to delete match', {
        description: matchEditFailure(error),
      });
    } finally {
      deletingRef.current = false;
      setIsUpdating(false);
    }
  };

  const handleSaveMatch = async (matchData: Partial<Match>) => {
    if (!sessionId || !canEdit) {
      toast.error("This session can't be edited from here");
      return;
    }

    setIsUpdating(true);
    try {
      if (editingMatch) {
        await applyEdit(sessionId, {
          kind: 'update',
          matchId: editingMatch.id,
          changes: matchData,
        });
        toast.success('Match updated successfully');
      } else {
        const matchId = newMatchId();
        const { matches } = await applyEdit(sessionId, {
          kind: 'add',
          match: {
            ...pickScoringFields(matchData),
            id: matchId,
            matchType: matchData.matchType || newMatchType,
            // The robots it was played with, which the scoring fields leave
            // out
            robotCount: matchData.robotCount ?? newRobotCount,
            finalScore: calculateTotal(matchData),
          },
        });
        // Show what was just added, and let a slip be taken straight back.
        const index = matches.findIndex(m => m.id === matchId);
        const added = matches[index];
        if (added) {
          setSelectedIdx(index);
          setActiveTab('matches');
          const points = matchScore(added, sessionData.matchType);
          toast.success(
            `Match ${added.matchNumber} added · ${points} ${points === 1 ? 'pt' : 'pts'}`,
            {
              duration: UI_TIMING.UNDO_WINDOW,
              action: {
                label: 'Undo',
                onClick: async () => {
                  try {
                    await applyEdit(sessionId, { kind: 'delete', matchId });
                    toast.message(`Match ${added.matchNumber} removed`);
                  } catch (error) {
                    logger.error('Error undoing added match', error);
                    toast.error('Failed to remove the match', {
                      description: matchEditFailure(error),
                    });
                  }
                },
              },
            }
          );
        }
      }
      setIsMatchFormOpen(false);
      setEditingMatch(null);
    } catch (error) {
      // The form stays open with what was typed, so it can be tried again.
      logger.error('Error saving match', error);
      toast.error('Failed to save match', {
        description: matchEditFailure(error),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`min-h-[100dvh] flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-blue"></div>
          <p className="text-sm text-team-blue">Loading session...</p>
        </div>
      </div>
    );
  }

  if (notFound || loadFailed) {
    /**
     * Why there is nothing to show. A session saved to an account or a team
     * only opens for someone signed in, which is the likeliest reason when
     * a link reaches someone who isn't; a read that didn't get through says
     * nothing about the session at all.
     */
    const signInFirst =
      !loadFailed && !user && !!sessionId && !isGuestSessionId(sessionId);
    const Icon = loadFailed ? WifiOff : signInFirst ? LogIn : AlertTriangle;
    const primary = `inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-team-blue text-sm font-medium hover:bg-team-blue/90 transition-colors ${isDarkMode ? 'text-black' : 'text-white'}`;
    const secondary =
      'inline-flex min-h-11 items-center justify-center px-3 text-sm font-medium text-team-blue underline underline-offset-4';
    return (
      <div
        className={`min-h-[100dvh] flex items-center justify-center p-6 ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div
          className={`max-w-md w-full rounded-2xl border p-8 text-center space-y-4 ${
            isDarkMode
              ? 'bg-team-dark-20 border-team-blue-40'
              : 'bg-white border-gray-200'
          }`}
        >
          <Icon
            size={40}
            aria-hidden
            className={`mx-auto ${signInFirst ? 'text-team-blue' : 'text-amber-500'}`}
          />
          <h1
            className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          >
            {loadFailed
              ? "Couldn't load this session"
              : signInFirst
                ? 'Sign in to open this session'
                : "Session not found or you don't have access"}
          </h1>
          <p
            className={`text-sm leading-relaxed ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            {loadFailed
              ? "The server couldn't be reached. Check your connection, then try again."
              : signInFirst
                ? 'Sessions saved to an account or a team open once you sign in with an account that can see them.'
                : 'It may have been deleted, saved in a different browser, or belong to a team you are no longer in.'}
          </p>
          {/* The view's one fill: the header's New Session steps back */}
          <div className="flex flex-col items-center gap-1">
            {loadFailed ? (
              <button
                type="button"
                onClick={retryLoad}
                data-page-primary
                className={primary}
              >
                <RotateCw size={16} aria-hidden />
                Try again
              </button>
            ) : signInFirst ? (
              <Link
                to={ROUTES.LOGIN}
                // Back here once signed in, with the session's id
                state={{ from: location }}
                data-page-primary
                className={primary}
              >
                Sign in
              </Link>
            ) : (
              <Link to={ROUTES.SESSIONS} data-page-primary className={primary}>
                Go to Sessions
              </Link>
            )}
            {(loadFailed || signInFirst) && (
              <Link to={ROUTES.SESSIONS} className={secondary}>
                Go to Sessions
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const matchTypeLabel =
    sessionMatches.length > 0
      ? sessionMatchType(sessionMatches, sessionData.matchType)
      : sessionData.matchType;
  /** Why the page has no edit controls, when the reason isn't obvious */
  const recorder =
    current && current.ownerId !== viewer
      ? (() => {
          const member = team?.members.find(m => m.userId === current.ownerId);
          return member?.displayName || member?.email || current.userEmail;
        })()
      : undefined;
  const readOnlyReason = canEdit
    ? null
    : legacySeason
      ? null
      : !sessionId
        ? 'Open this session from Sessions to edit its matches'
        : current && current.ownerId === viewer
          ? filing === 'elsewhere'
            ? viewOnlyNote(filedUnderName(current))
            : null
          : recorder
            ? `Recorded by ${recorder}, view only`
            : 'Recorded by a teammate, view only';
  const badgeClass = `inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
    isDarkMode ? 'bg-white/10 text-team-white-60' : 'bg-gray-100 text-gray-600'
  }`;
  const canShare = sessionMatches.length > 0 && !legacySeason;
  // An older session is exported in its own season's columns.
  const canExport = sessionMatches.length > 0;
  /** Sharing makes a link to a session saved to an account */
  const shareLocked = canShare && !savedSession;
  const canCopyLink = canShare && !shareLocked;
  /**
   * Only when there are links to take down, or when they couldn't be counted
   * (taking them down then says whether there were any).
   */
  const canStopSharing =
    !!savedSession && (linkCount === null || (linkCount ?? 0) > 0);
  const showShare = canCopyLink || canStopSharing;
  /**
   * Share as a menu (Copy link, Stop sharing). The plain button that just
   * copied the first link stays itself while it says Copied, and only then
   * makes way for the menu's.
   */
  const shareAsMenu = canStopSharing && copiedFrom !== 'button';
  /** Header actions: one height, 44 px, at every width */
  const actionButton =
    'inline-flex h-11 items-center justify-center rounded-xl border text-sm font-medium transition-colors';
  const hasTabs = !legacySeason && sessionMatches.length > 0;
  const quietButton = isDarkMode
    ? 'border-team-blue-40 bg-team-dark-20 text-team-white-60 hover:text-white hover:border-team-blue'
    : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-team-blue';
  const lockLineColor = isDarkMode ? 'text-team-white-60' : 'text-gray-600';
  const copiedButton = isDarkMode
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
    : 'border-emerald-300 bg-emerald-50 text-emerald-700';
  const shareIcon = isCopyingLink ? (
    <Loader2 size={15} className="animate-spin" />
  ) : linkCopied ? (
    <Check size={15} />
  ) : (
    <Share2 size={15} />
  );
  /**
   * One button whatever it says, as wide as its longest label: nothing
   * beside it moves when it says Copied
   */
  const shareLabel = (
    <span className="inline-grid">
      <span className={`[grid-area:1/1] ${linkCopied ? 'invisible' : ''}`}>
        Share
      </span>
      <span className={`[grid-area:1/1] ${linkCopied ? '' : 'invisible'}`}>
        Copied
      </span>
    </span>
  );

  return (
    <div
      className={`min-h-[100dvh] ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      {/* The header's column, so their ends line up at every width */}
      <div className={`${PAGE_CONTAINER} py-6 sm:py-10 space-y-5 sm:space-y-6`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="space-y-2 min-w-0 sm:flex-1">
            {legacySeason && (
              <div
                className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${
                  isDarkMode
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {legacySeason.toUpperCase()} season
              </div>
            )}
            {/* The name, and for its owner a way to change it */}
            <div className="flex items-start gap-1">
              <h1 className={`${PAGE_TITLE_CLASS} min-w-0 break-words`}>
                {sessionData.sessionName || 'Session'}
              </h1>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsRenaming(true)}
                  aria-label="Rename session"
                  title="Rename session"
                  className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 ${
                    isDarkMode
                      ? 'text-team-white-60 hover:text-white hover:bg-white/5'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Pencil size={16} aria-hidden />
                </button>
              )}
            </div>
            <SessionMeta
              sessionType={legacySeason ? undefined : sessionType}
              matchType={matchTypeLabel}
              createdAt={createdAt}
              matchCount={sessionMatches.length}
              duration={sessionData.sessionDuration}
              isDarkMode={isDarkMode}
            />
            {readOnlyReason && sessionMatches.length > 0 && (
              <div className={badgeClass}>{readOnlyReason}</div>
            )}
          </div>

          {/* A link outlives what it was made from: it can be taken down
              whatever the session's season, and with no matches left in it. */}
          {(showShare || shareLocked || canExport) && (
            <div className="flex items-center gap-3 sm:shrink-0 sm:justify-end">
              {/* The reason sharing is locked, beside Export */}
              {shareLocked &&
                (user ? (
                  <p
                    className={`min-w-0 flex-1 text-sm sm:max-w-xs sm:flex-none sm:text-right ${lockLineColor}`}
                  >
                    <Lock
                      size={14}
                      aria-hidden
                      className="inline-block align-[-2px] mr-1.5"
                    />
                    Open this session from{' '}
                    <Link
                      to={ROUTES.SESSIONS}
                      className="inline-flex items-center font-semibold text-team-blue underline underline-offset-4 [@media(pointer:coarse)]:min-h-11"
                    >
                      Sessions
                    </Link>{' '}
                    to share it
                  </p>
                ) : (
                  // Steps aside while the guest backup bar says the same
                  <SignUpToShare
                    lock
                    endFromSm
                    data-hide-under-guest-prompt
                    className={`min-w-0 flex-1 text-sm sm:max-w-xs sm:flex-none ${lockLineColor}`}
                  />
                ))}
              {/* With no link to take down yet, Share copies one at once.
                  Never disabled while it copies: that would drop the focus. */}
              {showShare && !shareAsMenu && (
                <button
                  ref={shareButtonRef}
                  type="button"
                  onClick={() => void handleCopyLink('button')}
                  aria-disabled={isCopyingLink || undefined}
                  aria-busy={isCopyingLink}
                  title="Copy a link anyone can open"
                  className={`${actionButton} gap-2 px-4 ${
                    linkCopied ? copiedButton : quietButton
                  }`}
                >
                  {shareIcon}
                  {shareLabel}
                </button>
              )}
              {showShare && shareAsMenu && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {/* One button whatever it says, as wide as its longest
                        label: nothing beside it moves when it says Copied */}
                    <button
                      ref={shareButtonRef}
                      type="button"
                      aria-busy={isCopyingLink}
                      className={`${actionButton} gap-2 px-4 ${
                        linkCopied ? copiedButton : quietButton
                      }`}
                    >
                      {shareIcon}
                      {shareLabel}
                      <ChevronDown size={15} aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    // Clear of the screen edge when the button is at the left
                    collisionPadding={16}
                    className="min-w-[200px]"
                  >
                    {canCopyLink && (
                      <DropdownMenuItem
                        disabled={isCopyingLink}
                        onSelect={() => void handleCopyLink('menu')}
                        className={MENU_ITEM}
                      >
                        <Link2 className="h-4 w-4" />
                        <span>Copy link</span>
                      </DropdownMenuItem>
                    )}
                    {canCopyLink && canStopSharing && <DropdownMenuSeparator />}
                    {canStopSharing && (
                      <DropdownMenuItem
                        disabled={isRevoking}
                        onSelect={handleStopSharing}
                        className={`${MENU_ITEM} text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400`}
                      >
                        {isRevoking ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Link2Off className="h-4 w-4" />
                        )}
                        <span>
                          {linkCount
                            ? `Stop sharing (${linkCount} link${linkCount === 1 ? '' : 's'})`
                            : 'Stop sharing'}
                        </span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {canExport && (
                <button
                  type="button"
                  onClick={handleExportSession}
                  aria-label="Export CSV"
                  title="Export this session's matches as CSV"
                  className={`${actionButton} w-11 shrink-0 ${quietButton}`}
                >
                  <Download size={16} aria-hidden />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Without tabs there are no charts for the notes to wait behind */}
        {!hasTabs && !legacySeason && (
          <SessionNotes
            notes={sessionData.notes}
            isDarkMode={isDarkMode}
            onSave={canEdit ? handleSaveNotes : undefined}
          />
        )}
        {legacySeason && sessionData.notes && (
          <SessionNotes notes={sessionData.notes} isDarkMode={isDarkMode} />
        )}

        {legacySeason && (
          <LegacySeasonView
            matches={sessionMatches}
            season={legacySeason}
            isDarkMode={isDarkMode}
          />
        )}

        {hasTabs && (
          <>
            <AnalysisTabBar
              active={activeTab}
              onChange={setActiveTab}
              isDarkMode={isDarkMode}
            />

            <div
              role="tabpanel"
              id={tabPanelId(activeTab)}
              aria-labelledby={tabButtonId(activeTab)}
            >
              {activeTab === 'summary' && stats && (
                <SummaryTab
                  matches={sessionMatches}
                  stats={stats}
                  isDarkMode={isDarkMode}
                  sessionType={sessionType}
                  onOpenMatch={openMatch}
                />
              )}
              {activeTab === 'matches' && (
                <MatchDetailTab
                  matches={sessionMatches}
                  isDarkMode={isDarkMode}
                  sessionType={sessionType}
                  selectedIdx={selectedIdx}
                  onSelect={setSelectedIdx}
                  // No handlers means no buttons: a session this viewer
                  // can't change shows no controls that would only fail.
                  onEdit={canEdit ? handleEditMatch : undefined}
                  onDelete={canEdit ? handleDeleteMatch : undefined}
                  onAdd={canEdit ? handleAddMatch : undefined}
                />
              )}
              {activeTab === 'compare' && (
                <CompareTab
                  matches={sessionMatches}
                  isDarkMode={isDarkMode}
                  sessionType={sessionType}
                />
              )}
            </div>

            {/* Under the charts, three lines at first */}
            {activeTab === 'summary' && (
              <SessionNotes
                notes={sessionData.notes}
                isDarkMode={isDarkMode}
                clamp
                onSave={canEdit ? handleSaveNotes : undefined}
              />
            )}
          </>
        )}

        {!legacySeason && sessionMatches.length === 0 && (
          <div
            className={`text-center py-16 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-gray-50'}`}
          >
            <BarChart3
              size={40}
              className={`mx-auto mb-3 ${isDarkMode ? 'text-team-white-60' : 'text-gray-400'}`}
            />
            <p
              className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              No matches recorded yet
            </p>
            {canEdit ? (
              <button
                onClick={handleAddMatch}
                // The view's one fill: the header's New Session steps back
                data-page-primary
                className={`px-6 py-2.5 rounded-xl bg-team-blue text-sm font-medium hover:bg-team-blue/90 transition-colors inline-flex items-center gap-2 ${isDarkMode ? 'text-black' : 'text-white'}`}
              >
                <Plus size={18} />
                {/* An empty session's first match is always Match 1 */}
                Add Match 1
              </button>
            ) : (
              !sessionId && (
                <Link
                  to={ROUTES.SESSIONS}
                  className="inline-flex items-center text-sm font-medium text-team-blue underline underline-offset-4 [@media(pointer:coarse)]:min-h-11"
                >
                  Open a session from Sessions
                </Link>
              )
            )}
          </div>
        )}

        {/* A way on, kept quiet: the page's one filled button is its own */}
        <div className="flex justify-center pt-2">
          <Link
            to={ROUTES.CHARTS}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-team-blue underline-offset-4 hover:underline"
          >
            Lifetime charts
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>

      {canEdit && (
        <MatchForm
          isOpen={isMatchFormOpen}
          onClose={() => {
            setIsMatchFormOpen(false);
            setEditingMatch(null);
          }}
          onSave={handleSaveMatch}
          initialMatch={editingMatch || undefined}
          isLoading={isUpdating}
          sessionType={sessionType}
          defaultMatchType={newMatchType}
          defaultRobotCount={newRobotCount}
        />
      )}

      {isRenaming && canEdit && (
        <RenameDialog
          name={sessionData.sessionName}
          onSave={handleRename}
          onClose={() => setIsRenaming(false)}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};

export default Analysis;
