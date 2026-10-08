/* eslint-disable react-refresh/only-export-components */

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useId,
  useCallback,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
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
  ChevronDown,
  Check,
  Pencil,
  type LucideIcon,
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
  matchScore,
  rankingPoints,
  rankingPointNames,
  rankingPointTally,
  robotRates,
  scoreRows,
  swarmMissing,
  toDate,
  toneOf,
  htmlToText,
} from '@/lib';
import { formatPoints } from '@/lib/points';
import { GROUPED_ELEMENT_ORDER, robotTallies } from '@/lib/scoring';
import { headlineMatches, typesByCount } from '@/lib/headlineMatches';
import { useArmed } from '@/components/session/controls/useArmed';
import { sanitizeHtml } from '@/lib/sanitize';
import { StatTile, type StatTileProps } from '@/components/ui/stat-tile';
import { Button } from '@/components/ui/button';
import { NotesEditor } from './NotesEditor';
import { Segmented } from '@/components/ui/segmented';
import {
  SECTION_TITLE_CLASS,
  EYEBROW_CLASS,
} from '@/components/ui/page-header';
import {
  CHIP_BASE,
  CHIP_SIZES,
  DATA_CLASS,
  chipTone,
  primaryClass,
  selectedClass,
} from '@/components/ui/tokens';
import {
  ChartTooltip,
  LEGEND_PROPS,
  TOOLTIP_WRAPPER_STYLE,
  axisProps,
} from '@/components/charts/chartKit';

/**
 * A difference with its sign: "+12", "−18" (a true minus sign, which sits
 * level with the plus; a hyphen looks detached at tile size).
 */
const formatDiff = (val: number) =>
  val > 0 ? `+${val}` : val < 0 ? `−${Math.abs(val)}` : `${val}`;

/** At most one decimal place, and none on a whole number: "39", "5.3". */
const formatNumber = (n: number) => String(Math.round(n * 10) / 10);

/** Points to one decimal at most: "1 pt", "5.3 pts" */
const formatPts = (n: number) => formatPoints(Math.round(n * 10) / 10);

/** "1 match", "2 matches" */
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Small controls grow to a thumb-sized target on touch screens. */
const TOUCH_TARGET =
  '[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11';

/**
 * Whether to show foul figures: in a Scrim, where they are recorded, and
 * wherever a match has some (a Scrim switched to Practice keeps them).
 */
const showsFouls = (
  sessionType: SessionType | undefined,
  matches: Match[]
): boolean =>
  sessionType === 'Scrim' ||
  matches.some(m => (m.minorPenalties ?? 0) + (m.majorPenalties ?? 0) > 0);

