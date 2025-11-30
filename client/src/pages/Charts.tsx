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
} from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ArrowLeft, TrendingUp, Calendar } from 'lucide-react';
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Area,
  AreaChart,
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

  // Match Type Distribution
  const getMatchTypeData = (): ChartDataPoint[] => {
    const filteredSessions = getFilteredSessions();
    const distribution: Record<string, number> = {};

    filteredSessions.forEach(session => {
      const type = session.matchType || 'Practice';
      distribution[type] = (distribution[type] || 0) + 1;
    });

    return Object.entries(distribution).map(([name, value]) => ({
      name,
      value,
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

  // Performance Radar
  const getPerformanceRadarData = (): ChartDataPoint[] => {
    const filteredSessions = getFilteredSessions();
    if (filteredSessions.length === 0) return [];

    const avgScores = {
      autonomous: 0,
      teleOp: 0,
      endGame: 0,
      consistency: 0,
      total: 0,
    };

    filteredSessions.forEach(session => {
      avgScores.autonomous += session.autonomousScore || 0;
      avgScores.teleOp += session.teleOpScore || 0;
      avgScores.endGame += session.endGameScore || 0;
      avgScores.total += session.finalScore || 0;
    });

    const count = filteredSessions.length;
    avgScores.autonomous = Math.round(avgScores.autonomous / count);
    avgScores.teleOp = Math.round(avgScores.teleOp / count);
    avgScores.endGame = Math.round(avgScores.endGame / count);
    avgScores.total = Math.round(avgScores.total / count);

    // Calculate consistency (inverse of standard deviation)
    const scores = filteredSessions.map(s => s.finalScore || 0);
    const mean = avgScores.total;
    const variance =
      scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    avgScores.consistency = Math.max(0, 100 - stdDev * 2); // Scale to 0-100

    return [
      { category: 'Autonomous', value: avgScores.autonomous, fullMark: 50 },
      { category: 'TeleOp', value: avgScores.teleOp, fullMark: 80 },
      { category: 'End Game', value: avgScores.endGame, fullMark: 30 },
      { category: 'Consistency', value: avgScores.consistency, fullMark: 100 },
      { category: 'Total Avg', value: avgScores.total, fullMark: 150 },
    ];
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
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div
          className={`p-3 rounded-lg border ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-gray-200'} shadow-lg`}
        >
          <p
            className={`font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          >
            {label}
          </p>
          {payload.map((entry, index: number) => (
            <p
              key={index}
              className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
              style={{ color: entry.color }}
            >
              {entry.name}: {entry.value}
            </p>
          ))}
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
  const matchTypeData = getMatchTypeData();
  const scoreBreakdownData = getScoreBreakdownData();
  const performanceRadarData = getPerformanceRadarData();

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
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-1.5 bg-team-blue rounded-full"></div>
                <h1 className="text-team-blue text-3xl lg:text-5xl font-bold">
                  Performance Charts
                </h1>
              </div>
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

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card
            className={`transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
          >
            <CardContent className="pt-6">
              <div className="text-team-blue text-4xl font-bold mb-2">
                {getFilteredSessions().length}
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
              <div className="text-team-blue text-4xl font-bold mb-2">
                {getFilteredSessions().length > 0
                  ? Math.round(
                      getFilteredSessions().reduce(
                        (sum, s) => sum + (s.finalScore || 0),
                        0
                      ) / getFilteredSessions().length
                    )
                  : 0}
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
              <div className="text-team-blue text-4xl font-bold mb-2">
                {getFilteredSessions().length > 0
                  ? Math.max(
                      ...getFilteredSessions().map(s => s.finalScore || 0)
                    )
                  : 0}
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
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="text-green-500 w-7 h-7" />
                <div className="text-team-blue text-4xl font-bold">
                  {getFilteredSessions().length >= 2
                    ? (() => {
                        const sorted = [...getFilteredSessions()].sort(
                          (a, b) => {
                            const dateA =
                              typeof a.createdAt === 'string'
                                ? new Date(a.createdAt)
                                : new Date(
                                    (a.createdAt as { seconds: number })
                                      .seconds * 1000
                                  );
                            const dateB =
                              typeof b.createdAt === 'string'
                                ? new Date(b.createdAt)
                                : new Date(
                                    (b.createdAt as { seconds: number })
                                      .seconds * 1000
                                  );
                            return dateA.getTime() - dateB.getTime();
                          }
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
                            (sum, s) => sum + (s.finalScore || 0),
                            0
                          ) / firstHalf.length;
                        const secondAvg =
                          secondHalf.reduce(
                            (sum, s) => sum + (s.finalScore || 0),
                            0
                          ) / secondHalf.length;
                        const improvement = secondAvg - firstAvg;
                        return improvement > 0
                          ? `+${Math.round(improvement)}`
                          : Math.round(improvement);
                      })()
                    : '—'}
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
                <div className="h-6 w-1 bg-team-blue rounded-full"></div>
                Score Trends Over Time
              </CardTitle>
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
                  />
                  <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="Final Score"
                    stroke={COLORS.primary}
                    fillOpacity={1}
                    fill="url(#colorFinal)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Autonomous"
                    stroke={COLORS.success}
                    fillOpacity={1}
                    fill="url(#colorAuto)"
                  />
                  <Area
                    type="monotone"
                    dataKey="TeleOp"
                    stroke={COLORS.warning}
                    fillOpacity={1}
                    fill="url(#colorTele)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Match Type Distribution */}
            <Card
              className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
            >
              <CardHeader>
                <CardTitle
                  className={`text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  <div className="h-6 w-1 bg-team-blue rounded-full"></div>
                  Match Type Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={matchTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {matchTypeData.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Score Component Breakdown */}
            <Card
              className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
            >
              <CardHeader>
                <CardTitle
                  className={`text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  <div className="h-6 w-1 bg-team-blue rounded-full"></div>
                  Average Score Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={scoreBreakdownData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'}
                    />
                    <XAxis
                      dataKey="name"
                      stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                    />
                    <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill={COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Performance Radar */}
            <Card
              className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-gradient-to-br from-team-dark via-team-dark to-team-dark-20 border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
            >
              <CardHeader>
                <CardTitle
                  className={`text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  <div className="h-6 w-1 bg-team-blue rounded-full"></div>
                  Performance Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={performanceRadarData}>
                    <PolarGrid stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'} />
                    <PolarAngleAxis
                      dataKey="category"
                      stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                    />
                    <PolarRadiusAxis
                      stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                    />
                    <Radar
                      name="Performance"
                      dataKey="value"
                      stroke={COLORS.primary}
                      fill={COLORS.secondary}
                      fillOpacity={0.6}
                    />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Charts;
