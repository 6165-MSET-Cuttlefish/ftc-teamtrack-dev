import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from './useApi';
import { useAuth } from '../contexts/AuthContext';

interface Session {
  id: string;
  sessionName: string;
  driverName: string;
  matchType: string;
  sessionDuration: string;
  finalScore: number;
  createdAt: string;
  autonBasket: number;
  autonSpeci: number;
  teleBasket: number;
  teleSpeci: number;
  endgameHang: number;
}

interface SessionStats {
  totalSessions: number;
  averageScore: number;
  highestScore: number;
  totalPlayTime: number;
  matchTypeBreakdown: Record<string, number>;
  recentSessions: Session[];
  performanceTrend: Array<{ date: string; score: number }>;
}

interface UseSessionsOptions {
  initialLimit?: number;
  autoLoad?: boolean;
}

export const useSessions = (options: UseSessionsOptions = {}) => {
  const { initialLimit = 20, autoLoad = true } = options;
  const { user } = useAuth();
  const { getSessions, getUserSessionStats, loading } = useApi();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isDatabaseAvailable, setIsDatabaseAvailable] = useState(true);
  const [filters, setFilters] = useState({
    searchTerm: '',
    matchType: 'all',
    sortBy: 'newest',
    dateFrom: '',
    dateTo: '',
  });

  // Add throttling and request deduplication
  const lastFetchTime = useRef<number>(0);
  const minFetchInterval = 5000; // Minimum 5 seconds between fetches
  const pendingRequest = useRef<Promise<void> | null>(null);

  const loadSessions = useCallback(
    async (page = 0, append = false) => {
      if (!user?.uid) return;

      // Throttling: prevent too frequent requests
      const now = Date.now();
      if (now - lastFetchTime.current < minFetchInterval && !append) {
        return;
      }

      // Deduplication: if there's already a pending request, wait for it
      if (pendingRequest.current && !append) {
        try {
          await pendingRequest.current;
        } catch {
          // Ignore errors from pending requests
        }
        return;
      }

      const requestPromise = (async () => {
        try {
          const options = {
            limit: initialLimit,
            offset: page * initialLimit,
            sortBy: 'createdAt' as const,
            sortOrder: 'desc' as const,
            matchType:
              filters.matchType !== 'all' ? filters.matchType : undefined,
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
          };

          const result = await getSessions(user.uid, options);

          // Check if we got an empty response due to database being unavailable
          if (result && typeof result === 'object' && 'sessions' in result) {
            const { sessions: newSessions, pagination } = result as {
              sessions: Session[];
              pagination: { hasMore: boolean; total: number };
            };

            // If we get empty sessions and total is 0, it might be database unavailable
            setIsDatabaseAvailable(newSessions.length > 0 || pagination.total > 0);

            if (append) {
              setSessions(prev => [...prev, ...(newSessions || [])]);
            } else {
              setSessions(newSessions || []);
            }

            setHasMore(pagination?.hasMore || false);
          } else {
            // Handle legacy response format
            const sessionData = (result as Session[]) || [];
            setIsDatabaseAvailable(sessionData.length > 0);
            
            if (append) {
              setSessions(prev => [...prev, ...sessionData]);
            } else {
              setSessions(sessionData);
            }
            setHasMore(sessionData.length === initialLimit);
          }

          // Update last fetch time
          lastFetchTime.current = Date.now();
        } catch (error) {
          // Handle error silently in production
          console.warn('Failed to load sessions:', error);
        } finally {
          // Clear pending request
          pendingRequest.current = null;
        }
      })();

      // Store the pending request
      pendingRequest.current = requestPromise;
      await requestPromise;
    },
    [user?.uid, getSessions, initialLimit, filters.dateFrom, filters.dateTo, filters.matchType]
  );

  const loadStats = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const stats = await getUserSessionStats(user.uid);
      setSessionStats(stats as SessionStats);
    } catch (error) {
      // Handle error silently in production
      console.warn('Failed to load session stats:', error);
    }
  }, [user?.uid, getUserSessionStats]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      loadSessions(nextPage, true);
    }
  }, [hasMore, loading, currentPage, loadSessions]);

  const refreshSessions = useCallback(() => {
    setCurrentPage(0);
    loadSessions(0, false);
    loadStats();
  }, [loadSessions, loadStats]);

  const updateFilters = useCallback((newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(0);
  }, []);

  // Filter sessions locally for search term (since it's not handled server-side yet)
  const filteredSessions = sessions.filter(session => {
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      return (
        session.sessionName.toLowerCase().includes(searchLower) ||
        session.driverName.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // Apply sorting locally
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    switch (filters.sortBy) {
      case 'newest':
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case 'oldest':
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case 'highest-score':
        return b.finalScore - a.finalScore;
      case 'lowest-score':
        return a.finalScore - b.finalScore;
      case 'duration':
        return b.sessionDuration.localeCompare(a.sessionDuration);
      default:
        return 0;
    }
  });

  // Auto-load sessions when user changes or key filters change
  useEffect(() => {
    if (user?.uid && autoLoad) {
      setCurrentPage(0);
      loadSessions(0, false);
      loadStats();
    }
  }, [
    user?.uid,
    filters.matchType,
    filters.dateFrom,
    filters.dateTo,
    autoLoad,
    loadSessions,
    loadStats,
  ]);

  return {
    sessions: sortedSessions,
    sessionStats,
    loading,
    hasMore,
    filters,
    updateFilters,
    loadMore,
    refreshSessions,
    rawSessions: sessions, // For export functionality
    isDatabaseAvailable,
  };
};
