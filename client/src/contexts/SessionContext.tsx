import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { formatTime as formatTimeUtil, getDisplayTimer as getDisplayTimerUtil } from '@/lib';
import {
  saveSessionToStorage,
  loadSessionFromStorage,
  loadTimerStateFromStorage,
  clearSessionFromStorage,
  hasActiveSession,
} from '@/lib';
import type { Match, SessionFormData, SessionTimerState, MatchPhase } from '@/types';
import { STORAGE_KEYS } from '@/constants';

interface TeamTrackWindow extends Window {
  __teamtrack_match_audio__?: HTMLAudioElement;
}

interface SessionContextType {
  sessionData: SessionFormData;
  updateSessionData: (updates: Partial<SessionFormData>) => void;
  /** Full replacement of session data (not a merge) */
  replaceSessionData: (data: SessionFormData) => void;
  completeSession: (timerValue: string) => void;
  resetSession: () => void;
  /** Match timer counts DOWN from 150 → 0 */
  timer: number;
  setTimer: (timer: number) => void;
  sessionTimer: number;
  setSessionTimer: (timer: number) => void;
  isTimerRunning: boolean;
  setIsTimerRunning: (running: boolean) => void;
  resetTimer: () => void;
  formatTime: (seconds: number) => string;
  /** Current FTC match phase */
  matchPhase: MatchPhase;
  setMatchPhase: (phase: MatchPhase) => void;
  /** Countdown for controller_pickup (8→0) phase */
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
  skipToTeleop: () => void;
  /** True during the 1.15s audio intro before the countdown begins (Full Game only) */
  isPreMatchDelay: boolean;
  setIsPreMatchDelay: (delay: boolean) => void;
  /** Convert raw countdown timer to display timer for a given phase */
  getDisplayTimer: (timer: number, phase: MatchPhase) => number;
  /** True when tutorial is active - prevents audio from playing */
  isTutorialActive: boolean;
  setIsTutorialActive: (active: boolean) => void;
}

const getInitialTimerDuration = (matchType: string = 'Full Game'): number => {
  switch (matchType) {
    case 'Autonomous':
      return 30; // 0:30
    case 'Teleop':
      return 120; // 2:00
    case 'Full Game':
    default:
      return 153; // 3s countdown + 30s auto + 120s teleop (1.15s audio intro handled externally)
  }
};

