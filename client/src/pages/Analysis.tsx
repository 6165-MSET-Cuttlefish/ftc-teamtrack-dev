import { useState, useEffect } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { useSession, useTheme, useAuth } from '@/contexts';
import { useFirebase } from '@/hooks';
import { firebaseService } from '@/services';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';

interface ChartDataPoint {
  name?: string;
  value?: number;
  category?: string;
  fullMark?: number;
  [key: string]: string | number | undefined;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  isDarkMode,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  isDarkMode?: boolean;
}) => {
  if (active && payload && payload.length) {
    return (
      <div
        className={`p-3 rounded-lg border ${isDarkMode ? 'bg-team-dark/95 border-team-blue-40 backdrop-blur-sm' : 'bg-white/95 border-gray-200 backdrop-blur-sm'} shadow-xl`}
      >
        {label && (
          <p
            className={`font-bold mb-2 pb-2 border-b text-sm ${isDarkMode ? 'text-white border-team-blue-40' : 'text-gray-900 border-gray-200'}`}
          >
            {label}
          </p>
        )}
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span
                  className={`text-xs font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  {entry.name}:
                </span>
              </div>
              <span
                className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                style={{ color: entry.color }}
              >
                {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const DataCard = ({ value, label }: { value: string; label: string }) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`flex flex-col items-center gap-4 px-9 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}
    >
      <div className="text-team-blue text-3xl font-medium leading-6">
        {value}
      </div>
      <div
        className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-base leading-6`}
      >
        {label}
      </div>
    </div>
  );
};

const SensorOverviewCard = ({
  sessionName,
  driverName,
  matchType,
  sessionDuration,
  finalScore,
  totalTime,
}: {
  sessionName: string;
  driverName: string;
  matchType: string;
  sessionDuration: string;
  finalScore: number;
  totalTime: string;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'} space-y-4`}
    >
      <h3
        className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
      >
        Session Overview
      </h3>
      <div className="grid grid-cols-2 gap-6">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2.5">
            <div
              className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs leading-6`}
            >
              Session Name
            </div>
            <div
              className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs leading-6`}
            >
              Driver
            </div>
            <div
              className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs leading-6`}
            >
              Match Type
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="text-team-blue text-xs leading-6">
              {sessionName || 'N/A'}
            </div>
            <div className="text-team-blue text-xs leading-6">
              {driverName || 'N/A'}
            </div>
            <div className="text-team-blue text-xs leading-6">
              {matchType || 'N/A'}
            </div>
          </div>
        </div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2.5">
            <div
              className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs leading-6`}
            >
              Duration
            </div>
            <div
              className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs leading-6`}
            >
              Final Score
            </div>
            <div
              className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs leading-6`}
            >
              Total Finished Time
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="text-team-blue text-xs leading-6">
              {sessionDuration || 'N/A'}
            </div>
            <div className="text-team-blue text-xs leading-6">{finalScore}</div>
            <div className="text-team-blue text-xs leading-6">{totalTime}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CycleTimesCard = ({ cycleTimes }: { cycleTimes?: number[] }) => {
  const { isDarkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!cycleTimes || cycleTimes.length === 0) return null;

  const calculateAverageCycleTime = (): string => {
    const avg = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;
    const mins = Math.floor(avg / 60);
    const secs = Math.round(avg % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`w-full px-6 py-6 rounded-lg border cursor-pointer transition-all ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20 hover:bg-team-dark-40' : 'border-team-blue-40 bg-white hover:bg-gray-50'}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            <h4
              className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
            >
              Cycle Times
            </h4>
            <p
              className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
            >
              {cycleTimes.length} cycles • Avg: {calculateAverageCycleTime()}
            </p>
          </div>
        </div>
        <ChevronRight
          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''} ${isDarkMode ? 'text-white' : 'text-black'}`}
        />
      </div>

      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-team-blue-40 space-y-3">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {cycleTimes.map((time, index) => {
              const mins = Math.floor(time / 60);
              const secs = time % 60;
              return (
                <div
                  key={index}
                  className={`px-3 py-2 rounded text-sm ${isDarkMode ? 'bg-team-dark text-white border border-team-blue-40' : 'bg-[#FEFEFE] text-black border border-team-blue-40'}`}
                >
                  <div
                    className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs`}
                  >
                    Cycle {index + 1}
                  </div>
                  <div className="text-base font-medium">
                    {mins}:{secs.toString().padStart(2, '0')}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className={`mt-4 px-4 py-3 rounded text-center ${isDarkMode ? 'bg-team-blue-40/20 text-white border border-team-blue-40' : 'bg-team-blue-40/10 text-black border border-team-blue-40'}`}
          >
            <div
              className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs`}
            >
              Average Cycle Time
            </div>
            <div className="text-xl font-semibold mt-1">
              {calculateAverageCycleTime()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PerformanceInsightCard = ({
  metric,
  value,
  isPositive,
}: {
  metric: string;
  value: string;
  isPositive: boolean;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`flex items-center justify-between px-6 py-4 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}
    >
      <div className="flex items-center gap-4">
        <span
          className={`text-base font-medium ${isDarkMode ? 'text-white' : 'text-black'}`}
        >
          {metric || 'Metric Name'}
        </span>
        <span className="text-team-blue text-base font-medium">
          {value || 'Value'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`p-2 rounded ${isDarkMode ? 'text-white' : 'text-black'}`}
        >
          <BarChart3 className="w-5 h-5" />
        </div>
        <div
          className={`p-2 rounded ${
            isPositive ? 'text-green-500' : 'text-red-500'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-5 h-5" />
          ) : (
            <TrendingDown className="w-5 h-5" />
          )}
        </div>
      </div>
    </div>
  );
};

const ScoreBreakdownCard = ({
  matchType,
  autonomousScore,
  teleOpScore,
  endGameScore,
  autonClassifiedArtifact,
  autonOverflowArtifact,
  autonMotif,
  autonLeave,
  teleClassifiedArtifact,
  teleOverflowArtifact,
  teleMotif,
  endgameHang,
}: {
  matchType?: string;
  autonomousScore?: number;
  teleOpScore?: number;
  endGameScore?: number;
  autonClassifiedArtifact?: number;
  autonOverflowArtifact?: number;
  autonMotif?: number;
  autonLeave?: number;
  teleClassifiedArtifact?: number;
  teleOverflowArtifact?: number;
  teleMotif?: number;
  endgameHang?: number;
}) => {
  const { isDarkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const isTeleOnlyMatch = matchType?.toLowerCase().includes('tele');

  const scoreBreakdown = isTeleOnlyMatch
    ? [
        { label: 'TeleOp', score: teleOpScore || 0 },
        { label: 'Endgame', score: endGameScore || 0 },
      ]
    : [
        { label: 'Autonomous', score: autonomousScore || 0 },
        { label: 'TeleOp', score: teleOpScore || 0 },
        { label: 'Endgame', score: endGameScore || 0 },
      ];

  const totalBreakdownScore = scoreBreakdown.reduce(
    (sum, item) => sum + item.score,
    0
  );

  const DetailRow = ({
    label,
    value,
  }: {
    label: string;
    value: number | undefined;
  }) => (
    <div className="flex items-center justify-between py-2 px-3 rounded">
      <span
        className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
      >
        {label}
      </span>
      <span className="text-base font-semibold text-team-blue">
        {value || 0}
      </span>
    </div>
  );

  return (
    <div
      className={`w-full px-6 py-6 rounded-lg border cursor-pointer transition-all ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20 hover:bg-team-dark-40' : 'border-team-blue-40 bg-white hover:bg-gray-50'}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            <h4
              className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
            >
              Score Breakdown
            </h4>
            <p
              className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}
            >
              {scoreBreakdown.length} phases • Total: {totalBreakdownScore}
            </p>
          </div>
        </div>
        <ChevronRight
          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''} ${isDarkMode ? 'text-white' : 'text-black'}`}
        />
      </div>

      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-team-blue-40 space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {scoreBreakdown.map((item, index) => (
              <div
                key={index}
                className={`px-4 py-3 rounded ${isDarkMode ? 'bg-team-dark text-white border border-team-blue-40' : 'bg-[#FEFEFE] text-black border border-team-blue-40'}`}
              >
                <div
                  className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs mb-1`}
                >
                  {item.label}
                </div>
                <div className="text-2xl font-semibold text-team-blue">
                  {item.score}
                </div>
              </div>
            ))}
          </div>

          {!isTeleOnlyMatch && (
            <div
              className={`p-4 rounded border ${isDarkMode ? 'border-team-blue-40 bg-team-dark' : 'border-team-blue-40 bg-[#FEFEFE]'}`}
            >
              <h5
                className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}
              >
                Autonomous
              </h5>
              <DetailRow
                label="Classified Artifacts"
                value={autonClassifiedArtifact}
              />
              <DetailRow
                label="Overflow Artifacts"
                value={autonOverflowArtifact}
              />
              <DetailRow label="Motifs" value={autonMotif} />
              <DetailRow label="Leave Bonus" value={autonLeave} />
            </div>
          )}

          <div
            className={`p-4 rounded border ${isDarkMode ? 'border-team-blue-40 bg-team-dark' : 'border-team-blue-40 bg-[#FEFEFE]'}`}
          >
            <h5
              className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}
            >
              Tele-Op
            </h5>
            <DetailRow
              label="Classified Artifacts"
              value={teleClassifiedArtifact}
            />
            <DetailRow
              label="Overflow Artifacts"
              value={teleOverflowArtifact}
            />
            <DetailRow label="Motifs" value={teleMotif} />
          </div>

          <div
            className={`p-4 rounded border ${isDarkMode ? 'border-team-blue-40 bg-team-dark' : 'border-team-blue-40 bg-[#FEFEFE]'}`}
          >
            <h5
              className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}
            >
              Endgame
            </h5>
            <DetailRow label="Hang" value={endgameHang} />
          </div>

          <div
            className={`mt-4 px-4 py-3 rounded text-center ${isDarkMode ? 'bg-team-blue-40/20 text-white border border-team-blue-40' : 'bg-team-blue-40/10 text-black border border-team-blue-40'}`}
          >
            <div
              className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs mb-1`}
            >
              Score Breakdown Total
            </div>
            <div className="text-2xl font-semibold text-team-blue">
              {totalBreakdownScore}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PerformanceGraphs = ({
  currentSession,
  historicalSessions,
}: {
  currentSession: Record<string, unknown>;
  historicalSessions: SessionData[];
}) => {
  const { isDarkMode } = useTheme();

  const COLORS = {
    primary: '#537788',
    secondary: '#B0E5FE',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
  };

  // Score comparison data (current vs average)
  const getScoreComparisonData = (): ChartDataPoint[] => {
    if (historicalSessions.length === 0) return [];

    const avgFinal =
      historicalSessions.reduce((sum, s) => sum + (s.finalScore || 0), 0) /
      historicalSessions.length;
    const avgAuto =
      historicalSessions.reduce((sum, s) => sum + (s.autonomousScore || 0), 0) /
      historicalSessions.length;
    const avgTele =
      historicalSessions.reduce((sum, s) => sum + (s.teleOpScore || 0), 0) /
      historicalSessions.length;
    const avgEndgame =
      historicalSessions.reduce((sum, s) => sum + (s.endGameScore || 0), 0) /
      historicalSessions.length;

    return [
      {
        name: 'Autonomous',
        'This Session': (currentSession.autonomousScore as number) || 0,
        'Your Average': Math.round(avgAuto),
      },
      {
        name: 'TeleOp',
        'This Session': (currentSession.teleOpScore as number) || 0,
        'Your Average': Math.round(avgTele),
      },
      {
        name: 'End Game',
        'This Session': (currentSession.endGameScore as number) || 0,
        'Your Average': Math.round(avgEndgame),
      },
      {
        name: 'Final',
        'This Session': (currentSession.finalScore as number) || 0,
        'Your Average': Math.round(avgFinal),
      },
    ];
  };

  // Phase breakdown pie chart
  const getPhaseBreakdownData = (): ChartDataPoint[] => {
    const auto = (currentSession.autonomousScore as number) || 0;
    const tele = (currentSession.teleOpScore as number) || 0;
    const endgame = (currentSession.endGameScore as number) || 0;

    return [
      { name: 'Autonomous', value: auto },
      { name: 'TeleOp', value: tele },
      { name: 'End Game', value: endgame },
    ];
  };

  // Performance trend (current vs last 5 sessions)
  const getPerformanceTrendData = (): ChartDataPoint[] => {
    const recent = historicalSessions.slice(0, 5).reverse();
    return [
      ...recent.map((session, idx) => ({
        name: `Session ${5 - idx}`,
        Score: session.finalScore || 0,
      })),
      {
        name: 'Current',
        Score: (currentSession.finalScore as number) || 0,
      },
    ];
  };

  // Radar chart data for consistency analysis
  const getConsistencyRadarData = (): ChartDataPoint[] => {
    if (historicalSessions.length === 0) return [];

    const avgAuto =
      historicalSessions.reduce((sum, s) => sum + (s.autonomousScore || 0), 0) /
      historicalSessions.length;
    const avgTele =
      historicalSessions.reduce((sum, s) => sum + (s.teleOpScore || 0), 0) /
      historicalSessions.length;
    const avgEndgame =
      historicalSessions.reduce((sum, s) => sum + (s.endGameScore || 0), 0) /
      historicalSessions.length;

    // Calculate standard deviation for consistency
    const scores = historicalSessions.map(s => s.finalScore || 0);
    const avgScore =
      historicalSessions.reduce((sum, s) => sum + (s.finalScore || 0), 0) /
      historicalSessions.length;
    const variance =
      scores.reduce((acc, score) => acc + Math.pow(score - avgScore, 2), 0) /
      scores.length;
    const stdDev = Math.sqrt(variance);
    const consistency = Math.max(0, 100 - stdDev * 2);

    return [
      { category: 'Autonomous', value: avgAuto, fullMark: 50 },
      { category: 'TeleOp', value: avgTele, fullMark: 80 },
      { category: 'End Game', value: avgEndgame, fullMark: 30 },
      { category: 'Consistency', value: consistency, fullMark: 100 },
    ];
  };

  const scoreComparisonData = getScoreComparisonData();
  const phaseBreakdownData = getPhaseBreakdownData();
  const performanceTrendData = getPerformanceTrendData();
  const consistencyRadarData = getConsistencyRadarData();

  return (
    <div className="space-y-8">
      {/* Score Comparison */}
      {scoreComparisonData.length > 0 && (
        <div
          className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}
        >
          <h3
            className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
          >
            Score Comparison
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scoreComparisonData}>
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
                content={
                  <CustomTooltip isDarkMode={isDarkMode} />
                }
              />
              <Legend wrapperStyle={{ fontSize: '14px' }} />
              <Bar
                dataKey="This Session"
                fill={COLORS.primary}
                radius={[8, 8, 0, 0]}
                animationDuration={800}
              />
              <Bar
                dataKey="Your Average"
                fill={COLORS.secondary}
                radius={[8, 8, 0, 0]}
                animationDuration={1000}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Phase Breakdown & Performance Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Phase Breakdown Pie */}
        {phaseBreakdownData.length > 0 && (
          <div
            className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}
          >
            <h3
              className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
            >
              Phase Breakdown
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={phaseBreakdownData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  animationDuration={800}
                >
                  {phaseBreakdownData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        [COLORS.primary, COLORS.success, COLORS.warning][index]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Performance Trend */}
        {performanceTrendData.length > 0 && (
          <div
            className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}
          >
            <h3
              className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
            >
              Recent Performance
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={performanceTrendData}>
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
                  content={<CustomTooltip isDarkMode={isDarkMode} />}
                />
                <Line
                  type="monotone"
                  dataKey="Score"
                  stroke={COLORS.primary}
                  strokeWidth={3}
                  dot={{ fill: COLORS.primary, r: 5 }}
                  animationDuration={800}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Consistency Radar */}
      {consistencyRadarData.length > 0 && (
        <div
          className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}
        >
          <h3
            className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
          >
            Performance Analysis
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={consistencyRadarData}>
              <PolarGrid stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'} />
              <PolarAngleAxis
                dataKey="category"
                stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                tick={{ fontSize: 12 }}
              />
              <PolarRadiusAxis
                stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                tick={{ fontSize: 11 }}
              />
              <Radar
                name="Average Performance"
                dataKey="value"
                stroke={COLORS.primary}
                strokeWidth={2}
                fill={COLORS.secondary}
                fillOpacity={0.6}
                animationDuration={1000}
              />
              <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
              <Legend wrapperStyle={{ fontSize: '14px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const AnalysisContent = () => {
  const { sessionData, updateSessionData } = useSession();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { getUserSessions } = useFirebase();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [historicalSessions, setHistoricalSessions] = useState<SessionData[]>([]);
  const [_graphModal, _setGraphModal] = useState<{
    isOpen: boolean;
    metric: string;
  }>({
    isOpen: false,
    metric: '',
  });

  // Calculated metrics
  const [consistency, setConsistency] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(0);

  // Performance insights state
  const [insights, setInsights] = useState<
    {
      id: number;
      metric: string;
      value: string;
      isPositive: boolean;
    }[]
  >([]);

  // Load session data from Firebase or location state
  useEffect(() => {
    const loadSessionData = async () => {
      setLoading(true);

      // First check if session data was passed through state (for temporary sessions)
      const stateData = location.state as {
        sessionData?: Record<string, unknown>;
        isTemporary?: boolean;
      } | null;
      if (stateData?.sessionData) {
        updateSessionData(stateData.sessionData);
        setLoading(false);
        return;
      }

      // Otherwise, try to load by sessionId from query params
      const sessionId = searchParams.get('sessionId');
      if (sessionId) {
        try {
          const session = await firebaseService.getSession(sessionId);
          if (session) {
            // Update the session context with loaded data
            updateSessionData({
              sessionName: session.sessionName || '',
              driverName: session.driverName || '',
              sessionDuration: session.sessionDuration || '',
              matchType: session.matchType || '',
              finalScore: session.finalScore || 0,
              autonomousScore: session.autonomousScore || 0,
              teleOpScore: session.teleOpScore || 0,
              endGameScore: session.endGameScore || 0,
              isSessionCompleted: true,
              autonomousBasket: session.autonClassifiedArtifact || 0,
              autonomousSpecimen: session.autonOverflowArtifact || 0,
              autonomousFloorMark: session.autonMotif || 0,
              autonomousLeave: session.autonLeave || 0,
              teleOpSamples: session.teleClassifiedArtifact || 0,
              teleOpSpecimen: session.teleOverflowArtifact || 0,
              teleOpFloorMark: session.teleMotif || 0,
              endGameValue: session.endgameHang || 0,
              selectedFeature: session.selectedFeature || '',
              cycleTimes: session.cycleTimes || [],
            });
          }
        } catch (error) {
          console.error('Error loading session:', error);
        }
      }

      // Load historical sessions for comparison
      if (user?.uid) {
        try {
          const sessions = await firebaseService.getUserSessions(user.uid);
          setHistoricalSessions(sessions);
        } catch (error) {
          console.error('Error loading historical sessions:', error);
        }
      }

      setLoading(false);
    };

    loadSessionData();
  }, [searchParams, location.state, updateSessionData, user?.uid]);

  // Calculate metrics based on historical data
  useEffect(() => {
    let mounted = true;
    const fetchComparisons = async () => {
      if (!user?.uid) {
        // no user - can't compare
        setInsights([
          { id: 1, metric: 'Consistency', value: 'N/A', isPositive: false },
          { id: 2, metric: 'Autonomous', value: 'N/A', isPositive: false },
          { id: 3, metric: 'TeleOp', value: 'N/A', isPositive: false },
        ]);
        setConsistency(0);
        setAccuracy(0);
        return;
      }

      const result = await getUserSessions(user.uid);
      if (!mounted) return;

      if (!result || result.length === 0) {
        setInsights([
          { id: 1, metric: 'Consistency', value: 'N/A', isPositive: false },
          { id: 2, metric: 'Autonomous', value: 'N/A', isPositive: false },
          { id: 3, metric: 'TeleOp', value: 'N/A', isPositive: false },
        ]);
        setConsistency(0);
        setAccuracy(0);
        return;
      }

      // Use last 3 previous sessions (excluding current if it matches by finalScore and duration)
      // Filter out the current session when possible (match by finalScore and sessionDuration)
      const filtered = result.filter(
        s =>
          !(
            s.finalScore === sessionData.finalScore &&
            s.sessionDuration === sessionData.sessionDuration
          )
      );
      const prevSessions = filtered.slice(0, 3);

      if (prevSessions.length === 0) {
        setInsights([
          { id: 1, metric: 'Consistency', value: 'N/A', isPositive: false },
          { id: 2, metric: 'Autonomous', value: 'N/A', isPositive: false },
          { id: 3, metric: 'TeleOp', value: 'N/A', isPositive: false },
        ]);
        setConsistency(0);
        setAccuracy(0);
        return;
      }

      const avgFinal =
        prevSessions.reduce((s, p) => s + (p.finalScore || 0), 0) /
        prevSessions.length;
      const avgAuton =
        prevSessions.reduce((s, p) => s + (p.autonomousScore || 0), 0) /
        prevSessions.length;
      const avgTele =
        prevSessions.reduce((s, p) => s + (p.teleOpScore || 0), 0) /
        prevSessions.length;

      // Calculate consistency: standard deviation of scores
      const scoreVariance =
        prevSessions.reduce((sum, session) => {
          const diff = (session.finalScore || 0) - avgFinal;
          return sum + diff * diff;
        }, 0) / prevSessions.length;
      const stdDev = Math.sqrt(scoreVariance);
      // Convert to percentage: lower std dev = higher consistency
      const consistencyPercent =
        avgFinal > 0
          ? Math.max(0, Math.min(100, 100 - (stdDev / avgFinal) * 100))
          : 0;
      setConsistency(Math.round(consistencyPercent));

      // Calculate accuracy: percentage of theoretical max score achieved
      // Assuming max score is around 150 for FTC (adjust if needed)
      const maxPossibleScore = 150;
      const accuracyPercent = (sessionData.finalScore / maxPossibleScore) * 100;
      setAccuracy(Math.round(Math.min(100, accuracyPercent)));

      const formatChange = (current: number, average: number) => {
        if (average === 0) return 'N/A';
        const perc = ((current - average) / average) * 100;
        const sign = perc >= 0 ? '+' : '';
        return `${sign}${Math.round(perc)}%`;
      };

      const consistencyChange = formatChange(sessionData.finalScore, avgFinal);
      const autonChange = formatChange(sessionData.autonomousScore, avgAuton);
      const teleChange = formatChange(sessionData.teleOpScore, avgTele);

      setInsights([
        {
          id: 1,
          metric: 'Consistency',
          value: consistencyChange,
          isPositive: sessionData.finalScore >= avgFinal,
        },
        {
          id: 2,
          metric: 'Autonomous',
          value: autonChange,
          isPositive: sessionData.autonomousScore >= avgAuton,
        },
        {
          id: 3,
          metric: 'TeleOp',
          value: teleChange,
          isPositive: sessionData.teleOpScore >= avgTele,
        },
      ]);
    };

    fetchComparisons();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.uid,
    sessionData.finalScore,
    sessionData.autonomousScore,
    sessionData.teleOpScore,
  ]);

  // Show loading state
  if (loading) {
    return (
      <div
        className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'} flex items-center justify-center`}
      >
        <div className="text-team-blue text-2xl">Loading session...</div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[800px] mx-auto px-4 sm:px-8 py-8 lg:py-16">
        <div className="space-y-12">
          {/* Header */}
          <div className="text-center space-y-6">
            <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold leading-[48px]">
              {sessionData.sessionName || 'Session'} Analysis
            </h1>
            <p
              className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}
            >
              Detailed performance analysis
            </p>
          </div>

          {/* Data Cards */}
          <div className="flex flex-col sm:flex-row gap-6 lg:gap-9 justify-center">
            <DataCard
              value={sessionData.finalScore.toString()}
              label="Final Score"
            />
            <DataCard value={`${consistency}%`} label="Consistency" />
            <DataCard value={`${accuracy}%`} label="Accuracy" />
          </div>

          {/* Sensor Overview */}
          <SensorOverviewCard
            sessionName={sessionData.sessionName}
            driverName={sessionData.driverName}
            matchType={sessionData.matchType}
            sessionDuration={sessionData.sessionDuration}
            finalScore={sessionData.finalScore}
            totalTime={sessionData.sessionDuration}
          />

          {/* Performance Insights */}
          <div className="space-y-6">
            <h2 className="text-team-blue text-2xl font-semibold leading-6">
              Performance Insights
            </h2>
            <div className="space-y-4">
              {insights.map(insight => (
                <PerformanceInsightCard
                  key={insight.id}
                  metric={insight.metric}
                  value={insight.value}
                  isPositive={insight.isPositive}
                />
              ))}
              <ScoreBreakdownCard
                matchType={sessionData.matchType}
                autonomousScore={sessionData.autonomousScore}
                teleOpScore={sessionData.teleOpScore}
                endGameScore={sessionData.endGameScore}
                autonClassifiedArtifact={sessionData.autonClassifiedArtifact}
                autonOverflowArtifact={sessionData.autonOverflowArtifact}
                autonMotif={sessionData.autonMotif}
                autonLeave={sessionData.autonLeave}
                teleClassifiedArtifact={sessionData.teleClassifiedArtifact}
                teleOverflowArtifact={sessionData.teleOverflowArtifact}
                teleMotif={sessionData.teleMotif}
                endgameHang={sessionData.endgameHang}
              />
              {sessionData.selectedFeature === 'Cycle Times' && (
                <CycleTimesCard cycleTimes={sessionData.cycleTimes} />
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/original"
              className="w-full sm:w-60 px-2.5 py-2.5 rounded-2xl border border-team-blue text-team-blue text-base leading-6 font-normal text-center hover:bg-team-blue hover:text-team-dark transition-colors"
            >
              Back to Session
            </Link>
            <Link
              to="/charts"
              className="w-full sm:w-60 px-2.5 py-2.5 rounded-2xl border border-team-blue bg-team-blue text-team-dark text-base leading-6 font-normal text-center hover:bg-team-blue/90 transition-colors"
            >
              View Charts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisContent;
