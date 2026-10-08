import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  useId,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useTheme, useTeam } from '@/contexts';
import { firebaseService } from '@/services';
import {
  formatDate,
  logger,
  cycleTimesOf,
  rankingPoints,
  rankingPointTally,
  robotRates,
  robotsOf,
  swarmMissing,
  normalizeForMatchType,
  toneOf,
  ELEMENT_LABELS,
  ELEMENT_COLORS,
  CHART_COLORS,
  SERIES_COLORS,
} from '@/lib';
import type { RankingPointTally, Tone } from '@/lib';
import { getPendingDeleteIds } from '@/lib/pendingSessionDeletes';
import { ROUTES, APP_CONFIG } from '@/constants';
import { PAGE_CONTAINER } from '@/constants/layout';
import { useIsCompact } from '@/hooks';
import type { Session, Match, ScoreBreakdown } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, SECTION_TITLE_CLASS } from '@/components/ui/page-header';
import { Segmented } from '@/components/ui/segmented';
import {
  CHIP_BASE,
  CHIP_SIZES,
  DATA_CLASS,
  chipTone,
  selectedClass,
} from '@/components/ui/tokens';
import {
  ChartTooltip,
  axisColor,
  axisProps,
  dotProps,
  LEGEND_PROPS,
  TOOLTIP_WRAPPER_STYLE,
} from '@/components/charts/chartKit';
import { Check, ChevronDown, Info, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type YAxisProps,
} from 'recharts';
import {
  useAddressSettings,
  useLifetimeSessions,
  useSessionScope,
  byDateAscending,
  sessionTitle,
  isScrim,
  matchBreakdown,
  sessionDateLabels,
  plural,
  formatNumber,
  mean,
  MATCH_TYPES,
  matchTypeOf,
  matchTypeFromParam,
  matchTypeParam,
  ofMatchType,
} from './lifetime';

/** A match as a comparison column, with what it needs from its session. */
interface CompareMatch extends Match {
  /** `sessionId-id`: unique across sessions, which a match id alone is not */
  key: string;
  sessionId: string;
  sessionName: string;
  /** When its session was recorded, as written beside the session's name */
  sessionDate: string;
  /** Fouls are only recorded in a Scrim */
  scrim: boolean;
  breakdown: ScoreBreakdown;
}

/** Which slice of a match score the comparison charts plot. */
type ScoreElement =
  | 'total'
  | 'tipping'
  | 'garden'
  | 'flower'
  | 'flowerBonus'
  | 'hive'
  | 'robots';

/**
 * The elements add up to the total; each means the same in the tables. In
 * the order of `scoreRows` (`GROUPED_ELEMENT_ORDER`), the order the scoring
 * page asks for them, as on Analysis and Charts: the pills and the table
 * rows follow it.
 */
const ELEMENT_NAMES: Record<ScoreElement, string> = {
  total: 'Final Score',
  tipping: ELEMENT_LABELS.tipping,
  robots: ELEMENT_LABELS.robots,
  flower: ELEMENT_LABELS.flower,
  flowerBonus: ELEMENT_LABELS.flowerBonus,
  hive: ELEMENT_LABELS.hive,
  garden: ELEMENT_LABELS.garden,
};

const ELEMENTS = Object.keys(ELEMENT_NAMES) as ScoreElement[];

const ELEMENT_OPTIONS = ELEMENTS.map(element => ({
  value: element,
  label: ELEMENT_NAMES[element],
}));

/** Each element in its colour from every other chart; the score in its own. */
const ELEMENT_TONES: Record<ScoreElement, Tone> = {
  total: CHART_COLORS.total,
  tipping: ELEMENT_COLORS.tipping,
  garden: ELEMENT_COLORS.garden,
  flower: ELEMENT_COLORS.flower,
  flowerBonus: ELEMENT_COLORS.flowerBonus,
  hive: ELEMENT_COLORS.hive,
  robots: ELEMENT_COLORS.robots,
};

/** Points a match earned from one element (or its full score). */
const elementPoints = (b: ScoreBreakdown, element: ScoreElement): number => {
  switch (element) {
    case 'garden':
      return b.garden;
    case 'tipping':
      return b.tipping;
    case 'flower':
      return b.flower;
    case 'flowerBonus':
      return b.flowerBonus;
    case 'hive':
      return b.hive;
    case 'robots':
      return b.leave + b.park;
    default:
      return b.total;
  }
};

/**
 * A points axis in round steps of Hive Tips (20 points each; 10 for a small
 * range), from 0 to the first step at or over the highest value: 0, 40, 80,
 * 120, 160 rather than Recharts' own 0, 35, 70, 105, 140.
 */
const pointsAxis = (values: number[]) => {
  const max = Math.max(0, ...values);
  const step = max <= 40 ? 10 : max <= 120 ? 20 : max <= 240 ? 40 : 80;
  const top = Math.max(step, Math.ceil(max / step) * step);
  return {
    domain: [0, top],
    ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step),
  } satisfies YAxisProps;
};

/** The elements counted in Hive Tips (or made mostly of them). */
const ON_TIP_AXIS: ReadonlySet<ScoreElement> = new Set(['total', 'tipping']);

/** A type's name where the rows go by their short names too (below lg). */
const MATCH_TYPE_SHORT: Record<string, string> = { Autonomous: 'Auto' };

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** What `Intl.Segmenter` gives, where the browser has one */
type GraphemeSegmenter = new (
  locale?: string,
  options?: { granularity: 'grapheme' }
) => { segment: (text: string) => Iterable<{ segment: string }> };

/**
 * The characters of a text as a reader sees them: an emoji built of several
 * code points (a family, a flag, a skin tone) is one. Without a segmenter,
 * code points at least, so no emoji is ever cut in half.
 */
const graphemes = (text: string): string[] => {
  const Segmenter = (Intl as unknown as { Segmenter?: GraphemeSegmenter })
    .Segmenter;
  return Segmenter
    ? Array.from(
        new Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
        part => part.segment
      )
    : Array.from(text);
};

