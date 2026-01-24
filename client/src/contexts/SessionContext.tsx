import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { formatTime as formatTimeUtil } from '@/lib/utils';
import type { Match, ScoringFields } from '@/types';

interface SessionFormData extends ScoringFields {
  sessionName: string;
  driverName: string;
  sessionDuration: string;
  matchType: string;
  isSessionCompleted: boolean;
  selectedFeature: string;
  notes: string;
  // Matches within session
  matches?: Match[];
  cycleTimes: number[];
}

interface SessionContextType {
  sessionData: SessionFormData;
  updateSessionData: (updates: Partial<SessionFormData>) => void;
  completeSession: (timerValue: string) => void;
  resetSession: () => void;
  timer: number;
  isTimerRunning: boolean;
  setIsTimerRunning: (running: boolean) => void;
  resetTimer: () => void;
  formatTime: (seconds: number) => string;
  expandedSection: string | null;
  setExpandedSection: (section: string | null) => void;
}

const createInitialSessionData = (displayName?: string | null): SessionFormData => ({
  sessionName: '',
  driverName: displayName || '',
  sessionDuration: '',
  matchType: 'Full Game',
  finalScore: 0,
  autonomousScore: 0,
  teleOpScore: 0,
  endGameScore: 0,
  isSessionCompleted: false,
  autonLeave: 0,
  autonClassifiedArtifact: 0,
  autonOverflowArtifact: 0,
  autonMotif: 0,
  teleClassifiedArtifact: 0,
  teleOverflowArtifact: 0,
  teleMotif: 0,
  endgameHang: 0,
  selectedFeature: '',
  notes: '',
  cycleTimes: [],
});

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [sessionData, setSessionData] = useState<SessionFormData>(() =>
    createInitialSessionData(user?.displayName)
  );
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('Autonomous Score');

  // Timer effect
  useEffect(() => {
    if (!isTimerRunning || sessionData.isSessionCompleted) return;

    const interval = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, sessionData.isSessionCompleted]);

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
  }, []);

  const resetTimer = useCallback(() => setTimer(0), []);

  const resetSession = useCallback(() => {
    setSessionData(createInitialSessionData(user?.displayName));
    setTimer(0);
    setIsTimerRunning(true);
  }, [user?.displayName]);

  const value: SessionContextType = {
    sessionData,
    updateSessionData,
    completeSession,
    resetSession,
    timer,
    isTimerRunning,
    setIsTimerRunning,
    resetTimer,
    formatTime: formatTimeUtil,
    expandedSection,
    setExpandedSection,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
