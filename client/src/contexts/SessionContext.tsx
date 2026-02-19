import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { formatTime as formatTimeUtil } from '@/lib/utils';
import {
  saveSessionToStorage,
  loadSessionFromStorage,
  loadTimerStateFromStorage,
  clearSessionFromStorage,
  hasActiveSession,
  type SessionFormData,
  type SessionTimerState,
} from '@/lib/sessionStorage';
import type { Match } from '@/types';

export type MatchPhase =
  | 'auton'
  | 'controller_pickup'
  | 'prepare'
  | 'teleop'
  | 'ended';

interface SessionContextType {
  sessionData: SessionFormData;
  updateSessionData: (updates: Partial<SessionFormData>) => void;
  completeSession: (timerValue: string) => void;
  resetSession: () => void;
  /** Match timer counts DOWN from 150 → 0 */
  timer: number;
  sessionTimer: number;
  setSessionTimer: (timer: number) => void;
  isTimerRunning: boolean;
  setIsTimerRunning: (running: boolean) => void;
  resetTimer: () => void;
  formatTime: (seconds: number) => string;
  /** Current FTC match phase */
  matchPhase: MatchPhase;
  setMatchPhase: (phase: MatchPhase) => void;
  /** Countdown for controller_pickup (5→0) and prepare (3→0) phases */
  phaseTimer: number;
  setPhaseTimer: (timer: number) => void;
  expandedSection: string | null;
  setExpandedSection: (section: string | null) => void;
  hasActiveSession: boolean;
  hasStarted: boolean;
  setHasStarted: (started: boolean) => void;
  hasTransitionedToTeleop: boolean;
  setHasTransitionedToTeleop: (transitioned: boolean) => void;
  showTeleopTransition: boolean;
  setShowTeleopTransition: (show: boolean) => void;
  editingMatchId: string | null;
  setEditingMatchId: (id: string | null) => void;
  startEditingMatch: (match: Match) => void;
  returnToCurrentMatch: () => void;
  saveEditedMatch: () => void;
  /** Whether the current match has been explicitly started (resets between matches) */
  matchActive: boolean;
  setMatchActive: (active: boolean) => void;
}

