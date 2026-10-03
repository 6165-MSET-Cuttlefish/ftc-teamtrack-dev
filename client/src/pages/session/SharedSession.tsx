import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTheme, useAuth } from '@/contexts';
import { firebaseService } from '@/services';
import { sessionMatchType } from '@/lib';
import { normalizeSession } from '@/lib/sessionNormalize';
import { CURRENT_SEASON } from '@/constants';
import { PAGE_TITLE_CLASS } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { BarChart3, AlertTriangle, ArrowLeft } from 'lucide-react';
import type { Match, Session } from '@/types';
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

const MATCH_TYPES = ['Full Game', 'Autonomous', 'Teleop'];

const SharedSession = () => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeTab, setActiveTab, selectedIdx, setSelectedIdx, openMatch } =
    useAnalysisNav();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(window.location.search);

        // New short-link format: ?id=<7-char shortId>
        const shortId = params.get('id');
        if (shortId) {
          const data = await firebaseService.getSharedSession(shortId);
          if (data) {
            // The snapshot was written by whoever made the link, not by this
            // app's own checks, so its shape can't be taken on trust.
            setSession(normalizeSession(data, shortId));
          } else {
            setError(
              'Session not found. The link may have been removed or is invalid.'
            );
          }
          return;
        }

        // The old ?data=<base64> links are no longer read: their contents came
        // straight from the URL, so anyone could craft one that looked like a
        // real shared session, and they could never be taken down.
        setError(
          params.has('data')
            ? 'This is an old-style share link, which is no longer supported. Ask for a new link.'
            : 'No session data found in this link.'
        );
      } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error loading shared session', err);
        setError(
          'Failed to load session. The link may have been removed or is invalid.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // A snapshot of a session recorded before this season has none of this
  // season's scoring fields: it is shown as saved, not recomputed to zeros.
  const legacySeason =
    session && session.season !== CURRENT_SEASON
      ? session.season || 'decode'
      : null;

  // Matches saved without a type of their own ran as the session's type,
  // which decides which periods count toward their score.
  const sessionMatches = useMemo((): Match[] => {
    const matches = session?.matches ?? [];
    const fallback = session?.matchType;
    if (!fallback || !MATCH_TYPES.includes(fallback)) return matches;
    return matches.map(m => (m.matchType ? m : { ...m, matchType: fallback }));
  }, [session]);
  const stats = useMemo(
    () => (legacySeason ? null : computeStats(sessionMatches)),
    [sessionMatches, legacySeason]
  );
  const sessionType = session?.sessionType;
  // When the session was recorded. Links made before this was saved with
  // them don't have it (their `createdAt` is when the link was made).
  const recordedAt = (session as { sessionCreatedAt?: unknown } | null)
    ?.sessionCreatedAt;

  if (loading) {
    return (
      <div
        className={`min-h-[100dvh] flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-blue" />
          <p className="text-sm text-team-blue">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
          <AlertTriangle size={40} className="mx-auto text-amber-500" />
          <h2
            className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          >
            Session Not Found
          </h2>
          <p
            className={`text-sm leading-relaxed ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            {error}
          </p>
          <Link to="/">
            <Button
              variant="outline"
              className="mt-2 inline-flex items-center gap-2"
            >
              <ArrowLeft size={15} />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const matchTypeLabel =
    sessionMatches.length > 0
      ? sessionMatchType(sessionMatches, session?.matchType)
      : session?.matchType;

  const hasTabs = !legacySeason && sessionMatches.length > 0;

  return (
    <div
      className={`min-h-[100dvh] ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1152px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-5 sm:space-y-6">
        <div className="space-y-2">
          <div
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              isDarkMode
                ? 'bg-team-blue-40/30 text-team-blue'
                : 'bg-blue-50 text-team-blue'
            }`}
          >
            Shared Session
          </div>
          <h1 className={`${PAGE_TITLE_CLASS} min-w-0`}>
            {session?.sessionName || 'Session'}
          </h1>
          <SessionMeta
            sessionType={legacySeason ? undefined : sessionType}
            matchType={matchTypeLabel}
            createdAt={typeof recordedAt === 'string' ? recordedAt : undefined}
            matchCount={sessionMatches.length}
            duration={session?.sessionDuration}
            isDarkMode={isDarkMode}
          />
        </div>

        {/* Without tabs there are no charts for the notes to wait behind */}
        {!hasTabs && session?.notes && (
          <SessionNotes notes={session.notes} isDarkMode={isDarkMode} />
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
            {activeTab === 'summary' && session?.notes && (
              <SessionNotes
                notes={session.notes}
                isDarkMode={isDarkMode}
                clamp
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
              className={`text-lg font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
            >
              No matches recorded in this session
            </p>
          </div>
        )}

        {!user && (
          <div
            className={`rounded-xl border p-8 ${
              isDarkMode
                ? 'bg-gradient-to-br from-team-blue-20 to-team-dark-20 border-team-blue-40'
                : 'bg-gradient-to-br from-blue-50 to-white border-blue-200'
            }`}
          >
            <div className="text-center space-y-4">
              <h3
                className={`text-xl font-bold ${isDarkMode ? 'text-team-white' : 'text-gray-900'}`}
              >
                Want to track your own sessions?
              </h3>
              <p
                className={isDarkMode ? 'text-team-white-60' : 'text-gray-600'}
              >
                Create a free account to start tracking and analyzing your
                team's performance.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                <Link to="/signup">
                  <Button
                    className={`w-full sm:w-56 bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
                  >
                    Sign Up
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" className="w-full sm:w-56">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedSession;
