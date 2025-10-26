import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from 'react';
import { useAuth } from './AuthContext';

interface SessionData {
  sessionName: string;
  driverName: string;
  sessionDuration: string;
  matchType: string;
  finalScore: number;
  autonomousScore: number;
  teleOpScore: number;
  endGameScore: number;
  isSessionCompleted: boolean;
  autonomousBasket: number;
  autonomousSpecimen: number;
  autonomousFloorMark: number;
  autonomousLeave: number;
  teleOpSamples: number;
  teleOpSpecimen: number;
  teleOpFloorMark: number;
  endGameValue: number;
}

interface SessionContextType {
  sessionData: SessionData;
  updateSessionData: (updates: Partial<SessionData>) => void;
  completeSession: (timerValue: string) => void;
  resetSession: () => void;
  timer: number;
  isTimerRunning: boolean;
  setIsTimerRunning: (running: boolean) => void;
  formatTime: (seconds: number) => string;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [sessionData, setSessionData] = useState<SessionData>({
    sessionName: '',
    driverName: user?.displayName || '',
    sessionDuration: '',
    matchType: 'Autonomous',
    finalScore: 0,
    autonomousScore: 0,
    teleOpScore: 0,
    endGameScore: 0,
    isSessionCompleted: false,
    autonomousBasket: 0,
    autonomousSpecimen: 0,
    autonomousFloorMark: 0,
    autonomousLeave: 0,
    teleOpSamples: 0,
    teleOpSpecimen: 0,
    teleOpFloorMark: 0,
    endGameValue: 0,
  });

  // Timer state - persists across navigation
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Timer effect - runs continuously while timer is running
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isTimerRunning && !sessionData.isSessionCompleted) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, sessionData.isSessionCompleted]);

  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const updateSessionData = useCallback((updates: Partial<SessionData>) => {
    setSessionData(prev => ({ ...prev, ...updates }));
  }, []);

  const completeSession = useCallback((timerValue: string) => {
    setSessionData(prev => ({
      ...prev,
      sessionDuration: timerValue,
      isSessionCompleted: true,
    }));
    setIsTimerRunning(false); // Stop the timer when session completes
  }, []);

  const resetSession = useCallback(() => {
    setSessionData({
      sessionName: '',
      driverName: user?.displayName || '',
      sessionDuration: '',
      matchType: 'Autonomous',
      finalScore: 0,
      autonomousScore: 0,
      teleOpScore: 0,
      endGameScore: 0,
      isSessionCompleted: false,
      autonomousBasket: 0,
      autonomousSpecimen: 0,
      autonomousFloorMark: 0,
      autonomousLeave: 0,
      teleOpSamples: 0,
      teleOpSpecimen: 0,
      teleOpFloorMark: 0,
      endGameValue: 0,
    });
    setTimer(0); // Reset timer to 0
    setIsTimerRunning(true); // Restart timer for new session
  }, [user]);

  return (
    <SessionContext.Provider
      value={{ 
        sessionData, 
        updateSessionData, 
        completeSession, 
        resetSession,
        timer,
        isTimerRunning,
        setIsTimerRunning,
        formatTime
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};