const createInitialSessionData = (): SessionFormData => ({
  sessionName: '',
  sessionDuration: '',
  matchType: 'Full Game',
  finalScore: 0,
  autonomousScore: 0,
  teleopScore: 0,
  endGameScore: 0,
  isSessionCompleted: false,
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
  selectedFeature: 'Cycle Times',
  notes: '',
  cycleTimes: [],
  autonShots: [],
  teleopShots: [],
  matches: [],
});

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  // Try to load from storage first, otherwise create new
  // Only load session if it's fresh or from the same user session
  // Note: Don't use user.displayName here as it may not be available yet during initial load
  const [sessionData, setSessionData] = useState<SessionFormData>(() => {
    const stored = loadSessionFromStorage();
    // Load stored session only if it's not a completed session from a previous session
    // or if the user has just logged in fresh
    if (stored && !stored.isSessionCompleted) {
      return stored;
    }
    return createInitialSessionData();
  });

  // Load timer state from storage - but only if we actually loaded session data
  const storedTimerState = (() => {
    // Only use timer state if session wasn't completed
    if (sessionData && !sessionData.isSessionCompleted) {
      return loadTimerStateFromStorage();
    }
    return null;
  })();

  // Match timer counts DOWN from FULL_GAME_DURATION_SECONDS (150) to 0
  const [timer, setTimer] = useState<number>(
    () => storedTimerState?.matchTimer ?? 150
  );

  // Phase management for FTC timing sequence
  const [matchPhase, setMatchPhase] = useState<MatchPhase>(
    () => (storedTimerState?.matchPhase as MatchPhase) ?? 'auton'
  );
  const [phaseTimer, setPhaseTimer] = useState<number>(0);

  // Session timer (overall session time)
  const [sessionTimer, setSessionTimer] = useState<number>(
    () => storedTimerState?.sessionTimer ?? 0
  );

  const [isTimerRunning, setIsTimerRunning] = useState(
    storedTimerState?.isTimerRunning ?? false
  );

  const [expandedSection, setExpandedSection] = useState<string | null>(
    'Autonomous Score'
  );

  // Match state flags for UI
  const [hasStarted, setHasStarted] = useState(
    storedTimerState?.hasStarted ?? false
  );

  const [hasTransitionedToTeleop, setHasTransitionedToTeleop] = useState(
    storedTimerState?.hasTransitionedToTeleop ?? false
  );

  const [showTeleopTransition, setShowTeleopTransition] = useState(
    storedTimerState?.showTeleopTransition ?? false
  );

  const [hasActiveSessionLocal, setHasActiveSessionLocal] = useState(() =>
    hasActiveSession()
  );

  // Edit mode state
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [currentMatchData, setCurrentMatchData] =
    useState<Partial<SessionFormData> | null>(null);

  // Whether the current match has been explicitly started
  const [matchActive, setMatchActive] = useState<boolean>(false);

  // Match timer effect — counts DOWN during 'auton' and 'teleop' phases
  useEffect(() => {
    if (!isTimerRunning || sessionData.isSessionCompleted) {
      return;
    }
    if (matchPhase !== 'auton' && matchPhase !== 'teleop') {
      return;
    }

    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isTimerRunning, matchPhase, sessionData.isSessionCompleted]);

  // Phase timer effect — counts DOWN during transition phases
  useEffect(() => {
    if (matchPhase !== 'controller_pickup' && matchPhase !== 'prepare') {
      return;
    }

    const interval = setInterval(() => {
      setPhaseTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Advance to next phase
          if (matchPhase === 'controller_pickup') {
            setMatchPhase('prepare');
            setPhaseTimer(3);
          } else {
            // prepare → teleop: resume main timer
            setMatchPhase('teleop');
            setPhaseTimer(0);
            setIsTimerRunning(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [matchPhase]);

  // Session timer effect - runs for the entire session
  useEffect(() => {
    // Only run if we have an active session (not completed)
    if (sessionData.isSessionCompleted) {
      return;
    }

    // Start the session timer when a match begins
    if (!hasStarted) {
      return;
    }

    const interval = setInterval(() => {
      setSessionTimer(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [hasStarted, sessionData.isSessionCompleted]);

  // Persist session data and timer state to localStorage whenever they change
  useEffect(() => {
    if (sessionData.isSessionCompleted) {
      // Don't persist completed sessions
      return;
    }

    // Save if there's session data OR if timers are active
    const hasSessionData =
      sessionData.sessionName || sessionData.matches.length > 0;
    const hasActiveTimers =
      isTimerRunning || hasStarted || sessionTimer > 0 || timer > 0;

    if (!hasSessionData && !hasActiveTimers) {
      // Nothing to persist - ensure storage is clear
      clearSessionFromStorage();
      return;
    }

    const timerState: SessionTimerState = {
      sessionTimer,
      matchTimer: timer,
      isTimerRunning,
      hasStarted,
      hasTransitionedToTeleop,
      showTeleopTransition,
      sessionStartTime: 0,
      matchStartTime: 0,
      matchPhase,
    };

    saveSessionToStorage(sessionData, timerState);
    setHasActiveSessionLocal(true);
  }, [
    sessionData,
    timer,
    sessionTimer,
    isTimerRunning,
    hasStarted,
    hasTransitionedToTeleop,
    showTeleopTransition,
    matchPhase,
  ]);

  const updateSessionData = useCallback((updates: Partial<SessionFormData>) => {
    setSessionData(prev => ({ ...prev, ...updates }));
  }, []);

  const completeSession = useCallback((timerValue: string) => {
    setSessionData(prev => ({
      ...prev,
      sessionDuration: timerValue,
      isSessionCompleted: true,
    }));
    setIsTimerRunning(false);
    // Clear from storage when session is completed
    clearSessionFromStorage();
    setHasActiveSessionLocal(false);
  }, []);

  const resetTimer = useCallback(() => {
    setTimer(150);
    setMatchPhase('auton');
    setPhaseTimer(0);
  }, []);

  const startEditingMatch = useCallback(
    (match: Match) => {
      // Save current form data
      setCurrentMatchData({
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
        cycleTimes: sessionData.cycleTimes,
        autonShots: sessionData.autonShots,
        teleopShots: sessionData.teleopShots,
      });

      // Load match data into form
      setSessionData(prev => ({
        ...prev,
        finalScore: match.finalScore || 0,
        autonomousScore: match.autonomousScore || 0,
        teleopScore: match.teleopScore || 0,
        endGameScore: match.endGameScore || 0,
        autonClassifiedArtifact: match.autonClassifiedArtifact || 0,
        autonOverflowArtifact: match.autonOverflowArtifact || 0,
        autonMotif: match.autonMotif || 0,
        autonBallsMissed: match.autonBallsMissed || 0,
        autonLeave: match.autonLeave || 0,
        teleClassifiedArtifact: match.teleClassifiedArtifact || 0,
        teleOverflowArtifact: match.teleOverflowArtifact || 0,
        teleMotif: match.teleMotif || 0,
        teleBallsMissed: match.teleBallsMissed || 0,
        robot1Park: match.robot1Park || 'none',
        robot2Park: match.robot2Park || 'none',
        cycleTimes: match.cycleTimes || [],
        autonShots: match.autonShots || [],
        teleopShots: match.teleopShots || [],
      }));

      setEditingMatchId(match.id);
    },
    [sessionData]
  );

  const returnToCurrentMatch = useCallback(() => {
    if (currentMatchData) {
      setSessionData(prev => ({ ...prev, ...currentMatchData }));
    }
    setEditingMatchId(null);
    setCurrentMatchData(null);
  }, [currentMatchData]);

  const saveEditedMatch = useCallback(() => {
    if (!editingMatchId) return;

    // Update the match in the matches array with current form data
    // Then restore the form to the current match state
    setSessionData(prev => {
      const updatedMatches = prev.matches.map(match =>
        match.id === editingMatchId
          ? {
              ...match,
              finalScore: prev.finalScore,
              autonomousScore: prev.autonomousScore,
              teleopScore: prev.teleopScore,
              endGameScore: prev.endGameScore,
              autonClassifiedArtifact: prev.autonClassifiedArtifact,
              autonOverflowArtifact: prev.autonOverflowArtifact,
              autonMotif: prev.autonMotif,
              autonBallsMissed: prev.autonBallsMissed,
              autonLeave: prev.autonLeave,
              teleClassifiedArtifact: prev.teleClassifiedArtifact,
              teleOverflowArtifact: prev.teleOverflowArtifact,
              teleMotif: prev.teleMotif,
              teleBallsMissed: prev.teleBallsMissed,
              robot1Park: prev.robot1Park,
              robot2Park: prev.robot2Park,
              cycleTimes: prev.cycleTimes,
              autonShots: prev.autonShots,
              teleopShots: prev.teleopShots,
            }
          : match
      );

      // Restore the current match data if available, otherwise reset scoring fields
      if (currentMatchData) {
        return {
          ...prev,
          matches: updatedMatches,
          ...currentMatchData,
        };
      }

      // Reset scoring fields for new match
      return {
        ...prev,
        matches: updatedMatches,
        finalScore: 0,
        autonomousScore: 0,
        teleopScore: 0,
        endGameScore: 0,
        autonClassifiedArtifact: 0,
        autonOverflowArtifact: 0,
        autonMotif: 0,
        autonBallsMissed: 0,
        autonLeave: 0,
        teleClassifiedArtifact: 0,
        teleOverflowArtifact: 0,
        teleMotif: 0,
        teleBallsMissed: 0,
        robot1Park: 'none',
        robot2Park: 'none',
        cycleTimes: [],
      };
    });

    // Clear edit mode state
    setEditingMatchId(null);
    setCurrentMatchData(null);
  }, [editingMatchId, currentMatchData]);

  const resetSession = useCallback(() => {
    const newSessionData = createInitialSessionData();
    setSessionData(newSessionData);
    setTimer(150);
    setMatchPhase('auton');
    setPhaseTimer(0);
    setSessionTimer(0);
    setIsTimerRunning(false);
    setHasStarted(false);
    setMatchActive(false);
    setHasTransitionedToTeleop(false);
    setShowTeleopTransition(false);
    // Clear from storage immediately to prevent race conditions with persistence effect
    clearSessionFromStorage();
    setHasActiveSessionLocal(false);
  }, []);

  const value: SessionContextType = {
    sessionData,
    updateSessionData,
    completeSession,
    resetSession,
    timer,
    sessionTimer,
    setSessionTimer,
    isTimerRunning,
    setIsTimerRunning,
    resetTimer,
    formatTime: formatTimeUtil,
    matchPhase,
    setMatchPhase,
    phaseTimer,
    setPhaseTimer,
    expandedSection,
    setExpandedSection,
    hasActiveSession: hasActiveSessionLocal,
    hasStarted,
    setHasStarted,
    hasTransitionedToTeleop,
    setHasTransitionedToTeleop,
    showTeleopTransition,
    setShowTeleopTransition,
    editingMatchId,
    setEditingMatchId,
    startEditingMatch,
    returnToCurrentMatch,
    saveEditedMatch,
    matchActive,
    setMatchActive,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
