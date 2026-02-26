

/* eslint-disable react-refresh/only-export-components */

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  ArrowRightLeft,
  LayoutList,
  Edit,
  Trash2,
  Plus,
  ChevronLeft,
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
  ReferenceLine,
} from 'recharts';
import type { Match } from '@/types';
import { formatTime } from '@/lib';

/** Compute +/- diff string */
const formatDiff = (val: number) => (val > 0 ? `+${val}` : `${val}`);

/** Trend icon based on positive/negative/zero */
const TrendIcon = ({
  value,
  size = 16,
}: {
  value: number;
  size?: number;
}) => {
  if (value > 0) return <TrendingUp size={size} className="text-emerald-500" />;
  if (value < 0)
    return <TrendingDown size={size} className="text-red-500" />;
  return <Minus size={size} className="text-gray-400" />;
};

const ChartTooltip = ({
  active,
  payload,
  label,
  isDarkMode,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  isDarkMode?: boolean;
  unit?: string;
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
                ? unit
                  ? `${Math.round(entry.value)}${unit}`
                  : entry.value.toFixed(1)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const StatCard = ({
  label,
  value,
  sublabel,
  icon: Icon,
  highlight,
  variant = 'default',
  isDarkMode,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ElementType;
  highlight?: boolean;
  variant?: 'default' | 'success' | 'danger';
  isDarkMode: boolean;
}) => {
  const borderBg =
    variant === 'success'
      ? isDarkMode
        ? 'border-emerald-500/40 bg-emerald-500/10'
        : 'border-emerald-200 bg-emerald-50'
      : variant === 'danger'
        ? isDarkMode
          ? 'border-red-500/40 bg-red-500/10'
          : 'border-red-200 bg-red-50'
        : highlight
          ? isDarkMode
            ? 'border-team-blue bg-team-blue/10'
            : 'border-team-blue bg-team-blue/5'
          : isDarkMode
            ? 'border-team-blue-40 bg-team-dark-20'
            : 'border-gray-200 bg-white';

  const valueColor =
    variant === 'success'
      ? 'text-emerald-500'
      : variant === 'danger'
        ? 'text-red-500'
        : 'text-team-blue';

  return (
    <div className={`rounded-xl border p-5 transition-all ${borderBg}`}>
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
          <p className={`text-3xl font-bold ${valueColor} mt-1`}>{value}</p>
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
};

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

export interface SessionStats {
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

export const computeStats = (matches: Match[]): SessionStats | null => {
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

const CHART_COLORS = {
  auto: '#10b981',     // emerald  – Autonomous
  tele: '#f59e0b',     // amber    – Teleop
  endgame: '#0ea5e9',  // sky blue – Endgame
  primary: '#537788',  // steel    – Final Score / Overall
  secondary: '#7ba8ba',// muted steel – Session Avg bars
  missed: '#ef4444',   // red      – Missed balls
  purple: '#a855f7',   // purple   – Cycle time
  shot: '#3b82f6',     // blue     – Balls Shot
  made: '#10b981',     // emerald  – Balls Made
  missedAuto: '#ef4444', // red    – Auto Missed
  missedTele: '#f97316', // orange – Teleop Missed
};

export type TabId = 'summary' | 'matches' | 'compare';

export const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'summary', label: 'Summary', icon: BarChart3 },
  { id: 'matches', label: 'Match Details', icon: LayoutList },
  { id: 'compare', label: 'Compare', icon: ArrowRightLeft },
];

export const SummaryTab = ({
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

  const [ballsView, setBallsView] = useState<'shot' | 'made' | 'missed'>('shot');

  const ballsShotData = matches.map((m, i) => {
    const autonShot = (m.autonShots || []).reduce((s, e) => s + e.ballsShot, 0);
    const teleShot = (m.teleopShots || []).reduce((s, e) => s + e.ballsShot, 0);
    return { name: `M${i + 1}`, 'Auto Balls': autonShot, 'Teleop Balls': teleShot };
  });
  const ballsMadeData = matches.map((m, i) => {
    const autonMade = (m.autonShots || []).reduce((s, e) => s + e.ballsMade, 0);
    const teleMade = (m.teleopShots || []).reduce((s, e) => s + e.ballsMade, 0);
    return { name: `M${i + 1}`, 'Auto Balls': autonMade, 'Teleop Balls': teleMade };
  });
  const ballsMissedData = matches.map((m, i) => ({
    name: `M${i + 1}`,
    'Auto Balls': m.autonBallsMissed || 0,
    'Teleop Balls': m.teleBallsMissed || 0,
  }));

  const activeBallsData =
    ballsView === 'shot' ? ballsShotData
    : ballsView === 'made' ? ballsMadeData
    : ballsMissedData;

  const hasAnyBallsData =
    ballsShotData.some(d => d['Auto Balls'] + d['Teleop Balls'] > 0) ||
    ballsMissedData.some(d => d['Auto Balls'] + d['Teleop Balls'] > 0);

  // Compute a single fixed Y-axis max across ALL three views so scale is constant
  const ballsYMax = (() => {
    const allValues = [
      ...ballsShotData.flatMap(d => [d['Auto Balls'], d['Teleop Balls']]),
      ...ballsMadeData.flatMap(d => [d['Auto Balls'], d['Teleop Balls']]),
      ...ballsMissedData.flatMap(d => [d['Auto Balls'], d['Teleop Balls']]),
    ];
    const max = Math.max(0, ...allValues);
    return Math.ceil((max + 1) / 5) * 5;
  })();

  const accuracyData = matches.map((m, i) => {
    const autonMade = (m.autonShots || []).reduce((s, e) => s + e.ballsMade, 0);
    const autonShot = (m.autonShots || []).reduce((s, e) => s + e.ballsShot, 0);
    const teleMade = (m.teleopShots || []).reduce((s, e) => s + e.ballsMade, 0);
    const teleShot = (m.teleopShots || []).reduce((s, e) => s + e.ballsShot, 0);
    const totalMade = autonMade + teleMade;
    const totalShot = autonShot + teleShot;
    return {
      name: `M${i + 1}`,
      Overall: totalShot > 0 ? Math.round((totalMade / totalShot) * 100) : null,
      Autonomous:
        autonShot > 0 ? Math.round((autonMade / autonShot) * 100) : null,
      Teleop: teleShot > 0 ? Math.round((teleMade / teleShot) * 100) : null,
    };
  });

  const hasAnyAccuracyData = accuracyData.some(d => d.Overall !== null);

  const cycleTimeData = matches
    .map((m, i) => {
      if (!m.cycleTimes || m.cycleTimes.length === 0) return null;
      const avg = m.cycleTimes.reduce((a, b) => a + b, 0) / m.cycleTimes.length;
      return { name: `M${i + 1}`, 'Avg Cycle': avg };
    })
    .filter((d): d is { name: string; 'Avg Cycle': number } => d !== null);

  const sessionMatchType = matches[0]?.matchType ?? 'Full Game';
  const showAuto = sessionMatchType !== 'Teleop';
  const showTele = sessionMatchType !== 'Autonomous';
  const showEndgame = sessionMatchType !== 'Autonomous';

  const totalAvg =
    (showAuto ? stats.avgAuto : 0) +
    (showTele ? stats.avgTele : 0) +
    (showEndgame ? stats.avgEndgame : 0);

  // Custom dot renderer – highlight best (green) and worst (red) match
  const ScoringDot = (props: {
    cx?: number;
    cy?: number;
    index?: number;
    fill?: string;
  }) => {
    const { cx = 0, cy = 0, index = 0, fill = CHART_COLORS.primary } = props;
    if (index === stats.bestMatch)
      return (
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill="#10b981"
          stroke="white"
          strokeWidth={2}
        />
      );
    if (index === stats.worstMatch)
      return (
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill="#ef4444"
          stroke="white"
          strokeWidth={2}
        />
      );
    return <circle cx={cx} cy={cy} r={5} fill={fill} />;
  };

  return (
    <div className="space-y-6">
      <Section title="Average Score Breakdown" isDarkMode={isDarkMode}>
        <div className="space-y-4">
          {showAuto && (
            <PhaseBar
              label="Autonomous"
              value={stats.avgAuto}
              max={totalAvg}
              color={CHART_COLORS.auto}
              isDarkMode={isDarkMode}
            />
          )}
          {showTele && (
            <PhaseBar
              label="Teleop"
              value={stats.avgTele}
              max={totalAvg}
              color={CHART_COLORS.tele}
              isDarkMode={isDarkMode}
            />
          )}
          {showEndgame && (
            <PhaseBar
              label="Endgame"
              value={stats.avgEndgame}
              max={totalAvg}
              color={CHART_COLORS.endgame}
              isDarkMode={isDarkMode}
            />
          )}
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

      {matches.length >= 2 && (
        <Section title="Scoring Trends" isDarkMode={isDarkMode}>
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
                dot={<ScoringDot fill={CHART_COLORS.primary} />}
              />
              {showAuto && (
                <Line
                  type="monotone"
                  dataKey="Autonomous"
                  stroke={CHART_COLORS.auto}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.auto, r: 3 }}
                  strokeDasharray="5 5"
                />
              )}
              {showTele && (
                <Line
                  type="monotone"
                  dataKey="Teleop"
                  stroke={CHART_COLORS.tele}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.tele, r: 3 }}
                  strokeDasharray="5 5"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </Section>
      )}

      {hasAnyBallsData && (
        <Section
          title={
            ballsView === 'shot' ? 'Balls Shot' :
            ballsView === 'made' ? 'Balls Made' :
            'Balls Missed'
          }
          isDarkMode={isDarkMode}
        >
          <div
            className={`flex gap-1 p-1 rounded-lg mb-4 w-fit ${
              isDarkMode ? 'bg-team-dark' : 'bg-gray-100'
            }`}
          >
            {(['shot', 'made', 'missed'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setBallsView(mode)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                  ballsView === mode
                    ? isDarkMode
                      ? `bg-team-blue text-black shadow-sm`
                      : `bg-team-blue text-white shadow-sm`
                    : isDarkMode
                      ? 'text-team-white-60 hover:text-white'
                      : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {mode === 'shot' ? 'Balls Shot' : mode === 'made' ? 'Balls Made' : 'Balls Missed'}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={activeBallsData}>
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
                domain={[0, ballsYMax]}
              />
              <Tooltip
                content={<ChartTooltip isDarkMode={isDarkMode} />}
                cursor={{ fill: 'transparent' }}
              />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              {showAuto && (
                <Bar
                  dataKey="Auto Balls"
                  fill={
                    ballsView === 'shot' ? CHART_COLORS.shot
                    : ballsView === 'made' ? CHART_COLORS.made
                    : CHART_COLORS.missedAuto
                  }
                  radius={[4, 4, 0, 0]}
                  activeBar={{ stroke: isDarkMode ? '#fff' : '#000', strokeWidth: 2 }}
                />
              )}
              {showTele && (
                <Bar
                  dataKey="Teleop Balls"
                  fill={
                    ballsView === 'shot' ? '#93c5fd'   /* light blue for Teleop Shot */
                    : ballsView === 'made' ? '#6ee7b7'  /* light emerald for Teleop Made */
                    : CHART_COLORS.missedTele
                  }
                  radius={[4, 4, 0, 0]}
                  activeBar={{ stroke: isDarkMode ? '#fff' : '#000', strokeWidth: 2 }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {hasAnyAccuracyData && (
        <Section title="Shooting Accuracy" isDarkMode={isDarkMode}>
          {matches.length < 2 && (
            <p className={`text-xs mb-3 italic ${isDarkMode ? 'text-team-white-60' : 'text-gray-400'}`}>
              Need a minimum of 2 matches to show a trend line.
            </p>
          )}
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={accuracyData}>
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
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                content={<ChartTooltip isDarkMode={isDarkMode} unit="%" />}
              />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              <ReferenceLine
                y={100}
                stroke={isDarkMode ? '#ffffff20' : '#00000015'}
                strokeDasharray="4 4"
              />
              {matches.length >= 2 && (
                <>
                  <Line
                    type="monotone"
                    dataKey="Overall"
                    stroke={isDarkMode ? '#e2e8f0' : CHART_COLORS.primary}
                    strokeWidth={3}
                    dot={{ fill: isDarkMode ? '#e2e8f0' : CHART_COLORS.primary, r: 5 }}
                    strokeDasharray="5 5"
                    connectNulls={false}
                  />
                  {showAuto && (
                    <Line
                      type="monotone"
                      dataKey="Autonomous"
                      stroke={CHART_COLORS.auto}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS.auto, r: 3 }}
                      strokeDasharray="5 5"
                      connectNulls={false}
                    />
                  )}
                  {showTele && (
                    <Line
                      type="monotone"
                      dataKey="Teleop"
                      stroke={CHART_COLORS.tele}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS.tele, r: 3 }}
                      strokeDasharray="5 5"
                      connectNulls={false}
                    />
                  )}
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </Section>
      )}

      {cycleTimeData.length > 0 && (
        <Section title="Average Cycle Time" isDarkMode={isDarkMode}>
          {matches.length < 2 && (
            <p className={`text-xs mb-3 italic ${isDarkMode ? 'text-team-white-60' : 'text-gray-400'}`}>
              Need a minimum of 2 matches to show a trend line.
            </p>
          )}
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={cycleTimeData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDarkMode ? '#2a2a2a' : '#e5e7eb'}
              />
              <XAxis
                dataKey="name"
                stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                tick={false}
              />
              <YAxis
                stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                tick={{ fontSize: 12 }}
                tickFormatter={v => `${v.toFixed(1)}s`}
              />
              <Tooltip
                content={<ChartTooltip isDarkMode={isDarkMode} unit="s" />}
                formatter={value =>
                  typeof value === 'number' ? value.toFixed(2) : String(value)
                }
              />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              {matches.length >= 2 && (
                <Line
                  type="monotone"
                  dataKey="Avg Cycle"
                  name="Avg Cycle Time"
                  stroke={CHART_COLORS.purple}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.purple, r: 4 }}
                  connectNulls={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </Section>
      )}
    </div>
  );
};

export const MatchDetailTab = ({
  matches,
  isDarkMode,
  // Edit/delete/add are optional — omit them for a read-only view
  onEdit,
  onDelete,
  onAdd,
}: {
  matches: Match[];
  isDarkMode: boolean;
  onEdit?: (match: Match) => void;
  onDelete?: (matchId: string) => void;
  onAdd?: () => void;
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (matches.length > 0 && selectedIdx >= matches.length) {
      setSelectedIdx(Math.max(0, matches.length - 1));
    }
  }, [matches.length, selectedIdx]);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timer = setTimeout(() => setConfirmDeleteId(null), 5000);
    return () => clearTimeout(timer);
  }, [confirmDeleteId]);

  const handleDeleteClick = (matchId: string) => {
    if (!onDelete) return;
    if (confirmDeleteId === matchId) {
      onDelete(matchId);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(matchId);
    }
  };

  const match = matches[selectedIdx];
  if (!match) return null;

  const sessionMatchType = match.matchType ?? 'Full Game';
  const showAuto = sessionMatchType !== 'Teleop';
  const showTele = sessionMatchType !== 'Autonomous';
  const showEndgame = sessionMatchType !== 'Autonomous';

  const totalScore = match.finalScore || 0;
  const avgFinal =
    matches.reduce((s, m) => s + (m.finalScore || 0), 0) / matches.length;
  const diffFromAvg = totalScore - avgFinal;

  const matchGateEnabled = match.gateEnabled !== false;

  const breakdownRows = [
    {
      phase: 'Autonomous',
      classified: matchGateEnabled ? (match.autonClassifiedArtifact || 0) : null,
      overflow: matchGateEnabled ? (match.autonOverflowArtifact || 0) : null,
      motifs: match.autonMotif || 0,
      missed: match.autonBallsMissed || 0,
      extra: match.autonLeave || 0,
      extraLabel: 'Leave',
      total: match.autonomousScore || 0,
      color: CHART_COLORS.auto,
    },
    {
      phase: 'Teleop',
      classified: matchGateEnabled ? (match.teleClassifiedArtifact || 0) : null,
      overflow: matchGateEnabled ? (match.teleOverflowArtifact || 0) : null,
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

  const visibleBreakdownRows = breakdownRows.filter(row =>
    (row.phase !== 'Autonomous' || showAuto) &&
    (row.phase !== 'Teleop' || showTele) &&
    (row.phase !== 'Endgame' || showEndgame)
  );

  return (
    <div className="space-y-6">
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
                    ? `bg-team-blue text-black shadow-md`
                    : `bg-team-blue text-white shadow-md`
                  : isDarkMode
                    ? 'bg-team-dark text-team-white-60 hover:bg-team-blue/20'
                    : 'bg-gray-100 text-gray-600 hover:bg-team-blue/10'
              }`}
            >
              {i + 1}
            </button>
          ))}
          {onAdd && (
            <button
              onClick={onAdd}
              className={`w-9 h-9 rounded-lg transition-all flex items-center justify-center ${
                isDarkMode
                  ? 'bg-team-blue/20 text-team-blue hover:bg-team-blue/30'
                  : 'bg-team-blue/10 text-team-blue hover:bg-team-blue/20'
              }`}
              title="Add New Match"
            >
              <Plus size={18} />
            </button>
          )}
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
                {formatDiff(Math.round(diffFromAvg))} vs session avg
              </span>
            </div>
          )}
        </div>

        {(onEdit || onDelete) && (
          <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-team-blue-40">
            {onEdit && (
              <button
                onClick={() => onEdit(match)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode
                    ? 'bg-team-blue/20 text-team-blue hover:bg-team-blue/30'
                    : 'bg-team-blue/10 text-team-blue hover:bg-team-blue/20'
                }`}
              >
                <Edit size={16} />
                Edit Match
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => match.id && handleDeleteClick(match.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  confirmDeleteId === match.id
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : isDarkMode
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-red-50 text-red-600 hover:bg-red-100'
                }`}
              >
                <Trash2 size={16} />
                {confirmDeleteId === match.id ? 'Click to Confirm' : 'Delete Match'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className={`grid gap-4 ${visibleBreakdownRows.length === 1 ? 'grid-cols-1' : visibleBreakdownRows.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {visibleBreakdownRows.map(row => (
          <div
            key={row.phase}
            className="rounded-xl border p-4 text-center"
            style={{
              borderColor: row.color + (isDarkMode ? '66' : '44'),
              backgroundColor: row.color + (isDarkMode ? '14' : '0d'),
            }}
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
            <p className="text-2xl font-bold mt-1" style={{ color: row.color }}>
              {row.total}
            </p>
          </div>
        ))}
      </div>

      <Section title="Scoring Breakdown" isDarkMode={isDarkMode}>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr
                className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
              >
                {[
                  'Phase',
                  ...(matchGateEnabled ? ['Classified', 'Overflow'] : []),
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
              {visibleBreakdownRows.map(row => (
                <tr
                  key={row.phase}
                  className={`border-b last:border-0 ${isDarkMode ? 'border-team-blue-40' : 'border-gray-100'}`}
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-1 h-8 rounded-full flex-shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      <span
                        className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                      >
                        {row.phase}
                      </span>
                    </div>
                  </td>
                  {matchGateEnabled && <td
                    className={`text-center py-3 px-3 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    {row.classified !== null ? row.classified : '—'}
                  </td>}
                  {matchGateEnabled && <td
                    className={`text-center py-3 px-3 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    {row.overflow !== null ? row.overflow : '—'}
                  </td>}
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
                  <td
                    className="text-center py-3 px-3 font-bold"
                    style={{ color: row.color }}
                  >
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
                  colSpan={matchGateEnabled ? 5 : 3}
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
                  {formatTime(time)}
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
                  {formatTime(
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

      {matches.length > 1 && (
        <Section title="This Match vs Session Average" isDarkMode={isDarkMode}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={[
                ...(showAuto ? [{
                  name: 'Autonomous',
                  'This Match': match.autonomousScore || 0,
                  'Session Avg': Math.round(
                    matches.reduce((s, m) => s + (m.autonomousScore || 0), 0) /
                      matches.length
                  ),
                }] : []),
                ...(showTele ? [{
                  name: 'Teleop',
                  'This Match': match.teleopScore || 0,
                  'Session Avg': Math.round(
                    matches.reduce((s, m) => s + (m.teleopScore || 0), 0) /
                      matches.length
                  ),
                }] : []),
                ...(showEndgame ? [{
                  name: 'Endgame',
                  'This Match': match.endGameScore || 0,
                  'Session Avg': Math.round(
                    matches.reduce((s, m) => s + (m.endGameScore || 0), 0) /
                      matches.length
                  ),
                }] : []),
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

interface CompareMetric {
  label: string;
  a: number;
  b: number;
  higherIsBetter: boolean;
  phase?: 'auto' | 'tele' | 'endgame' | 'overall';
}

export const CompareTab = ({
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

  const sessionMatchType = matches[0]?.matchType ?? 'Full Game';
  const showAuto = sessionMatchType !== 'Teleop';
  const showTele = sessionMatchType !== 'Autonomous';
  const showEndgame = sessionMatchType !== 'Autonomous';

  const anyGateEnabled = mA.gateEnabled !== false || mB.gateEnabled !== false;

  const metrics: CompareMetric[] = [
    { label: 'Final Score', a: mA.finalScore || 0, b: mB.finalScore || 0, higherIsBetter: true, phase: 'overall' },
    { label: 'Autonomous', a: mA.autonomousScore || 0, b: mB.autonomousScore || 0, higherIsBetter: true, phase: 'auto' },
    { label: 'Teleop', a: mA.teleopScore || 0, b: mB.teleopScore || 0, higherIsBetter: true, phase: 'tele' },
    { label: 'Endgame', a: mA.endGameScore || 0, b: mB.endGameScore || 0, higherIsBetter: true, phase: 'endgame' },
    ...(anyGateEnabled ? [
      { label: 'Classified (Auto)', a: mA.autonClassifiedArtifact || 0, b: mB.autonClassifiedArtifact || 0, higherIsBetter: true, phase: 'auto' as const },
      { label: 'Classified (Teleop)', a: mA.teleClassifiedArtifact || 0, b: mB.teleClassifiedArtifact || 0, higherIsBetter: true, phase: 'tele' as const },
      { label: 'Overflow (Auto)', a: mA.autonOverflowArtifact || 0, b: mB.autonOverflowArtifact || 0, higherIsBetter: true, phase: 'auto' as const },
      { label: 'Overflow (Teleop)', a: mA.teleOverflowArtifact || 0, b: mB.teleOverflowArtifact || 0, higherIsBetter: true, phase: 'tele' as const },
    ] : []),
    { label: 'Motifs (Auto)', a: mA.autonMotif || 0, b: mB.autonMotif || 0, higherIsBetter: true, phase: 'auto' },
    { label: 'Motifs (Teleop)', a: mA.teleMotif || 0, b: mB.teleMotif || 0, higherIsBetter: true, phase: 'tele' },
    { label: 'Balls Missed (Auto)', a: mA.autonBallsMissed || 0, b: mB.autonBallsMissed || 0, higherIsBetter: false, phase: 'auto' },
    { label: 'Balls Missed (Teleop)', a: mA.teleBallsMissed || 0, b: mB.teleBallsMissed || 0, higherIsBetter: false, phase: 'tele' },
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
            {formatDiff(scoreDiff)}
          </span>
        </div>
        <p
          className={`text-sm mt-2 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
        >
          {mA.finalScore || 0} pts vs {mB.finalScore || 0} pts
        </p>
      </div>

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
            {showAuto && (
              <Bar
                dataKey="Autonomous"
                stackId="s"
                fill={CHART_COLORS.auto}
                activeBar={{ stroke: isDarkMode ? '#fff' : '#000', strokeWidth: 2 }}
              />
            )}
            {showTele && (
              <Bar
                dataKey="Teleop"
                stackId="s"
                fill={CHART_COLORS.tele}
                activeBar={{ stroke: isDarkMode ? '#fff' : '#000', strokeWidth: 2 }}
              />
            )}
            {showEndgame && (
              <Bar
                dataKey="Endgame"
                stackId="s"
                fill={CHART_COLORS.endgame}
                radius={[4, 4, 0, 0]}
                activeBar={{ stroke: isDarkMode ? '#fff' : '#000', strokeWidth: 2 }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <div
        className={`rounded-xl border p-5 space-y-5 ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`}
      >
        <div className="flex items-end justify-between">
          <h3
            className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          >
            Full Comparison
          </h3>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className={isDarkMode ? 'text-team-white-60' : 'text-gray-400'}>
              M{mA.matchNumber}
            </span>
            <span className={isDarkMode ? 'text-team-white-60' : 'text-gray-400'}>
              vs
            </span>
            <span className={isDarkMode ? 'text-team-white-60' : 'text-gray-400'}>
              M{mB.matchNumber}
            </span>
          </div>
        </div>

        {(['overall', 'auto', 'tele', 'endgame'] as const).filter(phase =>
          (phase !== 'auto' || showAuto) &&
          (phase !== 'tele' || showTele) &&
          (phase !== 'endgame' || showEndgame)
        ).map(phase => {
          const phaseMetrics = metrics.filter(m => m.phase === phase);
          if (phaseMetrics.length === 0) return null;

          const phaseConfig = {
            overall: {
              label: 'Overall',
              color: CHART_COLORS.primary,
              headerBg: isDarkMode ? 'bg-team-blue/10' : 'bg-team-blue/5',
              headerText: isDarkMode ? 'text-white' : 'text-gray-700',
              cardBg: isDarkMode
                ? 'border-team-blue-40 bg-team-dark-20'
                : 'border-gray-200 bg-gray-50/50',
            },
            auto: {
              label: 'Autonomous',
              color: CHART_COLORS.auto,
              headerBg: isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50',
              headerText: isDarkMode ? 'text-emerald-400' : 'text-emerald-700',
              cardBg: isDarkMode
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-emerald-100 bg-emerald-50/40',
            },
            tele: {
              label: 'Teleop',
              color: CHART_COLORS.tele,
              headerBg: isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50',
              headerText: isDarkMode ? 'text-amber-300' : 'text-amber-700',
              cardBg: isDarkMode
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-amber-100 bg-amber-50/40',
            },
            endgame: {
              label: 'Endgame',
              color: CHART_COLORS.endgame,
              headerBg: isDarkMode ? 'bg-team-blue/10' : 'bg-sky-50',
              headerText: isDarkMode ? 'text-sky-300' : 'text-sky-700',
              cardBg: isDarkMode
                ? 'border-sky-500/20 bg-sky-500/5'
                : 'border-sky-100 bg-sky-50/40',
            },
          }[phase];

          return (
            <div key={phase} className="space-y-1">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${phaseConfig.headerBg} ${phaseConfig.headerText}`}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: phaseConfig.color }}
                />
                {phaseConfig.label}
              </div>

              <div
                className={`rounded-xl border overflow-hidden ${phaseConfig.cardBg}`}
              >
                {phaseMetrics.map((row, rowIdx) => {
                  const diff = row.b - row.a;
                  const tied = row.a === row.b;
                  const aWins =
                    !tied &&
                    (row.higherIsBetter ? row.a > row.b : row.a < row.b);
                  const bWins =
                    !tied &&
                    (row.higherIsBetter ? row.b > row.a : row.b < row.a);
                  const maxVal = Math.max(row.a, row.b, 1);

                  return (
                    <div
                      key={row.label}
                      className={`px-4 py-3 ${
                        rowIdx > 0
                          ? `border-t ${isDarkMode ? 'border-white/5' : 'border-black/5'}`
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                        >
                          {row.label}
                        </span>
                        {!tied ? (
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              bWins
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : 'bg-red-500/15 text-red-500'
                            }`}
                          >
                            {formatDiff(diff)}
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-white/10 text-team-white-60' : 'bg-gray-100 text-gray-400'}`}
                          >
                            Tied
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-[11px] font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-400'}`}
                            >
                              M{mA.matchNumber}
                            </span>
                            <span
                              className={`text-sm font-bold ${
                                tied
                                  ? isDarkMode
                                    ? 'text-white'
                                    : 'text-gray-700'
                                  : aWins
                                    ? 'text-emerald-500'
                                    : 'text-red-500'
                              }`}
                            >
                              {row.a}
                            </span>
                          </div>
                          <div
                            className={`h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-black/8'}`}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.round((row.a / maxVal) * 100)}%`,
                                backgroundColor: tied
                                  ? phaseConfig.color
                                  : aWins
                                    ? '#10b981'
                                    : '#ef4444',
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-[11px] font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-400'}`}
                            >
                              M{mB.matchNumber}
                            </span>
                            <span
                              className={`text-sm font-bold ${
                                tied
                                  ? isDarkMode
                                    ? 'text-white'
                                    : 'text-gray-700'
                                  : bWins
                                    ? 'text-emerald-500'
                                    : 'text-red-500'
                              }`}
                            >
                              {row.b}
                            </span>
                          </div>
                          <div
                            className={`h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-black/8'}`}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.round((row.b / maxVal) * 100)}%`,
                                backgroundColor: tied
                                  ? phaseConfig.color
                                  : bWins
                                    ? '#10b981'
                                    : '#ef4444',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
