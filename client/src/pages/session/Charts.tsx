import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme, useSessionCore } from '@/contexts';
import { ROUTES, APP_CONFIG } from '@/constants';
import { PAGE_CONTAINER } from '@/constants/layout';
import {
  toDate,
  matchScore,
  cycleTimesOf,
  robotRates,
  rankingPointTally,
  toneOf,
  CHART_COLORS,
  ELEMENT_COLORS,
  ELEMENT_LABELS,
  RANKING_POINT_COLORS,
} from '@/lib';
import type { Tone } from '@/lib';
import { formatPoints } from '@/lib/points';
import type { Session, Match, ChartDataPoint, ScoreBreakdown } from '@/types';
import { Button } from '@/components/ui/button';
import { PageHeader, SECTION_TITLE_CLASS } from '@/components/ui/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatTile } from '@/components/ui/stat-tile';
import { primaryClass } from '@/components/ui/tokens';
import {
  ChartTooltip,
  axisColor,
  axisProps,
  dotProps,
  LEGEND_PROPS,
  TOOLTIP_WRAPPER_STYLE,
} from '@/components/charts/chartKit';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Calendar } from 'lucide-react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  LineChart,
  Line,
  BarChart,
  ComposedChart,
} from 'recharts';
import type { MouseHandlerDataParam } from 'recharts';
import {
  useLifetimeSessions,
  useSessionScope,
  byDateAscending,
  sessionTitle,
  isScrim,
  matchBreakdown,
  sessionDay,
  sessionDateLabels,
  plural,
  formatNumber,
  mean,
  MATCH_TYPES,
  matchTypeOf,
  ofMatchType,
} from './lifetime';
import { Segmented } from './LifetimeControls';

type TimeRange = '7' | '30' | '90' | 'all';

type ElementKey =
  | 'tipping'
  | 'garden'
  | 'flower'
  | 'flowerBonus'
  | 'hive'
  | 'robots';

/**
 * Everything a match can score points with. Together they add up to the
 * match score, so shares of the score taken from this list add up to 100%.
 * Offered as the series Score Trends can draw instead of Final Score, and
 * ranked for the "Top scorer" insight. In the order of the score
 * breakdown (`scoreRows`, `GROUPED_ELEMENT_ORDER`): the order the scoring
 * page asks for them, so every list of them reads the same way.
 */
const SCORE_ELEMENTS: ReadonlyArray<{
  key: ElementKey;
  label: string;
  color: Tone;
  points: (b: ScoreBreakdown) => number;
  /** How many were scored, for the elements that are counted */
  count?: (m: Match) => number;
}> = [
  {
    key: 'tipping',
    label: ELEMENT_LABELS.tipping,
    color: ELEMENT_COLORS.tipping,
    points: b => b.tipping,
    count: m => m.tipping || 0,
  },
  {
    key: 'robots',
    label: ELEMENT_LABELS.robots,
    color: ELEMENT_COLORS.robots,
    points: b => b.leave + b.park,
  },
  {
    key: 'flower',
    label: ELEMENT_LABELS.flower,
    color: ELEMENT_COLORS.flower,
    points: b => b.flower,
    count: m => m.flower || 0,
  },
  {
    key: 'flowerBonus',
    label: ELEMENT_LABELS.flowerBonus,
    color: ELEMENT_COLORS.flowerBonus,
    points: b => b.flowerBonus,
  },
  {
    key: 'hive',
    label: ELEMENT_LABELS.hive,
    color: ELEMENT_COLORS.hive,
    points: b => b.hive,
    count: m => m.ballsInHive || 0,
  },
  {
    key: 'garden',
    label: ELEMENT_LABELS.garden,
    color: ELEMENT_COLORS.garden,
    points: b => b.garden,
    count: m => m.garden || 0,
  },
];

/** What Score Trends draws: the match score, or one element of it. */
type Series = 'total' | ElementKey;

const SERIES: ReadonlyArray<{
  value: Series;
  label: string;
  color: Tone;
  points: (b: ScoreBreakdown) => number;
}> = [
  {
    value: 'total',
    label: 'Final Score',
    color: CHART_COLORS.total,
    points: b => b.total,
  },
  ...SCORE_ELEMENTS.map(({ key, label, color, points }) => ({
    value: key,
    label,
    color,
    points,
  })),
];

/** The elements Scoring Volume counts, in the colours they have above. */
const COUNTED_ELEMENTS = SCORE_ELEMENTS.flatMap(({ label, color, count }) =>
  count ? [{ label, color, count }] : []
);

const RANGE_LABELS: Record<TimeRange, string> = {
  '7': 'last 7 days',
  '30': 'last 30 days',
  '90': 'last 90 days',
  all: 'all time',
};

/** A session with no usable date is in no day range, only in "All time". */
const isUndated = (session: Session): boolean =>
  !session.createdAt || isNaN(toDate(session.createdAt).getTime());

/**
 * Why a day range is empty although there are sessions: each one is either
 * older than the range or has no date to place it by.
 */
const outOfRangeMessage = (sessions: Session[]): string => {
  const total = sessions.length;
  const undated = sessions.filter(isUndated).length;
  const earlier = total - undated;
  if (undated === 0) {
    return total === 1
      ? 'Your only session was recorded earlier.'
      : `You have ${total} sessions, all recorded earlier.`;
  }
  if (earlier === 0) {
    return total === 1
      ? 'Your only session has no date, so it only shows under All time.'
      : `Your ${total} sessions have no date, so they only show under All time.`;
  }
  return `You have ${total} sessions: ${earlier} recorded earlier and ${undated} with no date.`;
};

/** How many sessions the fouls chart looks back over. */
const RECENT_SESSIONS = 10;

