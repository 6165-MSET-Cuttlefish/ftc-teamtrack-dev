import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import { useSession, useTheme, useAuth } from '@/contexts';
import { firebaseService } from '@/services';
import { APP_CONFIG } from '@/constants';
import type { Match } from '@/types';
import {
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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

const SensorOverviewCard = ({
  sessionName,
  driverName,
  matchType,
  sessionDuration,
}: {
  sessionName: string;
  driverName: string;
  matchType: string;
  sessionDuration: string;
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
              className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-sm leading-6`}
            >
              Session Name
            </div>
            <div
              className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-sm leading-6`}
            >
              Driver
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="text-team-blue text-sm leading-6">
              {sessionName || 'N/A'}
            </div>
            <div className="text-team-blue text-sm leading-6">
              {driverName || 'N/A'}
            </div>
          </div>
        </div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2.5">
            <div
              className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-sm leading-6`}
            >
              Match Type
            </div>
            <div
              className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-sm leading-6`}
            >
              Duration
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="text-team-blue text-sm leading-6">
              {matchType || 'N/A'}
            </div>
            <div className="text-team-blue text-sm leading-6">
              {sessionDuration || 'N/A'}
            </div>
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

  // Calculate all-time average (including this match)
  const allTimeAvgAuto = allMatches.length > 0 ? Math.round(allMatches.reduce((sum, m) => sum + (m.autonomousScore || 0), 0) / allMatches.length) : 0;
  const allTimeAvgTele = allMatches.length > 0 ? Math.round(allMatches.reduce((sum, m) => sum + (m.teleOpScore || 0), 0) / allMatches.length) : 0;
  const allTimeAvgEndgame = allMatches.length > 0 ? Math.round(allMatches.reduce((sum, m) => sum + (m.endGameScore || 0), 0) / allMatches.length) : 0;

  const comparisonData = [
    { name: 'Autonomous', 'This Match': match.autonomousScore || 0, 'Session Avg': Math.round(avgAuto), 'All Time Avg': allTimeAvgAuto },
    { name: 'TeleOp', 'This Match': match.teleOpScore || 0, 'Session Avg': Math.round(avgTele), 'All Time Avg': allTimeAvgTele },
    { name: 'End Game', 'This Match': match.endGameScore || 0, 'Session Avg': Math.round(avgEndgame), 'All Time Avg': allTimeAvgEndgame },
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
              <Bar dataKey="All Time Avg" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cycle Times Curve */}
      {match.cycleTimes && match.cycleTimes.length > 0 && (
        <div className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            Cycle Times
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart 
              data={match.cycleTimes.map((time, idx) => ({ cycle: idx + 1, time }))}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'} />
              <XAxis 
                dataKey="cycle" 
                label={{ value: 'Cycle #', position: 'insideBottomRight', offset: -10 }}
                stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ value: 'Time (seconds)', angle: -90, position: 'insideLeft' }}
                stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
              <Line 
                type="monotone"
                dataKey="time" 
                stroke="#a855f7"
                strokeWidth={2}
                dot={{ fill: '#a855f7', r: 4 }}
                activeDot={{ r: 6 }}
                name="Cycle Time"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Scoring Breakdown Table */}
      <div className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-black'}`}>
          Scoring Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Phase</th>
                <th className={`text-center py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Classified</th>
                <th className={`text-center py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Overflow</th>
                <th className={`text-center py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Motifs</th>
                <th className={`text-center py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Leave/Hang</th>
                <th className={`text-right py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total Points</th>
              </tr>
            </thead>
            <tbody>
              {/* Autonomous Row */}
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <td className={`py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Autonomous</td>
                <td className={`text-center py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                  {match.autonClassifiedArtifact || 0}
                </td>
                <td className={`text-center py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                  {match.autonOverflowArtifact || 0}
                </td>
                <td className={`text-center py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                  {match.autonMotif || 0}
                </td>
                <td className={`text-center py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                  {match.autonLeave || 0}
                </td>
                <td className={`text-right py-3 px-4 font-semibold ${isDarkMode ? 'text-team-blue' : 'text-team-blue'}`}>
                  {match.autonomousScore || 0}
                </td>
              </tr>

              {/* TeleOp Row */}
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <td className={`py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>TeleOp</td>
                <td className={`text-center py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                  {match.teleClassifiedArtifact || 0}
                </td>
                <td className={`text-center py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                  {match.teleOverflowArtifact || 0}
                </td>
                <td className={`text-center py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                  {match.teleMotif || 0}
                </td>
                <td className={`text-center py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                  —
                </td>
                <td className={`text-right py-3 px-4 font-semibold ${isDarkMode ? 'text-team-blue' : 'text-team-blue'}`}>
                  {match.teleOpScore || 0}
                </td>
              </tr>

              {/* End Game Row */}
              <tr>
                <td className={`py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>End Game</td>
                <td className={`text-center py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>—</td>
                <td className={`text-center py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>—</td>
                <td className={`text-center py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>—</td>
                <td className={`text-center py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                  {match.endGameScore || 0}
                </td>
                <td className={`text-right py-3 px-4 font-semibold ${isDarkMode ? 'text-team-blue' : 'text-team-blue'}`}>
                  {match.endGameScore || 0}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MatchTrendComparison = ({
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

interface MatchComparison {
  matchA: Match;
  matchB: Match;
  indexA: number;
  indexB: number;
  finalScoreDiff: number;
  finalScoreDiffPercent: number;
  autoDiff: number;
  autoPercent: number;
  teleDiff: number;
  telePercent: number;
  endgameDiff: number;
  endgamePercent: number;
}

const calculateMatchComparison = (matchA: Match, matchB: Match): MatchComparison => {
  const finalScoreDiff = (matchB.finalScore || 0) - (matchA.finalScore || 0);
  const finalScoreDiffPercent = matchA.finalScore ? (finalScoreDiff / (matchA.finalScore || 1)) * 100 : 0;
  
  const autoDiff = (matchB.autonomousScore || 0) - (matchA.autonomousScore || 0);
  const autoPercent = matchA.autonomousScore ? (autoDiff / (matchA.autonomousScore || 1)) * 100 : 0;
  
  const teleDiff = (matchB.teleOpScore || 0) - (matchA.teleOpScore || 0);
  const telePercent = matchA.teleOpScore ? (teleDiff / (matchA.teleOpScore || 1)) * 100 : 0;
  
  const endgameDiff = (matchB.endGameScore || 0) - (matchA.endGameScore || 0);
  const endgamePercent = matchA.endGameScore ? (endgameDiff / (matchA.endGameScore || 1)) * 100 : 0;

  return {
    matchA,
    matchB,
    indexA: -1,
    indexB: -1,
    finalScoreDiff,
    finalScoreDiffPercent,
    autoDiff,
    autoPercent,
    teleDiff,
    telePercent,
    endgameDiff,
    endgamePercent,
  };
};

const MatchComparisonView = ({
  matches,
  isDarkMode,
}: {
  matches: Match[];
  isDarkMode: boolean;
}) => {
  const [matchAIndex, setMatchAIndex] = useState<number>(0);
  const [matchBIndex, setMatchBIndex] = useState<number>(matches.length > 1 ? 1 : 0);

  if (matches.length < 2) {
    return (
      <div className={`text-center py-12 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-gray-50'}`}>
        <p className={`text-lg ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
          Need at least 2 matches to compare
        </p>
      </div>
    );
  }

  const comparison = calculateMatchComparison(matches[matchAIndex], matches[matchBIndex]);

  const COLORS = {
    primary: '#537788',
    secondary: '#B0E5FE',
    success: '#10b981',
    warning: '#f59e0b',
  };

  // Data for comparison charts
  const scoreComparisonData = [
    {
      name: `Match ${matches[matchAIndex].matchNumber}`,
      'Autonomous': matches[matchAIndex].autonomousScore || 0,
      'TeleOp': matches[matchAIndex].teleOpScore || 0,
      'End Game': matches[matchAIndex].endGameScore || 0,
    },
    {
      name: `Match ${matches[matchBIndex].matchNumber}`,
      'Autonomous': matches[matchBIndex].autonomousScore || 0,
      'TeleOp': matches[matchBIndex].teleOpScore || 0,
      'End Game': matches[matchBIndex].endGameScore || 0,
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-team-blue text-2xl font-semibold">Compare Matches</h2>

      {/* Match Selection */}
      <div className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>
          Select Matches to Compare
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Match A Selection */}
          <div className="flex flex-col gap-2">
            <label className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
              First Match
            </label>
            <select
              value={matchAIndex}
              onChange={(e) => setMatchAIndex(Number(e.target.value))}
              className={`w-full px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-team-dark border-team-blue-40 text-white' : 'bg-white border-team-blue-40 text-black'} focus:outline-none focus:ring-2 focus:ring-team-blue`}
            >
              {matches.map((match, idx) => (
                <option key={idx} value={idx}>
                  Match {match.matchNumber} • Score: {match.finalScore || 0} pts • {match.matchType || 'N/A'}
                </option>
              ))}
            </select>
          </div>

          {/* Match B Selection */}
          <div className="flex flex-col gap-2">
            <label className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
              Second Match
            </label>
            <select
              value={matchBIndex}
              onChange={(e) => setMatchBIndex(Number(e.target.value))}
              className={`w-full px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-team-dark border-team-blue-40 text-white' : 'bg-white border-team-blue-40 text-black'} focus:outline-none focus:ring-2 focus:ring-team-blue`}
            >
              {matches.map((match, idx) => (
                <option key={idx} value={idx}>
                  Match {match.matchNumber} • Score: {match.finalScore || 0} pts • {match.matchType || 'N/A'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Score Comparison Highlight */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Final Score */}
        <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
          <p className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>Final Score Difference</p>
          <p className={`text-2xl font-bold mt-2 ${comparison.finalScoreDiff >= 0 ? 'text-team-blue' : 'text-red-500'}`}>
            {comparison.finalScoreDiff > 0 ? '+' : ''}{comparison.finalScoreDiff}
            <span className={`text-sm ml-2 ${comparison.finalScoreDiffPercent >= 0 ? 'text-team-blue' : 'text-red-500'}`}>
              ({comparison.finalScoreDiffPercent > 0 ? '+' : ''}{comparison.finalScoreDiffPercent.toFixed(1)}%)
            </span>
          </p>
        </div>

        {/* Autonomous Difference */}
        <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
          <p className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>Autonomous Difference</p>
          <p className={`text-2xl font-bold mt-2 ${comparison.autoDiff >= 0 ? 'text-team-blue' : 'text-red-500'}`}>
            {comparison.autoDiff > 0 ? '+' : ''}{comparison.autoDiff}
            <span className={`text-sm ml-2 ${comparison.autoPercent >= 0 ? 'text-team-blue' : 'text-red-500'}`}>
              ({comparison.autoPercent > 0 ? '+' : ''}{comparison.autoPercent.toFixed(1)}%)
            </span>
          </p>
        </div>

        {/* TeleOp Difference */}
        <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
          <p className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>TeleOp Difference</p>
          <p className={`text-2xl font-bold mt-2 ${comparison.teleDiff >= 0 ? 'text-team-blue' : 'text-red-500'}`}>
            {comparison.teleDiff > 0 ? '+' : ''}{comparison.teleDiff}
            <span className={`text-sm ml-2 ${comparison.telePercent >= 0 ? 'text-team-blue' : 'text-red-500'}`}>
              ({comparison.telePercent > 0 ? '+' : ''}{comparison.telePercent.toFixed(1)}%)
            </span>
          </p>
        </div>
      </div>

      {/* Score Composition Comparison Chart */}
      <div className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-black'}`}>
          Score Component Comparison
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={scoreComparisonData}>
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

      {/* Detailed Statistics Table */}
      <div className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-black'}`}>
          Detailed Statistics
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Metric</th>
                <th className={`text-center py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Match {matches[matchAIndex].matchNumber}
                </th>
                <th className={`text-center py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Match {matches[matchBIndex].matchNumber}
                </th>
                <th className={`text-center py-3 px-4 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Difference
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Final Score */}
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <td className={`py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>Final Score</td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchAIndex].finalScore || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchBIndex].finalScore || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${comparison.finalScoreDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {comparison.finalScoreDiff > 0 ? '+' : ''}{comparison.finalScoreDiff}
                </td>
              </tr>
              {/* Autonomous Score */}
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <td className={`py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>Autonomous Score</td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchAIndex].autonomousScore || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchBIndex].autonomousScore || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${comparison.autoDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {comparison.autoDiff > 0 ? '+' : ''}{comparison.autoDiff}
                </td>
              </tr>
              {/* TeleOp Score */}
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <td className={`py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>TeleOp Score</td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchAIndex].teleOpScore || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchBIndex].teleOpScore || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${comparison.teleDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {comparison.teleDiff > 0 ? '+' : ''}{comparison.teleDiff}
                </td>
              </tr>
              {/* End Game Score */}
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <td className={`py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>End Game Score</td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchAIndex].endGameScore || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchBIndex].endGameScore || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${comparison.endgameDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {comparison.endgameDiff > 0 ? '+' : ''}{comparison.endgameDiff}
                </td>
              </tr>
              {/* Classified Artifacts (Autonomous) */}
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <td className={`py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>Classified Artifacts (Auto)</td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchAIndex].autonClassifiedArtifact || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchBIndex].autonClassifiedArtifact || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${(matches[matchBIndex].autonClassifiedArtifact || 0) >= (matches[matchAIndex].autonClassifiedArtifact || 0) ? 'text-green-500' : 'text-red-500'}`}>
                  {((matches[matchBIndex].autonClassifiedArtifact || 0) - (matches[matchAIndex].autonClassifiedArtifact || 0)) >= 0 ? '+' : ''}{(matches[matchBIndex].autonClassifiedArtifact || 0) - (matches[matchAIndex].autonClassifiedArtifact || 0)}
                </td>
              </tr>
              {/* Classified Artifacts (TeleOp) */}
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <td className={`py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>Classified Artifacts (TeleOp)</td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchAIndex].teleClassifiedArtifact || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchBIndex].teleClassifiedArtifact || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${(matches[matchBIndex].teleClassifiedArtifact || 0) >= (matches[matchAIndex].teleClassifiedArtifact || 0) ? 'text-green-500' : 'text-red-500'}`}>
                  {((matches[matchBIndex].teleClassifiedArtifact || 0) - (matches[matchAIndex].teleClassifiedArtifact || 0)) >= 0 ? '+' : ''}{(matches[matchBIndex].teleClassifiedArtifact || 0) - (matches[matchAIndex].teleClassifiedArtifact || 0)}
                </td>
              </tr>
              {/* Overflow Artifacts (Autonomous) */}
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <td className={`py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>Overflow Artifacts (Auto)</td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchAIndex].autonOverflowArtifact || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchBIndex].autonOverflowArtifact || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${(matches[matchBIndex].autonOverflowArtifact || 0) >= (matches[matchAIndex].autonOverflowArtifact || 0) ? 'text-green-500' : 'text-red-500'}`}>
                  {((matches[matchBIndex].autonOverflowArtifact || 0) - (matches[matchAIndex].autonOverflowArtifact || 0)) >= 0 ? '+' : ''}{(matches[matchBIndex].autonOverflowArtifact || 0) - (matches[matchAIndex].autonOverflowArtifact || 0)}
                </td>
              </tr>
              {/* Overflow Artifacts (TeleOp) */}
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <td className={`py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>Overflow Artifacts (TeleOp)</td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchAIndex].teleOverflowArtifact || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchBIndex].teleOverflowArtifact || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${(matches[matchBIndex].teleOverflowArtifact || 0) >= (matches[matchAIndex].teleOverflowArtifact || 0) ? 'text-green-500' : 'text-red-500'}`}>
                  {((matches[matchBIndex].teleOverflowArtifact || 0) - (matches[matchAIndex].teleOverflowArtifact || 0)) >= 0 ? '+' : ''}{(matches[matchBIndex].teleOverflowArtifact || 0) - (matches[matchAIndex].teleOverflowArtifact || 0)}
                </td>
              </tr>
              {/* Motifs (Autonomous) */}
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <td className={`py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>Motifs (Auto)</td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchAIndex].autonMotif || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchBIndex].autonMotif || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${(matches[matchBIndex].autonMotif || 0) >= (matches[matchAIndex].autonMotif || 0) ? 'text-green-500' : 'text-red-500'}`}>
                  {((matches[matchBIndex].autonMotif || 0) - (matches[matchAIndex].autonMotif || 0)) >= 0 ? '+' : ''}{(matches[matchBIndex].autonMotif || 0) - (matches[matchAIndex].autonMotif || 0)}
                </td>
              </tr>
              {/* Motifs (TeleOp) */}
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <td className={`py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>Motifs (TeleOp)</td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchAIndex].teleMotif || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchBIndex].teleMotif || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${(matches[matchBIndex].teleMotif || 0) >= (matches[matchAIndex].teleMotif || 0) ? 'text-green-500' : 'text-red-500'}`}>
                  {((matches[matchBIndex].teleMotif || 0) - (matches[matchAIndex].teleMotif || 0)) >= 0 ? '+' : ''}{(matches[matchBIndex].teleMotif || 0) - (matches[matchAIndex].teleMotif || 0)}
                </td>
              </tr>
              {/* Leave */}
              <tr className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}>
                <td className={`py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>Leave</td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchAIndex].autonLeave || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchBIndex].autonLeave || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${(matches[matchBIndex].autonLeave || 0) >= (matches[matchAIndex].autonLeave || 0) ? 'text-green-500' : 'text-red-500'}`}>
                  {((matches[matchBIndex].autonLeave || 0) - (matches[matchAIndex].autonLeave || 0)) >= 0 ? '+' : ''}{(matches[matchBIndex].autonLeave || 0) - (matches[matchAIndex].autonLeave || 0)}
                </td>
              </tr>
              {/* End Game Score */}
              <tr>
                <td className={`py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>End Game Score</td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchAIndex].endGameScore || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {matches[matchBIndex].endGameScore || 0}
                </td>
                <td className={`text-center py-3 px-4 font-medium ${(matches[matchBIndex].endGameScore || 0) >= (matches[matchAIndex].endGameScore || 0) ? 'text-green-500' : 'text-red-500'}`}>
                  {((matches[matchBIndex].endGameScore || 0) - (matches[matchAIndex].endGameScore || 0)) >= 0 ? '+' : ''}{(matches[matchBIndex].endGameScore || 0) - (matches[matchAIndex].endGameScore || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
  
  useEffect(() => {
    document.title = `Analysis - ${APP_CONFIG.name}`;
  }, []);
  
  const [_graphModal, _setGraphModal] = useState<{
    isOpen: boolean;
    metric: string;
  }>({
    isOpen: false,
    metric: '',
  });
  
  // Match tracking
  const [viewMode, setViewMode] = useState<'overview' | 'matches' | 'match-analysis' | 'session-summary' | 'compare'>('overview');
  const [sessionMatches, setSessionMatches] = useState<Match[]>([]);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState<number | null>(null);

  // Initialize matches from session data
  useEffect(() => {
    if (sessionData?.matches && sessionData.matches.length > 0) {
      setSessionMatches(sessionData.matches);
    }
  }, [sessionData?.matches]);

  // Helper functions for match analysis
  const calculateMatchStats = useCallback((): MatchStats | null => {
    if (sessionMatches.length === 0) return null;

    const scores = sessionMatches.map(m => m.finalScore || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    const avgAuto = sessionMatches.reduce((sum, m) => sum + (m.autonomousScore || 0), 0) / sessionMatches.length;
    const avgTele = sessionMatches.reduce((sum, m) => sum + (m.teleOpScore || 0), 0) / sessionMatches.length;
    const avgEndgame = sessionMatches.reduce((sum, m) => sum + (m.endGameScore || 0), 0) / sessionMatches.length;

    return {
      avgScore: Math.round(avgScore),
      maxScore,
      minScore,
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
          setLocalSessionData(stateData.sessionData as unknown as typeof contextSessionData);
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
            // Calculate aggregates from matches
            const finalScore = session.matches.reduce((sum, m) => sum + (m.finalScore || 0), 0);
            const autonomousScore = session.matches.reduce((sum, m) => sum + (m.autonomousScore || 0), 0);
            const teleOpScore = session.matches.reduce((sum, m) => sum + (m.teleOpScore || 0), 0);
            const endGameScore = session.matches.reduce((sum, m) => sum + (m.endGameScore || 0), 0);
            const autonClassifiedArtifact = session.matches.reduce((sum, m) => sum + (m.autonClassifiedArtifact || 0), 0);
            const autonOverflowArtifact = session.matches.reduce((sum, m) => sum + (m.autonOverflowArtifact || 0), 0);
            const autonMotif = session.matches.reduce((sum, m) => sum + (m.autonMotif || 0), 0);
            const autonLeave = session.matches.reduce((sum, m) => sum + (m.autonLeave || 0), 0);
            const teleClassifiedArtifact = session.matches.reduce((sum, m) => sum + (m.teleClassifiedArtifact || 0), 0);
            const teleOverflowArtifact = session.matches.reduce((sum, m) => sum + (m.teleOverflowArtifact || 0), 0);
            const teleMotif = session.matches.reduce((sum, m) => sum + (m.teleMotif || 0), 0);
            const cycleTimes = session.matches.flatMap(m => m.cycleTimes || []);

            // Use local state instead of updating global context
            setLocalSessionData({
              sessionName: session.sessionName || '',
              driverName: session.driverName || '',
              sessionDuration: session.sessionDuration || '',
              matchType: session.matchType || '',
              finalScore,
              autonomousScore,
              teleOpScore,
              endGameScore,
              isSessionCompleted: true,
              autonClassifiedArtifact,
              autonOverflowArtifact,
              autonMotif,
              autonLeave,
              teleClassifiedArtifact,
              teleOverflowArtifact,
              teleMotif,
              robot1Park: 'none',
              robot2Park: 'none',
              selectedFeature: session.selectedFeature || '',
              cycleTimes,
              notes: session.notes || '',
              matches: session.matches || [],
            });
          }
        } catch (error) {
          // Suppress AbortError which occurs during cleanup
          if (mounted && (error as Error)?.name !== 'AbortError') {
            const { logger } = await import('@/lib/logger');
            logger.error('Error loading session', error);
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

          {/* Data Cards - Removed Final Score, Consistency, and Accuracy */}

          {/* Sensor Overview */}
          <SensorOverviewCard
            sessionName={sessionData.sessionName}
            driverName={sessionData.driverName}
            matchType={sessionData.matchType}
            sessionDuration={sessionData.sessionDuration}
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Average Final Score */}
                  <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>Average Final</p>
                    <p className="text-3xl font-bold text-team-blue mt-2">
                      {Math.round(sessionMatches.reduce((sum, m) => sum + (m.finalScore || 0), 0) / sessionMatches.length)}
                    </p>
                  </div>

                  {/* Average Autonomous Score */}
                  <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>Average Auto</p>
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
                    <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>Average E.G.</p>
                    <p className="text-3xl font-bold text-team-blue mt-2">
                      {Math.round(sessionMatches.reduce((sum, m) => sum + (m.endGameScore || 0), 0) / sessionMatches.length)}
                    </p>
                  </div>

                  {/* Consistency Score */}
                  <div className={`p-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>Score Consistency</p>
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
                    <button
                      onClick={() => setViewMode('compare')}
                      className={`px-4 py-3 font-medium whitespace-nowrap transition-colors ${
                        viewMode === 'compare'
                          ? 'text-team-blue border-b-2 border-team-blue'
                          : isDarkMode ? 'text-team-white-60 hover:text-white' : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      Compare Two Matches
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
                            : 'bg-team-blue text-[#191919] hover:bg-team-blue/90'
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
                            : 'bg-team-blue text-[#191919] hover:bg-team-blue/90'
                        }`}
                      >
                        Next Match →
                      </button>
                    </div>
                  </div>
                )}

                {/* Compare All Matches */}
                {viewMode === 'matches' && sessionMatches.length > 0 && (
                  <MatchTrendComparison matches={sessionMatches} isDarkMode={isDarkMode} />
                )}

                {/* Compare Two Matches */}
                {viewMode === 'compare' && sessionMatches.length >= 2 && (
                  <MatchComparisonView matches={sessionMatches} isDarkMode={isDarkMode} />
                )}

                {/* Matches List (Overview) */}
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
