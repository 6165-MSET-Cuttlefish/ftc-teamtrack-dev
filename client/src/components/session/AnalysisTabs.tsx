/* eslint-disable react-refresh/only-export-components */

import { useState, useEffect, useRef } from 'react';
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
  Check,
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
import type { Match, SessionType } from '@/types';
import type { RankingPointTally } from '@/lib';
import {
  calculateScore,
  cycleTimesOf,
  matchScore,
  rankingPoints,
  rankingPointNames,
  rankingPointTally,
  robotRates,
  scoreRows,
} from '@/lib';

/** Compute +/- diff string */
const formatDiff = (val: number) => (val > 0 ? `+${val}` : `${val}`);

/** At most one decimal place, and none on a whole number: "39", "5.3". */
const formatNumber = (n: number) => String(Math.round(n * 10) / 10);

/** "1 match", "2 matches" */
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Text on a solid team-blue fill, which is pale in the dark themes. */
const onTeamBlue = (isDarkMode: boolean) =>
  isDarkMode ? 'text-black' : 'text-white';

/**
 * Whether to show foul figures. Fouls are only recorded in a Scrim; a view
 * that isn't told the session type shows them when there are any.
 */
const showsFouls = (
  sessionType: SessionType | undefined,
  matches: Match[]
): boolean =>
  sessionType
    ? sessionType === 'Scrim'
    : matches.some(m => (m.minorPenalties ?? 0) + (m.majorPenalties ?? 0) > 0);

/** Trend icon based on positive/negative/zero */
const TrendIcon = ({ value, size = 16 }: { value: number; size?: number }) => {
  // emerald-500 is under 3:1 on the light background
  if (value > 0) return <TrendingUp size={size} className="text-emerald-600" />;
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
                ? `${formatNumber(entry.value)}${unit ?? ''}`
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * One figure on a filled panel, the same surface as the scoring pad's
 * breakdown band: a short label, the number, and at most one line under it.
 * `variant` colors only the number; the panel itself stays neutral so a row
 * of these reads as one band. `icon` and `highlight` are accepted for
 * existing callers but no longer drawn.
 */
export const StatCard = ({
  label,
  value,
  sublabel,
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
  // The 500 shades are unreadable on the light theme.
  const valueColor =
    variant === 'success'
      ? isDarkMode
        ? 'text-emerald-400'
        : 'text-emerald-700'
      : variant === 'danger'
        ? isDarkMode
          ? 'text-red-400'
          : 'text-red-700'
        : 'text-team-blue';
  const muted = isDarkMode ? 'text-white/50' : 'text-gray-500';

  return (
    <div
      className={`rounded-2xl px-5 py-4 ${isDarkMode ? 'bg-white/[0.035]' : 'bg-gray-100/80'}`}
    >
      <p className={`text-sm font-semibold ${muted}`}>{label}</p>
      <p
        className={`mt-1 text-3xl font-bold leading-none tabular-nums ${valueColor}`}
      >
        {value}
      </p>
      {sublabel && (
        <p className={`mt-2 text-xs leading-snug ${muted}`}>{sublabel}</p>
      )}
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
          {value} {value === 1 ? 'pt' : 'pts'}
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
    className={`rounded-2xl p-4 sm:p-6 ${isDarkMode ? 'bg-white/[0.035]' : 'bg-gray-100/80'}`}
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
  /**
   * Average points per match this alliance's fouls gave the opponent.
   * Not part of any score here.
   */
  avgPenalties: number;
  /** Percentage of robot-matches with an auto that left; null if no auto was run */
  leaveRate: number | null;
  /** Percentage of park opportunities converted, counting only periods that were run */
  parkRate: number | null;
  /** Average seconds between Hive Tips, or null if never recorded */
  avgCycle: number | null;
  /**
   * How steady the scores are, 0-100: 100 x (1 - SD / average). Null when
   * there is nothing to measure - fewer than two matches, or no points.
   */
  consistency: number | null;
  /** Ranking points earned from scoring alone (SWARM, POLLINATOR 1 and 2) */
  rankingPoints: RankingPointTally;
  totalMatches: number;
  bestMatch: number;
  worstMatch: number;
}

/**
 * Score of a match, always recomputed: the cached `finalScore` can be stale
 * (it used to have fouls taken off it).
 */
const scoreOf = (m: Match): number => matchScore(m);

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

  // Spread relative to the average, so a 10-point swing counts for less
  // in a 150-point session than in a 30-point one.
  const variance = mean(scores.map(sc => Math.pow(sc - avgScore, 2)));
  const consistency =
    matches.length < 2 || avgScore === 0
      ? null
      : Math.round(Math.max(0, 100 * (1 - Math.sqrt(variance) / avgScore)));

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
      allCycles.length > 0 ? Math.round(mean(allCycles) * 100) / 100 : null,
    consistency,
    rankingPoints: rankingPointTally(matches),
    totalMatches: matches.length,
    bestMatch: scores.indexOf(maxScore),
    worstMatch: scores.indexOf(minScore),
  };
};

const CHART_COLORS = {
  garden: '#10b981', // emerald - Garden
  tipping: '#f59e0b', // amber   - Tips
  flower: '#a855f7', // purple  - Flower
  hive: '#0ea5e9', // sky     - Balls in Hive
  robots: '#14b8a6', // teal    - Leave + Park
  penalties: '#ef4444', // red  - Fouls
  primary: '#537788', // steel  - Final Score
  secondary: '#7ba8ba', // muted steel - session average
  cycle: '#8b5cf6', // violet  - Cycle time
  flowerBonus: '#ec4899', // pink - Bonus (same as the Charts page)
};

export type TabId = 'summary' | 'matches' | 'compare';

export const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'summary', label: 'Summary', icon: BarChart3 },
  { id: 'matches', label: 'Match Details', icon: LayoutList },
  { id: 'compare', label: 'Compare', icon: ArrowRightLeft },
];