/**
 * '3‑session': the hyphen is U+2011, which never breaks a line, so the
 * label stays one phrase wherever it wraps.
 */
const MOVING_AVERAGE_LABEL = '3\u2011session avg';
const MOVING_AVERAGE_PHRASE = '3\u2011session average';

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Scores of a session's matches, recomputed from their fields. */
const matchScores = (session: Session): number[] =>
  session.matches.map(m => matchScore(m, session.matchType));

/** A session's average match score, as a whole number. */
const sessionAverage = (session: Session): number =>
  Math.round(mean(matchScores(session)) ?? 0);

/** A session's matches, each carrying the type it was run as. */
const typedMatches = (session: Session): Match[] =>
  session.matches.map(m =>
    m.matchType || !session.matchType
      ? m
      : { ...m, matchType: session.matchType }
  );

/**
 * What each charted session is called. Chart rows are keyed by session id,
 * so two sessions on the same day, or with the same name, stay two points:
 * the axis shows the day (`tick`, see `dayTicks`) and the tooltip names the
 * session in full, with the time when it shares its day with another
 * (`full`).
 */
type SessionLabels = Map<string, { tick: string; full: string }>;

const labelSessions = (sessions: Session[]): SessionLabels => {
  const dates = sessionDateLabels(sessions);
  return new Map(
    sessions.map(session => [
      session.id,
      {
        tick: sessionDay(session),
        full: `${dates.get(session.id) ?? ''} · ${sessionTitle(session)}`,
      },
    ])
  );
};

/**
 * The rows an x axis puts a date under: the first session of each day. A
 * later session on the same day keeps its point but no tick of its own, so
 * the axis never reads 'Sep 26, Sep 26'; its tooltip gives the time. Rows
 * are a session each, oldest first.
 */
const dayTicks = (rows: ChartDataPoint[], labels: SessionLabels): string[] => {
  const days = new Set<string>();
  return rows.flatMap(row => {
    const id = String(row.id);
    const day = labels.get(id)?.tick;
    if (day === undefined || days.has(day)) return [];
    days.add(day);
    return [id];
  });
};

/**
 * Average points per match from one series in each session, with the
 * average of the last three sessions (fewer at the start) beside it.
 */
const scoreTrendRows = (
  sessions: Session[],
  labels: SessionLabels,
  points: (b: ScoreBreakdown) => number,
  round: (value: number) => number
): ChartDataPoint[] => {
  const means = sessions.map(
    session =>
      mean(
        session.matches.map(m => points(matchBreakdown(m, session.matchType)))
      ) ?? 0
  );
  return sessions.map((session, index) => ({
    id: session.id,
    label: labels.get(session.id)?.full,
    value: round(means[index]),
    average: round(mean(means.slice(Math.max(0, index - 2), index + 1)) ?? 0),
  }));
};

/** Average count of each scored element per match, session over session. */
const elementVolumeRows = (
  sessions: Session[],
  labels: SessionLabels
): ChartDataPoint[] =>
  sessions.map(session => ({
    id: session.id,
    label: labels.get(session.id)?.full,
    ...Object.fromEntries(
      COUNTED_ELEMENTS.map(({ label, count }) => [
        label,
        round1(mean(session.matches.map(count)) ?? 0),
      ])
    ),
  }));

/**
 * Time between Hive Tips in each session that recorded any. `sessions` is
 * sorted here rather than trusted to arrive oldest first.
 */
const cycleTimeRows = (
  sessions: Session[],
  labels: SessionLabels
): ChartDataPoint[] =>
  [...sessions].sort(byDateAscending).flatMap(session => {
    const cycleTimes = session.matches.flatMap(cycleTimesOf);
    if (cycleTimes.length === 0) return [];
    return [
      {
        id: session.id,
        label: labels.get(session.id)?.full,
        'Avg Cycle': round1(mean(cycleTimes) ?? 0),
        Fastest: round1(Math.min(...cycleTimes)),
        Slowest: round1(Math.max(...cycleTimes)),
      },
    ];
  });

/**
 * Points our penalties gave the opponent per match in each of the latest
 * Scrim sessions (a Practice session has no opponent), and how many of those
 * matches had no penalty at all. These points are never taken off our own
 * score.
 */
const foulSummary = (
  sessions: Session[],
  labels: SessionLabels
): { rows: ChartDataPoint[]; clean: number; total: number } => {
  let clean = 0;
  let total = 0;
  const rows = sessions
    .filter(isScrim)
    .slice(-RECENT_SESSIONS)
    .map(session => {
      const given = session.matches.map(
        m => matchBreakdown(m, session.matchType).penalties
      );
      const penaltyFree = given.filter(points => points === 0).length;
      clean += penaltyFree;
      total += given.length;
      return {
        id: session.id,
        label: labels.get(session.id)?.full,
        [ELEMENT_LABELS.penalties]: round1(mean(given) ?? 0),
        note: `Penalty-free: ${penaltyFree} of ${plural(given.length, 'match', 'matches')}`,
      };
    });
  return { rows, clean, total };
};

/**
 * Ranking points per match in each session, split by the one earned: each
 * series is the share of the session's matches that earned it, so the three
 * stack up to the session's average. Only SWARM and POLLINATOR can be told
 * from a match's own scoring; a win or tie needs the opponent's score.
 * The space in 'POLLINATOR 1' is U+00A0: the name never breaks before its
 * number, in the legend or in a phone's narrow tooltip.
 */
const RANKING_POINT_SERIES = [
  { label: 'SWARM', color: RANKING_POINT_COLORS.swarm, key: 'swarm' },
  {
    label: 'POLLINATOR 1',
    color: RANKING_POINT_COLORS.pollinator1,
    key: 'pollinator1',
  },
  {
    label: 'POLLINATOR 2',
    color: RANKING_POINT_COLORS.pollinator2,
    key: 'pollinator2',
  },
] as const;

