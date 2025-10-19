import { useState, useCallback } from 'react';
import { firebaseService, SessionData } from '../services/firebaseService';

export const useFirebase = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await operation();
        return result;
      } catch (err: any) {
        // Suppress AbortError which can occur due to HMR or navigation cancelling in dev
        if (err && err.name === 'AbortError') {
          setError(null);
          return null;
        }
        const errorMessage =
          err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('Firebase operation failed:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createSession = useCallback(
    (sessionData: Omit<SessionData, 'id' | 'createdAt'>) =>
      execute(() => firebaseService.createSession(sessionData)),
    [execute]
  );

  const getUserSessions = useCallback(
    (userId: string) => execute(() => firebaseService.getUserSessions(userId)),
    [execute]
  );

  const getSession = useCallback(
    (sessionId: string) => execute(() => firebaseService.getSession(sessionId)),
    [execute]
  );

  const getAllSessions = useCallback(
    () => execute(() => firebaseService.getAllSessions()),
    [execute]
  );

  return {
    loading,
    error,
    createSession,
    getUserSessions,
    getSession,
    getAllSessions,
  };
};
