/* eslint-disable react-refresh/only-export-components */

import { useState, useEffect, useRef, useId, useCallback } from 'react';
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
  Check,
  Info,
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
import type { Match, SessionType } from '@/types';
import { useIsCompact } from '@/hooks';
import type { RankingPointTally, ScoreRow, Tone } from '@/lib';
import {
  CHART_COLORS,
  ELEMENT_COLORS,
  ELEMENT_LABELS,
  POINTS,
  RANKING_POINTS,
  SERIES_COLORS,
  calculateScore,
  cycleTimesOf,
  includesAuto,
  includesTeleop,
  matchScore,
  rankingPoints,
  rankingPointNames,
  rankingPointTally,
  robotRates,
  sanitizeHtml,
  scoreRows,
  toDate,
  toneOf,
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

/** Small controls grow to a thumb-sized target on touch screens. */
const TOUCH_TARGET =
  '[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

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
  total,
  hint,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    /** The data row: `title` names the match in full */
    payload?: { title?: string };
  }>;
  label?: string;
  isDarkMode?: boolean;
  /** Written after every value: ' pts', 's' */
  unit?: string;
  /** Add a row that sums the series, for a stack that adds up to a score */
  total?: boolean;
  /** A last quiet line, e.g. what a click on this column does */
  hint?: string;
}) => {
  if (!active || !payload?.length) return null;
  const title = payload[0].payload?.title ?? label;
  const format = (value: number) => `${formatNumber(value)}${unit ?? ''}`;
  const sum = payload.reduce(
    (acc, entry) => acc + (typeof entry.value === 'number' ? entry.value : 0),
    0
  );
  const nameTone = isDarkMode ? 'text-team-white-60' : 'text-gray-600';
  // The series colour is on the dot: as text most of them are under 4.5:1.
  const valueTone = isDarkMode ? 'text-white' : 'text-gray-900';
  return (
    <div
      className={`p-3 rounded-lg border shadow-xl backdrop-blur-sm ${
        isDarkMode
          ? 'bg-team-dark/95 border-team-blue-40'
          : 'bg-white/95 border-gray-200'
      }`}
    >
      {title && (
        <p
          className={`font-semibold mb-2 pb-2 border-b text-xs ${
            isDarkMode
              ? 'text-white border-team-blue-40'
              : 'text-gray-900 border-gray-200'
          }`}
        >
          {title}
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
              <span className={`text-xs ${nameTone}`}>{entry.name}</span>
            </div>
            <span className={`text-xs font-bold tabular-nums ${valueTone}`}>
              {typeof entry.value === 'number'
                ? format(entry.value)
                : entry.value}
            </span>
          </div>
        ))}
        {total && (
          <div
            className={`flex items-center justify-between gap-4 pt-1 mt-1 border-t ${
              isDarkMode ? 'border-team-blue-40' : 'border-gray-200'
            }`}
          >
            <span className={`text-xs font-semibold ${valueTone}`}>Total</span>
            <span className={`text-xs font-bold tabular-nums ${valueTone}`}>
              {format(sum)}
            </span>
          </div>
        )}
      </div>
      {hint && <p className={`mt-2 text-[11px] ${nameTone}`}>{hint}</p>}
    </div>
  );
};

/**
 * One figure with its label above and a line of context below.
 *
 * Every tile has the same three rows, and inside a grid they are the grid's
 * own rows (subgrid), so the figures of neighbouring tiles line up even when
 * one label wraps. `info` adds an (i) that opens a one-line definition;
 * `onClick` makes the whole tile a button (and takes the place of `info`).
 */