const createInitialSessionData = (): SessionFormData => {
  const storedGate = localStorage.getItem(STORAGE_KEYS.GATE_SCORING_ENABLED);
  const storedMotif = localStorage.getItem(STORAGE_KEYS.MOTIF_SCORING_ENABLED);
  const gateEnabled = storedGate !== null ? storedGate === 'true' : true;
  const motifEnabled = storedMotif !== null ? storedMotif === 'true' : true;

  return {
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
    gateBallCount: 0,
    robot1Park: 'none',
    robot2Park: 'none',
    selectedFeature: 'Cycle Times',
    notes: '',
    cycleTimes: [],
    autonShots: [],
    teleopShots: [],
    matches: [],
    gateEnabled,
    motifPattern: motifEnabled ? ['empty', 'empty', 'empty'] : undefined,
  };
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [sessionData, setSessionData] = useState<SessionFormData>(() => {
    const stored = loadSessionFromStorage();
    const storedTimer = loadTimerStateFromStorage();
    if (stored && !stored.isSessionCompleted && (storedTimer?.hasStarted || stored.matches?.length > 0)) {
      return stored;
    }
    clearSessionFromStorage();
    return createInitialSessionData();
  });

  const storedTimerState = (() => {
    if (sessionData && !sessionData.isSessionCompleted) {
      return loadTimerStateFromStorage();
    }
    return null;
  })();

  const [timer, setTimer] = useState<number>(
    () => storedTimerState?.matchTimer ?? 150
  );

  const [matchPhase, setMatchPhase] = useState<MatchPhase>(
    () => (storedTimerState?.matchPhase as MatchPhase) ?? 'auton'
  );
  const [phaseTimer, setPhaseTimer] = useState<number>(0);

  const [sessionTimer, setSessionTimer] = useState<number>(
    () => storedTimerState?.sessionTimer ?? 0
  );

  const [isTimerRunning, setIsTimerRunning] = useState(
    storedTimerState?.isTimerRunning ?? false
  );

  const [expandedSection, setExpandedSection] = useState<string | null>(
    'Autonomous Score'
  );

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

  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [currentMatchData, setCurrentMatchData] =
    useState<Partial<SessionFormData> | null>(null);

  const [matchActive, setMatchActive] = useState<boolean>(false);
  const [isPreMatchDelay, setIsPreMatchDelay] = useState<boolean>(false);
  const preMatchDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isTutorialActive, setIsTutorialActive] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      const newData = createInitialSessionData();
      setSessionData(newData);
      setHasStarted(false);
      setIsTimerRunning(false);
      setIsPreMatchDelay(false);
      if (preMatchDelayRef.current) {
        clearTimeout(preMatchDelayRef.current);
        preMatchDelayRef.current = null;
      }
      setTimer(getInitialTimerDuration(newData.matchType));
      setMatchPhase('auton');
      clearSessionFromStorage();
    }
  }, [user]);

  useEffect(() => {
    if (!hasStarted && !isTimerRunning) {
      const newDuration = getInitialTimerDuration(sessionData.matchType);
      setTimer(newDuration);
      if (sessionData.matchType === 'Teleop') {
        setMatchPhase('teleop');
      } else {
        setMatchPhase('auton');
      }
    }
  }, [sessionData.matchType, hasStarted, isTimerRunning]);

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
          setIsTimerRunning(false);
          if (matchPhase === 'teleop') {
            setMatchPhase('ended');
          }
          if (matchPhase === 'auton' && sessionData.matchType === 'Autonomous') {
            setMatchPhase('ended');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isTimerRunning, matchPhase, sessionData.isSessionCompleted, sessionData.matchType]);

  useEffect(() => {
    if (matchPhase !== 'controller_pickup') {
      return;
    }

    const interval = setInterval(() => {
      setPhaseTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(() => {
            setMatchPhase('teleop');
            setPhaseTimer(0);
            setTimer(120);
            setIsTimerRunning(true);
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [matchPhase]);

  useEffect(() => {
    if (sessionData.isSessionCompleted) {
      return;
    }

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

  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (sessionData.isSessionCompleted) {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
      return;
    }

    const hasSessionData =
      sessionData.sessionName ||
      sessionData.matches.length > 0;
    const hasActiveTimers =
      isTimerRunning || hasStarted || sessionTimer > 0;

    if (!hasSessionData && !hasActiveTimers) {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
      clearSessionFromStorage();
      return;
    }

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(() => {
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
      setHasActiveSessionLocal(hasStarted || sessionData.matches.length > 0);
    }, 300);

    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
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

  const replaceSessionData = useCallback((data: SessionFormData) => {
    setSessionData(data);
  }, []);

  const completeSession = useCallback((timerValue: string) => {
    setSessionData(prev => ({
      ...prev,
      sessionDuration: timerValue,
      isSessionCompleted: true,
    }));
    setIsTimerRunning(false);
    clearSessionFromStorage();
    setHasActiveSessionLocal(false);
  }, []);

  const resetTimer = useCallback(() => {
    const duration = getInitialTimerDuration(sessionData.matchType);
    setTimer(duration);
    if (sessionData.matchType === 'Teleop') {
      setMatchPhase('teleop');
    } else {
      setMatchPhase('auton');
    }
    setPhaseTimer(0);
  }, [sessionData.matchType]);

  const startEditingMatch = useCallback(
    (match: Match) => {
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

      if (currentMatchData) {
        return {
          ...prev,
          matches: updatedMatches,
          ...currentMatchData,
        };
      }

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

    setEditingMatchId(null);
    setCurrentMatchData(null);
  }, [editingMatchId, currentMatchData]);

  const resetSession = useCallback(() => {
    const newSessionData = createInitialSessionData();
    setSessionData(newSessionData);
    setTimer(getInitialTimerDuration(newSessionData.matchType));
    setMatchPhase('auton');
    setPhaseTimer(0);
    setSessionTimer(0);
    setIsTimerRunning(false);
    setHasStarted(false);
    setMatchActive(false);
    setHasTransitionedToTeleop(false);
    setShowTeleopTransition(false);
    clearSessionFromStorage();
    setHasActiveSessionLocal(false);
  }, []);

  const skipToTeleop = useCallback(() => {
    if (sessionData.matchType === 'Full Game' && 
        (matchPhase === 'auton' || matchPhase === 'controller_pickup')) {
      const globalAudio = (window as TeamTrackWindow)['__teamtrack_match_audio__'];
      if (globalAudio) {
        globalAudio.currentTime = 42;
        if (globalAudio.paused) {
          globalAudio.play().catch(() => {});
        }
      }
      
      setMatchPhase('teleop');
      setTimer(120);
      setPhaseTimer(0);
      if (!isTimerRunning) {
        setIsTimerRunning(true);
      }
    }
  }, [sessionData.matchType, matchPhase, isTimerRunning]);

  const value: SessionContextType = {
    sessionData,
    updateSessionData,
    replaceSessionData,
    completeSession,
    resetSession,
    timer,
    setTimer,
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
    skipToTeleop,
    isPreMatchDelay,
    setIsPreMatchDelay,
    getDisplayTimer: getDisplayTimerUtil,
    isTutorialActive,
    setIsTutorialActive,
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
