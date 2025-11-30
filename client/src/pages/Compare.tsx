import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowLeft,
  Trophy,
  Clock,
  Target,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

interface ComparisonMetric {
  label: string;
  session1Value: number | string;
  session2Value: number | string;
  difference: number | string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
}

const Compare = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSession1, setSelectedSession1] = useState<string>('');
  const [selectedSession2, setSelectedSession2] = useState<string>('');
  const [session1Data, setSession1Data] = useState<SessionData | null>(null);
  const [session2Data, setSession2Data] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user sessions
  useEffect(() => {
    const loadSessions = async () => {
      if (!user?.uid) return;

      try {
        const userSessions = await firebaseService.getUserSessions(user.uid);
        setSessions(userSessions);

        // Pre-select sessions from URL params if available
        const session1Id = searchParams.get('session1');
        const session2Id = searchParams.get('session2');

        if (session1Id) setSelectedSession1(session1Id);
        if (session2Id) setSelectedSession2(session2Id);
      } catch (error) {
        console.error('Error loading sessions:', error);
        toast.error('Failed to load sessions');
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [user?.uid, searchParams]);

  // Load session 1 data
  useEffect(() => {
    const loadSession1 = async () => {
      if (!selectedSession1) {
        setSession1Data(null);
        return;
      }

      try {
        const session = await firebaseService.getSession(selectedSession1);
        setSession1Data(session);
      } catch (error) {
        console.error('Error loading session 1:', error);
        toast.error('Failed to load first session');
      }
    };

    loadSession1();
  }, [selectedSession1]);

  // Load session 2 data
  useEffect(() => {
    const loadSession2 = async () => {
      if (!selectedSession2) {
        setSession2Data(null);
        return;
      }

      try {
        const session = await firebaseService.getSession(selectedSession2);
        setSession2Data(session);
      } catch (error) {
        console.error('Error loading session 2:', error);
        toast.error('Failed to load second session');
      }
    };

    loadSession2();
  }, [selectedSession2]);

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
      const ts = timestamp as { seconds: number; nanoseconds: number };
      date = new Date(ts.seconds * 1000);
    } else {
      return 'Unknown';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateDifference = (
    val1: number | undefined,
    val2: number | undefined
  ): { diff: number; trend: 'up' | 'down' | 'neutral' } => {
    const v1 = val1 || 0;
    const v2 = val2 || 0;
    const diff = v2 - v1;

    if (diff > 0) return { diff, trend: 'up' };
    if (diff < 0) return { diff, trend: 'down' };
    return { diff: 0, trend: 'neutral' };
  };

  const calculatePercentageChange = (
    val1: number | undefined,
    val2: number | undefined
  ): string => {
    const v1 = val1 || 0;
    const v2 = val2 || 0;

    if (v1 === 0) {
      if (v2 === 0) return '0%';
      return '+100%';
    }

    const change = ((v2 - v1) / v1) * 100;
    return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  const getAverageCycleTime = (cycleTimes?: number[]): string => {
    if (!cycleTimes || cycleTimes.length === 0) return 'N/A';

    const avg = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;
    const mins = Math.floor(avg / 60);
    const secs = Math.round(avg % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const metrics: ComparisonMetric[] = [
    {
      label: 'Final Score',
      session1Value: session1Data?.finalScore || 0,
      session2Value: session2Data?.finalScore || 0,
      difference: calculateDifference(
        session1Data?.finalScore,
        session2Data?.finalScore
      ).diff,
      trend: calculateDifference(
        session1Data?.finalScore,
        session2Data?.finalScore
      ).trend,
      icon: <Trophy className="w-5 h-5" />,
    },
    {
      label: 'Autonomous Score',
      session1Value: session1Data?.autonomousScore || 0,
      session2Value: session2Data?.autonomousScore || 0,
      difference: calculateDifference(
        session1Data?.autonomousScore,
        session2Data?.autonomousScore
      ).diff,
      trend: calculateDifference(
        session1Data?.autonomousScore,
        session2Data?.autonomousScore
      ).trend,
      icon: <Target className="w-5 h-5" />,
    },
    {
      label: 'TeleOp Score',
      session1Value: session1Data?.teleOpScore || 0,
      session2Value: session2Data?.teleOpScore || 0,
      difference: calculateDifference(
        session1Data?.teleOpScore,
        session2Data?.teleOpScore
      ).diff,
      trend: calculateDifference(
        session1Data?.teleOpScore,
        session2Data?.teleOpScore
      ).trend,
      icon: <Zap className="w-5 h-5" />,
    },
    {
      label: 'End Game Score',
      session1Value: session1Data?.endGameScore || 0,
      session2Value: session2Data?.endGameScore || 0,
      difference: calculateDifference(
        session1Data?.endGameScore,
        session2Data?.endGameScore
      ).diff,
      trend: calculateDifference(
        session1Data?.endGameScore,
        session2Data?.endGameScore
      ).trend,
      icon: <Clock className="w-5 h-5" />,
    },
  ];

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div className="text-team-blue text-2xl">Loading sessions...</div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
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
          <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold mb-2">
            Session Comparison
          </h1>
          <p
            className={`text-base ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            Compare two sessions side-by-side
          </p>
        </div>

        {/* Session Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Session 1 Selector */}
          <Card
            className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
          >
            <CardHeader>
              <CardTitle
                className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              >
                Session 1
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedSession1}
                onValueChange={setSelectedSession1}
              >
                <SelectTrigger
                  className={`w-full ${isDarkMode ? 'bg-team-dark border-team-blue-40 text-white' : 'bg-white border-gray-300'}`}
                >
                  <SelectValue placeholder="Select first session" />
                </SelectTrigger>
                <SelectContent
                  className={`${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white'}`}
                >
                  {sessions.map(session => (
                    <SelectItem
                      key={session.id}
                      value={session.id}
                      className={`${isDarkMode ? 'text-white focus:bg-team-blue-40' : ''}`}
                    >
                      {session.sessionName || 'Unnamed Session'} -{' '}
                      {formatDate(session.createdAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {session1Data && (
                <div className="mt-4 space-y-2 text-sm">
                  <div
                    className={`flex justify-between ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    <span>Driver:</span>
                    <span className="text-team-blue font-medium">
                      {session1Data.driverName || 'N/A'}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    <span>Match Type:</span>
                    <span className="text-team-blue font-medium">
                      {session1Data.matchType || 'N/A'}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    <span>Duration:</span>
                    <span className="text-team-blue font-medium">
                      {session1Data.sessionDuration || 'N/A'}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session 2 Selector */}
          <Card
            className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
          >
            <CardHeader>
              <CardTitle
                className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              >
                Session 2
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedSession2}
                onValueChange={setSelectedSession2}
              >
                <SelectTrigger
                  className={`w-full ${isDarkMode ? 'bg-team-dark border-team-blue-40 text-white' : 'bg-white border-gray-300'}`}
                >
                  <SelectValue placeholder="Select second session" />
                </SelectTrigger>
                <SelectContent
                  className={`${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white'}`}
                >
                  {sessions.map(session => (
                    <SelectItem
                      key={session.id}
                      value={session.id}
                      className={`${isDarkMode ? 'text-white focus:bg-team-blue-40' : ''}`}
                    >
                      {session.sessionName || 'Unnamed Session'} -{' '}
                      {formatDate(session.createdAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {session2Data && (
                <div className="mt-4 space-y-2 text-sm">
                  <div
                    className={`flex justify-between ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    <span>Driver:</span>
                    <span className="text-team-blue font-medium">
                      {session2Data.driverName || 'N/A'}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    <span>Match Type:</span>
                    <span className="text-team-blue font-medium">
                      {session2Data.matchType || 'N/A'}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    <span>Duration:</span>
                    <span className="text-team-blue font-medium">
                      {session2Data.sessionDuration || 'N/A'}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Comparison Results */}
        {session1Data && session2Data ? (
          <div className="space-y-6">
            {/* Score Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.map((metric, index) => (
                <Card
                  key={index}
                  className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-team-blue">{metric.icon}</div>
                      <div
                        className={`flex items-center gap-1 ${
                          metric.trend === 'up'
                            ? 'text-green-500'
                            : metric.trend === 'down'
                              ? 'text-red-500'
                              : 'text-gray-500'
                        }`}
                      >
                        {metric.trend === 'up' && (
                          <TrendingUp className="w-4 h-4" />
                        )}
                        {metric.trend === 'down' && (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {metric.trend === 'neutral' && (
                          <Minus className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium">
                          {Number(metric.difference) > 0 ? '+' : ''}
                          {metric.difference}
                        </span>
                      </div>
                    </div>
                    <h3
                      className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                    >
                      {metric.label}
                    </h3>
                    <div className="flex justify-between items-baseline">
                      <div>
                        <div
                          className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        >
                          {metric.session1Value}
                        </div>
                        <div className="text-xs text-gray-500">Session 1</div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        >
                          {metric.session2Value}
                        </div>
                        <div className="text-xs text-gray-500">Session 2</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Detailed Breakdown */}
            <Card
              className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
            >
              <CardHeader>
                <CardTitle
                  className={`text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  Detailed Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr
                        className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
                      >
                        <th
                          className={`text-left py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                        >
                          Metric
                        </th>
                        <th
                          className={`text-right py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                        >
                          Session 1
                        </th>
                        <th
                          className={`text-right py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                        >
                          Session 2
                        </th>
                        <th
                          className={`text-right py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                        >
                          Change
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                      >
                        <td
                          className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        >
                          Autonomous - Classified Artifact
                        </td>
                        <td
                          className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        >
                          {session1Data.autonClassifiedArtifact || 0}
                        </td>
                        <td
                          className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        >
                          {session2Data.autonClassifiedArtifact || 0}
                        </td>
                        <td
                          className={`text-right py-3 px-4 font-medium ${
                            calculateDifference(
                              session1Data.autonClassifiedArtifact,
                              session2Data.autonClassifiedArtifact
                            ).trend === 'up'
                              ? 'text-green-500'
                              : calculateDifference(
                                    session1Data.autonClassifiedArtifact,
                                    session2Data.autonClassifiedArtifact
                                  ).trend === 'down'
                                ? 'text-red-500'
                                : 'text-gray-500'
                          }`}
                        >
                          {calculatePercentageChange(
                            session1Data.autonClassifiedArtifact,
                            session2Data.autonClassifiedArtifact
                          )}
                        </td>
                      </tr>
                      <tr
                        className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                      >
                        <td
                          className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        >
                          TeleOp - Classified Artifact
                        </td>
                        <td
                          className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        >
                          {session1Data.teleClassifiedArtifact || 0}
                        </td>
                        <td
                          className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        >
                          {session2Data.teleClassifiedArtifact || 0}
                        </td>
                        <td
                          className={`text-right py-3 px-4 font-medium ${
                            calculateDifference(
                              session1Data.teleClassifiedArtifact,
                              session2Data.teleClassifiedArtifact
                            ).trend === 'up'
                              ? 'text-green-500'
                              : calculateDifference(
                                    session1Data.teleClassifiedArtifact,
                                    session2Data.teleClassifiedArtifact
                                  ).trend === 'down'
                                ? 'text-red-500'
                                : 'text-gray-500'
                          }`}
                        >
                          {calculatePercentageChange(
                            session1Data.teleClassifiedArtifact,
                            session2Data.teleClassifiedArtifact
                          )}
                        </td>
                      </tr>
                      <tr
                        className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                      >
                        <td
                          className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        >
                          Endgame Hang
                        </td>
                        <td
                          className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        >
                          {session1Data.endgameHang || 0}
                        </td>
                        <td
                          className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                        >
                          {session2Data.endgameHang || 0}
                        </td>
                        <td
                          className={`text-right py-3 px-4 font-medium ${
                            calculateDifference(
                              session1Data.endgameHang,
                              session2Data.endgameHang
                            ).trend === 'up'
                              ? 'text-green-500'
                              : calculateDifference(
                                    session1Data.endgameHang,
                                    session2Data.endgameHang
                                  ).trend === 'down'
                                ? 'text-red-500'
                                : 'text-gray-500'
                          }`}
                        >
                          {calculatePercentageChange(
                            session1Data.endgameHang,
                            session2Data.endgameHang
                          )}
                        </td>
                      </tr>
                      {session1Data.cycleTimes &&
                        session1Data.cycleTimes.length > 0 &&
                        session2Data.cycleTimes &&
                        session2Data.cycleTimes.length > 0 && (
                          <tr>
                            <td
                              className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              Average Cycle Time
                            </td>
                            <td
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {getAverageCycleTime(session1Data.cycleTimes)}
                            </td>
                            <td
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {getAverageCycleTime(session2Data.cycleTimes)}
                            </td>
                            <td
                              className={`text-right py-3 px-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                            >
                              —
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Summary Insights */}
            <Card
              className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
            >
              <CardHeader>
                <CardTitle
                  className={`text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.map((metric, index) => {
                    if (metric.trend === 'neutral') return null;
                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-lg ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}
                      >
                        <div
                          className={`${
                            metric.trend === 'up'
                              ? 'text-green-500'
                              : 'text-red-500'
                          }`}
                        >
                          {metric.trend === 'up' ? (
                            <TrendingUp className="w-5 h-5" />
                          ) : (
                            <TrendingDown className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1">
                          <span
                            className={`${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            {metric.label}{' '}
                            {metric.trend === 'up' ? 'improved' : 'decreased'}{' '}
                            by{' '}
                          </span>
                          <span
                            className={`font-bold ${
                              metric.trend === 'up'
                                ? 'text-green-500'
                                : 'text-red-500'
                            }`}
                          >
                            {Math.abs(Number(metric.difference))} points
                          </span>
                          <span
                            className={`${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            {' '}
                            (
                            {calculatePercentageChange(
                              Number(metric.session1Value),
                              Number(metric.session2Value)
                            )}
                            )
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card
            className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
          >
            <CardContent className="py-12">
              <div className="text-center">
                <div className="text-team-blue text-5xl mb-4">📊</div>
                <h3
                  className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  Select Two Sessions to Compare
                </h3>
                <p
                  className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  Choose sessions from the dropdowns above to see detailed
                  comparison
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Compare;
