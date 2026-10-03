import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import { useSessionCore, useTheme, useAuth } from '@/contexts';
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
  sanitizeHtml,
  calculateTotal,
  emptyScoringFields,
  pickScoringFields,
  isGuestSessionId,
  isCurrentSeasonSession,
  sessionMatchType,
  logger,
} from '@/lib';
import { readAllGuestSessions } from '@/lib/guestSessions';
import { APP_CONFIG, ROUTES, STORAGE_KEYS, UI_TIMING } from '@/constants';
import type { Match, Session, SessionFormData, SessionType } from '@/types';
import { MatchForm } from '@/components';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BarChart3,
  Plus,
  Link2,
  Link2Off,
  Check,
  Loader2,
} from 'lucide-react';
import {
  SummaryTab,
  MatchDetailTab,
  CompareTab,
  StatCard,
  AnalysisTabBar,
  LegacySeasonView,
  computeStats,
  tabButtonId,
  tabPanelId,
  type TabId,
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
  /** Season tag of a session recorded before this season, else null */
  legacySeason: string | null;
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

const readSession = async (sessionId: string): Promise<Session | null> =>
  isGuestSessionId(sessionId)
    ? // Older-season guest sessions are hidden from every list but still
      // open by link, read-only.
      (readAllGuestSessions().find(s => s.id === sessionId) ?? null)
    : firebaseService.getSession(sessionId);

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
  legacySeason:
    session && !isCurrentSeasonSession(session)
      ? session.season || 'decode'
      : null,
});

