import { useState, useEffect } from 'react';import { useState, useEffect, useCallback } from 'react';import { useState, useEffect, useCallback } from 'react';import { useState, useEffect, useCallback } from 'react';import { useState, useEffect, useCallback, useRef } from 'react';

import { useFirebase } from './useFirebase';

import { useAuth } from '../contexts/AuthContext';import { useFirebase } from './useFirebase';

import { Session } from '../types/session';

import { useAuth } from '../contexts/AuthContext';import { useFirebase } from './useFirebase';

interface SessionFilters {

  matchType: string;import { SessionData } from '../services/firebaseService';

  dateFrom?: string;

  dateTo?: string;import { useAuth } from '../contexts/AuthContext';import { useFirebase } from './useFirebase';import { useFirebase } from './useFirebase';

}

interface SessionFilters {

export const useSessions = () => {

  const { user } = useAuth();  matchType: string;import { SessionData } from '../services/firebaseService';

  const { getUserSessions, loading } = useFirebase();

    dateFrom?: string;

  const [sessions, setSessions] = useState<Session[]>([]);

  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);  dateTo?: string;import { useAuth } from '../contexts/AuthContext';import { useAuth } from '../contexts/AuthContext';

  const [filters, setFilters] = useState<SessionFilters>({

    matchType: 'all',}

  });

interface SessionFilters {

