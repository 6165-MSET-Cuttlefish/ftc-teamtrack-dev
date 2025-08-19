import { useState, useCallback } from "react";
import { apiService } from "../services/api";

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
        setError(err instanceof Error ? err.message : "An error occurred");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    loading,
    error,
    execute,
    // Direct API methods
    createSession: (sessionData: any) =>
      execute(() => apiService.createSession(sessionData)),
    getSessions: () => execute(() => apiService.getSessions()),
    getSession: (id: string) => execute(() => apiService.getSession(id)),
    getAllSessions: () => execute(() => apiService.getAllSessions()),
  };
};