/** Trend icon based on positive/negative/zero */
const TrendIcon = ({ value, size = 16 }: { value: number; size?: number }) => {
  // emerald-500 is under 3:1 on the light background
  if (value > 0) return <TrendingUp size={size} className="text-emerald-600" />;
  if (value < 0) return <TrendingDown size={size} className="text-red-500" />;
  return <Minus size={size} className="text-gray-400" />;
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
        <span className={`text-sm font-bold ${DATA_CLASS}`}>
          {formatPts(value)}
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

/** The card every chart and list on these tabs sits on */
const cardClass = (isDarkMode: boolean) =>
  `rounded-xl border p-4 sm:p-6 ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-white'}`;

const Section = ({
  title,
  action,
  as: Heading = 'h2',
  className = '',
  children,
  isDarkMode,
}: {
  title: string;
  /** A control beside the title, e.g. one that shows or hides the content */
  action?: ReactNode;
  /** h3 where the card belongs to a heading above it (a match's breakdown) */
  as?: 'h2' | 'h3';
  className?: string;
  children?: ReactNode;
  isDarkMode: boolean;
}) => (
  <div className={`${cardClass(isDarkMode)} ${className}`}>
    <div
      className={`flex items-center justify-between gap-x-4 gap-y-1 flex-wrap ${children ? 'mb-4 sm:mb-5' : ''}`}
    >
      <Heading className={SECTION_TITLE_CLASS}>{title}</Heading>
      {action}
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
    className={`h-[260px] flex items-center justify-center text-center text-sm ${
      isDarkMode ? 'text-team-white-60' : 'text-gray-500'
    }`}
  >
    {message}
  </div>
);

/**
 * Where charts would be but can't say anything yet: one muted line in a
 * dashed box, not an empty plot.
 */
const ChartNote = ({
  children,
  isDarkMode,
}: {
  children: ReactNode;
  isDarkMode: boolean;
}) => (
  <p
    className={`rounded-xl border border-dashed px-4 py-3 text-center text-sm ${
      isDarkMode
        ? 'border-team-blue-40 text-team-white-60'
        : 'border-gray-300 text-gray-600'
    }`}
  >
    {children}
  </p>
);

/** How many of the chances were taken */
interface Tally {
  made: number;
  chances: number;
}

/** The matches a session's average and swing are taken from */
export interface HeadlineStats {
  /** Their type */
  type: string;
  /**
   * The session mixes match types, so only the matches of `type` count: an
   * Autonomous run can't score what a full game does.
   */
  mixed: boolean;
  /** How many matches of `type` there are */
  count: number;
  /** The session's other types, with their own average score */
  others: { type: string; count: number; avg: number }[];
}

export interface SessionStats {
  /** Average match score of the headline matches (`headline`) */
  avgScore: number;
  /**
   * The matches the average, the typical swing and the per-element averages
   * are taken from: every one, or in a session of mixed types the ones of
   * its commonest type (`headlineMatches`), as Best and Worst are.
   */
  headline: HeadlineStats;
  /** Average points from each scoring element, per headline match */
  avgGarden: number;
  avgTipping: number;
  avgFlower: number;
  avgFlowerBonus: number;
  avgHive: number;
  /** Leave and both Parks together (`ELEMENT_LABELS.robots`) */
  avgRobots: number;
  /**
   * Average points per match this alliance's fouls gave the opponent, over
   * every match (a foul costs the same in any type). Not part of any score.
   */
  avgPenalties: number;
  /**
   * Percentage of robot-matches with an auto that left; null if no auto was
   * run. Of the headline matches, as the average is: an Auto run's chances
   * aren't a full game's.
   */
  leaveRate: number | null;
  /**
   * Percentage of park opportunities converted, counting only periods that
   * were run, in the headline matches
   */
  parkRate: number | null;
  /** The counts behind `leaveRate` and `parkRate` */
  leaves: Tally;
  parks: Tally;
  /** Average seconds between Hive Tips, or null if never recorded */
  avgCycle: number | null;
  /** How many tip-to-tip gaps `avgCycle` is the average of */
  cycleCount: number;
  /** How many tips those gaps run between */
  cycleTips: number;
  /**
   * How far a headline match typically lands from their average, in points
   * (the standard deviation of their scores). Null with fewer than two.
   */
  scoreSpread: number | null;
  /**
   * Ranking points earned from scoring alone (SWARM, POLLINATOR 1 and 2) in
   * the headline matches
   */
  rankingPoints: RankingPointTally;
  totalMatches: number;
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

  // In a session of mixed types the score figures are about one type only
  const headline = headlineMatches(matches);
  const scores = headline.matches.map(scoreOf);
  const avgScore = mean(scores);

  const breakdowns = headline.matches.map(m => calculateScore(m));

  // The rates beside the average are of the same matches
  const { leaveRate, parkRate } = robotRates(headline.matches);

  const cyclesPerMatch = matches.map(cycleTimesOf);
  const allCycles = cyclesPerMatch.flat();

  const variance = mean(scores.map(sc => Math.pow(sc - avgScore, 2)));

  return {
    avgScore: Math.round(avgScore),
    headline: {
      type: headline.type,
      mixed: headline.mixed,
      count: headline.matches.length,
      others: headline.others.map(({ type, count }) => ({
        type,
        count,
        avg: Math.round(
          mean(matches.filter(m => typeOf(m) === type).map(scoreOf))
        ),
      })),
    },
    avgGarden: round1(mean(breakdowns.map(b => b.garden))),
    avgTipping: round1(mean(breakdowns.map(b => b.tipping))),
    avgFlower: round1(mean(breakdowns.map(b => b.flower))),
    avgFlowerBonus: round1(mean(breakdowns.map(b => b.flowerBonus))),
    avgHive: round1(mean(breakdowns.map(b => b.hive))),
    avgRobots: round1(mean(breakdowns.map(b => b.leave + b.park))),
    avgPenalties: round1(mean(matches.map(m => calculateScore(m).penalties))),
    leaveRate,
    parkRate,
    ...robotTallies(headline.matches),
    avgCycle:
      allCycles.length > 0 ? Math.round(mean(allCycles) * 100) / 100 : null,
    cycleCount: allCycles.length,
    // A match's gaps run between one more tip than there are gaps
    cycleTips: cyclesPerMatch.reduce(
      (sum, cycles) => sum + (cycles.length > 0 ? cycles.length + 1 : 0),
      0
    ),
    scoreSpread: scores.length < 2 ? null : Math.round(Math.sqrt(variance)),
    rankingPoints: rankingPointTally(headline.matches),
    totalMatches: matches.length,
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

/**
 * The scoring elements a match's bar is stacked from, bottom first: the
 * order the scoring page lists them in, with Leave and Park as one
 * 'Leave + Park', the same list Charts, Compare and the CSV follow.
 */
const SERIES_KEYS = GROUPED_ELEMENT_ORDER;

/** The type a match was run as; matches saved without one were full games */
const typeOf = (m: Match): string => m.matchType || 'Full Game';

/** How the matches of a session rank against each other */
interface Ranking {
  /**
   * The session mixes match types. An Autonomous run can't score what a
   * full game does, so each match is ranked and averaged only against the
   * matches of its own type.
   */
  mixed: boolean;
  /** Best or worst of its group; neither in a group of one, or of equal scores */
  rank: (index: number) => 'best' | 'worst' | null;
  /** The matches `index` is ranked and averaged against, itself included */
  peers: (index: number) => number[];
  /**
   * The best and worst match for the Summary: of the whole session, or in a
   * mixed one of the commonest type that has them (`type` names it), the
   * type the average is about whenever it has a pair. Null when there is no
   * pair to tell apart.
   */
  headline: { best: number; worst: number; type: string | null } | null;
}

const rankMatches = (matches: Match[]): Ranking => {
  const scores = matches.map(scoreOf);
  const mixed = new Set(matches.map(typeOf)).size > 1;
  const groupOf = (index: number) => (mixed ? typeOf(matches[index]) : '');
  const groups = new Map<string, number[]>();
  matches.forEach((_, i) => {
    groups.set(groupOf(i), [...(groups.get(groupOf(i)) ?? []), i]);
  });

  const ranks = new Map<number, 'best' | 'worst'>();
  /** The groups' types in the order they head the Summary */
  const order = typesByCount(matches).map(({ type }) => type);
  let headline: Ranking['headline'] = null;
  let headlineRank = Infinity;
  for (const [type, members] of groups) {
    if (members.length < 2) continue;
    const memberScores = members.map(i => scores[i]);
    const max = Math.max(...memberScores);
    const min = Math.min(...memberScores);
    if (max === min) continue;
    const best = members[memberScores.indexOf(max)];
    const worst = members[memberScores.indexOf(min)];
    ranks.set(best, 'best');
    ranks.set(worst, 'worst');
    const rank = mixed ? order.indexOf(type) : 0;
    if (rank < headlineRank) {
      headlineRank = rank;
      headline = { best, worst, type: mixed ? type : null };
    }
  }

  return {
    mixed,
    rank: index => ranks.get(index) ?? null,
    peers: index => groups.get(groupOf(index)) ?? [index],
    headline,
  };
};

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

/** A stored foul count as a number: anything unusable is none */
const foulCount = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
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

export const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
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
 * The Summary / Matches / Compare switcher: the shared Segmented control as
 * a tab bar, icon over label on a phone and side by side from `sm` up. Wrap
 * the content it switches in
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
}) => (
  <Segmented
    tabs
    fill
    size="md"
    stackIcons
    label="Analysis sections"
    value={active}
    onChange={onChange}
    isDarkMode={isDarkMode}
    options={TABS.map(tab => ({
      value: tab.id,
      label: tab.label,
      icon: tab.icon,
      id: tabButtonId(tab.id),
      controls: tabPanelId(tab.id),
    }))}
    // Framed like the cards under it
    className={`rounded-xl border ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
  />
);

/** A stored timestamp as a date, or null when there isn't a real one */
const dateOf = (value: unknown): Date | null => {
  if (!value) return null;
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * A recorded session length in words: "48:12" is "48 min", "1:22:40" is
 * "1 h 23 min", "0:00" is nothing. Anything that isn't a clock reading is
 * shown as it is.
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
  // Nothing was timed: say nothing rather than "0 s"
  if (seconds === 0) return '';
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
  const durationText = duration ? durationLabel(duration) : '';
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
    ...(durationText ? [{ key: 'duration', node: durationText }] : []),
  ];

  return (
    // Every part carries the dot before it, in its own left padding. The
    // line is pulled left by that much inside a box that clips, so the dot
    // of the first part on each line falls outside and is cut off: no line
    // starts or ends with a dot.
    <div className="overflow-hidden">
      <p
        className={`-ml-5 flex flex-wrap gap-y-0.5 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
      >
        {parts.map(part => (
          <span key={part.key} className="relative pl-5 whitespace-nowrap">
            <span aria-hidden className="absolute left-0 w-5 text-center">
              ·
            </span>
            {part.node}
          </span>
        ))}
      </p>
    </div>
  );
};

/** Lines of notes shown before "Show more" */
const NOTES_CLAMP_LINES = 3;
/** Notes this many lines long are shown whole: hiding a line or two saves nothing */
const NOTES_WHOLE_LINES = 5;

/**
 * A session's notes. With `clamp` only the first three lines show until
 * "Show more" is pressed, so long notes don't push the charts down.
 *
 * With `onSave` (a session its viewer may change) the card is there even
 * with no notes yet, and Edit (or Add notes) opens them in the scoring
 * page's notes box, with Save and Cancel: notes are mostly written after
 * practice, at the review.
 */
export const SessionNotes = ({
  notes,
  isDarkMode,
  clamp = false,
  onSave,
}: {
  /** Rich-text HTML as stored; sanitized here */
  notes: string;
  isDarkMode: boolean;
  clamp?: boolean;
  /** Save changed notes; resolves to whether they were saved */
  onSave?: (notes: string) => Promise<boolean>;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [clampHeight, setClampHeight] = useState<number | null>(null);
  const [overflows, setOverflows] = useState(false);
  /** The notes as edited so far, while they are open for editing */
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const bodyId = useId();
  const titleId = useId();
  const editing = draft !== null;

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
  }, [clamp, notes, editing]);

  // Opening them is asking to write: the caret goes at the end.
  useEffect(() => {
    if (!editing) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editing]);

  const save = async () => {
    if (draft === null || !onSave || saving) return;
    // Nothing typed is no notes, not an empty paragraph
    const next = htmlToText(draft).trim() === '' ? '' : draft;
    if (next === notes) {
      setDraft(null);
      return;
    }
    setSaving(true);
    const saved = await onSave(next);
    setSaving(false);
    if (saved) setDraft(null);
  };

  const clamped = clamp && overflows && !expanded;
  const muted = isDarkMode ? 'text-team-white-60' : 'text-gray-600';

  if (!notes && !onSave) return null;

  return (
    <div className={cardClass(isDarkMode)}>
      {/* Titled like the cards above it */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={titleId} className={SECTION_TITLE_CLASS}>
          Notes
        </h2>
        {onSave && !editing && (
          <button
            type="button"
            onClick={() => setDraft(notes)}
            className={`-my-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${TOUCH_TARGET} ${
              isDarkMode
                ? 'text-team-white-60 hover:text-white hover:bg-white/5'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {notes ? (
              <>
                <Edit size={15} aria-hidden /> Edit
              </>
            ) : (
              <>
                <Pencil size={15} aria-hidden /> Add notes
              </>
            )}
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-3">
          <NotesEditor
            html={notes}
            onChange={setDraft}
            labelledBy={titleId}
            editorRef={editorRef}
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="neutral"
              size="touch"
              disabled={saving}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="touch"
              disabled={saving}
              aria-busy={saving}
              onClick={() => void save()}
              // The view's one fill while the notes are open: the header's
              // New Session steps back
              data-page-primary
            >
              {saving ? 'Saving...' : 'Save notes'}
            </Button>
          </div>
        </div>
      ) : !notes ? (
        <p className={`text-sm ${muted}`}>No notes yet.</p>
      ) : (
        <>
          {/* contain:paint keeps whatever the notes hold inside this box */}
          <div
            ref={bodyRef}
            id={bodyId}
            style={
              clamped && clampHeight ? { maxHeight: clampHeight } : undefined
            }
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
        </>
      )}
    </div>
  );
};

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

/** Whether the pointer can hover: a mouse rather than a finger */
const canHover = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

/**
 * The chart box (`data-chart={id}`) a press landed in, if any: from the
 * event's path, which holds even if the chart redraws the mark pressed.
 */
const chartBoxOf = (event: Event): Element | null =>
  event
    .composedPath()
    .find(
      (node): node is Element =>
        node instanceof Element && node.hasAttribute('data-chart')
    ) ?? null;

/**
 * Whether a press at this point landed in the plot of the chart in `box`,
 * where its columns are, rather than on an axis or the legend. The plot is
 * the rectangle the chart clips its marks to.
 */
const inPlot = (box: Element, { clientX, clientY }: MouseEvent) => {
  const clip = box.querySelector('clipPath > rect');
  const surface = clip instanceof SVGElement ? clip.ownerSVGElement : null;
  if (!clip || !surface) return false;
  const at = (name: string) => Number(clip.getAttribute(name)) || 0;
  const { left, top } = surface.getBoundingClientRect();
  const x = clientX - left - at('x');
  const y = clientY - top - at('y');
  return x >= 0 && x <= at('width') && y >= 0 && y <= at('height');
};

/**
 * Taps on the charts of one tab, on a touch screen.
 *
 * There is no hover there, so a tap opens the column's tooltip (the
 * tooltip's click trigger: browsers send a touch's pretend mouse away again
 * at once, or not at all). The chart itself never lets go of the column
 * tapped last, so which chart may show it is kept here: a tap on a chart's
 * plot shows its tooltip; a press anywhere else (another chart, the page)
 * or a tap on the chart's axes or legend puts it away until the next tap
 * on that plot. A press that becomes a scroll is not a tap (no click
 * follows it), so swiping across a chart never brings an old tooltip back.
 * Each chart's box carries `data-chart={id}`, and `tooltipControl(id)` is
 * spread on its Tooltip (`active` false hides it; undefined leaves it to
 * the chart).
 *
 * `tapped` is the column tapped once (`chart:matchIndex`), which a second
 * tap opens; anything that puts the tooltip away forgets it.
 */
const useChartTaps = (touch: boolean) => {
  const [shown, setShown] = useState<string | null>(null);
  const [tapped, setTapped] = useState<string | null>(null);

  useEffect(() => {
    if (!touch) return;
    const onPointerDown = (event: PointerEvent) => {
      const chart = chartBoxOf(event)?.getAttribute('data-chart');
      if (!chart) {
        setShown(null);
        setTapped(null);
        return;
      }
      setShown(open => (open === chart ? open : null));
      setTapped(column => (column?.startsWith(`${chart}:`) ? column : null));
    };
    const onClick = (event: MouseEvent) => {
      const box = chartBoxOf(event);
      if (!box) return;
      if (inPlot(box, event)) {
        setShown(box.getAttribute('data-chart'));
      } else {
        setShown(null);
        setTapped(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    // After the chart's own click handler (bubbling up from the app's
    // root), which picks the column: showing the tooltip any earlier
    // re-renders the chart under the finger and the chart loses the tap.
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick);
    };
  }, [touch]);

  /** Whether this chart may mark the column last tapped on it */
  const marks = (chart: string) => !touch || shown === chart;

  return {
    tooltipControl: (chart: string) =>
      touch
        ? {
            trigger: 'click' as const,
            active: marks(chart) ? undefined : false,
          }
        : {},
    /**
     * A line's enlarged point under the tooltip, which the tooltip's
     * `active` doesn't take away: gone with the tooltip.
     */
    activeDot: (chart: string) => (marks(chart) ? { r: 7 } : false),
    tapped,
    setTapped,
  };
};

/**
 * What every chart here shares for screen readers: a name and a sentence,
 * and no keyboard stop of its own. Each is one picture (role img): the
 * Matches tab and the Compare table list every figure it draws.
 */
const chartA11y = (title: string, desc: string) => ({
  accessibilityLayer: false,
  role: 'img',
  title,
  desc,
});

/** A tooltip's series in the order of `keys` (the order they are drawn) */
const seriesOrder =
  (keys: readonly string[]) =>
  (item: { dataKey?: unknown }): number =>
    keys.indexOf(String(item.dataKey));

/** The widest a bar gets, so a session of one match isn't one wall of colour */
const MAX_BAR_SIZE = 64;

/** The y axis's width on every chart here */
const Y_AXIS_WIDTH = 40;
/** The library's default chart margin, left plus right */
const CHART_SIDE_MARGINS = 10;

/**
 * Side padding for a line chart's x axis that puts each match's point, and
 * its label, at the centre of the column a bar chart of the same matches
 * gives it: one match sits at one x in every chart of the tab. Pass
 * `onResize` to the chart's ResponsiveContainer and `padding` to its XAxis.
 * (The library's band scale on a line chart centres the points but leaves
 * the axis labels at the columns' left edges.)
 */
const useColumnPadding = (columns: number) => {
  const [width, setWidth] = useState(0);
  const plot = Math.max(0, width - Y_AXIS_WIDTH - CHART_SIDE_MARGINS);
  const side = columns > 0 ? plot / (2 * columns) : 0;
  return { padding: { left: side, right: side }, onResize: setWidth };
};

/**
 * Columns for the Summary's tiles by how many there are (5 to 9, as the
 * session has them), so no row is left with a lone tile where it can be
 * helped. `last` spans an odd last tile across a phone's two columns.
 */
const TILE_LAYOUT: Record<number, { grid: string; last: string }> = {
  5: {
    grid: 'sm:grid-cols-3 lg:grid-cols-5',
    last: 'col-span-2 sm:col-span-1',
  },
  6: { grid: 'sm:grid-cols-3', last: '' },
  7: { grid: 'md:grid-cols-4', last: 'col-span-2 md:col-span-1' },
  8: { grid: 'md:grid-cols-4', last: '' },
  9: { grid: 'sm:grid-cols-3', last: 'col-span-2 sm:col-span-1' },
};

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
  /** Practice sessions leave the penalty figures out */
  sessionType?: SessionType;
  /**
   * Show one match (by its position in `matches`). With it the Best and
   * Worst tiles and the chart columns lead to their match.
   */
  onOpenMatch?: (index: number) => void;
}) => {
  const fouls = showsFouls(sessionType, matches);
  const colors = chartColors(isDarkMode);
  const isCompact = useIsCompact();
  const chartStyle = onOpenMatch ? { cursor: 'pointer' } : undefined;

  // A click anywhere in a match's column of a chart opens that match. On a
  // touch screen a tap is also how the column's tooltip is read, so there
  // the first tap shows the tooltip and a second one opens the match.
  const hover = canHover();
  const { tooltipControl, activeDot, tapped, setTapped } = useChartTaps(!hover);
  // Said once, as the tooltip's last line
  const tooltipHint = !onOpenMatch
    ? undefined
    : hover
      ? 'Click to open this match'
      : 'Tap again to open this match';
  const openFromChart = (chart: string, rows: MatchRow[]) =>
    onOpenMatch
      ? (
          state: { activeTooltipIndex?: number | string | null },
          event: SyntheticEvent
        ) => {
          // The chart reports the column it last showed even for a click on
          // its axes or legend, which is no column at all.
          const box = document.querySelector(`[data-chart="${chart}"]`);
          if (
            !box ||
            !(event.nativeEvent instanceof MouseEvent) ||
            !inPlot(box, event.nativeEvent)
          ) {
            return;
          }
          const index = state.activeTooltipIndex;
          if (index === null || index === undefined || index === '') return;
          const row = rows[Number(index)];
          if (!row) return;
          const column = `${chart}:${row.matchIndex}`;
          if (!hover && tapped !== column) {
            setTapped(column);
            return;
          }
          onOpenMatch(row.matchIndex);
        }
      : undefined;

  // Drawn above the legend. On a phone it is pinned to the top of the plot,
  // where it covers neither the column being read nor the legend.
  const tooltipProps = (chart: string) => ({
    wrapperStyle: TOOLTIP_WRAPPER_STYLE,
    ...tooltipControl(chart),
    ...(isCompact
      ? { position: { y: 0 }, allowEscapeViewBox: { x: false, y: false } }
      : {}),
  });

  const n = stats.totalMatches;
  const head = stats.headline;
  const trendColumns = useColumnPadding(n);
  const cycleColumns = useColumnPadding(n);
  /** A line through one point says nothing */
  const trends = n >= 2;
  const nothingScored = matches.every(m => scoreOf(m) === 0);

  // The average is a series of its own so the legend and the tooltip name
  // the dashed line. In a session of mixed types it is the average of one
  // type, drawn across that type's matches only.
  const trendData = matches.map((m, i) => ({
    ...matchRow(m, i),
    score: scoreOf(m),
    average: !head.mixed || typeOf(m) === head.type ? stats.avgScore : null,
  }));
  const averageName = head.mixed ? `${head.type} average` : 'Session average';

  const elementData = matches.map((m, i) => {
    const b = calculateScore(m);
    return {
      ...matchRow(m, i),
      tipping: b.tipping,
      robots: b.leave + b.park,
      flower: b.flower,
      flowerBonus: b.flowerBonus,
      hive: b.hive,
      garden: b.garden,
    };
  });

  // In points, as the tile above and Charts give them: two minor fouls are
  // 10, one major 20, and the bars rank the matches that way.
  const penaltyData = matches.map((m, i) => ({
    ...matchRow(m, i),
    minor: foulCount(m.minorPenalties) * POINTS.MINOR_PENALTY,
    major: foulCount(m.majorPenalties) * POINTS.MAJOR_PENALTY,
  }));
  const hasPenalties = penaltyData.some(d => d.minor + d.major > 0);
  /** A bar's value with the fouls behind it: "2 (10 pts)" */
  const foulValue = (points: number, name: string) => {
    const each =
      name === ELEMENT_LABELS.major
        ? POINTS.MAJOR_PENALTY
        : POINTS.MINOR_PENALTY;
    return `${points / each} (${formatPts(points)})`;
  };

  // Every match keeps its column, so one without tip times (entered after
  // the fact) is a gap in the line rather than a column that isn't there.
  const cycleData = matches.map((m, i) => {
    const cycles = cycleTimesOf(m);
    return {
      ...matchRow(m, i),
      cycle: cycles.length > 0 ? mean(cycles) : null,
    };
  });
  const showTimes = trends && stats.avgCycle !== null;

  // Session-average element mix, in the scoring page's order and named as
  // the stacked 'Scoring by Match' bars below name them (Leave + Park).
  const avgRows = [
    {
      label: ELEMENT_LABELS.tipping,
      value: stats.avgTipping,
      color: colors.tipping,
    },
    {
      label: ELEMENT_LABELS.robots,
      value: stats.avgRobots,
      color: colors.robots,
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
    {
      label: ELEMENT_LABELS.garden,
      value: stats.avgGarden,
      color: colors.garden,
    },
  ];
  const avgMax = Math.max(1, ...avgRows.map(r => Math.abs(r.value)));

  const rp = stats.rankingPoints;
  // No match could earn SWARM: one robot can't reach it, nor can a match
  // with no Auto period
  const swarmLine =
    rp.swarmChances > 0
      ? `${rp.swarm}/${rp.swarmChances}`
      : swarmMissing(headlineMatches(matches).matches);
  /**
   * In a session of mixed types the rates are of the headline type's
   * matches, as the average is: their counts say so.
   */
  const ofType = head.mixed ? ` in ${head.type}` : '';
  const rateScope = head.mixed
    ? ` Only the ${head.type} matches count, as for the average.`
    : '';

  // Best and worst only where two matches can be told apart, and in a
  // session of mixed types only among matches of one type.
  const top = rankMatches(matches).headline;
  const numberOf = (index: number) => matches[index]?.matchNumber ?? index + 1;
  const [pollinator1, pollinator2] = RANKING_POINTS.POLLINATOR_TIPS;

  /** The other types' own averages, said where the average leaves them out */
  const otherAverages = head.others
    .map(
      other =>
        `${other.type}: ${other.avg} average over ${plural(other.count, 'match', 'matches')}.`
    )
    .join(' ');

  const tiles: (Omit<StatTileProps, 'isDarkMode'> & { key: string })[] = [
    {
      key: 'average',
      label: head.mixed ? `Average ${head.type}` : 'Average Score',
      value: stats.avgScore,
      caption: `across ${plural(head.count, 'match', 'matches')}`,
      info: head.mixed
        ? `Only the ${head.type} matches: other types can't score what they do. ${otherAverages}`
        : undefined,
    },
    ...(top
      ? [
          {
            key: 'best',
            label: top.type ? `Best ${top.type}` : 'Best Match',
            value: scoreOf(matches[top.best]),
            caption: `Match ${numberOf(top.best)}`,
            tone: 'success' as const,
            onClick: onOpenMatch && (() => onOpenMatch(top.best)),
          },
          {
            key: 'worst',
            label: top.type ? `Worst ${top.type}` : 'Worst Match',
            value: scoreOf(matches[top.worst]),
            caption: `Match ${numberOf(top.worst)}`,
            tone: 'danger' as const,
            onClick: onOpenMatch && (() => onOpenMatch(top.worst)),
          },
        ]
      : []),
    {
      key: 'swing',
      label: 'Typical swing',
      value: stats.scoreSpread === null ? null : `±${stats.scoreSpread} pts`,
      caption:
        stats.scoreSpread === null
          ? 'needs 2+ matches'
          : head.mixed
            ? `${head.type} matches`
            : undefined,
      info: head.mixed
        ? `How far a ${head.type} match usually lands from their average (the standard deviation of their scores).`
        : 'How far a match usually lands from the average score (the standard deviation of the match scores).',
    },
    {
      key: 'leave',
      label: 'Leave Rate',
      value: stats.leaveRate === null ? null : `${stats.leaveRate}%`,
      caption:
        stats.leaveRate === null
          ? 'no Auto period'
          : head.mixed
            ? `${stats.leaves.made} of ${stats.leaves.chances}${ofType}`
            : `Leave ${stats.leaves.made} of ${stats.leaves.chances}`,
      info: `Robots that left in Auto, out of the robots played in every match that ran an Auto period.${rateScope}`,
    },
    {
      key: 'park',
      label: 'Park Rate',
      value: stats.parkRate === null ? null : `${stats.parkRate}%`,
      caption:
        stats.parkRate === null
          ? 'no park chances'
          : head.mixed
            ? `${stats.parks.made} of ${stats.parks.chances}${ofType}`
            : `Park ${stats.parks.made} of ${stats.parks.chances}`,
      info: `Parks made out of the chances: each robot played, at the end of Auto and again at the end of the match, for the periods each match ran.${rateScope}`,
    },
    {
      key: 'rp',
      label: 'RP Rate',
      value: rp.rate === null ? null : `${rp.rate}%`,
      caption: head.mixed
        ? `${rp.earned} of ${rp.possible}${ofType}`
        : `${rp.earned} of ${rp.possible} RP`,
      info: (
        <>
          <span className="block">
            Share of the ranking points scoring could earn: POLLINATOR at{' '}
            {pollinator1} and at {pollinator2} Hive Tips in every match, and
            SWARM at {RANKING_POINTS.SWARM_ROBOT_POINTS} Leave + Park points in
            a match played with 2 robots and an Auto period.{rateScope}
          </span>
          {/* Each ranking point stays on one line with its count */}
          <span className="block mt-1.5 tabular-nums">
            <span className="whitespace-nowrap">SWARM {swarmLine},</span>{' '}
            <span className="whitespace-nowrap">
              POLLINATOR 1 {rp.pollinator1}/{head.count},
            </span>{' '}
            <span className="whitespace-nowrap">
              POLLINATOR 2 {rp.pollinator2}/{head.count}
            </span>
          </span>
        </>
      ),
    },
    // Only with tips tapped live: matches entered afterwards have no times.
    ...(stats.avgCycle !== null
      ? [
          {
            key: 'cycle',
            label: 'Avg time between tips',
            value: `${stats.avgCycle.toFixed(1)}s`,
            caption: `from ${plural(stats.cycleTips, 'tip')}`,
            info: 'Average seconds from one Hive Tip to the next within a match, from tips tapped live.',
          },
        ]
      : []),
    ...(fouls
      ? [
          {
            key: 'penalties',
            label: 'Avg points given to opponent',
            value: stats.avgPenalties,
            caption: "per match, from this team's fouls, not part of the score",
          },
        ]
      : []),
  ];
  const layout = TILE_LAYOUT[tiles.length] ?? TILE_LAYOUT[8];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={`grid grid-cols-2 gap-2 sm:gap-4 ${layout.grid}`}>
        {tiles.map(({ key, ...tile }, i) => (
          <StatTile
            key={key}
            {...tile}
            className={i === tiles.length - 1 ? layout.last : undefined}
            isDarkMode={isDarkMode}
          />
        ))}
      </div>

      {nothingScored ? (
        // One card for both charts: a flat line and an empty stack say the
        // same thing twice.
        <Section title="Score Trend" isDarkMode={isDarkMode}>
          <EmptyChart message="No points scored yet" isDarkMode={isDarkMode} />
        </Section>
      ) : trends ? (
        <Section title="Score Trend" isDarkMode={isDarkMode}>
          <div data-chart="trend">
            <ResponsiveContainer
              width="100%"
              height={280}
              onResize={trendColumns.onResize}
            >
              <LineChart
                data={trendData}
                onClick={openFromChart('trend', trendData)}
                style={chartStyle}
                {...chartA11y(
                  'Score trend',
                  head.mixed
                    ? `The final score of each match, with the ${head.type} average as a dashed line.`
                    : 'The final score of each match, with the session average as a dashed line.'
                )}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDarkMode ? '#334155' : '#e2e8f0'}
                />
                {/* Each point sits over its match's bar below */}
                <XAxis
                  dataKey="name"
                  padding={trendColumns.padding}
                  {...axisProps(isDarkMode)}
                />
                <YAxis width={Y_AXIS_WIDTH} {...axisProps(isDarkMode)} />
                <Tooltip
                  {...tooltipProps('trend')}
                  itemSorter={seriesOrder(['score', 'average'])}
                  content={
                    <ChartTooltip
                      isDarkMode={isDarkMode}
                      titleKey="title"
                      formatValue={formatPts}
                      hint={tooltipHint}
                    />
                  }
                />
                <Legend {...LEGEND_PROPS} itemSorter={null} />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Final Score"
                  stroke={colors.total}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={activeDot('trend')}
                />
                <Line
                  dataKey="average"
                  name={averageName}
                  stroke={colors.average}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  legendType="plainline"
                  dot={false}
                  activeDot={false}
                  // Across the other types' matches, where it has no value
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      ) : (
        <ChartNote isDarkMode={isDarkMode}>
          Trends appear after 2 matches
        </ChartNote>
      )}

      <Section
        title="Where the Points Came From"
        // Per match of the type the average is about
        action={
          head.mixed && (
            <span
              className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              Per {head.type} match
            </span>
          )
        }
        isDarkMode={isDarkMode}
      >
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
      </Section>

      {!nothingScored && (
        <Section title="Scoring by Match" isDarkMode={isDarkMode}>
          <div data-chart="elements">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={elementData}
                onClick={openFromChart('elements', elementData)}
                style={chartStyle}
                {...chartA11y(
                  'Scoring by match',
                  'The points each scoring element earned in every match, stacked into the match score.'
                )}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDarkMode ? '#334155' : '#e2e8f0'}
                />
                <XAxis dataKey="name" {...axisProps(isDarkMode)} />
                <YAxis width={Y_AXIS_WIDTH} {...axisProps(isDarkMode)} />
                <Tooltip
                  {...tooltipProps('elements')}
                  cursor={barCursor(isDarkMode)}
                  itemSorter={seriesOrder(SERIES_KEYS)}
                  content={
                    <ChartTooltip
                      isDarkMode={isDarkMode}
                      titleKey="title"
                      formatValue={formatPts}
                      formatTotal={formatPts}
                      hint={tooltipHint}
                    />
                  }
                />
                {/* Unsorted, the legend reads in the order the bars are stacked */}
                <Legend {...LEGEND_PROPS} itemSorter={null} />
                {SERIES_KEYS.map(key => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={ELEMENT_LABELS[key]}
                    stackId="a"
                    fill={colors[key]}
                    maxBarSize={MAX_BAR_SIZE}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {(fouls || showTimes) && (
        <div
          className={`grid grid-cols-1 gap-4 sm:gap-6 ${fouls && showTimes ? 'lg:grid-cols-2' : ''}`}
        >
          {fouls && (
            <Section title="Points Given to Opponent" isDarkMode={isDarkMode}>
              {hasPenalties ? (
                <div data-chart="penalties">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={penaltyData}
                      onClick={openFromChart('penalties', penaltyData)}
                      style={chartStyle}
                      {...chartA11y(
                        'Points given to the opponent by match',
                        'The points minor and major fouls gave the opponent in each match, stacked. They are never taken off the score.'
                      )}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={isDarkMode ? '#334155' : '#e2e8f0'}
                      />
                      <XAxis dataKey="name" {...axisProps(isDarkMode)} />
                      <YAxis
                        width={Y_AXIS_WIDTH}
                        allowDecimals={false}
                        {...axisProps(isDarkMode)}
                      />
                      <Tooltip
                        {...tooltipProps('penalties')}
                        cursor={barCursor(isDarkMode)}
                        itemSorter={seriesOrder(['minor', 'major'])}
                        content={
                          <ChartTooltip
                            isDarkMode={isDarkMode}
                            titleKey="title"
                            formatValue={foulValue}
                            formatTotal={formatPts}
                            hint={tooltipHint}
                          />
                        }
                      />
                      <Legend {...LEGEND_PROPS} itemSorter={null} />
                      <Bar
                        dataKey="minor"
                        name={ELEMENT_LABELS.minor}
                        stackId="fouls"
                        fill={colors.minor}
                        maxBarSize={MAX_BAR_SIZE}
                      />
                      <Bar
                        dataKey="major"
                        name={ELEMENT_LABELS.major}
                        stackId="fouls"
                        fill={colors.major}
                        maxBarSize={MAX_BAR_SIZE}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChart
                  message="No fouls recorded, nice driving"
                  isDarkMode={isDarkMode}
                />
              )}
            </Section>
          )}

          {showTimes && (
            <Section title="Time Between Hive Tips" isDarkMode={isDarkMode}>
              <div data-chart="cycle">
                <ResponsiveContainer
                  width="100%"
                  height={260}
                  onResize={cycleColumns.onResize}
                >
                  <LineChart
                    data={cycleData}
                    onClick={openFromChart('cycle', cycleData)}
                    style={chartStyle}
                    {...chartA11y(
                      'Time between Hive Tips',
                      'Average seconds between Hive Tips in each match; a gap is a match without tip times.'
                    )}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDarkMode ? '#334155' : '#e2e8f0'}
                    />
                    <XAxis
                      dataKey="name"
                      padding={cycleColumns.padding}
                      {...axisProps(isDarkMode)}
                    />
                    <YAxis
                      width={Y_AXIS_WIDTH}
                      unit="s"
                      {...axisProps(isDarkMode)}
                    />
                    <Tooltip
                      {...tooltipProps('cycle')}
                      content={
                        <ChartTooltip
                          isDarkMode={isDarkMode}
                          titleKey="title"
                          formatValue={value => `${formatNumber(value)}s`}
                          hint={tooltipHint}
                        />
                      }
                    />
                    {/* Its own legend line, so beside the penalties chart
                        both plots sit on the same baseline */}
                    <Legend {...LEGEND_PROPS} />
                    <Line
                      type="monotone"
                      dataKey="cycle"
                      name="Avg time between tips"
                      stroke={colors.cycle}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={activeDot('cycle')}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * A match type's name on a chip, where room is short: "Auto", as the phase
 * chip and the lifetime Compare page's narrow rows say it.
 */
const TYPE_SHORT: Record<string, string> = { Autonomous: 'Auto' };

/**
 * "Best" or "Worst" beside a match: a word and an icon, not colour alone, in
 * the chip shape the phase and status chips share. In a session of mixed
 * types it names the type the match is ranked within ("Best Auto"), as the
 * Summary's tiles do: an Autonomous best beside a Full Game worst that
 * scored more is no contradiction once it says so.
 */
const RankMark = ({
  rank,
  type,
  isDarkMode,
}: {
  rank: 'best' | 'worst';
  /** The match's type, in a session of mixed types */
  type?: string;
  isDarkMode: boolean;
}) => {
  const Icon = rank === 'best' ? TrendingUp : TrendingDown;
  return (
    <span
      className={`${CHIP_BASE} ${CHIP_SIZES.sm} ${chipTone(rank === 'best' ? 'success' : 'danger', isDarkMode)} gap-0.5`}
    >
      <Icon size={11} aria-hidden />
      {rank === 'best' ? 'Best' : 'Worst'}
      {type && ` ${TYPE_SHORT[type] ?? type}`}
    </span>
  );
};

/**
 * How far in from an edge of the match strip its chips fade out, while the
 * strip runs on past that edge. A chip cut off there then reads as "more
 * this way", not as the end of the row.
 */
const STRIP_FADE_PX = 32;

/** The match strip's mask: faded at each edge it runs on past */
const stripMask = (left: boolean, right: boolean) =>
  left || right
    ? `linear-gradient(to right, ${left ? 'transparent' : 'black'}, black ${STRIP_FADE_PX}px, black calc(100% - ${STRIP_FADE_PX}px), ${right ? 'transparent' : 'black'})`
    : undefined;

/** Scroll the match strip, if need be, so a chip sits clear of its fades */
const scrollClearOfFade = (strip: HTMLElement, chip: HTMLElement) => {
  const left = chip.offsetLeft;
  const right = left + chip.offsetWidth;
  if (left < strip.scrollLeft + STRIP_FADE_PX) {
    strip.scrollLeft = left - STRIP_FADE_PX;
  } else if (right > strip.scrollLeft + strip.clientWidth - STRIP_FADE_PX) {
    strip.scrollLeft = right - strip.clientWidth + STRIP_FADE_PX;
  }
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
  /** Practice sessions leave the penalty line out */
  sessionType?: SessionType;
}) => {
  const [ownIdx, setOwnIdx] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  /** Whether the strip runs on past its left and its right edge */
  const [moreLeft, setMoreLeft] = useState(false);
  const [moreRight, setMoreRight] = useState(false);

  // Clamped here rather than stored: the list shrinks under it on a delete.
  const idx = Math.max(0, Math.min(selectedIdx ?? ownIdx, matches.length - 1));
  // Delete acts at once (with an Undo), and the next match takes the place
  // of the one deleted: Delete ignores presses for a moment after the list
  // changes, so the second tap of a double tap can't delete that one too.
  // Picking another match leaves it armed.
  const deleteArmed = useArmed(undefined, matches.length);
  const select = (index: number) => {
    setOwnIdx(index);
    onSelect?.(index);
  };

  // Before paint, so a strip that runs on is never first shown hard-cut.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const update = () => {
      setMoreLeft(strip.scrollLeft > 0);
      setMoreRight(
        strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1
      );
    };
    update();
    strip.addEventListener('scroll', update, { passive: true });
    // The chips change width with their scores and once the web font is in
    const observer = new ResizeObserver(update);
    observer.observe(strip);
    for (const chip of strip.children) observer.observe(chip);
    return () => {
      strip.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [matches]);

  // Keep the selected match's chip in view in the strip, clear of the
  // fade at either edge, without moving the page.
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.children[idx] as HTMLElement | undefined;
    if (strip && chip) scrollClearOfFade(strip, chip);
  }, [idx, matches.length]);

  const muted = isDarkMode ? 'text-team-white-60' : 'text-gray-600';

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
            // The view's one fill: the header's New Session steps back
            data-page-primary
            className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold ${primaryClass(isDarkMode)}`}
          >
            <Plus size={16} /> Add Match
          </button>
        )}
      </div>
    );
  }

  const match = matches[idx];
  const breakdown = calculateScore(match);
  // The penalty row is not one of the rows that add up to the total.
  const allRows = scoreRows(match);
  const rows = allRows.filter(row => !row.informational);
  const foulRow = allRows.find(row => row.informational);
  const fouls = showsFouls(sessionType, matches);
  const cycles = cycleTimesOf(match);
  const score = scoreOf(match);
  const ranking = rankMatches(matches);
  // Measured against the matches it can be compared with: every one, or in
  // a session of mixed types those of its own type. Alone it has none.
  const peers = ranking.peers(idx);
  const diff = Math.round(score - mean(peers.map(i => scoreOf(matches[i]))));
  const showDiff = peers.length >= 2;
  const rp = rankingPoints(match);
  const rpBadges = rankingPointNames(rp);

  const outline = isDarkMode
    ? 'border-team-blue-40 text-white hover:bg-white/5'
    : 'border-gray-200 text-gray-700 hover:bg-gray-50';
  const stepButton = `shrink-0 inline-flex items-center justify-center p-2 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed ${TOUCH_TARGET} ${outline}`;
  // Edit and Delete are quiet: they act on the match shown, not the page.
  const quietButton = `inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-transparent text-sm font-semibold transition-colors ${TOUCH_TARGET}`;
  /** Above the average is better, below it worse */
  const diffTone =
    diff > 0
      ? isDarkMode
        ? 'text-emerald-400'
        : 'text-emerald-700'
      : diff < 0
        ? isDarkMode
          ? 'text-red-400'
          : 'text-red-700'
        : muted;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* One row however many matches: it scrolls sideways, fading out at
          an edge it runs on past. Adding a match is at its end, where the
          next one will be. */}
      <div
        ref={stripRef}
        role="group"
        aria-label="Matches in this session"
        className="relative flex gap-2 overflow-x-auto p-1 -m-1"
        style={{
          maskImage: stripMask(moreLeft, moreRight),
          WebkitMaskImage: stripMask(moreLeft, moreRight),
        }}
        // Tabbing along, the browser leaves a chip that still shows a sliver
        // where it is, under the fade. Keyboard focus only: a click's focus
        // lands before its click, and moving the chip then would lose it.
        onFocus={e => {
          if (
            e.target.parentElement === e.currentTarget &&
            e.target.matches(':focus-visible')
          ) {
            scrollClearOfFade(e.currentTarget, e.target);
          }
        }}
      >
        {matches.map((m, i) => {
          const chipRank = ranking.rank(i);
          return (
            <button
              key={m.id}
              type="button"
              aria-label={`Match ${m.matchNumber}, ${plural(scoreOf(m), 'point')}${chipRank ? `, ${chipRank} ${ranking.mixed ? typeOf(m) : 'match'}` : ''}`}
              aria-pressed={i === idx}
              onClick={() => select(i)}
              className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors [@media(pointer:coarse)]:min-h-11 ${
                i === idx
                  ? selectedClass(isDarkMode)
                  : isDarkMode
                    ? 'border-team-blue-40 text-team-white-60 hover:bg-white/5'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              M{m.matchNumber}
              <span className="font-normal tabular-nums">{scoreOf(m)}</span>
              {chipRank && (
                <RankMark
                  rank={chipRank}
                  type={ranking.mixed ? typeOf(m) : undefined}
                  isDarkMode={isDarkMode}
                />
              )}
            </button>
          );
        })}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors [@media(pointer:coarse)]:min-h-11 ${outline}`}
          >
            <Plus size={15} aria-hidden /> Add match
          </button>
        )}
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
          {/* The score and how it compares sit under the name; Best or
              Worst is on the match's chip above. */}
          <div className="min-w-0 ml-1">
            <h2
              className={`${SECTION_TITLE_CLASS} flex items-baseline gap-x-2 flex-wrap`}
            >
              Match {match.matchNumber}
              <span className={`font-medium ${muted}`}>· {typeOf(match)}</span>
            </h2>
            <p className={`text-sm tabular-nums ${muted}`}>
              <span className="font-semibold text-foreground">
                {formatPoints(score)}
              </span>
              {showDiff && (
                <>
                  {' · '}
                  <span className={`font-semibold ${diffTone}`}>
                    {formatDiff(diff)}
                  </span>{' '}
                  {ranking.mixed ? `vs ${typeOf(match)} avg` : 'vs avg'}
                </>
              )}
            </p>
          </div>
        </div>

        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1 ml-auto">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(match)}
                className={`${quietButton} ${
                  isDarkMode
                    ? 'text-team-white-60 hover:text-white hover:bg-white/5'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Edit size={15} aria-hidden /> Edit
              </button>
            )}
            {/* Deletes at once; the toast it leaves has the Undo */}
            {onDelete && (
              <button
                type="button"
                aria-label={`Delete Match ${match.matchNumber}`}
                onClick={() => {
                  if (deleteArmed) onDelete(match.id);
                }}
                className={`${quietButton} ${
                  isDarkMode
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-red-600 hover:bg-red-50'
                }`}
              >
                <Trash2 size={15} aria-hidden /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* On a wide screen the breakdown is narrow, so each number stays
          near its label, with these figures beside it taking the rest of
          the width, out to where Edit and Delete end; on a phone they come
          first. */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4 sm:space-y-6 lg:col-start-2 lg:row-start-1">
          {/* Only from tips tapped live; a match entered afterwards has none */}
          {cycles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2 sm:gap-4">
              <StatTile
                label="Avg time between tips"
                value={`${mean(cycles).toFixed(1)}s`}
                caption={`from ${plural(cycles.length + 1, 'tip')}`}
                info="Average seconds from one Hive Tip to the next in this match, from tips tapped live."
                isDarkMode={isDarkMode}
              />
            </div>
          )}

          <div
            role="group"
            className="flex items-center gap-2 flex-wrap"
            aria-label="Ranking points earned in this match"
          >
            <span className={EYEBROW_CLASS}>Ranking Points</span>
            {rpBadges.length === 0 ? (
              <span className={`text-sm ${muted}`}>None from scoring</span>
            ) : (
              rpBadges.map(name => (
                <span
                  key={name}
                  className={`${CHIP_BASE} ${CHIP_SIZES.md} ${chipTone('neutral', isDarkMode)} gap-1`}
                >
                  <Check size={13} aria-hidden />
                  {name}
                </span>
              ))
            )}
            {rpBadges.length > 0 && (
              <span className={`text-sm font-semibold tabular-nums ${muted}`}>
                +{rp.total} RP
              </span>
            )}
          </div>
        </div>

        <Section
          title="Breakdown"
          as="h3"
          className="lg:col-start-1 lg:row-start-1"
          isDarkMode={isDarkMode}
        >
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
                  <span className={muted}>{rowSum(row)}</span>
                  <span
                    className={`w-12 sm:w-16 text-right font-bold ${DATA_CLASS}`}
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
              <span className={`text-lg ${DATA_CLASS}`}>{breakdown.total}</span>
            </div>
            {fouls && foulRow && (
              <div
                className={`flex items-start justify-between gap-3 text-sm pt-1 ${muted}`}
              >
                <span>
                  {foulRow.label} (not part of the score)
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
    </div>
  );
};

/**
 * The pair worth looking at first: the worst match against the best, both
 * of one type in a session of mixed types.
 */
const defaultPair = (matches: Match[]): [number, number] => {
  const top = rankMatches(matches).headline;
  return top ? [top.worst, top.best] : [0, Math.min(1, matches.length - 1)];
};

export const CompareTab = ({
  matches,
  isDarkMode,
  sessionType,
}: {
  matches: Match[];
  isDarkMode: boolean;
  /** Practice sessions leave the penalty row out */
  sessionType?: SessionType;
}) => {
  const [[pickedA, pickedB], setPair] = useState(() => defaultPair(matches));
  const isCompact = useIsCompact();
  // On a phone the chart waits behind a button: the table has every figure.
  const [showChart, setShowChart] = useState(false);
  const chartId = useId();
  const { tooltipControl } = useChartTaps(!canHover());

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
  const ranking = rankMatches(matches);
  // Penalties aren't part of either score: off the chart, and in the table
  // only for a Scrim.
  const aRows = scoreRows(a).filter(row => fouls || !row.informational);
  const bRows = scoreRows(b).filter(row => fouls || !row.informational);

  // The letter tells the two sides apart even when they share a match
  // number (sessions edited before deletes renumbered) or are one match.
  const aLabel = `A · Match ${a.matchNumber}`;
  const bLabel = `B · Match ${b.matchNumber}`;

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
          const r = ranking.rank(i);
          return (
            <option key={m.id} value={i}>
              Match {m.matchNumber} · {plural(scoreOf(m), 'pt')}
              {/* Ranked within its type when the session mixes them */}
              {r ? ` (${r}${ranking.mixed ? ` ${typeOf(m)}` : ''})` : ''}
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
  const scoreDelta = bScore - aScore;
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

  const elementChart = (
    <Section
      title="Element by Element"
      isDarkMode={isDarkMode}
      action={
        isCompact && (
          <button
            type="button"
            aria-expanded={showChart}
            aria-controls={showChart ? chartId : undefined}
            onClick={() => setShowChart(v => !v)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-semibold ${TOUCH_TARGET} ${
              isDarkMode
                ? 'border-team-blue-40 text-white hover:bg-white/5'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {showChart ? 'Hide chart' : 'Show chart'}
            <ChevronDown
              size={16}
              aria-hidden
              className={`transition-transform ${showChart ? 'rotate-180' : ''}`}
            />
          </button>
        )
      }
    >
      {(!isCompact || showChart) && (
        <div id={chartId} data-chart="compare">
          <ResponsiveContainer width="100%" height={300}>
            {/* On a phone the bars run across with every element named down
                the side: under columns that narrow the names collide, and
                the axis drops some of them, the tallest bars' among them. */}
            <BarChart
              data={chartData}
              layout={isCompact ? 'vertical' : 'horizontal'}
              {...chartA11y(
                'Element by element',
                'The points each scoring element earned in Match A and Match B, side by side.'
              )}
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
                  <YAxis width={Y_AXIS_WIDTH} {...axisProps(isDarkMode)} />
                </>
              )}
              <Tooltip
                wrapperStyle={TOOLTIP_WRAPPER_STYLE}
                {...tooltipControl('compare')}
                {...(isCompact
                  ? {
                      position: { y: 0 },
                      allowEscapeViewBox: { x: false, y: false },
                    }
                  : {})}
                cursor={barCursor(isDarkMode)}
                itemSorter={seriesOrder(['a', 'b'])}
                content={
                  <ChartTooltip
                    isDarkMode={isDarkMode}
                    titleKey="name"
                    formatValue={formatPts}
                  />
                }
              />
              <Legend {...LEGEND_PROPS} itemSorter={null} />
              <Bar
                dataKey="a"
                name={aLabel}
                fill={colors.matchA}
                maxBarSize={MAX_BAR_SIZE}
              />
              <Bar
                dataKey="b"
                name={bLabel}
                fill={colors.matchB}
                maxBarSize={MAX_BAR_SIZE}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Section>
  );

  /** Points with the count that made them underneath: "60" over "3 × 20" */
  const pointsCell = (row: ScoreRow) => (
    <td className="text-right tabular-nums py-1.5 align-top">
      <span className="block font-semibold">{row.points}</span>
      <span className={`block text-xs ${mutedTone}`}>
        {row.informational ? plural(row.count, 'foul', 'fouls') : rowSum(row)}
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

      {/* The difference in one line; the table below has the rest */}
      <p className={`text-sm ${cellTone}`}>
        {scoreDelta === 0 ? (
          'A and B scored the same'
        ) : (
          <>
            B scored{' '}
            <span
              className={`font-semibold tabular-nums ${deltaTone(scoreDelta)}`}
            >
              {Math.abs(scoreDelta)} {scoreDelta > 0 ? 'more' : 'fewer'}
            </span>{' '}
            than A
          </>
        )}
        {typeOf(a) !== typeOf(b) && (
          <span className={mutedTone}>
            {' '}
            · {typeOf(a)} vs {typeOf(b)}
          </span>
        )}
      </p>

      {/* The chart after the table on a phone, where it is hidden at first */}
      {!isCompact && elementChart}

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

      {isCompact && elementChart}
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
  const best = Math.max(...scores);
  const worst = Math.min(...scores);
  // Figures beyond the list only when there are two different scores
  const ranked = scores.length >= 2 && best !== worst;

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

      {/* With one match, or every score the same, the average and a best
          and worst are just the score the list below shows: no tiles. */}
      {ranked && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <StatTile
            label="Avg Score"
            value={Math.round(mean(scores))}
            caption={plural(scores.length, 'match', 'matches')}
            isDarkMode={isDarkMode}
          />
          <StatTile
            label="Best Score"
            value={best}
            tone="success"
            isDarkMode={isDarkMode}
          />
          <StatTile
            label="Worst Score"
            value={worst}
            tone="danger"
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
                    <span className={muted}> · {m.matchType}</span>
                  )}
                </span>
                <span className={`font-bold ${DATA_CLASS}`}>
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
