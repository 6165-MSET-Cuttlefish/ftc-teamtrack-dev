import { useState, useEffect } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { useSession, useTheme, useAuth } from '@/contexts';
import { useFirebase } from '@/hooks';
import { GAME_TIMING } from '@/constants';
import { toast } from 'sonner';
import type { Match } from '@/types';

const DataCard = ({ value, label }: { value: string; label: string }) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`flex flex-col items-center gap-4 px-9 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue/60 bg-[#FEFEFE]'}`}
    >
      <div className="text-team-blue text-3xl font-medium leading-6">
        {value}
      </div>
      <div
        className={
          isDarkMode
            ? 'text-team-white-60 text-base leading-6'
            : 'text-team-blue-40 text-base leading-6'
        }
      >
        {label}
      </div>
    </div>
  );
};

export const LivePreview = () => {
  const {
    sessionData,
    completeSession,
    timer,
    isTimerRunning,
    setIsTimerRunning,
    formatTime,
    resetSession,
    resetTimer,
    setExpandedSection,
    updateSessionData,
  } = useSession();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { createSession, loading } = useFirebase();
  const navigate = useNavigate();
  const [, setSavedSessionId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [showTeleOpTransition, setShowTeleOpTransition] =
    useState<boolean>(false);
  const [hasTransitionedToTeleOp, setHasTransitionedToTeleOp] =
    useState<boolean>(false);
  const [sessionLimitReached, setSessionLimitReached] = useState<boolean>(false);

  // Two timers:
  // - sessionTimer: Total time since page load (overall session duration)
  // - timer: Current match timer (from useSession context, resets per match)
  const [sessionTimer, setSessionTimer] = useState<number>(0);
  const [sessionLimitChecked, setSessionLimitChecked] = useState(false);

  // Block navigation if there's unsaved work
  const hasUnsavedWork = 
    !sessionData.isSessionCompleted && 
    ((sessionData.matches && sessionData.matches.length > 0) || 
     (sessionData.finalScore || 0) > 0 || 
     (sessionData.autonomousScore || 0) > 0 || 
     (sessionData.teleOpScore || 0) > 0);

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

  // Real-time consistency calculation
  const [consistency, setConsistency] = useState<number>(0);
  const [isCalculatingConsistency, setIsCalculatingConsistency] =
    useState(true);

  // Check session limit on mount
  useEffect(() => {
    const checkSessionLimit = async () => {
      if (user?.uid && !sessionData.isSessionCompleted) {
        const { firebaseService } = await import('../services/firebaseService');
        const userSessions = await firebaseService.getUserSessions(user.uid);
        const { SESSION_LIMITS } = await import('../constants');
        
        if (userSessions.length >= SESSION_LIMITS.MAX_SESSIONS_PER_USER) {
          setSessionLimitReached(true);
          toast.error(`You've reached the maximum of ${SESSION_LIMITS.MAX_SESSIONS_PER_USER} sessions. Please delete old sessions before creating new ones.`, {
            duration: 10000,
          });
        } else {
          setSessionLimitReached(false);
        }
      }
      setSessionLimitChecked(true);
    };
    
    checkSessionLimit();
  }, [user?.uid, sessionData.isSessionCompleted]);

  // Session timer effect - always running
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTimer(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Check if timer reaches autonomous duration in Full Game mode
  useEffect(() => {
    if (
      sessionData.matchType === 'Full Game' &&
      timer === GAME_TIMING.AUTONOMOUS_DURATION_SECONDS && // 30 seconds for autonomous phase
      isTimerRunning &&
      !hasTransitionedToTeleOp
    ) {
      setIsTimerRunning(false);
      setShowTeleOpTransition(true);
    }
  }, [
    timer,
    isTimerRunning,
    sessionData.matchType,
    hasTransitionedToTeleOp,
    setIsTimerRunning,
  ]);

  const handleContinueToTeleOp = () => {
    setShowTeleOpTransition(false);
    setHasTransitionedToTeleOp(true);
    setExpandedSection('TeleOp Score');
    // Don't reset timer - continue from autonomous phase
    setIsTimerRunning(true);
  };

  const handleSkipTeleOp = () => {
    setShowTeleOpTransition(false);
    setHasTransitionedToTeleOp(true);
    // Don't auto-start timer or change section
  };

  useEffect(() => {
    const calculateConsistency = async () => {
      if (!user?.uid) {
        setConsistency(100);
        setIsCalculatingConsistency(false);
        return;
      }

      try {
        setIsCalculatingConsistency(true);
        const { firebaseService } = await import('../services/firebaseService');
        const recentSessions = await firebaseService.getUserSessions(user.uid);
        const lastThreeSessions = recentSessions.slice(0, 3);

        if (lastThreeSessions.length === 0) {
          setConsistency(100);
          setIsCalculatingConsistency(false);
          return;
        }

        const allScores = [
          sessionData.finalScore ?? 0,
          ...lastThreeSessions.map(session => session.finalScore || 0),
        ];

        const avgScore =
          allScores.reduce((sum, score) => sum + score, 0) / allScores.length;

        if (avgScore === 0) {
          setConsistency(100);
          setIsCalculatingConsistency(false);
          return;
        }

        const variance =
          allScores.reduce((sum, score) => {
            return sum + Math.pow(score - avgScore, 2);
          }, 0) / allScores.length;

        const stdDev = Math.sqrt(variance);

        const cv = stdDev / avgScore;

        const consistencyScore = 100 / (1 + cv);

        setConsistency(Math.round(consistencyScore));
        setIsCalculatingConsistency(false);
      } catch (error) {
        console.error('Error calculating consistency:', error);
        setConsistency(0);
        setIsCalculatingConsistency(false);
      }
    };

    if (user?.uid) {
      calculateConsistency();
    }
  }, [sessionData.finalScore, user?.uid]);

  const handleViewAnalysis = async () => {
    navigate('/analysis');
  };

  const handleNewSession = () => {
    // Check if there's unsaved work
    if (sessionData.matches && sessionData.matches.length > 0 && !sessionData.isSessionCompleted) {
      if (!window.confirm('You have unsaved matches. Starting a new session will discard them. Continue?')) {
        return;
      }
    }
    
    // Reset all session state
    resetSession();
    setSavedSessionId(null);
    setHasStarted(false);
    setHasTransitionedToTeleOp(false);
    setSessionTimer(0);  // Reset session timer
    // Stay on the current page to start a new session
  };

  const handleSaveMatch = () => {
    // Validate required fields
    if (!sessionData.sessionName?.trim() || !sessionData.driverName?.trim()) {
      toast.error('Please fill in Session Name and Driver Name before saving a match');
      return;
    }

    // Validate that timer was started
    if (!hasStarted) {
      toast.error('Please start the match timer before saving');
      return;
    }

    // Validate that some scoring data exists
    if ((sessionData.finalScore || 0) === 0 && 
        (sessionData.autonomousScore || 0) === 0 && 
        (sessionData.teleOpScore || 0) === 0 && 
        (sessionData.endGameScore || 0) === 0) {
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
      teleOpScore: sessionData.teleOpScore,
      endGameScore: sessionData.endGameScore,
      autonClassifiedArtifact: sessionData.autonClassifiedArtifact,
      autonOverflowArtifact: sessionData.autonOverflowArtifact,
      autonMotif: sessionData.autonMotif,
      autonLeave: sessionData.autonLeave,
      teleClassifiedArtifact: sessionData.teleClassifiedArtifact,
      teleOverflowArtifact: sessionData.teleOverflowArtifact,
      teleMotif: sessionData.teleMotif,
      endgameHang: sessionData.endgameHang,
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
      teleOpScore: 0,
      endGameScore: 0,
      autonLeave: 0,
      autonClassifiedArtifact: 0,
      autonOverflowArtifact: 0,
      autonMotif: 0,
      teleClassifiedArtifact: 0,
      teleOverflowArtifact: 0,
      teleMotif: 0,
      endgameHang: 0,
      cycleTimes: [],
    });
    
    // Reset match timer and tracking states
    resetTimer();
    setHasStarted(false);
    setIsTimerRunning(false);
    setHasTransitionedToTeleOp(false);
    
    toast.success(`Match ${updatedMatches.length} saved successfully!`);
  };

  const handleCompleteSession = async () => {
    // Validate required fields
    if (!sessionData.sessionName?.trim() || !sessionData.driverName?.trim()) {
      toast.error('Please fill in Session Name and Driver Name before completing the session');
      return;
    }

    // Validate that at least one match has been saved
    if (!sessionData.matches || sessionData.matches.length === 0) {
      toast.error('Please save at least one match before completing the session');
      return;
    }

    // Check if there's unsaved current match data
    const hasUnsavedData = 
      (sessionData.finalScore || 0) > 0 || 
      (sessionData.autonomousScore || 0) > 0 || 
      (sessionData.teleOpScore || 0) > 0 || 
      (sessionData.endGameScore || 0) > 0;

    if (hasUnsavedData) {
      toast.error('Please save the current match before completing the session, or reset the scoring fields');
      return;
    }

    // Check session limit
    if (user?.uid) {
      const { firebaseService } = await import('../services/firebaseService');
      const userSessions = await firebaseService.getUserSessions(user.uid);
      const { SESSION_LIMITS } = await import('../constants');
      
      if (userSessions.length >= SESSION_LIMITS.MAX_SESSIONS_PER_USER) {
        toast.error(`You've reached the maximum of ${SESSION_LIMITS.MAX_SESSIONS_PER_USER} sessions. Please delete old sessions before creating new ones.`);
        return;
      }
    }

    // Use sessionTimer for total session duration, not match timer
    const totalSessionTime = formatTime(sessionTimer);
    setIsTimerRunning(false);
    completeSession(totalSessionTime);

    const sessionToSave = {
      sessionName: sessionData.sessionName.trim(),
      driverName: sessionData.driverName.trim(),
      matchType: sessionData.matchType || 'Practice',
      sessionDuration: totalSessionTime,

      userId: user?.uid || '',
      userEmail: user?.email || '',

      // Don't save individual scoring fields - deprecated
      // Data is in matches array
      autonClassifiedArtifact: 0,
      autonOverflowArtifact: 0,
      autonMotif: 0,
      autonLeave: 0,

      teleClassifiedArtifact: 0,
      teleOverflowArtifact: 0,
      teleMotif: 0,

      endgameHang: 0,

      finalScore: 0,
      autonomousScore: 0,
      teleOpScore: 0,
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
        setSavedSessionId(result.id);
      } else {
        toast.error('Failed to save session. Please try again.');
      }
    } catch (error) {
      console.error('Error saving session:', error);
      toast.error('An error occurred while saving the session.');
    }
  };

  return (
    <div className="flex flex-col items-center gap-12 lg:gap-16">
      <div className="flex flex-col items-center gap-8 lg:gap-12">
        <div className="text-center space-y-6">
          <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold leading-tight lg:leading-9">
            Live Preview
          </h1>
          <p
            className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
          >
            Real time analysis
          </p>
        </div>

        <div className="text-center">
          <p className={`text-sm mb-2 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>
            Session Timer
          </p>
          <div className="text-team-blue text-4xl lg:text-5xl font-semibold leading-tight lg:leading-9">
            {formatTime(sessionTimer)}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 lg:gap-8 w-full">
        {/* Current Match Box */}
        <div className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue/60 bg-white'} space-y-6`}>
          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-team-blue'}`}>
            Current Match: Match {(sessionData.matches?.length || 0) + 1}
          </h3>
          
          <div className="text-center">
            <div className="text-team-blue text-4xl lg:text-5xl font-semibold leading-tight lg:leading-9">
              {formatTime(timer)}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 lg:gap-9 w-full justify-center">
            <DataCard
              value={(sessionData.finalScore ?? 0).toString()}
              label="Final Score"
            />
            <DataCard
              value={isCalculatingConsistency ? '...' : `${consistency}%`}
              label="Consistency"
            />
          </div>
        </div>

        {/* Session Limit Warning */}
        {sessionLimitReached && (
          <div className={`w-full px-4 py-3 rounded-lg border-2 ${isDarkMode ? 'bg-red-900/20 border-red-500 text-red-400' : 'bg-red-50 border-red-500 text-red-800'}`}>
            <p className="text-sm font-semibold">⚠️ Session Limit Reached</p>
            <p className="text-xs mt-1">You cannot save new sessions. Please delete old sessions from the Sessions page.</p>
          </div>
        )}

        <div className="flex flex-col gap-4 w-full sm:w-60">
          {!sessionData.isSessionCompleted && (
            <>
              {showTeleOpTransition ? (
                <div className="space-y-3">
                  <button
                    onClick={handleContinueToTeleOp}
                    className={`w-full px-2.5 py-2.5 rounded-2xl border border-team-blue bg-team-blue ${isDarkMode ? 'text-[#191919]' : 'text-[#FEFEFE]'} text-base leading-6 font-normal hover:bg-team-blue/90 transition-colors`}
                  >
                    Continue into TeleOp
                  </button>
                  <button
                    onClick={handleSkipTeleOp}
                    className={`w-full px-2.5 py-2.5 rounded-2xl border border-team-blue bg-transparent text-team-blue text-base leading-6 font-normal transition-colors ${isDarkMode ? 'hover:bg-team-blue/10' : 'hover:bg-team-blue hover:text-[#FEFEFE]'}`}
                  >
                    Skip / End Autonomous Only
                  </button>
                </div>
              ) : (
                <>
                  {hasStarted ? (
                    <>
                      <button
                        onClick={handleSaveMatch}
                        className={`w-full px-2.5 py-2.5 rounded-2xl border border-green-600 bg-green-600 ${isDarkMode ? 'text-[#191919]' : 'text-[#FEFEFE]'} text-base leading-6 font-normal hover:bg-green-700 transition-colors`}
                      >
                        Save Match
                      </button>
                      <button
                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                        className={`w-full px-2.5 py-2.5 rounded-2xl border ${isTimerRunning ? 'border-red-500 bg-red-500' : 'border-blue-500 bg-blue-500'} ${isDarkMode ? 'text-[#191919]' : 'text-[#FEFEFE]'} text-base leading-6 font-normal ${isTimerRunning ? 'hover:bg-red-600' : 'hover:bg-blue-600'} transition-colors`}
                      >
                        {isTimerRunning ? 'Pause Match' : 'Resume Match'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setIsTimerRunning(true);
                        setHasStarted(true);
                      }}
                      className="w-full px-2.5 py-2.5 rounded-2xl border border-green-600 bg-green-600 text-white text-base leading-6 font-normal hover:bg-green-700 transition-colors"
                    >
                      Start New Match
                    </button>
                  )}
                </>
              )}

              <button
                onClick={handleCompleteSession}
                disabled={loading || sessionLimitReached}
                className={`w-full px-2.5 py-2.5 rounded-2xl border border-team-blue bg-transparent text-team-blue text-base leading-6 font-normal transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'hover:bg-team-blue/10' : 'hover:bg-team-blue hover:text-[#FEFEFE]'}`}
              >
                {loading ? 'Saving...' : sessionLimitReached ? 'Session Limit Reached' : 'Complete Session'}
              </button>
            </>
          )}

          {sessionData.isSessionCompleted && (
            <>
              <button
                onClick={handleViewAnalysis}
                disabled={loading}
                className={`w-full px-2.5 py-2.5 rounded-2xl border border-team-white-20 bg-team-blue ${isDarkMode ? 'text-black' : 'text-[#FEFEFE]'} text-base leading-6 font-normal text-center hover:bg-team-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Loading...' : 'View Full Analysis Report'}
              </button>

              <button
                onClick={handleNewSession}
                className={`w-full px-2.5 py-2.5 rounded-2xl border border-team-blue bg-transparent text-team-blue text-base leading-6 font-normal transition-colors ${isDarkMode ? 'hover:bg-team-blue/10' : 'hover:bg-team-blue hover:text-[#FEFEFE]'}`}
              >
                New Session
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
