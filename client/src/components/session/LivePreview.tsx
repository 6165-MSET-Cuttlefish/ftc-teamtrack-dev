import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession, useTheme, useAuth, useTeam } from '@/contexts';
import { useFirebase } from '@/hooks';
import { GAME_TIMING, ROUTES, STORAGE_KEYS } from '@/constants';
import { Check, X, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { MotifSetupDialog } from './MotifSetupDialog';
import type { Match } from '@/types';
import type { ScoringFields } from '@/types';

interface LivePreviewProps {
  onOpenSessionSetup?: () => void;
  onTryStartWithoutSetup?: () => void;
  isSessionSetupSaved?: boolean;
  onSessionReset?: () => void;
}

export const LivePreview = ({
  onOpenSessionSetup,
  onTryStartWithoutSetup,
  isSessionSetupSaved = false,
  onSessionReset,
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
  const [sessionWasCancelled, setSessionWasCancelled] = useState<boolean>(false);
  const [, setPendingEditMatch] = useState<Match | null>(null);
  const [showUnsavedEditWarning, setShowUnsavedEditWarning] = useState<boolean>(false);
  const preMatchDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ref = preMatchDelayRef;
    return () => {
      if (ref.current) {
        clearTimeout(ref.current);
      }
    };
  }, []);

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
    if (
      sessionData.matches &&
      sessionData.matches.length > 0 &&
      !sessionData.isSessionCompleted
    ) {
      setNewSessionConfirm(true);
      return;
    }

    resetSession();
    onSessionReset?.();
    setCancelConfirm(false);
    setNewSessionConfirm(false);
    setSessionWasCancelled(false);
  };

  const handleConfirmNewSession = () => {
    resetSession();
    onSessionReset?.();
    setCancelConfirm(false);
    setNewSessionConfirm(false);
    setSessionWasCancelled(false);
  };

  const handleSaveMatch = () => {
    if (!hasStarted) {
      toast.error('Please start the match timer before saving');
      return;
    }

    if (
      (sessionData.finalScore || 0) === 0 &&
      (sessionData.autonomousScore || 0) === 0 &&
      (sessionData.teleopScore || 0) === 0 &&
      (sessionData.endGameScore || 0) === 0
    ) {
      toast.error('Please enter some scoring data before saving a match');
      return;
    }

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
      gateEnabled: sessionData.gateEnabled,
    };

    const updatedMatches = [...(sessionData.matches || []), newMatch];
    updateSessionData({
      matches: updatedMatches,
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
      motifPattern: sessionData.motifPattern !== undefined ? ['empty', 'empty', 'empty'] : undefined,
      cycleTimes: [],
      autonShots: [],
      teleopShots: [],
    });

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
    if (!sessionData.matches || sessionData.matches.length === 0) {
      toast.error(
        'Please save at least one match before completing the session'
      );
      return;
    }

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

    let userSessions: { sessionName?: string }[] = [];
    if (user?.uid) {
      const { firebaseService } = await import('@/services/firebaseService');
      const { SESSION_LIMITS } = await import('@/constants');

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
      userSessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.GUEST_SESSIONS) || '[]');
    }

    const totalSessionTime = formatTime(sessionTimer);
    setIsTimerRunning(false);

    let finalSessionName = sessionData.sessionName?.trim();
    if (!finalSessionName) {
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
        const result = await createSession(sessionToSave);
        if (result && result.id) {
          completeSession(totalSessionTime);
          toast.success('Session saved successfully!');
        } else {
          toast.error('Failed to save session. Please try again.');
          setIsTimerRunning(false); // Keep timer stopped but don't clear data
          return;
        }
      } else {
        const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.GUEST_SESSIONS) || '[]');
        const guestSession = {
          ...sessionToSave,
          id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          createdAt: new Date().toISOString(),
        };
        existing.unshift(guestSession);
        localStorage.setItem(STORAGE_KEYS.GUEST_SESSIONS, JSON.stringify(existing));
        completeSession(totalSessionTime);
        toast.success('Session saved locally!');
      }

      const { markSessionCompleted } = await import('@/lib/sessionPersistence');
      markSessionCompleted();
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error('Error saving session', error);
      toast.error('An error occurred while saving the session. Your data is preserved — please try again.');
    }
  };

  const handleDeleteMatch = (matchId: string) => {
    const updatedMatches = (sessionData.matches || []).filter(
      m => m.id !== matchId
    );
    const renumbered = updatedMatches.map((m, i) => ({
      ...m,
      matchNumber: i + 1,
    }));
    updateSessionData({ matches: renumbered });
    setDeleteConfirmId(null);
    toast.success('Match deleted');
  };

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
      motifPattern: sessionData.motifPattern !== undefined ? ['empty', 'empty', 'empty'] : undefined,
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
      {!sessionData.isSessionCompleted ? (
        <>
          <div className="flex items-center gap-3 w-full">
            {!showTeleopTransition && !editingMatchId && (
              <button
                  type="button"
                  onKeyDown={(e) => {
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
                          const hasMotifEnabled = sessionData.motifPattern !== undefined;
                          const motifPurpleCount = sessionData.motifPattern?.filter(c => c === 'purple').length ?? 0;
                          const motifGreenCount = sessionData.motifPattern?.filter(c => c === 'green').length ?? 0;
                          const motifIsProperlySet = motifPurpleCount === 2 && motifGreenCount === 1;
                          
                          if (hasMotifEnabled && !motifIsProperlySet) {
                            setShowMotifDialog(true);
                          } else {
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
                    !matchActive && !isSessionSetupSaved
                      ? 'Save session settings before starting'
                      : !matchActive && !sessionData.sessionName?.trim()
                        ? 'Complete session setup (Session Name) before starting'
                        : ''
                  }
                  className={`w-full px-6 py-4 h-16 rounded-2xl border-2 text-lg font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    !matchActive && isSessionSetupSaved
                      ? 'border-green-500/40 bg-green-500/20 hover:bg-green-500/30 text-green-600 disabled:hover:bg-green-500/20'
                      : 'border-team-blue-40 bg-team-blue/10 hover:bg-team-blue/20 text-team-blue disabled:hover:bg-team-blue/10'
                  }`}
                >
                  {!matchActive
                    ? (() => {
                        const hasMotifEnabled = sessionData.motifPattern !== undefined;
                        const motifPurpleCount = sessionData.motifPattern?.filter(c => c === 'purple').length ?? 0;
                        const motifGreenCount = sessionData.motifPattern?.filter(c => c === 'green').length ?? 0;
                        const motifIsProperlySet = motifPurpleCount === 2 && motifGreenCount === 1;
                        return hasMotifEnabled && !motifIsProperlySet ? 'Set Motif' : 'Start Match';
                      })()
                    : 'Save Match'}
                </button>
              )}

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

            {showUnsavedEditWarning && (
              <div className={`rounded-2xl border-2 border-orange-500/60 bg-orange-500/15 px-4 py-4 h-16 flex items-center`}>
                <p className={`text-xs font-semibold ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>
                  You have unsaved changes. Please save or cancel before switching matches.
                </p>
              </div>
            )}

            <button
              type="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              onClick={onOpenSessionSetup}
              className={`w-16 h-16 shrink-0 rounded-2xl border-2 transition-colors flex items-center justify-center ${
                !isSessionSetupSaved
                  ? 'border-red-500/60 bg-red-500/20 hover:bg-red-500/30'
                  : isDarkMode
                    ? 'border-team-blue-40 bg-team-dark hover:bg-[#2a2a2a]'
                    : 'border-team-blue-40 bg-white hover:bg-gray-50'
              }`}
              title="Edit Session Setup"
            >
              <Settings
                className={`h-5 w-5 ${!isSessionSetupSaved ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-black'}`}
              />
            </button>

            {sessionWasCancelled ? (
              <button
                type="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                onClick={() => {
                  resetSession();
                  onSessionReset?.();
                  setSessionWasCancelled(false);
                }}
                className="shrink-0 whitespace-nowrap px-5 h-16 rounded-2xl border-2 border-green-500/40 bg-green-500/20 hover:bg-green-500/30 text-green-600 text-lg font-bold transition-colors flex items-center justify-center"
                title="Start a new session"
              >
                New Session
              </button>
            ) : (
              <button
                type="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                onClick={handleCompleteSession}
                disabled={loading || sessionLimitReached}
                className="shrink-0 whitespace-nowrap px-5 h-16 rounded-2xl border-2 border-green-500/40 bg-green-500/20 hover:bg-green-500/30 text-green-600 text-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
            )}

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
                className="shrink-0 whitespace-nowrap px-5 h-16 rounded-2xl border-2 border-red-500/40 bg-red-500/20 hover:bg-red-500/30 text-red-600 text-lg font-bold transition-colors flex items-center justify-center"
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
                    resetSession();
                    setSessionWasCancelled(true);
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

          {!editingMatchId && matchActive && (
            <div className="flex items-center gap-3">
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

              {matchActive && sessionData.matchType === 'Full Game' && 
               (matchPhase === 'auton' || matchPhase === 'controller_pickup') && (
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

      {sessionData.motifPattern !== undefined && (
        <MotifSetupDialog
          isOpen={showMotifDialog}
          onConfirm={handleMotifDialogConfirm}
          onCancel={handleMotifDialogCancel}
          initialPattern={sessionData.motifPattern ?? ['empty', 'empty', 'empty']}
        />
      )}
    </div>
  );
};
