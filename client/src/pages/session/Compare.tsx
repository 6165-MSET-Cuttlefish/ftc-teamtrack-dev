import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth, useTheme, useTeam } from '@/contexts';
import { firebaseService } from '@/services';
import {
  formatDate,
  logger,
  matchScore,
  cycleTimesOf,
  rankingPoints,
  rankingPointNames,
  rankingPointTally,
  robotRates,
  sessionMatchType,
  normalizeForMatchType,
  ELEMENT_LABELS,
  SERIES_COLORS,
} from '@/lib';
import type { RankingPointTally } from '@/lib';
import { getPendingDeleteIds } from '@/lib/pendingSessionDeletes';
import { ROUTES, APP_CONFIG } from '@/constants';
import { useIsCompact } from '@/hooks';
import type { Session, Match, ScoreBreakdown } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ChevronDown, Star } from 'lucide-react';
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
} from 'recharts';
import {
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
} from './lifetime';
import { Segmented } from './LifetimeControls';

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
 * the order of `scoreRows`, as on Analysis and Charts: the pills follow it.
 */
const ELEMENT_NAMES: Record<ScoreElement, string> = {
  total: 'Total',
  tipping: ELEMENT_LABELS.tipping,
  garden: ELEMENT_LABELS.garden,
  flower: ELEMENT_LABELS.flower,
  flowerBonus: ELEMENT_LABELS.flowerBonus,
  hive: ELEMENT_LABELS.hive,
  robots: ELEMENT_LABELS.robots,
};

const ELEMENTS = Object.keys(ELEMENT_NAMES) as ScoreElement[];

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

const round1 = (value: number): number => Math.round(value * 10) / 10;

const shorten = (text: string, max = 14): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

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

/** Percentage of a session's matches that earned one ranking point. */
const rankingPointShare = (
  session: Session,
  key: 'swarm' | 'pollinator1' | 'pollinator2'
): number | null =>
  session.matches.length > 0
    ? (sessionRankingPoints(session)[key] / session.matches.length) * 100
    : null;

const formatRate = (v: number) => `${Math.round(v)}%`;
const formatSeconds = (v: number) => `${v.toFixed(1)}s`;

/** Which parks a robot made, in the periods the match ran. */
const parksOf = (match: CompareMatch, robot: 1 | 2): string => {
  const m = normalizeForMatchType(match, match.matchType);
  return (
    [
      (robot === 1 ? m.robot1ParkAuto : m.robot2ParkAuto) && 'auto',
      (robot === 1 ? m.robot1ParkTeleop : m.robot2ParkTeleop) && 'end',
    ]
      .filter(Boolean)
      .join(', ') || 'none'
  );
};

/** The ranking points a match earned, by name. */
const earnedOf = (match: CompareMatch): string =>
  rankingPointNames(rankingPoints(match)).join(', ') || 'none';

/**
 * Most picked matches whose ranking-point names still get a table column
 * each. A column has to grow to hold 'POLLINATOR', so on a compact screen,
 * or with more matches than this, the names would push Avg out of view.
 */
const EARNED_COLUMNS_MAX = 4;

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

/** Most bars that still get their value written on top. */
const BAR_LABELS_MAX = 8;

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
 * While a table runs past the right edge of its scroller, that edge casts
 * a shadow, so a cut-off or hidden column reads as "swipe for more" instead
 * of as the end of the table. Returns the scroller's ref and the class to
 * give it.
 */
const useRightEdgeShadow = (isDarkMode: boolean) => {
  const [more, setMore] = useState(false);
  const ref = useCallback((scroller: HTMLDivElement | null) => {
    if (!scroller) return;
    const update = () =>
      setMore(
        scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1
      );
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
    if (table.offsetWidth > scroller.clientWidth + 1) setTooWideFor(fit);
  }, [allowed, dense, width, table, fit]);

  return [setTable, dense] as const;
};

