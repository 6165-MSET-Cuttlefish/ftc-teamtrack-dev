import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
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
} from '@/lib';
import type { RankingPointTally } from '@/lib';
import { getPendingDeleteIds } from '@/lib/pendingSessionDeletes';
import { ROUTES, APP_CONFIG } from '@/constants';
import type { Session, Match, ScoreBreakdown } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  useLifetimeSessions,
  byDateAscending,
  sessionTitle,
  isScrim,
  matchBreakdown,
  sessionDateLabels,
  plural,
  formatNumber,
  mean,
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
  | 'garden'
  | 'tipping'
  | 'flower'
  | 'flowerBonus'
  | 'hive'
  | 'robots';

/** The elements add up to the total; each means the same in the tables. */
const ELEMENT_LABELS: Record<ScoreElement, string> = {
  total: 'Total',
  garden: 'Garden',
  tipping: 'Tips',
  flower: 'Flower',
  flowerBonus: 'Bonus',
  hive: 'Hive',
  robots: 'Leave + Park',
};

const ELEMENTS = Object.keys(ELEMENT_LABELS) as ScoreElement[];

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
 * value itself is only the point's unique key.
 */
const twoLineTick =
  (lines: Map<string, readonly [string, string]>, fill: string) =>
  ({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
    const [top, bottom] = lines.get(payload.value) ?? ['', ''];
    return (
      <text x={x} y={y} textAnchor="middle" fill={fill} fontSize={11}>
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
 * under their points instead of being dropped at the chart's edge.
 */
const twoLineAxis = {
  interval: 'preserveStartEnd',
  padding: { left: 44, right: 44 },
} as const;

/** The wider of a tick's two lines, which is what its spacing is based on. */
const widerLine = (
  lines: Map<string, readonly [string, string]>,
  key: string
) => [...(lines.get(key) ?? [''])].sort((a, b) => b.length - a.length)[0];

interface RowOptions {
  indent?: boolean;
  higherIsBetter?: boolean;
  format?: (v: number) => string;
  highlight?: boolean;
}

const Compare = () => {
  const { isGuest } = useAuth();
  const { isDarkMode } = useTheme();
  const { team } = useTeam();
  const [searchParams] = useSearchParams();

  const { sessions: listedSessions, loading } = useLifetimeSessions();
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

  /** Every session that can be picked: the list, then any linked extras. */
  const sessions = useMemo(
    () => [
      ...listedSessions,
      ...linkedSessions.filter(
        linked => !listedSessions.some(s => s.id === linked.id)
      ),
    ],
    [listedSessions, linkedSessions]
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

  /** Best / worst colouring among the cells that actually hold a value. */
  const getCellColor = (
    value: number | null,
    values: Array<number | null>,
    higherIsBetter = true
  ): string => {
    const known = values.filter(
      (v): v is number => v !== null && Number.isFinite(v)
    );
    if (value === null || !Number.isFinite(value) || known.length < 2) {
      return '';
    }
    const max = Math.max(...known);
    const min = Math.min(...known);
    if (max === min) return '';
    if (value === (higherIsBetter ? max : min)) return goodTone;
    if (value === (higherIsBetter ? min : max)) return badTone;
    return '';
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
    } = opts;
    const values = columns.map(getValue);
    const show = (v: number | null) => (v === null ? 'N/A' : format(v));
    const avg = mean(values.filter((v): v is number => v !== null));
    return (
      <tr
        className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
      >
        <td
          className={`py-3 px-4 text-sm ${indent ? 'pl-8' : ''} ${
            indent
              ? isDarkMode
                ? 'text-team-white-60'
                : 'text-gray-600'
              : isDarkMode
                ? 'text-white'
                : 'text-gray-900'
          }`}
        >
          {indent ? `↳ ${label}` : label}
        </td>
        {columns.map((column, i) => (
          <td
            key={keyOf(column)}
            className={`text-right py-3 px-4 text-sm ${highlight ? 'font-bold text-lg' : 'font-medium'} ${
              getCellColor(values[i], values, higherIsBetter) ||
              (highlight && values[i] !== null
                ? 'text-team-blue'
                : isDarkMode
                  ? 'text-white'
                  : 'text-gray-900')
            }`}
          >
            {show(values[i])}
          </td>
        ))}
        {showAvg && (
          <td
            className={`text-right py-3 px-4 text-sm font-semibold ${isDarkMode ? 'text-team-blue' : 'text-team-blue'}`}
          >
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
      opts
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

  /** Session charts: name over date on the axis, both in the tooltip. */
  const sessionTicks = new Map(
    selectedSessionsData.map(session => [
      session.id,
      [
        shorten(sessionTitle(session)),
        dateLabels.get(session.id) ?? '',
      ] as const,
    ])
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
        className={`min-h-[100dvh] flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-blue"></div>
          <p className="text-sm text-team-blue">Loading sessions...</p>
        </div>
      </div>
    );
  }

  const cardClass = isDarkMode
    ? 'border-transparent bg-white/[0.035]'
    : 'border-transparent bg-gray-100/80';
  const mutedText = isDarkMode ? 'text-team-white-60' : 'text-gray-500';
  const elementButtonClass = (active: boolean) =>
    `px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
      active
        ? `bg-team-blue border-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`
        : isDarkMode
          ? 'bg-team-dark border-team-blue-40 text-team-white-60 hover:border-team-blue hover:text-white'
          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900'
    }`;

  return (
    <div
      className={`min-h-[100dvh] ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}
    >
      <div className="max-w-[1152px] mx-auto px-4 sm:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold mb-2">
            Comparison
          </h1>
          <div className="mb-6" />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setComparisonMode('sessions')}
              className={`px-6 py-2.5 rounded-lg text-base font-semibold transition-all ${
                comparisonMode === 'sessions'
                  ? `bg-team-blue shadow-md ${isDarkMode ? 'text-black' : 'text-white'}`
                  : `${isDarkMode ? 'bg-team-dark-20 border border-team-blue-40 text-team-white-60 hover:text-white hover:border-team-blue' : 'bg-gray-100 border border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400'}`
              }`}
            >
              Compare Sessions
            </button>
            <button
              onClick={() => setComparisonMode('matches')}
              className={`px-6 py-2.5 rounded-lg text-base font-semibold transition-all ${
                comparisonMode === 'matches'
                  ? `bg-team-blue shadow-md ${isDarkMode ? 'text-black' : 'text-white'}`
                  : `${isDarkMode ? 'bg-team-dark-20 border border-team-blue-40 text-team-white-60 hover:text-white hover:border-team-blue' : 'bg-gray-100 border border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400'}`
              }`}
              disabled={selectedSessionsData.length === 0}
            >
              Compare Matches ({allMatches.length})
            </button>
          </div>
        </div>

        <div className="mb-6">
          {sessions.length === 0 ? (
            <div
              className={`text-center py-12 rounded-xl border ${isDarkMode ? 'border-transparent bg-white/[0.035]' : 'border-transparent bg-gray-100/80'}`}
            >
              <p
                className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
              >
                No sessions available
              </p>
              <p
                className={`text-sm mb-4 ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}
              >
                Complete some practice sessions first, then come back to compare
                them.
              </p>
              <Link
                to={ROUTES.ACTIVE}
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-team-blue text-sm font-medium hover:bg-team-blue/90 transition-colors ${isDarkMode ? 'text-black' : 'text-white'}`}
              >
                Start New Session
              </Link>
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
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isSelected
                        ? `bg-team-blue border-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`
                        : isDarkMode
                          ? 'bg-team-dark-20 border-team-blue-40 text-team-white-60 enabled:hover:border-team-blue enabled:hover:text-white'
                          : 'bg-white border-gray-200 text-gray-700 enabled:hover:border-gray-400 enabled:hover:text-gray-900'
                    }`}
                  >
                    <span className="max-w-[140px] truncate">
                      {sessionTitle(session)}
                    </span>
                    <span
                      className={`shrink-0 ${
                        isSelected
                          ? isDarkMode
                            ? 'text-black/70'
                            : 'text-white'
                          : isDarkMode
                            ? 'text-team-white-60/60'
                            : 'text-gray-500'
                      }`}
                    >
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
          <Card className={cardClass}>
            <CardContent className="py-12">
              <div className="text-center">
                <BarChart3 size={40} className="mx-auto mb-4 text-team-blue" aria-hidden />
                <h3
                  className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  Select sessions
                </h3>
                <p
                  className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  Pick sessions above
                </p>
              </div>
            </CardContent>
          </Card>
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
                    Per match, oldest session first
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
                        {ELEMENT_LABELS[element]}
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
                              {...twoLineAxis}
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
                              formatter={v => formatNumber(Number(v))}
                            />
                            <Line
                              dataKey="score"
                              name={`Avg ${ELEMENT_LABELS[scoreChartPhase]} Points`}
                              stroke="#3b82f6"
                              strokeWidth={2.5}
                              dot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }}
                              activeDot={{ r: 7 }}
                              type="monotone"
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
                    Seconds between tips, oldest session first. Lower is faster
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
                              {...twoLineAxis}
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
                              stroke="#10b981"
                              strokeWidth={2.5}
                              dot={{ r: 5, fill: '#10b981', strokeWidth: 0 }}
                              activeDot={{ r: 7 }}
                              type="monotone"
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
                        >
                          <th
                            className={`text-left py-3 px-4 text-sm font-semibold ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                          >
                            Metric
                          </th>
                          {selectedSessionsData.map(session => (
                            <th
                              key={session.id}
                              className={`text-right py-3 px-4 text-sm font-semibold ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                            >
                              {/* Capped so one long unspaced name can't stretch the table */}
                              <div className="ml-auto max-w-[9rem] sm:max-w-[16rem] break-words">
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
                          { highlight: true }
                        )}
                        {renderSessionRow('Avg Garden Points', s =>
                          avgPoints(s, b => b.garden)
                        )}
                        {renderSessionRow(
                          'Avg Garden Scored',
                          s => avgCount(s, m => m.garden || 0),
                          { indent: true, format: formatNumber }
                        )}
                        {renderSessionRow('Avg Tips Points', s =>
                          avgPoints(s, b => b.tipping)
                        )}
                        {renderSessionRow(
                          'Avg Tips Scored',
                          s => avgCount(s, m => m.tipping || 0),
                          { indent: true, format: formatNumber }
                        )}
                        {renderSessionRow('Avg Flower Points', s =>
                          avgPoints(s, b => b.flower)
                        )}
                        {renderSessionRow(
                          'Avg Flower Scored',
                          s => avgCount(s, m => m.flower || 0),
                          { indent: true, format: formatNumber }
                        )}
                        {renderSessionRow('Avg Bonus Points', s =>
                          avgPoints(s, b => b.flowerBonus)
                        )}
                        {renderSessionRow('Avg Left in Hive Points', s =>
                          avgPoints(s, b => b.hive)
                        )}
                        {renderSessionRow(
                          'Avg Hive (up CELL)',
                          s => avgCount(s, m => m.ballsInHive || 0),
                          { indent: true, format: formatNumber }
                        )}
                        {renderSessionRow('Avg Leave + Park Points', s =>
                          avgPoints(s, b => b.leave + b.park)
                        )}
                        {renderSessionRow(
                          'Park Rate',
                          s => sessionRate(s, 'parkRate'),
                          { indent: true, format: formatRate }
                        )}
                        <tr
                          className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                        >
                          <td
                            className={`py-3 px-4 pl-8 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                          >
                            ↳ Matches with a Park
                          </td>
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
                                className={`text-right py-3 px-4 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
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
                            { higherIsBetter: false, format: formatNumber }
                          )}
                        {renderSessionRow('Avg Cycle Time', sessionCycleTime, {
                          higherIsBetter: false,
                          format: formatSeconds,
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
                          { format: formatNumber }
                        )}
                        {renderSessionRow(
                          'Matches with SWARM',
                          s => rankingPointShare(s, 'swarm'),
                          { indent: true, format: formatRate }
                        )}
                        {renderSessionRow(
                          'Matches with POLLINATOR 1',
                          s => rankingPointShare(s, 'pollinator1'),
                          { indent: true, format: formatRate }
                        )}
                        {renderSessionRow(
                          'Matches with POLLINATOR 2',
                          s => rankingPointShare(s, 'pollinator2'),
                          { indent: true, format: formatRate }
                        )}
                        <tr>
                          <td
                            className={`py-3 px-4 text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                          >
                            Match Type
                          </td>
                          {selectedSessionsData.map(session => (
                            <td
                              key={session.id}
                              className={`text-right py-3 px-4 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
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
                            title={`Garden ${match.garden || 0} · Tips ${match.tipping || 0} · Flower ${match.flower || 0} · Hive ${match.ballsInHive || 0}`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              isChecked
                                ? `bg-team-blue border-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`
                                : isDarkMode
                                  ? 'bg-team-dark-20 border-team-blue-40 text-team-white-60 hover:border-team-blue hover:text-white'
                                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400 hover:text-gray-900'
                            }`}
                          >
                            <span>Match #{match.matchNumber}</span>
                            <span
                              className={`shrink-0 ${
                                isChecked
                                  ? isDarkMode
                                    ? 'text-black/70'
                                    : 'text-white'
                                  : isDarkMode
                                    ? 'text-team-white-60/60'
                                    : 'text-gray-500'
                              }`}
                            >
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

            {matchColumns.length > 0 && (
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
                      <span>Score Trend by Match</span>
                      <ChevronDown
                        className={`w-5 h-5 transition-transform duration-200 ${isMatchScoreChartOpen ? 'rotate-180' : ''}`}
                      />
                    </CardTitle>
                  </CardHeader>
                  {isMatchScoreChartOpen && (
                    <CardContent>
                      <p className={`text-xs mb-4 ${mutedText}`}>
                        Points from the chosen element for each selected match.
                        Switch element to compare.
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
                            {ELEMENT_LABELS[element]}
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
                                  dataKey="key"
                                  height={44}
                                  {...twoLineAxis}
                                  tick={twoLineTick(matchTicks, tickFill)}
                                  tickFormatter={key =>
                                    widerLine(matchTicks, key)
                                  }
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
                                />
                                <Line
                                  dataKey="score"
                                  name={`${ELEMENT_LABELS[matchScoreChartPhase]} Points`}
                                  stroke="#3b82f6"
                                  strokeWidth={2.5}
                                  dot={{
                                    r: 5,
                                    fill: '#3b82f6',
                                    strokeWidth: 0,
                                  }}
                                  activeDot={{ r: 7 }}
                                  type="monotone"
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
                          const sessionColors = [
                            '#3b82f6',
                            '#10b981',
                            '#f59e0b',
                            '#ef4444',
                            '#8b5cf6',
                          ];
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
                                        sessionColors[
                                          idx % sessionColors.length
                                        ]
                                      }
                                      strokeWidth={2.5}
                                      dot={{
                                        r: 4,
                                        fill: sessionColors[
                                          idx % sessionColors.length
                                        ],
                                        strokeWidth: 0,
                                      }}
                                      activeDot={{ r: 6 }}
                                      type="monotone"
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
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr
                              className={`border-b ${isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}`}
                            >
                              <th
                                className={`text-left py-3 px-4 text-sm font-semibold ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                              >
                                Metric
                              </th>
                              {/* Same list, same order as every row below */}
                              {matchColumns.map(match => (
                                <th
                                  key={match.key}
                                  className={`text-right py-3 px-4 text-sm font-semibold ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                                >
                                  <div
                                    className={`ml-auto max-w-[9rem] sm:max-w-[16rem] break-words text-xs font-normal mb-0.5 ${mutedText}`}
                                  >
                                    {match.sessionName} · {match.sessionDate}
                                  </div>
                                  Match #{match.matchNumber}
                                </th>
                              ))}
                              {matchColumns.length > 1 && (
                                <th
                                  className={`text-right py-3 px-4 text-sm font-semibold ${isDarkMode ? 'text-team-blue' : 'text-team-blue'}`}
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
                              'Garden Points',
                              m => m.breakdown.garden
                            )}
                            {renderMatchRow(
                              'Garden Scored',
                              m => m.garden || 0,
                              { indent: true, format: formatNumber }
                            )}
                            {renderMatchRow(
                              'Tips Points',
                              m => m.breakdown.tipping
                            )}
                            {renderMatchRow(
                              'Tips Scored',
                              m => m.tipping || 0,
                              { indent: true, format: formatNumber }
                            )}
                            {renderMatchRow(
                              'Flower Points',
                              m => m.breakdown.flower
                            )}
                            {renderMatchRow(
                              'Flower Scored',
                              m => m.flower || 0,
                              { indent: true, format: formatNumber }
                            )}
                            {renderMatchRow(
                              'Bonus Points',
                              m => m.breakdown.flowerBonus
                            )}
                            {renderMatchRow(
                              'Left in Hive Points',
                              m => m.breakdown.hive
                            )}
                            {renderMatchRow(
                              'Hive (up CELL)',
                              m => m.ballsInHive || 0,
                              { indent: true, format: formatNumber }
                            )}
                            {renderMatchRow(
                              'Leave Points',
                              m => m.breakdown.leave
                            )}
                            {renderMatchRow(
                              'Park Points',
                              m => m.breakdown.park
                            )}
                            <tr
                              className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                            >
                              <td
                                className={`py-3 px-4 pl-8 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                              >
                                ↳ Robot 1 Park
                              </td>
                              {matchColumns.map(match => (
                                <td
                                  key={match.key}
                                  className={`text-right py-3 px-4 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                                >
                                  {parksOf(match, 1)}
                                </td>
                              ))}
                              {matchColumns.length > 1 && (
                                <td className="px-4 py-3" />
                              )}
                            </tr>
                            <tr
                              className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                            >
                              <td
                                className={`py-3 px-4 pl-8 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                              >
                                ↳ Robot 2 Park
                              </td>
                              {matchColumns.map(match => (
                                <td
                                  key={match.key}
                                  className={`text-right py-3 px-4 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                                >
                                  {parksOf(match, 2)}
                                </td>
                              ))}
                              {matchColumns.length > 1 && (
                                <td className="px-4 py-3" />
                              )}
                            </tr>
                            {/* Scrim matches only; never part of the score */}
                            {anyScrimMatch &&
                              renderMatchRow(
                                'Points Given to Opponent',
                                m => (m.scrim ? m.breakdown.penalties : null),
                                { higherIsBetter: false, format: formatNumber }
                              )}
                            {renderMatchRow(
                              'Avg Cycle Time',
                              m => mean(cycleTimesOf(m)),
                              { higherIsBetter: false, format: formatSeconds }
                            )}
                            {renderMatchRow(
                              'Ranking Points',
                              m => rankingPoints(m).total,
                              { format: formatNumber }
                            )}
                            {earnedInColumns && (
                              <tr className="hidden md:table-row">
                                <td
                                  className={`py-3 px-4 pl-8 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                                >
                                  ↳ Earned
                                </td>
                                {matchColumns.map(match => (
                                  <td
                                    key={match.key}
                                    className={`text-right py-3 px-4 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                                  >
                                    {earnedOf(match)}
                                  </td>
                                ))}
                                {matchColumns.length > 1 && (
                                  <td className="px-4 py-3" />
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
