import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession, useTheme, useAuth } from '@/contexts';
import { useFirebase } from '@/hooks';
import { GAME_TIMING, ROUTES } from '@/constants';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Match } from '@/types';

export const LivePreview = () => {
  const {
    sessionData,
    completeSession,
    timer,
    sessionTimer,
    isTimerRunning,
    setIsTimerRunning,
    formatTime,
    resetSession,
    resetTimer,
    setExpandedSection,
    updateSessionData,
    hasStarted,
    setHasStarted,
    showTeleopTransition,
    setShowTeleopTransition,
    hasTransitionedToTeleop,
    setHasTransitionedToTeleop,
    editingMatchId,
    returnToCurrentMatch,
    saveEditedMatch,
  } = useSession();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { createSession, loading } = useFirebase();
  const navigate = useNavigate();
  const [sessionLimitReached, setSessionLimitReached] =
    useState<boolean>(false);
  const [cancelConfirm, setCancelConfirm] = useState<boolean>(false);

  // Block navigation if there's unsaved work
  const hasUnsavedWork =
    !sessionData.isSessionCompleted &&
    ((sessionData.matches && sessionData.matches.length > 0) ||
      (sessionData.finalScore || 0) > 0 ||
      (sessionData.autonomousScore || 0) > 0 ||
      (sessionData.teleopScore || 0) > 0 ||
      (sessionData.notes && sessionData.notes.trim().length > 0) ||
      (sessionData.sessionName && sessionData.sessionName.trim().length > 0));

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedWork) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedWork]);

  // Check session limit on mount
  useEffect(() => {
    const checkSessionLimit = async () => {
      if (user?.uid && !sessionData.isSessionCompleted) {
        const { firebaseService } = await import('../services/firebaseService');
        const userSessions = await firebaseService.getUserSessions(user.uid);
        const { SESSION_LIMITS } = await import('../constants');

        if (userSessions.length >= SESSION_LIMITS.MAX_SESSIONS_PER_USER) {
          setSessionLimitReached(true);
          toast.error(
            `You've reached the maximum of ${SESSION_LIMITS.MAX_SESSIONS_PER_USER} sessions. Please delete old sessions before creating new ones.`,
            {
              duration: 10000,
            }
          );
        } else {
          setSessionLimitReached(false);
        }
      }
    };

    checkSessionLimit();
  }, [user?.uid, sessionData.isSessionCompleted]);

  // Real-time consistency calculation
  useEffect(() => {
    if (
      sessionData.matchType === 'Full Game' &&
      timer === GAME_TIMING.AUTONOMOUS_DURATION_SECONDS && // 30 seconds for autonomous phase
      isTimerRunning &&
      !hasTransitionedToTeleop
    ) {
      setIsTimerRunning(false);
      setShowTeleopTransition(true);
    }
  }, [
    timer,
    isTimerRunning,
    sessionData.matchType,
    hasTransitionedToTeleop,
    setIsTimerRunning,
    setShowTeleopTransition,
  ]);

  const handleContinueToTeleop = () => {
    setShowTeleopTransition(false);
    setHasTransitionedToTeleop(true);
    setExpandedSection('Teleop Score');
    // Don't reset timer - continue from autonomous phase
    setIsTimerRunning(true);
  };

  const handleSkipTeleop = () => {
    setShowTeleopTransition(false);
    setHasTransitionedToTeleop(true);
    // Don't auto-start timer or change section
  };

  const handleViewAnalysis = () => {
    navigate(ROUTES.ANALYSIS);
  };

  const handleNewSession = () => {
    // Check if there's unsaved work
    if (
      sessionData.matches &&
      sessionData.matches.length > 0 &&
      !sessionData.isSessionCompleted
    ) {
      if (
        !window.confirm(
          'You have unsaved matches. Starting a new session will discard them. Continue?'
        )
      ) {
        return;
      }
    }

    // Reset all session state (including sessionTimer)
    resetSession();
    // Clear any UI state for confirmations
    setCancelConfirm(false);
    // Stay on the current page to start a new session
  };

  const handleSaveMatch = () => {
    // Validate that timer was started
    if (!hasStarted) {
      toast.error('Please start the match timer before saving');
      return;
    }

    // Validate that some scoring data exists
    if (
      (sessionData.finalScore || 0) === 0 &&
      (sessionData.autonomousScore || 0) === 0 &&
      (sessionData.teleopScore || 0) === 0 &&
      (sessionData.endGameScore || 0) === 0
    ) {
      toast.error('Please enter some scoring data before saving a match');
      return;
    }

    // Create a new match from current session data
    const newMatch: Match = {
      id: crypto.randomUUID(),
      matchNumber: (sessionData.matches?.length || 0) + 1,
      matchType: sessionData.matchType,
      finalScore: sessionData.finalScore,
      autonomousScore: sessionData.autonomousScore,
      teleopScore: sessionData.teleopScore,
      endGameScore: sessionData.endGameScore,
      autonClassifiedArtifact: sessionData.autonClassifiedArtifact,
      autonOverflowArtifact: sessionData.autonOverflowArtifact,
      autonMotif: sessionData.autonMotif,
      autonBallsMissed: sessionData.autonBallsMissed,
      autonLeave: sessionData.autonLeave,
      teleClassifiedArtifact: sessionData.teleClassifiedArtifact,
      teleOverflowArtifact: sessionData.teleOverflowArtifact,
      teleMotif: sessionData.teleMotif,
      teleBallsMissed: sessionData.teleBallsMissed,
      robot1Park: sessionData.robot1Park,
      robot2Park: sessionData.robot2Park,
      cycleTimes: [...(sessionData.cycleTimes || [])],
      createdAt: new Date().toISOString(),
    };

    // Add to matches array
    const updatedMatches = [...(sessionData.matches || []), newMatch];
    updateSessionData({
      matches: updatedMatches,
      // Reset ALL scoring fields for next match
      finalScore: 0,
      autonomousScore: 0,
      teleopScore: 0,
      endGameScore: 0,
      autonLeave: 0,
      autonClassifiedArtifact: 0,
      autonOverflowArtifact: 0,
      autonMotif: 0,
      autonBallsMissed: 0,
      teleClassifiedArtifact: 0,
      teleOverflowArtifact: 0,
      teleMotif: 0,
      teleBallsMissed: 0,
      robot1Park: 'none',
      robot2Park: 'none',
      cycleTimes: [],
    });

    // Reset match timer and tracking states
    resetTimer();
    setHasStarted(false);
    setIsTimerRunning(false);
    setHasTransitionedToTeleop(false);

    toast.success(`Match ${updatedMatches.length} saved successfully!`);
  };

  const handleCompleteSession = async () => {
    // Validate user is authenticated
    if (!user?.uid) {
      toast.error('You must be logged in to save sessions');
      return;
    }

    // Validate that at least one match has been saved
    if (!sessionData.matches || sessionData.matches.length === 0) {
      toast.error(
        'Please save at least one match before completing the session'
      );
      return;
    }

    // Check if there's unsaved current match data
    const hasUnsavedData =
      (sessionData.finalScore || 0) > 0 ||
      (sessionData.autonomousScore || 0) > 0 ||
      (sessionData.teleopScore || 0) > 0 ||
      (sessionData.endGameScore || 0) > 0;

    if (hasUnsavedData) {
      toast.error(
        'Please save the current match before completing the session, or reset the scoring fields'
      );
      return;
    }

    // Check session limit
    const { firebaseService } = await import('../services/firebaseService');
    const userSessions = await firebaseService.getUserSessions(user.uid);
    const { SESSION_LIMITS } = await import('../constants');

    if (userSessions.length >= SESSION_LIMITS.MAX_SESSIONS_PER_USER) {
      toast.error(
        `You've reached the maximum of ${SESSION_LIMITS.MAX_SESSIONS_PER_USER} sessions. Please delete old sessions before creating new ones.`
      );
      return;
    }

    // Use sessionTimer for total session duration, not match timer
    const totalSessionTime = formatTime(sessionTimer);
    setIsTimerRunning(false);
    completeSession(totalSessionTime);

    // Generate a unique session name if not provided
    let finalSessionName = sessionData.sessionName?.trim();
    if (!finalSessionName) {
      // Find the next available number for "Untitled Session #X"
      const untitledSessions = userSessions.filter(s => 
        s.sessionName?.startsWith('Untitled Session #')
      );
      const numbers = untitledSessions
        .map(s => {
          const match = s.sessionName?.match(/Untitled Session #(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(n => !isNaN(n));
      const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
      finalSessionName = `Untitled Session #${nextNumber}`;
    }

    const sessionToSave = {
      sessionName: finalSessionName,
      matchType: sessionData.matchType || 'Full Game',
      sessionDuration: totalSessionTime,

      userId: user.uid, // Always set from validated user
      userEmail: user.email || '',

      // Don't save individual scoring fields - deprecated
      // Data is in matches array
      autonClassifiedArtifact: 0,
      autonOverflowArtifact: 0,
      autonMotif: 0,
      autonLeave: 0,

      teleClassifiedArtifact: 0,
      teleOverflowArtifact: 0,
      teleMotif: 0,

      finalScore: 0,
      autonomousScore: 0,
      teleopScore: 0,
      endGameScore: 0,

      selectedFeature: sessionData.selectedFeature || '',
      cycleTimes: [],
      notes: sessionData.notes || '',
      matches: sessionData.matches || [],

      completedAt: new Date().toISOString(),
    };

    try {
      const result = await createSession(sessionToSave);
      if (result && result.id) {
        toast.success('Session saved successfully!');
        // Session saved - sessionLimitReached will be checked on next action
      } else {
        toast.error('Failed to save session. Please try again.');
      }
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error saving session', error);
      toast.error('An error occurred while saving the session.');
    }
  };

  // Show persistent toast when editing a match
  useEffect(() => {
    if (editingMatchId) {
      const toastId = toast.warning("You're currently editing a saved match", {
        duration: Infinity,
        classNames: {
          toast: '!bg-yellow-950 !border-2 !border-yellow-500 !text-yellow-100',
          actionButton: '!bg-yellow-500 !text-black hover:!bg-yellow-400',
        },
        action: {
          label: 'Return to Current Match',
          onClick: () => {
            returnToCurrentMatch();
          },
        },
      });

      return () => {
        toast.dismiss(toastId);
      };
    }
  }, [editingMatchId, returnToCurrentMatch]);

  return (
    <div className="flex flex-col gap-8">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 w-full">
          {!sessionData.isSessionCompleted && (
            <>
              {showTeleopTransition ? (
                <>
                  <button
                    onClick={handleContinueToTeleop}
                    className={`flex-1 min-w-[160px] px-4 py-2.5 rounded-lg border border-team-blue bg-team-blue text-sm font-medium hover:bg-team-blue/90 transition-colors ${
                      isDarkMode ? 'text-black' : 'text-white'
                    }`}
                  >
                    Continue into Teleop
                  </button>
                  <button
                    onClick={handleSkipTeleop}
                    className={`flex-1 min-w-[160px] px-4 py-2.5 rounded-lg border border-team-blue bg-transparent text-team-blue text-sm font-medium transition-colors ${isDarkMode ? 'hover:bg-team-blue/10' : 'hover:bg-team-blue hover:text-[#FEFEFE]'}`}
                  >
                    Skip / End Autonomous Only
                  </button>
                </>
              ) : (
                <>
                  {editingMatchId ? (
                    <>
                      <button
                        onClick={() => {
                          saveEditedMatch();
                          toast.success('Match changes saved!');
                        }}
                        className="flex-1 min-w-[140px] px-4 py-2.5 rounded-lg border border-green-600 bg-green-600 text-[#FEFEFE] text-sm font-semibold hover:bg-green-700 transition-colors"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={returnToCurrentMatch}
                        className="flex-1 min-w-[140px] px-4 py-2.5 rounded-lg border-2 border-yellow-500 bg-yellow-400 text-[#191919] text-sm font-semibold hover:bg-yellow-300 transition-colors"
                      >
                        Return to Current Match
                      </button>
                    </>
                  ) : !hasStarted ? (
                    <button
                      onClick={() => {
                        setHasStarted(true);
                      }}
                      className="flex-1 min-w-[160px] px-4 py-2.5 rounded-lg border border-green-600 bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      Start New Match
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                        className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg border ${isTimerRunning ? 'border-red-500 bg-red-500' : 'border-blue-500 bg-blue-500'} text-[#FEFEFE] text-sm font-medium ${isTimerRunning ? 'hover:bg-red-600' : 'hover:bg-blue-600'} transition-colors`}
                      >
                        {isTimerRunning
                          ? 'Stop / Pause'
                          : timer === 0
                            ? 'Start Timer'
                            : 'Resume'}
                      </button>
                      <button
                        onClick={handleSaveMatch}
                        className="flex-1 min-w-[140px] px-4 py-2.5 rounded-lg border border-green-600 bg-green-600 text-[#FEFEFE] text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        Save Match
                      </button>
                    </>
                  )}
                </>
              )}

              <button
                onClick={handleCompleteSession}
                disabled={loading || sessionLimitReached}
                className={`flex-1 min-w-[160px] px-4 py-2.5 rounded-lg border border-team-blue bg-transparent text-team-blue text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'hover:bg-team-blue/10' : 'hover:bg-team-blue hover:text-[#FEFEFE]'}`}
              >
                {loading
                  ? 'Saving...'
                  : sessionLimitReached
                    ? 'Session Limit Reached'
                    : 'Complete Session'}
              </button>

              {!cancelConfirm ? (
                <button
                  onClick={() => {
                    setCancelConfirm(true);
                    if (isTimerRunning) setIsTimerRunning(false);
                  }}
                  className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg border border-red-500 bg-transparent text-red-500 text-sm font-medium transition-colors ${isDarkMode ? 'hover:bg-red-500/10' : 'hover:bg-red-500 hover:text-[#FEFEFE]'}`}
                >
                  Cancel Session
                </button>
              ) : (
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      handleNewSession();
                      setCancelConfirm(false);
                      toast.success('Session cancelled');
                    }}
                    className="p-2 rounded bg-green-500 hover:bg-green-600 text-white transition-all"
                    title="Confirm cancel"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      setCancelConfirm(false);
                      if (hasStarted) setIsTimerRunning(true);
                    }}
                    className="p-2 rounded bg-red-500 hover:bg-red-600 text-white transition-all"
                    title="Keep session"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </>
          )}

          {sessionData.isSessionCompleted && (
            <>
              <button
                onClick={handleViewAnalysis}
                disabled={loading}
                className={`flex-1 min-w-[160px] px-4 py-2.5 rounded-lg border border-team-white-20 bg-team-blue ${isDarkMode ? 'text-black' : 'text-[#FEFEFE]'} text-sm font-medium text-center hover:bg-team-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Loading...' : 'View Full Analysis Report'}
              </button>

              <button
                onClick={handleNewSession}
                className={`flex-1 min-w-[160px] px-4 py-2.5 rounded-lg border border-team-blue bg-transparent text-team-blue text-sm font-medium transition-colors ${isDarkMode ? 'hover:bg-team-blue/10' : 'hover:bg-team-blue hover:text-[#FEFEFE]'}`}
              >
                New Session
              </button>
            </>
          )}
      </div>
    </div>
  );
};
