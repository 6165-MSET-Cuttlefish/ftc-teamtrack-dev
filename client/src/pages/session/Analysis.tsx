import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import { useSession, useTheme, useAuth } from '@/contexts';
import { firebaseService } from '@/services';
import { GAME_TIMING } from '@/constants';
import type { Match } from '@/types';
import {
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface MatchStats {
  avgScore: number;
  maxScore: number;
  minScore: number;
  consistency: number;
  accuracy: number;
  avgAuto: number;
  avgTele: number;
  avgEndgame: number;
  totalMatches: number;
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
            <div
              key={index}
              className="flex items-center justify-between gap-3"
            >
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

const MatchAnalysis = ({
  match,
  matchIndex,
  allMatches,
  isDarkMode,
}: {
  match: Match;
  matchIndex: number;
  allMatches: Match[];
  isDarkMode: boolean;
}) => {
  const COLORS = {
    primary: '#537788',
    secondary: '#B0E5FE',
    success: '#10b981',
    warning: '#f59e0b',
  };

  // Compare this match to average of others
  const otherMatches = allMatches.filter((_, idx) => idx !== matchIndex);
  const avgAuto = otherMatches.length > 0 ? otherMatches.reduce((sum, m) => sum + (m.autonomousScore || 0), 0) / otherMatches.length : 0;
  const avgTele = otherMatches.length > 0 ? otherMatches.reduce((sum, m) => sum + (m.teleOpScore || 0), 0) / otherMatches.length : 0;
  const avgEndgame = otherMatches.length > 0 ? otherMatches.reduce((sum, m) => sum + (m.endGameScore || 0), 0) / otherMatches.length : 0;

  const comparisonData = [
    { name: 'Autonomous', 'This Match': match.autonomousScore || 0, 'Session Avg': Math.round(avgAuto) },
    { name: 'TeleOp', 'This Match': match.teleOpScore || 0, 'Session Avg': Math.round(avgTele) },
    { name: 'End Game', 'This Match': match.endGameScore || 0, 'Session Avg': Math.round(avgEndgame) },
  ];

  const phaseData = [
    { name: 'Autonomous', value: match.autonomousScore || 0 },
    { name: 'TeleOp', value: match.teleOpScore || 0 },
    { name: 'End Game', value: match.endGameScore || 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-team-blue text-2xl font-semibold mb-2">Match {matchIndex + 1} Analysis</h2>
        <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
          Type: {match.matchType || 'N/A'} • Score: {match.finalScore || 0}
        </p>
      </div>

      {/* Score Comparison */}
      {otherMatches.length > 0 && (
        <div className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            Comparison vs Session Average
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'} />
              <XAxis dataKey="name" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} tick={{ fontSize: 12 }} />
              <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
              <Legend wrapperStyle={{ fontSize: '14px' }} />
              <Bar dataKey="This Match" fill={COLORS.primary} radius={[8, 8, 0, 0]} />
              <Bar dataKey="Session Avg" fill={COLORS.secondary} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Phase Breakdown */}
      {phaseData.some(d => d.value > 0) && (
        <div className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            Score Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={phaseData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                animationDuration={800}
              >
                {phaseData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={[COLORS.primary, COLORS.success, COLORS.warning][index]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const MatchComparison = ({
  matches,
  isDarkMode,
}: {
  matches: Match[];
  isDarkMode: boolean;
}) => {
  const COLORS = {
    primary: '#537788',
    secondary: '#B0E5FE',
    success: '#10b981',
    warning: '#f59e0b',
  };

  const comparisonData = matches.map((match, idx) => ({
    name: `Match ${idx + 1}`,
    'Final Score': match.finalScore || 0,
    Autonomous: match.autonomousScore || 0,
    TeleOp: match.teleOpScore || 0,
    'End Game': match.endGameScore || 0,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-team-blue text-2xl font-semibold">Compare All Matches</h2>

      {/* Trend Chart */}
      <div className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-black'}`}>
          Score Trends
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'} />
            <XAxis dataKey="name" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} tick={{ fontSize: 12 }} />
            <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
            <Legend wrapperStyle={{ fontSize: '14px' }} />
            <Line type="monotone" dataKey="Final Score" stroke={COLORS.primary} strokeWidth={3} dot={{ fill: COLORS.primary, r: 5 }} />
            <Line type="monotone" dataKey="Autonomous" stroke={COLORS.success} strokeWidth={2} dot={{ fill: COLORS.success, r: 4 }} />
            <Line type="monotone" dataKey="TeleOp" stroke={COLORS.warning} strokeWidth={2} dot={{ fill: COLORS.warning, r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked Bar Chart */}
      <div className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-black'}`}>
          Score Composition
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'} />
            <XAxis dataKey="name" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} tick={{ fontSize: 12 }} />
            <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
            <Legend wrapperStyle={{ fontSize: '14px' }} />
            <Bar dataKey="Autonomous" stackId="a" fill={COLORS.success} />
            <Bar dataKey="TeleOp" stackId="a" fill={COLORS.warning} />
            <Bar dataKey="End Game" stackId="a" fill={COLORS.primary} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const SessionSummary = ({
  stats,
  matchCount,
}: {
  stats: MatchStats | null;
  matchCount: number;
}) => {
  const { isDarkMode } = useTheme();

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-team-blue text-2xl font-semibold">Session Summary</h2>

      {/* Key Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
          <div className="text-xs text-team-white-60 mb-1">Average Score</div>
          <div className="text-3xl font-bold text-team-blue">{stats.avgScore}</div>
          <div className="text-xs text-team-white-60 mt-2">{matchCount} matches</div>
        </div>
        <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
          <div className="text-xs text-team-white-60 mb-1">Highest Score</div>
          <div className="text-3xl font-bold text-team-blue">{stats.maxScore}</div>
        </div>
        <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
          <div className="text-xs text-team-white-60 mb-1">Lowest Score</div>
          <div className="text-3xl font-bold text-team-blue">{stats.minScore}</div>
        </div>
        <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
          <div className="text-xs text-team-white-60 mb-1">Consistency</div>
          <div className="text-3xl font-bold text-team-blue">{stats.consistency}%</div>
        </div>
        <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
          <div className="text-xs text-team-white-60 mb-1">Accuracy</div>
          <div className="text-3xl font-bold text-team-blue">{stats.accuracy}%</div>
        </div>
      </div>

      {/* Phase Averages */}
      <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>
          Average Points by Phase
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className={`p-4 rounded text-center ${isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-gray-50 border border-gray-200'}`}>
            <div className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>Autonomous</div>
            <div className="text-2xl font-bold text-team-blue mt-2">{stats.avgAuto}</div>
          </div>
          <div className={`p-4 rounded text-center ${isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-gray-50 border border-gray-200'}`}>
            <div className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>TeleOp</div>
            <div className="text-2xl font-bold text-team-blue mt-2">{stats.avgTele}</div>
          </div>
          <div className={`p-4 rounded text-center ${isDarkMode ? 'bg-team-dark border border-team-blue-40' : 'bg-gray-50 border border-gray-200'}`}>
            <div className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>End Game</div>
            <div className="text-2xl font-bold text-team-blue mt-2">{stats.avgEndgame}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AnalysisContent = () => {
  const { sessionData: contextSessionData } = useSession();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  
  // Use local state for loaded session to avoid overwriting context
  const [localSessionData, setLocalSessionData] = useState(contextSessionData);
  const sessionData = localSessionData;
  
  const [_graphModal, _setGraphModal] = useState<{
    isOpen: boolean;
    metric: string;
  }>({
    isOpen: false,
    metric: '',
  });
  
  // Match tracking
  const [viewMode, setViewMode] = useState<'overview' | 'matches' | 'match-analysis' | 'session-summary'>('overview');
  const [sessionMatches, setSessionMatches] = useState<Match[]>([]);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState<number | null>(null);

  // Initialize matches from session data
  useEffect(() => {
    if (sessionData?.matches && sessionData.matches.length > 0) {
      setSessionMatches(sessionData.matches);
    }
  }, [sessionData?.matches]);

  // Calculated metrics
  const [consistency, setConsistency] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(0);

  // Helper functions for match analysis
  const calculateMatchStats = useCallback((): MatchStats | null => {
    if (sessionMatches.length === 0) return null;

    const scores = sessionMatches.map(m => m.finalScore || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    // Consistency calculation (inverse of coefficient of variation)
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const consistencyPercent = avgScore > 0 ? Math.max(0, Math.min(100, 100 - (stdDev / avgScore) * 100)) : 0;

    // Accuracy calculation (percentage of theoretical max)
    const accuracyPercent = (avgScore / GAME_TIMING.MAX_THEORETICAL_SCORE) * 100;

    const avgAuto = sessionMatches.reduce((sum, m) => sum + (m.autonomousScore || 0), 0) / sessionMatches.length;
    const avgTele = sessionMatches.reduce((sum, m) => sum + (m.teleOpScore || 0), 0) / sessionMatches.length;
    const avgEndgame = sessionMatches.reduce((sum, m) => sum + (m.endGameScore || 0), 0) / sessionMatches.length;

    return {
      avgScore: Math.round(avgScore),
      maxScore,
      minScore,
      consistency: Math.round(consistencyPercent),
      accuracy: Math.round(Math.min(100, accuracyPercent)),
      avgAuto: Math.round(avgAuto),
      avgTele: Math.round(avgTele),
      avgEndgame: Math.round(avgEndgame),
      totalMatches: sessionMatches.length,
    };
  }, [sessionMatches]);

  // Load session data from Firebase or location state
  useEffect(() => {
    let mounted = true;
    let abortController: AbortController | null = null;

    const loadSessionData = async () => {
      setLoading(true);

      // First check if session data was passed through state (for temporary sessions)
      const stateData = location.state as {
        sessionData?: Record<string, unknown>;
        isTemporary?: boolean;
      } | null;
      if (stateData?.sessionData) {
        if (mounted) {
          setLocalSessionData(stateData.sessionData as typeof contextSessionData);
          setLoading(false);
        }
        return;
      }

      // Otherwise, try to load by sessionId from query params
      const sessionId = searchParams.get('sessionId');
      if (sessionId) {
        try {
          abortController = new AbortController();
          const session = await firebaseService.getSession(sessionId);

          if (mounted && session) {
            // Use local state instead of updating global context
            setLocalSessionData({
              sessionName: session.sessionName || '',
              driverName: session.driverName || '',
              sessionDuration: session.sessionDuration || '',
              matchType: session.matchType || '',
              finalScore: session.finalScore || 0,
              autonomousScore: session.autonomousScore || 0,
              teleOpScore: session.teleOpScore || 0,
              endGameScore: session.endGameScore || 0,
              isSessionCompleted: true,
              autonClassifiedArtifact: session.autonClassifiedArtifact || 0,
              autonOverflowArtifact: session.autonOverflowArtifact || 0,
              autonMotif: session.autonMotif || 0,
              autonLeave: session.autonLeave || 0,
              teleClassifiedArtifact: session.teleClassifiedArtifact || 0,
              teleOverflowArtifact: session.teleOverflowArtifact || 0,
              teleMotif: session.teleMotif || 0,
              endgameHang: session.endgameHang || 0,
              selectedFeature: session.selectedFeature || '',
              cycleTimes: session.cycleTimes || [],
              notes: session.notes || '',
              matches: session.matches || [],
            });
          }
        } catch (error) {
          // Suppress AbortError which occurs during cleanup
          if (mounted && (error as Error)?.name !== 'AbortError') {
            console.error('Error loading session:', error);
          }
        }
      }

      // Historical sessions loading removed - not needed for current UI

      if (mounted) {
        setLoading(false);
      }
    };

    loadSessionData();

    return () => {
      mounted = false;
      if (abortController) {
        abortController.abort();
      }
    };
  }, [searchParams, location.state, user?.uid]);
  // Initialize consistency and accuracy metrics
  useEffect(() => {
    const stats = calculateMatchStats();
    if (stats) {
      setConsistency(stats.consistency);
      setAccuracy(stats.accuracy);
    }
  }, [sessionMatches, calculateMatchStats]);

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
              value={(sessionData.finalScore ?? 0).toString()}
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
            finalScore={sessionData.finalScore ?? 0}
            totalTime={sessionData.sessionDuration}
          />

          {/* Notes Section */}
          {sessionData.notes && (
            <div
              className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'} space-y-4`}
            >
              <h3
                className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
              >
                Performance Notes & Observations
              </h3>
              <p
                className={`text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
              >
                {sessionData.notes}
              </p>
            </div>
          )}

          {/* Session Analysis - Average Scores & Consistency */}
            {sessionMatches.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-team-blue text-2xl font-semibold">Session Analysis</h2>
                
                {/* Average Scores Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Average Autonomous Score */}
                  <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>Average Autonomous</p>
                    <p className="text-3xl font-bold text-team-blue mt-2">
                      {Math.round(sessionMatches.reduce((sum, m) => sum + (m.autonomousScore || 0), 0) / sessionMatches.length)}
                    </p>
                  </div>

                  {/* Average TeleOp Score */}
                  <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>Average TeleOp</p>
                    <p className="text-3xl font-bold text-team-blue mt-2">
                      {Math.round(sessionMatches.reduce((sum, m) => sum + (m.teleOpScore || 0), 0) / sessionMatches.length)}
                    </p>
                  </div>

                  {/* Average End Game Score */}
                  <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>Average End Game</p>
                    <p className="text-3xl font-bold text-team-blue mt-2">
                      {Math.round(sessionMatches.reduce((sum, m) => sum + (m.endGameScore || 0), 0) / sessionMatches.length)}
                    </p>
                  </div>

                  {/* Consistency Score */}
                  <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>Consistency</p>
                    <p className="text-3xl font-bold text-team-blue mt-2">
                      {(() => {
                        const scores = sessionMatches.map(m => m.finalScore || 0);
                        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
                        const variance = scores.reduce((acc, score) => acc + Math.pow(score - avgScore, 2), 0) / scores.length;
                        const stdDev = Math.sqrt(variance);
                        return Math.round(Math.max(0, 100 - stdDev * 2));
                      })()}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cycle Times Card */}
            {sessionData.selectedFeature === 'Cycle Times' && (
              <CycleTimesCard cycleTimes={sessionData.cycleTimes} />
            )}

          <div className="space-y-6">
                {/* View Mode Tabs */}
                {sessionMatches.length > 0 && (
                  <div className="flex gap-3 border-b border-team-blue-40 overflow-x-auto">
                    <button
                      onClick={() => setViewMode('overview')}
                      className={`px-4 py-3 font-medium whitespace-nowrap transition-colors ${
                        viewMode === 'overview'
                          ? 'text-team-blue border-b-2 border-team-blue'
                          : isDarkMode ? 'text-team-white-60 hover:text-white' : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setViewMode('session-summary')}
                      className={`px-4 py-3 font-medium whitespace-nowrap transition-colors ${
                        viewMode === 'session-summary'
                          ? 'text-team-blue border-b-2 border-team-blue'
                          : isDarkMode ? 'text-team-white-60 hover:text-white' : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      Session Summary
                    </button>
                    <button
                      onClick={() => {
                        setViewMode('match-analysis');
                        if (selectedMatchIndex === null) setSelectedMatchIndex(0);
                      }}
                      className={`px-4 py-3 font-medium whitespace-nowrap transition-colors ${
                        viewMode === 'match-analysis'
                          ? 'text-team-blue border-b-2 border-team-blue'
                          : isDarkMode ? 'text-team-white-60 hover:text-white' : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      Individual Match
                    </button>
                    <button
                      onClick={() => setViewMode('matches')}
                      className={`px-4 py-3 font-medium whitespace-nowrap transition-colors ${
                        viewMode === 'matches'
                          ? 'text-team-blue border-b-2 border-team-blue'
                          : isDarkMode ? 'text-team-white-60 hover:text-white' : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      Compare All
                    </button>
                  </div>
                )}

                {/* Session Summary View */}
                {viewMode === 'session-summary' && sessionMatches.length > 0 && (
                  <SessionSummary stats={calculateMatchStats()} matchCount={sessionMatches.length} />
                )}

                {/* Individual Match Analysis */}
                {viewMode === 'match-analysis' && selectedMatchIndex !== null && sessionMatches[selectedMatchIndex] && (
                  <div className="space-y-6">
                    <MatchAnalysis
                      match={sessionMatches[selectedMatchIndex]}
                      matchIndex={selectedMatchIndex}
                      allMatches={sessionMatches}
                      isDarkMode={isDarkMode}
                    />

                    <div className="flex gap-3 justify-center mt-8 flex-wrap">
                      <button
                        onClick={() => {
                          if (selectedMatchIndex > 0) setSelectedMatchIndex(selectedMatchIndex - 1);
                        }}
                        disabled={selectedMatchIndex === 0}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          selectedMatchIndex === 0
                            ? isDarkMode ? 'bg-team-dark-20 text-team-white-40 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-team-blue text-white hover:bg-team-blue/90'
                        }`}
                      >
                        ← Previous Match
                      </button>
                      <span className="px-4 py-2 text-team-blue font-medium">
                        Match {(selectedMatchIndex || 0) + 1} of {sessionMatches.length}
                      </span>
                      <button
                        onClick={() => {
                          if (selectedMatchIndex < sessionMatches.length - 1) setSelectedMatchIndex(selectedMatchIndex + 1);
                        }}
                        disabled={selectedMatchIndex === sessionMatches.length - 1}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          selectedMatchIndex === sessionMatches.length - 1
                            ? isDarkMode ? 'bg-team-dark-20 text-team-white-40 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-team-blue text-white hover:bg-team-blue/90'
                        }`}
                      >
                        Next Match →
                      </button>
                    </div>
                  </div>
                )}

                {/* Compare All Matches */}
                {viewMode === 'matches' && sessionMatches.length > 0 && (
                  <MatchComparison matches={sessionMatches} isDarkMode={isDarkMode} />
                )}

                {/* Original Matches List (Overview) */}
                {viewMode === 'overview' && (
                  <>
                    <h2 className="text-team-blue text-2xl font-semibold">
                      Matches in This Session
                    </h2>

                    {sessionMatches.length > 0 ? (
                      <>
                        <div className="flex flex-col gap-4">
                          {sessionMatches.map((match, index) => (
                            <button
                              key={match.id}
                              onClick={() => {
                                setSelectedMatchIndex(index);
                                setViewMode('match-analysis');
                              }}
                              className={`p-4 rounded-lg text-left transition-all ${
                                selectedMatchIndex === index
                                  ? `${isDarkMode ? 'bg-team-blue/20 border-2 border-team-blue-40' : 'bg-blue-50 border-2 border-team-blue'}`
                                  : `${isDarkMode ? 'bg-team-dark-20 border border-team-blue-40 hover:border-team-blue' : 'bg-white border border-gray-200 hover:border-team-blue'}`
                              }`}
                            >
                              <div className="flex justify-between items-start gap-4">
                                <div>
                                  <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    Match {match.matchNumber}
                                  </h3>
                                  <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                                    Score: {match.finalScore || 0} pts • Type: {match.matchType || 'N/A'}
                                  </p>
                                </div>
                                <ChevronRight className={`w-5 h-5 ${isDarkMode ? 'text-team-white-60' : 'text-gray-400'}`} />
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className={`text-center py-12 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-gray-50'}`}>
                        <p className={`text-lg ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                          No matches recorded yet
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/sessions"
              className="w-full sm:w-60 px-2.5 py-2.5 rounded-2xl border border-team-blue text-team-blue text-base leading-6 font-normal text-center hover:bg-team-blue hover:text-team-dark transition-colors"
            >
              Back to Sessions
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