export const StatCard = ({
  label,
  value,
  sublabel,
  info,
  onClick,
  highlight,
  variant = 'default',
  isDarkMode,
  className = '',
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  /** What the figure means, in a sentence */
  info?: string;
  /** Where the figure leads - the match it names */
  onClick?: () => void;
  highlight?: boolean;
  variant?: 'default' | 'success' | 'danger';
  isDarkMode: boolean;
  /** Grid placement, e.g. a column span */
  className?: string;
}) => {
  const [showInfo, setShowInfo] = useState(false);

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

  // The 500 shades are unreadable on the pale light-theme cards.
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

  const muted = isDarkMode ? 'text-team-white-60' : 'text-gray-600';
  const box = `relative row-span-3 grid grid-rows-subgrid gap-y-0 content-start min-w-0 rounded-xl border p-3 sm:p-5 text-left ${borderBg} ${className}`;

  // A button may only hold phrasing content, so its rows are spans.
  const Row = onClick ? 'span' : 'p';
  const labelRow = (
    // Room on the right for the (i), which sits in the corner
    <Row
      className={`block text-xs font-medium uppercase tracking-wide ${muted} ${info && !onClick ? 'pr-6' : ''}`}
    >
      {label}
    </Row>
  );
  const valueRow = (
    <Row
      className={`block text-2xl sm:text-3xl font-bold tabular-nums ${valueColor} mt-1`}
    >
      {value}
    </Row>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${box} cursor-pointer transition-colors ${
          isDarkMode ? 'hover:bg-white/10' : 'hover:brightness-95'
        }`}
      >
        {labelRow}
        {valueRow}
        <span
          className={`mt-1 self-start justify-self-start inline-flex items-center gap-0.5 text-xs font-semibold underline underline-offset-2 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}
        >
          {sublabel}
          <ChevronRight size={14} aria-hidden />
        </span>
      </button>
    );
  }

  return (
    <div className={box}>
      {labelRow}
      {valueRow}
      <div>
        {sublabel && <p className={`text-xs mt-1 ${muted}`}>{sublabel}</p>}
        {info && showInfo && (
          <p
            className={`text-xs mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
          >
            {info}
          </p>
        )}
      </div>
      {info && (
        <button
          type="button"
          title={info}
          aria-label={`About ${label}`}
          aria-expanded={showInfo}
          onClick={() => setShowInfo(v => !v)}
          className={`absolute top-0.5 right-0.5 sm:top-2.5 sm:right-2.5 inline-flex items-center justify-center rounded-full p-2 transition-colors ${TOUCH_TARGET} ${
            isDarkMode
              ? 'text-gray-400 hover:text-team-blue'
              : 'text-gray-500 hover:text-team-blue'
          }`}
        >
          <Info size={15} />
        </button>
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
  hint,
  children,
  isDarkMode,
}: {
  title: string;
  /** A quiet line beside the title, e.g. what a click does */
  hint?: string;
  children: React.ReactNode;
  isDarkMode: boolean;
}) => (
  <div
    className={`rounded-xl border p-4 sm:p-6 ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`}
  >
    <div className="flex items-baseline justify-between gap-x-4 gap-y-1 flex-wrap mb-4 sm:mb-5">
      <h3
        className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
      >
        {title}
      </h3>
      {hint && (
        <p
          className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
        >
          {hint}
        </p>
      )}
    </div>
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

/** How many of the chances were taken */
interface Tally {
  made: number;
  chances: number;
}

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
  /** The counts behind `leaveRate` and `parkRate` */
  leaves: Tally;
  parks: Tally;
  /** Average seconds between Hive Tips, or null if never recorded */
  avgCycle: number | null;
  /** How many tip-to-tip gaps `avgCycle` is the average of */
  cycleCount: number;
  /**
   * How far a match typically lands from the average, in points (the
   * standard deviation of the scores). Null with fewer than two matches.
   */
  scoreSpread: number | null;
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

/**
 * Leaves and parks made, out of the chances the periods that were run gave.
 * Counted the way `robotRates` counts them, which only reports percentages.
 */
const robotTallies = (matches: Match[]): { leaves: Tally; parks: Tally } => {
  const leaves: Tally = { made: 0, chances: 0 };
  const parks: Tally = { made: 0, chances: 0 };
  for (const m of matches) {
    if (includesAuto(m.matchType)) {
      leaves.chances += 2;
      leaves.made += (m.robot1Leave ? 1 : 0) + (m.robot2Leave ? 1 : 0);
      parks.chances += 2;
      parks.made += (m.robot1ParkAuto ? 1 : 0) + (m.robot2ParkAuto ? 1 : 0);
    }
    if (includesTeleop(m.matchType)) {
      parks.chances += 2;
      parks.made += (m.robot1ParkTeleop ? 1 : 0) + (m.robot2ParkTeleop ? 1 : 0);
    }
  }
  return { leaves, parks };
};

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
    ...robotTallies(matches),
    avgCycle:
      allCycles.length > 0 ? Math.round(mean(allCycles) * 100) / 100 : null,
    cycleCount: allCycles.length,
    scoreSpread: matches.length < 2 ? null : Math.round(Math.sqrt(variance)),
    rankingPoints: rankingPointTally(matches),
    totalMatches: matches.length,
    bestMatch: scores.indexOf(maxScore),
    worstMatch: scores.indexOf(minScore),
  };
};

/** The shared chart palette, as the colours one theme draws with. */
const chartColors = (isDarkMode: boolean) => {
  const tone = (color: Tone) => toneOf(color, isDarkMode);
  // Compare's two matches: not green or red, which mean better and worse.
  const [matchA, matchB] = SERIES_COLORS[isDarkMode ? 'dark' : 'light'];
  return {
    tipping: tone(ELEMENT_COLORS.tipping),
    garden: tone(ELEMENT_COLORS.garden),
    flower: tone(ELEMENT_COLORS.flower),
    flowerBonus: tone(ELEMENT_COLORS.flowerBonus),
    hive: tone(ELEMENT_COLORS.hive),
    robots: tone(ELEMENT_COLORS.robots),
    minor: tone(ELEMENT_COLORS.minor),
    major: tone(ELEMENT_COLORS.major),
    total: tone(CHART_COLORS.total),
    average: tone(CHART_COLORS.average),
    cycle: tone(CHART_COLORS.cycle),
    matchA,
    matchB,
  };
};

/** The scoring elements a match's bar is stacked from, bottom first */
const SERIES_KEYS = [
  'tipping',
  'garden',
  'flower',
  'flowerBonus',
  'hive',
  'robots',
] as const;

/**
 * What one of each breakdown row is worth, so a row can show its sum
 * ("3 × 20") instead of a bare count.
 */
const ROW_UNIT_POINTS: Partial<Record<ScoreRow['key'], number>> = {
  tipping: POINTS.HIVE_TIP,
  garden: POINTS.GARDEN,
  flower: POINTS.FLOWER_ELEMENT,
  flowerBonus: POINTS.FLOWER_BONUS,
  hive: POINTS.CELL_REMAINING,
  leave: POINTS.LEAVE,
  park: POINTS.PARK,
};

/** A row's count as a sum that can be checked against its points: "3 × 20" */
const rowSum = (row: ScoreRow): string => {
  const unit = ROW_UNIT_POINTS[row.key];
  return unit === undefined ? `${row.count}` : `${row.count} × ${unit}`;
};

/** Fouls come at two values, so their sum has two terms. */
const foulSum = (m: Match): string => {
  const minor = m.minorPenalties ?? 0;
  const major = m.majorPenalties ?? 0;
  const terms = [
    ...(minor > 0 ? [`${minor} minor × ${POINTS.MINOR_PENALTY}`] : []),
    ...(major > 0 ? [`${major} major × ${POINTS.MAJOR_PENALTY}`] : []),
  ];
  return terms.join(' + ') || 'none';
};

export type TabId = 'summary' | 'matches' | 'compare';

export const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'summary', label: 'Summary', icon: BarChart3 },
  { id: 'matches', label: 'Matches', icon: LayoutList },
  { id: 'compare', label: 'Compare', icon: ArrowRightLeft },
];

/** DOM ids tying each tab button to the panel it shows */
export const tabButtonId = (id: TabId) => `analysis-tab-${id}`;
export const tabPanelId = (id: TabId) => `analysis-panel-${id}`;

/**
 * Which tab an analysis page shows and which match is selected in it, with
 * the jump from a figure or chart column that names a match to that match.
 */
export const useAnalysisNav = () => {
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const openMatch = useCallback((index: number) => {
    setSelectedIdx(index);
    setActiveTab('matches');
    // The tiles and charts that lead here sit at any height on the page;
    // the match opens under the tabs, so those have to be on screen.
    requestAnimationFrame(() => {
      const tabs = document.getElementById(tabButtonId('matches'));
      if (!tabs) return;
      const header =
        document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
      const top = tabs.getBoundingClientRect().top;
      // A jump, not the page's smooth scroll: the content has changed anyway.
      if (top < header + 8) {
        window.scrollBy({ top: top - header - 12, behavior: 'instant' });
      }
    });
  }, []);

  return { activeTab, setActiveTab, selectedIdx, setSelectedIdx, openMatch };
};

/**
 * The Summary / Matches / Compare switcher: icon over label on a phone,
 * side by side from `sm` up. Wrap the content it switches in
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
      // The track is lighter than the page in the dark themes, where the
      // page's own colour on it would not show at all.
      className={`flex gap-1 p-1 rounded-xl border ${
        isDarkMode
          ? 'bg-white/5 border-team-blue-40'
          : 'bg-gray-100 border-gray-200'
      }`}
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
            aria-selected={isActive}
            aria-controls={isActive ? tabPanelId(tab.id) : undefined}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`flex-1 min-w-0 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-lg text-xs sm:text-sm transition-colors [@media(pointer:coarse)]:min-h-11 ${
              isActive
                ? `bg-team-blue font-semibold shadow-sm ${onTeamBlue(isDarkMode)}`
                : `font-medium ${
                    isDarkMode
                      ? 'text-team-white-60 hover:text-white hover:bg-white/5'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
                  }`
            }`}
          >
            <Icon size={16} aria-hidden />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

/** A stored timestamp as a date, or null when there isn't a real one */
const dateOf = (value: unknown): Date | null => {
  if (!value) return null;
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * A recorded session length in words: "48:12" is "48 min", "1:22:40" is
 * "1 h 23 min". Anything that isn't a clock reading is shown as it is.
 */
const durationLabel = (duration: string): string => {
  const parts = duration.split(':').map(Number);
  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some(n => !Number.isFinite(n) || n < 0)
  ) {
    return duration;
  }
  const seconds = parts.reduce((total, n) => total * 60 + n, 0);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

/**
 * The line under a session's name that says what it was and when:
 * "Practice · Full Game · Wed, Sep 30, 2026 · 6 matches · 48 min".
 * Whatever isn't known is left out.
 */
export const SessionMeta = ({
  sessionType,
  matchType,
  createdAt,
  matchCount,
  duration,
  isDarkMode,
}: {
  sessionType?: SessionType;
  matchType?: string;
  /** When the session was recorded: a stored timestamp or an ISO string */
  createdAt?: unknown;
  matchCount: number;
  /** As stored, "MM:SS" or "H:MM:SS" */
  duration?: string;
  isDarkMode: boolean;
}) => {
  const date = dateOf(createdAt);
  const parts: { key: string; node: React.ReactNode }[] = [
    ...(sessionType ? [{ key: 'type', node: sessionType }] : []),
    ...(matchType ? [{ key: 'matchType', node: matchType }] : []),
    ...(date
      ? [
          {
            key: 'date',
            node: (
              <time
                dateTime={date.toISOString()}
                title={date.toLocaleString('en-US', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                })}
              >
                {date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </time>
            ),
          },
        ]
      : []),
    { key: 'matches', node: plural(matchCount, 'match', 'matches') },
    ...(duration && duration !== '00:00'
      ? [{ key: 'duration', node: durationLabel(duration) }]
      : []),
  ];

  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
    >
      {parts.map((part, i) => (
        // The dot trails its part, so a wrapped line never starts with one
        <span key={part.key} className="inline-flex items-center gap-x-2">
          <span className="whitespace-nowrap">{part.node}</span>
          {i < parts.length - 1 && <span aria-hidden>·</span>}
        </span>
      ))}
    </p>
  );
};

/** Lines of notes shown before "Show more" */
const NOTES_CLAMP_LINES = 3;
/** Notes this many lines long are shown whole: hiding a line or two saves nothing */
const NOTES_WHOLE_LINES = 5;

/**
 * A session's notes. With `clamp` only the first three lines show until
 * "Show more" is pressed, so long notes don't push the charts down.
 */
export const SessionNotes = ({
  notes,
  isDarkMode,
  clamp = false,
}: {
  /** Rich-text HTML as stored; sanitized here */
  notes: string;
  isDarkMode: boolean;
  clamp?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [clampHeight, setClampHeight] = useState<number | null>(null);
  const [overflows, setOverflows] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyId = useId();

  // Whether there is more than three lines can only be measured, and
  // changes with the width of the page.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !clamp) return;
    const observer = new ResizeObserver(() => {
      const line = parseFloat(getComputedStyle(body).lineHeight);
      if (!Number.isFinite(line)) return;
      setClampHeight(line * NOTES_CLAMP_LINES);
      setOverflows(body.scrollHeight > line * NOTES_WHOLE_LINES + 2);
    });
    observer.observe(body);
    return () => observer.disconnect();
  }, [clamp, notes]);

  const clamped = clamp && overflows && !expanded;

  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`}
    >
      <h3
        className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
      >
        Notes
      </h3>
      {/* contain:paint keeps whatever the notes hold inside this box */}
      <div
        ref={bodyRef}
        id={bodyId}
        style={clamped && clampHeight ? { maxHeight: clampHeight } : undefined}
        className={`[contain:paint] relative overflow-hidden text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${isDarkMode ? "text-team-white-60 [&_[style*='background-color']]:text-black" : 'text-gray-600'} [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5`}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(notes) }}
      />
      {clamp && overflows && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded(v => !v)}
          className="mt-1 inline-flex items-center text-sm font-semibold text-team-blue underline underline-offset-4 [@media(pointer:coarse)]:min-h-11"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

const axisProps = (isDarkMode: boolean) => ({
  stroke: isDarkMode ? '#64748b' : '#94a3b8',
  fontSize: 12,
});

/**
 * The band behind the hovered column of a bar chart. The library's own is a
 * light grey block, which glares on the dark cards.
 */
const barCursor = (isDarkMode: boolean) => ({
  fill: isDarkMode ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)',
});

