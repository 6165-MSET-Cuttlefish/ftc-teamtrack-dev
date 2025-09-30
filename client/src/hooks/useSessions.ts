import { useState, useEffect, useCallback } from 'react';
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
  const [filters, setFilters] = useState({
    searchTerm: '',
    matchType: 'all',
    sortBy: 'newest',
    dateFrom: '',
    dateTo: '',
  });

  const loadSessions = useCallback(async (page = 0, append = false, customFilters?: Partial<typeof filters>) => {
    if (!user?.uid) return;

    const currentFilters = { ...filters, ...customFilters };
    
    try {
      const options = {
        limit: initialLimit,
        offset: page * initialLimit,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
        matchType: currentFilters.matchType !== 'all' ? currentFilters.matchType : undefined,
        dateFrom: currentFilters.dateFrom || undefined,
        dateTo: currentFilters.dateTo || undefined,
      };

      const result = await getSessions(user.uid, options);
      
      if (result && typeof result === 'object' && 'sessions' in result) {
        const { sessions: newSessions, pagination } = result as any;
        
        if (append) {
          setSessions(prev => [...prev, ...(newSessions || [])]);
        } else {
          setSessions(newSessions || []);
        }
        
        setHasMore(pagination?.hasMore || false);
      } else {
        // Handle legacy response format
        const sessionData = result as Session[] || [];
        if (append) {
          setSessions(prev => [...prev, ...sessionData]);
        } else {
          setSessions(sessionData);
        }
        setHasMore(sessionData.length === initialLimit);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  }, [user?.uid, getSessions, initialLimit, filters]);

  const loadStats = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const stats = await getUserSessionStats(user.uid);
      setSessionStats(stats as SessionStats);
    } catch (error) {
      console.error('Failed to fetch session stats:', error);
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
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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

  // Auto-load sessions when user changes or filters change
  useEffect(() => {
    if (user?.uid && autoLoad) {
      refreshSessions();
    }
  }, [user?.uid, filters.matchType, filters.dateFrom, filters.dateTo, autoLoad]);

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
  };
};