interface RowOptions {
  indent?: boolean;
  higherIsBetter?: boolean;
  format?: (v: number) => string;
  highlight?: boolean;
  /** What the row is called below desktop width, where the full label wraps */
  short?: string;
  /** Also mark the worst cell (only points handed to the opponent) */
  flagWorst?: boolean;
  /** A row of a table packed tight to fit its card (see useDenseTable) */
  dense?: boolean;
  /** Class of the row's value cells */
  cell?: string;
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

const Compare = () => {
  const { isGuest } = useAuth();
  const { isDarkMode, isHoneycombMode, isDeepSeaMode } = useTheme();
  const { team } = useTeam();
  const [searchParams] = useSearchParams();

  const { sessions: listedSessions, loading } = useLifetimeSessions();
  const { scope, setScope, inScope, choices, scopeLabel } =
    useSessionScope(listedSessions);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [isDetailedBreakdownOpen, setIsDetailedBreakdownOpen] = useState(true);
  const [isMatchBreakdownOpen, setIsMatchBreakdownOpen] = useState(true);
  const [scoreChartPhase, setScoreChartPhase] = useState<ScoreElement>('total');
  const [isScoreChartOpen, setIsScoreChartOpen] = useState(true);
  const [isCycleChartOpen, setIsCycleChartOpen] = useState(true);
  const [matchScoreChartPhase, setMatchScoreChartPhase] =
    useState<ScoreElement>('total');
  const [isMatchScoreChartOpen, setIsMatchScoreChartOpen] = useState(true);
  const [isMatchCycleChartOpen, setIsMatchCycleChartOpen] = useState(true);
  const isCompact = useIsCompact();
  const [sessionTableRef, sessionTableShadow] = useRightEdgeShadow(isDarkMode);
  const [matchScrollerRef, matchTableShadow] = useRightEdgeShadow(isDarkMode);

  const [comparisonMode, setComparisonMode] = useState<'sessions' | 'matches'>(
    'sessions'
  );
  const [selectedMatches, setSelectedMatches] = useState<
    Array<{ sessionId: string; matchId: string }>
  >([]);

  /**
   * Sessions named in the URL that the list doesn't hold (someone else's
   * link, or an older session). Each is fetched once and kept.
   */
  const [linkedSessions, setLinkedSessions] = useState<Session[]>([]);
  const requestedLinks = useRef(new Set<string>());

  useEffect(() => {
    document.title = `Compare - ${APP_CONFIG.name}`;
  }, []);

  const linkedIds = useMemo(() => {
    const session1Id = searchParams.get('session1');
    const session2Id = searchParams.get('session2');
    if (!session1Id) return [];
    return session2Id && session2Id !== session1Id
      ? [session1Id, session2Id]
      : [session1Id];
  }, [searchParams]);

  useEffect(() => {
    if (linkedIds.length > 0) setSelectedSessionIds(linkedIds);
  }, [linkedIds]);

  useEffect(() => {
    // A guest's sessions are all in the list already.
    if (loading || isGuest) return;
    for (const id of linkedIds) {
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
  }, [loading, isGuest, linkedIds, listedSessions]);

  /**
   * Every session that can be picked: the list in the chosen scope, then any
   * linked extras. A picked session stays listed whatever the scope, so
   * narrowing it never drops something from the comparison unseen.
   */
  const sessions = useMemo(
    () => [
      ...listedSessions.filter(
        s => inScope(s) || selectedSessionIds.includes(s.id)
      ),
      ...linkedSessions.filter(
        linked => !listedSessions.some(s => s.id === linked.id)
      ),
    ],
    [listedSessions, linkedSessions, inScope, selectedSessionIds]
  );

  const dateLabels = useMemo(() => sessionDateLabels(sessions), [sessions]);

  /**
   * The picked sessions, straight from the loaded list — nothing is fetched
   * again when the selection changes. Oldest first, so the charts read left
   * to right in time and the table columns sit in the same order. A session
   * with no matches has nothing to compare and is left out.
   */
  const selectedSessionsData = useMemo(
    () =>
      sessions
        .filter(s => selectedSessionIds.includes(s.id) && s.matches.length > 0)
        .sort(byDateAscending),
    [sessions, selectedSessionIds]
  );

  /** Every match of the picked sessions, in session order. */
  const allMatches = useMemo(
    (): CompareMatch[] =>
      selectedSessionsData.flatMap(session =>
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
    [selectedSessionsData, dateLabels]
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

  /** Who recorded a session; only worth showing when a team shares a list. */
  const ownerOf = (session: Session): string | undefined => {
    if (!team) return undefined;
    const member = team.members.find(m => m.userId === session.userId);
    return member?.displayName || member?.email || session.userEmail;
  };

  /** 'Sep 25', plus who recorded it in a team. */
  const whenAndWho = (session: Session): string => {
    const owner = ownerOf(session);
    const date = dateLabels.get(session.id) ?? '';
    return owner ? `${date} · ${owner}` : date;
  };

  const goodTone = isDarkMode ? 'text-green-500' : 'text-green-700';
  const badTone = isDarkMode ? 'text-red-500' : 'text-red-600';

  const seriesColors = SERIES_COLORS[isDarkMode ? 'dark' : 'light'];

  /**
   * The Metric column stays put while the others scroll sideways under it,
   * so it needs the card's own colour as a solid fill. The default dark card
   * is see-through over the page; Honeycomb and Deep Sea paint it solid.
   * Padding is tight on a phone so two columns fit beside it; the left
   * padding is set per cell, as a sub-row's is deeper.
   */
  const metricColumn = `sticky left-0 z-10 py-3 pr-2 sm:pr-4 text-left ${
    !isDarkMode
      ? 'bg-white shadow-[1px_0_0_rgba(0,0,0,0.08)]'
      : `${isHoneycombMode || isDeepSeaMode ? 'bg-team-dark-20' : 'bg-team-dark'} shadow-[1px_0_0_rgba(255,255,255,0.08)]`
  }`;
  /**
   * A laptop has room for each row name on one line, except in a dense
   * table, where a name wraps once the match columns are at their
   * narrowest, but no further than the floor that keeps its words whole.
   */
  const metricFit = (dense: boolean) =>
    dense ? 'md:pr-2 lg:min-w-[7.5rem]' : 'lg:whitespace-nowrap';
  const dataCell = 'text-right py-3 px-2 sm:px-4 text-sm';
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

  /** A row's name, in the Metric column. */
  const metricCell = (
    label: string,
    {
      indent = false,
      short,
      dense = false,
    }: Pick<RowOptions, 'indent' | 'short' | 'dense'> = {}
  ) => (
    <th
      scope="row"
      className={`${metricColumn} ${metricFit(dense)} font-normal ${indent ? 'pl-4 sm:pl-8 text-xs sm:text-sm' : 'pl-3 sm:pl-4 text-sm'} ${
        indent
          ? isDarkMode
            ? 'text-team-white-60'
            : 'text-gray-600'
          : isDarkMode
            ? 'text-white'
            : 'text-gray-900'
      }`}
    >
      {indent && '↳\u00A0'}
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

  const clearSelection = () => {
    if (comparisonMode === 'sessions') setSelectedSessionIds([]);
    setSelectedMatches([]);
  };

  const toggleSession = (sessionId: string) => {
    if (selectedSessionIds.includes(sessionId)) {
      setSelectedSessionIds(prev => prev.filter(id => id !== sessionId));
      // Its matches leave the comparison with it, in the same update.
      setSelectedMatches(prev => prev.filter(m => m.sessionId !== sessionId));
    } else {
      setSelectedSessionIds(prev => [...prev, sessionId]);
    }
  };

  const toggleMatch = (match: CompareMatch) => {
    const isSame = (m: { sessionId: string; matchId: string }) =>
      m.sessionId === match.sessionId && m.matchId === match.id;
    setSelectedMatches(prev =>
      prev.some(isSame)
        ? prev.filter(m => !isSame(m))
        : [...prev, { sessionId: match.sessionId, matchId: match.id }]
    );
  };

  /**
   * One table row. A column with no value (null) reads N/A, takes no
   * best/worst colour and is left out of the average.
   */
  const renderRow = <T,>(
    columns: T[],
    keyOf: (column: T) => string,
    label: string,
    getValue: (column: T) => number | null,
    showAvg: boolean,
    opts: RowOptions
  ): ReactNode => {
    const {
      indent = false,
      higherIsBetter = true,
      format = v => Math.round(v).toString(),
      highlight = false,
      short,
      flagWorst = false,
      dense = false,
      cell = dataCell,
    } = opts;
    const values = columns.map(getValue);
    const show = (v: number | null) => (v === null ? 'N/A' : format(v));
    const shown = values.map(show);
    const marks = markCells(values, shown, higherIsBetter, flagWorst);
    const avg = mean(values.filter((v): v is number => v !== null));
    return (
      <tr
        className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
      >
        {metricCell(label, { indent, short, dense })}
        {columns.map((column, i) => (
          <td
            key={keyOf(column)}
            className={`${cell} ${
              highlight
                ? 'font-bold text-lg'
                : marks[i]
                  ? 'font-semibold'
                  : 'font-medium'
            } ${
              marks[i] === 'best'
                ? goodTone
                : marks[i] === 'worst'
                  ? badTone
                  : highlight && values[i] !== null
                    ? 'text-team-blue'
                    : isDarkMode
                      ? 'text-white'
                      : 'text-gray-900'
            }`}
          >
            {marks[i] === 'best' ? (
              <span
                data-best
                className="inline-flex items-center justify-end gap-1"
              >
                <Star
                  aria-hidden="true"
                  className="w-3 h-3 shrink-0 fill-current"
                />
                {shown[i]}
                <span className="sr-only"> (best)</span>
              </span>
            ) : (
              <>
                {shown[i]}
                {marks[i] === 'worst' && (
                  <span className="sr-only"> (most)</span>
                )}
              </>
            )}
          </td>
        ))}
        {showAvg && (
          <td className={`${cell} font-semibold text-team-blue`}>
            {show(avg)}
          </td>
        )}
      </tr>
    );
  };

  const renderSessionRow = (
    label: string,
    getValue: (session: Session) => number | null,
    opts: RowOptions = {}
  ) => renderRow(selectedSessionsData, s => s.id, label, getValue, false, opts);

  const renderMatchRow = (
    label: string,
    getValue: (match: CompareMatch) => number | null,
    opts: RowOptions = {}
  ) =>
    renderRow(
      matchColumns,
      m => m.key,
      label,
      getValue,
      matchColumns.length > 1,
      { ...opts, dense: denseMatches, cell: matchCell }
    );

  const tickFill = isDarkMode ? '#9ca3af' : '#6b7280';
  const axisLine = {
    stroke: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  };
  const gridStroke = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const tooltipStyle = {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 8,
    fontSize: 12,
  };

  /**
   * Session charts: name over date on the axis, both in the tooltip. A
   * phone only has room under each point for the date (and under it the
   * time, when a day has two sessions); the name stays in the tooltip.
   */
  const sessionTicks = new Map(
    selectedSessionsData.map(session => {
      const date = dateLabels.get(session.id) ?? '';
      if (isCompact) {
        const [day, time = ''] = date.split(', ');
        return [session.id, [day, time] as const];
      }
      return [session.id, [shorten(sessionTitle(session)), date] as const];
    })
  );
  const sessionTooltipLabel = (id: string) => {
    const session = selectedSessionsData.find(s => s.id === id);
    return session ? `${whenAndWho(session)} - ${sessionTitle(session)}` : '';
  };

  /** Match charts: session over 'M# · date' on the axis. */
  const matchTicks = new Map(
    matchColumns.map(match => [
      match.key,
      [
        shorten(match.sessionName),
        `M${match.matchNumber} · ${match.sessionDate}`,
      ] as const,
    ])
  );
  const matchLabel = (match: CompareMatch) =>
    `${match.sessionName} - M${match.matchNumber}`;
  const matchTooltipLabel = (key: string) => {
    const match = matchColumns.find(m => m.key === key);
    return match ? `${matchLabel(match)} (${match.sessionDate})` : '';
  };

  const anyScrimSession = selectedSessionsData.some(isScrim);
  const anyScrimMatch = matchColumns.some(m => m.scrim);
  const earnedInColumns = matchColumns.length <= EARNED_COLUMNS_MAX;

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
  const elementButtonClass = (active: boolean) =>
    `px-4 py-1.5 rounded-full text-xs font-semibold border transition-all [@media(pointer:coarse)]:min-h-11 ${
      active
        ? `bg-team-blue border-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`
        : isDarkMode
          ? 'bg-team-dark border-team-blue-40 text-team-white-60 hover:border-team-blue hover:text-white'
          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900'
    }`;

  /** The line under a table's title that says what its marks mean. */
  const tableKey = (lead: string, withOpponentRow: boolean) => (
    <p className={`text-xs mb-3 ${mutedText}`}>
      {lead}
      <Star
        aria-hidden="true"
        className={`inline w-3 h-3 mx-1 -mt-0.5 fill-current ${goodTone}`}
      />
      marks the best value in a row. Values that read the same are a tie and are
      not marked. N/A means that part of the match was not run
      {withOpponentRow ? (
        <>
          , or, for points given to the opponent, that it was not a Scrim.{' '}
          <span className={`font-semibold ${badTone}`}>Red</span> is the most
          points given to the opponent.
        </>
      ) : (
        '.'
      )}
    </p>
  );

  /** Shown in place of the comparison until something is picked. */
  const pickPrompt = (title: string, text: string) => (
    <Card className={cardClass}>
      <CardContent className="py-12">
        <div className="text-center">
          <div className="text-team-blue text-5xl mb-4">📊</div>
          <h3
            className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          >
            {title}
          </h3>
          <p className={isDarkMode ? 'text-team-white-60' : 'text-gray-600'}>
            {text}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const chipClass = (active: boolean) =>
    `inline-flex items-center rounded-full text-xs font-medium border transition-all [@media(pointer:coarse)]:min-h-11 ${
      active
        ? `bg-team-blue border-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`
        : isDarkMode
          ? 'bg-team-dark-20 border-team-blue-40 text-team-white-60 enabled:hover:border-team-blue enabled:hover:text-white'
          : 'bg-white border-gray-200 text-gray-700 enabled:hover:border-gray-400 enabled:hover:text-gray-900'
    }`;
  const chipDetailClass = (active: boolean) =>
    `shrink-0 ${
      active
        ? isDarkMode
          ? 'text-black/70'
          : 'text-white'
        : isDarkMode
          ? 'text-team-white-60/60'
          : 'text-gray-500'
    }`;
  const modeButtonClass = (active: boolean) =>
    `px-6 py-2.5 rounded-lg text-base font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
      active
        ? `bg-team-blue shadow-md ${isDarkMode ? 'text-black' : 'text-white'}`
        : isDarkMode
          ? 'bg-team-dark-20 border border-team-blue-40 text-team-white-60 enabled:hover:text-white enabled:hover:border-team-blue'
          : 'bg-gray-100 border border-gray-300 text-gray-600 enabled:hover:text-gray-900 enabled:hover:border-gray-400'
    }`;
  const selectedCount =
    comparisonMode === 'sessions'
      ? selectedSessionsData.length
      : matchColumns.length;

  return (
    <div
      className={`min-h-[100dvh] ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1152px] mx-auto px-4 sm:px-8 py-8">
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
              <button
                onClick={() => setComparisonMode('sessions')}
                aria-pressed={comparisonMode === 'sessions'}
                className={modeButtonClass(comparisonMode === 'sessions')}
              >
                Compare Sessions
              </button>
              <button
                onClick={() => setComparisonMode('matches')}
                aria-pressed={comparisonMode === 'matches'}
                className={modeButtonClass(comparisonMode === 'matches')}
                disabled={selectedSessionsData.length === 0}
              >
                Compare Matches ({allMatches.length})
              </button>
            </div>
            <p
              aria-live="polite"
              className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              {selectedCount > 0 && (
                <>
                  {comparisonMode === 'sessions'
                    ? plural(selectedCount, 'session')
                    : plural(selectedCount, 'match', 'matches')}{' '}
                  selected ·{' '}
                  <button
                    onClick={clearSelection}
                    className="font-semibold text-team-blue underline underline-offset-2 hover:no-underline [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
                  >
                    Clear
                  </button>
                </>
              )}
            </p>
          </div>
        </PageHeader>

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

        <div className="mb-6">
          {sessions.length === 0 ? (
            <div
              className={`text-center py-12 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-gray-50'}`}
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
                  : `${plural(listedSessions.length, 'session')} under All.`}
              </p>
              {scope === 'all' ? (
                <Link
                  to={ROUTES.ACTIVE}
                  className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-team-blue text-sm font-medium hover:bg-team-blue/90 transition-colors ${isDarkMode ? 'text-black' : 'text-white'}`}
                >
                  Start New Session
                </Link>
              ) : (
                <button
                  onClick={() => setScope('all')}
                  className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-team-blue text-sm font-medium hover:bg-team-blue/90 transition-colors ${isDarkMode ? 'text-black' : 'text-white'}`}
                >
                  Show all sessions
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sessions.map(session => {
                // A session with no matches has no average to compare.
                const hasMatches = session.matches.length > 0;
                const isSelected =
                  hasMatches && selectedSessionIds.includes(session.id);
                const avgScore = Math.round(
                  mean(
                    session.matches.map(m => matchScore(m, session.matchType))
                  ) ?? 0
                );
                const owner = ownerOf(session);
                return (
                  <button
                    key={session.id}
                    onClick={() => toggleSession(session.id)}
                    disabled={!hasMatches}
                    aria-pressed={isSelected}
                    title={`${sessionTitle(session)} · ${formatDate(session.createdAt)}${owner ? ` · ${owner}` : ''}${hasMatches ? '' : ' · no matches to compare'}`}
                    className={`${chipClass(isSelected)} gap-2 px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="max-w-[140px] truncate">
                      {sessionTitle(session)}
                    </span>
                    <span className={chipDetailClass(isSelected)}>
                      {whenAndWho(session)} ·{' '}
                      {hasMatches
                        ? `${plural(session.matches.length, 'match', 'matches')} · avg ${avgScore}`
                        : 'no matches'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {sessions.length === 0 ? null : selectedSessionsData.length === 0 ? (
          pickPrompt(
            'Select Sessions to Compare',
            'Choose sessions from the list above to see detailed comparison'
          )
        ) : comparisonMode === 'sessions' ? (
          <div className="space-y-6">
            <Card className={cardClass}>
              <CardHeader
                onClick={() => setIsScoreChartOpen(!isScoreChartOpen)}
                className="cursor-pointer hover:bg-opacity-80 transition-all"
              >
                <CardTitle
                  className={`text-xl flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  <span>Average Score Trend</span>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform duration-200 ${isScoreChartOpen ? 'rotate-180' : ''}`}
                  />
                </CardTitle>
              </CardHeader>
              {isScoreChartOpen && (
                <CardContent>
                  <p className={`text-xs mb-4 ${mutedText}`}>
                    Pick a scoring element to compare. Average points per match,
                    oldest session first; each point is one session.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {ELEMENTS.map(element => (
                      <button
                        key={element}
                        onClick={() => setScoreChartPhase(element)}
                        className={elementButtonClass(
                          scoreChartPhase === element
                        )}
                      >
                        {ELEMENT_NAMES[element]}
                      </button>
                    ))}
                  </div>

                  {(() => {
                    const chartData = selectedSessionsData.map(session => ({
                      id: session.id,
                      score: round1(
                        avgPoints(session, b =>
                          elementPoints(b, scoreChartPhase)
                        ) ?? 0
                      ),
                    }));
                    return (
                      <div className="w-full overflow-x-auto">
                        <ResponsiveContainer
                          width="100%"
                          height={280}
                          minWidth={300}
                        >
                          <LineChart
                            data={chartData}
                            margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={gridStroke}
                            />
                            <XAxis
                              dataKey="id"
                              height={44}
                              {...twoLineAxis(isCompact)}
                              tick={twoLineTick(sessionTicks, tickFill)}
                              tickFormatter={id => widerLine(sessionTicks, id)}
                              axisLine={axisLine}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fill: tickFill, fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              width={36}
                            />
                            <Tooltip
                              contentStyle={tooltipStyle}
                              labelFormatter={sessionTooltipLabel}
                              formatter={v => `${formatNumber(Number(v))} pts`}
                            />
                            <Line
                              dataKey="score"
                              name={`Avg ${ELEMENT_NAMES[scoreChartPhase]} Points`}
                              stroke={seriesColors[0]}
                              strokeWidth={2.5}
                              dot={{
                                r: 5,
                                fill: seriesColors[0],
                                strokeWidth: 0,
                              }}
                              activeDot={{ r: 7 }}
                              type="linear"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}
                </CardContent>
              )}
            </Card>

            <Card className={cardClass}>
              <CardHeader
                onClick={() => setIsCycleChartOpen(!isCycleChartOpen)}
                className="cursor-pointer hover:bg-opacity-80 transition-all"
              >
                <CardTitle
                  className={`text-xl flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  <span>Average Cycle Time Trend</span>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform duration-200 ${isCycleChartOpen ? 'rotate-180' : ''}`}
                  />
                </CardTitle>
              </CardHeader>
              {isCycleChartOpen && (
                <CardContent>
                  <p className={`text-xs mb-4 ${mutedText}`}>
                    Average time between Hive Tips across all matches in each
                    session, oldest session first. Lower is faster.
                  </p>
                  {(() => {
                    const chartData = selectedSessionsData.flatMap(session => {
                      const avg = sessionCycleTime(session);
                      return avg === null
                        ? []
                        : [{ id: session.id, cycleTime: round1(avg) }];
                    });
                    if (chartData.length === 0) {
                      return (
                        <div
                          className={`flex items-center justify-center h-32 rounded-lg border-2 border-dashed ${isDarkMode ? 'border-team-blue-40 text-team-white-60' : 'border-gray-200 text-gray-600'} text-sm`}
                        >
                          No cycle time data for the selected sessions
                        </div>
                      );
                    }
                    return (
                      <div className="w-full overflow-x-auto">
                        <ResponsiveContainer
                          width="100%"
                          height={280}
                          minWidth={300}
                        >
                          <LineChart
                            data={chartData}
                            margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={gridStroke}
                            />
                            <XAxis
                              dataKey="id"
                              height={44}
                              {...twoLineAxis(isCompact)}
                              tick={twoLineTick(sessionTicks, tickFill)}
                              tickFormatter={id => widerLine(sessionTicks, id)}
                              axisLine={axisLine}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={v => `${v}s`}
                              tick={{ fill: tickFill, fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              width={40}
                            />
                            <Tooltip
                              contentStyle={tooltipStyle}
                              labelFormatter={sessionTooltipLabel}
                              formatter={v => [
                                formatSeconds(Number(v)),
                                'Avg Cycle Time',
                              ]}
                            />
                            <Line
                              dataKey="cycleTime"
                              name="Avg Cycle Time"
                              stroke={seriesColors[0]}
                              strokeWidth={2.5}
                              dot={{
                                r: 5,
                                fill: seriesColors[0],
                                strokeWidth: 0,
                              }}
                              activeDot={{ r: 7 }}
                              type="linear"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}
                </CardContent>
              )}
            </Card>

            <Card className={cardClass}>
              <CardHeader
                onClick={() =>
                  setIsDetailedBreakdownOpen(!isDetailedBreakdownOpen)
                }
                className="cursor-pointer hover:bg-opacity-80 transition-all"
              >
                <CardTitle
                  className={`text-xl flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  <span>Score Breakdown</span>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform duration-200 ${isDetailedBreakdownOpen ? 'rotate-180' : ''}`}
                  />
                </CardTitle>
              </CardHeader>
              {isDetailedBreakdownOpen && (
                <CardContent>
                  {tableKey('Averages per match.', anyScrimSession)}
                  {/* `relative`: a cell's screen-reader text is absolutely
                      placed, and without a positioned scroller around it
                      one in an off-screen column would widen the page */}
                  <div
                    ref={sessionTableRef}
                    className={`relative overflow-x-auto ${sessionTableShadow}`}
                  >
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
                        >
                          <th
                            scope="col"
                            className={`${metricColumn} ${metricFit(false)} pl-3 sm:pl-4 text-sm font-semibold ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                          >
                            Metric
                          </th>
                          {selectedSessionsData.map(session => (
                            <th
                              key={session.id}
                              scope="col"
                              className={`${dataCell} font-semibold ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                            >
                              {/* Capped, and breakable anywhere, so one long
                                  unspaced name can't stretch its column;
                                  the floor keeps ordinary words whole. Two
                                  sessions fit a phone only on a lower one;
                                  more scroll sideways whatever it is. */}
                              <div
                                className={`ml-auto ${selectedSessionsData.length > 2 ? 'min-w-[4.5rem]' : 'min-w-[3.5rem]'} max-w-[9rem] sm:max-w-[16rem] [overflow-wrap:anywhere] text-xs sm:text-sm`}
                              >
                                {sessionTitle(session)}
                              </div>
                              <div
                                className={`text-xs font-normal mt-0.5 ${mutedText}`}
                              >
                                {whenAndWho(session)}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {renderSessionRow(
                          'Avg Final Score',
                          s => avgPoints(s, b => b.total),
                          { highlight: true, short: 'Final Score' }
                        )}
                        {renderSessionRow(
                          `Avg ${ELEMENT_LABELS.tipping} Points`,
                          s => avgPoints(s, b => b.tipping),
                          { short: `${ELEMENT_LABELS.tipping} pts` }
                        )}
                        {renderSessionRow(
                          `Avg ${ELEMENT_LABELS.tipping} Scored`,
                          s => avgCount(s, m => m.tipping || 0),
                          {
                            indent: true,
                            format: formatNumber,
                            short: 'Scored',
                          }
                        )}
                        {renderSessionRow(
                          `Avg ${ELEMENT_LABELS.garden} Points`,
                          s => avgPoints(s, b => b.garden),
                          { short: `${ELEMENT_LABELS.garden} pts` }
                        )}
                        {renderSessionRow(
                          `Avg ${ELEMENT_LABELS.garden} Scored`,
                          s => avgCount(s, m => m.garden || 0),
                          {
                            indent: true,
                            format: formatNumber,
                            short: 'Scored',
                          }
                        )}
                        {renderSessionRow(
                          `Avg ${ELEMENT_LABELS.flower} Points`,
                          s => avgPoints(s, b => b.flower),
                          { short: `${ELEMENT_LABELS.flower} pts` }
                        )}
                        {renderSessionRow(
                          `Avg ${ELEMENT_LABELS.flower} Scored`,
                          s => avgCount(s, m => m.flower || 0),
                          {
                            indent: true,
                            format: formatNumber,
                            short: 'Scored',
                          }
                        )}
                        {renderSessionRow(
                          `Avg ${ELEMENT_LABELS.flowerBonus} Points`,
                          s => avgPoints(s, b => b.flowerBonus),
                          { short: `${ELEMENT_LABELS.flowerBonus} pts` }
                        )}
                        {renderSessionRow(
                          `Avg ${ELEMENT_LABELS.hive} Points`,
                          s => avgPoints(s, b => b.hive),
                          { short: `${ELEMENT_LABELS.hive} pts` }
                        )}
                        {renderSessionRow(
                          `Avg ${ELEMENT_LABELS.hive}`,
                          s => avgCount(s, m => m.ballsInHive || 0),
                          { indent: true, format: formatNumber, short: 'Left' }
                        )}
                        {renderSessionRow(
                          `Avg ${ELEMENT_LABELS.robots} Points`,
                          s => avgPoints(s, b => b.leave + b.park),
                          { short: `${ELEMENT_LABELS.robots} pts` }
                        )}
                        {renderSessionRow(
                          'Park Rate',
                          s => sessionRate(s, 'parkRate'),
                          { indent: true, format: formatRate }
                        )}
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          {metricCell('Matches with a Park', {
                            indent: true,
                            short: 'Parked in',
                          })}
                          {selectedSessionsData.map(session => {
                            const matches = session.matches.map(m =>
                              normalizeForMatchType(
                                m,
                                m.matchType || session.matchType
                              )
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
                                className={`${dataCell} font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                              >
                                {autoCount > 0 ? `${autoCount} auto` : ''}
                                {autoCount > 0 && endCount > 0 ? ', ' : ''}
                                {endCount > 0 ? `${endCount} end` : ''}
                                {autoCount === 0 && endCount === 0
                                  ? 'None'
                                  : ''}
                              </td>
                            );
                          })}
                        </tr>
                        {/* Fouls only exist against an opponent, so only
                            Scrim sessions have a figure. It is what they
                            handed the opponent, never taken off the score. */}
                        {anyScrimSession &&
                          renderSessionRow(
                            'Avg Points Given to Opponent',
                            s =>
                              isScrim(s)
                                ? avgPoints(s, b => b.penalties)
                                : null,
                            {
                              higherIsBetter: false,
                              format: formatNumber,
                              flagWorst: true,
                              short: 'Given to opponent',
                            }
                          )}
                        {renderSessionRow('Avg Cycle Time', sessionCycleTime, {
                          higherIsBetter: false,
                          format: formatSeconds,
                          short: 'Cycle Time',
                        })}
                        {renderSessionRow(
                          'Leave Rate',
                          s => sessionRate(s, 'leaveRate'),
                          { format: formatRate }
                        )}
                        {renderSessionRow(
                          'Avg Ranking Points',
                          s =>
                            s.matches.length > 0
                              ? sessionRankingPoints(s).earned /
                                s.matches.length
                              : null,
                          { format: formatNumber, short: 'Ranking Points' }
                        )}
                        {renderSessionRow(
                          'Matches with SWARM',
                          s => rankingPointShare(s, 'swarm'),
                          { indent: true, format: formatRate, short: 'SWARM' }
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
                        <tr>
                          {metricCell('Match Type')}
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`${dataCell} font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              {sessionMatchType(
                                session.matches,
                                session.matchType
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              {selectedSessionsData.map(session => {
                const sessionMatches = allMatches.filter(
                  m => m.sessionId === session.id
                );
                return (
                  <div key={session.id}>
                    <div
                      className={`text-xs font-semibold uppercase tracking-widest mb-2 break-words [overflow-wrap:anywhere] min-w-0 ${mutedText}`}
                    >
                      {sessionTitle(session)} · {whenAndWho(session)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sessionMatches.map(match => {
                        const isChecked = matchColumns.some(
                          m => m.key === match.key
                        );
                        return (
                          <button
                            key={match.key}
                            onClick={() => toggleMatch(match)}
                            aria-pressed={isChecked}
                            title={`${ELEMENT_LABELS.tipping} ${match.tipping || 0} · ${ELEMENT_LABELS.garden} ${match.garden || 0} · ${ELEMENT_LABELS.flower} ${match.flower || 0} · ${ELEMENT_LABELS.hive} ${match.ballsInHive || 0}`}
                            className={`${chipClass(isChecked)} gap-1.5 px-3 py-1.5`}
                          >
                            <span>Match #{match.matchNumber}</span>
                            <span className={chipDetailClass(isChecked)}>
                              · {match.breakdown.total}
                            </span>
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
                'Choose matches from the sessions above to see them side by side'
              )
            ) : (
              <>
                <Card className={cardClass}>
                  <CardHeader
                    onClick={() =>
                      setIsMatchScoreChartOpen(!isMatchScoreChartOpen)
                    }
                    className="cursor-pointer hover:bg-opacity-80 transition-all"
                  >
                    <CardTitle
                      className={`text-xl flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                    >
                      <span>Score by match</span>
                      <ChevronDown
                        className={`w-5 h-5 transition-transform duration-200 ${isMatchScoreChartOpen ? 'rotate-180' : ''}`}
                      />
                    </CardTitle>
                  </CardHeader>
                  {isMatchScoreChartOpen && (
                    <CardContent>
                      <p className={`text-xs mb-4 ${mutedText}`}>
                        Pick a scoring element to compare. One bar per selected
                        match.
                      </p>
                      <div className="flex flex-wrap gap-2 mb-5">
                        {ELEMENTS.map(element => (
                          <button
                            key={element}
                            onClick={() => setMatchScoreChartPhase(element)}
                            className={elementButtonClass(
                              matchScoreChartPhase === element
                            )}
                          >
                            {ELEMENT_NAMES[element]}
                          </button>
                        ))}
                      </div>
                      {(() => {
                        const chartData = matchColumns.map(match => ({
                          key: match.key,
                          score: elementPoints(
                            match.breakdown,
                            matchScoreChartPhase
                          ),
                        }));
                        // Matches have no order between sessions, so each
                        // is a bar of its own rather than a point on a line.
                        // Every bar keeps its label: past a screenful the
                        // chart scrolls inside the card instead.
                        return (
                          <div className="w-full overflow-x-auto">
                            <ResponsiveContainer
                              width="100%"
                              height={280}
                              minWidth={Math.max(
                                300,
                                60 + chartData.length * 96
                              )}
                            >
                              <BarChart
                                data={chartData}
                                margin={{
                                  top: 20,
                                  right: 24,
                                  left: 0,
                                  bottom: 0,
                                }}
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
                                  tick={twoLineTick(matchTicks, tickFill)}
                                  axisLine={axisLine}
                                  tickLine={false}
                                />
                                <YAxis
                                  tick={{ fill: tickFill, fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                  width={36}
                                />
                                <Tooltip
                                  contentStyle={tooltipStyle}
                                  labelFormatter={matchTooltipLabel}
                                  formatter={v => `${v} pts`}
                                  cursor={{
                                    fill: isDarkMode
                                      ? 'rgba(255,255,255,0.06)'
                                      : 'rgba(0,0,0,0.04)',
                                  }}
                                />
                                <Bar
                                  dataKey="score"
                                  name={`${ELEMENT_NAMES[matchScoreChartPhase]} Points`}
                                  fill={seriesColors[0]}
                                  radius={[4, 4, 0, 0]}
                                  maxBarSize={56}
                                  label={
                                    chartData.length <= BAR_LABELS_MAX
                                      ? {
                                          position: 'top',
                                          fill: tickFill,
                                          fontSize: 11,
                                        }
                                      : false
                                  }
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                    </CardContent>
                  )}
                </Card>

                <Card className={cardClass}>
                  <CardHeader
                    onClick={() =>
                      setIsMatchCycleChartOpen(!isMatchCycleChartOpen)
                    }
                    className="cursor-pointer hover:bg-opacity-80 transition-all"
                  >
                    <CardTitle
                      className={`text-xl flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                    >
                      <span>Cycle Times per Match</span>
                      <ChevronDown
                        className={`w-5 h-5 transition-transform duration-200 ${isMatchCycleChartOpen ? 'rotate-180' : ''}`}
                      />
                    </CardTitle>
                  </CardHeader>
                  {isMatchCycleChartOpen && (
                    <CardContent>
                      <p className={`text-xs mb-4 ${mutedText}`}>
                        Time between Hive Tips within a match: Tip 2 is the time
                        from the first tip to the second. Supports up to 3
                        matches.
                        {matchColumns.length > 3 && (
                          <span className="ml-1 text-amber-500 font-medium">
                            Select 3 or fewer matches to enable this chart.
                          </span>
                        )}
                      </p>
                      {matchColumns.length > 3 ? (
                        <div
                          className={`flex items-center justify-center h-32 rounded-lg border-2 border-dashed ${isDarkMode ? 'border-team-blue-40 text-team-white-60' : 'border-gray-200 text-gray-600'} text-sm`}
                        >
                          Please select 3 or fewer matches to view cycle time
                          chart
                        </div>
                      ) : (
                        (() => {
                          const cycles = matchColumns.map(cycleTimesOf);
                          const maxCycles = Math.max(
                            ...cycles.map(c => c.length),
                            0
                          );
                          if (maxCycles === 0)
                            return (
                              <div
                                className={`flex items-center justify-center h-32 rounded-lg border-2 border-dashed ${isDarkMode ? 'border-team-blue-40 text-team-white-60' : 'border-gray-200 text-gray-600'} text-sm`}
                              >
                                No cycle time data for selected matches
                              </div>
                            );
                          // Cycle i is the gap that ends at tip i + 2.
                          const chartData = Array.from(
                            { length: maxCycles },
                            (_, i) => {
                              const entry: Record<string, number | string> = {
                                tip: `Tip ${i + 2}`,
                              };
                              cycles.forEach((times, idx) => {
                                if (times[i] !== undefined) {
                                  entry[`match${idx}`] = times[i];
                                }
                              });
                              return entry;
                            }
                          );
                          const matchOf = (dataKey: unknown) =>
                            matchColumns[
                              parseInt(String(dataKey).replace('match', ''))
                            ];
                          return (
                            <div className="w-full overflow-x-auto">
                              <ResponsiveContainer
                                width="100%"
                                height={280}
                                minWidth={300}
                              >
                                <LineChart
                                  data={chartData}
                                  margin={{
                                    top: 8,
                                    right: 24,
                                    left: 0,
                                    bottom: 0,
                                  }}
                                >
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke={gridStroke}
                                  />
                                  <XAxis
                                    dataKey="tip"
                                    tick={{ fill: tickFill, fontSize: 11 }}
                                    axisLine={axisLine}
                                    tickLine={false}
                                  />
                                  <YAxis
                                    tickFormatter={v => `${v}s`}
                                    tick={{ fill: tickFill, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={40}
                                  />
                                  <Tooltip
                                    contentStyle={tooltipStyle}
                                    formatter={(v, name) => {
                                      const m = matchOf(name);
                                      return [
                                        formatSeconds(Number(v)),
                                        m ? matchLabel(m) : name,
                                      ];
                                    }}
                                  />
                                  <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{
                                      fontSize: 12,
                                      paddingTop: 12,
                                    }}
                                    formatter={value => {
                                      const m = matchOf(value);
                                      return m
                                        ? `Match ${m.matchNumber} (${m.sessionName} · ${m.sessionDate})`
                                        : value;
                                    }}
                                  />
                                  {matchColumns.map((match, idx) => (
                                    <Line
                                      key={match.key}
                                      dataKey={`match${idx}`}
                                      name={`match${idx}`}
                                      stroke={
                                        seriesColors[idx % seriesColors.length]
                                      }
                                      strokeWidth={2.5}
                                      dot={{
                                        r: 4,
                                        fill: seriesColors[
                                          idx % seriesColors.length
                                        ],
                                        strokeWidth: 0,
                                      }}
                                      activeDot={{ r: 6 }}
                                      type="linear"
                                      connectNulls={false}
                                    />
                                  ))}
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })()
                      )}
                    </CardContent>
                  )}
                </Card>

                <Card className={cardClass}>
                  <CardHeader
                    onClick={() =>
                      setIsMatchBreakdownOpen(!isMatchBreakdownOpen)
                    }
                    className="cursor-pointer hover:bg-opacity-80 transition-all"
                  >
                    <CardTitle
                      className={`text-xl flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                    >
                      <span>Score Breakdown</span>
                      <ChevronDown
                        className={`w-5 h-5 transition-transform duration-200 ${isMatchBreakdownOpen ? 'rotate-180' : ''}`}
                      />
                    </CardTitle>
                  </CardHeader>
                  {isMatchBreakdownOpen && (
                    <CardContent>
                      {tableKey('', anyScrimMatch)}
                      {/* `relative` for the same reason as the sessions
                          table's wrapper */}
                      <div
                        ref={matchScrollerRef}
                        className={`relative overflow-x-auto ${matchTableShadow}`}
                      >
                        <table ref={matchTableRef} className="w-full text-sm">
                          <thead>
                            <tr
                              className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
                            >
                              {/* Two matches and Avg already scroll on a
                                  phone, so the floor only stops the row
                                  names wrapping word by word */}
                              <th
                                scope="col"
                                className={`${metricColumn} ${metricFit(denseMatches)} pl-3 sm:pl-4 max-sm:min-w-[8.25rem] text-sm font-semibold ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                              >
                                Metric
                              </th>
                              {/* Same list, same order as every row below */}
                              {matchColumns.map(match => (
                                <th
                                  key={match.key}
                                  scope="col"
                                  className={`${matchCell} ${denseMatches ? 'min-w-[5rem]' : ''} font-semibold ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                                >
                                  {/* Breakable anywhere: a long unspaced
                                      name must not widen its column and
                                      push Avg out of view. The floor keeps
                                      ordinary words whole. In a dense
                                      table the name asks for no width at
                                      all, so the row names keep theirs,
                                      and fills whatever its column gets,
                                      cut to three lines (in full on
                                      hover) over the date, so a long one
                                      can't make the header tall. */}
                                  <div
                                    className={`ml-auto ${denseMatches ? 'w-0 min-w-full' : 'min-w-[4.5rem] max-w-[9rem] sm:max-w-[16rem]'} [overflow-wrap:anywhere] text-xs font-normal mb-0.5 ${mutedText}`}
                                  >
                                    {denseMatches ? (
                                      <>
                                        <span
                                          title={match.sessionName}
                                          className="line-clamp-3"
                                        >
                                          {match.sessionName}
                                        </span>
                                        {match.sessionDate}
                                      </>
                                    ) : (
                                      <>
                                        {match.sessionName} ·{' '}
                                        {match.sessionDate}
                                      </>
                                    )}
                                  </div>
                                  <span className="whitespace-nowrap">
                                    Match #{match.matchNumber}
                                  </span>
                                </th>
                              ))}
                              {matchColumns.length > 1 && (
                                <th
                                  scope="col"
                                  className={`${matchCell} font-semibold text-team-blue`}
                                >
                                  Avg
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {renderMatchRow(
                              'Final Score',
                              m => m.breakdown.total,
                              { highlight: true }
                            )}
                            {renderMatchRow(
                              `${ELEMENT_LABELS.tipping} Points`,
                              m => m.breakdown.tipping,
                              { short: `${ELEMENT_LABELS.tipping} pts` }
                            )}
                            {renderMatchRow(
                              `${ELEMENT_LABELS.tipping} Scored`,
                              m => m.tipping || 0,
                              {
                                indent: true,
                                format: formatNumber,
                                short: 'Scored',
                              }
                            )}
                            {renderMatchRow(
                              `${ELEMENT_LABELS.garden} Points`,
                              m => m.breakdown.garden,
                              { short: `${ELEMENT_LABELS.garden} pts` }
                            )}
                            {renderMatchRow(
                              `${ELEMENT_LABELS.garden} Scored`,
                              m => m.garden || 0,
                              {
                                indent: true,
                                format: formatNumber,
                                short: 'Scored',
                              }
                            )}
                            {renderMatchRow(
                              `${ELEMENT_LABELS.flower} Points`,
                              m => m.breakdown.flower,
                              { short: `${ELEMENT_LABELS.flower} pts` }
                            )}
                            {renderMatchRow(
                              `${ELEMENT_LABELS.flower} Scored`,
                              m => m.flower || 0,
                              {
                                indent: true,
                                format: formatNumber,
                                short: 'Scored',
                              }
                            )}
                            {renderMatchRow(
                              `${ELEMENT_LABELS.flowerBonus} Points`,
                              m => m.breakdown.flowerBonus,
                              { short: `${ELEMENT_LABELS.flowerBonus} pts` }
                            )}
                            {renderMatchRow(
                              `${ELEMENT_LABELS.hive} Points`,
                              m => m.breakdown.hive,
                              { short: `${ELEMENT_LABELS.hive} pts` }
                            )}
                            {renderMatchRow(
                              ELEMENT_LABELS.hive,
                              m => m.ballsInHive || 0,
                              {
                                indent: true,
                                format: formatNumber,
                                short: 'Left',
                              }
                            )}
                            {renderMatchRow(
                              `${ELEMENT_LABELS.leave} Points`,
                              m => m.breakdown.leave,
                              { short: `${ELEMENT_LABELS.leave} pts` }
                            )}
                            {renderMatchRow(
                              `${ELEMENT_LABELS.park} Points`,
                              m => m.breakdown.park,
                              { short: `${ELEMENT_LABELS.park} pts` }
                            )}
                            <tr
                              className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                            >
                              {metricCell('Robot 1 Park', {
                                indent: true,
                                dense: denseMatches,
                              })}
                              {matchColumns.map(match => (
                                <td
                                  key={match.key}
                                  className={`${matchCell} font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                                >
                                  {parksOf(match, 1)}
                                </td>
                              ))}
                              {matchColumns.length > 1 && (
                                <td className="px-3 sm:px-4 py-3" />
                              )}
                            </tr>
                            <tr
                              className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                            >
                              {metricCell('Robot 2 Park', {
                                indent: true,
                                dense: denseMatches,
                              })}
                              {matchColumns.map(match => (
                                <td
                                  key={match.key}
                                  className={`${matchCell} font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                                >
                                  {parksOf(match, 2)}
                                </td>
                              ))}
                              {matchColumns.length > 1 && (
                                <td className="px-3 sm:px-4 py-3" />
                              )}
                            </tr>
                            {/* Scrim matches only; never part of the score */}
                            {anyScrimMatch &&
                              renderMatchRow(
                                'Points Given to Opponent',
                                m => (m.scrim ? m.breakdown.penalties : null),
                                {
                                  higherIsBetter: false,
                                  format: formatNumber,
                                  flagWorst: true,
                                  short: 'Given to opponent',
                                }
                              )}
                            {renderMatchRow(
                              'Avg Cycle Time',
                              m => mean(cycleTimesOf(m)),
                              {
                                higherIsBetter: false,
                                format: formatSeconds,
                                short: 'Cycle Time',
                              }
                            )}
                            {renderMatchRow(
                              'Ranking Points',
                              m => rankingPoints(m).total,
                              { format: formatNumber }
                            )}
                            {earnedInColumns && (
                              <tr className="hidden md:table-row">
                                {metricCell('Earned', {
                                  indent: true,
                                  dense: denseMatches,
                                })}
                                {matchColumns.map(match => (
                                  <td
                                    key={match.key}
                                    className={`${matchCell} font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                                  >
                                    {earnedOf(match)}
                                  </td>
                                ))}
                                {matchColumns.length > 1 && (
                                  <td className="px-3 sm:px-4 py-3" />
                                )}
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {/* Where the names don't fit a column each they are
                          listed under the table, so they can't widen it */}
                      <div
                        className={`py-3 px-4 pl-8 text-sm ${earnedInColumns ? 'md:hidden' : ''}`}
                      >
                        <div
                          className={
                            isDarkMode ? 'text-team-white-60' : 'text-gray-600'
                          }
                        >
                          ↳ Earned
                        </div>
                        {matchColumns.map(match => (
                          <div key={match.key} className="mt-2">
                            <div className={`break-words text-xs ${mutedText}`}>
                              {match.sessionName} · {match.sessionDate}
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                              <span
                                className={`shrink-0 font-semibold ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                              >
                                Match #{match.matchNumber}
                              </span>
                              <span
                                className={`text-right font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                              >
                                {earnedOf(match)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Compare;
