import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth, useTheme } from '@/contexts';
import { useNavigationGuard } from '@/hooks';
import { firebaseService } from '@/services';
import { formatDate } from '@/lib';
import { ROUTES, APP_CONFIG } from '@/constants';
import type { Session, Match } from '@/types';
import { MatchForm } from '@/components';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const EditSession = () => {
  const { user, isGuest } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | undefined>();
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navGuard = useNavigationGuard(isFormOpen, 'You have an unsaved match. Are you sure you want to leave?');

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
        const { logger } = await import('@/lib/logger');
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
    setEditingMatch(match);
    setIsFormOpen(true);
  };

  const handleSaveMatch = async (matchData: Partial<Match>) => {
    if (!session) return;

    try {
      setIsSaving(true);
      let updatedMatches: Match[];

      if (editingMatch?.id) {
        updatedMatches = (session.matches || []).map(m =>
          m.id === editingMatch.id ? { ...m, ...matchData } : m
        );
      } else {
        const newMatch: Match = {
          id: `match_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          matchNumber: matchData.matchNumber || 1,
          ...matchData,
        };
        updatedMatches = [...(session.matches || []), newMatch];
      }

      await firebaseService.updateSession(session.id, {
        matches: updatedMatches,
      });

      setSession(prev => (prev ? { ...prev, matches: updatedMatches } : null));

      toast.success(
        editingMatch ? 'Match updated successfully' : 'Match added successfully'
      );
      setIsFormOpen(false);
      setEditingMatch(undefined);
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error saving match', error);
      toast.error('Failed to save match');
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
      deleteTimerRef.current = setTimeout(() => setConfirmDeleteId(prev => prev === matchId ? null : prev), 5000);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!session) return;
    setConfirmDeleteId(null);

    try {
      setDeletingMatchId(matchId);
      const updatedMatches = (session.matches || []).filter(
        m => m.id !== matchId
      );

      await firebaseService.updateSession(session.id, {
        matches: updatedMatches,
      });

      setSession(prev => (prev ? { ...prev, matches: updatedMatches } : null));

      toast.success('Match deleted successfully');
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error deleting match', error);
      toast.error('Failed to delete match');
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

  if (loading) {
    return (
      <div
        className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
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
        className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div className="max-w-[1152px] mx-auto px-4 py-8">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2
              className={`text-2xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
            >
              Session Not Found
            </h2>
            <p
              className={
                isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
              }
            >
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
  const totalScore = matches.reduce((sum, m) => sum + (m.finalScore || 0), 0);
  const averageScore =
    matches.length > 0
      ? Math.round(
          matches.reduce((sum, m) => sum + (m.finalScore || 0), 0) /
            matches.length
        )
      : 0;

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'} page-transition`}
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
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle
                  className={`text-3xl mb-2 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
                >
                  {session.sessionName || 'Untitled Session'}
                </CardTitle>
                <div className="flex items-center gap-4 flex-wrap">
                  <p
                    className={`text-sm flex items-center gap-2 ${
                      isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
                    }`}
                  >
                    <Clock className="h-4 w-4" />
                    {formatDate(session.createdAt)}
                  </p>
                  <p
                    className={`text-sm flex items-center gap-2 ${
                      isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
                    }`}
                  >
                    <Target className="h-4 w-4" />
                    Match Type: {session.matchType || 'Full Game'}
                  </p>
                </div>
              </div>
              <div
                className={`px-6 py-4 rounded-xl border-2 backdrop-blur-sm ${
                  isDarkMode
                    ? 'bg-team-blue/10 border-team-blue/40'
                    : 'bg-team-blue/10 border-team-blue/30'
                }`}
              >
                <p className="text-sm text-team-blue-40 mb-1 font-medium">
                  Match Type
                </p>
                <p className="font-bold text-team-blue text-lg">
                  {session.matchType || 'Full Game'}
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
                  <p className="text-sm text-team-blue-40 font-medium">
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
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                  Total Score
                </p>
                <p className="text-4xl font-bold text-purple-600 dark:text-purple-400 mt-1">
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
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Average Score
                </p>
                <p className="text-4xl font-bold text-green-600 dark:text-green-400 mt-1">
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
                <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                  Best Score
                </p>
                <p className="text-4xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {matches.length > 0
                    ? Math.max(...matches.map(m => m.finalScore || 0))
                    : 0}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2
              className={`text-3xl font-bold flex items-center gap-3 ${
                isDarkMode ? 'text-white' : 'text-team-blue'
              }`}
            >
              <TrendingUp className="h-7 w-7 text-team-blue" />
              Matches
            </h2>
            <Button
              onClick={handleAddMatch}
              className="bg-gradient-to-r from-team-blue to-team-blue/80 hover:from-team-blue/90 hover:to-team-blue/70 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Match
            </Button>
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
                    <p
                      className={`text-sm ${
                        isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
                      }`}
                    >
                      Click "Add Match" to create your first match
                    </p>
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
                    <div className="flex items-center justify-between pl-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div
                            className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 ${
                              isDarkMode
                                ? 'bg-gradient-to-r from-team-blue/30 to-purple-500/30 text-team-blue'
                                : 'bg-gradient-to-r from-team-blue/20 to-purple-500/20 text-team-blue'
                            }`}
                          >
                            <Trophy className="h-4 w-4" />
                            Match {match.matchNumber || index + 1}
                          </div>
                          <p
                            className={`text-sm font-medium ${
                              isDarkMode
                                ? 'text-team-white-60'
                                : 'text-team-blue-40'
                            }`}
                          >
                            {match.matchType || 'Full Game'}
                          </p>
                          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/20 to-green-500/20">
                            <Sparkles className="h-4 w-4 text-emerald-600" />
                            <p className="text-lg font-bold text-emerald-600">
                              {match.finalScore || 0} pts
                            </p>
                          </div>
                        </div>
                        <div
                          className={`mt-3 text-xs flex items-center gap-4 ${
                            isDarkMode ? 'text-team-white-40' : 'text-gray-500'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                            Auto: {match.autonomousScore || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            Teleop: {match.teleopScore || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                            End: {match.endGameScore || 0}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditMatch(match)}
                          aria-label="Edit match"
                          className={`p-3 rounded-lg transition-all transform hover:scale-110 ${
                            isDarkMode
                              ? 'text-team-white-60 hover:bg-team-blue/20 hover:text-team-blue'
                              : 'text-team-blue-40 hover:bg-team-blue/10 hover:text-team-blue'
                          }`}
                          title="Edit match"
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(match.id)}
                          disabled={deletingMatchId === match.id}
                          aria-label={confirmDeleteId === match.id ? 'Confirm delete match' : 'Delete match'}
                          aria-live="polite"
                          className={`p-3 rounded-lg transition-all transform hover:scale-110 ${
                            deletingMatchId === match.id
                              ? 'opacity-50 cursor-not-allowed'
                              : confirmDeleteId === match.id
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : isDarkMode
                                  ? 'text-team-white-60 hover:bg-red-500/20 hover:text-red-400'
                                  : 'text-team-blue-40 hover:bg-red-500/10 hover:text-red-500'
                          }`}
                          title={confirmDeleteId === match.id ? 'Click again to confirm delete' : 'Delete match'}
                        >
                          {deletingMatchId === match.id ? (
                            <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : confirmDeleteId === match.id ? (
                            <span className="text-xs font-bold px-1">Confirm?</span>
                          ) : (
                            <Trash2 className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {navGuard.isBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`mx-4 max-w-sm w-full rounded-xl border-2 p-6 shadow-2xl ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Unsaved Match</h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>{navGuard.message}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={navGuard.reset}>Stay</Button>
              <Button variant="destructive" className="flex-1" onClick={navGuard.proceed}>Leave</Button>
            </div>
          </div>
        </div>
      )}

      <MatchForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingMatch(undefined);
        }}
        onSave={handleSaveMatch}
        initialMatch={editingMatch}
        isLoading={isSaving}
      />
    </div>
  );
};

export default EditSession;