const rankingPointRows = (
  sessions: Session[],
  labels: SessionLabels
): ChartDataPoint[] =>
  sessions.map(session => {
    const tally = rankingPointTally(session.matches, session.matchType);
    return {
      id: session.id,
      label: labels.get(session.id)?.full,
      ...Object.fromEntries(
        RANKING_POINT_SERIES.map(({ label, key }) => [
          label,
          Math.round((tally[key] / session.matches.length) * 100) / 100,
        ])
      ),
    };
  });

/** Points are whole or to one decimal, and always say they are points. */
const pointsValue = (value: number): string =>
  formatPoints(Number(formatNumber(value)));

/** A per-match figure, short enough for a phone's tooltip: '8.8/match'. */
const perMatchValue = (value: number): string => `${formatNumber(value)}/match`;

/**
 * Round steps for a value axis that starts at 0: the smallest step from this
 * list that reaches the largest value in at most five intervals. A score
 * axis reads 0/40/80/120/160 rather than Recharts' own 0/35/70/105/140.
 */
const AXIS_STEPS = [1, 2, 5, 10, 20, 40, 80, 100, 200, 400, 800];

const valueAxis = (
  values: number[]
): { domain: [number, number]; ticks: number[] } => {
  const max = Math.max(0, ...values.filter(Number.isFinite));
  const step =
    AXIS_STEPS.find(s => Math.ceil(max / s) <= 5) ??
    AXIS_STEPS[AXIS_STEPS.length - 1];
  const top = Math.max(step, Math.ceil(max / step) * step);
  return {
    domain: [0, top],
    ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step),
  };
};

/** The numbers in some of a chart's series, for its value axis. */
const valuesOf = (rows: ChartDataPoint[], keys: readonly string[]): number[] =>
  rows.flatMap(row =>
    keys.map(key => row[key]).filter((v): v is number => typeof v === 'number')
  );

/** The same breathing room round every plot, so no dot is cut in half. */
const CHART_MARGIN = { top: 10, right: 12, left: 0, bottom: 0 };

/** Wide enough for '160' or '0.5'. The plot starts this far from the left. */
const Y_AXIS_WIDTH = 40;

/** Narrow enough for a 320px phone: the chart then fits its card. */
const MIN_CHART_WIDTH = 240;

/**
 * The card's own colour, which rings each dot so the ring disappears into
 * the card. The cards are bg-team-dark-20 / bg-white, which every theme
 * paints the same as its --card.
 */
const CARD_BG = 'hsl(var(--card))';

/** A pointer that can hover, so a click on a chart can open its session. */
const FINE_POINTER = '(hover: hover) and (pointer: fine)';

type ChartId = 'trend' | 'fouls' | 'volume' | 'rp' | 'cycle';

/** A card holding one chart, in the same look as Analysis's sections. */
const ChartCard = ({
  title,
  description,
  isDarkMode,
  children,
}: {
  title: string;
  description?: ReactNode;
  isDarkMode: boolean;
  children: ReactNode;
}) => (
  <Card
    // A tap inside a chart card never closes that chart's tooltip
    data-chart-card=""
    className={`flex flex-col rounded-xl shadow-none ${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
  >
    <CardHeader className="space-y-1 p-4 sm:p-6">
      <CardTitle
        as="h2"
        className={`${SECTION_TITLE_CLASS} leading-snug tracking-normal text-balance`}
      >
        {title}
      </CardTitle>
      {description && (
        <CardDescription
          className={`text-xs sm:text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
        >
          {description}
        </CardDescription>
      )}
    </CardHeader>
    <CardContent className="flex flex-1 flex-col p-4 pt-0 sm:p-6 sm:pt-0">
      {children}
    </CardContent>
  </Card>
);

/**
 * The newest session's average match score, and how it compares with every
 * earlier match in range (both per-match averages).
 */
const LastSessionTile = ({
  sessions,
  isDarkMode,
}: {
  sessions: Session[];
  isDarkMode: boolean;
}) => {
  if (sessions.length < 2) {
    return (
      <StatTile
        label="Last session"
        value={null}
        caption="No earlier session"
        isDarkMode={isDarkMode}
      />
    );
  }
  const earlierAvg = Math.round(
    mean(sessions.slice(0, -1).flatMap(matchScores)) ?? 0
  );
  const lastScore = sessionAverage(sessions[sessions.length - 1]);
  const diff = lastScore - earlierAvg;
  const deltaTone =
    diff > 0
      ? isDarkMode
        ? 'text-emerald-400'
        : 'text-emerald-700'
      : diff < 0
        ? isDarkMode
          ? 'text-red-400'
          : 'text-red-700'
        : '';
  return (
    <StatTile
      label="Last session"
      value={lastScore}
      caption={
        <>
          <span className={`font-semibold tabular-nums ${deltaTone}`}>
            {diff > 0 ? '+' : diff < 0 ? '\u2212' : '\u00b1'}
            {Math.abs(diff)}
          </span>{' '}
          vs {earlierAvg} earlier avg
        </>
      }
      isDarkMode={isDarkMode}
    />
  );
};

