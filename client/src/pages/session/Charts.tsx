import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme, useSessionCore } from '@/contexts';
import { ROUTES, APP_CONFIG } from '@/constants';
import {
  toDate,
  matchScore,
  cycleTimesOf,
  robotRates,
  rankingPointTally,
} from '@/lib';
import type { Session, Match, ChartDataPoint, ScoreBreakdown } from '@/types';
import { Button } from '@/components/ui/button';
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
  ComposedChart,
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

type TimeRange = '7' | '30' | '90' | 'all';

/**
 * Everything a match can score points with. Together they add up to the
 * match score, so shares of the score taken from this list add up to 100%.
 * Drawn as the series under the Final Score area on Score Trends and ranked
 * for the "Biggest Scorer" insight.
 */
const SCORE_ELEMENTS: ReadonlyArray<{
  label: string;
  color: string;
  points: (b: ScoreBreakdown) => number;
}> = [
  { label: 'Garden', color: '#10b981', points: b => b.garden },
  { label: 'Tipping', color: '#f59e0b', points: b => b.tipping },
  { label: 'Flower', color: '#a855f7', points: b => b.flower },
  { label: 'Flower Bonus', color: '#ec4899', points: b => b.flowerBonus },
  { label: 'Left in Hive (up CELL)', color: '#0ea5e9', points: b => b.hive },
  { label: 'Leave + Park', color: '#14b8a6', points: b => b.leave + b.park },
];

