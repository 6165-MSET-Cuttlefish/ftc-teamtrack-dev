import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import { useSession, useTheme, useAuth } from '@/contexts';
import { firebaseService } from '@/services';
import { generateShareableLink, copyToClipboard, sanitizeHtml } from '@/lib';
import { APP_CONFIG, STORAGE_KEYS } from '@/constants';
import type { Match } from '@/types';
import { MatchForm } from '@/components';
import { toast } from 'sonner';
import { BarChart3, Plus, Link2, Check, Loader2 } from 'lucide-react';
import {
  SummaryTab,
  MatchDetailTab,
  CompareTab,
  StatCard,
  computeStats,
  TABS,
  type TabId,
} from '@/components/session/AnalysisTabs';

const Analysis = () => {
  const { sessionData: contextSessionData } = useSession();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [localSessionData, setLocalSessionData] = useState(contextSessionData);
  const sessionData = localSessionData;
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [isMatchFormOpen, setIsMatchFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    document.title = `Analysis - ${APP_CONFIG.name}`;
  }, []);

  const sessionMatches = useMemo(
    () => sessionData?.matches ?? [],
    [sessionData?.matches]
  );

  const stats = useMemo(() => computeStats(sessionMatches), [sessionMatches]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);

      const stateData = location.state as {
        sessionData?: typeof contextSessionData;
      } | null;
      if (stateData?.sessionData) {
        if (mounted) {
          setLocalSessionData(stateData.sessionData);
          setLoading(false);
        }
        return;
      }

      const sessionId = searchParams.get('sessionId');
      if (sessionId) {
        try {
          let session = null;
          if (sessionId.startsWith('guest_')) {
            const stored = JSON.parse(
              localStorage.getItem(STORAGE_KEYS.GUEST_SESSIONS) || '[]'
            );
            session =
              stored.find((s: { id: string }) => s.id === sessionId) || null;
          }
          if (!session) {
            session = await firebaseService.getSession(sessionId);
          }
          if (mounted && session) {
            const sum = (fn: (m: Match) => number) =>
              session.matches.reduce((s: number, m: Match) => s + fn(m), 0);

            setLocalSessionData({
              sessionName: session.sessionName || '',
              sessionDuration: session.sessionDuration || '',
              matchType: session.matchType || '',
              finalScore: sum(m => m.finalScore || 0),
              autonomousScore: sum(m => m.autonomousScore || 0),
              teleopScore: sum(m => m.teleopScore || 0),
              endGameScore: sum(m => m.endGameScore || 0),
              isSessionCompleted: true,
              autonClassifiedArtifact: sum(
                m => m.autonClassifiedArtifact || 0
              ),
              autonOverflowArtifact: sum(m => m.autonOverflowArtifact || 0),
              autonMotif: sum(m => m.autonMotif || 0),
              autonLeave: sum(m => m.autonLeave || 0),
              teleClassifiedArtifact: sum(m => m.teleClassifiedArtifact || 0),
              teleOverflowArtifact: sum(m => m.teleOverflowArtifact || 0),
              teleMotif: sum(m => m.teleMotif || 0),
              teleBallsMissed: sum(m => m.teleBallsMissed || 0),
              autonBallsMissed: sum(m => m.autonBallsMissed || 0),
              robot1Park: 'none',
              robot2Park: 'none',
              selectedFeature: session.selectedFeature || '',
              cycleTimes: session.matches.flatMap(
                (m: Match) => m.cycleTimes || []
              ),
              notes: session.notes || '',
              matches: session.matches || [],
              gateBallCount: 0,
            });
          }
        } catch (error) {
          if (mounted && (error as Error)?.name !== 'AbortError') {
            const { logger } = await import('@/lib/logger');
            logger.error('Error loading session', error);
          }
        }
      }

      if (mounted) setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [searchParams, location.state, user?.uid]);

  const handleCopyLink = useCallback(async () => {
    if (!sessionData) return;
    setIsCopyingLink(true);
    try {
      const sharePayload = {
        sessionName: sessionData.sessionName,
        sessionDuration: sessionData.sessionDuration,
        matchType: sessionData.matchType,
        selectedFeature: sessionData.selectedFeature,
        notes: sessionData.notes || '',
        matches: (sessionData.matches || []).map(m => ({
          id: m.id,
          matchNumber: m.matchNumber,
          matchType: m.matchType,
          finalScore: m.finalScore,
          autonomousScore: m.autonomousScore,
          teleopScore: m.teleopScore,
          endGameScore: m.endGameScore,
          autonClassifiedArtifact: m.autonClassifiedArtifact,
          autonOverflowArtifact: m.autonOverflowArtifact,
          autonMotif: m.autonMotif,
          autonLeave: m.autonLeave,
          autonBallsMissed: m.autonBallsMissed,
          teleClassifiedArtifact: m.teleClassifiedArtifact,
          teleOverflowArtifact: m.teleOverflowArtifact,
          teleMotif: m.teleMotif,
          teleBallsMissed: m.teleBallsMissed,
          robot1Park: m.robot1Park,
          robot2Park: m.robot2Park,
          cycleTimes: m.cycleTimes,
          autonShots: m.autonShots,
          teleopShots: m.teleopShots,
        })),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const link = await generateShareableLink(sharePayload as any);
      await copyToClipboard(link);
      setLinkCopied(true);
      toast.success('Share link copied to clipboard!');
      setTimeout(() => setLinkCopied(false), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate share link');
    } finally {
      setIsCopyingLink(false);
    }
  }, [sessionData]);

  const handleAddMatch = () => {
    setEditingMatch(null);
    setIsMatchFormOpen(true);
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatch(match);
    setIsMatchFormOpen(true);
  };

  const handleDeleteMatch = async (matchId: string) => {
    const sessionId = searchParams.get('sessionId');
    if (!sessionId || !sessionData.matches) return;

    setIsUpdating(true);
    try {
      const updatedMatches = sessionData.matches.filter(m => m.id !== matchId);

      if (sessionId.startsWith('guest_')) {
        const stored = JSON.parse(
          localStorage.getItem(STORAGE_KEYS.GUEST_SESSIONS) || '[]'
        );
        const updated = stored.map((s: { id: string; matches?: Match[] }) =>
          s.id === sessionId ? { ...s, matches: updatedMatches } : s
        );
        localStorage.setItem(STORAGE_KEYS.GUEST_SESSIONS, JSON.stringify(updated));
      } else {
        await firebaseService.updateSession(sessionId, {
          matches: updatedMatches,
        });
      }

      setLocalSessionData({ ...sessionData, matches: updatedMatches });
      toast.success('Match deleted successfully');
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error deleting match', error);
      toast.error('Failed to delete match');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveMatch = async (matchData: Partial<Match>) => {
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      toast.error('No session ID found');
      return;
    }

    setIsUpdating(true);
    try {
      const currentMatches = sessionData.matches || [];
      let updatedMatches: Match[];

      if (editingMatch) {
        updatedMatches = currentMatches.map(m =>
          m.id === editingMatch.id ? { ...m, ...matchData } : m
        );
      } else {
        const newMatch: Match = {
          id: `match_${Date.now()}`,
          matchNumber: matchData.matchNumber || currentMatches.length + 1,
          matchType: matchData.matchType || 'Full Game',
          finalScore: matchData.finalScore || 0,
          autonomousScore: matchData.autonomousScore || 0,
          teleopScore: matchData.teleopScore || 0,
          endGameScore: matchData.endGameScore || 0,
          autonClassifiedArtifact: matchData.autonClassifiedArtifact || 0,
          autonOverflowArtifact: matchData.autonOverflowArtifact || 0,
          autonMotif: matchData.autonMotif || 0,
          autonLeave: matchData.autonLeave || 0,
          autonBallsMissed: matchData.autonBallsMissed || 0,
          teleClassifiedArtifact: matchData.teleClassifiedArtifact || 0,
          teleOverflowArtifact: matchData.teleOverflowArtifact || 0,
          teleMotif: matchData.teleMotif || 0,
          teleBallsMissed: matchData.teleBallsMissed || 0,
          robot1Park: matchData.robot1Park || 'none',
          robot2Park: matchData.robot2Park || 'none',
          cycleTimes: matchData.cycleTimes || [],
        };
        updatedMatches = [...currentMatches, newMatch];
      }

      if (sessionId.startsWith('guest_')) {
        const stored = JSON.parse(
          localStorage.getItem(STORAGE_KEYS.GUEST_SESSIONS) || '[]'
        );
        const updated = stored.map((s: { id: string; matches?: Match[] }) =>
          s.id === sessionId ? { ...s, matches: updatedMatches } : s
        );
        localStorage.setItem(STORAGE_KEYS.GUEST_SESSIONS, JSON.stringify(updated));
      } else {
        await firebaseService.updateSession(sessionId, {
          matches: updatedMatches,
        });
      }

      setLocalSessionData({ ...sessionData, matches: updatedMatches });
      toast.success(
        editingMatch ? 'Match updated successfully' : 'Match added successfully'
      );
      setIsMatchFormOpen(false);
      setEditingMatch(null);
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error saving match', error);
      toast.error('Failed to save match');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-blue"></div>
          <p className="text-sm text-team-blue">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1152px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-team-blue text-3xl sm:text-4xl font-bold leading-tight">
              {sessionData.sessionName || 'Session'} Analysis
            </h1>
            <div
              className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
            >
              {sessionData.matchType && <span>{sessionData.matchType}</span>}
              {sessionData.sessionDuration && (
                <span>{sessionData.sessionDuration}</span>
              )}
              <span>
                {sessionMatches.length} match
                {sessionMatches.length !== 1 ? 'es' : ''}
              </span>
            </div>
          </div>

          {sessionMatches.length > 0 && (
            <button
              onClick={handleCopyLink}
              disabled={isCopyingLink}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all shrink-0 ${
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
        </div>

        {stats && (
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
                sublabel={`${stats.totalMatches} matches`}
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
            className={`rounded-xl border p-5 ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`}
          >
            <h3
              className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              Notes
            </h3>
            <div
              className={`text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'} [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5`}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(sessionData.notes) }}
            />
          </div>
        )}

        {sessionMatches.length > 0 && (
          <>
            <div
              className={`flex gap-1 p-1 rounded-xl ${isDarkMode ? 'bg-team-dark-20' : 'bg-gray-100'}`}
            >
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? isDarkMode
                          ? 'bg-team-dark text-team-blue shadow-sm'
                          : 'bg-white text-team-blue shadow-sm'
                        : isDarkMode
                          ? 'text-team-white-60 hover:text-white'
                          : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div>
              {activeTab === 'summary' && stats && (
                <SummaryTab
                  matches={sessionMatches}
                  stats={stats}
                  isDarkMode={isDarkMode}
                />
              )}
              {activeTab === 'matches' && (
                <MatchDetailTab
                  matches={sessionMatches}
                  isDarkMode={isDarkMode}
                  onEdit={handleEditMatch}
                  onDelete={handleDeleteMatch}
                  onAdd={handleAddMatch}
                />
              )}
              {activeTab === 'compare' && (
                <CompareTab
                  matches={sessionMatches}
                  isDarkMode={isDarkMode}
                />
              )}
            </div>
          </>
        )}

        {sessionMatches.length === 0 && !loading && (
          <div
            className={`text-center py-16 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-gray-50'}`}
          >
            <BarChart3
              size={40}
              className={`mx-auto mb-3 ${isDarkMode ? 'text-team-white-60' : 'text-gray-400'}`}
            />
            <p
              className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
            >
              No matches recorded yet
            </p>
            <button
              onClick={handleAddMatch}
              className={`px-6 py-2.5 rounded-xl bg-team-blue text-sm font-medium hover:bg-team-blue/90 transition-colors inline-flex items-center gap-2 ${isDarkMode ? 'text-black' : 'text-white'}`}
            >
              <Plus size={18} />
              Add First Match
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            to="/charts"
            className={`w-full sm:w-56 px-5 py-2.5 rounded-xl bg-team-blue text-sm font-medium text-center hover:bg-team-blue/90 transition-colors ${isDarkMode ? 'text-black' : 'text-white'}`}
          >
            View Lifetime Charts
          </Link>
        </div>
      </div>

      <MatchForm
        isOpen={isMatchFormOpen}
        onClose={() => {
          setIsMatchFormOpen(false);
          setEditingMatch(null);
        }}
        onSave={handleSaveMatch}
        initialMatch={editingMatch || undefined}
        isLoading={isUpdating}
      />
    </div>
  );
};

export default Analysis;