/** DOM ids tying each tab button to the panel it shows */
export const tabButtonId = (id: TabId) => `analysis-tab-${id}`;
export const tabPanelId = (id: TabId) => `analysis-panel-${id}`;

/**
 * The Summary / Match Details / Compare switcher. On a phone the labels are
 * hidden and only the icons show, so each tab carries its name for screen
 * readers. Wrap the content it switches in
 * `role="tabpanel" id={tabPanelId(active)} aria-labelledby={tabButtonId(active)}`.
 */
export const AnalysisTabBar = ({
  active,
  onChange,
  isDarkMode,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
  isDarkMode: boolean;
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  /** Arrow keys move between tabs, as in any tablist */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = TABS.findIndex(tab => tab.id === active);
    const next =
      e.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : e.key === 'ArrowLeft'
          ? (index - 1 + TABS.length) % TABS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? TABS.length - 1
              : -1;
    if (next === -1) return;
    e.preventDefault();
    onChange(TABS[next].id);
    listRef.current
      ?.querySelector<HTMLElement>(`#${tabButtonId(TABS[next].id)}`)
      ?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Analysis sections"
      onKeyDown={onKeyDown}
      className={`flex gap-1 p-1 rounded-xl ${isDarkMode ? 'bg-team-dark-20' : 'bg-gray-100'}`}
    >
      {TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabButtonId(tab.id)}
            aria-label={tab.label}
            aria-selected={isActive}
            aria-controls={isActive ? tabPanelId(tab.id) : undefined}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? isDarkMode
                  ? 'bg-team-dark text-team-blue shadow-sm'
                  : 'bg-white text-team-blue shadow-sm'
                : isDarkMode
                  ? 'text-team-white-60 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon size={16} aria-hidden />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

const axisProps = (isDarkMode: boolean) => ({
  stroke: isDarkMode ? '#64748b' : '#94a3b8',
  fontSize: 12,
});

export const SummaryTab = ({
  matches,
  stats,
  isDarkMode,
  sessionType,
}: {
  matches: Match[];
  stats: SessionStats;
  isDarkMode: boolean;
  /** Practice sessions leave the foul figures out */
  sessionType?: SessionType;
}) => {
  const [elementView, setElementView] = useState<'points' | 'counts'>('points');
  const fouls = showsFouls(sessionType, matches);

  const trendData = matches.map(m => {
    const b = calculateScore(m);
    return {
      name: `M${m.matchNumber}`,
      'Final Score': scoreOf(m),
      Garden: b.garden,
      Tips: b.tipping,
      Flower: b.flower,
      Bonus: b.flowerBonus,
      Hive: b.hive,
    };
  });

  const elementData = matches.map(m => {
    const b = calculateScore(m);
    if (elementView === 'points') {
      return {
        name: `M${m.matchNumber}`,
        Garden: b.garden,
        Tips: b.tipping,
        Flower: b.flower,
        Bonus: b.flowerBonus,
        Hive: b.hive,
        Robots: b.leave + b.park,
      };
    }
    // Leaves and parks as scored: a period the match never ran counts none.
    const robots = scoreRows(m)
      .filter(row => row.key === 'leave' || row.key === 'park')
      .reduce((sum, row) => sum + row.count, 0);
    return {
      name: `M${m.matchNumber}`,
      Garden: m.garden ?? 0,
      Tips: m.tipping ?? 0,
      Flower: m.flower ?? 0,
      Bonus: m.flowerBonus ?? 0,
      Hive: m.ballsInHive ?? 0,
      Robots: robots,
    };
  });

  const penaltyData = matches.map(m => ({
    name: `M${m.matchNumber}`,
    Minor: m.minorPenalties ?? 0,
    Major: m.majorPenalties ?? 0,
  }));
  const hasPenalties = penaltyData.some(d => d.Minor + d.Major > 0);

  const cycleData = matches
    .map(m => {
      const cycles = cycleTimesOf(m);
      if (cycles.length === 0) return null;
      return {
        name: `M${m.matchNumber}`,
        'Avg Cycle': cycles.reduce((a, b) => a + b, 0) / cycles.length,
      };
    })
    .filter((d): d is { name: string; 'Avg Cycle': number } => d !== null);

  // Session-average element mix, used for the contribution bars.
  const avgRows = [
    { label: 'Garden', value: stats.avgGarden, color: CHART_COLORS.garden },
    { label: 'Tips', value: stats.avgTipping, color: CHART_COLORS.tipping },
    { label: 'Flower', value: stats.avgFlower, color: CHART_COLORS.flower },
    {
      label: 'Bonus',
      value: stats.avgFlowerBonus,
      color: CHART_COLORS.flowerBonus,
    },
    { label: 'Hive', value: stats.avgHive, color: CHART_COLORS.hive },
    { label: 'Leave', value: stats.avgLeave, color: CHART_COLORS.robots },
    { label: 'Park', value: stats.avgPark, color: CHART_COLORS.robots },
  ];
  const avgMax = Math.max(1, ...avgRows.map(r => Math.abs(r.value)));

  const rp = stats.rankingPoints;
  const n = stats.totalMatches;

  return (
    <div className="space-y-6">
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${fouls ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
      >
        <StatCard
          label="Average Score"
          value={stats.avgScore}
          sublabel={`across ${plural(n, 'match', 'matches')}`}
          icon={Target}
          highlight
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Best Match"
          value={stats.maxScore}
          sublabel={`Match ${matches[stats.bestMatch]?.matchNumber ?? stats.bestMatch + 1}`}
          icon={TrendingUp}
          variant="success"
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Consistency"
          value={stats.consistency === null ? '-' : `${stats.consistency}%`}
          sublabel={
            stats.consistency !== null
              ? `range ${stats.minScore}-${stats.maxScore}`
              : n < 2
                ? 'needs 2+ matches'
                : 'no points scored yet'
          }
          icon={Activity}
          isDarkMode={isDarkMode}
        />
        {fouls && (
          <StatCard
            label="Avg points given to opponent"
            value={stats.avgPenalties}
            sublabel="per match, from your fouls - not taken off your score"
            icon={AlertTriangle}
            variant={stats.avgPenalties > 0 ? 'danger' : 'default'}
            isDarkMode={isDarkMode}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Leave Rate"
          value={stats.leaveRate === null ? '-' : `${stats.leaveRate}%`}
          sublabel={
            stats.leaveRate === null
              ? 'no autonomous run'
              : 'of robots, in matches with auto'
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
          label="RP Rate"
          value={rp.rate === null ? '-' : `${rp.rate}%`}
          sublabel={`${rp.earned} of ${rp.possible} RP - SWARM ${rp.swarm}/${n}, POLLINATOR 1 ${rp.pollinator1}/${n}, POLLINATOR 2 ${rp.pollinator2}/${n}`}
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Avg Cycle"
          value={stats.avgCycle !== null ? `${stats.avgCycle}s` : '-'}
          sublabel="time between Hive Tips"
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
        <div className="space-y-4">
          {avgRows.map(row => (
            <ElementBar
              key={row.label}
              label={row.label}
              value={row.value}
              max={avgMax}
              color={row.color}
              isDarkMode={isDarkMode}
            />
          ))}
        </div>
        {fouls && (
          <p
            className={`mt-5 pt-4 border-t text-sm ${
              isDarkMode
                ? 'border-gray-700 text-team-white-60'
                : 'border-gray-200 text-gray-600'
            }`}
          >
            Given to opponent by your fouls:{' '}
            <span className="font-bold tabular-nums">
              {stats.avgPenalties} {stats.avgPenalties === 1 ? 'pt' : 'pts'}
            </span>{' '}
            per match. Not part of your score.
          </p>
        )}
      </Section>

      <Section title="Scoring by Match" isDarkMode={isDarkMode}>
        <div className="flex gap-2 mb-4">
          {(['points', 'counts'] as const).map(view => (
            <button
              key={view}
              type="button"
              aria-pressed={elementView === view}
              onClick={() => setElementView(view)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                elementView === view
                  ? `bg-team-blue ${onTeamBlue(isDarkMode)}`
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
            <Bar dataKey="Tips" stackId="a" fill={CHART_COLORS.tipping} />
            <Bar dataKey="Flower" stackId="a" fill={CHART_COLORS.flower} />
            <Bar
              dataKey="Bonus"
              stackId="a"
              fill={CHART_COLORS.flowerBonus}
            />
            <Bar dataKey="Hive" stackId="a" fill={CHART_COLORS.hive} />
            <Bar dataKey="Robots" stackId="a" fill={CHART_COLORS.robots} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <div
        className={`grid grid-cols-1 gap-6 ${fouls ? 'lg:grid-cols-2' : ''}`}
      >
        {fouls && (
          <Section
            title="Fouls (points go to the opponent)"
            isDarkMode={isDarkMode}
          >
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
                message="No fouls recorded - nice driving"
                isDarkMode={isDarkMode}
              />
            )}
          </Section>
        )}

        <Section title="Cycle Time (between Hive Tips)" isDarkMode={isDarkMode}>
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
              message="No cycle times yet - needs 2+ Hive Tips scored live"
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
  sessionType,
}: {
  matches: Match[];
  isDarkMode: boolean;
  onEdit?: (match: Match) => void;
  onDelete?: (matchId: string) => void;
  onAdd?: () => void;
  /** Practice sessions leave the foul line out */
  sessionType?: SessionType;
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
        className={`rounded-2xl p-12 text-center ${
          isDarkMode ? 'bg-white/[0.035]' : 'bg-gray-100/80'
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
            className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-team-blue text-sm font-semibold ${onTeamBlue(isDarkMode)}`}
          >
            <Plus size={16} /> Add Match
          </button>
        )}
      </div>
    );
  }

  const match = matches[Math.min(selectedIdx, matches.length - 1)];
  const breakdown = calculateScore(match);
  // The foul row is not one of the rows that add up to the total.
  const allRows = scoreRows(match);
  const rows = allRows.filter(row => !row.informational);
  const foulRow = allRows.find(row => row.informational);
  const fouls = showsFouls(sessionType, matches);
  const cycles = cycleTimesOf(match);
  const avgScore = mean(matches.map(scoreOf));
  const diff = Math.round(scoreOf(match) - avgScore);
  const rp = rankingPoints(match);
  const rpBadges = rankingPointNames(rp);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous match"
            disabled={selectedIdx === 0}
            onClick={() => setSelectedIdx(i => Math.max(0, i - 1))}
            className={`inline-flex items-center justify-center p-2 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed ${
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
            <span
              className={`font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              {' '}
              - {match.matchType || 'Full Game'}
            </span>
          </span>
          <button
            type="button"
            aria-label="Next match"
            disabled={selectedIdx >= matches.length - 1}
            onClick={() =>
              setSelectedIdx(i => Math.min(matches.length - 1, i + 1))
            }
            className={`inline-flex items-center justify-center p-2 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed ${
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
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-team-blue text-sm font-semibold ${onTeamBlue(isDarkMode)}`}
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
                  ? 'border-red-600 bg-red-600 text-white'
                  : `border-red-500/40 hover:bg-red-500/10 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`
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
          sublabel={
            cycles.length > 0
              ? `time between Hive Tips, over ${plural(cycles.length, 'gap')}`
              : 'time between Hive Tips'
          }
          isDarkMode={isDarkMode}
        />
      </div>

      <div
        className="flex items-center gap-2 flex-wrap"
        aria-label="Ranking points earned in this match"
      >
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
        >
          Ranking Points
        </span>
        {rpBadges.length === 0 ? (
          <span
            className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            None from scoring
          </span>
        ) : (
          rpBadges.map(name => (
            <span
              key={name}
              // green-600 is under 4.5:1 on the light background
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${
                isDarkMode
                  ? 'border-green-500/40 bg-green-500/10 text-green-400'
                  : 'border-green-300 bg-green-50 text-green-800'
              }`}
            >
              <Check size={13} aria-hidden />
              {name}
            </span>
          ))
        )}
        {rpBadges.length > 0 && (
          <span
            className={`text-sm font-semibold tabular-nums ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            +{rp.total} RP
          </span>
        )}
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
                <span
                  className={
                    isDarkMode ? 'text-team-white-60' : 'text-gray-500'
                  }
                >
                  x{row.count}
                </span>
                <span className="w-16 text-right font-bold text-team-blue">
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
          {fouls && foulRow && (
            <div
              className={`flex items-center justify-between text-sm pt-1 ${
                isDarkMode ? 'text-team-white-60' : 'text-gray-600'
              }`}
            >
              <span>{foulRow.label} (not part of your score)</span>
              <span className="flex items-center gap-4 tabular-nums">
                <span>x{foulRow.count}</span>
                <span
                  className={`w-16 text-right font-bold ${
                    foulRow.points > 0
                      ? isDarkMode
                        ? 'text-red-400'
                        : 'text-red-700'
                      : ''
                  }`}
                >
                  +{foulRow.points}
                </span>
              </span>
            </div>
          )}
        </div>
      </Section>

      <Section title="All Matches" isDarkMode={isDarkMode}>
        <div className="flex flex-wrap gap-2">
          {matches.map((m, i) => (
            <button
              key={m.id}
              type="button"
              aria-label={`Match ${m.matchNumber}, ${plural(scoreOf(m), 'point')}`}
              aria-pressed={i === selectedIdx}
              onClick={() => setSelectedIdx(i)}
              className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                i === selectedIdx
                  ? // team-blue itself is 4.2:1 on its own light tint
                    `border-team-blue bg-team-blue/10 ${isDarkMode ? 'text-team-blue' : 'text-[#42606e]'}`
                  : isDarkMode
                    ? 'border-team-blue-40 text-team-white-60 hover:bg-white/5'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              M{m.matchNumber}
              <span className="ml-2 font-normal">{scoreOf(m)}</span>
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
  sessionType,
}: {
  matches: Match[];
  isDarkMode: boolean;
  /** Practice sessions leave the foul row out */
  sessionType?: SessionType;
}) => {
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(matches.length > 1 ? 1 : 0);

  useEffect(() => {
    if (leftIdx >= matches.length) setLeftIdx(0);
    if (rightIdx >= matches.length)
      setRightIdx(Math.max(0, matches.length - 1));
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
  const fouls = showsFouls(sessionType, matches);
  // Fouls aren't part of either score: off the chart, and in the table only
  // for a Scrim.
  const leftRows = scoreRows(left).filter(row => fouls || !row.informational);
  const rightRows = scoreRows(right).filter(row => fouls || !row.informational);

  // Two matches can share a number (sessions edited before deletes
  // renumbered), and the same match can be picked on both sides.
  const sameNumber = left.matchNumber === right.matchNumber;
  const leftLabel = `Match ${left.matchNumber}${sameNumber ? ' (left)' : ''}`;
  const rightLabel = `Match ${right.matchNumber}${sameNumber ? ' (right)' : ''}`;

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
        aria-label={`${label} match`}
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

  // Keyed by side, not by match label: two matches with the same number
  // would otherwise collapse into one series.
  const chartData = leftRows
    .map((row, i) => ({
      name: row.label,
      left: row.points,
      right: rightRows[i].points,
      informational: row.informational,
    }))
    .filter(row => !row.informational);

  const leftScore = scoreOf(left);
  const rightScore = scoreOf(right);
  const leftRp = rankingPoints(left);
  const rightRp = rankingPoints(right);
  const rpDelta = rightRp.total - leftRp.total;
  const cellTone = isDarkMode ? 'text-gray-300' : 'text-gray-700';
  const mutedTone = isDarkMode ? 'text-team-white-60' : 'text-gray-600';
  /** Colour for a difference; the 500 shades are unreadable in light mode */
  const deltaTone = (delta: number) =>
    delta > 0
      ? isDarkMode
        ? 'text-emerald-400'
        : 'text-emerald-700'
      : delta < 0
        ? isDarkMode
          ? 'text-red-400'
          : 'text-red-700'
        : mutedTone;

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
        <StatCard label={leftLabel} value={leftScore} isDarkMode={isDarkMode} />
        <StatCard
          label="Difference"
          value={formatDiff(rightScore - leftScore)}
          variant={rightScore >= leftScore ? 'success' : 'danger'}
          isDarkMode={isDarkMode}
        />
        <StatCard
          label={rightLabel}
          value={rightScore}
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
            <Bar dataKey="left" name={leftLabel} fill={CHART_COLORS.primary} />
            <Bar dataKey="right" name={rightLabel} fill={CHART_COLORS.garden} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Side by Side" isDarkMode={isDarkMode}>
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className={`text-xs uppercase tracking-wide ${mutedTone}`}>
              <th scope="col" className="w-[40%] text-left font-semibold pb-2">
                Element
              </th>
              <th scope="col" className="text-right font-semibold pb-2">
                {leftLabel}
              </th>
              <th scope="col" className="text-right font-semibold pb-2">
                {rightLabel}
              </th>
              <th scope="col" className="text-right font-semibold pb-2">
                Diff
              </th>
            </tr>
          </thead>
          <tbody>
            {leftRows.map((row, i) => {
              const delta = rightRows[i].points - row.points;
              return (
                <tr
                  key={row.key}
                  className={row.informational ? mutedTone : cellTone}
                >
                  <th
                    scope="row"
                    className="text-left font-normal py-1.5 pr-2 break-words"
                  >
                    {row.label}
                    {row.informational && ' (not scored)'}
                  </th>
                  <td className="text-right tabular-nums font-semibold py-1.5">
                    {row.points}
                  </td>
                  <td className="text-right tabular-nums font-semibold py-1.5">
                    {rightRows[i].points}
                  </td>
                  <td className="py-1.5">
                    {row.informational ? (
                      // More points handed to the opponent is not a gain,
                      // so this row gets no up/down colouring.
                      <span className="block text-right tabular-nums">
                        {formatDiff(delta)}
                      </span>
                    ) : (
                      <span className="flex items-center justify-end gap-1.5 tabular-nums">
                        <TrendIcon value={delta} size={14} />
                        <span className={deltaTone(delta)}>
                          {formatDiff(delta)}
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr
              className={`border-t font-bold ${
                isDarkMode
                  ? 'border-gray-700 text-white'
                  : 'border-gray-200 text-gray-900'
              }`}
            >
              <th scope="row" className="text-left pt-3">
                Total
              </th>
              <td className="text-right tabular-nums pt-3">{leftScore}</td>
              <td className="text-right tabular-nums pt-3">{rightScore}</td>
              <td
                className={`text-right tabular-nums pt-3 ${deltaTone(rightScore - leftScore)}`}
              >
                {formatDiff(rightScore - leftScore)}
              </td>
            </tr>
            {/* Earned on top of the score, so listed under the total */}
            <tr className={cellTone}>
              <th
                scope="row"
                className="text-left font-normal pt-2 pr-2 break-words"
              >
                Ranking Points
              </th>
              <td className="text-right tabular-nums font-semibold pt-2">
                {leftRp.total}
              </td>
              <td className="text-right tabular-nums font-semibold pt-2">
                {rightRp.total}
              </td>
              <td className="pt-2">
                <span className="flex items-center justify-end gap-1.5 tabular-nums">
                  <TrendIcon value={rpDelta} size={14} />
                  <span className={deltaTone(rpDelta)}>
                    {formatDiff(rpDelta)}
                  </span>
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
        <ul className={`mt-3 space-y-0.5 text-xs ${mutedTone}`}>
          {[
            { label: leftLabel, rp: leftRp },
            { label: rightLabel, rp: rightRp },
          ].map(({ label, rp }, i) => (
            <li key={i}>
              {label}:{' '}
              {rankingPointNames(rp).join(', ') ||
                'no ranking points from scoring'}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
};

/**
 * Read-only view of a session recorded in an earlier season. Its matches
 * carry none of this season's scoring fields, so the only figure that means
 * anything is the final score saved with each match - recomputing it under
 * this season's rules would read 0.
 */
export const LegacySeasonView = ({
  matches,
  season,
  isDarkMode,
}: {
  matches: Match[];
  /** Season tag stored on the session, e.g. 'decode' */
  season?: string;
  isDarkMode: boolean;
}) => {
  const scores = matches.map(m => m.finalScore ?? 0);
  const name = (season || 'decode').toUpperCase();
  const muted = isDarkMode ? 'text-team-white-60' : 'text-gray-600';

  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border p-4 text-sm leading-relaxed ${
          isDarkMode
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            : 'border-amber-300 bg-amber-50 text-amber-900'
        }`}
      >
        This session was recorded in the {name} season, which was scored
        differently. It is kept as it was saved and can't be edited; only the
        saved final scores are shown.
      </div>

      {scores.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Avg Score"
            value={Math.round(mean(scores))}
            sublabel={plural(scores.length, 'match', 'matches')}
            isDarkMode={isDarkMode}
          />
          <StatCard
            label="Best Score"
            value={Math.max(...scores)}
            variant="success"
            isDarkMode={isDarkMode}
          />
          <StatCard
            label="Worst Score"
            value={Math.min(...scores)}
            variant="danger"
            isDarkMode={isDarkMode}
          />
        </div>
      )}

      <Section title="Matches" isDarkMode={isDarkMode}>
        {matches.length === 0 ? (
          <p className={`text-sm ${muted}`}>No matches recorded.</p>
        ) : (
          <ul className="space-y-2">
            {matches.map((m, i) => (
              <li
                key={m.id}
                className={`flex items-center justify-between gap-4 text-sm py-1.5 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                <span>
                  Match {m.matchNumber || i + 1}
                  {m.matchType && (
                    <span className={muted}> - {m.matchType}</span>
                  )}
                </span>
                <span className="font-bold tabular-nums text-team-blue">
                  {plural(m.finalScore ?? 0, 'pt')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
};