const COLORS = {
  primary: '#537788',
  secondary: '#B0E5FE',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
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
  sessions.map(session => {
    const avgCount = (fn: (m: Match) => number) =>
      round1(mean(session.matches.map(fn)) ?? 0);
    return {
      id: session.id,
      label: labels.get(session.id)?.full,
      Garden: avgCount(m => m.garden || 0),
      Tipping: avgCount(m => m.tipping || 0),
      Flower: avgCount(m => m.flower || 0),
      'Left in Hive': avgCount(m => m.ballsInHive || 0),
    };
  });

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

/** `#1` is the most recent session, as the "Last 10" charts number them. */
const recentName = (index: number, count: number): string =>
  `#${count - index}`;

/** Session averages with a 3-session moving average, oldest first. */
const recentTrendRows = (
  sessions: Session[],
  labels: SessionLabels
): ChartDataPoint[] => {
  const recent = sessions.slice(-RECENT_SESSIONS);
  return recent.map((session, index) => ({
    name: recentName(index, recent.length),
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
 * Points our fouls gave the opponent per match, alongside the share of
 * matches without a foul. Scrim sessions only: a Practice session has no
 * opponent. These points are never taken off our own score.
 */
const foulRows = (
  sessions: Session[],
  labels: SessionLabels
): ChartDataPoint[] => {
  const recent = sessions.filter(isScrim).slice(-RECENT_SESSIONS);
  return recent.map((session, index) => {
    const given = session.matches.map(
      m => matchBreakdown(m, session.matchType).penalties
    );
    return {
      name: recentName(index, recent.length),
      label: labels.get(session.id)?.full,
      'Given to Opponent': round1(mean(given) ?? 0),
      'Foul-Free Matches': Math.round(
        (given.filter(points => points === 0).length / given.length) * 100
      ),
    };
  });
};

/**
 * Ranking points per match in each session, split by the one earned: each
 * series is the share of the session's matches that earned it, so the three
 * stack up to the session's average. Only SWARM and POLLINATOR can be told
 * from a match's own scoring; a win or tie needs the opponent's score.
 */
const RANKING_POINT_SERIES = [
  { label: 'SWARM', color: COLORS.success, key: 'swarm' },
  { label: 'POLLINATOR 1', color: COLORS.warning, key: 'pollinator1' },
  { label: 'POLLINATOR 2', color: COLORS.purple, key: 'pollinator2' },
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

const ChartTooltip = ({
  active,
  payload,
  label,
  isDarkMode,
  formatValue = formatNumber,
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
}) => {
  if (!active || !payload || payload.length === 0) return null;
  // The axis value is only the row's key; the row carries its full label.
  const title = payload[0].payload?.label ?? label;
  return (
    <div
      className={`p-4 rounded-lg border ${isDarkMode ? 'bg-team-dark/95 border-team-blue-40 backdrop-blur-sm' : 'bg-white/95 border-gray-200 backdrop-blur-sm'} shadow-xl`}
    >
      {title && (
        <p
          className={`font-bold mb-3 pb-2 border-b ${isDarkMode ? 'text-white border-team-blue-40' : 'text-gray-900 border-gray-200'}`}
        >
          {title}
        </p>
      )}
      <div className="space-y-2">
        {payload.map((entry, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span
                className={`text-sm font-medium ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
              >
                {entry.name}:
              </span>
            </div>
            <span
              className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              style={{ color: entry.color }}
            >
              {typeof entry.value === 'number'
                ? formatValue(entry.value, entry.name)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Charts = () => {
  const { isDarkMode } = useTheme();
  const { hasActiveSession } = useSessionCore();
  const navigate = useNavigate();

  const { sessions, loading } = useLifetimeSessions();
  const [timeRange, setTimeRange] = useState<TimeRange>('30');

  useEffect(() => {
    document.title = `Charts - ${APP_CONFIG.name}`;
  }, []);

  const filteredSessions = useMemo((): Session[] => {
    if (timeRange === 'all') return sessions;

    const days = parseInt(timeRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return sessions.filter(
      session => !isUndated(session) && toDate(session.createdAt) >= cutoffDate
    );
  }, [sessions, timeRange]);

  /**
   * The sessions every figure and chart is built from: those with at least
   * one match, oldest first. A session with no matches has no score, so it
   * must not count as a session that scored 0. filter() returns a new array,
   * so sorting it leaves the `sessions` state untouched.
   */
  const scoredSessions = useMemo(
    () =>
      filteredSessions.filter(s => s.matches.length > 0).sort(byDateAscending),
    [filteredSessions]
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
  const foulData = foulRows(scoredSessions, labels);
  const rankingPointData = rankingPointRows(scoredSessions, labels);

  // Match-level figures, the same ones Analysis shows for a single session.
  const allScores = scoredSessions.flatMap(matchScores);
  const averageScore = Math.round(mean(allScores) ?? 0);
  const bestScore = Math.max(0, ...allScores);
  const emptySessionCount = filteredSessions.length - scoredSessions.length;

  const tickLabel = (id: string) => labels.get(id)?.tick ?? '';
  const axisStroke = isDarkMode ? '#9ca3af' : '#6b7280';
  const gridStroke = isDarkMode ? '#2a2a2a' : '#e5e7eb';
  const cardSublabel = `text-xs mt-0.5 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`;

  return (
    <div
      className={`min-h-[100dvh] page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      <div className="max-w-[1152px] mx-auto px-2 sm:px-3 md:px-4 lg:px-8 py-4 sm:py-6 md:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-team-blue text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-1 sm:mb-2">
                Performance Charts
              </h1>
            </div>
            <div className="flex gap-2 sm:gap-3 flex-shrink-0">
              <Select
                value={timeRange}
                onValueChange={value => setTimeRange(value as TimeRange)}
              >
                <SelectTrigger
                  className={`w-auto text-xs sm:text-sm px-2 h-9 sm:h-10 ${isDarkMode ? 'bg-team-dark border-team-blue-40 text-white' : 'bg-white border-gray-300'}`}
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
          </div>
        </div>

        {scoredSessions.length === 0 ? (
          <Card
            className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
          >
            <CardContent className="py-12">
              <div className="text-center">
                <h3
                  className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  {filteredSessions.length === 0
                    ? `No sessions in the last ${timeRange} days`
                    : 'No matches to chart'}
                </h3>
                <p
                  className={`mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  {filteredSessions.length === 0
                    ? outOfRangeMessage(sessions)
                    : filteredSessions.length === 1
                      ? 'The only session in this range has no matches recorded.'
                      : `None of the ${filteredSessions.length} sessions in this range has a match recorded.`}
                </p>
                {timeRange !== 'all' && (
                  <Button
                    onClick={() => setTimeRange('all')}
                    className={`bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-[#FEFEFE]'}`}
                  >
                    Show all time
                  </Button>
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
                    <div className="text-team-blue text-2xl sm:text-3xl font-bold">
                      {filteredSessions.length}
                    </div>
                    <div className={cardSublabel}>
                      {plural(allScores.length, 'match', 'matches')}
                      {emptySessionCount > 0 &&
                        ` · ${emptySessionCount} with no matches`}
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
                      <ComposedChart data={scoreTrendData}>
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
                              stopColor={COLORS.primary}
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor={COLORS.primary}
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
                          content={<ChartTooltip isDarkMode={isDarkMode} />}
                          cursor={{ stroke: COLORS.primary, strokeWidth: 2 }}
                        />
                        <Legend wrapperStyle={{ fontSize: '14px' }} />
                        <Area
                          type="monotone"
                          dataKey="Final Score"
                          stroke={COLORS.primary}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorFinal)"
                          animationDuration={1500}
                        />
                        {SCORE_ELEMENTS.map(({ label, color }) => (
                          <Line
                            key={label}
                            type="monotone"
                            dataKey={label}
                            stroke={color}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            animationDuration={1500}
                          />
                        ))}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
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
                      average (#1 is the most recent)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full overflow-x-auto">
                      <ResponsiveContainer
                        width="100%"
                        height={220}
                        minWidth={300}
                      >
                        <ComposedChart data={recentTrendData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={gridStroke}
                          />
                          <XAxis
                            dataKey="name"
                            stroke={axisStroke}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis stroke={axisStroke} tick={{ fontSize: 12 }} />
                          <Tooltip
                            content={<ChartTooltip isDarkMode={isDarkMode} />}
                          />
                          <Legend wrapperStyle={{ fontSize: '14px' }} />
                          <Bar
                            dataKey="Score"
                            fill={COLORS.primary}
                            opacity={1}
                            radius={[6, 6, 0, 0]}
                            animationDuration={1000}
                            activeBar={{
                              stroke: isDarkMode ? '#fff' : '#000',
                              strokeWidth: 2,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="Moving Avg"
                            stroke={COLORS.success}
                            strokeWidth={3}
                            dot={{
                              fill: COLORS.success,
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
                        Points your fouls gave the opponent per match, and the
                        share of foul-free matches (last {RECENT_SESSIONS} Scrim
                        sessions). Never taken off your score.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="w-full overflow-x-auto">
                        <ResponsiveContainer
                          width="100%"
                          height={220}
                          minWidth={300}
                        >
                          <LineChart data={foulData}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={gridStroke}
                            />
                            <XAxis
                              dataKey="name"
                              stroke={axisStroke}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis
                              stroke={axisStroke}
                              tick={{ fontSize: 12 }}
                              domain={[
                                0,
                                (dataMax: number) => Math.max(100, dataMax),
                              ]}
                            />
                            <Tooltip
                              content={
                                <ChartTooltip
                                  isDarkMode={isDarkMode}
                                  formatValue={(value, name) =>
                                    name === 'Foul-Free Matches'
                                      ? `${formatNumber(value)}%`
                                      : formatNumber(value)
                                  }
                                />
                              }
                            />
                            <Legend wrapperStyle={{ fontSize: '14px' }} />
                            <Line
                              type="monotone"
                              dataKey="Foul-Free Matches"
                              name="Foul-Free Matches"
                              unit="%"
                              stroke={COLORS.success}
                              strokeWidth={3}
                              dot={{
                                fill: COLORS.success,
                                r: 5,
                                strokeWidth: 2,
                                stroke: '#fff',
                              }}
                              animationDuration={1200}
                            />
                            <Line
                              type="monotone"
                              dataKey="Given to Opponent"
                              stroke={COLORS.danger}
                              strokeWidth={3}
                              dot={{
                                fill: COLORS.danger,
                                r: 5,
                                strokeWidth: 2,
                                stroke: '#fff',
                              }}
                              animationDuration={1200}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
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
                      <LineChart data={elementVolumeTrendData}>
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
                          content={<ChartTooltip isDarkMode={isDarkMode} />}
                        />
                        <Legend wrapperStyle={{ fontSize: '14px' }} />
                        <Line
                          type="monotone"
                          dataKey="Garden"
                          stroke={COLORS.success}
                          strokeWidth={3}
                          dot={{ fill: COLORS.success, r: 5 }}
                          activeDot={{ r: 8 }}
                          animationDuration={1500}
                        />
                        <Line
                          type="monotone"
                          dataKey="Tipping"
                          stroke={COLORS.warning}
                          strokeWidth={3}
                          dot={{ fill: COLORS.warning, r: 5 }}
                          activeDot={{ r: 8 }}
                          animationDuration={1500}
                        />
                        <Line
                          type="monotone"
                          dataKey="Flower"
                          stroke={COLORS.purple}
                          strokeWidth={3}
                          dot={{ fill: COLORS.purple, r: 5 }}
                          activeDot={{ r: 8 }}
                          animationDuration={1500}
                        />
                        <Line
                          type="monotone"
                          dataKey="Left in Hive"
                          name="Left in Hive (up CELL)"
                          stroke={COLORS.secondary}
                          strokeWidth={3}
                          dot={{ fill: COLORS.secondary, r: 5 }}
                          activeDot={{ r: 8 }}
                          animationDuration={1500}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
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
                      <ComposedChart data={rankingPointData}>
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
                            fill={color}
                            animationDuration={1000}
                          />
                        ))}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
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
                        <LineChart data={cycleTimeData}>
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
                          <Legend wrapperStyle={{ fontSize: '14px' }} />
                          <Line
                            type="monotone"
                            dataKey="Avg Cycle"
                            stroke={COLORS.primary}
                            strokeWidth={3}
                            dot={{
                              fill: COLORS.primary,
                              r: 6,
                              strokeWidth: 2,
                              stroke: '#fff',
                            }}
                            activeDot={{ r: 8 }}
                            animationDuration={1200}
                          />
                          <Line
                            type="monotone"
                            dataKey="Fastest"
                            stroke={COLORS.success}
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{
                              fill: COLORS.success,
                              r: 5,
                              strokeWidth: 2,
                              stroke: '#fff',
                            }}
                            animationDuration={1200}
                            animationBegin={200}
                          />
                          <Line
                            type="monotone"
                            dataKey="Slowest"
                            stroke={COLORS.danger}
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{
                              fill: COLORS.danger,
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