const Analysis = () => {
  const { sessionData: contextSessionData } = useSessionCore();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const sessionId = searchParams.get('sessionId');
  const viewer = user?.uid ?? null;
  const [loaded, setLoaded] = useState<LoadedSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [isMatchFormOpen, setIsMatchFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    document.title = `Analysis - ${APP_CONFIG.name}`;
  }, []);

  // Only what was loaded for the session in the URL, by this viewer, is ever
  // shown under that URL: a previous session's data must not linger under a
  // new id while (or after) the new one fails to load.
  const current =
    sessionId && loaded?.id === sessionId && loaded.viewer === viewer
      ? loaded
      : null;
  const loading = !!sessionId && !current;
  const notFound = !!current && !current.session;

  // Without a sessionId this is the session in progress on /active, which
  // has nowhere to save an edit to: it is shown read-only.
  const stateData = (location.state as { sessionData?: SessionFormData } | null)
    ?.sessionData;
  const sessionData = sessionId
    ? (current?.session ?? EMPTY_SESSION)
    : (stateData ?? contextSessionData);
  const sessionType = sessionId
    ? current?.sessionType
    : sessionData.sessionType;
  const legacySeason = current?.legacySeason ?? null;

  const isGuestSession = !!sessionId && isGuestSessionId(sessionId);
  /** A saved session this viewer may change: their own, in this season */
  const canEdit =
    !!current?.session &&
    !legacySeason &&
    (isGuestSession || (!!viewer && current.ownerId === viewer));
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

  useEffect(() => {
    if (!sessionId) return;
    let mounted = true;

    const load = async (isRefresh: boolean) => {
      let session: Session | null = null;
      try {
        session = await readSession(sessionId);
      } catch (error) {
        logger.error('Error loading session', error);
      }
      if (!mounted) return;
      // A refresh that comes back empty may only be a dropped connection,
      // which is no reason to take away what is already on screen.
      if (isRefresh && !session) return;
      setLoaded(toLoaded(sessionId, viewer, session));
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
  }, [sessionId, viewer]);

  const handleCopyLink = useCallback(async () => {
    if (!sessionData) return;
    if (!savedSession) {
      toast.error(
        user
          ? 'Open this session from My Sessions to share it'
          : 'Create an account to share sessions'
      );
      return;
    }
    setIsCopyingLink(true);
    try {
      const link = await generateShareableLink({
        ...savedSession,
        sessionName: sessionData.sessionName,
        sessionType,
        sessionDuration: sessionData.sessionDuration,
        matchType: sessionData.matchType,
        selectedFeature: sessionData.selectedFeature,
        notes: sessionData.notes || '',
        matches: sessionData.matches || [],
      });
      await copyShareLink(link, () => {
        setLinkCopied(true);
        toast.success('Share link copied to clipboard!');
        setTimeout(() => setLinkCopied(false), 2500);
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to generate share link'
      );
    } finally {
      setIsCopyingLink(false);
    }
  }, [sessionData, sessionType, savedSession, user]);

  /** Take down the share links made from this session */
  const handleStopSharing = async () => {
    if (!savedSession) return;
    const isOwner = savedSession.userId === viewer;
    setIsRevoking(true);
    try {
      const count = await firebaseService.deleteSharedSessions(savedSession.id);
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
    if (!sessionId || !canEdit) return;

    setIsUpdating(true);
    try {
      const { removed } = await applyEdit(sessionId, {
        kind: 'delete',
        matchId,
      });

      toast.success('Match deleted', {
        duration: UI_TIMING.UNDO_WINDOW,
        action: removed && {
          label: 'Undo',
          onClick: async () => {
            try {
              await applyEdit(sessionId, { kind: 'restore', ...removed });
              toast.success('Match restored');
            } catch (error) {
              logger.error('Error restoring match', error);
              toast.error('Failed to restore match', {
                description: matchEditFailure(error),
              });
            }
          },
        },
      });
    } catch (error) {
      logger.error('Error deleting match', error);
      toast.error('Failed to delete match', {
        description: matchEditFailure(error),
      });
    } finally {
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
      await applyEdit(
        sessionId,
        editingMatch
          ? { kind: 'update', matchId: editingMatch.id, changes: matchData }
          : {
              kind: 'add',
              match: {
                ...pickScoringFields(matchData),
                id: newMatchId(),
                matchType: matchData.matchType || 'Full Game',
                finalScore: calculateTotal(matchData),
              },
            }
      );

      toast.success(
        editingMatch ? 'Match updated successfully' : 'Match added successfully'
      );
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

  if (notFound) {
    return (
      <div
        className={`min-h-[100dvh] flex items-center justify-center p-6 ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div
          className={`max-w-md w-full rounded-2xl p-8 text-center space-y-4 ${
            isDarkMode ? 'bg-white/[0.035]' : 'bg-gray-100/80'
          }`}
        >
          <AlertTriangle size={40} className="mx-auto text-amber-500" />
          <h1
            className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          >
            Session not found or you don't have access
          </h1>
          <p
            className={`text-sm leading-relaxed ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            It may have been deleted, saved in a different browser, or belong to
            a team you are no longer in.
          </p>
          <Link
            to={ROUTES.SESSIONS}
            className={`inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-team-blue text-sm font-medium hover:bg-team-blue/90 transition-colors ${isDarkMode ? 'text-black' : 'text-white'}`}
          >
            Go to My Sessions
          </Link>
        </div>
      </div>
    );
  }

  const matchCount = `${sessionMatches.length} match${sessionMatches.length === 1 ? '' : 'es'}`;
  const matchTypeLabel =
    sessionMatches.length > 0
      ? sessionMatchType(sessionMatches, sessionData.matchType)
      : sessionData.matchType;
  /** Why the page has no edit controls, when the reason isn't obvious */
  const readOnlyReason = canEdit
    ? null
    : legacySeason
      ? null
      : !sessionId
        ? 'Open this session from My Sessions to edit its matches'
        : 'View only - recorded by a teammate';
  const badgeClass = `inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
    isDarkMode ? 'bg-white/10 text-team-white-60' : 'bg-gray-100 text-gray-600'
  }`;
  const canShare = sessionMatches.length > 0 && !legacySeason;

  return (
    <div
      className={`min-h-[100dvh] ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1152px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2 min-w-0">
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
            <h1 className="text-team-blue text-3xl sm:text-4xl font-bold leading-tight break-words [overflow-wrap:anywhere] min-w-0">
              {sessionData.sessionName || 'Session'} Analysis
            </h1>
            <div
              className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              {sessionType && !legacySeason && <span>{sessionType}</span>}
              {matchTypeLabel && <span>{matchTypeLabel}</span>}
              {sessionData.sessionDuration && (
                <span>{sessionData.sessionDuration}</span>
              )}
              <span>{matchCount}</span>
            </div>
            {readOnlyReason && sessionMatches.length > 0 && (
              <div className={badgeClass}>{readOnlyReason}</div>
            )}
          </div>

          {/* A link outlives what it was made from: it can be taken down
              whatever the session's season, and with no matches left in it. */}
          {(canShare || savedSession) && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {canShare && (
                <button
                  onClick={handleCopyLink}
                  disabled={isCopyingLink}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    linkCopied
                      ? isDarkMode
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : isDarkMode
                        ? 'border-team-blue-40 bg-team-dark-20 text-team-white-60 hover:text-white hover:border-team-blue'
                        : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-team-blue'
                  }`}
                >
                  {isCopyingLink ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : linkCopied ? (
                    <Check size={15} />
                  ) : (
                    <Link2 size={15} />
                  )}
                  {linkCopied ? 'Copied!' : 'Copy Share Link'}
                </button>
              )}
              {savedSession && (
                <button
                  onClick={handleStopSharing}
                  disabled={isRevoking}
                  title="Remove the share links made from this session"
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    isDarkMode
                      ? 'border-team-blue-40 bg-team-dark-20 text-team-white-60 hover:text-white hover:border-team-blue'
                      : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-team-blue'
                  }`}
                >
                  {isRevoking ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Link2Off size={15} />
                  )}
                  Stop sharing
                </button>
              )}
            </div>
          )}
        </div>

        {/*
          The Summary tab opens with the same average and best figures, so
          the overview only shows where that tab doesn't (older seasons).
        */}
        {stats && legacySeason && (
          <div className="space-y-3">
            <h2
              className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              Session Overview
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label="Avg Score"
                value={stats.avgScore}
                sublabel={matchCount}
                isDarkMode={isDarkMode}
              />
              <StatCard
                label="Best Score"
                value={stats.maxScore}
                sublabel={`Match ${sessionMatches[stats.bestMatch]?.matchNumber ?? ''}`}
                variant="success"
                isDarkMode={isDarkMode}
              />
              <StatCard
                label="Worst Score"
                value={stats.minScore}
                sublabel={`Match ${sessionMatches[stats.worstMatch]?.matchNumber ?? ''}`}
                variant="danger"
                isDarkMode={isDarkMode}
              />
            </div>
          </div>
        )}

        {sessionData.notes && (
          <div
            className={`rounded-2xl p-5 ${isDarkMode ? 'bg-white/[0.035]' : 'bg-gray-100/80'}`}
          >
            <h3
              className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              Notes
            </h3>
            {/* contain:paint keeps whatever the notes hold inside this box */}
            <div
              className={`[contain:paint] relative overflow-hidden text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${isDarkMode ? "text-team-white-60 [&_[style*='background-color']]:text-black" : 'text-gray-600'} [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5`}
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(sessionData.notes),
              }}
            />
          </div>
        )}

        {legacySeason && (
          <LegacySeasonView
            matches={sessionMatches}
            season={legacySeason}
            isDarkMode={isDarkMode}
          />
        )}

        {!legacySeason && sessionMatches.length > 0 && (
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
                />
              )}
              {activeTab === 'matches' && (
                <MatchDetailTab
                  matches={sessionMatches}
                  isDarkMode={isDarkMode}
                  sessionType={sessionType}
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
          </>
        )}

        {!legacySeason && sessionMatches.length === 0 && (
          <div
            className={`text-center py-16 rounded-2xl ${isDarkMode ? 'bg-white/[0.035]' : 'bg-gray-100/80'}`}
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
                className={`px-6 py-2.5 rounded-xl bg-team-blue text-sm font-medium hover:bg-team-blue/90 transition-colors inline-flex items-center gap-2 ${isDarkMode ? 'text-black' : 'text-white'}`}
              >
                <Plus size={18} />
                Add First Match
              </button>
            ) : (
              !sessionId && (
                <Link
                  to={ROUTES.SESSIONS}
                  className="inline-flex min-h-[44px] items-center text-sm font-medium text-team-blue underline underline-offset-4 sm:min-h-0"
                >
                  Open a session from My Sessions
                </Link>
              )
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            to="/charts"
            className={`flex items-center justify-center w-full sm:w-56 px-5 py-2.5 rounded-xl bg-team-blue text-sm font-medium text-center hover:bg-team-blue/90 transition-colors ${isDarkMode ? 'text-black' : 'text-white'}`}
          >
            View Lifetime Charts
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
        />
      )}
    </div>
  );
};

export default Analysis;
