import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth, useTheme } from '@/contexts';
import { useEscapeKey, useNavigationGuard } from '@/hooks';
import { firebaseService } from '@/services';
import {
  saveMatchEdit,
  matchEditFailure,
  newMatchId,
  type MatchEdit,
} from '@/services/matchEdits';
import {
  formatDate,
  calculateTotal,
  pickScoringFields,
  matchScore,
  sessionMatchType,
  isCurrentSeasonSession,
  logger,
} from '@/lib';
import { ROUTES, APP_CONFIG, UI_TIMING } from '@/constants';
import type { Session, Match } from '@/types';
import { MatchForm } from '@/components';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Trophy,
  TrendingUp,
  Target,
  Clock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

const MATCH_TYPES = ['Full Game', 'Autonomous', 'Teleop'];

const EditSession = () => {
  const { user, isGuest } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [session, setSession] = useState<Session | null>(null);
  /**
   * Recorded in an earlier season: shown as saved, with nothing to edit.
   * Saving a match from here would rescore it under this season's rules.
   */
  const isLegacy = !!session && !isCurrentSeasonSession(session);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | undefined>();
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navGuard = useNavigationGuard(
    isFormOpen,
    'You have an unsaved match. Are you sure you want to leave?'
  );
  useEscapeKey(confirmDeleteId !== null, () => setConfirmDeleteId(null));

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    document.title = `Edit Session - ${APP_CONFIG.name}`;
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId || !user?.uid) {
        navigate(ROUTES.SESSIONS);
        return;
      }

      try {
        setLoading(true);
        const sessionData = await firebaseService.getSession(sessionId);

        if (!sessionData || sessionData.userId !== user.uid) {
          toast.error('Session not found or access denied');
          navigate(ROUTES.SESSIONS);
          return;
        }

        setSession(sessionData);
      } catch (error) {
        logger.error('Error loading session', error);
        toast.error('Failed to load session');
        navigate(ROUTES.SESSIONS);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId, user?.uid, navigate]);

  const handleAddMatch = () => {
    setEditingMatch(undefined);
    setIsFormOpen(true);
  };

  const handleEditMatch = (match: Match) => {
    // A match saved without a type of its own ran as the session's type.
    const fallback = session?.matchType;
    setEditingMatch(
      match.matchType || !fallback || !MATCH_TYPES.includes(fallback)
        ? match
        : { ...match, matchType: fallback }
    );
    setIsFormOpen(true);
  };

  /**
   * Apply one edit to the stored session and show what was written. The edit
   * is made against the stored matches, not this page's copy of them, so a
   * change made in another tab since this page loaded isn't overwritten.
   */
  const applyEdit = async (id: string, edit: MatchEdit) => {
    const result = await saveMatchEdit(id, edit);
    setSession(prev =>
      prev && prev.id === id ? { ...prev, matches: result.matches } : prev
    );
    return result;
  };

  const handleSaveMatch = async (matchData: Partial<Match>) => {
    if (!session || isLegacy) return;

    try {
      setIsSaving(true);
      await applyEdit(
        session.id,
        editingMatch?.id
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
      setIsFormOpen(false);
      setEditingMatch(undefined);
    } catch (error) {
      // The form stays open with what was typed, so it can be tried again.
      logger.error('Error saving match', error);
      toast.error('Failed to save match', {
        description: matchEditFailure(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (matchId: string) => {
    if (confirmDeleteId === matchId) {
      handleDeleteMatch(matchId);
    } else {
      setConfirmDeleteId(matchId);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = setTimeout(
        () => setConfirmDeleteId(prev => (prev === matchId ? null : prev)),
        UI_TIMING.DELETE_CONFIRM_TIMEOUT
      );
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!session || isLegacy) return;
    setConfirmDeleteId(null);

    try {
      setDeletingMatchId(matchId);
      const id = session.id;
      const { removed } = await applyEdit(id, { kind: 'delete', matchId });

      toast.success('Match deleted', {
        duration: UI_TIMING.UNDO_WINDOW,
        action: removed && {
          label: 'Undo',
          onClick: async () => {
            try {
              await applyEdit(id, { kind: 'restore', ...removed });
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
      setDeletingMatchId(null);
    }
  };

  const guestRedirectToastShown = useRef(false);
  if (!user?.uid || isGuest) {
    if (!guestRedirectToastShown.current) {
      guestRedirectToastShown.current = true;
      setTimeout(() => toast.error('Please sign in to edit sessions'), 0);
    }
    return <Navigate to={ROUTES.SESSIONS} replace />;
  }

  // A session loaded for a previous id is never shown under a new one.
  if (loading || (session && session.id !== sessionId)) {
    return (
      <div
        className={`min-h-[100dvh] ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div className="max-w-[1152px] mx-auto px-4 py-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-blue"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className={`min-h-[100dvh] ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div className="max-w-[1152px] mx-auto px-4 py-8">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2
              className={`text-2xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
            >
              Session Not Found
            </h2>
            <p className={isDarkMode ? 'text-team-white-60' : 'text-gray-600'}>
              The session you're trying to edit could not be found.
            </p>
            <button
              onClick={() => navigate(ROUTES.SESSIONS)}
              className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDarkMode
                  ? 'bg-team-blue text-black hover:bg-team-blue/80'
                  : 'bg-team-blue text-white hover:bg-team-blue/90'
              }`}
            >
              Go to Sessions
            </button>
          </div>
        </div>
      </div>
    );
  }

  const matches = session.matches || [];
  // Scores are recomputed from the fields, never read from the cached
  // `finalScore` - except for an older season's matches, which have none of
  // this season's fields and would all recompute to 0.
  const scoreOf = (m: Match): number =>
    isLegacy ? (m.finalScore ?? 0) : matchScore(m, session.matchType);
  const scores = matches.map(scoreOf);
  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  const averageScore =
    matches.length > 0 ? Math.round(totalScore / matches.length) : 0;
  const bestScore = matches.length > 0 ? Math.max(...scores) : 0;
  const matchTypeLabel = sessionMatchType(matches, session.matchType);
  // team-blue at 40% is unreadable as text in every theme
  const mutedText = isDarkMode ? 'text-team-white-60' : 'text-gray-600';

  return (
    <div
      className={`min-h-[100dvh] ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'} page-transition`}
    >
      <div className="max-w-[1152px] mx-auto px-4 py-8">
        <Card
          className={`mb-8 overflow-hidden border-2 ${
            isDarkMode
              ? 'border-team-blue-40 bg-gradient-to-br from-team-dark via-team-dark to-team-blue/10'
              : 'border-team-blue/20 bg-gradient-to-br from-white via-white to-team-blue/5'
          }`}
        >
          <CardHeader className="relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-team-blue/5 rounded-full blur-3xl -z-10" />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                {isLegacy && (
                  <div
                    className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full mb-2 ${
                      isDarkMode
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {(session.season || 'decode').toUpperCase()} season
                  </div>
                )}
                <CardTitle
                  className={`text-2xl sm:text-3xl mb-2 break-words [overflow-wrap:anywhere] min-w-0 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
                >
                  {session.sessionName || 'Untitled Session'}
                </CardTitle>
                <div className="flex items-center gap-4 flex-wrap">
                  <p className={`text-sm flex items-center gap-2 ${mutedText}`}>
                    <Clock className="h-4 w-4" />
                    {formatDate(session.createdAt)}
                  </p>
                  <p className={`text-sm flex items-center gap-2 ${mutedText}`}>
                    <Target className="h-4 w-4" />
                    Match Type: {matchTypeLabel}
                  </p>
                </div>
                {isLegacy && (
                  <p className={`text-sm mt-3 ${mutedText}`}>
                    This session was scored under an earlier season's rules. It
                    is kept as it was saved and can't be edited.
                  </p>
                )}
              </div>
              <div
                className={`self-start px-6 py-4 rounded-xl border-2 backdrop-blur-sm shrink-0 ${
                  isDarkMode
                    ? 'bg-team-blue/10 border-team-blue/40'
                    : 'bg-team-blue/10 border-team-blue/30'
                }`}
              >
                <p className={`text-sm mb-1 font-medium ${mutedText}`}>
                  Match Type
                </p>
                {/* team-blue itself is 4.25:1 on its own light tint */}
                <p
                  className={`font-bold text-lg ${isDarkMode ? 'text-team-blue' : 'text-[#42606e]'}`}
                >
                  {matchTypeLabel}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card
            className={`overflow-hidden border-2 transform transition-all duration-300 hover:scale-105 hover:shadow-xl ${
              isDarkMode
                ? 'border-team-blue-40 bg-gradient-to-br from-team-dark to-team-blue/10'
                : 'border-team-blue/20 bg-gradient-to-br from-white to-team-blue/5'
            }`}
          >
            <CardContent className="pt-6 relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-team-blue/10 rounded-full blur-2xl" />
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className={`text-sm font-medium ${mutedText}`}>
                    Total Matches
                  </p>
                  <p className="text-4xl font-bold text-team-blue mt-1">
                    {matches.length}
                  </p>
                </div>
                <Trophy className="h-10 w-10 text-team-blue/30" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`overflow-hidden border-2 transform transition-all duration-300 hover:scale-105 hover:shadow-xl ${
              isDarkMode
                ? 'border-purple-500/40 bg-gradient-to-br from-team-dark to-purple-500/10'
                : 'border-purple-500/20 bg-gradient-to-br from-white to-purple-500/5'
            }`}
          >
            <CardContent className="pt-6 relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl" />
              <div className="relative z-10">
                <p className={`text-sm font-medium ${mutedText}`}>
                  Total Score
                </p>
                <p className="text-4xl font-bold text-purple-700 dark:text-purple-400 mt-1">
                  {totalScore}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`overflow-hidden border-2 transform transition-all duration-300 hover:scale-105 hover:shadow-xl ${
              isDarkMode
                ? 'border-green-500/40 bg-gradient-to-br from-team-dark to-green-500/10'
                : 'border-green-500/20 bg-gradient-to-br from-white to-green-500/5'
            }`}
          >
            <CardContent className="pt-6 relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl" />
              <div className="relative z-10">
                <p className={`text-sm font-medium ${mutedText}`}>
                  Average Score
                </p>
                <p className="text-4xl font-bold text-green-700 dark:text-green-400 mt-1">
                  {averageScore}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`overflow-hidden border-2 transform transition-all duration-300 hover:scale-105 hover:shadow-xl ${
              isDarkMode
                ? 'border-orange-500/40 bg-gradient-to-br from-team-dark to-orange-500/10'
                : 'border-orange-500/20 bg-gradient-to-br from-white to-orange-500/5'
            }`}
          >
            <CardContent className="pt-6 relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full blur-2xl" />
              <div className="relative z-10">
                <p className={`text-sm font-medium ${mutedText}`}>Best Score</p>
                <p className="text-4xl font-bold text-orange-700 dark:text-orange-400 mt-1">
                  {bestScore}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <h2
              className={`text-2xl sm:text-3xl font-bold flex items-center gap-3 ${
                isDarkMode ? 'text-white' : 'text-team-blue'
              }`}
            >
              <TrendingUp className="h-7 w-7 text-team-blue" />
              Matches
            </h2>
            {!isLegacy && (
              <Button
                onClick={handleAddMatch}
                // White is unreadable on team-blue in the dark themes, where
                // it is a pale tint.
                className={`bg-team-blue hover:bg-team-blue/90 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 ${isDarkMode ? 'text-black' : 'text-white'}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Match
              </Button>
            )}
          </div>

          {matches.length === 0 ? (
            <Card
              className={`border-2 border-dashed ${
                isDarkMode
                  ? 'border-team-blue-40 bg-team-dark'
                  : 'border-gray-300 bg-white'
              }`}
            >
              <CardContent className="py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className={`p-6 rounded-full ${
                      isDarkMode ? 'bg-team-blue/10' : 'bg-team-blue/5'
                    }`}
                  >
                    <Sparkles className="h-12 w-12 text-team-blue" />
                  </div>
                  <div>
                    <h3
                      className={`text-lg font-semibold mb-2 ${
                        isDarkMode ? 'text-white' : 'text-team-blue'
                      }`}
                    >
                      No matches yet
                    </h3>
                    {!isLegacy && (
                      <p className={`text-sm ${mutedText}`}>
                        Click "Add Match" to create your first match
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {matches.map((match, index) => (
                <Card
                  key={match.id}
                  className={`group overflow-hidden border-2 transform transition-all duration-200 hover:scale-[1.02] hover:shadow-xl ${
                    isDarkMode
                      ? 'border-team-blue-40 bg-gradient-to-r from-team-dark to-team-dark hover:border-team-blue'
                      : 'border-gray-200 bg-gradient-to-r from-white to-gray-50 hover:border-team-blue'
                  }`}
                >
                  <CardContent className="py-4 relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-team-blue to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-start justify-between flex-wrap gap-3 pl-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div
                            className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 bg-gradient-to-r from-team-blue/20 to-purple-500/20 ${
                              isDarkMode ? 'text-team-blue' : 'text-[#42606e]'
                            }`}
                          >
                            <Trophy className="h-4 w-4" />
                            Match {match.matchNumber || index + 1}
                          </div>
                          <p className={`text-sm font-medium ${mutedText}`}>
                            {match.matchType ||
                              session.matchType ||
                              'Full Game'}
                          </p>
                          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/20 to-green-500/20">
                            <Sparkles className="h-4 w-4 text-emerald-800 dark:text-emerald-400" />
                            <p className="text-lg font-bold text-emerald-800 dark:text-emerald-400">
                              {scoreOf(match)} pts
                            </p>
                          </div>
                        </div>
                        {!isLegacy && (
                          <div
                            className={`mt-3 text-xs flex items-center gap-x-4 gap-y-1.5 flex-wrap ${mutedText}`}
                          >
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              Garden: {match.garden || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                              Tipping: {match.tipping || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-purple-500" />
                              Flower: {match.flower || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-sky-500" />
                              Hive: {match.ballsInHive || 0}
                            </span>
                          </div>
                        )}
                      </div>
                      {!isLegacy && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditMatch(match)}
                            aria-label="Edit match"
                            className={`inline-flex items-center justify-center p-3 rounded-lg transition-all transform hover:scale-110 ${
                              isDarkMode
                                ? 'text-team-white-60 hover:bg-team-blue/20 hover:text-team-blue'
                                : 'text-gray-600 hover:bg-team-blue/10 hover:text-team-blue'
                            }`}
                            title="Edit match"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(match.id)}
                            disabled={deletingMatchId === match.id}
                            aria-label={
                              confirmDeleteId === match.id
                                ? 'Confirm delete match'
                                : 'Delete match'
                            }
                            aria-live="polite"
                            className={`inline-flex items-center justify-center p-3 rounded-lg transition-all transform hover:scale-110 ${
                              deletingMatchId === match.id
                                ? 'opacity-50 cursor-not-allowed'
                                : confirmDeleteId === match.id
                                  ? 'bg-red-500 text-white hover:bg-red-600'
                                  : isDarkMode
                                    ? 'text-team-white-60 hover:bg-red-500/20 hover:text-red-400'
                                    : 'text-gray-600 hover:bg-red-500/10 hover:text-red-600'
                            }`}
                            title={
                              confirmDeleteId === match.id
                                ? 'Click again to confirm delete'
                                : 'Delete match'
                            }
                          >
                            {deletingMatchId === match.id ? (
                              <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : confirmDeleteId === match.id ? (
                              <span className="text-xs font-bold px-1">
                                Confirm?
                              </span>
                            ) : (
                              <Trash2 className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {!isLegacy && (
        <MatchForm
          isOpen={isFormOpen}
          onClose={() => {
            // Escape and a backdrop click belong to the leave prompt while
            // it is up, not to the form underneath it.
            if (navGuard.isBlocked) return;
            setIsFormOpen(false);
            setEditingMatch(undefined);
          }}
          onSave={handleSaveMatch}
          initialMatch={editingMatch}
          isLoading={isSaving}
          sessionType={session.sessionType}
        />
      )}

      {/* After the match form, so it opens on top of it */}
      <Dialog
        open={navGuard.isBlocked}
        onOpenChange={open => {
          if (!open) navGuard.reset();
        }}
      >
        <DialogContent
          role="alertdialog"
          className={`max-w-sm border-2 p-6 ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-gray-200'}`}
        >
          <DialogTitle
            className={`mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          >
            Unsaved Match
          </DialogTitle>
          <p
            className={`text-sm mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            {navGuard.message}
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={navGuard.reset}
            >
              Stay
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={navGuard.proceed}
            >
              Leave
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EditSession;
