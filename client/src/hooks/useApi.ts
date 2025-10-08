import { useState, useCallback, useMemo } from 'react';
import { apiService } from '../services/api';

// Define session data structure based on backend schema
interface SessionData extends Record<string, unknown> {
  sessionName: string;
  driverName: string;
  matchType: string;
  sessionDuration: string;
  autonBasket: number;
  autonSpeci: number;
  autonFloor: number;
  autonRung: number;
  autonHighRung: number;
  teleBasket: number;
  teleSpeci: number;
  teleNetZone: number;
  teleLowRung: number;
  teleHighRung: number;
  endgameHang: number;
  endgamePark: number;
  finalScore: number;
  completedAt: string;
}

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async <T>(apiCall: () => Promise<T>): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiCall();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createSession = useCallback(
    (sessionData: SessionData) =>
      execute(() => apiService.createSession(sessionData)),
    [execute]
  );

  const getSessions = useCallback(
    (
      userId?: string,
      options?: {
        limit?: number;
        offset?: number;
        sortBy?: 'createdAt' | 'sessionName' | 'finalScore';
        sortOrder?: 'asc' | 'desc';
        matchType?: string;
        dateFrom?: string;
        dateTo?: string;
      }
    ) => execute(() => apiService.getSessions(userId, options)),
    [execute]
  );

  const getSession = useCallback(
    (id: string) => execute(() => apiService.getSession(id)),
    [execute]
  );

  const getAllSessions = useCallback(
    () => execute(() => apiService.getAllSessions()),
    [execute]
  );

  const getUserSessionStats = useCallback(
    (userId: string) =>
      execute(() => apiService.getUserSessionStats(userId)),
    [execute]
  );

  return useMemo(
    () => ({
      loading,
      error,
      execute,
      createSession,
      getSessions,
      getSession,
      getAllSessions,
      getUserSessionStats,
    }),
    [
      loading,
      error,
      execute,
      createSession,
      getSessions,
      getSession,
      getAllSessions,
      getUserSessionStats,
    ]
  );
};