  useEffect(() => {

    const fetchSessions = async () => {interface SessionStats {

      if (!user?.uid) return;

  totalSessions: number;  matchType: string;import { SessionData } from '../services/firebaseService';

      const result = await getUserSessions(user.uid);

      if (result) {  averageScore: number;

        setSessions(result);

      }  highestScore: number;  dateFrom?: string;

    };

  recentSessions: SessionData[];

    fetchSessions();

  }, [user?.uid, getUserSessions]);}  dateTo?: string;interface Session {



  useEffect(() => {

    let filtered = sessions;

export const useSessions = () => {}

    if (filters.matchType !== 'all') {

      filtered = filtered.filter(s => s.matchType === filters.matchType);  const { user } = useAuth();

    }

  const { getUserSessions, loading } = useFirebase();interface SessionFilters {  id: string;

    if (filters.dateFrom) {

      const fromDate = new Date(filters.dateFrom);  

      filtered = filtered.filter(s => {

        const sessionDate = typeof s.createdAt === 'string'   const [sessions, setSessions] = useState<SessionData[]>([]);interface SessionStats {

          ? new Date(s.createdAt) 

          : s.createdAt.toDate();  const [stats, setStats] = useState<SessionStats | null>(null);

        return sessionDate >= fromDate;

      });  totalSessions: number;  matchType: string;  sessionName: string;

    }

  const fetchSessions = useCallback(async () => {

    if (filters.dateTo) {

      const toDate = new Date(filters.dateTo);    if (!user?.uid) return;  averageScore: number;

      filtered = filtered.filter(s => {

        const sessionDate = typeof s.createdAt === 'string' 

          ? new Date(s.createdAt) 

          : s.createdAt.toDate();    try {  highestScore: number;  dateFrom?: string;  driverName: string;

        return sessionDate <= toDate;

      });      const result = await getUserSessions(user.uid);

    }

      if (result) {  recentSessions: SessionData[];

    setFilteredSessions(filtered);

  }, [sessions, filters]);        setSessions(result);



  const updateFilters = (newFilters: Partial<SessionFilters>) => {        }  dateTo?: string;  matchType: string;

    setFilters(prev => ({ ...prev, ...newFilters }));

  };        const scores = result



  return {          .map(s => s.finalScore)

    sessions: filteredSessions,

    loading,          .filter((score): score is number => typeof score === 'number');

    filters,

    updateFilters,        export const useSessions = (initialLimit = 10) => {}  sessionDuration: string;

  };

};        const sessionStats: SessionStats = {

          totalSessions: result.length,  const { user } = useAuth();

          averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,

          highestScore: scores.length > 0 ? Math.max(...scores) : 0,  const { getUserSessions, loading } = useFirebase();  finalScore: number;

          recentSessions: result.slice(0, 5),

        };  

        

        setStats(sessionStats);  const [sessions, setSessions] = useState<SessionData[]>([]);interface SessionStats {  createdAt: string;

      }

    } catch (error) {  const [stats, setStats] = useState<SessionStats | null>(null);

      console.error('Failed to fetch sessions:', error);

    }  const [filters, setFilters] = useState<SessionFilters>({  totalSessions: number;  autonBasket: number;

  }, [user?.uid, getUserSessions]);

    matchType: 'all',

  useEffect(() => {

    fetchSessions();    dateFrom: '',  averageScore: number;  autonSpeci: number;

  }, [fetchSessions]);

    dateTo: '',

  const refresh = useCallback(() => {

    fetchSessions();  });  highestScore: number;  teleBasket: number;

  }, [fetchSessions]);

  const [page, setPage] = useState(0);

  return {

    sessions,  const [hasMore, setHasMore] = useState(false);  recentSessions: SessionData[];  teleSpeci: number;

    stats,

    loading,

    refresh,

  };  const fetchSessions = useCallback(async () => {}  endgameHang: number;

};
    if (!user?.uid) return;

}

    try {

      const result = await getUserSessions(user.uid);export const useSessions = (initialLimit = 10) => {

      if (result) {

        let filteredSessions = result;  const { user } = useAuth();interface SessionStats {

        

        if (filters.matchType !== 'all') {  const { getUserSessions, loading } = useFirebase();  totalSessions: number;

          filteredSessions = filteredSessions.filter(s => s.matchType === filters.matchType);

        }    averageScore: number;

        

        if (filters.dateFrom) {  const [sessions, setSessions] = useState<SessionData[]>([]);  highestScore: number;

          const fromDate = new Date(filters.dateFrom);

          filteredSessions = filteredSessions.filter(s => {  const [stats, setStats] = useState<SessionStats | null>(null);  totalPlayTime: number;

            const sessionDate = typeof s.createdAt === 'string' ? new Date(s.createdAt) : s.createdAt.toDate();

            return sessionDate >= fromDate;  const [filters, setFilters] = useState<SessionFilters>({  matchTypeBreakdown: Record<string, number>;

          });

        }    matchType: 'all',  recentSessions: Session[];

        

        if (filters.dateTo) {    dateFrom: '',  performanceTrend: Array<{ date: string; score: number }>;

          const toDate = new Date(filters.dateTo);

          filteredSessions = filteredSessions.filter(s => {    dateTo: '',}

            const sessionDate = typeof s.createdAt === 'string' ? new Date(s.createdAt) : s.createdAt.toDate();

            return sessionDate <= toDate;  });

          });

        }  const [page, setPage] = useState(0);interface UseSessionsOptions {

        

        const start = page * initialLimit;  const [hasMore, setHasMore] = useState(false);  initialLimit?: number;

        const end = start + initialLimit;

        const paginatedSessions = filteredSessions.slice(start, end);  autoLoad?: boolean;

        

        if (page === 0) {  const fetchSessions = useCallback(async () => {}

          setSessions(paginatedSessions);

        } else {    if (!user?.uid) return;

          setSessions(prev => [...prev, ...paginatedSessions]);

        }export const useSessions = (options: UseSessionsOptions = {}) => {

        

        setHasMore(end < filteredSessions.length);    try {  const { initialLimit = 20, autoLoad = true } = options;

        

        if (filteredSessions.length > 0) {      const result = await getUserSessions(user.uid);  const { user } = useAuth();

          const scores = filteredSessions

            .map(s => s.finalScore)      if (result) {  const { getUserSessions, loading } = useFirebase();

            .filter((score): score is number => typeof score === 'number');

                  // Apply filters

          const sessionStats: SessionStats = {

            totalSessions: filteredSessions.length,        let filteredSessions = result;  const [sessions, setSessions] = useState<Session[]>([]);

            averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,

            highestScore: scores.length > 0 ? Math.max(...scores) : 0,          const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);

            recentSessions: filteredSessions.slice(0, 5),

          };        if (filters.matchType !== 'all') {  const [currentPage, setCurrentPage] = useState(0);

          

          setStats(sessionStats);          filteredSessions = filteredSessions.filter(s => s.matchType === filters.matchType);  const [hasMore, setHasMore] = useState(true);

        }

      }        }  const [isDatabaseAvailable, setIsDatabaseAvailable] = useState(true);

    } catch (error) {

      console.error('Failed to fetch sessions:', error);          const [filters, setFilters] = useState({

    }

  }, [user?.uid, getUserSessions, filters, page, initialLimit]);        if (filters.dateFrom) {    searchTerm: '',



  useEffect(() => {          const fromDate = new Date(filters.dateFrom);    matchType: 'all',

    fetchSessions();

  }, [fetchSessions]);          filteredSessions = filteredSessions.filter(s => {    sortBy: 'newest',



  const updateFilters = useCallback((newFilters: Partial<SessionFilters>) => {            const sessionDate = typeof s.createdAt === 'string' ? new Date(s.createdAt) : s.createdAt.toDate();    dateFrom: '',

    setFilters(prev => ({ ...prev, ...newFilters }));

    setPage(0);            return sessionDate >= fromDate;    dateTo: '',

    setSessions([]);

  }, []);          });  });



  const loadMore = useCallback(() => {        }

    if (!loading && hasMore) {

      setPage(prev => prev + 1);          // Add throttling and request deduplication

    }

  }, [loading, hasMore]);        if (filters.dateTo) {  const lastFetchTime = useRef<number>(0);



  const refresh = useCallback(() => {          const toDate = new Date(filters.dateTo);  const minFetchInterval = 5000; // Minimum 5 seconds between fetches

    setPage(0);

    setSessions([]);          filteredSessions = filteredSessions.filter(s => {  const pendingRequest = useRef<Promise<void> | null>(null);

    fetchSessions();

  }, [fetchSessions]);            const sessionDate = typeof s.createdAt === 'string' ? new Date(s.createdAt) : s.createdAt.toDate();



  return {            return sessionDate <= toDate;  const loadSessions = useCallback(

    sessions,

    stats,          });    async (page = 0, append = false) => {

    loading,

    hasMore,        }      if (!user?.uid) return;

    filters,

    updateFilters,        

    loadMore,

    refresh,        // Pagination      // Throttling: prevent too frequent requests

  };

};        const start = page * initialLimit;      const now = Date.now();

        const end = start + initialLimit;      if (now - lastFetchTime.current < minFetchInterval && !append) {

        const paginatedSessions = filteredSessions.slice(start, end);        return;

              }

        if (page === 0) {

          setSessions(paginatedSessions);      // Deduplication: if there's already a pending request, wait for it

        } else {      if (pendingRequest.current && !append) {

          setSessions(prev => [...prev, ...paginatedSessions]);        try {

        }          await pendingRequest.current;

                } catch {

        setHasMore(end < filteredSessions.length);          // Ignore errors from pending requests

                }

        // Calculate stats        return;

        if (filteredSessions.length > 0) {      }

          const scores = filteredSessions

            .map(s => s.finalScore)      const requestPromise = (async () => {

            .filter((score): score is number => typeof score === 'number');        try {

                    const options = {

          const sessionStats: SessionStats = {            limit: initialLimit,

            totalSessions: filteredSessions.length,            offset: page * initialLimit,

            averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,            sortBy: 'createdAt' as const,

            highestScore: scores.length > 0 ? Math.max(...scores) : 0,            sortOrder: 'desc' as const,

            recentSessions: filteredSessions.slice(0, 5),            matchType:

          };              filters.matchType !== 'all' ? filters.matchType : undefined,

                      dateFrom: filters.dateFrom || undefined,

          setStats(sessionStats);            dateTo: filters.dateTo || undefined,

        }          };

      }

    } catch (error) {          const result = await getSessions(user.uid, options);

      console.error('Failed to fetch sessions:', error);

    }          // Check if we got an empty response due to database being unavailable

  }, [user?.uid, getUserSessions, filters, page, initialLimit]);          if (result && typeof result === 'object' && 'sessions' in result) {

            const { sessions: newSessions, pagination } = result as {

  useEffect(() => {              sessions: Session[];

    fetchSessions();              pagination: { hasMore: boolean; total: number };

  }, [fetchSessions]);            };



  const updateFilters = useCallback((newFilters: Partial<SessionFilters>) => {            // If we get empty sessions and total is 0, it might be database unavailable

    setFilters(prev => ({ ...prev, ...newFilters }));            setIsDatabaseAvailable(newSessions.length > 0 || pagination.total > 0);

    setPage(0); // Reset pagination

    setSessions([]); // Clear existing sessions            if (append) {

  }, []);              setSessions(prev => [...prev, ...(newSessions || [])]);

            } else {

  const loadMore = useCallback(() => {              setSessions(newSessions || []);

    if (!loading && hasMore) {            }

      setPage(prev => prev + 1);

    }            setHasMore(pagination?.hasMore || false);

  }, [loading, hasMore]);          } else {

            // Handle legacy response format

  const refresh = useCallback(() => {            const sessionData = (result as Session[]) || [];

    setPage(0);            setIsDatabaseAvailable(sessionData.length > 0);

    setSessions([]);            

    fetchSessions();            if (append) {

  }, [fetchSessions]);              setSessions(prev => [...prev, ...sessionData]);

            } else {

  return {              setSessions(sessionData);

    sessions,            }

    stats,            setHasMore(sessionData.length === initialLimit);

    loading,          }

    hasMore,

    filters,          // Update last fetch time

    updateFilters,          lastFetchTime.current = Date.now();

    loadMore,        } catch (error) {

    refresh,          // Handle error silently in production

  };          console.warn('Failed to load sessions:', error);

};        } finally {
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
