import { useState, useCallback } from 'react';
import { firebaseService } from '@/services';
import { isAbortError } from '@/lib';
import type { Session, CreateSessionData } from '@/types';

interface UseFirebaseState {
  loading: boolean;
  error: string | null;
}

export const useFirebase = () => {
  const [state, setState] = useState<UseFirebaseState>({
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T | null> => {
      setState({ loading: true, error: null });

      try {
        const result = await operation();
        setState({ loading: false, error: null });
        return result;
      } catch (err) {
        if (isAbortError(err)) {
          setState({ loading: false, error: null });
          return null;
        }

        const errorMessage =
          err instanceof Error ? err.message : 'An error occurred';
        setState({ loading: false, error: errorMessage });
        const { logger } = await import('@/lib/logger');
        logger.error('Firebase operation failed', err);
        return null;
      }
    },
    []
  );

  const createSession = useCallback(
    (sessionData: CreateSessionData) =>
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
    (userId: string) => execute(() => firebaseService.getAllSessions(userId)),
    [execute]
  );

  const deleteSession = useCallback(
    (sessionId: string) =>
      execute(() => firebaseService.deleteSession(sessionId)),
    [execute]
  );

  const updateSession = useCallback(
    (sessionId: string, updates: Partial<Session>) =>
      execute(() => firebaseService.updateSession(sessionId, updates)),
    [execute]
  );

  return {
    ...state,
    createSession,
    getUserSessions,
    getSession,
    getAllSessions,
    deleteSession,
    updateSession,
  };
};
