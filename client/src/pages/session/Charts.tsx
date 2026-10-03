import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme, useSessionCore } from '@/contexts';
import { ROUTES, APP_CONFIG } from '@/constants';
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
import type { Session, Match, ChartDataPoint, ScoreBreakdown } from '@/types';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
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
  sessionDateLabels,
  plural,
  formatNumber,
  mean,
} from './lifetime';
import { Segmented } from './LifetimeControls';

type TimeRange = '7' | '30' | '90' | 'all';

/**
 * Everything a match can score points with. Together they add up to the
 * match score, so shares of the score taken from this list add up to 100%.
 * Drawn as the series under the Final Score area on Score Trends and ranked
 * for the "Biggest Scorer" insight. In the order of the score breakdown
 * (`scoreRows`), so every legend lists them the same way.
 */
const SCORE_ELEMENTS: ReadonlyArray<{
  label: string;
  color: Tone;
  points: (b: ScoreBreakdown) => number;
  /** How many were scored, for the elements that are counted */
  count?: (m: Match) => number;
}> = [
  {
    label: ELEMENT_LABELS.tipping,
    color: ELEMENT_COLORS.tipping,
    points: b => b.tipping,
    count: m => m.tipping || 0,
  },
  {
    label: ELEMENT_LABELS.garden,
    color: ELEMENT_COLORS.garden,
    points: b => b.garden,
    count: m => m.garden || 0,
  },
  {
    label: ELEMENT_LABELS.flower,
    color: ELEMENT_COLORS.flower,
    points: b => b.flower,
    count: m => m.flower || 0,
  },
  {
    label: ELEMENT_LABELS.flowerBonus,
    color: ELEMENT_COLORS.flowerBonus,
    points: b => b.flowerBonus,
  },
  {
    label: ELEMENT_LABELS.hive,
    color: ELEMENT_COLORS.hive,
    points: b => b.hive,
    count: m => m.ballsInHive || 0,
  },
  {
    label: ELEMENT_LABELS.robots,
    color: ELEMENT_COLORS.robots,
    points: b => b.leave + b.park,
  },
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

/** The order match types are offered in. */
const MATCH_TYPES = ['Full Game', 'Autonomous', 'Teleop'];

/** The type a match was run as; one saved without its own has its session's. */
const matchTypeOf = (match: Match, session: Session): string =>
  match.matchType || session.matchType || 'Full Game';

/**
 * Sessions cut down to their matches of one type, so an Autonomous-only run
 * is never averaged in with full games. A session left with none is dropped.
 */
const ofMatchType = (sessions: Session[], type: string): Session[] =>
  sessions.flatMap(session => {
    const matches = session.matches.filter(
      m => matchTypeOf(m, session) === type
    );
    return matches.length > 0 ? [{ ...session, matches, matchType: type }] : [];
  });

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

/** How many sessions the "last N" charts look back over. */
const RECENT_SESSIONS = 10;

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
 * the axis shows `tick` and the tooltip shows `full`.
 */
type SessionLabels = Map<string, { tick: string; full: string }>;

const labelSessions = (sessions: Session[]): SessionLabels => {
  const dates = sessionDateLabels(sessions);
  return new Map(
    sessions.map(session => {
      const date = dates.get(session.id) ?? '';
      return [
        session.id,
        { tick: date, full: `${date} - ${sessionTitle(session)}` },
      ];
    })
  );
};

/** Average points per match, session over session, split by element. */
const scoreTrendRows = (
  sessions: Session[],
  labels: SessionLabels
): ChartDataPoint[] =>
  sessions.map(session => {
    const breakdowns = session.matches.map(m =>
      matchBreakdown(m, session.matchType)
    );
    const avgOf = (fn: (b: ScoreBreakdown) => number) =>
      Math.round(mean(breakdowns.map(fn)) ?? 0);
    return {
      id: session.id,
      label: labels.get(session.id)?.full,
      'Final Score': avgOf(b => b.total),
      ...Object.fromEntries(
        SCORE_ELEMENTS.map(({ label, points }) => [label, avgOf(points)])
      ),
    };
  });

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

/** Session averages with a 3-session moving average, oldest first. */
const recentTrendRows = (
  sessions: Session[],
  labels: SessionLabels
): ChartDataPoint[] => {
  const recent = sessions.slice(-RECENT_SESSIONS);
  return recent.map((session, index) => ({
    id: session.id,
    label: labels.get(session.id)?.full,
    Score: sessionAverage(session),
    'Moving Avg': Math.round(
      mean(
        recent.slice(Math.max(0, index - 2), index + 1).map(sessionAverage)
      ) ?? 0
    ),
  }));
};

/**
 * Points our fouls gave the opponent per match in each of the latest Scrim
 * sessions (a Practice session has no opponent), and how many of those
 * matches had no foul at all. These points are never taken off our own
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
      const foulFree = given.filter(points => points === 0).length;
      clean += foulFree;
      total += given.length;
      return {
        id: session.id,
        label: labels.get(session.id)?.full,
        [ELEMENT_LABELS.penalties]: round1(mean(given) ?? 0),
        note: `Foul-free: ${foulFree} of ${plural(given.length, 'match', 'matches')}`,
      };
    });
  return { rows, clean, total };
};

/**
 * Ranking points per match in each session, split by the one earned: each
 * series is the share of the session's matches that earned it, so the three
 * stack up to the session's average. Only SWARM and POLLINATOR can be told
 * from a match's own scoring; a win or tie needs the opponent's score.
 */
const RANKING_POINT_SERIES = [
  { label: 'SWARM', color: RANKING_POINT_COLORS.swarm, key: 'swarm' },
  {
    label: 'POLLINATOR 1',
    color: RANKING_POINT_COLORS.pollinator1,
    key: 'pollinator1',
  },
  {
    label: 'POLLINATOR 2',
    color: RANKING_POINT_COLORS.pollinator2,
    key: 'pollinator2',
  },
] as const;

/** Points are whole or to one decimal, and always say they are points. */
const formatPoints = (value: number): string => {
  const shown = formatNumber(value);
  return `${shown} ${shown === '1' ? 'pt' : 'pts'}`;
};

/**
 * Recharts sets its own cursor inline on the chart, so a chart that can be
 * clicked says so the same way.
 */
const CLICKABLE = { cursor: 'pointer' } as const;

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

const ChartTooltip = ({
  active,
  payload,
  label,
  isDarkMode,
  formatValue = formatNumber,
  formatTotal,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    /** The chart row this entry was read from */
    payload?: ChartDataPoint;
  }>;
  label?: string;
  isDarkMode?: boolean;
  formatValue?: (value: number, name: string) => string;
  /** Adds a row that sums the series, for a stack that adds up to a figure */
  formatTotal?: (sum: number) => string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  // The axis value is only the row's key; the row carries its full label.
  const title = payload[0].payload?.label ?? label;
  const sum = payload.reduce(
    (acc, entry) => acc + (typeof entry.value === 'number' ? entry.value : 0),
    0
  );
  return (
    // Kept narrower than a phone's chart, or Recharts can't place it inside
    // and its right-hand values are cut off.
    <div
      className={`max-w-[min(20rem,calc(100vw-6rem))] p-3 sm:p-4 rounded-lg border ${isDarkMode ? 'bg-team-dark/95 border-team-blue-40 backdrop-blur-sm' : 'bg-white/95 border-gray-200 backdrop-blur-sm'} shadow-xl`}
    >
      {title && (
        <p
          className={`text-sm sm:text-base font-bold mb-2 pb-1.5 sm:mb-3 sm:pb-2 border-b [overflow-wrap:anywhere] ${isDarkMode ? 'text-white border-team-blue-40' : 'text-gray-900 border-gray-200'}`}
        >
          {title}
        </p>
      )}
      <div className="space-y-1 sm:space-y-2">
        {payload.map((entry, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span
                className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
              >
                {entry.name}:
              </span>
            </div>
            <span
              className={`shrink-0 text-xs sm:text-sm font-bold tabular-nums ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              {typeof entry.value === 'number'
                ? formatValue(entry.value, entry.name)
                : entry.value}
            </span>
          </div>
        ))}
        {formatTotal && (
          <div
            className={`flex items-center justify-between gap-4 pt-1 sm:pt-2 border-t ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
          >
            <span
              className={`text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              Total
            </span>
            <span
              className={`shrink-0 text-xs sm:text-sm font-bold tabular-nums ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              {formatTotal(sum)}
            </span>
          </div>
        )}
        {/* A line the row carries about itself, under its series */}
        {payload[0].payload?.note && (
          <p
            className={`text-xs ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            {payload[0].payload.note}
          </p>
        )}
      </div>
    </div>
  );
};

const Charts = () => {
  const { isDarkMode } = useTheme();
  const { hasActiveSession } = useSessionCore();
  const navigate = useNavigate();

  const { sessions, loading } = useLifetimeSessions();
  const { scope, setScope, inScope, choices, scopeLabel } =
    useSessionScope(sessions);
  const [timeRange, setTimeRange] = useState<TimeRange>('30');
  /** The match type asked for; null until one is, and the commonest is used */
  const [pickedType, setPickedType] = useState<string | null>(null);
  /** The session last tapped on a chart, on a screen with no hover */
  const [tapped, setTapped] = useState<{ chart: string; id: string } | null>(
    null
  );

  useEffect(() => {
    document.title = `Charts - ${APP_CONFIG.name}`;
  }, []);

  const scopedSessions = useMemo(
    () => sessions.filter(inScope),
    [sessions, inScope]
  );

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
   * session that scored 0. ofMatchType() returns a new array, so sorting it
   * leaves the `sessions` state untouched.
   */
  const scoredSessions = useMemo(
    () => ofMatchType(filteredSessions, matchType).sort(byDateAscending),
    [filteredSessions, matchType]
  );

  const labels = useMemo(() => labelSessions(scoredSessions), [scoredSessions]);

  if (loading) {
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
      <div
        className={`min-h-[100dvh] ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
      >
        <div className="max-w-[1152px] mx-auto px-4 sm:px-8 py-8">
          <Card
            className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
          >
            <CardContent className="py-12">
              <div className="text-center">
                <div className="text-team-blue text-5xl mb-4">📊</div>
                <h3
                  className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  No Data Available
                </h3>
                <p
                  className={`mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  Record some sessions to see your performance charts
                </p>
                <Button
                  onClick={() => navigate(ROUTES.ACTIVE)}
                  disabled={hasActiveSession}
                  title={
                    hasActiveSession
                      ? 'Complete or cancel the active session first'
                      : undefined
                  }
                  className={`bg-team-blue hover:bg-team-blue/90 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'text-black' : 'text-[#FEFEFE]'}`}
                >
                  Start New Session
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const scoreTrendData = scoreTrendRows(scoredSessions, labels);
  const elementVolumeTrendData = elementVolumeRows(scoredSessions, labels);
  const cycleTimeData = cycleTimeRows(scoredSessions, labels);
  const recentTrendData = recentTrendRows(scoredSessions, labels);
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
  const axisStroke = isDarkMode ? '#9ca3af' : '#6b7280';
  const gridStroke = isDarkMode ? '#2a2a2a' : '#e5e7eb';
  const cardSublabel = `text-xs mt-0.5 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`;
  const tone = (color: Tone) => toneOf(color, isDarkMode);

  /** What the page is looking at, under its title. */
  const subtitle = [
    scoredSessions.length > 0
      ? `${plural(allScores.length, `${matchType} match`, `${matchType} matches`)} · ${plural(scoredSessions.length, 'session')}`
      : 'No matches',
    RANGE_LABELS[timeRange],
    scopeLabel,
  ]
    .filter(Boolean)
    .join(' · ');

  const analysisPath = (id: string) =>
    `${ROUTES.ANALYSIS}?sessionId=${encodeURIComponent(id)}`;

  /**
   * A click on a chart opens the session under the pointer. A touch screen
   * has no hover, so there the tap keeps showing the tooltip and the session
   * is offered as a link under the chart instead.
   */
  const openSession = (chart: string) => (state: MouseHandlerDataParam) => {
    const id = String(state.activeLabel ?? '');
    if (!labels.has(id)) return;
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      navigate(analysisPath(id));
    } else {
      setTapped({ chart, id });
    }
  };

  /** The link to the session last tapped on this chart. */
  const tappedLink = (chart: string) => {
    const label = tapped?.chart === chart && labels.get(tapped.id);
    return tapped && label ? (
      <Link
        to={analysisPath(tapped.id)}
        className="mt-3 inline-flex items-center min-h-11 text-sm font-semibold text-team-blue underline underline-offset-2"
      >
        Open {label.full}
      </Link>
    ) : null;
  };

  return (
    <div
      className={`min-h-[100dvh] page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1152px] mx-auto px-2 sm:px-3 md:px-4 lg:px-8 py-4 sm:py-6 md:py-8">
        <PageHeader
          title="Performance Charts"
          subtitle={subtitle}
          actions={
            <Select
              value={timeRange}
              onValueChange={value => setTimeRange(value as TimeRange)}
            >
              <SelectTrigger
                className={`w-auto text-xs sm:text-sm px-2 h-9 sm:h-10 [@media(pointer:coarse)]:min-h-11 ${isDarkMode ? 'bg-team-dark border-team-blue-40 text-white' : 'bg-white border-gray-300'}`}
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
          }
        >
          {(typeChoices.length > 1 || choices.length > 0) && (
            <div className="flex flex-wrap gap-2">
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
            </div>
          )}
        </PageHeader>

        {scoredSessions.length === 0 ? (
          <Card
            className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
          >
            <CardContent className="py-12">
              <div className="text-center">
                <h3
                  className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  {scopedSessions.length === 0
                    ? `No sessions ${scopeLabel}`
                    : filteredSessions.length === 0
                      ? `No sessions in the last ${timeRange} days`
                      : 'No matches to chart'}
                </h3>
                <p
                  className={`mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  {scopedSessions.length === 0
                    ? `${plural(sessions.length, 'session')} under All.`
                    : filteredSessions.length === 0
                      ? outOfRangeMessage(scopedSessions)
                      : filteredSessions.length === 1
                        ? 'The only session in this range has no matches recorded.'
                        : `None of the ${filteredSessions.length} sessions in this range has a match recorded.`}
                </p>
                {scopedSessions.length === 0 ? (
                  <Button
                    onClick={() => setScope('all')}
                    className={`bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-[#FEFEFE]'}`}
                  >
                    Show all sessions
                  </Button>
                ) : (
                  timeRange !== 'all' && (
                    <Button
                      onClick={() => setTimeRange('all')}
                      className={`bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-[#FEFEFE]'}`}
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
            {scoredSessions.length >= 3 && (
              <Card
                className={`mb-6 sm:mb-8 shadow-lg ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-r from-blue-50 to-white border-blue-200'}`}
              >
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`text-base sm:text-lg font-bold mb-2 sm:mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                      >
                        Key Insights
                      </h3>
                      <div
                        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-700'}`}
                      >
                        {(() => {
                          const breakdowns = scoredSessions.flatMap(s =>
                            s.matches.map(m => matchBreakdown(m, s.matchType))
                          );
                          const avgScore =
                            mean(breakdowns.map(b => b.total)) ?? 0;

                          // Rank the scoring elements by average contribution.
                          const best = SCORE_ELEMENTS.map(
                            ({ label, points }) => ({
                              label,
                              avg: mean(breakdowns.map(points)) ?? 0,
                            })
                          ).sort((a, b) => b.avg - a.avg)[0];
                          const bestAvg = formatNumber(best.avg);

                          const { parkRate } = robotRates(
                            scoredSessions.flatMap(typedMatches)
                          );

                          const scrimFouls = scoredSessions
                            .filter(isScrim)
                            .flatMap(s =>
                              s.matches.map(
                                m => matchBreakdown(m, s.matchType).penalties
                              )
                            );
                          const avgGiven = mean(scrimFouls);

                          const rp = rankingPointTally(
                            scoredSessions.flatMap(typedMatches)
                          );

                          return (
                            <>
                              <div>
                                <span className="font-semibold text-team-blue">
                                  Biggest Scorer:
                                </span>{' '}
                                {avgScore > 0
                                  ? `${best.label} averaging ${bestAvg} ${bestAvg === '1' ? 'point' : 'points'} per match (${Math.round((best.avg / avgScore) * 100)}% of score)`
                                  : 'No points scored yet'}
                              </div>
                              <div>
                                <span className="font-semibold text-team-blue">
                                  Park:
                                </span>{' '}
                                {parkRate === null
                                  ? 'No park chances recorded'
                                  : `Parked in ${parkRate}% of park chances (up to 2 per robot per match)`}
                              </div>
                              {avgGiven !== null && (
                                <div>
                                  <span className="font-semibold text-team-blue">
                                    Points given to opponent:
                                  </span>{' '}
                                  Avg {formatNumber(avgGiven)} per Scrim match
                                  from fouls (not taken off your score)
                                </div>
                              )}
                              <div>
                                <span className="font-semibold text-team-blue">
                                  Ranking Points:
                                </span>{' '}
                                {`${rp.earned} of ${rp.possible} RP from scoring (${rp.rate}%) - SWARM in ${rp.swarm}, POLLINATOR 1 in ${rp.pollinator1} and POLLINATOR 2 in ${rp.pollinator2} of ${plural(allScores.length, 'match', 'matches')}`}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6">
              <Card
                className={`transition-all duration-300 shadow-lg ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
              >
                <CardContent className="pt-3 pb-3 px-3 sm:pt-4 sm:pb-4 sm:px-4">
                  <div className="text-center">
                    {/* Sessions of the chosen match type, as the subtitle
                        counts them. An empty one is in no type, so it is
                        only noted as left out. */}
                    <div className="text-team-blue text-2xl sm:text-3xl font-bold">
                      {scoredSessions.length}
                    </div>
                    <div className={cardSublabel}>
                      {plural(allScores.length, 'match', 'matches')}
                      {emptySessionCount > 0 &&
                        ` · ${plural(emptySessionCount, 'empty session')} not counted`}
                    </div>
                    <div
                      className={`text-xs sm:text-sm font-medium mt-1 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                    >
                      Total Sessions
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card
                className={`transition-all duration-300 shadow-lg ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
              >
                <CardContent className="pt-3 pb-3 px-3 sm:pt-4 sm:pb-4 sm:px-4">
                  <div className="text-center">
                    <div className="text-team-blue text-2xl sm:text-3xl font-bold">
                      {averageScore}
                    </div>
                    <div className={cardSublabel}>per match</div>
                    <div
                      className={`text-xs sm:text-sm font-medium mt-1 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                    >
                      Average Score
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card
                className={`transition-all duration-300 shadow-lg ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
              >
                <CardContent className="pt-3 pb-3 px-3 sm:pt-4 sm:pb-4 sm:px-4">
                  <div className="text-center">
                    <div className="text-team-blue text-2xl sm:text-3xl font-bold">
                      {bestScore}
                    </div>
                    <div className={cardSublabel}>best single match</div>
                    <div
                      className={`text-xs sm:text-sm font-medium mt-1 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                    >
                      Best Score
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card
                className={`transition-all duration-300 shadow-lg ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
              >
                <CardContent className="pt-3 pb-3 px-3 sm:pt-4 sm:pb-4 sm:px-4">
                  <div className="text-center">
                    {(() => {
                      if (scoredSessions.length < 2) {
                        return (
                          <div className="text-team-blue text-2xl sm:text-3xl font-bold">
                            —
                          </div>
                        );
                      }
                      // Both sides are per-match averages, like the card
                      // beside this one.
                      const earlierAvg = Math.round(
                        mean(
                          scoredSessions.slice(0, -1).flatMap(matchScores)
                        ) ?? 0
                      );
                      const lastScore = sessionAverage(
                        scoredSessions[scoredSessions.length - 1]
                      );
                      const diff = lastScore - earlierAvg;
                      const isPositive = diff > 0;

                      return (
                        <>
                          <div
                            className={`text-2xl sm:text-3xl font-bold ${
                              isPositive
                                ? isDarkMode
                                  ? 'text-green-500'
                                  : 'text-green-700'
                                : diff < 0
                                  ? isDarkMode
                                    ? 'text-red-500'
                                    : 'text-red-600'
                                  : 'text-team-blue'
                            }`}
                          >
                            {isPositive ? '+' : ''}
                            {diff}
                          </div>
                          <div className={cardSublabel}>
                            Last: {lastScore} · Avg: {earlierAvg}
                          </div>
                        </>
                      );
                    })()}
                    <div
                      className={`text-xs sm:text-sm font-medium mt-1 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                    >
                      Last Session vs. Avg (excluding last)
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <p
              className={`text-xs sm:text-sm mb-3 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              Select a point or bar to open its session.
            </p>

            <div className="space-y-6 sm:space-y-8">
              <Card
                className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
              >
                <CardHeader>
                  <CardTitle
                    className={`text-xl sm:text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    Score Trends Over Time
                  </CardTitle>
                  <CardDescription
                    className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    Average match score per session, and the points each scoring
                    element contributed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full overflow-x-auto">
                    <ResponsiveContainer
                      width="100%"
                      height={250}
                      minWidth={300}
                    >
                      <ComposedChart
                        data={scoreTrendData}
                        onClick={openSession('trend')}
                        style={CLICKABLE}
                      >
                        <defs>
                          <linearGradient
                            id="colorFinal"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={tone(CHART_COLORS.total)}
                              // The accent is pale in the dark themes: a
                              // fuller fill hides the lines drawn over it
                              stopOpacity={isDarkMode ? 0.35 : 0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor={tone(CHART_COLORS.total)}
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
                          stroke={axisStroke}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis stroke={axisStroke} tick={{ fontSize: 12 }} />
                        <Tooltip
                          content={
                            <ChartTooltip
                              isDarkMode={isDarkMode}
                              formatValue={formatPoints}
                            />
                          }
                          cursor={{
                            stroke: tone(CHART_COLORS.total),
                            strokeWidth: 2,
                          }}
                        />
                        {/* Listed as drawn: the score, then its parts */}
                        <Legend
                          wrapperStyle={{ fontSize: '14px' }}
                          itemSorter={null}
                        />
                        {/* The score is the heaviest line; its parts sit
                            under it */}
                        <Area
                          type="linear"
                          dataKey="Final Score"
                          stroke={tone(CHART_COLORS.total)}
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorFinal)"
                          animationDuration={1500}
                        />
                        {SCORE_ELEMENTS.map(({ label, color }) => (
                          <Line
                            key={label}
                            type="linear"
                            dataKey={label}
                            stroke={tone(color)}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            animationDuration={1500}
                          />
                        ))}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  {tappedLink('trend')}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card
                  className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${foulData.length === 0 ? 'lg:col-span-2' : ''} ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
                >
                  <CardHeader>
                    <CardTitle
                      className={`text-xl sm:text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                    >
                      Recent Performance (Last {RECENT_SESSIONS})
                    </CardTitle>
                    <CardDescription
                      className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                    >
                      Average match score per session with a 3-session moving
                      average
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full overflow-x-auto">
                      <ResponsiveContainer
                        width="100%"
                        height={220}
                        minWidth={300}
                      >
                        <ComposedChart
                          data={recentTrendData}
                          onClick={openSession('recent')}
                          style={CLICKABLE}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={gridStroke}
                          />
                          <XAxis
                            dataKey="id"
                            tickFormatter={tickLabel}
                            stroke={axisStroke}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis stroke={axisStroke} tick={{ fontSize: 12 }} />
                          <Tooltip
                            content={
                              <ChartTooltip
                                isDarkMode={isDarkMode}
                                formatValue={formatPoints}
                              />
                            }
                          />
                          <Legend
                            wrapperStyle={{ fontSize: '14px' }}
                            itemSorter={null}
                          />
                          <Bar
                            dataKey="Score"
                            fill={tone(CHART_COLORS.total)}
                            opacity={1}
                            radius={[6, 6, 0, 0]}
                            animationDuration={1000}
                            activeBar={{
                              stroke: isDarkMode ? '#fff' : '#000',
                              strokeWidth: 2,
                            }}
                          />
                          <Line
                            type="linear"
                            dataKey="Moving Avg"
                            stroke={tone(CHART_COLORS.movingAverage)}
                            strokeWidth={3}
                            dot={{
                              fill: tone(CHART_COLORS.movingAverage),
                              r: 5,
                              strokeWidth: 2,
                              stroke: '#fff',
                            }}
                            animationDuration={1200}
                            animationBegin={300}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    {tappedLink('recent')}
                  </CardContent>
                </Card>

                {foulData.length > 0 && (
                  <Card
                    className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-gray-200'}`}
                  >
                    <CardHeader>
                      <CardTitle
                        className={`text-xl sm:text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                      >
                        Points Given to Opponent Over Time
                      </CardTitle>
                      <CardDescription
                        className={`text-xs sm:text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                      >
                        Points your fouls gave the opponent per match in each
                        Scrim session (last {RECENT_SESSIONS}). Never taken off
                        your score.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* A share of matches is a different unit from points
                          per match, so it is a figure, not a second line */}
                      <p
                        className={`mb-3 text-xs sm:text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                      >
                        <span className="mr-2 text-2xl font-bold tabular-nums text-team-blue">
                          {Math.round((fouls.clean / fouls.total) * 100)}%
                        </span>
                        foul-free · {fouls.clean} of{' '}
                        {plural(fouls.total, 'Scrim match', 'Scrim matches')}
                      </p>
                      <div className="w-full overflow-x-auto">
                        <ResponsiveContainer
                          width="100%"
                          height={180}
                          minWidth={300}
                        >
                          <BarChart
                            data={foulData}
                            onClick={openSession('fouls')}
                            style={CLICKABLE}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={gridStroke}
                              vertical={false}
                            />
                            <XAxis
                              dataKey="id"
                              tickFormatter={tickLabel}
                              stroke={axisStroke}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis
                              stroke={axisStroke}
                              tick={{ fontSize: 12 }}
                              allowDecimals={false}
                              label={{
                                value: 'pts/match',
                                angle: -90,
                                position: 'insideLeft',
                                style: { fontSize: 12, fill: axisStroke },
                              }}
                            />
                            <Tooltip
                              cursor={{
                                fill: isDarkMode
                                  ? 'rgba(255,255,255,0.06)'
                                  : 'rgba(0,0,0,0.04)',
                              }}
                              content={
                                <ChartTooltip
                                  isDarkMode={isDarkMode}
                                  formatValue={value =>
                                    `${formatNumber(value)} pts/match`
                                  }
                                />
                              }
                            />
                            <Bar
                              dataKey={ELEMENT_LABELS.penalties}
                              fill={tone(ELEMENT_COLORS.penalties)}
                              radius={[4, 4, 0, 0]}
                              maxBarSize={48}
                              animationDuration={1000}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {tappedLink('fouls')}
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card
                className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
              >
                <CardHeader>
                  <CardTitle
                    className={`text-xl sm:text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    Scoring Volume Trend
                  </CardTitle>
                  <CardDescription
                    className={`text-xs sm:text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    Average count of each element scored per match
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full overflow-x-auto">
                    <ResponsiveContainer
                      width="100%"
                      height={240}
                      minWidth={300}
                    >
                      <LineChart
                        data={elementVolumeTrendData}
                        onClick={openSession('volume')}
                        style={CLICKABLE}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={gridStroke}
                        />
                        <XAxis
                          dataKey="id"
                          tickFormatter={tickLabel}
                          stroke={axisStroke}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis stroke={axisStroke} tick={{ fontSize: 12 }} />
                        <Tooltip
                          content={
                            <ChartTooltip
                              isDarkMode={isDarkMode}
                              formatValue={value =>
                                `${formatNumber(value)} per match`
                              }
                            />
                          }
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '14px' }}
                          itemSorter={null}
                        />
                        {COUNTED_ELEMENTS.map(({ label, color }) => (
                          <Line
                            key={label}
                            type="linear"
                            dataKey={label}
                            stroke={tone(color)}
                            strokeWidth={3}
                            dot={{ fill: tone(color), r: 5 }}
                            activeDot={{ r: 8 }}
                            animationDuration={1500}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {tappedLink('volume')}
                </CardContent>
              </Card>

              <Card
                className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
              >
                <CardHeader>
                  <CardTitle
                    className={`text-xl sm:text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    Ranking Points per Match
                  </CardTitle>
                  <CardDescription
                    className={`text-xs sm:text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    Average ranking points a match earned from scoring in each
                    session, out of 3: SWARM, POLLINATOR 1 and POLLINATOR 2. A
                    win or tie is not counted.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full overflow-x-auto">
                    <ResponsiveContainer
                      width="100%"
                      height={240}
                      minWidth={300}
                    >
                      <ComposedChart
                        data={rankingPointData}
                        onClick={openSession('rp')}
                        style={CLICKABLE}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={gridStroke}
                        />
                        <XAxis
                          dataKey="id"
                          tickFormatter={tickLabel}
                          stroke={axisStroke}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          stroke={axisStroke}
                          tick={{ fontSize: 12 }}
                          domain={[0, RANKING_POINT_SERIES.length]}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={
                            <ChartTooltip
                              isDarkMode={isDarkMode}
                              formatValue={value =>
                                `${value.toFixed(2)} RP (${Math.round(value * 100)}% of matches)`
                              }
                              formatTotal={sum => `${sum.toFixed(2)} RP`}
                            />
                          }
                        />
                        {/* Listed in the order they stack, not by name */}
                        <Legend
                          wrapperStyle={{ fontSize: '14px' }}
                          itemSorter={item =>
                            RANKING_POINT_SERIES.findIndex(
                              series => series.label === item.value
                            )
                          }
                        />
                        {RANKING_POINT_SERIES.map(({ label, color }) => (
                          <Bar
                            key={label}
                            dataKey={label}
                            stackId="rp"
                            fill={tone(color)}
                            animationDuration={1000}
                          />
                        ))}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  {tappedLink('rp')}
                </CardContent>
              </Card>

              {cycleTimeData.length > 0 && (
                <Card
                  className={`shadow-lg hover:shadow-2xl transition-shadow duration-300 ${isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'}`}
                >
                  <CardHeader>
                    <CardTitle
                      className={`text-xl sm:text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                    >
                      Average Cycle Time Trend
                    </CardTitle>
                    <CardDescription
                      className={`text-xs sm:text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                    >
                      Average, fastest and slowest time between Hive Tips in
                      each session (seconds)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full overflow-x-auto">
                      <ResponsiveContainer
                        width="100%"
                        height={240}
                        minWidth={300}
                      >
                        <LineChart
                          data={cycleTimeData}
                          onClick={openSession('cycle')}
                          style={CLICKABLE}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={gridStroke}
                          />
                          <XAxis
                            dataKey="id"
                            tickFormatter={tickLabel}
                            stroke={axisStroke}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            stroke={axisStroke}
                            tick={{ fontSize: 12 }}
                            label={{
                              value: 'Seconds',
                              angle: -90,
                              position: 'insideLeft',
                              style: { fontSize: 12 },
                            }}
                          />
                          <Tooltip
                            content={
                              <ChartTooltip
                                isDarkMode={isDarkMode}
                                formatValue={value => `${value.toFixed(1)}s`}
                              />
                            }
                          />
                          <Legend
                            wrapperStyle={{ fontSize: '14px' }}
                            itemSorter={null}
                          />
                          <Line
                            type="linear"
                            dataKey="Avg Cycle"
                            stroke={tone(CHART_COLORS.cycle)}
                            strokeWidth={3}
                            dot={{
                              fill: tone(CHART_COLORS.cycle),
                              r: 6,
                              strokeWidth: 2,
                              stroke: '#fff',
                            }}
                            activeDot={{ r: 8 }}
                            animationDuration={1200}
                          />
                          <Line
                            type="linear"
                            dataKey="Fastest"
                            stroke={tone(CHART_COLORS.better)}
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{
                              fill: tone(CHART_COLORS.better),
                              r: 5,
                              strokeWidth: 2,
                              stroke: '#fff',
                            }}
                            animationDuration={1200}
                            animationBegin={200}
                          />
                          <Line
                            type="linear"
                            dataKey="Slowest"
                            stroke={tone(CHART_COLORS.worse)}
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{
                              fill: tone(CHART_COLORS.worse),
                              r: 5,
                              strokeWidth: 2,
                              stroke: '#fff',
                            }}
                            animationDuration={1200}
                            animationBegin={400}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {tappedLink('cycle')}
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Charts;