/** A chart row that stands for one match */
interface MatchRow {
  /** Axis tick: "M3" */
  name: string;
  /** Tooltip heading: "Match 3" */
  title: string;
  /** Position of the match in the session */
  matchIndex: number;
}

const matchRow = (m: Match, matchIndex: number): MatchRow => ({
  name: `M${m.matchNumber}`,
  title: `Match ${m.matchNumber}`,
  matchIndex,
});

export const SummaryTab = ({
  matches,
  stats,
  isDarkMode,
  sessionType,
  onOpenMatch,
}: {
  matches: Match[];
  stats: SessionStats;
  isDarkMode: boolean;
  /** Practice sessions leave the foul figures out */
  sessionType?: SessionType;
  /**
   * Show one match (by its position in `matches`). With it the Best and
   * Worst tiles and the chart columns lead to their match.
   */
  onOpenMatch?: (index: number) => void;
}) => {
  const [elementView, setElementView] = useState<'points' | 'counts'>('points');
  const fouls = showsFouls(sessionType, matches);
  const colors = chartColors(isDarkMode);
  const chartStyle = onOpenMatch ? { cursor: 'pointer' } : undefined;

  // A click anywhere in a match's column of a chart opens that match. On a
  // touch screen a tap is also how the column's tooltip is read, so there
  // the first tap shows the tooltip and a second one opens the match.
  const [tapped, setTapped] = useState<string | null>(null);
  const canHover =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover)').matches;
  const openHint = !onOpenMatch
    ? undefined
    : canHover
      ? 'Click a match to open it'
      : 'Tap a match twice to open it';
  const tooltipHint = !onOpenMatch
    ? undefined
    : canHover
      ? 'Click to open this match'
      : 'Tap again to open this match';
  const openFromChart = (chart: string, rows: MatchRow[]) =>
    onOpenMatch
      ? (state: { activeTooltipIndex?: number | string | null }) => {
          const index = state.activeTooltipIndex;
          if (index === null || index === undefined || index === '') return;
          const row = rows[Number(index)];
          if (!row) return;
          const column = `${chart}:${row.matchIndex}`;
          if (!canHover && tapped !== column) {
            setTapped(column);
            return;
          }
          onOpenMatch(row.matchIndex);
        }
      : undefined;

  // The average is a series of its own so the legend and the tooltip name
  // the dashed line.
  const trendData = matches.map((m, i) => ({
    ...matchRow(m, i),
    score: scoreOf(m),
    average: stats.avgScore,
  }));

  const elementData = matches.map((m, i) => {
    const b = calculateScore(m);
    if (elementView === 'points') {
      return {
        ...matchRow(m, i),
        tipping: b.tipping,
        garden: b.garden,
        flower: b.flower,
        flowerBonus: b.flowerBonus,
        hive: b.hive,
        robots: b.leave + b.park,
      };
    }
    // Leaves and parks as scored: a period the match never ran counts none.
    const robots = scoreRows(m)
      .filter(row => row.key === 'leave' || row.key === 'park')
      .reduce((sum, row) => sum + row.count, 0);
    return {
      ...matchRow(m, i),
      tipping: m.tipping ?? 0,
      garden: m.garden ?? 0,
      flower: m.flower ?? 0,
      flowerBonus: m.flowerBonus ?? 0,
      hive: m.ballsInHive ?? 0,
      robots,
    };
  });

  const penaltyData = matches.map((m, i) => ({
    ...matchRow(m, i),
    minor: m.minorPenalties ?? 0,
    major: m.majorPenalties ?? 0,
  }));
  const hasPenalties = penaltyData.some(d => d.minor + d.major > 0);

  const cycleData = matches.flatMap((m, i) => {
    const cycles = cycleTimesOf(m);
    return cycles.length === 0
      ? []
      : [{ ...matchRow(m, i), cycle: mean(cycles) }];
  });

  // Session-average element mix, used for the contribution bars.
  const avgRows = [
    {
      label: ELEMENT_LABELS.tipping,
      value: stats.avgTipping,
      color: colors.tipping,
    },
    {
      label: ELEMENT_LABELS.garden,
      value: stats.avgGarden,
      color: colors.garden,
    },
    {
      label: ELEMENT_LABELS.flower,
      value: stats.avgFlower,
      color: colors.flower,
    },
    {
      label: ELEMENT_LABELS.flowerBonus,
      value: stats.avgFlowerBonus,
      color: colors.flowerBonus,
    },
    { label: ELEMENT_LABELS.hive, value: stats.avgHive, color: colors.hive },
    { label: ELEMENT_LABELS.leave, value: stats.avgLeave, color: colors.robots },
    { label: ELEMENT_LABELS.park, value: stats.avgPark, color: colors.robots },
  ];
  const avgMax = Math.max(1, ...avgRows.map(r => Math.abs(r.value)));

  const rp = stats.rankingPoints;
  const n = stats.totalMatches;
  const bestNumber = matches[stats.bestMatch]?.matchNumber ?? stats.bestMatch + 1;
  const worstNumber =
    matches[stats.worstMatch]?.matchNumber ?? stats.worstMatch + 1;
  const [pollinator1, pollinator2] = RANKING_POINTS.POLLINATOR_TIPS;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Two tiles a row on a phone; the ninth (fouls) takes a full row there */}
      <div
        className={`grid grid-cols-2 gap-2 sm:gap-4 ${fouls ? 'sm:grid-cols-3' : 'md:grid-cols-4'}`}
      >
        <StatCard
          label="Average Score"
          value={stats.avgScore}
          sublabel={`across ${plural(n, 'match', 'matches')}`}
          highlight
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Best Match"
          value={stats.maxScore}
          sublabel={`Match ${bestNumber}`}
          variant="success"
          onClick={onOpenMatch && (() => onOpenMatch(stats.bestMatch))}
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Worst Match"
          value={stats.minScore}
          sublabel={`Match ${worstNumber}`}
          variant="danger"
          onClick={onOpenMatch && (() => onOpenMatch(stats.worstMatch))}
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Typical swing"
          value={stats.scoreSpread === null ? '-' : `±${stats.scoreSpread} pts`}
          sublabel={
            stats.scoreSpread === null
              ? 'needs 2+ matches'
              : `range ${stats.minScore}-${stats.maxScore}`
          }
          info="How far a match usually lands from the average score (the standard deviation of the match scores)."
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Leave Rate"
          value={stats.leaveRate === null ? '-' : `${stats.leaveRate}%`}
          sublabel={
            stats.leaveRate === null
              ? 'no autonomous run'
              : `Leave ${stats.leaves.made} of ${stats.leaves.chances}`
          }
          info="Robots that left in auto, out of two for every match that ran an autonomous period."
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Park Rate"
          value={stats.parkRate === null ? '-' : `${stats.parkRate}%`}
          sublabel={
            stats.parkRate === null
              ? 'no park chances'
              : `Park ${stats.parks.made} of ${stats.parks.chances}`
          }
          info="Parks made out of the chances: two robots at the end of auto and two at the end of the match, for the periods each match ran."
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="RP Rate"
          value={rp.rate === null ? '-' : `${rp.rate}%`}
          sublabel={`${rp.earned} of ${rp.possible} RP · SWARM ${rp.swarm}/${n} · POLLINATOR 1 ${rp.pollinator1}/${n} · POLLINATOR 2 ${rp.pollinator2}/${n}`}
          info={`Share of the ranking points scoring can earn, three a match: SWARM at ${RANKING_POINTS.SWARM_ROBOT_POINTS} Leave + Park points, POLLINATOR at ${pollinator1} and at ${pollinator2} Hive Tips.`}
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Avg time between tips"
          value={stats.avgCycle !== null ? `${stats.avgCycle.toFixed(1)}s` : '-'}
          sublabel={
            stats.avgCycle !== null
              ? `over ${plural(stats.cycleCount, 'gap')}`
              : 'needs 2+ Hive Tips scored live'
          }
          info="Average seconds from one Hive Tip to the next within a match, from tips tapped live."
          isDarkMode={isDarkMode}
        />
        {fouls && (
          <StatCard
            label="Avg points given to opponent"
            value={stats.avgPenalties}
            sublabel="per match, from your fouls - not taken off your score"
            variant={stats.avgPenalties > 0 ? 'danger' : 'default'}
            className="col-span-2 sm:col-span-1"
            isDarkMode={isDarkMode}
          />
        )}
      </div>

      <Section title="Score Trend" hint={openHint} isDarkMode={isDarkMode}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={trendData}
            onClick={openFromChart('trend', trendData)}
            style={chartStyle}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDarkMode ? '#334155' : '#e2e8f0'}
            />
            <XAxis dataKey="name" {...axisProps(isDarkMode)} />
            <YAxis width={40} {...axisProps(isDarkMode)} />
            <Tooltip
              content={
                <ChartTooltip
                  isDarkMode={isDarkMode}
                  unit=" pts"
                  hint={tooltipHint}
                />
              }
            />
            <Legend itemSorter={null} />
            <Line
              type="monotone"
              dataKey="score"
              name="Final Score"
              stroke={colors.total}
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 7 }}
            />
            <Line
              dataKey="average"
              name="Session average"
              stroke={colors.average}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              legendType="plainline"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
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

      <Section title="Scoring by Match" hint={openHint} isDarkMode={isDarkMode}>
        <div className="flex gap-2 mb-4">
          {(['points', 'counts'] as const).map(view => (
            <button
              key={view}
              type="button"
              aria-pressed={elementView === view}
              onClick={() => setElementView(view)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-4 ${
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
          <BarChart
            data={elementData}
            onClick={openFromChart('elements', elementData)}
            style={chartStyle}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDarkMode ? '#334155' : '#e2e8f0'}
            />
            <XAxis dataKey="name" {...axisProps(isDarkMode)} />
            <YAxis width={40} {...axisProps(isDarkMode)} />
            <Tooltip
              cursor={barCursor(isDarkMode)}
              content={
                elementView === 'points' ? (
                  <ChartTooltip
                    isDarkMode={isDarkMode}
                    unit=" pts"
                    total
                    hint={tooltipHint}
                  />
                ) : (
                  <ChartTooltip isDarkMode={isDarkMode} hint={tooltipHint} />
                )
              }
            />
            {/* Unsorted, the legend reads in the order the bars are stacked */}
            <Legend itemSorter={null} />
            {SERIES_KEYS.map(key => (
              <Bar
                key={key}
                dataKey={key}
                name={ELEMENT_LABELS[key]}
                stackId="a"
                fill={colors[key]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <div
        className={`grid grid-cols-1 gap-4 sm:gap-6 ${fouls ? 'lg:grid-cols-2' : ''}`}
      >
        {fouls && (
          <Section
            title="Fouls (points go to the opponent)"
            isDarkMode={isDarkMode}
          >
            {hasPenalties ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={penaltyData}
                  onClick={openFromChart('fouls', penaltyData)}
                  style={chartStyle}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDarkMode ? '#334155' : '#e2e8f0'}
                  />
                  <XAxis dataKey="name" {...axisProps(isDarkMode)} />
                  <YAxis
                    width={40}
                    allowDecimals={false}
                    {...axisProps(isDarkMode)}
                  />
                  <Tooltip
                    cursor={barCursor(isDarkMode)}
                    content={
                      <ChartTooltip
                        isDarkMode={isDarkMode}
                        hint={tooltipHint}
                      />
                    }
                  />
                  <Legend itemSorter={null} />
                  <Bar
                    dataKey="minor"
                    name={ELEMENT_LABELS.minor}
                    fill={colors.minor}
                  />
                  <Bar
                    dataKey="major"
                    name={ELEMENT_LABELS.major}
                    fill={colors.major}
                  />
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

        <Section title="Time Between Hive Tips" isDarkMode={isDarkMode}>
          {cycleData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={cycleData}
                onClick={openFromChart('cycle', cycleData)}
                style={chartStyle}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDarkMode ? '#334155' : '#e2e8f0'}
                />
                <XAxis dataKey="name" {...axisProps(isDarkMode)} />
                <YAxis width={40} unit="s" {...axisProps(isDarkMode)} />
                <Tooltip
                  content={
                    <ChartTooltip
                      isDarkMode={isDarkMode}
                      unit="s"
                      hint={tooltipHint}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="cycle"
                  name="Avg time between tips"
                  stroke={colors.cycle}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart
              message="No times yet - needs 2+ Hive Tips scored live"
              isDarkMode={isDarkMode}
            />
          )}
        </Section>
      </div>
    </div>
  );
};

/** "Best" or "Worst" beside a match: a word and an icon, not colour alone */
const RankMark = ({
  rank,
  isDarkMode,
  className = '',
}: {
  rank: 'best' | 'worst';
  isDarkMode: boolean;
  className?: string;
}) => {
  const Icon = rank === 'best' ? TrendingUp : TrendingDown;
  const tone =
    rank === 'best'
      ? isDarkMode
        ? 'text-emerald-400'
        : 'text-emerald-700'
      : isDarkMode
        ? 'text-red-400'
        : 'text-red-700';
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold uppercase tracking-wide ${tone} ${className}`}
    >
      <Icon size={12} aria-hidden />
      {rank === 'best' ? 'Best' : 'Worst'}
    </span>
  );
};

/** Which matches scored highest and lowest; neither when every score is equal */
const rankOf = (matches: Match[]) => {
  const scores = matches.map(scoreOf);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const best = max === min ? -1 : scores.indexOf(max);
  const worst = max === min ? -1 : scores.indexOf(min);
  return (index: number): 'best' | 'worst' | null =>
    index === best ? 'best' : index === worst ? 'worst' : null;
};

/**
 * How long the Delete in a just-opened question ignores presses, so the
 * second tap of a double tap can't answer it.
 */
const CONFIRM_ARM_MS = 500;

/**
 * "Delete Match 3 (31 pts)?" in place of the buttons that asked. Keep sits
 * on the right, where Delete was, so a second press on the same spot
 * changes nothing; it also takes the keyboard focus.
 */
const DeleteMatchConfirm = ({
  question,
  onKeep,
  onDelete,
  isDarkMode,
}: {
  question: string;
  onKeep: () => void;
  onDelete: () => void;
  isDarkMode: boolean;
}) => {
  const questionId = useId();
  const keepRef = useRef<HTMLButtonElement>(null);
  const shownAt = useRef(0);

  useEffect(() => {
    shownAt.current = Date.now();
    keepRef.current?.focus({ preventScroll: true });
  }, []);

  const button =
    'inline-flex items-center justify-center px-3 py-2 rounded-lg border text-sm font-semibold transition-colors [@media(pointer:coarse)]:min-h-11';

  return (
    <div
      role="group"
      aria-labelledby={questionId}
      onKeyDown={e => {
        if (e.key === 'Escape') onKeep();
      }}
      // One row at any width - a long question wraps within itself - so the
      // buttons stay where the ones they replace were.
      className="flex items-center justify-end gap-2 ml-auto min-w-0"
    >
      <p
        id={questionId}
        className={`min-w-0 text-right text-sm font-semibold leading-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
      >
        {question}
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            if (Date.now() - shownAt.current >= CONFIRM_ARM_MS) onDelete();
          }}
          className={`${button} border-red-600 bg-red-600 text-white hover:bg-red-700`}
        >
          Delete
        </button>
        <button
          ref={keepRef}
          type="button"
          onClick={onKeep}
          // As wide as the Delete button it replaces, to cover all of it
          className={`${button} min-w-[5.75rem] ${
            isDarkMode
              ? 'border-team-blue-40 text-white hover:bg-white/5'
              : 'border-gray-300 text-gray-800 hover:bg-gray-50'
          }`}
        >
          Keep
        </button>
      </div>
    </div>
  );
};

export const MatchDetailTab = ({
  matches,
  isDarkMode,
  selectedIdx,
  onSelect,
  // Edit/delete/add are optional - omit them for a read-only view
  onEdit,
  onDelete,
  onAdd,
  sessionType,
}: {
  matches: Match[];
  isDarkMode: boolean;
  /**
   * Which match is shown, when the page decides (so a tile or chart can
   * open one). Left out, the tab keeps track by itself.
   */
  selectedIdx?: number;
  onSelect?: (index: number) => void;
  onEdit?: (match: Match) => void;
  onDelete?: (matchId: string) => void;
  onAdd?: () => void;
  /** Practice sessions leave the foul line out */
  sessionType?: SessionType;
}) => {
  const [ownIdx, setOwnIdx] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Clamped here rather than stored: the list shrinks under it on a delete.
  const idx = Math.max(
    0,
    Math.min(selectedIdx ?? ownIdx, matches.length - 1)
  );
  const select = (index: number) => {
    setOwnIdx(index);
    onSelect?.(index);
  };

  // Keep the selected match's chip in view in the strip, without moving
  // the page.
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.children[idx] as HTMLElement | undefined;
    if (!strip || !chip) return;
    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left < strip.scrollLeft) {
      strip.scrollLeft = left - 8;
    } else if (right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = right - strip.clientWidth + 8;
    }
  }, [idx, matches.length]);

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
            className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-team-blue text-sm font-semibold ${onTeamBlue(isDarkMode)}`}
          >
            <Plus size={16} /> Add Match
          </button>
        )}
      </div>
    );
  }

  const match = matches[idx];
  const breakdown = calculateScore(match);
  // The foul row is not one of the rows that add up to the total.
  const allRows = scoreRows(match);
  const rows = allRows.filter(row => !row.informational);
  const foulRow = allRows.find(row => row.informational);
  const fouls = showsFouls(sessionType, matches);
  const cycles = cycleTimesOf(match);
  const score = scoreOf(match);
  const avgScore = mean(matches.map(scoreOf));
  const diff = Math.round(score - avgScore);
  const rp = rankingPoints(match);
  const rpBadges = rankingPointNames(rp);
  const rank = rankOf(matches);
  const matchRank = rank(idx);
  const confirming = confirmDeleteId === match.id;

  const outline = isDarkMode
    ? 'border-team-blue-40 text-white hover:bg-white/5'
    : 'border-gray-200 text-gray-700 hover:bg-gray-50';
  const stepButton = `shrink-0 inline-flex items-center justify-center p-2 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed ${TOUCH_TARGET} ${outline}`;
  const actionButton = `inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold ${TOUCH_TARGET}`;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* One row however many matches: it scrolls sideways */}
      <div
        ref={stripRef}
        role="group"
        aria-label="Matches in this session"
        className="relative flex gap-2 overflow-x-auto p-1 -m-1"
      >
        {matches.map((m, i) => {
          const chipRank = rank(i);
          return (
            <button
              key={m.id}
              type="button"
              aria-label={`Match ${m.matchNumber}, ${plural(scoreOf(m), 'point')}${chipRank ? `, ${chipRank} match` : ''}`}
              aria-pressed={i === idx}
              onClick={() => select(i)}
              className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors [@media(pointer:coarse)]:min-h-11 ${
                i === idx
                  ? // team-blue itself is 4.2:1 on its own light tint
                    `border-team-blue bg-team-blue/10 ${isDarkMode ? 'text-team-blue' : 'text-[#42606e]'}`
                  : isDarkMode
                    ? 'border-team-blue-40 text-team-white-60 hover:bg-white/5'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              M{m.matchNumber}
              <span className="font-normal tabular-nums">{scoreOf(m)}</span>
              {chipRank && <RankMark rank={chipRank} isDarkMode={isDarkMode} />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-x-4 gap-y-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {/* Side by side, so neither moves as the heading changes length */}
          <button
            type="button"
            aria-label="Previous match"
            disabled={idx === 0}
            onClick={() => select(idx - 1)}
            className={stepButton}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next match"
            disabled={idx >= matches.length - 1}
            onClick={() => select(idx + 1)}
            className={stepButton}
          >
            <ChevronRight size={18} />
          </button>
          <h2
            className={`flex items-center gap-x-2 flex-wrap min-w-0 ml-1 text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          >
            Match {match.matchNumber}
            <span
              className={`font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              · {match.matchType || 'Full Game'}
            </span>
            {matchRank && <RankMark rank={matchRank} isDarkMode={isDarkMode} />}
          </h2>
        </div>

        {confirming && onDelete ? (
          <DeleteMatchConfirm
            question={`Delete Match ${match.matchNumber} (${plural(score, 'pt')})?`}
            onKeep={() => setConfirmDeleteId(null)}
            onDelete={() => {
              setConfirmDeleteId(null);
              onDelete(match.id);
            }}
            isDarkMode={isDarkMode}
          />
        ) : (
          (onAdd || onEdit || onDelete) && (
            <div className="flex items-center gap-2 ml-auto">
              {onAdd && (
                <button
                  type="button"
                  onClick={onAdd}
                  className={`${actionButton} bg-team-blue ${onTeamBlue(isDarkMode)}`}
                >
                  <Plus size={15} /> Add
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(match)}
                  className={`${actionButton} border ${outline}`}
                >
                  <Edit size={15} /> Edit
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(match.id)}
                  className={`${actionButton} min-w-[5.75rem] border border-red-500/40 hover:bg-red-500/10 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}
                >
                  <Trash2 size={15} /> Delete
                </button>
              )}
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
        <StatCard
          label="Final Score"
          value={score}
          highlight
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="vs Session Avg"
          value={formatDiff(diff)}
          sublabel={`average ${Math.round(avgScore)}`}
          variant={diff >= 0 ? 'success' : 'danger'}
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Avg time between tips"
          value={cycles.length > 0 ? `${mean(cycles).toFixed(1)}s` : '-'}
          sublabel={
            cycles.length > 0
              ? `over ${plural(cycles.length, 'gap')}`
              : 'needs 2+ Hive Tips scored live'
          }
          info="Average seconds from one Hive Tip to the next in this match, from tips tapped live."
          className="col-span-2 sm:col-span-1"
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
                    isDarkMode ? 'text-team-white-60' : 'text-gray-600'
                  }
                >
                  {rowSum(row)}
                </span>
                <span className="w-12 sm:w-16 text-right font-bold text-team-blue">
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
              className={`flex items-start justify-between gap-3 text-sm pt-1 ${
                isDarkMode ? 'text-team-white-60' : 'text-gray-600'
              }`}
            >
              <span>
                {foulRow.label} (not part of your score)
                {/* Too long for the count column on a phone */}
                <span className="block tabular-nums sm:hidden">
                  {foulSum(match)}
                </span>
              </span>
              <span className="flex items-start gap-4 tabular-nums text-right">
                <span className="hidden sm:inline">{foulSum(match)}</span>
                <span
                  className={`w-12 sm:w-16 shrink-0 font-bold ${
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
    </div>
  );
};

/** The pair worth looking at first: the worst match against the best. */
const defaultPair = (matches: Match[]): [number, number] => {
  const scores = matches.map(scoreOf);
  const worst = scores.indexOf(Math.min(...scores));
  const best = scores.indexOf(Math.max(...scores));
  return worst === best ? [0, Math.min(1, matches.length - 1)] : [worst, best];
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
  const [[pickedA, pickedB], setPair] = useState(() => defaultPair(matches));
  const isCompact = useIsCompact();

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

  // Clamped here rather than stored: the list can shrink under the picks.
  const aIdx = Math.min(pickedA, matches.length - 1);
  const bIdx = Math.min(pickedB, matches.length - 1);
  const a = matches[aIdx];
  const b = matches[bIdx];
  const fouls = showsFouls(sessionType, matches);
  const colors = chartColors(isDarkMode);
  const rank = rankOf(matches);
  // Fouls aren't part of either score: off the chart, and in the table only
  // for a Scrim.
  const aRows = scoreRows(a).filter(row => fouls || !row.informational);
  const bRows = scoreRows(b).filter(row => fouls || !row.informational);

  // The letter tells the two sides apart even when they share a match
  // number (sessions edited before deletes renumbered) or are one match.
  const aLabel = `A · Match ${a.matchNumber}`;
  const bLabel = `B · Match ${b.matchNumber}`;
  const rankLabel = (index: number) => {
    const r = rank(index);
    return r ? `${r === 'best' ? 'Best' : 'Worst'} match` : undefined;
  };

  const cellTone = isDarkMode ? 'text-gray-300' : 'text-gray-700';
  const mutedTone = isDarkMode ? 'text-team-white-60' : 'text-gray-600';

  const picker = (
    label: string,
    value: number,
    onChange: (i: number) => void
  ) => (
    <label className="col-start-1 sm:flex-1 min-w-0 flex flex-col gap-1">
      <span
        className={`text-xs font-semibold uppercase tracking-wide ${mutedTone}`}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`w-full min-w-0 px-3 py-2 rounded-lg border text-sm font-semibold [@media(pointer:coarse)]:min-h-11 ${
          isDarkMode
            ? 'bg-team-dark border-team-blue-40 text-white'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        {matches.map((m, i) => {
          const r = rank(i);
          return (
            <option key={m.id} value={i}>
              Match {m.matchNumber} · {plural(scoreOf(m), 'pt')}
              {r ? ` (${r})` : ''}
            </option>
          );
        })}
      </select>
    </label>
  );

  // Keyed by side, not by match label: two matches with the same number
  // would otherwise collapse into one series.
  const chartData = aRows
    .map((row, i) => ({
      name: row.label,
      a: row.points,
      b: bRows[i].points,
      informational: row.informational,
    }))
    .filter(row => !row.informational);

  const aScore = scoreOf(a);
  const bScore = scoreOf(b);
  const aRp = rankingPoints(a);
  const bRp = rankingPoints(b);
  const rpDelta = bRp.total - aRp.total;
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

  /** Points with the count that made them underneath: "60" over "3 × 20" */
  const pointsCell = (row: ScoreRow) => (
    <td className="text-right tabular-nums py-1.5 align-top">
      <span className="block font-semibold">{row.points}</span>
      <span className={`block text-xs ${mutedTone}`}>
        {row.informational ? plural(row.count, 'foul') : rowSum(row)}
      </span>
    </td>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stacked on a phone, where two pickers side by side cut their text
          off, with the swap beside the pair; in one row from `sm` up */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:items-end sm:gap-4">
        {picker('Match A', aIdx, i => setPair([i, bIdx]))}
        <button
          type="button"
          aria-label="Swap Match A and Match B"
          title="Swap Match A and Match B"
          onClick={() => setPair([bIdx, aIdx])}
          className={`col-start-2 row-start-1 row-span-2 self-center sm:self-end shrink-0 inline-flex items-center justify-center p-2.5 rounded-lg border ${TOUCH_TARGET} ${
            isDarkMode
              ? 'border-team-blue-40 text-white hover:bg-white/5'
              : 'border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <ArrowRightLeft
            size={18}
            aria-hidden
            className="rotate-90 sm:rotate-0"
          />
        </button>
        {picker('Match B', bIdx, i => setPair([aIdx, i]))}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard
          label={aLabel}
          value={aScore}
          sublabel={rankLabel(aIdx)}
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Change"
          value={formatDiff(bScore - aScore)}
          sublabel="B minus A"
          variant={bScore >= aScore ? 'success' : 'danger'}
          isDarkMode={isDarkMode}
        />
        <StatCard
          label={bLabel}
          value={bScore}
          sublabel={rankLabel(bIdx)}
          isDarkMode={isDarkMode}
        />
      </div>

      <Section title="Element by Element" isDarkMode={isDarkMode}>
        <ResponsiveContainer width="100%" height={300}>
          {/* On a phone the bars run across with every element named down
              the side: under columns that narrow the names collide, and the
              axis drops some of them, the tallest bars' among them. */}
          <BarChart
            data={chartData}
            layout={isCompact ? 'vertical' : 'horizontal'}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDarkMode ? '#334155' : '#e2e8f0'}
            />
            {isCompact ? (
              <>
                <XAxis type="number" {...axisProps(isDarkMode)} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={88}
                  interval={0}
                  {...axisProps(isDarkMode)}
                />
              </>
            ) : (
              <>
                <XAxis dataKey="name" {...axisProps(isDarkMode)} />
                <YAxis width={40} {...axisProps(isDarkMode)} />
              </>
            )}
            <Tooltip
              cursor={barCursor(isDarkMode)}
              content={<ChartTooltip isDarkMode={isDarkMode} unit=" pts" />}
            />
            <Legend itemSorter={null} />
            <Bar dataKey="a" name={aLabel} fill={colors.matchA} />
            <Bar dataKey="b" name={bLabel} fill={colors.matchB} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Side by Side" isDarkMode={isDarkMode}>
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className={`text-xs uppercase tracking-wide ${mutedTone}`}>
              <th scope="col" className="w-[34%] text-left font-semibold pb-2">
                Element
              </th>
              <th scope="col" className="text-right font-semibold pb-2">
                A · M{a.matchNumber}
              </th>
              <th scope="col" className="text-right font-semibold pb-2">
                B · M{b.matchNumber}
              </th>
              <th scope="col" className="text-right font-semibold pb-2">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {aRows.map((row, i) => {
              const delta = bRows[i].points - row.points;
              return (
                <tr
                  key={row.key}
                  className={row.informational ? mutedTone : cellTone}
                >
                  <th
                    scope="row"
                    className="text-left font-normal py-1.5 pr-2 break-words align-top"
                  >
                    {row.label}
                    {row.informational && ' (not scored)'}
                  </th>
                  {pointsCell(row)}
                  {pointsCell(bRows[i])}
                  <td className="py-1.5 align-top">
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
              <td className="text-right tabular-nums pt-3">{aScore}</td>
              <td className="text-right tabular-nums pt-3">{bScore}</td>
              <td
                className={`text-right tabular-nums pt-3 ${deltaTone(bScore - aScore)}`}
              >
                {formatDiff(bScore - aScore)}
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
                {aRp.total}
              </td>
              <td className="text-right tabular-nums font-semibold pt-2">
                {bRp.total}
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
            { label: aLabel, rp: aRp },
            { label: bLabel, rp: bRp },
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
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
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