/** A name cut to `max` characters with an ellipsis, never inside an emoji */
const shorten = (text: string, max = 14): string => {
  const chars = graphemes(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text;
};

/** 'Sep 24' out of 'Sep 24, 10:15 AM': the time is for the tooltip. */
const dayOf = (date: string): string => date.split(', ')[0];

const breakdownsOf = (session: Session): ScoreBreakdown[] =>
  session.matches.map(m => matchBreakdown(m, session.matchType));

/** Average points per match a session earned from one part of the score. */
const avgPoints = (
  session: Session,
  points: (b: ScoreBreakdown) => number
): number | null => mean(breakdownsOf(session).map(points));

/** Average of a per-match count across a session. */
const avgCount = (
  session: Session,
  count: (m: Match) => number
): number | null => mean(session.matches.map(count));

/** Average time between Hive Tips, or null when none was recorded. */
const sessionCycleTime = (session: Session): number | null =>
  mean(session.matches.flatMap(cycleTimesOf));

/**
 * Leave / park conversion, counting only the periods each match actually
 * ran. Null (shown as N/A) when the session never ran that period.
 */
const sessionRate = (
  session: Session,
  rate: 'leaveRate' | 'parkRate'
): number | null => robotRates(session.matches, session.matchType)[rate];

/**
 * Ranking points a session's matches earned from their own scoring. A win or
 * tie needs the opponent's score, which isn't recorded.
 */
const sessionRankingPoints = (session: Session): RankingPointTally =>
  rankingPointTally(session.matches, session.matchType);

/**
 * Percentage of a session's matches that earned one ranking point: for
 * SWARM, of the matches that could (two robots and an Auto period), null
 * when none could.
 */
const rankingPointShare = (
  session: Session,
  key: 'swarm' | 'pollinator1' | 'pollinator2'
): number | null => {
  const tally = sessionRankingPoints(session);
  const chances = key === 'swarm' ? tally.swarmChances : session.matches.length;
  return chances > 0 ? (tally[key] / chances) * 100 : null;
};

/** Why a session has no SWARM figure: what it would take */
const sessionSwarmMissing = (session: Session): string =>
  swarmMissing(session.matches, session.matchType);

const formatRate = (v: number) => `${Math.round(v)}%`;
const formatSeconds = (v: number) => `${v.toFixed(1)}s`;
/** An average in points, as the tooltips write it: '145.2 pts' */
const formatAvgPoints = (v: number) => `${formatNumber(v)}\u00A0pts`;

/** Which parks a robot made, in the periods the match ran. */
const parksOf = (match: CompareMatch, robot: 1 | 2): string => {
  const m = normalizeForMatchType(match, match.matchType);
  return (
    [
      (robot === 1 ? m.robot1ParkAuto : m.robot2ParkAuto) && 'Auto',
      (robot === 1 ? m.robot1ParkTeleop : m.robot2ParkTeleop) && 'End',
    ]
      .filter(Boolean)
      .join(', ') || 'None'
  );
};

/** The ranking points a match earned, as [badge, full name]. */
const earnedOf = (match: CompareMatch): Array<readonly [string, string]> => {
  const rp = rankingPoints(match);
  return [
    ...(rp.swarm ? [['SWARM', 'SWARM'] as const] : []),
    ...(rp.pollinator >= 1 ? [['P1', 'POLLINATOR 1'] as const] : []),
    ...(rp.pollinator >= 2 ? [['P2', 'POLLINATOR 2'] as const] : []),
  ];
};

/** 'A', 'A and B', 'A, B and C' */
const listOf = (names: string[]): string =>
  names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * X-axis tick drawn as two lines: what the point is, then when. The axis
 * value itself is only the point's unique key. Recharts reads the font size
 * it spaces ticks by off its own tick class; without it, it spaces them for
 * a bigger font and drops ticks that would fit.
 */
const twoLineTick =
  (lines: Map<string, readonly [string, string]>, fill: string) =>
  ({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
    const [top, bottom] = lines.get(payload.value) ?? ['', ''];
    return (
      <text
        className="recharts-cartesian-axis-tick-value"
        x={x}
        y={y}
        textAnchor="middle"
        fill={fill}
        fontSize={11}
      >
        <tspan x={x} dy="0.9em">
          {top}
        </tspan>
        <tspan x={x} dy="1.25em">
          {bottom}
        </tspan>
      </text>
    );
  };

/**
 * Room either side of the plot so the first and last two-line ticks fit
 * under their points instead of being dropped at the chart's edge. A
 * phone's ticks are only a date, so they need less.
 */
const twoLineAxis = (compact: boolean) =>
  ({
    interval: 'preserveStartEnd',
    padding: compact ? { left: 24, right: 24 } : { left: 44, right: 44 },
  }) as const;

/** The wider of a tick's two lines, which is what its spacing is based on. */
const widerLine = (
  lines: Map<string, readonly [string, string]>,
  key: string
) => [...(lines.get(key) ?? [''])].sort((a, b) => b.length - a.length)[0];

/** The fewest sessions a trend chart is drawn for */
const TREND_SESSIONS_MIN = 3;

/** Most bars that still get their value written on top. */
const BAR_LABELS_MAX = 8;

/** Most matches the cycle-time chart draws a line each for. */
const CYCLE_LINES_MAX = 3;

/**
 * A shadow on a scroller's right edge, painted as the scroller's own
 * background so it stays on the edge as the table scrolls and the table's
 * text is always drawn over it, never dimmed by it. On a phone it is as
 * wide as a cell's side padding, so it only sits behind a value whose
 * column is already cut off. A tablet or laptop screen, where a band that
 * thin is easy to miss, gets a wider, darker one.
 */
const RIGHT_EDGE_SHADOW = {
  light:
    'bg-[linear-gradient(to_left,rgba(0,0,0,0.15),transparent)] md:bg-[linear-gradient(to_left,rgba(0,0,0,0.3),transparent)] bg-[length:0.5rem_100%] md:bg-[length:1.5rem_100%] bg-right bg-no-repeat',
  dark: 'bg-[linear-gradient(to_left,rgba(255,255,255,0.15),transparent)] md:bg-[linear-gradient(to_left,rgba(255,255,255,0.3),transparent)] bg-[length:0.5rem_100%] md:bg-[length:1.5rem_100%] bg-right bg-no-repeat',
};

/**
 * A session's name over its column(s), capped at two lines (in full on
 * hover) and breakable anywhere, so one long name can't stretch its column
 * or tower over the others. Right-aligned or centred, Chrome draws the '…'
 * of a name cut between words after the line's end, outside the box: the
 * box clips only below its two lines, so the '…' shows in full in the
 * cell's padding (and, past the last column, in TABLE_SCROLLER's).
 */
const NAME_CLAMP =
  'line-clamp-2 [overflow:visible_clip] [overflow-wrap:anywhere]';

/**
 * A comparison table's scroller. `relative`: a cell's screen-reader text is
 * absolutely placed, and without a positioned scroller around it one in an
 * off-screen column would widen the page. The right padding, taken from the
 * card's, is room for a cut name's '…' past the last column (NAME_CLAMP),
 * which would otherwise make a table that fits scroll a few pixels.
 */
const TABLE_SCROLLER = 'relative overflow-x-auto -mr-2 pr-2';

/**
 * Tracks a table's scroller. While the table runs past the right edge, that
 * edge casts a shadow, so a cut-off or hidden column reads as "swipe for
 * more" instead of as the end of the table. Once it has been scrolled, the
 * sticky Metric column casts one over the values sliding under it. Returns
 * the scroller's ref, the class to give it and whether it is scrolled.
 */
const useTableScroll = (isDarkMode: boolean) => {
  const [more, setMore] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const ref = useCallback((scroller: HTMLDivElement | null) => {
    if (!scroller) return;
    const update = () => {
      setMore(
        scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1
      );
      setScrolled(scroller.scrollLeft > 0);
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    // The table changes width as columns come and go
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    if (scroller.firstElementChild)
      observer.observe(scroller.firstElementChild);
    return () => {
      scroller.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);
  return [
    ref,
    more ? RIGHT_EDGE_SHADOW[isDarkMode ? 'dark' : 'light'] : '',
    scrolled,
  ] as const;
};

/**
 * Whether a table packs its columns tight: only once, laid out in full, it
 * runs past the right edge of its scroller. What fits depends on the card's
 * width and on the row names, so it is measured, not counted, and measured
 * again whenever the columns or the card's width change. `columns` names the
 * columns shown. Returns a ref for the table and whether it is packed.
 */
const useDenseTable = (columns: string, allowed: boolean) => {
  const [table, setTable] = useState<HTMLTableElement | null>(null);
  const [width, setWidth] = useState(0);
  /** The columns and width the table in full was found too wide for */
  const [tooWideFor, setTooWideFor] = useState('');
  const fit = `${width} ${columns}`;
  const dense = allowed && tooWideFor === fit;

  useLayoutEffect(() => {
    const scroller = table?.parentElement;
    if (!scroller) return;
    const update = () => setWidth(scroller.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [table]);

  // Before paint, so the table in full is never shown cut off first
  useLayoutEffect(() => {
    const scroller = table?.parentElement;
    if (!allowed || dense || !width || !table || !scroller) return;
    // The scroller's padding is not room for the table (TABLE_SCROLLER)
    const room =
      scroller.clientWidth -
      parseFloat(getComputedStyle(scroller).paddingRight);
    if (table.offsetWidth > room + 1) setTooWideFor(fit);
  }, [allowed, dense, width, table, fit]);

  return [setTable, dense] as const;
};

/** One of the comparison tables, as its rows need it. */
interface TableSpec<T> {
  columns: T[];
  keyOf: (column: T) => string;
  /** Class of the value cells */
  cell: string;
  /** Packed tight to fit its card (see useDenseTable) */
  dense: boolean;
  /** Scrolled sideways, so the Metric column casts a shadow */
  scrolled: boolean;
  /** An Avg column, right after Metric */
  showAvg: boolean;
}

interface RowOptions<T> {
  indent?: boolean;
  higherIsBetter?: boolean;
  format?: (v: number) => string;
  /** The row the table is about: larger figures */
  highlight?: boolean;
  /**
   * The best value gets a star. Only Final Score and Ranking Points: in the
   * other rows the best is bold, so the stars still pick something out.
   */
  star?: boolean;
  /** What the row is called below desktop width, where the full label wraps */
  short?: string;
  /** Also mark the worst cell (only points handed to the opponent) */
  flagWorst?: boolean;
  /** What a column with no value says, instead of N/A */
  missing?: (column: T) => string;
  /** A count written under each value: '5.6 tips' under the points */
  detail?: {
    value: (column: T) => number | null;
    /** The count's noun, singular and plural */
    unit: readonly [string, string];
  };
}

type CellMark = 'best' | 'worst' | null;

/**
 * Which cells of a row to mark, judged on what the cells show: two values
 * that print the same are a tie. Only a best that stands alone is marked,
 * and with `flagWorst` a worst that stands alone. Columns with no value
 * (N/A) take no part.
 */
const markCells = (
  values: Array<number | null>,
  shown: string[],
  higherIsBetter: boolean,
  flagWorst: boolean
): CellMark[] => {
  const marks: CellMark[] = values.map(() => null);
  const known = values
    .flatMap((value, index) =>
      value !== null && Number.isFinite(value) ? [{ value, index }] : []
    )
    .sort((a, b) => a.value - b.value);
  if (known.length < 2) return marks;

  const lowest = known[0].index;
  const highest = known[known.length - 1].index;
  if (shown[lowest] === shown[highest]) return marks;

  const alone = (index: number) =>
    known.every(k => k.index === index || shown[k.index] !== shown[index]);
  const best = higherIsBetter ? highest : lowest;
  const worst = higherIsBetter ? lowest : highest;
  if (alone(best)) marks[best] = 'best';
  if (flagWorst && alone(worst)) marks[worst] = 'worst';
  return marks;
};

/**
 * A card whose title row opens and closes it: a real button, so it is
 * reached with Tab and says whether it is open.
 */
const CompareCard = ({
  title,
  open,
  onToggle,
  className,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  className: string;
  children: ReactNode;
}) => {
  const id = useId();
  return (
    <Card className={className}>
      <h2 className={SECTION_TITLE_CLASS}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className="flex w-full items-center justify-between gap-3 rounded-lg p-4 sm:p-6 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-team-blue"
        >
          <span>{title}</span>
          <ChevronDown
            aria-hidden="true"
            className={`w-5 h-5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h2>
      <div id={id} hidden={!open}>
        {open && (
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {children}
          </CardContent>
        )}
      </div>
    </Card>
  );
};

const MODE_OPTIONS = [
  { value: 'sessions', label: 'Sessions' },
  { value: 'matches', label: 'Matches' },
] as const;

type CompareMode = (typeof MODE_OPTIONS)[number]['value'];

/** A match picked in Matches mode */
interface PickedMatch {
  sessionId: string;
  matchId: string;
}

/** Picked matches as the address holds them: `sessionId~matchId,...` */
const serializeMatches = (matches: PickedMatch[]): string =>
  matches.map(m => `${m.sessionId}~${m.matchId}`).join(',');

const parseMatches = (value: string | null | undefined): PickedMatch[] =>
  (value ?? '').split(',').flatMap(item => {
    const [sessionId, matchId] = item.split('~');
    return sessionId && matchId ? [{ sessionId, matchId }] : [];
  });

/**
 * The last comparison made in this browser, by whom: the sessions (`s`),
 * matches (`m`) and mode, as the address holds them. A convenience: if it
 * can't be read or written, Compare opens on the two newest sessions.
 */
const PICK_KEY = 'teamtrack-compare-pick';

interface RememberedPick {
  s?: string;
  m?: string;
  mode?: string;
}

const recallPick = (owner: string): RememberedPick | null => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PICK_KEY) ?? '');
    if (typeof value !== 'object' || value === null) return null;
    const saved = value as RememberedPick & { owner?: string };
    return saved.owner === owner ? saved : null;
  } catch {
    return null;
  }
};

const rememberPick = (owner: string, pick: RememberedPick): void => {
  try {
    localStorage.setItem(PICK_KEY, JSON.stringify({ owner, ...pick }));
  } catch {
    /* private mode: only this visit remembers */
  }
};

/**
 * What Compare compares, kept in its address: the picked sessions (`s`, a
 * comma list; links made before it say `session1` and `session2`), the
 * picked matches (`m`), the mode and the match type. `named` says the
 * address names a pick, even an empty one, which Compare then leaves as it
 * is.
 */
const usePick = () => {
  const [address, updateAddress] = useAddressSettings();
  const listed = address.get('s');
  const first = address.get('session1');
  const second = address.get('session2');
  const selectedSessionIds = useMemo(() => {
    if (listed !== null) return [...new Set(listed.split(',').filter(Boolean))];
    if (!first) return [];
    return second && second !== first ? [first, second] : [first];
  }, [listed, first, second]);
  const matchesParam = address.get('m');
  const selectedMatches = useMemo(
    () => parseMatches(matchesParam),
    [matchesParam]
  );
  const comparisonMode: CompareMode =
    address.get('mode') === 'matches' ? 'matches' : 'sessions';
  /** The match type asked for; the most common one until then */
  const pickedType = matchTypeFromParam(address.get('type'));

  /** Change some of the pick, in one write to the address */
  const setPick = useCallback(
    ({
      sessions,
      matches,
      mode,
    }: {
      sessions?: string[];
      matches?: PickedMatch[];
      mode?: CompareMode;
    }) =>
      updateAddress({
        ...(sessions && {
          s: sessions.join(','),
          session1: null,
          session2: null,
        }),
        ...(matches && { m: serializeMatches(matches) || null }),
        ...(mode && { mode: mode === 'matches' ? 'matches' : null }),
      }),
    [updateAddress]
  );
  const setPickedType = (type: string) =>
    updateAddress({ type: matchTypeParam(type) });

  return {
    selectedSessionIds,
    selectedMatches,
    comparisonMode,
    pickedType,
    named: listed !== null || !!first,
    setPick,
    setPickedType,
  };
};

const Compare = () => {
  const { isGuest, user } = useAuth();
  const { isDarkMode, isHoneycombMode, isDeepSeaMode } = useTheme();
  const { team } = useTeam();

  // The newest page of sessions, and older ones a press away
  const {
    sessions: listedSessions,
    loading,
    hasMore,
    loadingOlder,
    loadOlder,
  } = useLifetimeSessions();
  /**
   * The listed sessions that can be compared. A session with no matches has
   * nothing to compare, so it is never offered, nor counted in the scopes.
   */
  const comparableSessions = useMemo(
    () => listedSessions.filter(s => s.matches.length > 0),
    [listedSessions]
  );
  const { scope, setScope, inScope, choices, scopeLabel } = useSessionScope(
    comparableSessions,
    !hasMore
  );
  // What is compared lives in the address (see `usePick`), so opening a
  // session and coming Back finds it as it was, and a link carries it.
  const {
    selectedSessionIds,
    selectedMatches,
    comparisonMode,
    pickedType,
    named,
    setPick,
    setPickedType,
  } = usePick();
  /**
   * The session list on a phone: 'auto' folds it to one line once there is
   * something to compare, 'open' (Change) keeps it open until Done, and
   * 'closed' (Done) keeps it folded.
   */
  const [pickerState, setPickerState] = useState<'auto' | 'open' | 'closed'>(
    'auto'
  );
  const [isDetailedBreakdownOpen, setIsDetailedBreakdownOpen] = useState(true);
  const [isMatchBreakdownOpen, setIsMatchBreakdownOpen] = useState(true);
  const [scoreChartPhase, setScoreChartPhase] = useState<ScoreElement>('total');
  const [isScoreChartOpen, setIsScoreChartOpen] = useState(true);
  const [isCycleChartOpen, setIsCycleChartOpen] = useState(true);
  const [matchScoreChartPhase, setMatchScoreChartPhase] =
    useState<ScoreElement>('total');
  const [isMatchScoreChartOpen, setIsMatchScoreChartOpen] = useState(true);
  const [isMatchCycleChartOpen, setIsMatchCycleChartOpen] = useState(true);
  /** The table key's (i): what the marks mean in full */
  const [showKeyInfo, setShowKeyInfo] = useState(false);
  const keyInfoId = useId();
  const pickerId = useId();
  const pickerSummaryRef = useRef<HTMLButtonElement>(null);
  const sessionListRef = useRef<HTMLDivElement>(null);
  const matchListRef = useRef<HTMLDivElement>(null);
  /**
   * A control that takes itself away (a chip as the list folds, Done,
   * Clear) hands focus on to what replaces it, rather than letting it fall
   * to the page, where a keyboard or a screen reader loses its place. Set by
   * the control; acted on once the render that takes it away is done.
   */
  const refocus = useRef<{
    from: HTMLElement;
    to: () => HTMLElement | null | undefined;
  } | null>(null);
  const handFocusOn = (
    from: HTMLElement,
    to: () => HTMLElement | null | undefined
  ) => {
    refocus.current = { from, to };
  };
  useLayoutEffect(() => {
    const pending = refocus.current;
    if (!pending) return;
    refocus.current = null;
    const active = document.activeElement;
    if (pending.from.isConnected || (active && active !== document.body))
      return;
    pending.to()?.focus();
  });
  const pickerSummaryButton = () => pickerSummaryRef.current;
  const firstSessionChip = () =>
    sessionListRef.current?.querySelector<HTMLElement>('button');
  const firstMatchChip = () =>
    matchListRef.current?.querySelector<HTMLElement>('button');
  const isCompact = useIsCompact();
  const [sessionScrollerRef, sessionTableShadow, sessionTableScrolled] =
    useTableScroll(isDarkMode);
  const [matchScrollerRef, matchTableShadow, matchTableScrolled] =
    useTableScroll(isDarkMode);

  /**
   * Sessions named in the URL that the list doesn't hold (someone else's
   * link, or an older session). Each is fetched once and kept.
   */
  const [linkedSessions, setLinkedSessions] = useState<Session[]>([]);
  const requestedLinks = useRef(new Set<string>());

  useEffect(() => {
    document.title = `Compare - ${APP_CONFIG.name}`;
  }, []);

  /** This viewer's last pick, kept in this browser */
  const pickOwner = user?.uid ?? 'guest';

  // The first visit compares the two newest sessions, and every later one
  // what was compared last, unless the address names a pick (a link, or
  // Back from a session). Only sessions still listed are picked again.
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || loading) return;
    preselected.current = true;
    if (named) return;
    const listed = (id: string) => comparableSessions.some(s => s.id === id);
    const last = recallPick(pickOwner);
    const lastIds = (last?.s ?? '').split(',').filter(listed);
    if (last && lastIds.length > 0) {
      setPick({
        sessions: lastIds,
        matches: parseMatches(last.m).filter(m =>
          lastIds.includes(m.sessionId)
        ),
        mode: last.mode === 'matches' ? 'matches' : 'sessions',
      });
      return;
    }
    const newest = comparableSessions
      .filter(inScope)
      .sort(byDateAscending)
      .slice(-2)
      .map(s => s.id);
    if (newest.length > 0) setPick({ sessions: newest });
  }, [loading, named, comparableSessions, inScope, pickOwner, setPick]);

  // Whatever is compared now is what the next visit opens on
  const pickKey = `${selectedSessionIds.join(',')}|${serializeMatches(selectedMatches)}|${comparisonMode}`;
  useEffect(() => {
    if (!preselected.current) return;
    const [s, m, mode] = pickKey.split('|');
    rememberPick(pickOwner, { s, m, mode });
  }, [pickKey, pickOwner]);

  useEffect(() => {
    // A guest's sessions are all in the list already.
    if (loading || isGuest) return;
    for (const id of selectedSessionIds) {
      if (
        requestedLinks.current.has(id) ||
        listedSessions.some(s => s.id === id) ||
        getPendingDeleteIds().has(id)
      ) {
        continue;
      }
      requestedLinks.current.add(id);
      firebaseService
        .getSession(id)
        .then(session => {
          if (session) setLinkedSessions(prev => [...prev, session]);
        })
        .catch(error => {
          logger.error('Error loading sessions', error);
          toast.error('Failed to load some sessions');
        });
    }
  }, [loading, isGuest, selectedSessionIds, listedSessions]);

  /**
   * Every session that can be picked: the list in the chosen scope, then any
   * linked extras. A picked session stays listed whatever the scope, so
   * narrowing it never drops something from the comparison unseen. A linked
   * session with no matches is left out like a listed one.
   */
  const sessions = useMemo(
    () => [
      ...comparableSessions.filter(
        s => inScope(s) || selectedSessionIds.includes(s.id)
      ),
      ...linkedSessions.filter(
        linked =>
          linked.matches.length > 0 &&
          !listedSessions.some(s => s.id === linked.id)
      ),
    ],
    [
      comparableSessions,
      listedSessions,
      linkedSessions,
      inScope,
      selectedSessionIds,
    ]
  );

  const dateLabels = useMemo(() => sessionDateLabels(sessions), [sessions]);

  /**
   * The picked sessions, straight from the loaded list — nothing is fetched
   * again when the selection changes. Oldest first, so the charts read left
   * to right in time and the table columns sit in the same order.
   */
  const pickedSessions = useMemo(
    () =>
      sessions
        .filter(s => selectedSessionIds.includes(s.id))
        .sort(byDateAscending),
    [sessions, selectedSessionIds]
  );

  /** The match types the picked sessions ran, with how many matches each. */
  const typeChoices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of pickedSessions) {
      for (const match of session.matches) {
        const type = matchTypeOf(match, session);
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
    }
    const rank = (type: string) =>
      MATCH_TYPES.includes(type)
        ? MATCH_TYPES.indexOf(type)
        : MATCH_TYPES.length;
    return [...counts]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => rank(a.value) - rank(b.value));
  }, [pickedSessions]);

  /**
   * The one match type compared, as on Charts: the one asked for while the
   * picked sessions still have it, otherwise the one with the most matches.
   */
  const matchType =
    typeChoices.find(choice => choice.value === pickedType)?.value ??
    [...typeChoices].sort((a, b) => b.count - a.count)[0]?.value ??
    MATCH_TYPES[0];

  /**
   * What is compared: each picked session cut down to its matches of that
   * type, so a Mixed session's 30-second Autonomous runs are never averaged
   * in with its full games. A session with none of them sits out.
   */
  const comparedSessions = useMemo(
    () =>
      pickedSessions.flatMap(session => ofMatchType(session, matchType) ?? []),
    [pickedSessions, matchType]
  );
  const sittingOut = pickedSessions.filter(
    session => !comparedSessions.some(s => s.id === session.id)
  );

  /** Every match compared, in session order. */
  const allMatches = useMemo(
    (): CompareMatch[] =>
      comparedSessions.flatMap(session =>
        session.matches.map(match => ({
          ...match,
          matchType: match.matchType || session.matchType,
          key: `${session.id}-${match.id}`,
          sessionId: session.id,
          sessionName: sessionTitle(session),
          sessionDate: dateLabels.get(session.id) ?? '',
          scrim: isScrim(session),
          breakdown: matchBreakdown(match, session.matchType),
        }))
      ),
    [comparedSessions, dateLabels]
  );

  /**
   * The picked matches in the one order everything draws them in: by
   * session, then as the session lists them. The table header, every row,
   * the Avg column and both match charts read this list, so a value can't
   * land under another match's header whatever order they were clicked in,
   * and a match leaves with its session.
   */
  const matchColumns = useMemo(
    () =>
      allMatches.filter(match =>
        selectedMatches.some(
          picked =>
            picked.sessionId === match.sessionId && picked.matchId === match.id
        )
      ),
    [allMatches, selectedMatches]
  );

  /**
   * Who recorded a session, when a team shares the list and it was someone
   * else: your own sessions need no name on them.
   */
  const ownerOf = (session: Session): string | undefined => {
    if (!team || session.userId === user?.uid) return undefined;
    const member = team.members.find(m => m.userId === session.userId);
    return member?.displayName || member?.email || session.userEmail;
  };

  /** 'Sep 25', plus who recorded it when that was a teammate. */
  const whenAndWho = (session: Session): string => {
    const owner = ownerOf(session);
    const date = dateLabels.get(session.id) ?? '';
    return owner ? `${date} · ${owner}` : date;
  };

  /**
   * The same, for a narrow column: it may break only between its parts
   * ('Sep 26,' '10:15 AM' '· Vedant'), never inside one.
   */
  const whenAndWhoLines = (session: Session): ReactNode => {
    const [day, time] = (dateLabels.get(session.id) ?? '').split(', ');
    const owner = ownerOf(session);
    return (
      <>
        <span className="whitespace-nowrap">
          {day}
          {time && ','}
        </span>
        {time && (
          <>
            {' '}
            <span className="whitespace-nowrap">{time}</span>
          </>
        )}
        {owner && (
          <>
            {' '}
            <span className="whitespace-nowrap">· {owner}</span>
          </>
        )}
      </>
    );
  };

  const goodTone = isDarkMode ? 'text-green-500' : 'text-green-700';
  const badTone = isDarkMode ? 'text-red-500' : 'text-red-600';
  const tone = (color: Tone) => toneOf(color, isDarkMode);
  const seriesColors = SERIES_COLORS[isDarkMode ? 'dark' : 'light'];
  /** The card's own colour, which rings the chart dots */
  const cardBg = !isDarkMode
    ? '#ffffff'
    : isHoneycombMode
      ? '#141414'
      : isDeepSeaMode
        ? '#0d1b2a'
        : '#191919';

  /** Rules between rows stay neutral; only the header's carries the accent. */
  const rowRule = isDarkMode ? 'border-white/10' : 'border-gray-100';
  const headerRule = isDarkMode ? 'border-team-blue-40' : 'border-gray-200';
  const headTone = isDarkMode ? 'text-team-white-60' : 'text-gray-600';

  /**
   * The Metric column stays put while the others scroll sideways under it,
   * so it needs the card's own colour as a solid fill. The default dark card
   * is see-through over the page; Honeycomb and Deep Sea paint it solid.
   * Once the table is scrolled it casts a soft shadow over the values going
   * under it. Padding is tight on a phone so two columns fit beside it; the
   * left padding is set per cell, as a sub-row's is deeper.
   */
  const metricColumn = (scrolled: boolean) =>
    `sticky left-0 z-10 py-3 pr-2 sm:pr-4 max-[359px]:pr-1 text-left ${
      !isDarkMode
        ? `bg-white ${scrolled ? 'shadow-[1px_0_0_rgba(0,0,0,0.08),6px_0_8px_-4px_rgba(0,0,0,0.25)]' : 'shadow-[1px_0_0_rgba(0,0,0,0.08)]'}`
        : `${isHoneycombMode || isDeepSeaMode ? 'bg-team-dark-20' : 'bg-team-dark'} ${scrolled ? 'shadow-[1px_0_0_rgba(255,255,255,0.12),8px_0_8px_-4px_rgba(0,0,0,0.9)]' : 'shadow-[1px_0_0_rgba(255,255,255,0.08)]'}`
    }`;
  /**
   * Over the values sliding under the scrolled Metric column, a fade into
   * the card's colour: a shadow alone barely shows on the dark cards.
   */
  const scrollFade = (scrolled: boolean) =>
    scrolled && (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-full w-4"
        style={{
          background: `linear-gradient(to right, ${cardBg}, transparent)`,
        }}
      />
    );
  /**
   * A laptop has room for each row name on one line, except in a dense
   * table, where a name wraps once the columns are at their narrowest, but
   * no further than the floor that keeps its words whole.
   */
  const metricFit = (dense: boolean) =>
    dense ? 'md:pr-2 lg:min-w-[7.5rem]' : 'lg:whitespace-nowrap';
  /** Under 360 px every pixel of padding goes to the values. */
  const dataCell = 'text-right py-3 px-2 sm:px-4 max-[359px]:px-1.5 text-sm';
  // Packing only ever helps: a phone with five sessions scrolls either way.
  const [sessionTableRef, denseSessions] = useDenseTable(
    comparedSessions.map(s => s.id).join(' '),
    true
  );
  const sessionCell = `${dataCell} ${denseSessions ? 'md:px-2' : ''}`;
  /**
   * Whether 'Parked in' keeps '3 Auto, 6 End' on one line. Where the
   * columns are squeezed (a phone, a packed table) it may break after the
   * comma instead, which is narrower than any other cell of the row.
   */
  const parkedFits = !isCompact && !denseSessions;
  /**
   * The match table keeps a phone's padding on a wider screen too: its
   * columns are many, and the room is better spent on the session names.
   */
  const matchCell = `${dataCell} md:px-2`;
  // A phone already scrolls two matches sideways, so it never packs them.
  const [matchTableRef, denseMatches] = useDenseTable(
    matchColumns.map(m => m.key).join(' '),
    !isCompact
  );
  /** Two matches on a phone have no room for an average of the two. */
  const showMatchAvg = matchColumns.length > (isCompact ? 2 : 1);
  /**
   * The rule between the Avg column and the matches, in every row. Its own
   * side's colour, so the header's accent rule under Avg keeps its own.
   */
  const avgDivider = `border-r ${isDarkMode ? 'border-r-white/10' : 'border-r-gray-100'}`;

  const sessionTable: TableSpec<Session> = {
    columns: comparedSessions,
    keyOf: s => s.id,
    cell: sessionCell,
    dense: denseSessions,
    scrolled: sessionTableScrolled,
    showAvg: false,
  };
  const matchTable: TableSpec<CompareMatch> = {
    columns: matchColumns,
    keyOf: m => m.key,
    cell: matchCell,
    dense: denseMatches,
    scrolled: matchTableScrolled,
    showAvg: showMatchAvg,
  };

  /** A row's name, in the Metric column. */
  const metricCell = (
    label: string,
    {
      indent = false,
      short,
      dense = false,
      scrolled = false,
    }: { indent?: boolean; short?: string; dense?: boolean; scrolled?: boolean }
  ) => (
    <th
      scope="row"
      className={`${metricColumn(scrolled)} ${metricFit(dense)} font-normal ${indent ? `pl-4 ${dense ? 'sm:pl-5' : 'sm:pl-8'} max-[359px]:pl-3 text-xs sm:text-sm` : 'pl-3 sm:pl-4 max-[359px]:pl-2 text-sm'} ${
        indent
          ? isDarkMode
            ? 'text-team-white-60'
            : 'text-gray-600'
          : 'text-foreground'
      }`}
    >
      {scrollFade(scrolled)}
      {/* The indent alone shows the nesting where every pixel counts */}
      {indent && (
        <span aria-hidden="true" className="max-[359px]:hidden">
          {'↳\u00A0'}
        </span>
      )}
      {short ? (
        <>
          <span className="lg:hidden">{short}</span>
          <span className="hidden lg:inline">{label}</span>
        </>
      ) : (
        label
      )}
    </th>
  );

  const clearSessions = () => {
    setPick({ sessions: [], matches: [] });
    setPickerState('auto');
  };

  const toggleSession = (sessionId: string) => {
    if (selectedSessionIds.includes(sessionId)) {
      const rest = selectedSessionIds.filter(id => id !== sessionId);
      // Its matches leave the comparison with it, in the same update.
      setPick({
        sessions: rest,
        matches: selectedMatches.filter(m => m.sessionId !== sessionId),
      });
      if (rest.length === 0) setPickerState('auto');
    } else {
      setPick({ sessions: [...selectedSessionIds, sessionId] });
    }
  };

  const toggleMatch = (match: CompareMatch) => {
    const isSame = (m: PickedMatch) =>
      m.sessionId === match.sessionId && m.matchId === match.id;
    setPick({
      matches: selectedMatches.some(isSame)
        ? selectedMatches.filter(m => !isSame(m))
        : [
            ...selectedMatches,
            { sessionId: match.sessionId, matchId: match.id },
          ],
    });
  };

  /**
   * One table row. A column with no value (null) reads N/A, takes no
   * best/worst mark and is left out of the average.
   */
  const renderRow = <T,>(
    table: TableSpec<T>,
    label: string,
    getValue: (column: T) => number | null,
    opts: RowOptions<T> = {}
  ): ReactNode => {
    const {
      indent = false,
      higherIsBetter = true,
      format = v => Math.round(v).toString(),
      highlight = false,
      star = false,
      short,
      flagWorst = false,
      detail,
      missing,
    } = opts;
    const values = table.columns.map(getValue);
    const show = (v: number | null) => (v === null ? 'N/A' : format(v));
    const shown = values.map(show);
    const marks = markCells(values, shown, higherIsBetter, flagWorst);
    const known = (v: number | null): v is number => v !== null;
    const avg = mean(values.filter(known));
    const counts = detail ? table.columns.map(detail.value) : [];
    const avgCountValue = mean(counts.filter(known));
    /** The count under a value, e.g. '5.6 tips' */
    const countLine = (count: number | null | undefined) => {
      // '0 tips' under a 0 says nothing the 0 doesn't
      if (!detail || count === null || count === undefined || count === 0)
        return null;
      const text = formatNumber(count);
      return (
        <span
          className={`block text-xs font-normal whitespace-nowrap ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
        >
          {text} {text === '1' ? detail.unit[0] : detail.unit[1]}
        </span>
      );
    };
    const size = highlight ? 'text-lg' : '';
    return (
      <tr className={`border-b ${rowRule}`}>
        {metricCell(label, {
          indent,
          short,
          dense: table.dense,
          scrolled: table.scrolled,
        })}
        {table.showAvg && (
          <td
            className={`${table.cell} ${size} ${avgDivider} ${highlight ? 'font-bold' : 'font-medium'} ${DATA_CLASS}`}
          >
            <span className="whitespace-nowrap">{show(avg)}</span>
            {avg !== null && countLine(avgCountValue)}
          </td>
        )}
        {table.columns.map((column, i) => {
          const mark = marks[i];
          return (
            <td
              key={table.keyOf(column)}
              className={`${table.cell} ${size} ${
                highlight || mark === 'best' ? 'font-bold' : 'font-normal'
              } tabular-nums ${mark === 'worst' ? badTone : 'text-foreground'}`}
            >
              {values[i] === null && missing ? (
                // Words, not a figure: muted, and free to wrap
                <span className={`block text-xs font-normal ${mutedText}`}>
                  {missing(column)}
                </span>
              ) : (
                <span
                  data-best={mark === 'best' ? '' : undefined}
                  className="inline-flex items-center justify-end gap-1 whitespace-nowrap"
                >
                  {mark === 'best' && star && (
                    <Star
                      aria-hidden="true"
                      className={`w-3 h-3 shrink-0 fill-current ${goodTone}`}
                    />
                  )}
                  {shown[i]}
                  {mark === 'best' && <span className="sr-only"> (best)</span>}
                  {mark === 'worst' && <span className="sr-only"> (most)</span>}
                </span>
              )}
              {values[i] !== null && countLine(counts[i])}
            </td>
          );
        })}
      </tr>
    );
  };

  const renderSessionRow = (
    label: string,
    getValue: (session: Session) => number | null,
    opts: RowOptions<Session> = {}
  ) => renderRow(sessionTable, label, getValue, opts);

  const renderMatchRow = (
    label: string,
    getValue: (match: CompareMatch) => number | null,
    opts: RowOptions<CompareMatch> = {}
  ) => renderRow(matchTable, label, getValue, opts);

  const gridStroke = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const tickFill = axisColor(isDarkMode);
  const axis = axisProps(isDarkMode);
  const tooltipFor = (formatValue: (v: number) => string) => (
    <ChartTooltip isDarkMode={isDarkMode} formatValue={formatValue} />
  );

  /**
   * Session charts: name over date on the axis, both in the tooltip. A
   * phone only has room under each point for the date (and under it the
   * time, when a day has two sessions); the name stays in the tooltip.
   */
  const sessionTicks = new Map(
    comparedSessions.map(session => {
      const date = dateLabels.get(session.id) ?? '';
      if (isCompact) {
        const [day, time = ''] = date.split(', ');
        return [session.id, [day, time] as const];
      }
      return [session.id, [shorten(sessionTitle(session)), date] as const];
    })
  );
  /** A session chart's row: its key, and the tooltip's heading and note. */
  const sessionPoint = (session: Session) => ({
    id: session.id,
    label: sessionTitle(session),
    note: whenAndWho(session),
  });

  /**
   * Match charts: session over 'M# · date' on the axis. The time of day,
   * when the date has one, is only in the tooltip: on the axis it made each
   * tick wider than its bar and ran into the next.
   */
  const matchTicks = new Map(
    matchColumns.map(match => [
      match.key,
      [
        shorten(match.sessionName),
        `M${match.matchNumber} · ${dayOf(match.sessionDate)}`,
      ] as const,
    ])
  );

  const anyScrimSession = comparedSessions.some(isScrim);
  const anyScrimMatch = matchColumns.some(m => m.scrim);

  if (loading) {
    return (
      <div
        className={`min-h-[100dvh] flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-blue"></div>
          <p className="text-sm text-team-blue">Loading sessions...</p>
        </div>
      </div>
    );
  }

  const cardClass = isDarkMode
    ? 'bg-team-dark-20 border-team-blue-40'
    : 'bg-white border-gray-200';
  const mutedText = isDarkMode ? 'text-team-white-60' : 'text-gray-500';

  /**
   * The elements a chart can plot, in one row that scrolls sideways on a
   * phone rather than wrapping to three.
   */
  const elementPicker = (
    value: ScoreElement,
    onChange: (element: ScoreElement) => void
  ) => (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 mb-4 overflow-x-auto">
      <Segmented
        label="Scoring element"
        value={value}
        options={ELEMENT_OPTIONS}
        onChange={onChange}
        isDarkMode={isDarkMode}
        className="flex-nowrap w-max"
      />
    </div>
  );

  /** The line over a table that says what its marks mean. */
  const tableKey = (withOpponentRow: boolean) => (
    <div className="mb-3">
      <p
        className={`flex flex-wrap items-center gap-x-1.5 text-xs ${mutedText}`}
      >
        <span className="inline-flex items-center gap-1">
          <Star
            aria-hidden="true"
            className={`w-3 h-3 fill-current ${goodTone}`}
          />
          best
        </span>
        <span aria-hidden="true">·</span>
        <span>N/A not run</span>
        {withOpponentRow && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              <span className={`font-semibold ${badTone}`}>red</span> most to
              opponent
            </span>
          </>
        )}
        <button
          type="button"
          onClick={() => setShowKeyInfo(v => !v)}
          aria-expanded={showKeyInfo}
          aria-controls={keyInfoId}
          aria-label="About these marks"
          className={`inline-flex items-center justify-center rounded-full p-1 -my-1 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 [@media(pointer:coarse)]:-my-3.5 transition-colors hover:text-team-blue aria-expanded:text-team-blue ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
        >
          <Info size={14} aria-hidden="true" />
        </button>
      </p>
      <p
        id={keyInfoId}
        hidden={!showKeyInfo}
        className={`mt-1 text-xs text-balance ${mutedText}`}
      >
        The star marks the best Final Score and Ranking Points; in the other
        rows the best value is bold. Values that read the same are a tie and are
        not marked. N/A means that part of the match was not run
        {withOpponentRow
          ? ', or, for points given to the opponent, that it was not a Scrim.'
          : '.'}
      </p>
    </div>
  );

  /**
   * Shown in place of the comparison until something is picked. The same
   * anatomy as Charts' empty states: a section title and one muted line.
   */
  const pickPrompt = (title: string, text: string) => (
    <Card className={cardClass}>
      <CardContent className="px-4 py-10 sm:py-12">
        <div className="text-center">
          <h2 className={`${SECTION_TITLE_CLASS} mb-2`}>{title}</h2>
          <p
            className={`text-sm sm:text-base ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            {text}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  /** A session or match that can be ticked in or out of the comparison. */
  const toggleChip = (active: boolean) =>
    `rounded-lg border transition-colors [@media(pointer:coarse)]:min-h-11 ${
      active
        ? selectedClass(isDarkMode)
        : isDarkMode
          ? 'border-team-blue-40 bg-team-dark-20 text-gray-200 hover:border-team-blue hover:text-white'
          : 'border-gray-200 bg-white text-gray-800 hover:border-gray-400 hover:text-gray-900'
    }`;
  /** The tick on a picked chip; its room is kept when unpicked. */
  const chipCheck = (active: boolean) => (
    <Check
      aria-hidden="true"
      className={`w-3.5 h-3.5 shrink-0 ${active ? '' : 'invisible'}`}
    />
  );
  const chipDetail = `text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`;

  const pickedCount = pickedSessions.length;
  /**
   * On a phone the session list folds into one line once there is
   * something to compare: two sessions, or one whose matches are being
   * compared. Change opens it again until Done. A tablet or laptop shows it
   * in full.
   */
  const pickerFolded =
    isCompact &&
    pickedCount > 0 &&
    (pickerState === 'closed' ||
      (pickerState === 'auto' &&
        (pickedCount >= 2 || comparisonMode === 'matches')));
  const selectedCount =
    comparisonMode === 'sessions' ? pickedCount : matchColumns.length;
  /** On a phone the session list carries its own count and Clear. */
  const statusInPicker = isCompact && comparisonMode === 'sessions';

  /**
   * The phone's line over the session list once something is picked: how
   * many and which, with Change to open the list and Done to fold it. It
   * stays put through both, so it keeps focus and says whether the list is
   * open.
   */
  const pickerSummary = isCompact && pickedCount > 0 && (
    <button
      ref={pickerSummaryRef}
      type="button"
      onClick={() => setPickerState(pickerFolded ? 'open' : 'closed')}
      aria-expanded={!pickerFolded}
      aria-controls={pickerId}
      className={`${toggleChip(false)} flex w-full items-center gap-3 min-h-11 px-3 py-2 text-left text-sm`}
    >
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold text-foreground">
          {plural(pickedCount, 'session')}
        </span>
        <span className={mutedText}>
          {' · '}
          {pickedSessions.map(sessionTitle).join(', ')}
        </span>
      </span>
      <span className="shrink-0 font-semibold text-team-blue underline underline-offset-2">
        {pickerFolded ? 'Change' : 'Done'}
      </span>
    </button>
  );

  /** The end of the sessions read so far: the next page is a press away */
  const showOlderButton = hasMore && (
    <div aria-live="polite" className="mt-3">
      <button
        type="button"
        onClick={() => void loadOlder()}
        disabled={loadingOlder}
        className={`min-h-11 rounded-lg border px-5 text-sm font-semibold transition-colors disabled:opacity-60 ${isDarkMode ? 'border-team-blue-40 text-white hover:border-team-blue' : 'border-gray-300 text-gray-900 hover:border-gray-400'}`}
      >
        {loadingOlder ? 'Loading older sessions...' : 'Show older sessions'}
      </button>
    </div>
  );

  const sessionList =
    sessions.length === 0 ? (
      <div
        className={`text-center py-12 px-6 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-gray-50'}`}
      >
        <p
          className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
        >
          {scope === 'all'
            ? 'No sessions available'
            : `No sessions ${scopeLabel}`}
        </p>
        <p
          className={`text-sm mb-4 ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
        >
          {scope === 'all'
            ? 'Complete some practice sessions first, then come back to compare them.'
            : `${plural(comparableSessions.length, 'session')} under All.`}
        </p>
        {/* The view's one fill: the header's New Session steps back */}
        {scope === 'all' ? (
          <Link
            to={ROUTES.ACTIVE}
            data-page-primary
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-team-blue text-sm font-medium hover:bg-team-blue/90 transition-colors ${isDarkMode ? 'text-black' : 'text-white'}`}
          >
            Start a new session
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setScope('all')}
            data-page-primary
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-team-blue text-sm font-medium hover:bg-team-blue/90 transition-colors ${isDarkMode ? 'text-black' : 'text-white'}`}
          >
            Show all sessions
          </button>
        )}
      </div>
    ) : (
      <>
        {/* Two to a row on a phone, so a name has half the width */}
        <div
          ref={sessionListRef}
          className={
            isCompact ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-2'
          }
        >
          {sessions.map(session => {
            const isSelected = selectedSessionIds.includes(session.id);
            const owner = ownerOf(session);
            return (
              <button
                key={session.id}
                type="button"
                onClick={e => {
                  toggleSession(session.id);
                  // A pick that folds the list takes this chip away
                  handFocusOn(e.currentTarget, pickerSummaryButton);
                }}
                aria-pressed={isSelected}
                title={`${sessionTitle(session)} · ${formatDate(session.createdAt)}${owner ? ` · ${owner}` : ''}`}
                className={`${toggleChip(isSelected)} flex min-w-0 flex-col items-stretch px-3 py-1.5 text-left ${isCompact ? '' : 'max-w-[18rem]'}`}
              >
                <span className="flex min-w-0 items-start gap-1.5">
                  <span
                    className={`min-w-0 text-sm font-medium ${isCompact ? 'line-clamp-2 [overflow-wrap:anywhere]' : 'truncate'}`}
                  >
                    {sessionTitle(session)}
                  </span>
                  <span className="ml-auto pt-0.5">
                    {chipCheck(isSelected)}
                  </span>
                </span>
                <span className={`truncate ${chipDetail}`}>
                  {/* Who recorded it before how many matches: cut short,
                      the count is the part to lose */}
                  {dateLabels.get(session.id)}
                  {owner && ` · ${owner}`} ·{' '}
                  {plural(session.matches.length, 'match', 'matches')}
                </span>
              </button>
            );
          })}
        </div>
        {showOlderButton}
        {isCompact && pickedCount > 0 && (
          // Clear only where the list carries the count: in Matches mode
          // the Clear beside the count clears the matches
          <div
            className={`mt-3 flex items-center gap-3 ${statusInPicker ? 'justify-between' : 'justify-end'}`}
          >
            {statusInPicker && (
              <button
                type="button"
                onClick={e => {
                  clearSessions();
                  handFocusOn(e.currentTarget, firstSessionChip);
                }}
                className="min-h-11 text-sm font-semibold text-team-blue underline underline-offset-2 hover:no-underline"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={e => {
                setPickerState('closed');
                handFocusOn(e.currentTarget, pickerSummaryButton);
              }}
              className={`min-h-11 rounded-lg border px-5 text-sm font-semibold transition-colors ${isDarkMode ? 'border-team-blue-40 text-white hover:border-team-blue' : 'border-gray-300 text-gray-900 hover:border-gray-400'}`}
            >
              Done
            </button>
          </div>
        )}
      </>
    );

  /** The session trend chart for one scoring element. */
  const scoreTrend = () => {
    const color = tone(ELEMENT_TONES[scoreChartPhase]);
    const chartData = comparedSessions.map(session => ({
      ...sessionPoint(session),
      score: round1(
        avgPoints(session, b => elementPoints(b, scoreChartPhase)) ?? 0
      ),
    }));
    return (
      <div className="w-full overflow-x-auto">
        <ResponsiveContainer width="100%" height={280} minWidth={240}>
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            title="Average score trend"
            desc={`Average ${ELEMENT_NAMES[scoreChartPhase]} points per match in each compared session, oldest first. The Score Breakdown table above lists the same averages.`}
            accessibilityLayer={false}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis
              dataKey="id"
              height={44}
              {...twoLineAxis(isCompact)}
              stroke={axis.stroke}
              tick={twoLineTick(sessionTicks, tickFill)}
              tickFormatter={id => widerLine(sessionTicks, id)}
            />
            <YAxis
              {...axis}
              width={36}
              {...(ON_TIP_AXIS.has(scoreChartPhase)
                ? pointsAxis(chartData.map(d => d.score))
                : {})}
            />
            <Tooltip
              wrapperStyle={TOOLTIP_WRAPPER_STYLE}
              content={tooltipFor(formatAvgPoints)}
              cursor={{ stroke: color, strokeWidth: 2 }}
            />
            <Line
              dataKey="score"
              name={`Avg ${ELEMENT_NAMES[scoreChartPhase]}`}
              stroke={color}
              strokeWidth={2.5}
              type="linear"
              {...dotProps(cardBg, color)}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  /** The session trend of the average time between Hive Tips. */
  const cycleTrend = () => {
    const color = tone(CHART_COLORS.cycle);
    const chartData = comparedSessions.flatMap(session => {
      const avg = sessionCycleTime(session);
      return avg === null
        ? []
        : [{ ...sessionPoint(session), cycleTime: round1(avg) }];
    });
    if (chartData.length === 0) {
      return (
        <div
          className={`flex items-center justify-center h-32 rounded-lg border-2 border-dashed ${isDarkMode ? 'border-team-blue-40 text-team-white-60' : 'border-gray-200 text-gray-600'} text-sm`}
        >
          No tip times in the picked sessions
        </div>
      );
    }
    return (
      <div className="w-full overflow-x-auto">
        <ResponsiveContainer width="100%" height={280} minWidth={240}>
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            title="Time between Hive Tips trend"
            desc="Average time between Hive Tips in each compared session, oldest first. The Score Breakdown table above lists the same averages."
            accessibilityLayer={false}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis
              dataKey="id"
              height={44}
              {...twoLineAxis(isCompact)}
              stroke={axis.stroke}
              tick={twoLineTick(sessionTicks, tickFill)}
              tickFormatter={id => widerLine(sessionTicks, id)}
            />
            <YAxis {...axis} tickFormatter={v => `${v}s`} width={40} />
            <Tooltip
              wrapperStyle={TOOLTIP_WRAPPER_STYLE}
              content={tooltipFor(formatSeconds)}
              cursor={{ stroke: color, strokeWidth: 2 }}
            />
            <Line
              dataKey="cycleTime"
              name="Average"
              stroke={color}
              strokeWidth={2.5}
              type="linear"
              {...dotProps(cardBg, color)}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  /** One bar per picked match, for one scoring element. */
  const matchBars = () => {
    const color = tone(ELEMENT_TONES[matchScoreChartPhase]);
    const chartData = matchColumns.map(match => ({
      key: match.key,
      label: `Match ${match.matchNumber} · ${match.sessionName}`,
      note: match.sessionDate,
      score: elementPoints(match.breakdown, matchScoreChartPhase),
    }));
    // Matches have no order between sessions, so each is a bar of its own
    // rather than a point on a line. Every bar keeps its label: past a
    // screenful the chart scrolls inside the card instead.
    return (
      <div className="w-full overflow-x-auto">
        <ResponsiveContainer
          width="100%"
          height={280}
          minWidth={Math.max(240, 60 + chartData.length * 96)}
        >
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 16, left: 0, bottom: 0 }}
            title="Score by match"
            desc={`${ELEMENT_NAMES[matchScoreChartPhase]} points of each picked match. The Score Breakdown table above lists the same values.`}
            accessibilityLayer={false}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridStroke}
              vertical={false}
            />
            <XAxis
              dataKey="key"
              height={44}
              interval={0}
              stroke={axis.stroke}
              tick={twoLineTick(matchTicks, tickFill)}
            />
            <YAxis
              {...axis}
              width={36}
              {...(ON_TIP_AXIS.has(matchScoreChartPhase)
                ? pointsAxis(chartData.map(d => d.score))
                : {})}
            />
            <Tooltip
              wrapperStyle={TOOLTIP_WRAPPER_STYLE}
              content={tooltipFor(v => `${formatNumber(v)}\u00A0pts`)}
              cursor={{
                fill: isDarkMode
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
              }}
            />
            <Bar
              dataKey="score"
              name={ELEMENT_NAMES[matchScoreChartPhase]}
              fill={color}
              radius={[4, 4, 0, 0]}
              maxBarSize={56}
              label={
                chartData.length <= BAR_LABELS_MAX
                  ? { position: 'top', fill: tickFill, fontSize: 11 }
                  : false
              }
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  /** Tip-by-tip cycle times of the first few picked matches. */
  const matchCycles = () => {
    const drawn = matchColumns.slice(0, CYCLE_LINES_MAX);
    const cycles = drawn.map(cycleTimesOf);
    const maxCycles = Math.max(...cycles.map(c => c.length), 0);
    if (maxCycles === 0)
      return (
        <div
          className={`flex items-center justify-center h-32 rounded-lg border-2 border-dashed ${isDarkMode ? 'border-team-blue-40 text-team-white-60' : 'border-gray-200 text-gray-600'} text-sm`}
        >
          No tip times in the picked matches
        </div>
      );
    // Cycle i is the gap that ends at tip i + 2.
    const chartData = Array.from({ length: maxCycles }, (_, i) => {
      const entry: Record<string, number | string> = {
        tip: `Tip ${i + 2}`,
        label: `Tip ${i + 2}`,
      };
      cycles.forEach((times, idx) => {
        if (times[i] !== undefined) entry[`match${idx}`] = times[i];
      });
      return entry;
    });
    return (
      <div className="w-full overflow-x-auto">
        <ResponsiveContainer width="100%" height={280} minWidth={240}>
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            title="Time between Hive Tips per match"
            desc="Seconds between one Hive Tip and the next, tip by tip, one line per match."
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="tip" {...axis} />
            <YAxis {...axis} tickFormatter={v => `${v}s`} width={40} />
            <Tooltip
              wrapperStyle={TOOLTIP_WRAPPER_STYLE}
              content={tooltipFor(formatSeconds)}
            />
            <Legend {...LEGEND_PROPS} />
            {drawn.map((match, idx) => {
              const color = seriesColors[idx % seriesColors.length];
              return (
                <Line
                  key={match.key}
                  dataKey={`match${idx}`}
                  name={`M${match.matchNumber} · ${shorten(match.sessionName, 20)}`}
                  stroke={color}
                  strokeWidth={2.5}
                  type="linear"
                  connectNulls={false}
                  {...dotProps(cardBg, color)}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  /** The Metric column's heading, which says the values are per match. */
  const metricHead = (
    scrolled: boolean,
    dense: boolean,
    { extra = '', rowSpan }: { extra?: string; rowSpan?: number } = {}
  ) => (
    <th
      scope="col"
      rowSpan={rowSpan}
      className={`${metricColumn(scrolled)} ${metricFit(dense)} pl-3 sm:pl-4 max-[359px]:pl-2 text-sm font-semibold ${headTone} ${extra}`}
    >
      {scrollFade(scrolled)}
      Metric{' '}
      {matchType === MATCH_TYPES[0] ? (
        <span className="font-normal whitespace-nowrap">(per match)</span>
      ) : (
        // Any other type is named, short where the rows are, and the line
        // may break before 'match)': a phone has no room for it in one
        <span className="font-normal">
          <span className="whitespace-nowrap">
            (per{' '}
            {MATCH_TYPE_SHORT[matchType] ? (
              <>
                <span className="lg:hidden">{MATCH_TYPE_SHORT[matchType]}</span>
                <span className="hidden lg:inline">{matchType}</span>
              </>
            ) : (
              matchType
            )}
          </span>{' '}
          <span className="whitespace-nowrap">match)</span>
        </span>
      )}
    </th>
  );

  /**
   * Sessions side by side: the numbers first, the answer to "which was
   * better, and where". A trend needs three points: with two, a line between
   * them says nothing the table doesn't.
   */
  const showTrends = comparedSessions.length >= TREND_SESSIONS_MIN;
  const sessionsView = () => (
    <div className="space-y-6">
      <CompareCard
        title="Score Breakdown"
        open={isDetailedBreakdownOpen}
        onToggle={() => setIsDetailedBreakdownOpen(!isDetailedBreakdownOpen)}
        className={cardClass}
      >
        {tableKey(anyScrimSession)}
        <div
          ref={sessionScrollerRef}
          className={`${TABLE_SCROLLER} ${sessionTableShadow}`}
        >
          <table ref={sessionTableRef} className="w-full text-sm">
            <thead>
              <tr className={`border-b ${headerRule} [&>th]:align-bottom`}>
                {metricHead(sessionTableScrolled, denseSessions)}
                {comparedSessions.map(session => (
                  <th
                    key={session.id}
                    scope="col"
                    className={`${sessionCell} font-semibold ${headTone}`}
                  >
                    {/* The floor keeps ordinary words whole. In a dense
                        table the name asks for no width at all and fills
                        what its column gets. */}
                    <div
                      title={sessionTitle(session)}
                      className={`ml-auto ${denseSessions ? 'w-0 min-w-full' : `${comparedSessions.length > 2 ? 'min-w-[4.5rem]' : 'min-w-[3.5rem]'} max-w-[9rem] sm:max-w-[16rem]`} ${NAME_CLAMP} text-xs sm:text-sm`}
                    >
                      {sessionTitle(session)}
                    </div>
                    <div className={`text-xs font-normal mt-0.5 ${mutedText}`}>
                      {whenAndWhoLines(session)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderSessionRow(
                ELEMENT_NAMES.total,
                s => avgPoints(s, b => b.total),
                { highlight: true, star: true }
              )}
              {renderSessionRow(
                `${ELEMENT_LABELS.tipping} Points`,
                s => avgPoints(s, b => b.tipping),
                {
                  format: formatNumber,
                  short: `${ELEMENT_LABELS.tipping}\u00A0pts`,
                  detail: {
                    value: s => avgCount(s, m => m.tipping || 0),
                    unit: ['tip', 'tips'],
                  },
                }
              )}
              {renderSessionRow(
                `${ELEMENT_LABELS.robots} Points`,
                s => avgPoints(s, b => b.leave + b.park),
                {
                  format: formatNumber,
                  short: `${ELEMENT_LABELS.robots}\u00A0pts`,
                }
              )}
              {renderSessionRow(
                'Leave Rate',
                s => sessionRate(s, 'leaveRate'),
                { indent: true, format: formatRate }
              )}
              {renderSessionRow('Park Rate', s => sessionRate(s, 'parkRate'), {
                indent: true,
                format: formatRate,
              })}
              <tr className={`border-b ${rowRule}`}>
                {metricCell('Matches with a Park', {
                  indent: true,
                  short: 'Parked in',
                  dense: denseSessions,
                  scrolled: sessionTableScrolled,
                })}
                {comparedSessions.map(session => {
                  const matches = session.matches.map(m =>
                    normalizeForMatchType(m, m.matchType || session.matchType)
                  );
                  const autoCount = matches.filter(
                    m => m.robot1ParkAuto || m.robot2ParkAuto
                  ).length;
                  const endCount = matches.filter(
                    m => m.robot1ParkTeleop || m.robot2ParkTeleop
                  ).length;
                  return (
                    <td
                      key={session.id}
                      className={`${sessionCell} ${parkedFits ? 'whitespace-nowrap' : ''} font-normal ${DATA_CLASS}`}
                    >
                      {/* A number never leaves its period: where the
                          columns are narrow the line breaks after the
                          comma, never inside '3 End' */}
                      {autoCount > 0 && (
                        <span className="whitespace-nowrap">
                          {autoCount} Auto{endCount > 0 && ','}
                        </span>
                      )}
                      {autoCount > 0 && endCount > 0 && ' '}
                      {endCount > 0 && (
                        <span className="whitespace-nowrap">
                          {endCount} End
                        </span>
                      )}
                      {autoCount === 0 && endCount === 0 && 'None'}
                    </td>
                  );
                })}
              </tr>
              {renderSessionRow(
                `${ELEMENT_LABELS.flower} Points`,
                s => avgPoints(s, b => b.flower),
                {
                  format: formatNumber,
                  short: `${ELEMENT_LABELS.flower}\u00A0pts`,
                  detail: {
                    value: s => avgCount(s, m => m.flower || 0),
                    unit: ['piece', 'pieces'],
                  },
                }
              )}
              {renderSessionRow(
                `${ELEMENT_LABELS.flowerBonus} Points`,
                s => avgPoints(s, b => b.flowerBonus),
                {
                  format: formatNumber,
                  short: `${ELEMENT_LABELS.flowerBonus}\u00A0pts`,
                }
              )}
              {renderSessionRow(
                `${ELEMENT_LABELS.hive} Points`,
                s => avgPoints(s, b => b.hive),
                {
                  format: formatNumber,
                  short: `${ELEMENT_LABELS.hive}\u00A0pts`,
                  detail: {
                    value: s => avgCount(s, m => m.ballsInHive || 0),
                    unit: ['piece', 'pieces'],
                  },
                }
              )}
              {renderSessionRow(
                `${ELEMENT_LABELS.garden} Points`,
                s => avgPoints(s, b => b.garden),
                {
                  format: formatNumber,
                  short: `${ELEMENT_LABELS.garden}\u00A0pts`,
                }
              )}
              {/* Fouls only exist against an opponent, so only Scrim
                  sessions have a figure. It is what they handed the
                  opponent, never taken off the score. */}
              {anyScrimSession &&
                renderSessionRow(
                  'Points Given to Opponent',
                  s => (isScrim(s) ? avgPoints(s, b => b.penalties) : null),
                  {
                    higherIsBetter: false,
                    format: formatNumber,
                    flagWorst: true,
                    short: 'To opponent',
                  }
                )}
              {renderSessionRow('Time between tips', sessionCycleTime, {
                higherIsBetter: false,
                format: formatSeconds,
              })}
              {renderSessionRow(
                'Ranking Points',
                s =>
                  s.matches.length > 0
                    ? sessionRankingPoints(s).earned / s.matches.length
                    : null,
                { format: formatNumber, star: true }
              )}
              {renderSessionRow(
                'Matches with SWARM',
                s => rankingPointShare(s, 'swarm'),
                {
                  indent: true,
                  format: formatRate,
                  short: 'SWARM',
                  // One robot can't earn it: no unreachable 0%
                  missing: sessionSwarmMissing,
                }
              )}
              {renderSessionRow(
                'Matches with POLLINATOR 1',
                s => rankingPointShare(s, 'pollinator1'),
                {
                  indent: true,
                  format: formatRate,
                  short: 'POLLINATOR\u00A01',
                }
              )}
              {renderSessionRow(
                'Matches with POLLINATOR 2',
                s => rankingPointShare(s, 'pollinator2'),
                {
                  indent: true,
                  format: formatRate,
                  short: 'POLLINATOR\u00A02',
                }
              )}
            </tbody>
          </table>
        </div>
      </CompareCard>
      {showTrends ? (
        <>
          <CompareCard
            title="Average Score Trend"
            open={isScoreChartOpen}
            onToggle={() => setIsScoreChartOpen(!isScoreChartOpen)}
            className={cardClass}
          >
            {elementPicker(scoreChartPhase, setScoreChartPhase)}
            {scoreTrend()}
          </CompareCard>

          <CompareCard
            title="Time Between Hive Tips"
            open={isCycleChartOpen}
            onToggle={() => setIsCycleChartOpen(!isCycleChartOpen)}
            className={cardClass}
          >
            <p className={`text-xs mb-4 ${mutedText}`}>
              Average time between Hive Tips in each session. Lower is faster.
            </p>
            {cycleTrend()}
          </CompareCard>
        </>
      ) : (
        <p className={`text-center text-sm ${mutedText}`}>
          Trend charts appear when {TREND_SESSIONS_MIN} or more sessions are
          picked.
        </p>
      )}
    </div>
  );

  /** The picked matches, grouped under their session for the header. */
  const matchGroups = comparedSessions
    .map(session => ({
      session,
      matches: matchColumns.filter(m => m.sessionId === session.id),
    }))
    .filter(group => group.matches.length > 0);

  /** A row of plain text per match (which parks a robot made). */
  const textMatchRow = (
    label: string,
    text: (match: CompareMatch) => ReactNode
  ) => (
    <tr className={`border-b ${rowRule}`}>
      {metricCell(label, {
        indent: true,
        dense: denseMatches,
        scrolled: matchTableScrolled,
      })}
      {showMatchAvg && <td className={`${matchCell} ${avgDivider}`} />}
      {matchColumns.map(match => (
        <td
          key={match.key}
          className={`${matchCell} whitespace-nowrap font-normal text-foreground`}
        >
          {text(match)}
        </td>
      ))}
    </tr>
  );

  const matchesView = () => (
    <div className="space-y-6">
      <div ref={matchListRef} className="space-y-4">
        {comparedSessions.map(session => {
          const sessionMatches = allMatches.filter(
            m => m.sessionId === session.id
          );
          return (
            <div key={session.id}>
              <div
                className={`text-xs font-semibold uppercase tracking-wide mb-2 break-words [overflow-wrap:anywhere] min-w-0 ${mutedText}`}
              >
                {sessionTitle(session)}{' '}
                <span className="whitespace-nowrap">
                  · {whenAndWho(session)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sessionMatches.map(match => {
                  const isChecked = matchColumns.some(m => m.key === match.key);
                  return (
                    <button
                      key={match.key}
                      type="button"
                      onClick={() => toggleMatch(match)}
                      aria-pressed={isChecked}
                      title={`${ELEMENT_LABELS.tipping} ${match.tipping || 0} · ${ELEMENT_LABELS.garden} ${match.garden || 0} · ${ELEMENT_LABELS.flower} ${match.flower || 0} · ${ELEMENT_LABELS.hive} ${match.ballsInHive || 0}`}
                      className={`${toggleChip(isChecked)} inline-flex items-center gap-1.5 px-3 py-1.5 text-sm`}
                    >
                      <span className="font-medium whitespace-nowrap">
                        Match {match.matchNumber}
                      </span>
                      <span className={`tabular-nums ${chipDetail}`}>
                        {match.breakdown.total}
                      </span>
                      {chipCheck(isChecked)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {matchColumns.length === 0 ? (
        pickPrompt(
          'Select Matches to Compare',
          `${plural(allMatches.length, 'match', 'matches')} available. Pick matches above to see them side by side.`
        )
      ) : (
        <>
          {/* The numbers first, then the charts of them */}
          <CompareCard
            title="Score Breakdown"
            open={isMatchBreakdownOpen}
            onToggle={() => setIsMatchBreakdownOpen(!isMatchBreakdownOpen)}
            className={cardClass}
          >
            {tableKey(anyScrimMatch)}
            <div
              ref={matchScrollerRef}
              className={`${TABLE_SCROLLER} ${matchTableShadow}`}
            >
              <table ref={matchTableRef} className="w-full text-sm">
                <thead>
                  {/* Each session named once over its matches, then M1,
                      M2… under it; Avg right after Metric, so it never
                      scrolls out of view */}
                  <tr className="[&>th]:align-bottom">
                    {metricHead(matchTableScrolled, denseMatches, {
                      extra: `max-sm:min-w-[7rem] max-[359px]:min-w-[6rem] border-b ${headerRule}`,
                      rowSpan: 2,
                    })}
                    {showMatchAvg && (
                      <th
                        rowSpan={2}
                        scope="col"
                        className={`${matchCell} font-semibold ${headTone} border-b ${headerRule} ${avgDivider}`}
                      >
                        Avg
                      </th>
                    )}
                    {matchGroups.map(({ session, matches }) => (
                      <th
                        key={session.id}
                        colSpan={matches.length}
                        scope="colgroup"
                        className={`px-1 sm:px-2 pt-3 pb-0 text-center font-semibold text-xs sm:text-sm ${headTone}`}
                      >
                        <div className={`pb-1 border-b ${rowRule}`}>
                          <div
                            title={sessionTitle(session)}
                            className={NAME_CLAMP}
                          >
                            {sessionTitle(session)}
                          </div>
                          <div className={`text-xs font-normal ${mutedText}`}>
                            {whenAndWhoLines(session)}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr className={`border-b ${headerRule}`}>
                    {matchColumns.map(match => (
                      <th
                        key={match.key}
                        scope="col"
                        className={`${matchCell} pt-1.5 pb-2 font-semibold whitespace-nowrap ${headTone}`}
                      >
                        <span aria-hidden="true">M{match.matchNumber}</span>
                        <span className="sr-only">
                          Match {match.matchNumber}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {renderMatchRow(ELEMENT_NAMES.total, m => m.breakdown.total, {
                    highlight: true,
                    star: true,
                  })}
                  {renderMatchRow(
                    `${ELEMENT_LABELS.tipping} Points`,
                    m => m.breakdown.tipping,
                    {
                      format: formatNumber,
                      short: `${ELEMENT_LABELS.tipping}\u00A0pts`,
                      detail: {
                        value: m => m.tipping || 0,
                        unit: ['tip', 'tips'],
                      },
                    }
                  )}
                  {renderMatchRow(
                    `${ELEMENT_LABELS.leave} Points`,
                    m => m.breakdown.leave,
                    {
                      format: formatNumber,
                      short: `${ELEMENT_LABELS.leave}\u00A0pts`,
                    }
                  )}
                  {renderMatchRow(
                    `${ELEMENT_LABELS.park} Points`,
                    m => m.breakdown.park,
                    {
                      format: formatNumber,
                      short: `${ELEMENT_LABELS.park}\u00A0pts`,
                    }
                  )}
                  {textMatchRow('Robot 1 Park', match => parksOf(match, 1))}
                  {/* Only where a match had a second robot on the field */}
                  {matchColumns.some(match => robotsOf(match) === 2) &&
                    textMatchRow('Robot 2 Park', match =>
                      robotsOf(match) === 2 ? (
                        parksOf(match, 2)
                      ) : (
                        <span className={mutedText}>1 robot</span>
                      )
                    )}
                  {renderMatchRow(
                    `${ELEMENT_LABELS.flower} Points`,
                    m => m.breakdown.flower,
                    {
                      format: formatNumber,
                      short: `${ELEMENT_LABELS.flower}\u00A0pts`,
                      detail: {
                        value: m => m.flower || 0,
                        unit: ['piece', 'pieces'],
                      },
                    }
                  )}
                  {renderMatchRow(
                    `${ELEMENT_LABELS.flowerBonus} Points`,
                    m => m.breakdown.flowerBonus,
                    {
                      format: formatNumber,
                      short: `${ELEMENT_LABELS.flowerBonus}\u00A0pts`,
                    }
                  )}
                  {renderMatchRow(
                    `${ELEMENT_LABELS.hive} Points`,
                    m => m.breakdown.hive,
                    {
                      format: formatNumber,
                      short: `${ELEMENT_LABELS.hive}\u00A0pts`,
                      detail: {
                        value: m => m.ballsInHive || 0,
                        unit: ['piece', 'pieces'],
                      },
                    }
                  )}
                  {renderMatchRow(
                    `${ELEMENT_LABELS.garden} Points`,
                    m => m.breakdown.garden,
                    {
                      format: formatNumber,
                      short: `${ELEMENT_LABELS.garden}\u00A0pts`,
                    }
                  )}
                  {/* Scrim matches only; never part of the score */}
                  {anyScrimMatch &&
                    renderMatchRow(
                      'Points Given to Opponent',
                      m => (m.scrim ? m.breakdown.penalties : null),
                      {
                        higherIsBetter: false,
                        format: formatNumber,
                        flagWorst: true,
                        short: 'To opponent',
                      }
                    )}
                  {renderMatchRow(
                    'Time between tips',
                    m => mean(cycleTimesOf(m)),
                    {
                      higherIsBetter: false,
                      format: formatSeconds,
                    }
                  )}
                  {renderMatchRow(
                    'Ranking Points',
                    m => rankingPoints(m).total,
                    { format: formatNumber, star: true }
                  )}
                  {textMatchRow('Earned', match => {
                    const earned = earnedOf(match);
                    return earned.length === 0 ? (
                      <span className={mutedText}>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">none</span>
                      </span>
                    ) : (
                      <span className="inline-flex flex-wrap justify-end gap-1">
                        {earned.map(([badge, name]) => (
                          <span
                            key={badge}
                            title={name}
                            className={`${CHIP_BASE} ${CHIP_SIZES.sm} ${chipTone('neutral', isDarkMode)}`}
                          >
                            <span aria-hidden="true">{badge}</span>
                            <span className="sr-only">{name}</span>
                          </span>
                        ))}
                      </span>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CompareCard>

          <CompareCard
            title="Score by Match"
            open={isMatchScoreChartOpen}
            onToggle={() => setIsMatchScoreChartOpen(!isMatchScoreChartOpen)}
            className={cardClass}
          >
            {elementPicker(matchScoreChartPhase, setMatchScoreChartPhase)}
            {matchBars()}
          </CompareCard>

          <CompareCard
            title="Time Between Hive Tips per Match"
            open={isMatchCycleChartOpen}
            onToggle={() => setIsMatchCycleChartOpen(!isMatchCycleChartOpen)}
            className={cardClass}
          >
            <p className={`text-xs mb-4 ${mutedText}`}>
              Time between Hive Tips in{' '}
              {matchColumns.length > CYCLE_LINES_MAX
                ? `the first ${CYCLE_LINES_MAX} of ${matchColumns.length} matches`
                : 'each match'}
              : Tip 2 is the time from the first tip to the second.
            </p>
            {matchCycles()}
          </CompareCard>
        </>
      )}
    </div>
  );

  return (
    <div
      className={`min-h-[100dvh] ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      {/* The header's column, so their ends line up at every width */}
      <div className={`${PAGE_CONTAINER} py-8`}>
        <PageHeader
          title="Comparison"
          subtitle={
            <>
              Compare sessions and matches side-by-side
              {scopeLabel && ` · ${scopeLabel}`}
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex flex-wrap gap-2">
              <Segmented
                label="Compare"
                value={comparisonMode}
                options={MODE_OPTIONS}
                onChange={mode => setPick({ mode })}
                isDarkMode={isDarkMode}
              />
              {typeChoices.length > 1 && (
                <Segmented
                  label="Match type"
                  value={matchType}
                  options={typeChoices}
                  onChange={setPickedType}
                  isDarkMode={isDarkMode}
                />
              )}
            </div>
            <p
              aria-live="polite"
              className={
                statusInPicker
                  ? 'sr-only'
                  : `text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`
              }
            >
              {selectedCount > 0 && (
                <>
                  {comparisonMode === 'sessions'
                    ? plural(selectedCount, 'session')
                    : plural(selectedCount, 'match', 'matches')}{' '}
                  selected
                  {!statusInPicker && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        onClick={e => {
                          if (comparisonMode === 'sessions') {
                            clearSessions();
                            handFocusOn(e.currentTarget, firstSessionChip);
                          } else {
                            setPick({ matches: [] });
                            handFocusOn(e.currentTarget, firstMatchChip);
                          }
                        }}
                        className="font-semibold text-team-blue underline underline-offset-2 hover:no-underline [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          {sittingOut.length > 0 && (
            <p className={`text-xs -mt-1 ${mutedText}`}>
              Not compared: {listOf(sittingOut.map(sessionTitle))} (no{' '}
              {matchType} matches)
            </p>
          )}
        </PageHeader>

        <div className="mb-6">
          {pickerSummary}
          <div
            id={pickerId}
            hidden={pickerFolded}
            className={pickerSummary ? 'mt-3' : undefined}
          >
            {!pickerFolded && (
              <>
                {choices.length > 0 && (
                  <div className="mb-4">
                    <Segmented
                      label="Sessions shown"
                      value={scope}
                      options={choices}
                      onChange={setScope}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                )}
                {sessionList}
                {sessions.length === 0 && showOlderButton}
              </>
            )}
          </div>
        </div>

        {sessions.length === 0
          ? null
          : pickedCount === 0
            ? pickPrompt(
                'Select Sessions to Compare',
                'Choose sessions from the list above to see them side by side.'
              )
            : comparisonMode === 'sessions'
              ? sessionsView()
              : matchesView()}
      </div>
    </div>
  );
};

export default Compare;
