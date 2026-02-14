import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth, useTheme } from '@/contexts';
import { firebaseService } from '@/services';
import { formatDate } from '@/lib/utils';
import { ROUTES, APP_CONFIG } from '@/constants';
import type { Session, Match } from '@/types';
import { MatchForm } from '@/components/MatchForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';

const EditSession = () => {
  const { user } = useAuth();
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
        // Update existing match
        updatedMatches = (session.matches || []).map(m =>
          m.id === editingMatch.id
            ? { ...m, ...matchData }
            : m
        );
      } else {
        // Add new match
        const newMatch: Match = {
          id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          matchNumber: matchData.matchNumber || 1,
          ...matchData,
        };
        updatedMatches = [...(session.matches || []), newMatch];
      }

      // Update session in Firebase
      await firebaseService.updateSession(session.id, {
        matches: updatedMatches,
      });

      setSession(prev =>
        prev ? { ...prev, matches: updatedMatches } : null
      );

      toast.success(
        editingMatch
          ? 'Match updated successfully'
          : 'Match added successfully'
      );
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error saving match', error);
      toast.error('Failed to save match');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!session) return;

    try {
      setDeletingMatchId(matchId);
      const updatedMatches = (session.matches || []).filter(
        m => m.id !== matchId
      );

      // Update session in Firebase
      await firebaseService.updateSession(session.id, {
        matches: updatedMatches,
      });

      setSession(prev =>
        prev ? { ...prev, matches: updatedMatches } : null
      );

      toast.success('Match deleted successfully');
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error deleting match', error);
      toast.error('Failed to delete match');
    } finally {
      setDeletingMatchId(null);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}>
        <div className="max-w-4xl mx-auto px-4 py-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-blue"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Button
            onClick={() => navigate(ROUTES.SESSIONS)}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sessions
          </Button>
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className={`text-2xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}>
              Session Not Found
            </h2>
            <p className={isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}>
              The session you're trying to edit could not be found.
            </p>
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
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button
          onClick={() => navigate(ROUTES.SESSIONS)}
          variant="outline"
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sessions
        </Button>

        {/* Session Header */}
        <Card
          className={`mb-8 ${
            isDarkMode
              ? 'border-team-blue-40 bg-team-dark'
              : 'border-gray-200 bg-white'
          }`}
        >
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className={isDarkMode ? 'text-white' : 'text-team-blue'}>
                  {session.sessionName || 'Untitled Session'}
                </CardTitle>
                <p
                  className={`text-sm mt-2 ${
                    isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
                  }`}
                >
                  {formatDate(session.createdAt)} • Driver: {session.driverName || 'Unknown'}
                </p>
              </div>
              <div
                className={`text-right p-4 rounded-lg ${
                  isDarkMode ? 'bg-team-blue/10' : 'bg-team-blue/5'
                }`}
              >
                <p className="text-sm text-team-blue-40 mb-1">Match Type</p>
                <p className="font-semibold text-team-blue">
                  {session.matchType || 'Practice'}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card
            className={`${
              isDarkMode
                ? 'border-team-blue-40 bg-team-dark'
                : 'border-gray-200 bg-white'
            }`}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-team-blue-40">Total Matches</p>
                  <p className="text-3xl font-bold text-team-blue">{matches.length}</p>
                </div>
                <Trophy className="h-8 w-8 text-team-blue/40" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`${
              isDarkMode
                ? 'border-team-blue-40 bg-team-dark'
                : 'border-gray-200 bg-white'
            }`}
          >
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-team-blue-40">Total Score</p>
                <p className="text-3xl font-bold text-team-blue">{totalScore}</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`${
              isDarkMode
                ? 'border-team-blue-40 bg-team-dark'
                : 'border-gray-200 bg-white'
            }`}
          >
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-team-blue-40">Average Score</p>
                <p className="text-3xl font-bold text-team-blue">{averageScore}</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`${
              isDarkMode
                ? 'border-team-blue-40 bg-team-dark'
                : 'border-gray-200 bg-white'
            }`}
          >
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-team-blue-40">Best Score</p>
                <p className="text-3xl font-bold text-team-blue">
                  {matches.length > 0
                    ? Math.max(...matches.map(m => m.finalScore || 0))
                    : 0}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Matches List */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2
              className={`text-2xl font-semibold ${
                isDarkMode ? 'text-white' : 'text-team-blue'
              }`}
            >
              Matches
            </h2>
            <Button onClick={handleAddMatch} className="bg-team-blue hover:bg-team-blue/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Match
            </Button>
          </div>

          {matches.length === 0 ? (
            <Card
              className={`${
                isDarkMode
                  ? 'border-team-blue-40 bg-team-dark'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <CardContent className="py-12 text-center">
                <p
                  className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
                >
                  No matches yet. Click "Add Match" to create one.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {matches.map((match, index) => (
                <Card
                  key={match.id}
                  className={`${
                    isDarkMode
                      ? 'border-team-blue-40 bg-team-dark hover:bg-team-dark-20'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  } transition-all`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              isDarkMode
                                ? 'bg-team-blue/20 text-team-blue'
                                : 'bg-team-blue/10 text-team-blue'
                            }`}
                          >
                            Match {index + 1}
                          </div>
                          <p
                            className={`text-sm ${
                              isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'
                            }`}
                          >
                            {match.matchType || 'Full Game'}
                          </p>
                          <p className="text-lg font-bold text-team-blue">
                            {match.finalScore || 0} pts
                          </p>
                        </div>
                        <div
                          className={`mt-2 text-xs ${
                            isDarkMode ? 'text-team-white-40' : 'text-gray-500'
                          }`}
                        >
                          Autonomous: {match.autonomousScore || 0} • TeleOp:{' '}
                          {match.teleOpScore || 0} • End Game:{' '}
                          {match.endGameScore || 0}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditMatch(match)}
                          className={`p-2 rounded-lg transition-colors ${
                            isDarkMode
                              ? 'text-team-white-60 hover:bg-team-blue/20'
                              : 'text-team-blue-40 hover:bg-team-blue/10'
                          }`}
                          title="Edit match"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMatch(match.id)}
                          disabled={deletingMatchId === match.id}
                          className={`p-2 rounded-lg transition-colors ${
                            deletingMatchId === match.id
                              ? 'opacity-50 cursor-not-allowed'
                              : isDarkMode
                                ? 'text-team-white-60 hover:bg-red-500/20'
                                : 'text-team-blue-40 hover:bg-red-500/10'
                          }`}
                          title="Delete match"
                        >
                          {deletingMatchId === match.id ? (
                            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
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

      {/* Match Form Modal */}
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
