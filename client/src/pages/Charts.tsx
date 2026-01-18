import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useTheme } from '@/contexts';
import { firebaseService, SessionData } from '@/services';
import { ROUTES } from '@/constants';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Award, Target, Zap, Activity } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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

interface ChartDataPoint {
  name?: string;
  value?: number;
  category?: string;
  fullMark?: number;
  [key: string]: string | number | undefined;
}

const Charts = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90' | 'all'>('30');

  useEffect(() => {
    const loadSessions = async () => {
      if (!user?.uid) return;

      setLoading(true);
      try {
        const userSessions = await firebaseService.getUserSessions(user.uid);
        setSessions(userSessions);
      } catch (error) {
        console.error('Error loading sessions:', error);
        toast.error('Failed to load sessions');
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [user?.uid]);

  const formatDate = (timestamp: unknown): string => {
    if (!timestamp) return 'Unknown';

    let date: Date;
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (
      typeof timestamp === 'object' &&
      timestamp !== null &&
      'seconds' in timestamp
    ) {
      const ts = timestamp as { seconds: number };
      date = new Date(ts.seconds * 1000);
    } else {
      return 'Unknown';
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getFilteredSessions = (): SessionData[] => {
    if (timeRange === 'all') return sessions;

    const days = parseInt(timeRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return sessions.filter(session => {
      if (!session.createdAt) return false;

      let sessionDate: Date;
      if (typeof session.createdAt === 'string') {
        sessionDate = new Date(session.createdAt);
      } else if (
        typeof session.createdAt === 'object' &&
        'seconds' in session.createdAt
      ) {
        const ts = session.createdAt as { seconds: number };
        sessionDate = new Date(ts.seconds * 1000);
      } else {
        return false;
      }

      return sessionDate >= cutoffDate;
    });
  };

  // Score Trend Data
  const getScoreTrendData = (): ChartDataPoint[] => {
    const filteredSessions = getFilteredSessions();
    return filteredSessions
      .sort((a, b) => {
        const dateA =
          typeof a.createdAt === 'string'
            ? new Date(a.createdAt)
            : new Date((a.createdAt as { seconds: number }).seconds * 1000);
        const dateB =
          typeof b.createdAt === 'string'
            ? new Date(b.createdAt)
            : new Date((b.createdAt as { seconds: number }).seconds * 1000);
        return dateA.getTime() - dateB.getTime();
      })
      .map((session, index) => ({
        name: formatDate(session.createdAt),
        sessionNumber: index + 1,
        'Final Score': session.finalScore || 0,
        Autonomous: session.autonomousScore || 0,
        TeleOp: session.teleOpScore || 0,
        'End Game': session.endGameScore || 0,
      }));
  };

  // Score Component Breakdown (Average)
  const getScoreBreakdownData = (): ChartDataPoint[] => {
    const filteredSessions = getFilteredSessions();
    if (filteredSessions.length === 0) return [];

    const totals = filteredSessions.reduce(
      (acc, session) => ({
        autonomous: acc.autonomous + (session.autonomousScore || 0),
        teleOp: acc.teleOp + (session.teleOpScore || 0),
        endGame: acc.endGame + (session.endGameScore || 0),
      }),
      { autonomous: 0, teleOp: 0, endGame: 0 }
    );

    const count = filteredSessions.length;

    return [
      { name: 'Autonomous', value: Math.round(totals.autonomous / count) },
      { name: 'TeleOp', value: Math.round(totals.teleOp / count) },
      { name: 'End Game', value: Math.round(totals.endGame / count) },
    ];
  };

  // Cycle Time Analysis
  const getCycleTimeData = (): ChartDataPoint[] => {
    const filteredSessions = getFilteredSessions();
    const cycleData: { [key: string]: number[] } = {};

    filteredSessions.forEach(session => {
      if (session.cycleTimes && session.cycleTimes.length > 0) {
        const date = formatDate(session.createdAt);
        if (!cycleData[date]) {
          cycleData[date] = [];
        }
        cycleData[date].push(...session.cycleTimes);
      }
    });

    return Object.entries(cycleData).map(([name, times]) => {
      const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      return {
        name,
        'Avg Cycle': parseFloat(avg.toFixed(1)),
        'Fastest': parseFloat(min.toFixed(1)),
        'Slowest': parseFloat(max.toFixed(1)),
      };
    });
  };

  // Recent Performance Trend (Last 10 sessions)
  const getRecentTrendData = (): ChartDataPoint[] => {
    const allSessions = getFilteredSessions();
    const sorted = [...allSessions].sort((a, b) => {
      const dateA =
        typeof a.createdAt === 'string'
          ? new Date(a.createdAt)
          : new Date((a.createdAt as { seconds: number }).seconds * 1000);
      const dateB =
        typeof b.createdAt === 'string'
          ? new Date(b.createdAt)
          : new Date((b.createdAt as { seconds: number }).seconds * 1000);
      return dateB.getTime() - dateA.getTime();
    });

    const recent = sorted.slice(0, 10).reverse();
    
    return recent.map((session, index) => {
      const movingAvg = recent
        .slice(Math.max(0, index - 2), index + 1)
        .reduce((sum, s) => sum + (s.finalScore || 0), 0) / Math.min(3, index + 1);

      return {
        name: `#${recent.length - index}`,
        Score: session.finalScore || 0,
        'Moving Avg': Math.round(movingAvg),
      };
    });
  };

  // Consistency Over Time (rolling standard deviation)
  const getConsistencyOverTimeData = (): ChartDataPoint[] => {
    const allSessions = getFilteredSessions();
    const sorted = [...allSessions].sort((a, b) => {
      const dateA =
        typeof a.createdAt === 'string'
          ? new Date(a.createdAt)
          : new Date((a.createdAt as { seconds: number }).seconds * 1000);
      const dateB =
        typeof b.createdAt === 'string'
          ? new Date(b.createdAt)
          : new Date((b.createdAt as { seconds: number }).seconds * 1000);
      return dateA.getTime() - dateB.getTime();
    });

    if (sorted.length < 3) return [];

    return sorted.slice(2).map((session, index) => {
      const windowSessions = sorted.slice(Math.max(0, index), index + 3);
      const scores = windowSessions.map(s => s.finalScore || 0);
      const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const variance = scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);
      // Convert to consistency percentage (lower std dev = higher consistency)
      const consistency = Math.max(0, Math.min(100, 100 - (stdDev / mean) * 100));

      return {
        name: formatDate(session.createdAt),
        Consistency: Math.round(consistency),
        Score: session.finalScore || 0,
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

  const PIE_COLORS = [
    COLORS.primary,
    COLORS.secondary,
    COLORS.success,
    COLORS.warning,
    COLORS.purple,
    COLORS.pink,
  ];

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string; dataKey?: string }>;
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
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
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
                  onClick={() => navigate(ROUTES.ORIGINAL)}
                  className="bg-team-blue hover:bg-team-blue/90 text-white"
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

  const scoreTrendData = getScoreTrendData();
  const scoreBreakdownData = getScoreBreakdownData();
  const cycleTimeData = getCycleTimeData();
  const recentTrendData = getRecentTrendData();
  const consistencyOverTimeData = getConsistencyOverTimeData();

  return (
    <div
      className={`min-h-screen page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(ROUTES.SESSIONS)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sessions
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-team-blue text-3xl lg:text-5xl font-bold mb-2">
                Performance Charts
              </h1>
              <p
                className={`text-base ml-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
              >
                Visualize your session data and track progress
              </p>
            </div>
            <div className="flex gap-3">
              <Select
                value={timeRange}
                onValueChange={value =>
                  setTimeRange(value as '7' | '30' | '90' | 'all')
                }
              >
                <SelectTrigger
                  className={`w-[180px] ${isDarkMode ? 'bg-team-dark border-team-blue-40 text-white' : 'bg-white border-gray-300'}`}
                >
                  <Calendar className="w-4 h-4 mr-2" />
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
            className={`mb-8 shadow-lg ${isDarkMode ? 'bg-gradient-to-r from-team-blue/20 to-team-dark border-team-blue-40' : 'bg-gradient-to-r from-blue-50 to-white border-blue-200'}`}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Zap className="w-8 h-8 text-team-blue flex-shrink-0 mt-1" />
                <div>
                  <h3
                    className={`text-lg font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    Key Insights
                  </h3>
                  <div
                    className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-700'}`}
                  >
                    {(() => {
                      const sessions = getFilteredSessions();
                      const avgScore =
                        sessions.reduce((sum, s) => sum + (s.finalScore || 0), 0) /
                        sessions.length;
                      const autoAvg =
                        sessions.reduce(
                          (sum, s) => sum + (s.autonomousScore || 0),
                          0
                        ) / sessions.length;
                      const teleAvg =
                        sessions.reduce((sum, s) => sum + (s.teleOpScore || 0), 0) /
                        sessions.length;
                      const endgameAvg =
                        sessions.reduce((sum, s) => sum + (s.endGameScore || 0), 0) /
                        sessions.length;

                      const bestPhase =
                        autoAvg > teleAvg && autoAvg > endgameAvg
                          ? 'Autonomous'
                          : teleAvg > endgameAvg
                            ? 'TeleOp'
                            : 'End Game';

                      const autoPercent = ((autoAvg / avgScore) * 100).toFixed(0);
                      const telePercent = ((teleAvg / avgScore) * 100).toFixed(0);

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
                                : bestPhase === 'TeleOp'
                                  ? teleAvg
                                  : endgameAvg
                            )}{' '}
                            points
                          </div>
                          <div>
                            <span className="font-semibold text-team-blue">
                              Score Distribution:
                            </span>{' '}
                            {autoPercent}% Auto, {telePercent}% TeleOp
                          </div>
                          <div>
                            <span className="font-semibold text-team-blue">
                              Consistency:
                            </span>{' '}
                            {(() => {
                              const scores = sessions.map(s => s.finalScore || 0);
                              const mean = avgScore;
                              const variance =
                                scores.reduce(
                                  (acc, score) => acc + Math.pow(score - mean, 2),
                                  0
                                ) / scores.length;
                              const stdDev = Math.sqrt(variance);
                              const cv = (stdDev / mean) * 100;
                              return cv < 15
                                ? 'Excellent'
                                : cv < 25
                                  ? 'Good'
                                  : 'Improving';
                            })()}{' '}
                            (±{Math.round(Math.sqrt(sessions.map(s => s.finalScore || 0).reduce((acc, score) => acc + Math.pow(score - avgScore, 2), 0) / sessions.length))} pts)
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
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
                          (sum, s) => sum + (s.finalScore || 0),
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
                        ...getFilteredSessions().map(s => s.finalScore || 0)
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
                          <div className="text-team-blue text-4xl font-bold">—</div>
                        </>
                      );
                    }
                    const sorted = [...getFilteredSessions()].sort((a, b) => {
                      const dateA =
                        typeof a.createdAt === 'string'
                          ? new Date(a.createdAt)
                          : new Date(
                              (a.createdAt as { seconds: number }).seconds * 1000
                            );
                      const dateB =
                        typeof b.createdAt === 'string'
                          ? new Date(b.createdAt)
                          : new Date(
                              (b.createdAt as { seconds: number }).seconds * 1000
                            );
                      return dateA.getTime() - dateB.getTime();
                    });
                    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
                    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
                    const firstAvg =
                      firstHalf.reduce((sum, s) => sum + (s.finalScore || 0), 0) /
                      firstHalf.length;
                    const secondAvg =
                      secondHalf.reduce((sum, s) => sum + (s.finalScore || 0), 0) /
                      secondHalf.length;
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
        <div className="space-y-8">
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
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={scoreTrendData}>
                  <defs>
                    <linearGradient id="colorFinal" x1="0" y1="0" x2="0" y2="1">
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
                    <linearGradient id="colorAuto" x1="0" y1="0" x2="0" y2="1">
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
                    <linearGradient id="colorTele" x1="0" y1="0" x2="0" y2="1">
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
                    dataKey="TeleOp"
                    stroke={COLORS.warning}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTele)"
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Score Component Breakdown */}
            <Card
              className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
            >
              <CardHeader>
                <CardTitle
                  className={`text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                    Average Score Breakdown
                </CardTitle>
                <CardDescription
                  className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  Average points per game phase
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={scoreBreakdownData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) =>
                        `${name}: ${value || 0}`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      animationDuration={1000}
                      animationBegin={200}
                    >
                      {scoreBreakdownData.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '14px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

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
                <ResponsiveContainer width="100%" height={300}>
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
                      opacity={0.6}
                      radius={[6, 6, 0, 0]}
                      animationDuration={1000}
                    />
                    <Line
                      type="monotone"
                      dataKey="Moving Avg"
                      stroke={COLORS.success}
                      strokeWidth={3}
                      dot={{ fill: COLORS.success, r: 5, strokeWidth: 2, stroke: '#fff' }}
                      animationDuration={1200}
                      animationBegin={300}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Consistency Over Time */}
            {consistencyOverTimeData.length > 0 && (
              <Card
                className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-gray-200'}`}
              >
                <CardHeader>
                  <CardTitle
                    className={`text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                      Consistency Over Time
                  </CardTitle>
                  <CardDescription
                    className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    Rolling 3-session consistency percentage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
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
                        dot={{ fill: COLORS.purple, r: 5, strokeWidth: 2, stroke: '#fff' }}
                        animationDuration={1200}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Cycle Time Analysis */}
          {cycleTimeData.length > 0 && (
            <Card
              className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
            >
              <CardHeader>
                <CardTitle
                  className={`text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                    Cycle Time Analysis
                </CardTitle>
                <CardDescription
                  className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  Average, fastest, and slowest cycle times (seconds)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
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
                      label={{ value: 'Seconds', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '14px' }} />
                    <Line
                      type="monotone"
                      dataKey="Avg Cycle"
                      stroke={COLORS.primary}
                      strokeWidth={3}
                      dot={{ fill: COLORS.primary, r: 6, strokeWidth: 2, stroke: '#fff' }}
                      animationDuration={1200}
                    />
                    <Line
                      type="monotone"
                      dataKey="Fastest"
                      stroke={COLORS.success}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: COLORS.success, r: 5, strokeWidth: 2, stroke: '#fff' }}
                      animationDuration={1200}
                      animationBegin={200}
                    />
                    <Line
                      type="monotone"
                      dataKey="Slowest"
                      stroke={COLORS.danger}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: COLORS.danger, r: 5, strokeWidth: 2, stroke: '#fff' }}
                      animationDuration={1200}
                      animationBegin={400}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Charts;
