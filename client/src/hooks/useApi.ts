import { useState, useCallback } from 'react';

export const useApi = () => {
  const [loading, setLoading] = useState(false);

  const getSessions = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      // Placeholder: real implementation should call firebaseService or backend
      void userId; // mark used until real implementation is added
      return [] as any[];
    } finally {
      setLoading(false);
    }
  }, []);

  return { getSessions, loading } as const;
};

export default useApi;
