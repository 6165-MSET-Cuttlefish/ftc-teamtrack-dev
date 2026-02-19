import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useTheme, useSession, useTeam } from '@/contexts';
import { firebaseService } from '@/services';
import { ROUTES, APP_CONFIG } from '@/constants';
import { isAbortError, toDate } from '@/lib/utils';
import type { Session, ChartDataPoint } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  Award,
  Target,
  Zap,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  LineChart,
  Line,
  ComposedChart,
} from 'recharts';

const Charts = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { hasActiveSession } = useSession();
  const { team } = useTeam();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90' | 'all'>('30');

  useEffect(() => {
    document.title = `Charts - ${APP_CONFIG.name}`;
  }, []);

  useEffect(() => {
    const loadSessions = async () => {
      if (!user?.uid) return;

      setLoading(true);
      try {
        const userSessions = team
          ? await firebaseService.getTeamSessions(team.id)
          : await firebaseService.getUserSessions(user.uid);
        setSessions(userSessions);
      } catch (error) {
        if (isAbortError(error)) return;
        const { logger } = await import('@/lib/logger');
        logger.error('Error loading sessions', error);
        toast.error('Failed to load sessions');
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [user?.uid, team]);

  // Use a custom short date format for charts
  const formatChartDate = (timestamp: unknown): string => {
    if (!timestamp) return 'Unknown';
    const date = toDate(timestamp);
    if (isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getFilteredSessions = (): Session[] => {
    if (timeRange === 'all') return sessions;

    const days = parseInt(timeRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return sessions.filter(session => {
      if (!session.createdAt) return false;
      const sessionDate = toDate(session.createdAt);

      return sessionDate >= cutoffDate;
    });
  };

  // Score Trend Data
  const getScoreTrendData = (): ChartDataPoint[] => {
    const filteredSessions = getFilteredSessions();
    if (filteredSessions.length === 0) return [];

    return filteredSessions
      .sort(
        (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime()
      )
      .map((session, index) => {
        const matchCount = session.matches.length || 1;
        const finalScore =
          session.matches.reduce((sum, m) => sum + (m.finalScore || 0), 0) /
          matchCount;
        const autonomousScore =
          session.matches.reduce(
            (sum, m) => sum + (m.autonomousScore || 0),
            0
          ) / matchCount;
        const teleopScore =
          session.matches.reduce((sum, m) => sum + (m.teleopScore || 0), 0) /
          matchCount;
        const endGameScore =
          session.matches.reduce((sum, m) => sum + (m.endGameScore || 0), 0) /
          matchCount;
        return {
          name: formatChartDate(session.createdAt),
          sessionNumber: index + 1,
          'Final Score': Math.round(finalScore),
          Autonomous: Math.round(autonomousScore),
          Teleop: Math.round(teleopScore),
          Endgame: Math.round(endGameScore),
        };
      });
  };

  // Balls Missed Trend Data
  const getBallsMissedTrendData = (): ChartDataPoint[] => {
    const filteredSessions = getFilteredSessions();
    if (filteredSessions.length === 0) return [];

    return filteredSessions
      .sort(
        (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime()
      )
      .map((session, index) => {
        const matchCount = session.matches.length || 1;
        const ballsMissed =
          session.matches.reduce(
            (sum, m) =>
              sum + (m.autonBallsMissed || 0) + (m.teleBallsMissed || 0),
            0
          ) / matchCount;
        return {
          name: formatChartDate(session.createdAt),
          sessionNumber: index + 1,
          'Balls Missed': Math.round(ballsMissed * 10) / 10,
        };
      });
  };

  // Cycle Time Analysis
  const getCycleTimeData = (): ChartDataPoint[] => {
    const filteredSessions = getFilteredSessions();

    // Get sessions that have cycle times
    const sessionsWithCycleTimes = filteredSessions.filter(session => {
      // Check if session has matches with cycle times
      const hasCycleTimes =
        session.matches &&
        session.matches.length > 0 &&
        session.matches.some(
          match =>
            match.cycleTimes &&
            Array.isArray(match.cycleTimes) &&
            match.cycleTimes.length > 0
        );
      return hasCycleTimes;
    });

    if (sessionsWithCycleTimes.length === 0) return [];

    const results = sessionsWithCycleTimes.map(session => {
      // Collect all cycle times from all matches in this session
      const allCycleTimes: number[] = [];
      session.matches.forEach(match => {
        if (
          match.cycleTimes &&
          Array.isArray(match.cycleTimes) &&
          match.cycleTimes.length > 0
        ) {
          allCycleTimes.push(...match.cycleTimes);
        }
      });

      if (allCycleTimes.length === 0) return null;

      const avg =
        allCycleTimes.reduce((sum, t) => sum + t, 0) / allCycleTimes.length;
      const min = Math.min(...allCycleTimes);
      const max = Math.max(...allCycleTimes);

      return {
        name: session.sessionName || formatChartDate(session.createdAt),
        'Avg Cycle': parseFloat(avg.toFixed(1)),
        Fastest: parseFloat(min.toFixed(1)),
        Slowest: parseFloat(max.toFixed(1)),
      };
    });

    return results.filter(
      (item): item is NonNullable<typeof item> => item !== null
    );
  };

  // Recent Performance Trend (Last 10 sessions)
  const getRecentTrendData = (): ChartDataPoint[] => {
    const allSessions = getFilteredSessions();
    const sorted = [...allSessions].sort(
      (a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()
    );

    const recent = sorted.slice(0, 10).reverse();

    return recent.map((session, index) => {
      const sessionScore = getSessionScore(session);

      const movingAvg =
        recent
          .slice(Math.max(0, index - 2), index + 1)
          .reduce((sum, s) => sum + getSessionScore(s), 0) /
        Math.min(3, index + 1);

      return {
        name: `#${recent.length - index}`,
        Score: sessionScore,
        'Moving Avg': Math.round(movingAvg),
      };
    });
  };

  // Consistency Over Time (rolling standard deviation)
  const getConsistencyOverTimeData = (): ChartDataPoint[] => {
    const allSessions = getFilteredSessions();
    if (allSessions.length < 3) return [];

    const sorted = [...allSessions].sort(
      (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime()
    );

    return sorted.slice(2).map((session, index) => {
      const windowSessions = sorted.slice(Math.max(0, index), index + 3);
      const scores = windowSessions.map(s => getSessionScore(s));
      const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const variance =
        scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) /
        scores.length;
      const stdDev = Math.sqrt(variance);
      // Convert to consistency percentage (lower std dev = higher consistency)
      const consistency =
        mean > 0 ? Math.max(0, Math.min(100, 100 - (stdDev / mean) * 100)) : 0;

      const sessionScore = getSessionScore(session);

      return {
        name: formatChartDate(session.createdAt),
        Consistency: Math.round(consistency),
        Score: sessionScore,
      };
    });
  };

  const COLORS = {
    primary: '#537788',
    secondary: '#B0E5FE',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    pink: '#ec4899',
  };

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{
      name: string;
      value: number;
      color: string;
      dataKey?: string;
    }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div
          className={`p-4 rounded-lg border ${isDarkMode ? 'bg-team-dark/95 border-team-blue-40 backdrop-blur-sm' : 'bg-white/95 border-gray-200 backdrop-blur-sm'} shadow-xl`}
        >
          {label && (
            <p
              className={`font-bold mb-3 pb-2 border-b ${isDarkMode ? 'text-white border-team-blue-40' : 'text-gray-900 border-gray-200'}`}
            >
              {label}
            </p>
          )}
          <div className="space-y-2">
            {payload.map((entry, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span
                    className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    {entry.name}:
                  </span>
                </div>
                <span
                  className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  style={{ color: entry.color }}
                >
                  {typeof entry.value === 'number'
                    ? entry.value.toFixed(1)
                    : entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div className="text-team-blue text-2xl">Loading charts...</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div
        className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div className="max-w-[1152px] mx-auto px-4 sm:px-8 py-8">
          <Button
            variant="ghost"
            onClick={() => navigate(ROUTES.SESSIONS)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sessions
          </Button>
          <Card
            className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
          >
            <CardContent className="py-12">
              <div className="text-center">
                <div className="text-team-blue text-5xl mb-4">📊</div>
                <h3
                  className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  No Data Available
                </h3>
                <p
                  className={`mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  Record some sessions to see your performance charts
                </p>
                <Button
                  onClick={() => navigate(ROUTES.ACTIVE)}
                  disabled={hasActiveSession}
                  title={
                    hasActiveSession
                      ? 'Complete or cancel the active session first'
                      : undefined
                  }
                  className={`bg-team-blue hover:bg-team-blue/90 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'text-black' : 'text-[#FEFEFE]'}`}
                >
                  Start New Session
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Helper function to get average match score for a session
  const getSessionScore = (session: Session): number => {
    const matchCount = session.matches.length || 1;
    return Math.round(
      session.matches.reduce((sum, m) => sum + (m.finalScore || 0), 0) /
        matchCount
    );
  };

  const scoreTrendData = getScoreTrendData();
  const ballsMissedTrendData = getBallsMissedTrendData();
  const cycleTimeData = getCycleTimeData();
  const recentTrendData = getRecentTrendData();
  const consistencyOverTimeData = getConsistencyOverTimeData();

  return (
    <div
      className={`min-h-screen page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1152px] mx-auto px-2 sm:px-3 md:px-4 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(ROUTES.SESSIONS)}
            className="mb-3 sm:mb-4 p-1 h-auto"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="text-xs sm:text-sm">Back</span>
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-team-blue text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-1 sm:mb-2">
                Performance Charts
              </h1>
              <p
                className={`text-xs sm:text-sm md:text-base ml-0 sm:ml-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
              >
                Visualize your session data and track progress
              </p>
            </div>
            <div className="flex gap-2 sm:gap-3 flex-shrink-0">
              <Select
                value={timeRange}
                onValueChange={value =>
                  setTimeRange(value as '7' | '30' | '90' | 'all')
                }
              >
                <SelectTrigger
                  className={`w-auto text-xs sm:text-sm px-2 h-9 sm:h-10 ${isDarkMode ? 'bg-team-dark border-team-blue-40 text-white' : 'bg-white border-gray-300'}`}
                >
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  className={`${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white'}`}
                >
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Key Insights */}
        {getFilteredSessions().length >= 3 && (
          <Card
            className={`mb-6 sm:mb-8 shadow-lg ${isDarkMode ? 'bg-gradient-to-r from-team-blue/20 to-team-dark border-team-blue-40' : 'bg-gradient-to-r from-blue-50 to-white border-blue-200'}`}
          >
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-team-blue flex-shrink-0 mt-0 sm:mt-1" />
                <div className="flex-1 min-w-0">
                  <h3
                    className={`text-base sm:text-lg font-bold mb-2 sm:mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    Key Insights
                  </h3>
                  <div
                    className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-700'}`}
                  >
                    {(() => {
                      const sessions = getFilteredSessions();
                      let totalScore = 0;
                      let totalAuto = 0;
                      let totalTele = 0;
                      let totalEndgame = 0;
                      const allScores: number[] = [];

                      sessions.forEach(s => {
                        s.matches.forEach(m => {
                          totalScore += m.finalScore || 0;
                          totalAuto += m.autonomousScore || 0;
                          totalTele += m.teleopScore || 0;
                          totalEndgame += m.endGameScore || 0;
                          allScores.push(m.finalScore || 0);
                        });
                      });

                      const totalMatches = sessions.reduce(
                        (sum, s) => sum + s.matches.length,
                        0
                      );
                      const count = totalMatches || 1;
                      const avgScore = totalScore / count;
                      const autoAvg = totalAuto / count;
                      const teleAvg = totalTele / count;
                      const endgameAvg = totalEndgame / count;

                      const totalMissed = sessions.reduce(
                        (sum, s) =>
                          sum +
                          s.matches.reduce(
                            (mSum, m) =>
                              mSum +
                              (m.autonBallsMissed || 0) +
                              (m.teleBallsMissed || 0),
                            0
                          ),
                        0
                      );
                      const avgMissed = (totalMissed / count).toFixed(1);

                      const bestPhase =
                        autoAvg > teleAvg && autoAvg > endgameAvg
                          ? 'Autonomous'
                          : teleAvg > endgameAvg
                            ? 'Teleop'
                            : 'Endgame';

                      const autoPercent = avgScore > 0 ? ((autoAvg / avgScore) * 100).toFixed(
                        0
                      ) : '0';
                      const telePercent = avgScore > 0 ? ((teleAvg / avgScore) * 100).toFixed(
                        0
                      ) : '0';

                      const mean = avgScore;
                      const variance =
                        allScores.reduce(
                          (acc, score) => acc + Math.pow(score - mean, 2),
                          0
                        ) / count;
                      const stdDev = Math.sqrt(variance);
                      const cv = (stdDev / mean) * 100;

                      return (
                        <>
                          <div>
                            <span className="font-semibold text-team-blue">
                              Strongest Phase:
                            </span>{' '}
                            {bestPhase} averaging{' '}
                            {Math.round(
                              bestPhase === 'Autonomous'
                                ? autoAvg
                                : bestPhase === 'Teleop'
                                  ? teleAvg
                                  : endgameAvg
                            )}{' '}
                            points
                          </div>
                          <div>
                            <span className="font-semibold text-team-blue">
                              Score Distribution:
                            </span>{' '}
                            {autoPercent}% Auto, {telePercent}% Teleop
                          </div>
                          <div>
                            <span className="font-semibold text-team-blue">
                              Consistency:
                            </span>{' '}
                            {cv < 15
                              ? 'Excellent'
                              : cv < 25
                                ? 'Good'
                                : 'Improving'}{' '}
                            (±{Math.round(stdDev)} pts)
                          </div>
                          <div>
                            <span className="font-semibold text-team-blue">
                              Accuracy:
                            </span>{' '}
                            Avg {avgMissed} balls missed per match
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <Card
            className={`transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-2">
                <div className="text-team-blue text-4xl font-bold">
                  {getFilteredSessions().length}
                </div>
                <Activity className="w-8 h-8 text-team-blue opacity-60" />
              </div>
              <div
                className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
              >
                Total Sessions
              </div>
            </CardContent>
          </Card>
          <Card
            className={`transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-2">
                <div className="text-team-blue text-4xl font-bold">
                  {getFilteredSessions().length > 0
                    ? Math.round(
                        getFilteredSessions().reduce(
                          (sum, s) => sum + getSessionScore(s),
                          0
                        ) / getFilteredSessions().length
                      )
                    : 0}
                </div>
                <Target className="w-8 h-8 text-team-blue opacity-60" />
              </div>
              <div
                className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
              >
                Average Score
              </div>
            </CardContent>
          </Card>
          <Card
            className={`transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-2">
                <div className="text-team-blue text-4xl font-bold">
                  {getFilteredSessions().length > 0
                    ? Math.max(
                        ...getFilteredSessions().map(s => getSessionScore(s))
                      )
                    : 0}
                </div>
                <Award className="w-8 h-8 text-team-blue opacity-60" />
              </div>
              <div
                className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
              >
                Best Score
              </div>
            </CardContent>
          </Card>
          <Card
            className={`transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {(() => {
                    if (getFilteredSessions().length < 2) {
                      return (
                        <>
                          <Zap className="text-team-blue w-7 h-7" />
                          <div className="text-team-blue text-4xl font-bold">
                            —
                          </div>
                        </>
                      );
                    }
                    const sorted = [...getFilteredSessions()].sort(
                      (a, b) =>
                        toDate(a.createdAt).getTime() -
                        toDate(b.createdAt).getTime()
                    );
                    const firstHalf = sorted.slice(
                      0,
                      Math.floor(sorted.length / 2)
                    );
                    const secondHalf = sorted.slice(
                      Math.floor(sorted.length / 2)
                    );
                    const firstAvg =
                      firstHalf.reduce(
                        (sum, s) => sum + getSessionScore(s),
                        0
                      ) / firstHalf.length;
                    const secondAvg =
                      secondHalf.reduce(
                        (sum, s) => sum + getSessionScore(s),
                        0
                      ) / secondHalf.length;
                    const improvement = secondAvg - firstAvg;
                    const isPositive = improvement > 0;

                    return (
                      <>
                        {isPositive ? (
                          <TrendingUp className="text-green-500 w-7 h-7" />
                        ) : (
                          <TrendingDown className="text-red-500 w-7 h-7" />
                        )}
                        <div
                          className={`text-4xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}
                        >
                          {improvement > 0
                            ? `+${Math.round(improvement)}`
                            : Math.round(improvement)}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div
                className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
              >
                Improvement
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="space-y-6 sm:space-y-8">
          {/* Score Trend Line Chart */}
          <Card
            className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
          >
            <CardHeader>
              <CardTitle
                className={`text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              >
                Score Trends Over Time
              </CardTitle>
              <CardDescription
                className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
              >
                Track your progress across all scoring phases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height={250} minWidth={300}>
                  <AreaChart data={scoreTrendData}>
                    <defs>
                      <linearGradient
                        id="colorFinal"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={COLORS.primary}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={COLORS.primary}
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorAuto"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={COLORS.success}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={COLORS.success}
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorTele"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={COLORS.warning}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={COLORS.warning}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'}
                    />
                    <XAxis
                      dataKey="name"
                      stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ stroke: COLORS.primary, strokeWidth: 2 }}
                    />
                    <Legend wrapperStyle={{ fontSize: '14px' }} />
                    <Area
                      type="monotone"
                      dataKey="Final Score"
                      stroke={COLORS.primary}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorFinal)"
                      animationDuration={1500}
                    />
                    <Area
                      type="monotone"
                      dataKey="Autonomous"
                      stroke={COLORS.success}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorAuto)"
                      animationDuration={1500}
                    />
                    <Area
                      type="monotone"
                      dataKey="Teleop"
                      stroke={COLORS.warning}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorTele)"
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Performance Trend */}
            <Card
              className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
            >
              <CardHeader>
                <CardTitle
                  className={`text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  Recent Performance (Last 10)
                </CardTitle>
                <CardDescription
                  className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  Session scores with 3-session moving average
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height={220} minWidth={300}>
                    <ComposedChart data={recentTrendData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'}
                      />
                      <XAxis
                        dataKey="name"
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '14px' }} />
                      <Bar
                        dataKey="Score"
                        fill={COLORS.primary}
                        opacity={1}
                        radius={[6, 6, 0, 0]}
                        animationDuration={1000}
                        activeBar={{
                          stroke: isDarkMode ? '#fff' : '#000',
                          strokeWidth: 2,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Moving Avg"
                        stroke={COLORS.success}
                        strokeWidth={3}
                        dot={{
                          fill: COLORS.success,
                          r: 5,
                          strokeWidth: 2,
                          stroke: '#fff',
                        }}
                        animationDuration={1200}
                        animationBegin={300}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Consistency Over Time */}
            {consistencyOverTimeData.length > 0 && (
              <Card
                className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-gray-200'}`}
              >
                <CardHeader>
                  <CardTitle
                    className={`text-xl sm:text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    Consistency Over Time
                  </CardTitle>
                  <CardDescription
                    className={`text-xs sm:text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    Rolling 3-session consistency percentage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full overflow-x-auto">
                    <ResponsiveContainer
                      width="100%"
                      height={220}
                      minWidth={300}
                    >
                      <LineChart data={consistencyOverTimeData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'}
                        />
                        <XAxis
                          dataKey="name"
                          stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                          tick={{ fontSize: 12 }}
                          domain={[0, 100]}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '14px' }} />
                        <Line
                          type="monotone"
                          dataKey="Consistency"
                          stroke={COLORS.purple}
                          strokeWidth={3}
                          dot={{
                            fill: COLORS.purple,
                            r: 5,
                            strokeWidth: 2,
                            stroke: '#fff',
                          }}
                          animationDuration={1200}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Balls Missed Trend Chart */}
          <Card
            className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
          >
            <CardHeader>
              <CardTitle
                className={`text-xl sm:text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              >
                Balls Missed Trend
              </CardTitle>
              <CardDescription
                className={`text-xs sm:text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
              >
                Track total balls missed per session (Autonomous + Teleop)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height={240} minWidth={300}>
                  <LineChart data={ballsMissedTrendData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'}
                    />
                    <XAxis
                      dataKey="name"
                      stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '14px' }} />
                    <Line
                      type="monotone"
                      dataKey="Balls Missed"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ fill: '#f59e0b', r: 5 }}
                      activeDot={{ r: 8 }}
                      animationDuration={1500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Cycle Time Analysis */}
          {cycleTimeData.length > 0 && (
            <Card
              className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
            >
              <CardHeader>
                <CardTitle
                  className={`text-xl sm:text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  Cycle Time Analysis
                </CardTitle>
                <CardDescription
                  className={`text-xs sm:text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  Average cycle time per session (seconds)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height={240} minWidth={300}>
                    <LineChart data={cycleTimeData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'}
                      />
                      <XAxis
                        dataKey="name"
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        label={{
                          value: 'Seconds',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 12 },
                        }}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '14px' }} />
                      <Line
                        type="monotone"
                        dataKey="Avg Cycle"
                        stroke={COLORS.primary}
                        strokeWidth={3}
                        dot={{
                          fill: COLORS.primary,
                          r: 6,
                          strokeWidth: 2,
                          stroke: '#fff',
                        }}
                        animationDuration={1200}
                      />
                      <Line
                        type="monotone"
                        dataKey="Fastest"
                        stroke={COLORS.success}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{
                          fill: COLORS.success,
                          r: 5,
                          strokeWidth: 2,
                          stroke: '#fff',
                        }}
                        animationDuration={1200}
                        animationBegin={200}
                      />
                      <Line
                        type="monotone"
                        dataKey="Slowest"
                        stroke={COLORS.danger}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{
                          fill: COLORS.danger,
                          r: 5,
                          strokeWidth: 2,
                          stroke: '#fff',
                        }}
                        animationDuration={1200}
                        animationBegin={400}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Charts;
