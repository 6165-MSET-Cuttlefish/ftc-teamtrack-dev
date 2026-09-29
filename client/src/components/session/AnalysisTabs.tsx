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
  Target,
  Flower2,
  AlertTriangle,
  Activity,
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
import { calculateScore, cycleTimesOf, robotRates, scoreRows } from '@/lib';

/** Compute +/- diff string */
const formatDiff = (val: number) => (val > 0 ? `+${val}` : `${val}`);

/** Trend icon based on positive/negative/zero */
const TrendIcon = ({ value, size = 16 }: { value: number; size?: number }) => {
  if (value > 0) return <TrendingUp size={size} className="text-emerald-500" />;
  if (value < 0) return <TrendingDown size={size} className="text-red-500" />;
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

const ElementBar = ({
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
  const pct = max > 0 ? Math.round((Math.abs(value) / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span
          className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-700'}`}
        >
          {label}
        </span>
        <span
          className={`text-sm font-bold ${value < 0 ? 'text-red-500' : 'text-team-blue'}`}
        >
          {value} pts
        </span>
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
    className={`rounded-xl border p-4 sm:p-6 ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`}
  >
    <h3
      className={`text-lg font-semibold mb-5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
    >
      {title}
    </h3>
    {children}
  </div>
);

const EmptyChart = ({
  message,
  isDarkMode,
}: {
  message: string;
  isDarkMode: boolean;
}) => (
  <div
    className={`h-[260px] flex items-center justify-center text-sm ${
      isDarkMode ? 'text-team-white-60' : 'text-gray-500'
    }`}
  >
    {message}
  </div>
);

export interface SessionStats {
  avgScore: number;
  maxScore: number;
  minScore: number;
  /** Average points from each scoring element */
  avgGarden: number;
  avgTipping: number;
  avgFlower: number;
  avgFlowerBonus: number;
  avgHive: number;
  avgLeave: number;
  avgPark: number;
  /** Average points lost to penalties per match */
  avgPenalties: number;
  /** Percentage of robot-matches with an auto that left; null if no auto was run */
  leaveRate: number | null;
  /** Percentage of park opportunities converted, counting only periods that were run */
  parkRate: number | null;
  /** Average seconds between live scoring actions, or null if never recorded */
  avgCycle: number | null;
  consistency: number;
  totalMatches: number;
  bestMatch: number;
  worstMatch: number;
}

/** Final score for a match, recomputing when the cached value is absent. */
const scoreOf = (m: Match): number => m.finalScore ?? calculateScore(m).total;

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

/** One decimal place, so per-element averages still add up to the total. */
const round1 = (n: number) => Math.round(n * 10) / 10;

export const computeStats = (matches: Match[]): SessionStats | null => {
  if (matches.length === 0) return null;

  const scores = matches.map(scoreOf);
  const avgScore = mean(scores);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  const breakdowns = matches.map(m => calculateScore(m));

  const { leaveRate, parkRate } = robotRates(matches);

  const allCycles = matches.flatMap(cycleTimesOf);

  const variance = mean(scores.map(sc => Math.pow(sc - avgScore, 2)));
  const consistency = Math.round(Math.max(0, 100 - Math.sqrt(variance) * 2));

  return {
    avgScore: Math.round(avgScore),
    maxScore,
    minScore,
    avgGarden: round1(mean(breakdowns.map(b => b.garden))),
    avgTipping: round1(mean(breakdowns.map(b => b.tipping))),
    avgFlower: round1(mean(breakdowns.map(b => b.flower))),
    avgFlowerBonus: round1(mean(breakdowns.map(b => b.flowerBonus))),
    avgHive: round1(mean(breakdowns.map(b => b.hive))),
    avgLeave: round1(mean(breakdowns.map(b => b.leave))),
    avgPark: round1(mean(breakdowns.map(b => b.park))),
    avgPenalties: round1(mean(breakdowns.map(b => b.penalties))),
    leaveRate,
    parkRate,
    avgCycle:
      allCycles.length > 0
        ? Math.round(mean(allCycles) * 100) / 100
        : null,
    consistency,
    totalMatches: matches.length,
    bestMatch: scores.indexOf(maxScore),
    worstMatch: scores.indexOf(minScore),
  };
};

const CHART_COLORS = {
  garden: '#10b981', // emerald - Garden
  tipping: '#f59e0b', // amber   - Tipping
  flower: '#a855f7', // purple  - Flower
  hive: '#0ea5e9', // sky     - Balls in Hive
  robots: '#14b8a6', // teal    - Leave + Park
  penalties: '#ef4444', // red  - Penalties
  primary: '#537788', // steel  - Final Score
  secondary: '#7ba8ba', // muted steel - session average
  cycle: '#8b5cf6', // violet  - Cycle time
};

export type TabId = 'summary' | 'matches' | 'compare';

export const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'summary', label: 'Summary', icon: BarChart3 },
  { id: 'matches', label: 'Match Details', icon: LayoutList },
  { id: 'compare', label: 'Compare', icon: ArrowRightLeft },
];

const axisProps = (isDarkMode: boolean) => ({
  stroke: isDarkMode ? '#64748b' : '#94a3b8',
  fontSize: 12,
});

export const SummaryTab = ({
  matches,
  stats,
  isDarkMode,
}: {
  matches: Match[];
  stats: SessionStats;
  isDarkMode: boolean;
}) => {
  const [elementView, setElementView] = useState<'points' | 'counts'>('points');

  const trendData = matches.map((m, i) => {
    const b = calculateScore(m);
    return {
      name: `M${i + 1}`,
      'Final Score': scoreOf(m),
      Garden: b.garden,
      Tipping: b.tipping,
      Flower: b.flower + b.flowerBonus,
      Hive: b.hive,
    };
  });

  const elementData = matches.map((m, i) => {
    const b = calculateScore(m);
    return elementView === 'points'
      ? {
          name: `M${i + 1}`,
          Garden: b.garden,
          Tipping: b.tipping,
          Flower: b.flower + b.flowerBonus,
          Hive: b.hive,
          Robots: b.leave + b.park,
        }
      : {
          name: `M${i + 1}`,
          Garden: m.garden ?? 0,
          Tipping: m.tipping ?? 0,
          Flower: (m.flower ?? 0) + (m.flowerBonus ?? 0),
          Hive: m.ballsInHive ?? 0,
          Robots:
            (m.robot1Leave ? 1 : 0) +
            (m.robot2Leave ? 1 : 0) +
            (m.robot1ParkAuto ? 1 : 0) +
            (m.robot1ParkTeleop ? 1 : 0) +
            (m.robot2ParkAuto ? 1 : 0) +
            (m.robot2ParkTeleop ? 1 : 0),
        };
  });

  const penaltyData = matches.map((m, i) => ({
    name: `M${i + 1}`,
    Minor: m.minorPenalties ?? 0,
    Major: m.majorPenalties ?? 0,
  }));
  const hasPenalties = penaltyData.some(d => d.Minor + d.Major > 0);

  const cycleData = matches
    .map((m, i) => {
      const cycles = cycleTimesOf(m);
      if (cycles.length === 0) return null;
      return {
        name: `M${i + 1}`,
        'Avg Cycle': cycles.reduce((a, b) => a + b, 0) / cycles.length,
      };
    })
    .filter((d): d is { name: string; 'Avg Cycle': number } => d !== null);

  // Session-average element mix, used for the contribution bars.
  const avgRows = [
    { label: 'Garden', value: stats.avgGarden, color: CHART_COLORS.garden },
    { label: 'Tipping', value: stats.avgTipping, color: CHART_COLORS.tipping },
    { label: 'Flower', value: stats.avgFlower, color: CHART_COLORS.flower },
    {
      label: 'Flower Bonus',
      value: stats.avgFlowerBonus,
      color: CHART_COLORS.flower,
    },
    { label: 'Left in Hive', value: stats.avgHive, color: CHART_COLORS.hive },
    { label: 'Leave', value: stats.avgLeave, color: CHART_COLORS.robots },
    { label: 'Park', value: stats.avgPark, color: CHART_COLORS.robots },
    {
      label: 'Penalties',
      value: -stats.avgPenalties,
      color: CHART_COLORS.penalties,
    },
  ];
  const avgMax = Math.max(1, ...avgRows.map(r => Math.abs(r.value)));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Average Score"
          value={stats.avgScore}
          sublabel={`across ${stats.totalMatches} ${stats.totalMatches === 1 ? 'match' : 'matches'}`}
          icon={Target}
          highlight
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Best Match"
          value={stats.maxScore}
          sublabel={`Match ${stats.bestMatch + 1}`}
          icon={TrendingUp}
          variant="success"
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Consistency"
          value={`${stats.consistency}%`}
          sublabel={`range ${stats.minScore}-${stats.maxScore}`}
          icon={Activity}
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Penalties"
          value={stats.avgPenalties}
          sublabel="avg points lost per match"
          icon={AlertTriangle}
          variant={stats.avgPenalties > 0 ? 'danger' : 'default'}
          isDarkMode={isDarkMode}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Leave Rate"
          value={stats.leaveRate === null ? '-' : `${stats.leaveRate}%`}
          sublabel={
            stats.leaveRate === null ? 'no autonomous run' : 'of robot-matches with auto'
          }
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Park Rate"
          value={stats.parkRate === null ? '-' : `${stats.parkRate}%`}
          sublabel="of park chances (auto + end)"
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Avg Cycle"
          value={stats.avgCycle !== null ? `${stats.avgCycle}s` : '-'}
          sublabel="between live actions"
          icon={Flower2}
          isDarkMode={isDarkMode}
        />
      </div>

      <Section title="Score Trend" isDarkMode={isDarkMode}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDarkMode ? '#334155' : '#e2e8f0'}
            />
            <XAxis dataKey="name" {...axisProps(isDarkMode)} />
            <YAxis {...axisProps(isDarkMode)} />
            <Tooltip content={<ChartTooltip isDarkMode={isDarkMode} />} />
            <Legend />
            <ReferenceLine
              y={stats.avgScore}
              stroke={CHART_COLORS.secondary}
              strokeDasharray="4 4"
            />
            <Line
              type="monotone"
              dataKey="Final Score"
              stroke={CHART_COLORS.primary}
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Where the Points Came From" isDarkMode={isDarkMode}>
        <div className="space-y-4">{
          avgRows.map(row => (
            <ElementBar
              key={row.label}
              label={row.label}
              value={row.value}
              max={avgMax}
              color={row.color}
              isDarkMode={isDarkMode}
            />
          ))
        }</div>
      </Section>

      <Section title="Scoring by Match" isDarkMode={isDarkMode}>
        <div className="flex gap-2 mb-4">
          {(['points', 'counts'] as const).map(view => (
            <button
              key={view}
              type="button"
              onClick={() => setElementView(view)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                elementView === view
                  ? 'bg-team-blue text-white'
                  : isDarkMode
                    ? 'bg-white/5 text-team-white-60 hover:bg-white/10'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={elementData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDarkMode ? '#334155' : '#e2e8f0'}
            />
            <XAxis dataKey="name" {...axisProps(isDarkMode)} />
            <YAxis {...axisProps(isDarkMode)} />
            <Tooltip content={<ChartTooltip isDarkMode={isDarkMode} />} />
            <Legend />
            <Bar dataKey="Garden" stackId="a" fill={CHART_COLORS.garden} />
            <Bar dataKey="Tipping" stackId="a" fill={CHART_COLORS.tipping} />
            <Bar dataKey="Flower" stackId="a" fill={CHART_COLORS.flower} />
            <Bar dataKey="Hive" stackId="a" fill={CHART_COLORS.hive} />
            <Bar dataKey="Robots" stackId="a" fill={CHART_COLORS.robots} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Penalties" isDarkMode={isDarkMode}>
          {hasPenalties ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={penaltyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDarkMode ? '#334155' : '#e2e8f0'}
                />
                <XAxis dataKey="name" {...axisProps(isDarkMode)} />
                <YAxis allowDecimals={false} {...axisProps(isDarkMode)} />
                <Tooltip content={<ChartTooltip isDarkMode={isDarkMode} />} />
                <Legend />
                <Bar dataKey="Minor" fill={CHART_COLORS.tipping} />
                <Bar dataKey="Major" fill={CHART_COLORS.penalties} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart
              message="No penalties recorded - nice driving"
              isDarkMode={isDarkMode}
            />
          )}
        </Section>

        <Section title="Cycle Time" isDarkMode={isDarkMode}>
          {cycleData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={cycleData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDarkMode ? '#334155' : '#e2e8f0'}
                />
                <XAxis dataKey="name" {...axisProps(isDarkMode)} />
                <YAxis {...axisProps(isDarkMode)} />
                <Tooltip
                  content={<ChartTooltip isDarkMode={isDarkMode} unit="s" />}
                />
                <Line
                  type="monotone"
                  dataKey="Avg Cycle"
                  stroke={CHART_COLORS.cycle}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart
              message="No cycle times recorded yet"
              isDarkMode={isDarkMode}
            />
          )}
        </Section>
      </div>
    </div>
  );
};

export const MatchDetailTab = ({
  matches,
  isDarkMode,
  // Edit/delete/add are optional - omit them for a read-only view
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

  if (matches.length === 0) {
    return (
      <div
        className={`rounded-xl border p-12 text-center ${
          isDarkMode
            ? 'border-team-blue-40 bg-team-dark-20'
            : 'border-gray-200 bg-white'
        }`}
      >
        <p
          className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
        >
          No matches recorded yet.
        </p>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-team-blue text-white text-sm font-semibold"
          >
            <Plus size={16} /> Add Match
          </button>
        )}
      </div>
    );
  }

  const match = matches[Math.min(selectedIdx, matches.length - 1)];
  const breakdown = calculateScore(match);
  const rows = scoreRows(match);
  const cycles = cycleTimesOf(match);
  const avgScore = mean(matches.map(scoreOf));
  const diff = Math.round(scoreOf(match) - avgScore);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous match"
            disabled={selectedIdx === 0}
            onClick={() => setSelectedIdx(i => Math.max(0, i - 1))}
            className={`p-2 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed ${
              isDarkMode
                ? 'border-team-blue-40 text-white hover:bg-white/5'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <ChevronLeft size={18} />
          </button>
          <span
            className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          >
            Match {match.matchNumber}
          </span>
          <button
            type="button"
            aria-label="Next match"
            disabled={selectedIdx >= matches.length - 1}
            onClick={() =>
              setSelectedIdx(i => Math.min(matches.length - 1, i + 1))
            }
            className={`p-2 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed ${
              isDarkMode
                ? 'border-team-blue-40 text-white hover:bg-white/5'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-team-blue text-white text-sm font-semibold"
            >
              <Plus size={15} /> Add
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(match)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold ${
                isDarkMode
                  ? 'border-team-blue-40 text-white hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Edit size={15} /> Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirmDeleteId === match.id) {
                  onDelete(match.id);
                  setConfirmDeleteId(null);
                } else {
                  setConfirmDeleteId(match.id);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                confirmDeleteId === match.id
                  ? 'border-red-500 bg-red-500 text-white'
                  : 'border-red-500/40 text-red-500 hover:bg-red-500/10'
              }`}
            >
              <Trash2 size={15} />
              {confirmDeleteId === match.id ? 'Confirm' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Final Score"
          value={scoreOf(match)}
          highlight
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="vs Session Avg"
          value={formatDiff(diff)}
          variant={diff >= 0 ? 'success' : 'danger'}
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Avg Cycle"
          value={
            cycles.length > 0
              ? `${(cycles.reduce((a, b) => a + b, 0) / cycles.length).toFixed(2)}s`
              : '-'
          }
          sublabel={`${cycles.length} actions`}
          isDarkMode={isDarkMode}
        />
      </div>

      <Section title="Breakdown" isDarkMode={isDarkMode}>
        <div className="space-y-2">
          {rows.map(row => (
            <div
              key={row.key}
              className={`flex items-center justify-between text-sm py-1.5 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              <span>{row.label}</span>
              <span className="flex items-center gap-4 tabular-nums">
                <span className={isDarkMode ? 'text-gray-500' : 'text-gray-500'}>
                  x{row.count}
                </span>
                <span
                  className={`w-16 text-right font-bold ${
                    row.points < 0 ? 'text-red-500' : 'text-team-blue'
                  }`}
                >
                  {row.points}
                </span>
              </span>
            </div>
          ))}
          <div
            className={`flex items-center justify-between font-bold pt-3 mt-1 border-t ${
              isDarkMode
                ? 'border-gray-700 text-white'
                : 'border-gray-200 text-gray-900'
            }`}
          >
            <span>Total</span>
            <span className="tabular-nums text-team-blue text-lg">
              {breakdown.total}
            </span>
          </div>
        </div>
      </Section>

      <Section title="All Matches" isDarkMode={isDarkMode}>
        <div className="flex flex-wrap gap-2">
          {matches.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedIdx(i)}
              className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                i === selectedIdx
                  ? 'border-team-blue bg-team-blue/10 text-team-blue'
                  : isDarkMode
                    ? 'border-team-blue-40 text-team-white-60 hover:bg-white/5'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              M{m.matchNumber}
              <span className="ml-2 opacity-70">{scoreOf(m)}</span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
};

export const CompareTab = ({
  matches,
  isDarkMode,
}: {
  matches: Match[];
  isDarkMode: boolean;
}) => {
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(matches.length > 1 ? 1 : 0);

  useEffect(() => {
    if (leftIdx >= matches.length) setLeftIdx(0);
    if (rightIdx >= matches.length) setRightIdx(Math.max(0, matches.length - 1));
  }, [matches.length, leftIdx, rightIdx]);

  if (matches.length < 2) {
    return (
      <div
        className={`rounded-xl border p-12 text-center text-sm ${
          isDarkMode
            ? 'border-team-blue-40 bg-team-dark-20 text-team-white-60'
            : 'border-gray-200 bg-white text-gray-500'
        }`}
      >
        Record at least two matches to compare them.
      </div>
    );
  }

  const left = matches[Math.min(leftIdx, matches.length - 1)];
  const right = matches[Math.min(rightIdx, matches.length - 1)];
  const leftRows = scoreRows(left);
  const rightRows = scoreRows(right);

  const picker = (
    label: string,
    value: number,
    onChange: (i: number) => void
  ) => (
    <div className="flex items-center gap-2">
      <span
        className={`text-xs font-semibold uppercase tracking-wide ${
          isDarkMode ? 'text-team-white-60' : 'text-gray-500'
        }`}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`px-3 py-2 rounded-lg border text-sm font-semibold ${
          isDarkMode
            ? 'bg-team-dark border-team-blue-40 text-white'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        {matches.map((m, i) => (
          <option key={m.id} value={i}>
            Match {m.matchNumber}
          </option>
        ))}
      </select>
    </div>
  );

  const chartData = leftRows.map((row, i) => ({
    name: row.label,
    [`Match ${left.matchNumber}`]: row.points,
    [`Match ${right.matchNumber}`]: rightRows[i].points,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {picker('Left', leftIdx, setLeftIdx)}
        <ArrowRightLeft
          size={18}
          className={isDarkMode ? 'text-team-white-60' : 'text-gray-500'}
        />
        {picker('Right', rightIdx, setRightIdx)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={`Match ${left.matchNumber}`}
          value={scoreOf(left)}
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Difference"
          value={formatDiff(scoreOf(right) - scoreOf(left))}
          variant={scoreOf(right) >= scoreOf(left) ? 'success' : 'danger'}
          isDarkMode={isDarkMode}
        />
        <StatCard
          label={`Match ${right.matchNumber}`}
          value={scoreOf(right)}
          isDarkMode={isDarkMode}
        />
      </div>

      <Section title="Element by Element" isDarkMode={isDarkMode}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDarkMode ? '#334155' : '#e2e8f0'}
            />
            <XAxis dataKey="name" {...axisProps(isDarkMode)} />
            <YAxis {...axisProps(isDarkMode)} />
            <Tooltip content={<ChartTooltip isDarkMode={isDarkMode} />} />
            <Legend />
            <Bar
              dataKey={`Match ${left.matchNumber}`}
              fill={CHART_COLORS.primary}
            />
            <Bar
              dataKey={`Match ${right.matchNumber}`}
              fill={CHART_COLORS.garden}
            />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Side by Side" isDarkMode={isDarkMode}>
        <div className="space-y-2">
          {leftRows.map((row, i) => {
            const delta = rightRows[i].points - row.points;
            return (
              <div
                key={row.key}
                className={`grid grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr] items-center text-sm py-1.5 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                <span className="truncate pr-2">{row.label}</span>
                <span className="text-right tabular-nums font-semibold">
                  {row.points}
                </span>
                <span className="text-right tabular-nums font-semibold">
                  {rightRows[i].points}
                </span>
                <span className="flex items-center justify-end gap-1.5 tabular-nums">
                  <TrendIcon value={delta} size={14} />
                  <span
                    className={
                      delta > 0
                        ? 'text-emerald-500'
                        : delta < 0
                          ? 'text-red-500'
                          : isDarkMode
                            ? 'text-gray-500'
                            : 'text-gray-500'
                    }
                  >
                    {formatDiff(delta)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
};