/** Short one-line facts about the matches in range, in pairs. */
const keyInsights = (
  sessions: Session[]
): Array<{ label: string; text: string }> => {
  if (sessions.length < 2) return [];
  const breakdowns = sessions.flatMap(s =>
    s.matches.map(m => matchBreakdown(m, s.matchType))
  );
  const avgScore = mean(breakdowns.map(b => b.total)) ?? 0;

  // Rank the scoring elements by average contribution.
  const best = SCORE_ELEMENTS.map(({ label, points }) => ({
    label,
    avg: mean(breakdowns.map(points)) ?? 0,
  })).sort((a, b) => b.avg - a.avg)[0];

  const matches = sessions.flatMap(typedMatches);
  const { leaveRate, parkRate } = robotRates(matches);
  const robots = [
    leaveRate !== null && `Leave ${leaveRate}%`,
    parkRate !== null && `Park ${parkRate}%`,
  ].filter(Boolean);

  const scrimGiven = sessions
    .filter(isScrim)
    .flatMap(s => s.matches.map(m => matchBreakdown(m, s.matchType).penalties));
  const avgGiven = mean(scrimGiven);

  const rp = rankingPointTally(matches);

  const bestSession = sessions.reduce((top, s) =>
    sessionAverage(s) > sessionAverage(top) ? s : top
  );

  return [
    {
      label: 'Top scorer',
      text:
        avgScore > 0
          ? `${best.label} · ${best.avg >= 10 ? Math.round(best.avg) : formatNumber(best.avg)} pts/match (${Math.round((best.avg / avgScore) * 100)}%)`
          : 'No points scored yet',
    },
    {
      label: 'Robots',
      text:
        robots.length > 0
          ? `${robots.join(' · ')} of chances`
          : 'No Leave or Park chances',
    },
    {
      label: 'RP',
      text: `${rp.rate ?? 0}% (${rp.earned}/${rp.possible}) · SWARM ${rp.swarm} · P1 ${rp.pollinator1} · P2 ${rp.pollinator2}`,
    },
    avgGiven !== null
      ? {
          label: 'To opponent',
          text: `${formatNumber(avgGiven)} pts per Scrim match`,
        }
      : {
          label: 'Best session',
          text: `${sessionDay(bestSession)} · ${sessionTitle(bestSession)} · ${sessionAverage(bestSession)} avg`,
        },
  ];
};

