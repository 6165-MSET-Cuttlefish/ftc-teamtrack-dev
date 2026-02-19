import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTheme, useAuth } from '@/contexts';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  ArrowLeft,
  Trophy,
  Target,
  TrendingDown,
  Minus,
  BarChart3,
  AlertTriangle,
  Timer,
  TrendingUp,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
} from 'lucide-react';
import type { Session, Match } from '@/types';
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

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format seconds to M:SS */
const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

/** Compute +/- diff string */
const diffStr = (val: number) => (val > 0 ? `+${val}` : `${val}`);

/** Trend icon based on positive/negative/zero */
const TrendIcon = ({ value, size = 16 }: { value: number; size?: number }) => {
  if (value > 0) return <TrendingUp size={size} className="text-emerald-500" />;
  if (value < 0) return <TrendingDown size={size} className="text-red-500" />;
  return <Minus size={size} className="text-gray-400" />;
};

// ─── Chart tooltip ──────────────────────────────────────────────────────────

const ChartTooltip = ({
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
  if (!active || !payload?.length) return null;
  return (
    <div
      className={`p-3 rounded-lg border shadow-xl backdrop-blur-sm ${
        isDarkMode
          ? 'bg-team-dark/95 border-team-blue-40'
          : 'bg-white/95 border-gray-200'
      }`}
    >
      {label && (
        <p
          className={`font-semibold mb-2 pb-2 border-b text-xs ${
            isDarkMode
              ? 'text-white border-team-blue-40'
              : 'text-gray-900 border-gray-200'
          }`}
        >
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span
                className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
              >
                {entry.name}
              </span>
            </div>
            <span className="text-xs font-bold" style={{ color: entry.color }}>
              {typeof entry.value === 'number'
                ? entry.value.toFixed(1)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Stat card ──────────────────────────────────────────────────────────────

const StatCard = ({
  label,
  value,
  sublabel,
  icon: Icon,
  highlight,
  isDarkMode,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ElementType;
  highlight?: boolean;
  isDarkMode: boolean;
}) => (
  <div
    className={`rounded-xl border p-5 transition-all ${
      highlight
        ? isDarkMode
          ? 'border-team-blue bg-team-blue/10'
          : 'border-team-blue bg-team-blue/5'
        : isDarkMode
          ? 'border-team-blue-40 bg-team-dark-20'
          : 'border-gray-200 bg-white'
    }`}
  >
    <div className="space-y-3">
      {Icon && (
        <div
          className={`inline-flex p-2.5 rounded-lg ${isDarkMode ? 'bg-team-blue/10' : 'bg-team-blue/5'}`}
        >
          <Icon size={20} className="text-team-blue" />
        </div>
      )}
      <div>
        <p
          className={`text-xs font-medium uppercase tracking-wide ${
            isDarkMode ? 'text-team-white-60' : 'text-gray-500'
          }`}
        >
          {label}
        </p>
        <p className="text-3xl font-bold text-team-blue mt-1">{value}</p>
        {sublabel && (
          <p
            className={`text-xs mt-1 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
          >
            {sublabel}
          </p>
        )}
      </div>
    </div>
  </div>
);

// ─── Phase bar ──────────────────────────────────────────────────────────────

const PhaseBar = ({
  label,
  value,
  max,
  color,
  isDarkMode,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  isDarkMode: boolean;
}) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span
          className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-700'}`}
        >
          {label}
        </span>
        <span className="text-sm font-bold text-team-blue">{value} pts</span>
      </div>
      <div
        className={`h-2.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

// ─── Section wrapper ────────────────────────────────────────────────────────

const Section = ({
  title,
  children,
  isDarkMode,
}: {
  title: string;
  children: React.ReactNode;
  isDarkMode: boolean;
}) => (
  <div
    className={`rounded-xl border p-6 ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`}
  >
    <h3
      className={`text-lg font-semibold mb-5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
    >
      {title}
    </h3>
    {children}
  </div>
);

// ─── Computed stats helper ──────────────────────────────────────────────────

interface SessionStats {
  avgScore: number;
  maxScore: number;
  minScore: number;
  avgAuto: number;
  avgTele: number;
  avgEndgame: number;
  avgMissed: number;
  consistency: number;
  totalMatches: number;
  bestMatch: number;
  worstMatch: number;
}

const computeStats = (matches: Match[]): SessionStats | null => {
  if (matches.length === 0) return null;
  const scores = matches.map(m => m.finalScore || 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const bestMatch = scores.indexOf(maxScore);
  const worstMatch = scores.indexOf(minScore);

  const avgAuto =
    matches.reduce((s, m) => s + (m.autonomousScore || 0), 0) / matches.length;
  const avgTele =
    matches.reduce((s, m) => s + (m.teleopScore || 0), 0) / matches.length;
  const avgEndgame =
    matches.reduce((s, m) => s + (m.endGameScore || 0), 0) / matches.length;
  const avgMissed =
    matches.reduce(
      (s, m) => s + (m.autonBallsMissed || 0) + (m.teleBallsMissed || 0),
      0
    ) / matches.length;

  const variance =
    scores.reduce((acc, sc) => acc + Math.pow(sc - avgScore, 2), 0) /
    scores.length;
  const consistency = Math.round(Math.max(0, 100 - Math.sqrt(variance) * 2));

  return {
    avgScore: Math.round(avgScore),
    maxScore,
    minScore,
    avgAuto: Math.round(avgAuto),
    avgTele: Math.round(avgTele),
    avgEndgame: Math.round(avgEndgame),
    avgMissed: Math.round(avgMissed * 10) / 10,
    consistency,
    totalMatches: matches.length,
    bestMatch,
    worstMatch,
  };
};

// ─── COLORS ─────────────────────────────────────────────────────────────────

const CHART_COLORS = {
  auto: '#10b981',
  tele: '#f59e0b',
  endgame: '#537788',
  primary: '#537788',
  secondary: '#B0E5FE',
  missed: '#ef4444',
  purple: '#a855f7',
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — Summary
// ═══════════════════════════════════════════════════════════════════════════

const SummaryTab = ({
  matches,
  stats,
  isDarkMode,
}: {
  matches: Match[];
  stats: SessionStats;
  isDarkMode: boolean;
}) => {
  const trendData = matches.map((m, i) => ({
    name: `M${i + 1}`,
    'Final Score': m.finalScore || 0,
    Autonomous: m.autonomousScore || 0,
    Teleop: m.teleopScore || 0,
    Endgame: m.endGameScore || 0,
  }));

  const missedData = matches.map((m, i) => ({
    name: `M${i + 1}`,
    'Auto Missed': m.autonBallsMissed || 0,
    'Teleop Missed': m.teleBallsMissed || 0,
  }));

  const compositionData = matches.map((m, i) => ({
    name: `M${i + 1}`,
    Autonomous: m.autonomousScore || 0,
    Teleop: m.teleopScore || 0,
    Endgame: m.endGameScore || 0,
  }));

  const totalAvg = stats.avgAuto + stats.avgTele + stats.avgEndgame;

  return (
    <div className="space-y-6">
      {/* Average Phase Breakdown */}
      <Section title="Average Score Breakdown" isDarkMode={isDarkMode}>
        <div className="space-y-4">
          <PhaseBar
            label="Autonomous"
            value={stats.avgAuto}
            max={totalAvg}
            color={CHART_COLORS.auto}
            isDarkMode={isDarkMode}
          />
          <PhaseBar
            label="Teleop"
            value={stats.avgTele}
            max={totalAvg}
            color={CHART_COLORS.tele}
            isDarkMode={isDarkMode}
          />
          <PhaseBar
            label="Endgame"
            value={stats.avgEndgame}
            max={totalAvg}
            color={CHART_COLORS.endgame}
            isDarkMode={isDarkMode}
          />
        </div>
        <div
          className={`mt-4 pt-4 border-t flex items-center justify-between ${isDarkMode ? 'border-team-blue-40' : 'border-gray-100'}`}
        >
          <span
            className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
          >
            Total Average
          </span>
          <span className="text-lg font-bold text-team-blue">
            {stats.avgScore} pts
          </span>
        </div>
      </Section>

      {/* Score Trend */}
      {matches.length >= 2 && (
        <Section title="Score Trend" isDarkMode={isDarkMode}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
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
              <Tooltip content={<ChartTooltip isDarkMode={isDarkMode} />} />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              <Line
                type="monotone"
                dataKey="Final Score"
                stroke={CHART_COLORS.primary}
                strokeWidth={3}
                dot={{ fill: CHART_COLORS.primary, r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Autonomous"
                stroke={CHART_COLORS.auto}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.auto, r: 3 }}
                strokeDasharray="5 5"
              />
              <Line
                type="monotone"
                dataKey="Teleop"
                stroke={CHART_COLORS.tele}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.tele, r: 3 }}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Score Composition */}
      {matches.length >= 2 && (
        <Section title="Score Composition by Match" isDarkMode={isDarkMode}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={compositionData}>
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
                content={<ChartTooltip isDarkMode={isDarkMode} />}
                cursor={{ fill: 'transparent' }}
              />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              <Bar
                dataKey="Autonomous"
                stackId="a"
                fill={CHART_COLORS.auto}
                radius={[0, 0, 0, 0]}
                activeBar={{
                  stroke: isDarkMode ? '#fff' : '#000',
                  strokeWidth: 2,
                }}
              />
              <Bar
                dataKey="Teleop"
                stackId="a"
                fill={CHART_COLORS.tele}
                radius={[0, 0, 0, 0]}
                activeBar={{
                  stroke: isDarkMode ? '#fff' : '#000',
                  strokeWidth: 2,
                }}
              />
              <Bar
                dataKey="Endgame"
                stackId="a"
                fill={CHART_COLORS.endgame}
                radius={[4, 4, 0, 0]}
                activeBar={{
                  stroke: isDarkMode ? '#fff' : '#000',
                  strokeWidth: 2,
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Missed Balls */}
      {matches.some(
        m => (m.autonBallsMissed || 0) + (m.teleBallsMissed || 0) > 0
      ) && (
        <Section title="Balls Missed" isDarkMode={isDarkMode}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={missedData}>
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
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltip isDarkMode={isDarkMode} />}
                cursor={{ fill: 'transparent' }}
              />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              <Bar
                dataKey="Auto Missed"
                fill={CHART_COLORS.missed}
                radius={[4, 4, 0, 0]}
                activeBar={{
                  stroke: isDarkMode ? '#fff' : '#000',
                  strokeWidth: 2,
                }}
              />
              <Bar
                dataKey="Teleop Missed"
                fill="#f97316"
                radius={[4, 4, 0, 0]}
                activeBar={{
                  stroke: isDarkMode ? '#fff' : '#000',
                  strokeWidth: 2,
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — Match Details
// ═══════════════════════════════════════════════════════════════════════════

const MatchDetailTab = ({
  matches,
  isDarkMode,
}: {
  matches: Match[];
  isDarkMode: boolean;
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (matches.length > 0 && selectedIdx >= matches.length) {
      setSelectedIdx(Math.max(0, matches.length - 1));
    }
  }, [matches.length, selectedIdx]);

  const match = matches[selectedIdx];
  if (!match) return null;

  const totalScore = match.finalScore || 0;
  const avgFinal =
    matches.reduce((s, m) => s + (m.finalScore || 0), 0) / matches.length;
  const diffFromAvg = totalScore - avgFinal;

  const breakdownRows = [
    {
      phase: 'Autonomous',
      classified: match.autonClassifiedArtifact || 0,
      overflow: match.autonOverflowArtifact || 0,
      motifs: match.autonMotif || 0,
      missed: match.autonBallsMissed || 0,
      extra: match.autonLeave || 0,
      extraLabel: 'Leave',
      total: match.autonomousScore || 0,
      color: CHART_COLORS.auto,
    },
    {
      phase: 'Teleop',
      classified: match.teleClassifiedArtifact || 0,
      overflow: match.teleOverflowArtifact || 0,
      motifs: match.teleMotif || 0,
      missed: match.teleBallsMissed || 0,
      extra: null,
      extraLabel: '-',
      total: match.teleopScore || 0,
      color: CHART_COLORS.tele,
    },
    {
      phase: 'Endgame',
      classified: null,
      overflow: null,
      motifs: null,
      missed: null,
      extra: match.endGameScore || 0,
      extraLabel: 'Park/Hang',
      total: match.endGameScore || 0,
      color: CHART_COLORS.endgame,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Match selector */}
      <div
        className={`flex items-center justify-between rounded-xl border p-4 ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`}
      >
        <button
          onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}
          disabled={selectedIdx === 0}
          className={`p-2 rounded-lg transition-colors ${
            selectedIdx === 0
              ? 'opacity-30 cursor-not-allowed'
              : 'hover:bg-team-blue/10'
          }`}
        >
          <ChevronLeft size={20} className="text-team-blue" />
        </button>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          {matches.map((_, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                i === selectedIdx
                  ? isDarkMode
                    ? 'bg-team-blue text-black shadow-md'
                    : 'bg-team-blue text-black shadow-md'
                  : isDarkMode
                    ? 'bg-team-dark text-team-white-60 hover:bg-team-blue/20'
                    : 'bg-gray-100 text-gray-600 hover:bg-team-blue/10'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <button
          onClick={() =>
            setSelectedIdx(Math.min(matches.length - 1, selectedIdx + 1))
          }
          disabled={selectedIdx === matches.length - 1}
          className={`p-2 rounded-lg transition-colors ${
            selectedIdx === matches.length - 1
              ? 'opacity-30 cursor-not-allowed'
              : 'hover:bg-team-blue/10'
          }`}
        >
          <ChevronRight size={20} className="text-team-blue" />
        </button>
      </div>

      {/* Match score hero */}
      <div
        className={`rounded-xl border p-6 ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`}
      >
        <div className="text-center">
          <p
            className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
          >
            Match {match.matchNumber} &middot; {match.matchType || 'Full Game'}
          </p>
          <p className="text-5xl font-bold text-team-blue mt-2">{totalScore}</p>
          <p
            className={`text-sm mt-1 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
          >
            points scored
          </p>
          {matches.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <TrendIcon value={diffFromAvg} />
              <span
                className={`text-sm font-medium ${
                  diffFromAvg >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {diffStr(Math.round(diffFromAvg))} vs session avg
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Phase scores */}
      <div className="grid grid-cols-3 gap-4">
        {breakdownRows.map(row => (
          <div
            key={row.phase}
            className={`rounded-xl border p-4 text-center ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`}
          >
            <div
              className="w-3 h-3 rounded-full mx-auto mb-2"
              style={{ backgroundColor: row.color }}
            />
            <p
              className={`text-xs font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
            >
              {row.phase}
            </p>
            <p className="text-2xl font-bold text-team-blue mt-1">
              {row.total}
            </p>
          </div>
        ))}
      </div>

      {/* Detailed scoring table */}
      <Section title="Scoring Breakdown" isDarkMode={isDarkMode}>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr
                className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
              >
                {[
                  'Phase',
                  'Classified',
                  'Overflow',
                  'Motifs',
                  'Missed',
                  'Extra',
                  'Total',
                ].map(h => (
                  <th
                    key={h}
                    className={`py-3 px-3 font-semibold text-xs uppercase tracking-wide ${
                      h === 'Phase' ? 'text-left' : 'text-center'
                    } ${isDarkMode ? 'text-white' : 'text-gray-700'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {breakdownRows.map(row => (
                <tr
                  key={row.phase}
                  className={`border-b last:border-0 ${isDarkMode ? 'border-team-blue-40' : 'border-gray-100'}`}
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      <span
                        className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                      >
                        {row.phase}
                      </span>
                    </div>
                  </td>
                  <td
                    className={`text-center py-3 px-3 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    {row.classified !== null ? row.classified : '—'}
                  </td>
                  <td
                    className={`text-center py-3 px-3 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    {row.overflow !== null ? row.overflow : '—'}
                  </td>
                  <td
                    className={`text-center py-3 px-3 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    {row.motifs !== null ? row.motifs : '—'}
                  </td>
                  <td className="text-center py-3 px-3">
                    {row.missed !== null ? (
                      <span
                        className={
                          row.missed > 0
                            ? 'text-red-500 font-medium'
                            : isDarkMode
                              ? 'text-team-white-60'
                              : 'text-gray-600'
                        }
                      >
                        {row.missed}
                      </span>
                    ) : (
                      <span
                        className={
                          isDarkMode ? 'text-team-white-60' : 'text-gray-400'
                        }
                      >
                        —
                      </span>
                    )}
                  </td>
                  <td
                    className={`text-center py-3 px-3 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    {row.extra !== null ? row.extra : '—'}
                  </td>
                  <td className="text-center py-3 px-3 font-bold text-team-blue">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                className={`border-t ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
              >
                <td
                  colSpan={5}
                  className={`py-3 px-3 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  Total Match Score
                </td>
                <td />
                <td className="text-center py-3 px-3 text-lg font-bold text-team-blue">
                  {totalScore}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      {/* Cycle times */}
      {match.cycleTimes && match.cycleTimes.length > 0 && (
        <Section title="Cycle Times" isDarkMode={isDarkMode}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
            {match.cycleTimes.map((time, i) => (
              <div
                key={i}
                className={`rounded-lg p-3 text-center border ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gray-50 border-gray-200'}`}
              >
                <p
                  className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
                >
                  Cycle {i + 1}
                </p>
                <p
                  className={`text-lg font-bold mt-0.5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  {fmtTime(time)}
                </p>
              </div>
            ))}
          </div>
          {match.cycleTimes.length > 1 && (
            <>
              <div
                className={`flex items-center justify-between p-3 rounded-lg ${isDarkMode ? 'bg-team-blue/10 border border-team-blue-40' : 'bg-team-blue/5 border border-gray-200'}`}
              >
                <span
                  className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  Average Cycle Time
                </span>
                <span className="text-lg font-bold text-team-blue">
                  {fmtTime(
                    match.cycleTimes.reduce((a, b) => a + b, 0) /
                      match.cycleTimes.length
                  )}
                </span>
              </div>
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={match.cycleTimes.map((time, idx) => ({
                      cycle: `#${idx + 1}`,
                      Time: time,
                    }))}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'}
                    />
                    <XAxis
                      dataKey="cycle"
                      stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                      tick={{ fontSize: 11 }}
                      label={{
                        value: 'Seconds',
                        angle: -90,
                        position: 'insideLeft',
                        style: { fontSize: 11 },
                      }}
                    />
                    <Tooltip
                      content={<ChartTooltip isDarkMode={isDarkMode} />}
                    />
                    <Line
                      type="monotone"
                      dataKey="Time"
                      stroke={CHART_COLORS.purple}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS.purple, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Section>
      )}

      {/* Vs Session Average Chart */}
      {matches.length > 1 && (
        <Section title="This Match vs Session Average" isDarkMode={isDarkMode}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={[
                {
                  name: 'Autonomous',
                  'This Match': match.autonomousScore || 0,
                  'Session Avg': Math.round(
                    matches.reduce((s, m) => s + (m.autonomousScore || 0), 0) /
                      matches.length
                  ),
                },
                {
                  name: 'Teleop',
                  'This Match': match.teleopScore || 0,
                  'Session Avg': Math.round(
                    matches.reduce((s, m) => s + (m.teleopScore || 0), 0) /
                      matches.length
                  ),
                },
                {
                  name: 'Endgame',
                  'This Match': match.endGameScore || 0,
                  'Session Avg': Math.round(
                    matches.reduce((s, m) => s + (m.endGameScore || 0), 0) /
                      matches.length
                  ),
                },
              ]}
            >
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
                content={<ChartTooltip isDarkMode={isDarkMode} />}
                cursor={{ fill: 'transparent' }}
              />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              <Bar
                dataKey="This Match"
                fill={CHART_COLORS.primary}
                radius={[4, 4, 0, 0]}
                activeBar={{
                  stroke: isDarkMode ? '#fff' : '#000',
                  strokeWidth: 2,
                }}
              />
              <Bar
                dataKey="Session Avg"
                fill={CHART_COLORS.secondary}
                radius={[4, 4, 0, 0]}
                activeBar={{
                  stroke: isDarkMode ? '#fff' : '#000',
                  strokeWidth: 2,
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — Compare
// ═══════════════════════════════════════════════════════════════════════════

interface CompareMetric {
  label: string;
  a: number;
  b: number;
  higherIsBetter: boolean;
}

const CompareTab = ({
  matches,
  isDarkMode,
}: {
  matches: Match[];
  isDarkMode: boolean;
}) => {
  const [idxA, setIdxA] = useState(0);
  const [idxB, setIdxB] = useState(Math.min(1, matches.length - 1));

  useEffect(() => {
    if (matches.length > 0) {
      if (idxA >= matches.length) {
        setIdxA(Math.max(0, matches.length - 1));
      }
      if (idxB >= matches.length) {
        setIdxB(Math.max(0, matches.length - 1));
      }
    }
  }, [matches.length, idxA, idxB]);

  if (matches.length < 2) {
    return (
      <div
        className={`text-center py-16 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-gray-50'}`}
      >
        <ArrowRightLeft
          size={40}
          className={`mx-auto mb-3 ${isDarkMode ? 'text-team-white-60' : 'text-gray-400'}`}
        />
        <p
          className={`text-lg font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
        >
          Need at least 2 matches to compare
        </p>
      </div>
    );
  }

  const mA = matches[idxA];
  const mB = matches[idxB];

  const metrics: CompareMetric[] = [
    {
      label: 'Final Score',
      a: mA.finalScore || 0,
      b: mB.finalScore || 0,
      higherIsBetter: true,
    },
    {
      label: 'Autonomous',
      a: mA.autonomousScore || 0,
      b: mB.autonomousScore || 0,
      higherIsBetter: true,
    },
    {
      label: 'Teleop',
      a: mA.teleopScore || 0,
      b: mB.teleopScore || 0,
      higherIsBetter: true,
    },
    {
      label: 'Endgame',
      a: mA.endGameScore || 0,
      b: mB.endGameScore || 0,
      higherIsBetter: true,
    },
    {
      label: 'Classified (Auto)',
      a: mA.autonClassifiedArtifact || 0,
      b: mB.autonClassifiedArtifact || 0,
      higherIsBetter: true,
    },
    {
      label: 'Classified (Teleop)',
      a: mA.teleClassifiedArtifact || 0,
      b: mB.teleClassifiedArtifact || 0,
      higherIsBetter: true,
    },
    {
      label: 'Overflow (Auto)',
      a: mA.autonOverflowArtifact || 0,
      b: mB.autonOverflowArtifact || 0,
      higherIsBetter: true,
    },
    {
      label: 'Overflow (Teleop)',
      a: mA.teleOverflowArtifact || 0,
      b: mB.teleOverflowArtifact || 0,
      higherIsBetter: true,
    },
    {
      label: 'Motifs (Auto)',
      a: mA.autonMotif || 0,
      b: mB.autonMotif || 0,
      higherIsBetter: true,
    },
    {
      label: 'Motifs (Teleop)',
      a: mA.teleMotif || 0,
      b: mB.teleMotif || 0,
      higherIsBetter: true,
    },
    {
      label: 'Balls Missed (Auto)',
      a: mA.autonBallsMissed || 0,
      b: mB.autonBallsMissed || 0,
      higherIsBetter: false,
    },
    {
      label: 'Balls Missed (Teleop)',
      a: mA.teleBallsMissed || 0,
      b: mB.teleBallsMissed || 0,
      higherIsBetter: false,
    },
  ];

  const chartData = [
    {
      name: `Match ${mA.matchNumber}`,
      Autonomous: mA.autonomousScore || 0,
      Teleop: mA.teleopScore || 0,
      Endgame: mA.endGameScore || 0,
    },
    {
      name: `Match ${mB.matchNumber}`,
      Autonomous: mB.autonomousScore || 0,
      Teleop: mB.teleopScore || 0,
      Endgame: mB.endGameScore || 0,
    },
  ];

  const scoreDiff = (mB.finalScore || 0) - (mA.finalScore || 0);

  return (
    <div className="space-y-6">
      {/* Selectors */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border p-5 ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`}
      >
        <div>
          <label
            className={`block text-xs font-medium uppercase tracking-wide mb-2 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
          >
            Match A
          </label>
          <select
            value={idxA}
            onChange={e => setIdxA(Number(e.target.value))}
            className={`w-full px-4 py-2.5 rounded-lg border text-sm font-medium ${
              isDarkMode
                ? 'bg-team-dark border-team-blue-40 text-white'
                : 'bg-white border-gray-200 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-team-blue`}
          >
            {matches.map((m, i) => (
              <option key={i} value={i}>
                Match {m.matchNumber} — {m.finalScore || 0} pts
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className={`block text-xs font-medium uppercase tracking-wide mb-2 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
          >
            Match B
          </label>
          <select
            value={idxB}
            onChange={e => setIdxB(Number(e.target.value))}
            className={`w-full px-4 py-2.5 rounded-lg border text-sm font-medium ${
              isDarkMode
                ? 'bg-team-dark border-team-blue-40 text-white'
                : 'bg-white border-gray-200 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-team-blue`}
          >
            {matches.map((m, i) => (
              <option key={i} value={i}>
                Match {m.matchNumber} — {m.finalScore || 0} pts
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Score diff hero */}
      <div
        className={`rounded-xl border p-6 text-center ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`}
      >
        <p
          className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
        >
          Score Difference (B vs A)
        </p>
        <div className="flex items-center justify-center gap-3 mt-2">
          <TrendIcon value={scoreDiff} size={28} />
          <span
            className={`text-4xl font-bold ${scoreDiff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
          >
            {diffStr(scoreDiff)}
          </span>
        </div>
        <p
          className={`text-sm mt-2 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
        >
          {mA.finalScore || 0} pts vs {mB.finalScore || 0} pts
        </p>
      </div>

      {/* Stacked bar comparison */}
      <Section title="Score Composition" isDarkMode={isDarkMode}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barGap={20}>
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
              content={<ChartTooltip isDarkMode={isDarkMode} />}
              cursor={{ fill: 'transparent' }}
            />
            <Legend wrapperStyle={{ fontSize: '13px' }} />
            <Bar
              dataKey="Autonomous"
              stackId="s"
              fill={CHART_COLORS.auto}
              activeBar={{
                stroke: isDarkMode ? '#fff' : '#000',
                strokeWidth: 2,
              }}
            />
            <Bar
              dataKey="Teleop"
              stackId="s"
              fill={CHART_COLORS.tele}
              activeBar={{
                stroke: isDarkMode ? '#fff' : '#000',
                strokeWidth: 2,
              }}
            />
            <Bar
              dataKey="Endgame"
              stackId="s"
              fill={CHART_COLORS.endgame}
              radius={[4, 4, 0, 0]}
              activeBar={{
                stroke: isDarkMode ? '#fff' : '#000',
                strokeWidth: 2,
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      {/* Metrics table */}
      <Section title="Full Comparison" isDarkMode={isDarkMode}>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr
                className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
              >
                <th
                  className={`text-left py-3 px-3 text-xs uppercase tracking-wide font-semibold ${isDarkMode ? 'text-white' : 'text-gray-700'}`}
                >
                  Metric
                </th>
                <th
                  className={`text-center py-3 px-3 text-xs uppercase tracking-wide font-semibold ${isDarkMode ? 'text-white' : 'text-gray-700'}`}
                >
                  Match {mA.matchNumber}
                </th>
                <th
                  className={`text-center py-3 px-3 text-xs uppercase tracking-wide font-semibold ${isDarkMode ? 'text-white' : 'text-gray-700'}`}
                >
                  Match {mB.matchNumber}
                </th>
                <th
                  className={`text-center py-3 px-3 text-xs uppercase tracking-wide font-semibold ${isDarkMode ? 'text-white' : 'text-gray-700'}`}
                >
                  Diff
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(row => {
                const diff = row.b - row.a;
                const isGood = row.higherIsBetter ? diff >= 0 : diff <= 0;
                return (
                  <tr
                    key={row.label}
                    className={`border-b last:border-0 ${isDarkMode ? 'border-team-blue-40' : 'border-gray-100'}`}
                  >
                    <td
                      className={`py-3 px-3 font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                    >
                      {row.label}
                    </td>
                    <td
                      className={`text-center py-3 px-3 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                    >
                      {row.a}
                    </td>
                    <td
                      className={`text-center py-3 px-3 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                    >
                      {row.b}
                    </td>
                    <td
                      className={`text-center py-3 px-3 font-semibold ${
                        diff === 0
                          ? isDarkMode
                            ? 'text-team-white-60'
                            : 'text-gray-400'
                          : isGood
                            ? 'text-emerald-500'
                            : 'text-red-500'
                      }`}
                    >
                      {diffStr(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'summary', label: 'Summary', icon: BarChart3 },
  { id: 'matches', label: 'Match Details', icon: LayoutList },
  { id: 'compare', label: 'Compare', icon: ArrowRightLeft },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * SharedSession page - displays full session analysis without requiring authentication
 * Session data is loaded from URL parameters
 */
const SharedSession = () => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [session, setSession] = useState<Partial<Session> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('summary');

  useEffect(() => {
    const loadSharedSession = async () => {
      try {
        setLoading(true);
        setError(null);

        // Decode session data from URL
        const urlParams = new URLSearchParams(window.location.search);
        const encodedData = urlParams.get('data');

        if (encodedData) {
          // Session data is embedded in the URL (Unicode-safe decode)
          const decodedData = JSON.parse(decodeURIComponent(escape(atob(encodedData))));
          setSession(decodedData);
        } else {
          setError('No session data found in the link.');
        }
      } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error loading shared session', err);
        setError(
          'Failed to load session data. The link may be invalid or expired.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadSharedSession();
  }, []);

  // Calculate session statistics
  const stats = useMemo(() => {
    if (!session?.matches || session.matches.length === 0) return null;
    return computeStats(session.matches);
  }, [session]);

  const sessionMatches = session?.matches || [];

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'
        }`}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-team-blue" />
          <p
            className={`text-lg ${
              isDarkMode ? 'text-team-white-60' : 'text-gray-600'
            }`}
          >
            Loading session...
          </p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-4 ${
          isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'
        }`}
      >
        <div
          className={`max-w-lg w-full rounded-xl border p-6 ${
            isDarkMode
              ? 'bg-team-dark-20 border-team-blue-40'
              : 'bg-white border-gray-200'
          }`}
        >
          <h2
            className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-team-white' : 'text-gray-900'}`}
          >
            Session Not Found
          </h2>
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {error || 'Unable to load session data'}
            </AlertDescription>
          </Alert>
          <Link to="/">
            <Button className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1152px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h1 className="text-team-blue text-3xl sm:text-4xl font-bold leading-tight">
            {session.sessionName || 'Session'} Analysis
          </h1>
          <div
            className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
          >
            {session.matchType && <span>{session.matchType}</span>}
            {session.sessionDuration && <span>{session.sessionDuration}</span>}
            <span>
              {sessionMatches.length} match
              {sessionMatches.length !== 1 ? 'es' : ''}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-team-blue/20 text-team-blue">
              Shared Session
            </span>
          </div>
        </div>

        {/* ── Hero stats ──────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              label="Avg Score"
              value={stats.avgScore}
              sublabel={`${stats.totalMatches} matches`}
              icon={Trophy}
              isDarkMode={isDarkMode}
            />
            <StatCard
              label="Best"
              value={stats.maxScore}
              sublabel={`Match ${sessionMatches[stats.bestMatch]?.matchNumber ?? ''}`}
              icon={Target}
              isDarkMode={isDarkMode}
            />
            <StatCard
              label="Worst"
              value={stats.minScore}
              sublabel={`Match ${sessionMatches[stats.worstMatch]?.matchNumber ?? ''}`}
              icon={TrendingDown}
              isDarkMode={isDarkMode}
            />
            <StatCard
              label="Avg Missed"
              value={stats.avgMissed}
              icon={AlertTriangle}
              isDarkMode={isDarkMode}
            />
            <StatCard
              label="Consistency"
              value={`${stats.consistency}%`}
              icon={Timer}
              isDarkMode={isDarkMode}
            />
          </div>
        )}

        {/* ── Notes ───────────────────────────────────────────────── */}
        {session.notes && (
          <div
            className={`rounded-xl border p-5 ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`}
          >
            <h3
              className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              Notes
            </h3>
            <p
              className={`text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              {session.notes}
            </p>
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────── */}
        {sessionMatches.length > 0 && (
          <>
            <div
              className={`flex gap-1 p-1 rounded-xl ${isDarkMode ? 'bg-team-dark-20' : 'bg-gray-100'}`}
            >
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? isDarkMode
                          ? 'bg-team-dark text-team-blue shadow-sm'
                          : 'bg-white text-team-blue shadow-sm'
                        : isDarkMode
                          ? 'text-team-white-60 hover:text-white'
                          : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div>
              {activeTab === 'summary' && stats && (
                <SummaryTab
                  matches={sessionMatches}
                  stats={stats}
                  isDarkMode={isDarkMode}
                />
              )}
              {activeTab === 'matches' && (
                <MatchDetailTab
                  matches={sessionMatches}
                  isDarkMode={isDarkMode}
                />
              )}
              {activeTab === 'compare' && (
                <CompareTab matches={sessionMatches} isDarkMode={isDarkMode} />
              )}
            </div>
          </>
        )}

        {/* Empty state */}
        {sessionMatches.length === 0 && (
          <div
            className={`text-center py-16 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-gray-50'}`}
          >
            <BarChart3
              size={40}
              className={`mx-auto mb-3 ${isDarkMode ? 'text-team-white-60' : 'text-gray-400'}`}
            />
            <p
              className={`text-lg font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
            >
              No matches recorded in this session
            </p>
          </div>
        )}

        {/* ── Call to Action ──────────────────────────────────────── */}
        {!user && (
          <div
            className={`rounded-xl border p-8 ${
              isDarkMode
                ? 'bg-gradient-to-br from-team-blue-20 to-team-dark-20 border-team-blue-40'
                : 'bg-gradient-to-br from-blue-50 to-white border-blue-200'
            }`}
          >
            <div className="text-center space-y-4">
              <h3
                className={`text-xl font-bold ${
                  isDarkMode ? 'text-team-white' : 'text-gray-900'
                }`}
              >
                Want to track your own sessions?
              </h3>
              <p
                className={isDarkMode ? 'text-team-white-60' : 'text-gray-600'}
              >
                Create a free account to start tracking and analyzing your
                team's performance.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                <Link to="/signup">
                  <Button
                    className={`w-full sm:w-56 bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
                  >
                    Sign Up Free
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" className="w-full sm:w-56">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedSession;
