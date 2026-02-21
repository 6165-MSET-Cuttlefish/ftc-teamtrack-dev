import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession, useTheme, useAuth, useTeam } from '@/contexts';
import { useFirebase } from '@/hooks';
import { GAME_TIMING, ROUTES } from '@/constants';
import { Check, X, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { MotifSetupDialog } from './MotifSetupDialog';
import type { Match } from '@/types';
import type { ScoringFields } from '@/types';

interface LivePreviewProps {
  onOpenSessionSetup?: () => void;
  onTryStartWithoutSetup?: () => void;
  isSessionSetupSaved?: boolean;
}

export const LivePreview = ({
  onOpenSessionSetup,
  onTryStartWithoutSetup,
  isSessionSetupSaved = false,
}: LivePreviewProps) => {
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
    setHasTransitionedToTeleop,
    matchPhase,
    setMatchPhase,
    setPhaseTimer,
    editingMatchId,
    saveEditedMatch,
    startEditingMatch,
    matchActive,
    setMatchActive,
    skipToTeleop,
  } = useSession();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { team } = useTeam();
  const { createSession, loading } = useFirebase();
  const navigate = useNavigate();
  const [sessionLimitReached, setSessionLimitReached] =
    useState<boolean>(false);
  const [cancelConfirm, setCancelConfirm] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [cancelMatchConfirm, setCancelMatchConfirm] = useState<boolean>(false);
  const [newSessionConfirm, setNewSessionConfirm] = useState<boolean>(false);
  const [showMotifDialog, setShowMotifDialog] = useState<boolean>(false);
  const [pendingEditMatch, setPendingEditMatch] = useState<Match | null>(null);
  const [showUnsavedEditWarning, setShowUnsavedEditWarning] = useState<boolean>(false);

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
        const { firebaseService } = await import('@/services/firebaseService');
        const { SESSION_LIMITS } = await import('@/constants');

        const sessions = team
          ? await firebaseService.getTeamSessions(team.id)
          : await firebaseService.getUserSessions(user.uid);

        const sessionLimit = team
          ? SESSION_LIMITS.MAX_SESSIONS_PER_USER * 5
          : SESSION_LIMITS.MAX_SESSIONS_PER_USER;

        if (sessions.length >= sessionLimit) {
          setSessionLimitReached(true);
          toast.error(
            `You've reached the maximum of ${sessionLimit} sessions. Please delete old sessions before creating new ones.`,
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
  }, [user?.uid, sessionData.isSessionCompleted, team]);

  // FTC phase transition: autonomous → controller pickup (only for Full Game)
  // For Autonomous mode: no transition, timer just counts down to 0
  // For Teleop mode: starts in teleop phase, no transition needed
  useEffect(() => {
    // Only transition for Full Game mode
    if (
      sessionData.matchType === 'Full Game' &&
      timer === GAME_TIMING.AUTON_END_REMAINING && // 120 seconds remaining = end of autonomous
      isTimerRunning &&
      matchPhase === 'auton'
    ) {
      setIsTimerRunning(false);
      setMatchPhase('controller_pickup');
      setPhaseTimer(GAME_TIMING.CONTROLLER_PICKUP_SECONDS);
    }
  }, [
    timer,
    isTimerRunning,
    sessionData.matchType,
    matchPhase,
    setIsTimerRunning,
    setMatchPhase,
    setPhaseTimer,
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
      setNewSessionConfirm(true);
      return;
    }

    // Reset all session state (including sessionTimer)
    resetSession();
    // Clear any UI state for confirmations
    setCancelConfirm(false);
    setNewSessionConfirm(false);
    // Stay on the current page to start a new session
  };

  const handleConfirmNewSession = () => {
    resetSession();
    setCancelConfirm(false);
    setNewSessionConfirm(false);
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
      // Extract cycle times from shots - get all defined cycleTime values
      cycleTimes: [
        ...((sessionData.autonShots || [])
          .map(s => s.cycleTime)
          .filter((ct): ct is number => ct !== undefined)),
        ...((sessionData.teleopShots || [])
          .map(s => s.cycleTime)
          .filter((ct): ct is number => ct !== undefined)),
        ...(sessionData.cycleTimes || []),
      ],
      autonShots: [...(sessionData.autonShots || [])],
      teleopShots: [...(sessionData.teleopShots || [])],
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
      gateBallCount: 0,
      motifPattern: ['empty', 'empty', 'empty'],
      cycleTimes: [],
      autonShots: [],
      teleopShots: [],
    });

    // Reset match timer and tracking states (but keep session running)
    resetTimer();
    // Keep hasStarted=true to maintain continuous sessionTimer
    setMatchActive(false);
    setIsTimerRunning(false);
    setHasTransitionedToTeleop(false);

    toast.success(`Match ${updatedMatches.length} saved successfully!`);
  };

  const handleMotifDialogConfirm = (pattern: ScoringFields['motifPattern']) => {
    // Pattern is confirmed and all slots are filled — just save the pattern
    updateSessionData({ motifPattern: pattern });
    setShowMotifDialog(false);
    // Match is NOT started here — user clicks "Start Match" after motif is set
  };

  const handleMotifDialogCancel = () => {
    setShowMotifDialog(false);
  };

  const handleCompleteSession = async () => {
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

    // Check session limit for authenticated users
    let userSessions: { sessionName?: string }[] = [];
    if (user?.uid) {
      const { firebaseService } = await import('@/services/firebaseService');
      const { SESSION_LIMITS } = await import('@/constants');

      // Use team-aware limit check (consistent with mount check)
      const sessions = team
        ? await firebaseService.getTeamSessions(team.id)
        : await firebaseService.getUserSessions(user.uid);
      userSessions = sessions;

      const sessionLimit = team
        ? SESSION_LIMITS.MAX_SESSIONS_PER_USER * 5
        : SESSION_LIMITS.MAX_SESSIONS_PER_USER;

      if (sessions.length >= sessionLimit) {
        toast.error(
          `You've reached the maximum of ${sessionLimit} sessions. Please delete old sessions before creating new ones.`
        );
        return;
      }
    } else {
      // Guest: load sessions from localStorage for naming
      const GUEST_SESSIONS_KEY = 'teamtrack-guest-sessions';
      userSessions = JSON.parse(localStorage.getItem(GUEST_SESSIONS_KEY) || '[]');
    }

    // Use sessionTimer for total session duration, not match timer
    const totalSessionTime = formatTime(sessionTimer);
    setIsTimerRunning(false);

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

      userId: user?.uid || localStorage.getItem('teamtrack-guest-id') || 'guest',
      userEmail: user?.email || '',
      ...(team ? { teamId: team.id } : {}),

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
      if (user?.uid) {
        // Authenticated user: save to Firebase
        const result = await createSession(sessionToSave);
        if (result && result.id) {
          // Only mark session complete after successful save
          completeSession(totalSessionTime);
          toast.success('Session saved successfully!');
        } else {
          toast.error('Failed to save session. Please try again.');
          setIsTimerRunning(false); // Keep timer stopped but don't clear data
          return;
        }
      } else {
        // Guest user: save session to localStorage
        const GUEST_SESSIONS_KEY = 'teamtrack-guest-sessions';
        const existing = JSON.parse(localStorage.getItem(GUEST_SESSIONS_KEY) || '[]');
        const guestSession = {
          ...sessionToSave,
          id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          createdAt: new Date().toISOString(),
        };
        existing.unshift(guestSession);
        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify(existing));
        // Only mark session complete after successful save
        completeSession(totalSessionTime);
        toast.success('Session saved locally!');
      }

      // Mark that user has completed a session (drives landing page redirect)
      const { markSessionCompleted } = await import('@/lib/sessionStorage');
      markSessionCompleted();
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error saving session', error);
      toast.error('An error occurred while saving the session. Your data is preserved — please try again.');
    }
  };

  // Delete a saved match from the matches array
  const handleDeleteMatch = (matchId: string) => {
    const updatedMatches = (sessionData.matches || []).filter(
      m => m.id !== matchId
    );
    // Renumber matches
    const renumbered = updatedMatches.map((m, i) => ({
      ...m,
      matchNumber: i + 1,
    }));
    updateSessionData({ matches: renumbered });
    setDeleteConfirmId(null);
    toast.success('Match deleted');
  };

  // Cancel the current in-progress match (discard unsaved scoring)
  const handleCancelCurrentMatch = () => {
    updateSessionData({
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
      gateBallCount: 0,
      motifPattern: ['empty', 'empty', 'empty'],
      cycleTimes: [],
      autonShots: [],
      teleopShots: [],
    });
    resetTimer();
    setHasStarted(false);
    setMatchActive(false);
    setIsTimerRunning(false);
    setHasTransitionedToTeleop(false);
    setCancelMatchConfirm(false);
    toast.success('Current match discarded');
  };

  return (
    <div className="flex flex-col gap-8">
      {/* New Streamlined Action Buttons */}
      {!sessionData.isSessionCompleted ? (
        <>
          <div className="flex items-center gap-3 w-full">
            {/* Save Match / Start Match Button */}
            {!showTeleopTransition && !editingMatchId && (
              <button
                type="button"
                onKeyDown={(e) => {
                  // Prevent Enter from triggering the button during keybinds
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                onClick={
                  !matchActive
                    ? () => {
                        if (!isSessionSetupSaved && !sessionData.sessionName?.trim()) {
                          onTryStartWithoutSetup?.();
                          return;
                        }
                        const motifIsSet = sessionData.motifPattern && !sessionData.motifPattern.every((c: string) => c === 'empty');
                        if (!motifIsSet) {
                          // Step 1: open motif dialog to set pattern first
                          setShowMotifDialog(true);
                        } else {
                          // Step 2: motif already set, start the match
                          setHasStarted(true);
                          setMatchActive(true);
                          if (sessionData.matchType === 'Teleop') {
                            setMatchPhase('teleop');
                          } else {
                            setMatchPhase('auton');
                          }
                          setIsTimerRunning(true);
                          window.dispatchEvent(new Event('teamtrack-match-started'));
                        }
                      }
                    : handleSaveMatch
                }
                disabled={!matchActive && !sessionData.sessionName?.trim()}
                title={
                  !matchActive && !sessionData.sessionName?.trim()
                    ? 'Complete session setup (Session Name) before starting'
                    : ''
                }
                className={`flex-1 px-6 py-4 h-16 rounded-2xl border-2 text-lg font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  !matchActive && isSessionSetupSaved
                    ? 'border-green-500/40 bg-green-500/20 hover:bg-green-500/30 text-green-600 disabled:hover:bg-green-500/20'
                    : 'border-team-blue-40 bg-team-blue/10 hover:bg-team-blue/20 text-team-blue disabled:hover:bg-team-blue/10'
                }`}
              >
                {!matchActive
                  ? (sessionData.motifPattern && !sessionData.motifPattern.every((c: string) => c === 'empty')
                    ? 'Start Match'
                    : 'Set Motif')
                  : 'Save Match'}
              </button>
            )}

            {/* Teleop Transition Buttons */}
            {showTeleopTransition && (
              <>
                <button
                  type="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  onClick={handleContinueToTeleop}
                  className={`flex-1 px-6 py-4 h-16 rounded-2xl bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'} text-lg font-bold transition-colors flex items-center justify-center`}
                >
                  Continue into Teleop
                </button>
                <button
                  type="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  onClick={handleSkipTeleop}
                  className={`flex-1 px-6 py-4 h-16 rounded-2xl border-2 border-team-blue bg-transparent text-team-blue text-lg font-bold transition-colors flex items-center justify-center ${isDarkMode ? 'hover:bg-team-blue/10' : 'hover:bg-team-blue hover:text-black'}`}
                >
                  Skip / End Autonomous Only
                </button>
              </>
            )}

            {/* Editing Match Buttons */}
            {editingMatchId && (
              <>
                <button
                  type="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  onClick={() => {
                    saveEditedMatch();
                    toast.success('Match changes saved!');
                    setShowUnsavedEditWarning(false);
                    setPendingEditMatch(null);
                  }}
                  className="flex-1 py-4 h-16 rounded-2xl border-2 border-green-500/40 bg-green-500/20 hover:bg-green-500/30 text-green-600 text-lg font-bold transition-colors flex items-center justify-center"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  onClick={() => {
                    setPendingEditMatch(null);
                    setShowUnsavedEditWarning(true);
                  }}
                  className="flex-1 py-4 h-16 rounded-2xl border-2 border-yellow-500/40 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-600 text-lg font-bold transition-colors flex items-center justify-center"
                >
                  Cancel
                </button>
              </>
            )}

            {/* Unsaved Edit Warning Banner */}
            {showUnsavedEditWarning && (
              <div className={`rounded-2xl border-2 border-orange-500/60 bg-orange-500/15 px-4 py-4 h-16 flex items-center`}>
                <p className={`text-xs font-semibold ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>
                  You have unsaved changes. Please save or cancel before switching matches.
                </p>
              </div>
            )}

            {/* Settings/Gear Icon - Opens Session Setup */}
            <button
              type="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              onClick={onOpenSessionSetup}
              className={`flex-1 py-4 h-16 rounded-2xl border-2 border-team-blue-40 transition-colors flex items-center justify-center ${
                isDarkMode
                  ? 'bg-team-dark hover:bg-[#2a2a2a]'
                  : 'bg-white hover:bg-gray-50'
              }`}
              title="Edit Session Setup"
            >
              <Settings
                className={`h-6 w-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
              />
            </button>

            {/* Complete Session Button */}
            <button
              type="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              onClick={handleCompleteSession}
              disabled={loading || sessionLimitReached}
              className="flex-1 py-4 h-16 rounded-2xl border-2 border-green-500/40 bg-green-500/20 hover:bg-green-500/30 text-green-600 text-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              title={
                loading
                  ? 'Saving...'
                  : sessionLimitReached
                    ? 'Session Limit Reached'
                    : 'Complete Session'
              }
            >
              {loading ? 'Saving...' : 'Complete Session'}
            </button>

            {/* Cancel Session Button */}
            {!cancelConfirm ? (
              <button
                type="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                onClick={() => {
                  setCancelConfirm(true);
                  if (isTimerRunning) setIsTimerRunning(false);
                }}
                className="flex-1 py-4 h-16 rounded-2xl border-2 border-red-500/40 bg-red-500/20 hover:bg-red-500/30 text-red-600 text-lg font-bold transition-colors flex items-center justify-center"
                title="Cancel Session"
              >
                Cancel Session
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  onClick={() => {
                    handleNewSession();
                    setCancelConfirm(false);
                    toast.success('Session cancelled');
                  }}
                  className="py-4 px-4 rounded-xl bg-red-500 hover:bg-red-600 transition-colors"
                  title="Confirm cancel — discard session"
                >
                  <Check className="h-5 w-5 text-white" />
                </button>
                <button
                  type="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  onClick={() => {
                    setCancelConfirm(false);
                    if (hasStarted) setIsTimerRunning(true);
                  }}
                  className="py-4 px-4 rounded-xl bg-gray-500 hover:bg-gray-600 transition-colors"
                  title="Keep session"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            )}
          </div>

          {/* Match Control Buttons */}
          {!editingMatchId && matchActive && (
            <div className="flex items-center gap-3">
              {/* Pause/Resume controls - only when match is active */}
              {matchActive && isTimerRunning && (
                <button
                  type="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  onClick={() => setIsTimerRunning(false)}
                  className="px-4 py-2 rounded-xl border-2 border-yellow-500/40 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <span>⏸</span>
                  Pause Match
                </button>
              )}
              {matchActive &&
                !isTimerRunning &&
                (matchPhase === 'auton' || matchPhase === 'teleop') && (
                  <button
                    type="button"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                    onClick={() => setIsTimerRunning(true)}
                    className="px-4 py-2 rounded-xl border-2 border-team-blue-40 bg-team-blue-10 hover:bg-team-blue-40 text-team-blue text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    <span>▶</span>
                    Resume Match
                  </button>
                )}

              {/* Skip to Teleop Button - Only show during Full Game autonomous phases */}
              {matchActive && sessionData.matchType === 'Full Game' && 
               (matchPhase === 'auton' || matchPhase === 'controller_pickup' || matchPhase === 'prepare') && (
                <button
                  type="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  onClick={skipToTeleop}
                  className="px-4 py-2 rounded-xl border-2 border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <span>⏭</span>
                  Skip to Teleop
                </button>
              )}

              {/* Cancel Current Match Button */}
              {matchActive && (
                <>
                  {!cancelMatchConfirm ? (
                    <button
                      type="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      onClick={() => setCancelMatchConfirm(true)}
                      className="px-4 py-2 rounded-xl border-2 border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-semibold transition-colors flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Cancel Current Match
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                      >
                        Discard this match?
                      </span>
                      <button
                        type="button"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                          }
                        }}
                        onClick={handleCancelCurrentMatch}
                        className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
                      >
                        Yes, Discard
                      </button>
                      <button
                        type="button"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                          }
                        }}
                        onClick={() => setCancelMatchConfirm(false)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-colors ${
                          isDarkMode
                            ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        No, Keep
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Match Log */}
          {(sessionData.matches || []).length > 0 && (
            <div
              className={`rounded-2xl border-2 overflow-hidden ${
                isDarkMode
                  ? 'border-gray-700 bg-team-dark'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div
                className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${
                  isDarkMode
                    ? 'text-gray-400 border-b border-gray-700'
                    : 'text-gray-500 border-b border-gray-200'
                }`}
              >
                Match Log
              </div>
              <div
                className={`divide-y overflow-y-auto ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}
                style={{ maxHeight: '158px' }}
              >
                {(sessionData.matches || []).map(match => {
                  const isEditing = editingMatchId === match.id;
                  const isConfirmingDelete = deleteConfirmId === match.id;
                  return (
                    <div
                      key={match.id}
                      className={`flex items-center justify-between px-4 py-3 transition-colors cursor-pointer ${
                        isEditing
                          ? 'bg-yellow-400/50'
                          : isDarkMode
                            ? 'hover:bg-gray-800'
                            : 'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        if (!isEditing && !isConfirmingDelete) {
                          if (editingMatchId) {
                            // Already editing a different match — warn first
                            setPendingEditMatch(match);
                            setShowUnsavedEditWarning(true);
                          } else {
                            startEditingMatch(match);
                          }
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm font-bold ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          Match {match.matchNumber}
                        </span>
                        <span
                          className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                        >
                          Score: {match.finalScore ?? 0}
                        </span>
                        <span
                          className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                        >
                          A:{match.autonomousScore ?? 0} T:
                          {match.teleopScore ?? 0} E:{match.endGameScore ?? 0}
                        </span>
                        {isEditing && (
                          <span className="text-sm font-bold text-yellow-900 bg-yellow-400 px-3 py-1 rounded-full shadow-lg">
                            Editing
                          </span>
                        )}
                      </div>
                      <div
                        className="flex items-center gap-1"
                        onClick={e => e.stopPropagation()}
                      >
                        {!isConfirmingDelete ? (
                          <button
                            onClick={() => setDeleteConfirmId(match.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isDarkMode
                                ? 'hover:bg-red-500/20 text-gray-500 hover:text-red-400'
                                : 'hover:bg-red-50 text-gray-400 hover:text-red-500'
                            }`}
                            title="Delete match"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteMatch(match.id)}
                              className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                              title="Confirm delete"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isDarkMode
                                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                  : 'bg-gray-200 hover:bg-gray-300 text-black'
                              }`}
                              title="Cancel delete"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Completed Session Buttons */
        <div className="flex flex-wrap gap-4 w-full">
          <button
            onClick={handleViewAnalysis}
            disabled={loading}
            className={`flex-1 min-w-[160px] px-6 py-4 h-16 rounded-2xl border-2 border-team-blue-40 bg-team-blue/10 hover:bg-team-blue/20 text-team-blue text-lg font-bold transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? 'Loading...' : 'View Full Analysis Report'}
          </button>

          <button
            onClick={handleNewSession}
            className={`flex-1 min-w-[160px] px-6 py-4 h-16 rounded-2xl border-2 border-green-500/40 bg-green-500/20 hover:bg-green-500/30 text-green-600 text-lg font-bold transition-colors flex items-center justify-center`}
          >
            New Session
          </button>
          {newSessionConfirm && (
            <div className={`flex-1 min-w-[240px] flex items-center gap-2 px-4 py-2.5 rounded-lg border ${isDarkMode ? 'border-red-500/40 bg-red-500/10' : 'border-red-300 bg-red-50'}`}>
              <span className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>Discard unsaved matches?</span>
              <button
                onClick={handleConfirmNewSession}
                className="px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors"
              >
                Yes, Discard
              </button>
              <button
                onClick={() => setNewSessionConfirm(false)}
                className={`px-3 py-1 rounded border text-xs font-bold transition-colors ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Motif Setup Dialog */}
      <MotifSetupDialog
        isOpen={showMotifDialog}
        onConfirm={handleMotifDialogConfirm}
        onCancel={handleMotifDialogCancel}
        initialPattern={sessionData.motifPattern ?? ['empty', 'empty', 'empty']}
      />
    </div>
  );
};