const Charts = () => {
  const { isDarkMode } = useTheme();
  const { hasActiveSession } = useSessionCore();
  const navigate = useNavigate();
  const finePointer = useMediaQuery(FINE_POINTER);

  const {
    sessions,
    loading,
    hasMore,
    loadingOlder,
    olderFailed,
    completeAfter,
    loadOlder,
    loadAll,
  } = useLifetimeSessions();
  const { scope, setScope, inScope, choices, scopeLabel } = useSessionScope(
    sessions,
    !hasMore
  );
  const [timeRange, setTimeRange] = useState<TimeRange>('30');
  /** The match type asked for; null until one is, and the commonest is used */
  const [pickedType, setPickedType] = useState<string | null>(null);
  /** What Score Trends draws */
  const [series, setSeries] = useState<Series>('total');
  /** The session last tapped on a chart, on a screen with no hover */
  const [tapped, setTapped] = useState<{ chart: ChartId; id: string } | null>(
    null
  );

  /** The row of series to pick from, which scrolls sideways on a phone */
  const seriesRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `Charts - ${APP_CONFIG.name}`;
  }, []);

  // A series picked at the edge of its scrolling row is brought into view.
  useEffect(() => {
    const row = seriesRowRef.current;
    const picked = row?.querySelector('[aria-pressed="true"]');
    if (!row || !picked) return;
    const rowBox = row.getBoundingClientRect();
    const box = picked.getBoundingClientRect();
    if (box.left < rowBox.left) row.scrollLeft -= rowBox.left - box.left + 16;
    else if (box.right > rowBox.right)
      row.scrollLeft += box.right - rowBox.right + 16;
  }, [series]);

  // A tap outside every chart card puts the tapped chart's tooltip away.
  useEffect(() => {
    if (finePointer || !tapped) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('[data-chart-card]'))
        setTapped(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [finePointer, tapped]);

  const scopedSessions = useMemo(
    () => sessions.filter(inScope),
    [sessions, inScope]
  );

  /**
   * Sessions are read newest first, a page at a time. The range on screen
   * is drawn from every session in it: older pages are read until it is
   * covered (all of them for All time). The default 30 days takes only the
   * first page unless more sessions were recorded in them than a page
   * holds (a busy team, or a member with many of their own beside it):
   * those are read too, rather than charted in part.
   */
  const rangeCovered =
    !hasMore ||
    (timeRange !== 'all' &&
      completeAfter !== null &&
      completeAfter.getTime() <=
        Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
  /**
   * Nothing read so far is this season's: whether there are any at all is
   * only known once older pages say, whatever the range.
   */
  const noneRead = sessions.length === 0 && hasMore;
  useEffect(() => {
    if (loading || loadingOlder || olderFailed) return;
    if (rangeCovered && !noneRead) return;
    void (timeRange === 'all' ? loadAll() : loadOlder());
  }, [
    loading,
    rangeCovered,
    noneRead,
    loadingOlder,
    olderFailed,
    timeRange,
    loadAll,
    loadOlder,
  ]);

  const filteredSessions = useMemo((): Session[] => {
    if (timeRange === 'all') return scopedSessions;

    const days = parseInt(timeRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return scopedSessions.filter(
      session => !isUndated(session) && toDate(session.createdAt) >= cutoffDate
    );
  }, [scopedSessions, timeRange]);

  /** The match types run in this range, with how many matches each has. */
  const typeChoices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of filteredSessions) {
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
  }, [filteredSessions]);

  /**
   * The one match type everything on the page is about. Unless another was
   * asked for (and is still there to show), it is the type with the most
   * matches in the range.
   */
  const matchType =
    typeChoices.find(choice => choice.value === pickedType)?.value ??
    [...typeChoices].sort((a, b) => b.count - a.count)[0]?.value ??
    MATCH_TYPES[0];

  /**
   * The sessions every figure and chart is built from: those with at least
   * one match of the chosen type, cut down to those matches, oldest first.
   * A session with no matches has no score, so it must not count as a
   * session that scored 0. flatMap() returns a new array, so sorting it
   * leaves the `sessions` state untouched.
   */
  const scoredSessions = useMemo(
    () =>
      filteredSessions
        .flatMap(session => ofMatchType(session, matchType) ?? [])
        .sort(byDateAscending),
    [filteredSessions, matchType]
  );

  const labels = useMemo(() => labelSessions(scoredSessions), [scoredSessions]);

  const muted = isDarkMode ? 'text-team-white-60' : 'text-gray-600';
  const pageClass = `min-h-[100dvh] page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`;
  /** The header's column, so their ends line up at every width */
  const wrapClass = `${PAGE_CONTAINER} py-4 sm:py-6 md:py-8`;
  const cardClass = `rounded-xl shadow-none ${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`;

  // Nothing read so far is this season's: older pages are read for some.
  if (loading || (noneRead && !olderFailed)) {
    return (
      <div
        className={`min-h-[100dvh] flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-blue"></div>
          <p className="text-sm text-team-blue">Loading charts...</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className={pageClass}>
        <div className={wrapClass}>
          <PageHeader title="Performance Charts" />
          <Card className={cardClass}>
            <CardContent className="px-4 py-10 sm:py-12">
              <div className="text-center">
                <h2 className={`${SECTION_TITLE_CLASS} mb-2`}>
                  No sessions yet
                </h2>
                <p className={`mb-6 text-sm sm:text-base ${muted}`}>
                  Record a session to see your performance charts.
                </p>
                <Button
                  onClick={() => navigate(ROUTES.ACTIVE)}
                  disabled={hasActiveSession}
                  title={
                    hasActiveSession
                      ? 'Complete or cancel the active session first'
                      : undefined
                  }
                  // The view's one fill: the header's New Session steps back
                  data-page-primary={hasActiveSession ? undefined : ''}
                  className={`border ${primaryClass(isDarkMode)} disabled:opacity-50 disabled:cursor-not-allowed [@media(pointer:coarse)]:min-h-11`}
                >
                  Start a new session
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const seriesInfo = SERIES.find(s => s.value === series) ?? SERIES[0];
  const tone = (color: Tone) => toneOf(color, isDarkMode);
  const seriesColor = tone(seriesInfo.color);
  const trendData = scoreTrendRows(
    scoredSessions,
    labels,
    seriesInfo.points,
    series === 'total' ? Math.round : round1
  );
  const elementVolumeTrendData = elementVolumeRows(scoredSessions, labels);
  const cycleTimeData = cycleTimeRows(scoredSessions, labels);
  const fouls = foulSummary(scoredSessions, labels);
  const foulData = fouls.rows;
  const rankingPointData = rankingPointRows(scoredSessions, labels);

  // Match-level figures, the same ones Analysis shows for a single session.
  const allScores = scoredSessions.flatMap(matchScores);
  const averageScore = Math.round(mean(allScores) ?? 0);
  const bestScore = Math.max(0, ...allScores);
  const emptySessionCount = filteredSessions.filter(
    s => s.matches.length === 0
  ).length;

  const tickLabel = (id: string) => labels.get(id)?.tick ?? '';
  const gridStroke = isDarkMode ? '#2a2a2a' : '#e5e7eb';
  const axis = axisProps(isDarkMode);

  /** What the page is looking at, under its title. */
  const subtitle = [
    scoredSessions.length > 0
      ? `${plural(allScores.length, `${matchType} match`, `${matchType} matches`)} · ${plural(scoredSessions.length, 'session')}`
      : 'No matches',
    emptySessionCount > 0 &&
      `${plural(emptySessionCount, 'empty session')} not counted`,
    RANGE_LABELS[timeRange],
    scopeLabel,
    !rangeCovered &&
      (olderFailed
        ? "older sessions couldn't be read"
        : 'reading older sessions...'),
  ]
    .filter(Boolean)
    .join(' · ');

  const analysisPath = (id: string) =>
    `${ROUTES.ANALYSIS}?sessionId=${encodeURIComponent(id)}`;

  /**
   * A click on a chart opens the session under the pointer. A touch screen
   * has no hover, so there the tap shows the tooltip and the session is
   * offered as a link in the line under the chart instead.
   */
  const openSession = (chart: ChartId) => (state: MouseHandlerDataParam) => {
    const id = String(state.activeLabel ?? '');
    if (!labels.has(id)) return;
    if (finePointer) {
      navigate(analysisPath(id));
    } else {
      setTapped({ chart, id });
    }
  };

  /** Recharts sets its own cursor inline, so a clickable chart says so too */
  const chartStyle = finePointer ? { cursor: 'pointer' } : undefined;

  /**
   * With a mouse the tooltip follows the pointer. On a touch screen only the
   * chart tapped last shows one, pinned to the chart's top-left corner (in
   * line with the card's title) and no wider than the chart, so it is never
   * cut off at the screen's edge. It covers the value axis: its own figures
   * are exact, and the plot alone is too narrow on a 320px phone for
   * 'POLLINATOR 2' and its value on one line.
   */
  const tooltipProps = (chart: ChartId) =>
    finePointer
      ? { wrapperStyle: TOOLTIP_WRAPPER_STYLE }
      : {
          active: tapped?.chart === chart ? undefined : false,
          position: { x: 0, y: 0 },
          wrapperStyle: { ...TOOLTIP_WRAPPER_STYLE, maxWidth: '100%' },
          isAnimationActive: false,
        };

  /** Said in the tooltip, where a click does it */
  const clickHint = finePointer ? 'Click to open this session' : undefined;

  /**
   * The one dot recipe. On a touch screen a chart other than the one tapped
   * last keeps no enlarged dot either: Recharts still thinks the finger is
   * over it, though its tooltip is put away.
   */
  const dots = (chart: ChartId, color: string) => {
    const recipe = dotProps(CARD_BG, color);
    return finePointer || tapped?.chart === chart
      ? recipe
      : { ...recipe, activeDot: false as const };
  };

  /**
   * The line under a chart on a touch screen: what a tap does, then a link
   * to the session tapped. It is always there, one line high, so a tap
   * never moves the page.
   */
  const tapRow = (chart: ChartId, mark: 'point' | 'bar') => {
    const label = tapped?.chart === chart ? labels.get(tapped.id) : undefined;
    return (
      <div className="mt-2 flex min-h-11 min-w-0 items-center [@media(hover:hover)_and_(pointer:fine)]:hidden">
        {tapped && label ? (
          <Link
            to={analysisPath(tapped.id)}
            title={label.full}
            className="min-w-0 truncate py-3 text-sm font-semibold text-team-blue underline underline-offset-2"
          >
            Open {label.full}
          </Link>
        ) : (
          <p className={`text-xs ${muted}`}>Tap a {mark} to open its session</p>
        )}
      </div>
    );
  };

  const trendAxis = valueAxis(valuesOf(trendData, ['value', 'average']));
  const insights = keyInsights(scoredSessions);

  return (
    <div className={pageClass}>
      <div className={wrapClass}>
        <PageHeader title="Performance Charts" subtitle={subtitle}>
          <div className="flex flex-wrap items-center gap-2">
            {typeChoices.length > 1 && (
              <Segmented
                label="Match type"
                value={matchType}
                options={typeChoices}
                onChange={setPickedType}
                isDarkMode={isDarkMode}
              />
            )}
            {choices.length > 0 && (
              <Segmented
                label="Sessions shown"
                value={scope}
                options={choices}
                onChange={setScope}
                isDarkMode={isDarkMode}
              />
            )}
            <Select
              value={timeRange}
              onValueChange={value => setTimeRange(value as TimeRange)}
            >
              <SelectTrigger
                aria-label="Time range"
                className={`w-auto text-xs sm:text-sm px-2 h-9 [@media(pointer:coarse)]:min-h-11 ${isDarkMode ? 'bg-team-dark border-team-blue-40 text-white' : 'bg-white border-gray-300'}`}
              >
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className={`${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white'}`}
              >
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </PageHeader>

        {scoredSessions.length === 0 ? (
          <Card className={cardClass}>
            <CardContent className="px-4 py-10 sm:py-12">
              <div className="text-center">
                <h2 className={`${SECTION_TITLE_CLASS} mb-2`}>
                  {scopedSessions.length === 0
                    ? `No sessions ${scopeLabel}`
                    : filteredSessions.length === 0
                      ? `No sessions in the last ${timeRange} days`
                      : 'No matches to chart'}
                </h2>
                <p className={`mb-6 text-sm sm:text-base ${muted}`}>
                  {scopedSessions.length === 0
                    ? `${plural(sessions.length, 'session')} under All${hasMore ? ', and older ones not read yet' : ''}.`
                    : filteredSessions.length === 0
                      ? outOfRangeMessage(scopedSessions)
                      : filteredSessions.length === 1
                        ? 'The only session in this range has no matches recorded.'
                        : `None of the ${filteredSessions.length} sessions in this range has a match recorded.`}
                </p>
                {scopedSessions.length === 0 ? (
                  <Button
                    onClick={() => setScope('all')}
                    data-page-primary
                    className={`border ${primaryClass(isDarkMode)} [@media(pointer:coarse)]:min-h-11`}
                  >
                    Show all sessions
                  </Button>
                ) : (
                  timeRange !== 'all' && (
                    <Button
                      onClick={() => setTimeRange('all')}
                      data-page-primary
                      className={`border ${primaryClass(isDarkMode)} [@media(pointer:coarse)]:min-h-11`}
                    >
                      Show all time
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* The counts are in the subtitle; the tiles are the scores */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
              <StatTile
                label="Average Score"
                value={averageScore}
                isDarkMode={isDarkMode}
              />
              <StatTile
                label="Best Score"
                value={bestScore}
                isDarkMode={isDarkMode}
              />
              <LastSessionTile
                sessions={scoredSessions}
                isDarkMode={isDarkMode}
              />
            </div>

            {scoredSessions.length < 2 ? (
              <Card className={cardClass}>
                <CardContent className="p-4 sm:p-6">
                  <p className={`text-sm sm:text-base ${muted}`}>
                    Trends appear after 2 sessions —{' '}
                    <Link
                      to={analysisPath(scoredSessions[0].id)}
                      // Inline, so the sentence wraps as one; the padding
                      // makes it a full-size target without moving a line
                      className="py-3 font-semibold text-team-blue underline underline-offset-2"
                    >
                      open {labels.get(scoredSessions[0].id)?.full} in Analysis
                    </Link>
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                <ChartCard
                  title="Score Trends"
                  description={
                    <>
                      Average points per match in each session; the dashed line
                      is the {MOVING_AVERAGE_PHRASE}
                    </>
                  }
                  isDarkMode={isDarkMode}
                >
                  {/* One series at a time: the parts of the score are a
                      tenth of its size, so drawn under it they flatten
                      into one band */}
                  <div
                    ref={seriesRowRef}
                    className="-mx-4 mb-3 overflow-x-auto px-4 sm:mx-0 sm:px-0"
                  >
                    <Segmented
                      label="Series drawn"
                      value={series}
                      options={SERIES}
                      onChange={setSeries}
                      isDarkMode={isDarkMode}
                      className="w-max flex-nowrap"
                    />
                  </div>
                  <div className="mt-auto min-w-0">
                    <ResponsiveContainer
                      width="100%"
                      height={250}
                      minWidth={MIN_CHART_WIDTH}
                    >
                      <ComposedChart
                        data={trendData}
                        margin={CHART_MARGIN}
                        onClick={openSession('trend')}
                        style={chartStyle}
                        title={`Score trends: ${seriesInfo.label} per session`}
                        desc={`Average ${seriesInfo.label} points per match in each session, oldest first, with the ${MOVING_AVERAGE_PHRASE}`}
                      >
                        <defs>
                          <linearGradient
                            id="trendFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={seriesColor}
                              stopOpacity={isDarkMode ? 0.22 : 0.14}
                            />
                            <stop
                              offset="95%"
                              stopColor={seriesColor}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={gridStroke}
                        />
                        <XAxis
                          dataKey="id"
                          tickFormatter={tickLabel}
                          ticks={dayTicks(trendData, labels)}
                          {...axis}
                        />
                        <YAxis
                          width={Y_AXIS_WIDTH}
                          domain={trendAxis.domain}
                          ticks={trendAxis.ticks}
                          {...axis}
                        />
                        <Tooltip
                          {...tooltipProps('trend')}
                          cursor={{
                            stroke: axisColor(isDarkMode),
                            strokeWidth: 1,
                          }}
                          content={
                            <ChartTooltip
                              isDarkMode={isDarkMode}
                              formatValue={pointsValue}
                              hint={clickHint}
                            />
                          }
                        />
                        <Legend {...LEGEND_PROPS} itemSorter={null} />
                        {/* The series is the heaviest mark; the average is
                            a thin dashed slate line under it */}
                        <Area
                          type="linear"
                          dataKey="value"
                          name={seriesInfo.label}
                          stroke={seriesColor}
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#trendFill)"
                          {...dots('trend', seriesColor)}
                          animationDuration={800}
                        />
                        <Line
                          type="linear"
                          dataKey="average"
                          name={MOVING_AVERAGE_LABEL}
                          stroke={tone(CHART_COLORS.movingAverage)}
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          legendType="plainline"
                          dot={false}
                          activeDot={false}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                    {tapRow('trend', 'point')}
                  </div>
                </ChartCard>

                <Card className={cardClass}>
                  <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-4">
                    <CardTitle
                      as="h2"
                      className={`${SECTION_TITLE_CLASS} leading-snug tracking-normal`}
                    >
                      Key Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <ul className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      {insights.map(({ label, text }) => (
                        <li key={label}>
                          <span className="font-semibold text-foreground">
                            {label}:
                          </span>{' '}
                          <span className={muted}>{text}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {foulData.length > 0 && (
                  <ChartCard
                    title="Points Given to Opponent"
                    description={`Per match, in each Scrim session (last ${RECENT_SESSIONS}). Never taken off your score.`}
                    isDarkMode={isDarkMode}
                  >
                    {/* A share of matches is a different unit from points
                        per match, so it is a figure, not a second line */}
                    <p className={`mb-3 text-xs sm:text-sm ${muted}`}>
                      <span className="mr-2 text-2xl font-bold tabular-nums text-foreground">
                        {Math.round((fouls.clean / fouls.total) * 100)}%
                      </span>
                      penalty-free · {fouls.clean} of{' '}
                      {plural(fouls.total, 'Scrim match', 'Scrim matches')}
                    </p>
                    <div className="mt-auto min-w-0">
                      <ResponsiveContainer
                        width="100%"
                        height={220}
                        minWidth={MIN_CHART_WIDTH}
                      >
                        <BarChart
                          data={foulData}
                          margin={CHART_MARGIN}
                          onClick={openSession('fouls')}
                          style={chartStyle}
                          title="Points given to the opponent per match"
                          desc={`Average points per match the opponent got from your penalties in each of the last ${RECENT_SESSIONS} Scrim sessions`}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={gridStroke}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="id"
                            tickFormatter={tickLabel}
                            ticks={dayTicks(foulData, labels)}
                            {...axis}
                          />
                          <YAxis
                            width={Y_AXIS_WIDTH}
                            {...valueAxis(
                              valuesOf(foulData, [ELEMENT_LABELS.penalties])
                            )}
                            {...axis}
                          />
                          <Tooltip
                            {...tooltipProps('fouls')}
                            cursor={{
                              fill: isDarkMode
                                ? 'rgba(255,255,255,0.06)'
                                : 'rgba(0,0,0,0.04)',
                            }}
                            content={
                              <ChartTooltip
                                isDarkMode={isDarkMode}
                                formatValue={perMatchValue}
                                hint={clickHint}
                              />
                            }
                          />
                          <Bar
                            dataKey={ELEMENT_LABELS.penalties}
                            fill={tone(ELEMENT_COLORS.penalties)}
                            radius={[6, 6, 0, 0]}
                            maxBarSize={48}
                            animationDuration={800}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                      {tapRow('fouls', 'bar')}
                    </div>
                  </ChartCard>
                )}

                <ChartCard
                  title="Scoring Volume Trend"
                  description="Average count of each element scored per match"
                  isDarkMode={isDarkMode}
                >
                  <div className="mt-auto min-w-0">
                    <ResponsiveContainer
                      width="100%"
                      height={240}
                      minWidth={MIN_CHART_WIDTH}
                    >
                      <LineChart
                        data={elementVolumeTrendData}
                        margin={CHART_MARGIN}
                        onClick={openSession('volume')}
                        style={chartStyle}
                        title="Scoring volume per session"
                        desc="Average count per match of Hive Tips, Garden, Flower and Left in Hive in each session"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={gridStroke}
                        />
                        <XAxis
                          dataKey="id"
                          tickFormatter={tickLabel}
                          ticks={dayTicks(elementVolumeTrendData, labels)}
                          {...axis}
                        />
                        <YAxis
                          width={Y_AXIS_WIDTH}
                          {...valueAxis(
                            valuesOf(
                              elementVolumeTrendData,
                              COUNTED_ELEMENTS.map(e => e.label)
                            )
                          )}
                          {...axis}
                        />
                        <Tooltip
                          {...tooltipProps('volume')}
                          content={
                            <ChartTooltip
                              isDarkMode={isDarkMode}
                              formatValue={perMatchValue}
                              hint={clickHint}
                            />
                          }
                        />
                        <Legend {...LEGEND_PROPS} itemSorter={null} />
                        {COUNTED_ELEMENTS.map(({ label, color }) => (
                          <Line
                            key={label}
                            type="linear"
                            dataKey={label}
                            stroke={tone(color)}
                            strokeWidth={2}
                            {...dots('volume', tone(color))}
                            animationDuration={800}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                    {tapRow('volume', 'point')}
                  </div>
                </ChartCard>

                <ChartCard
                  title="Ranking Points per Match"
                  description="Average RP a match earned from scoring in each session, out of 3. A win or tie is not counted."
                  isDarkMode={isDarkMode}
                >
                  <div className="mt-auto min-w-0">
                    <ResponsiveContainer
                      width="100%"
                      height={240}
                      minWidth={MIN_CHART_WIDTH}
                    >
                      <ComposedChart
                        data={rankingPointData}
                        margin={CHART_MARGIN}
                        onClick={openSession('rp')}
                        style={chartStyle}
                        title="Ranking points per match"
                        desc="Average SWARM, POLLINATOR 1 and POLLINATOR 2 ranking points per match in each session, stacked"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={gridStroke}
                        />
                        <XAxis
                          dataKey="id"
                          tickFormatter={tickLabel}
                          ticks={dayTicks(rankingPointData, labels)}
                          {...axis}
                        />
                        <YAxis
                          width={Y_AXIS_WIDTH}
                          domain={[0, RANKING_POINT_SERIES.length]}
                          allowDecimals={false}
                          {...axis}
                        />
                        <Tooltip
                          {...tooltipProps('rp')}
                          cursor={{
                            fill: isDarkMode
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.04)',
                          }}
                          content={
                            <ChartTooltip
                              isDarkMode={isDarkMode}
                              formatValue={value =>
                                `${value.toFixed(2)} (${Math.round(value * 100)}%)`
                              }
                              formatTotal={sum => `${sum.toFixed(2)} RP`}
                              hint={clickHint}
                            />
                          }
                        />
                        {/* Listed in the order they stack, not by name */}
                        <Legend
                          {...LEGEND_PROPS}
                          itemSorter={item =>
                            RANKING_POINT_SERIES.findIndex(
                              s => s.label === item.value
                            )
                          }
                        />
                        {RANKING_POINT_SERIES.map(({ label, color }) => (
                          <Bar
                            key={label}
                            dataKey={label}
                            stackId="rp"
                            fill={tone(color)}
                            animationDuration={800}
                          />
                        ))}
                      </ComposedChart>
                    </ResponsiveContainer>
                    {tapRow('rp', 'bar')}
                  </div>
                </ChartCard>

                {cycleTimeData.length > 0 && (
                  <ChartCard
                    title="Average Cycle Time Trend"
                    description="Average, fastest and slowest time between Hive Tips in each session, in seconds"
                    isDarkMode={isDarkMode}
                  >
                    <div className="mt-auto min-w-0">
                      <ResponsiveContainer
                        width="100%"
                        height={240}
                        minWidth={MIN_CHART_WIDTH}
                      >
                        <LineChart
                          data={cycleTimeData}
                          margin={CHART_MARGIN}
                          onClick={openSession('cycle')}
                          style={chartStyle}
                          title="Time between Hive Tips per session"
                          desc="Average, fastest and slowest seconds between Hive Tips in each session"
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={gridStroke}
                          />
                          <XAxis
                            dataKey="id"
                            tickFormatter={tickLabel}
                            ticks={dayTicks(cycleTimeData, labels)}
                            {...axis}
                          />
                          <YAxis
                            width={Y_AXIS_WIDTH}
                            {...valueAxis(valuesOf(cycleTimeData, ['Slowest']))}
                            {...axis}
                          />
                          <Tooltip
                            {...tooltipProps('cycle')}
                            content={
                              <ChartTooltip
                                isDarkMode={isDarkMode}
                                formatValue={value => `${value.toFixed(1)}s`}
                                hint={clickHint}
                              />
                            }
                          />
                          <Legend {...LEGEND_PROPS} itemSorter={null} />
                          {(
                            [
                              ['Avg Cycle', CHART_COLORS.cycle, false],
                              ['Fastest', CHART_COLORS.better, true],
                              ['Slowest', CHART_COLORS.worse, true],
                            ] as const
                          ).map(([key, color, dashed]) => (
                            <Line
                              key={key}
                              type="linear"
                              dataKey={key}
                              stroke={tone(color)}
                              strokeWidth={dashed ? 2 : 3}
                              strokeDasharray={dashed ? '5 5' : undefined}
                              {...dots('cycle', tone(color))}
                              animationDuration={800}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                      {tapRow('cycle', 'point')}
                    </div>
                  </ChartCard>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Charts;
