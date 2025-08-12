import { createContext, useContext, useState, ReactNode } from "react";

interface SessionData {
  sessionName: string;
  driverName: string;
  sessionDuration: string;
  matchType: string;
  finalScore: number;
  autonomousScore: number;
  teleOpScore: number;
  endGameScore: number;
}

interface SessionContextType {
  sessionData: SessionData;
  updateSessionData: (updates: Partial<SessionData>) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [sessionData, setSessionData] = useState<SessionData>({
    sessionName: "",
    driverName: "Ethan Yang",
    sessionDuration: "",
    matchType: "Autonomous",
    finalScore: 0,
    autonomousScore: 200,
    teleOpScore: 208,
    endGameScore: 208,
  });

  const updateSessionData = (updates: Partial<SessionData>) => {
    setSessionData((prev) => ({ ...prev, ...updates }));
  };

  return (
    <SessionContext.Provider value={{ sessionData, updateSessionData }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};
