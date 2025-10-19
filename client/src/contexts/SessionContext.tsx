import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
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

  const updateSessionData = useCallback((updates: Partial<SessionData>) => {
    setSessionData(prev => ({ ...prev, ...updates }));
  }, []);

  const completeSession = useCallback((timerValue: string) => {
    setSessionData(prev => ({
      ...prev,
      sessionDuration: timerValue,
      isSessionCompleted: true,
    }));
  }, []);

  return (
    <SessionContext.Provider
      value={{ sessionData, updateSessionData, completeSession }}
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
