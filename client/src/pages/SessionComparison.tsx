import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useApi } from '../hooks/useApi';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Trophy,
  BarChart3,
} from 'lucide-react';

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

const SessionComparison: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { getSession, loading } = useApi();
  const [sessions, setSessions] = useState<Session[]>([]);

  const loadSessions = useCallback(
    async (sessionIds: string[]) => {
      try {
        const sessionPromises = sessionIds.map(id => getSession(id));
        const sessionResults = await Promise.all(sessionPromises);
        const validSessions = sessionResults.filter(Boolean) as Session[];
        setSessions(validSessions);
      } catch {
        // Handle error silently - could show user notification here instead
      }
    },
    [getSession]
  );

  useEffect(() => {
    const sessionIds = searchParams.get('ids');
    if (sessionIds && user?.uid) {
      const ids = sessionIds.split(',');
      loadSessions(ids);
    }
  }, [searchParams, user?.uid, loadSessions]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMatchTypeColor = (matchType: string) => {
    switch (matchType.toLowerCase()) {
      case 'autonomous':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'teleop':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'practice':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'full game':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getComparisonMetrics = () => {
    if (sessions.length < 2) return null;

    const metrics = [
      {
        label: 'Final Score',
        values: sessions.map(s => s.finalScore),
        format: (val: number) => val.toString(),
        type: 'number' as const,
      },
      {
        label: 'Session Duration',
        values: sessions.map(s => s.sessionDuration),
        format: (val: string) => val,
        type: 'string' as const,
      },
      {
        label: 'Auton Total',
        values: sessions.map(s => s.autonBasket + s.autonSpeci),
        format: (val: number) => val.toString(),
        type: 'number' as const,
      },
      {
        label: 'Teleop Total',
        values: sessions.map(s => s.teleBasket + s.teleSpeci),
        format: (val: number) => val.toString(),
        type: 'number' as const,
      },
      {
        label: 'Endgame Hang',
        values: sessions.map(s => s.endgameHang),
        format: (val: number) => val.toString(),
        type: 'number' as const,
      },
    ];

    return metrics;
  };

  const metrics = getComparisonMetrics();

  if (loading) {
    return (
      <div
        className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} py-12 px-4 sm:px-6 lg:px-8`}
      >
        <div className="max-w-6xl mx-auto">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid gap-6 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-96" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'} py-12 px-4 sm:px-6 lg:px-8`}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/sessions/select')}
              className={isDarkMode ? 'text-gray-300 hover:text-white' : ''}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Selection
            </Button>
            <div>
              <h1
                className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              >
                Session Comparison
              </h1>
              <p
                className={`mt-2 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
              >
                Compare {sessions.length} selected sessions side by side
              </p>
            </div>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <Trophy
              className={`mx-auto h-12 w-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`}
            />
            <h3
              className={`mt-2 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}
            >
              No sessions to compare
            </h3>
            <p
              className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            >
              Go back and select sessions to compare.
            </p>
          </div>
        ) : sessions.length === 1 ? (
          <div className="text-center py-12">
            <BarChart3
              className={`mx-auto h-12 w-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`}
            />
            <h3
              className={`mt-2 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}
            >
              Select more sessions
            </h3>
            <p
              className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            >
              You need at least 2 sessions to compare. Go back and select more.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Sessions Overview */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session, index) => (
                <Card
                  key={session.id}
                  className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : ''}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle
                        className={`text-lg ${isDarkMode ? 'text-white' : ''}`}
                      >
                        Session {index + 1}
                      </CardTitle>
                      <Badge className={getMatchTypeColor(session.matchType)}>
                        {session.matchType}
                      </Badge>
                    </div>
                    <CardDescription
                      className={isDarkMode ? 'text-gray-400' : ''}
                    >
                      {session.sessionName}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4 text-gray-400" />
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                          }
                        >
                          {session.driverName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                          }
                        >
                          {session.sessionDuration}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span
                          className={
                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                          }
                        >
                          {formatDate(session.createdAt)}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    <div className="text-center">
                      <div
                        className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                      >
                        {session.finalScore}
                      </div>
                      <div
                        className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                      >
                        Final Score
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Detailed Comparison */}
            {metrics && (
              <Card
                className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : ''}`}
              >
                <CardHeader>
                  <CardTitle
                    className={`flex items-center gap-2 ${isDarkMode ? 'text-white' : ''}`}
                  >
                    <BarChart3 className="h-5 w-5" />
                    Detailed Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {metrics.map((metric, index) => (
                      <div key={index}>
                        <h4
                          className={`font-medium mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        >
                          {metric.label}
                        </h4>
                        <div
                          className="grid gap-4"
                          style={{
                            gridTemplateColumns: `repeat(${sessions.length}, 1fr)`,
                          }}
                        >
                          {sessions.map((session, sessionIndex) => {
                            const value = metric.values[sessionIndex];
                            const isHighest =
                              typeof value === 'number' &&
                              value ===
                                Math.max(
                                  ...(metric.values as number[]).filter(
                                    v => typeof v === 'number'
                                  )
                                );

                            return (
                              <div
                                key={session.id}
                                className={`p-3 rounded-lg text-center ${
                                  isHighest
                                    ? 'bg-green-100 dark:bg-green-900/20 border-2 border-green-500'
                                    : isDarkMode
                                      ? 'bg-gray-900'
                                      : 'bg-gray-50'
                                }`}
                              >
                                <div
                                  className={`text-lg font-semibold ${
                                    isHighest
                                      ? 'text-green-800 dark:text-green-200'
                                      : isDarkMode
                                        ? 'text-white'
                                        : 'text-gray-900'
                                  }`}
                                >
                                  {metric.type === 'number'
                                    ? metric.format(value as number)
                                    : value}
                                </div>
                                <div
                                  className={`text-xs ${
                                    isHighest
                                      ? 'text-green-600 dark:text-green-400'
                                      : isDarkMode
                                        ? 'text-gray-400'
                                        : 'text-gray-500'
                                  }`}
                                >
                                  Session {sessionIndex + 1}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionComparison;
