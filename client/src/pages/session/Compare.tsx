import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Navigate, Link } from 'react-router-dom';
import { useAuth, useTheme, useTeam } from '@/contexts';
import { firebaseService } from '@/services';
import {
  formatDate,
  isAbortError,
  calculateScore,
  cycleTimesOf,
} from '@/lib';
import { ROUTES, APP_CONFIG } from '@/constants';
import type { Session, Match } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';
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

interface CompareMatch extends Match {
  sessionId: string;
  sessionName: string;
  sessionIndex: number;
}

/** Which slice of a match score the comparison charts plot. */
type ScoreElement = 'total' | 'garden' | 'tipping' | 'flower' | 'hive';

const ELEMENT_LABELS: Record<ScoreElement, string> = {
  total: 'Total',
  garden: 'Garden',
  tipping: 'Tipping',
  flower: 'Flower',
  hive: 'Balls in Hive',
};

const ELEMENTS = Object.keys(ELEMENT_LABELS) as ScoreElement[];

/** Points a match contributed for one element (or its full score). */
const elementPoints = (match: Match, element: ScoreElement): number => {
  const b = calculateScore(match);
  switch (element) {
    case 'garden':
      return b.garden;
    case 'tipping':
      return b.tipping;
    case 'flower':
      return b.flower;
    case 'hive':
      return b.hive;
    default:
      return b.total;
  }
};

const Compare = () => {
  const { user, isGuest } = useAuth();
  const { isDarkMode } = useTheme();
  const { team } = useTeam();
  const [searchParams] = useSearchParams();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [selectedSessionsData, setSelectedSessionsData] = useState<Session[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [isDetailedBreakdownOpen, setIsDetailedBreakdownOpen] = useState(true);
  const [isMatchBreakdownOpen, setIsMatchBreakdownOpen] = useState(true);
  const [scoreChartPhase, setScoreChartPhase] = useState<ScoreElement>('total');
  const [isScoreChartOpen, setIsScoreChartOpen] = useState(true);
  const [isCycleChartOpen, setIsCycleChartOpen] = useState(true);
  const [matchScoreChartPhase, setMatchScoreChartPhase] = useState<ScoreElement>('total');
  const [isMatchScoreChartOpen, setIsMatchScoreChartOpen] = useState(true);
  const [isMatchCycleChartOpen, setIsMatchCycleChartOpen] = useState(true);

  const [comparisonMode, setComparisonMode] = useState<'sessions' | 'matches'>(
    'sessions'
  );
  const [allMatches, setAllMatches] = useState<CompareMatch[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<CompareMatch[]>([]);

  useEffect(() => {
    document.title = `Compare - ${APP_CONFIG.name}`;
  }, []);

  const guestRedirectToastShown = useRef(false);

  const getCellColor = (
    value: number,
    values: number[],
    higherIsBetter = true
  ): string => {
    if (values.length < 2) return '';
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max === min) return '';
    if (higherIsBetter) {
      if (value === max) return 'text-green-500';
      if (value === min) return 'text-red-500';
    } else {
      if (value === min) return 'text-green-500';
      if (value === max) return 'text-red-500';
    }
    return '';
  };

  const avgOf = (values: number[]): number =>
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const getSessionAvgCycleTime = (session: Session): number =>
    avgOf(session.matches.flatMap(cycleTimesOf));

  /**
   * Share of park opportunities converted. Park is scored separately for
   * AUTO and TELEOP, so each robot contributes two opportunities per match.
   */
  const getSessionParkRate = (session: Session): number => {
    const slots = session.matches.length * 4;
    if (slots === 0) return 0;
    const parked = session.matches.reduce(
      (s, m) =>
        s +
        (m.robot1ParkAuto ? 1 : 0) +
        (m.robot1ParkTeleop ? 1 : 0) +
        (m.robot2ParkAuto ? 1 : 0) +
        (m.robot2ParkTeleop ? 1 : 0),
      0
    );
    return (parked / slots) * 100;
  };

  /** Average penalty points charged per match. */
  const getSessionPenalties = (session: Session): number =>
    avgOf(session.matches.map(m => calculateScore(m).penalties));

  const getMatchPenalties = (match: CompareMatch): number =>
    calculateScore(match).penalties;

  const getMatchAvgCycleTime = (match: CompareMatch): number =>
    avgOf(cycleTimesOf(match));

  useEffect(() => {
    const loadSessions = async () => {
      if (!user?.uid) return;
      try {
        const userSessions = team
          ? await firebaseService.getTeamSessions(team.id)
          : await firebaseService.getUserSessions(user.uid);
        setSessions(userSessions);

        const session1Id = searchParams.get('session1');
        const session2Id = searchParams.get('session2');
        if (session1Id) {
          setSelectedSessionIds([session1Id]);
          if (session2Id) {
            setSelectedSessionIds([session1Id, session2Id]);
          }
        }
      } catch (error) {
        if (isAbortError(error)) return;
        const { logger } = await import('@/lib/logger');
        logger.error('Error loading sessions', error);
        toast.error('Failed to load sessions');
      } finally {
        setLoading(false);
      }
    };
    loadSessions();
  }, [user?.uid, searchParams, team]);

  useEffect(() => {
    let isMounted = true;
    const loadSessionsData = async () => {
      try {
        const sessionsData = await Promise.all(
          selectedSessionIds.map(id => firebaseService.getSession(id))
        );
        if (!isMounted) return;
        setSelectedSessionsData(
          sessionsData.filter(s => s !== null) as Session[]
        );
        const matches: CompareMatch[] = [];
        sessionsData.forEach((session, sessionIndex) => {
          if (session) {
            session.matches.forEach(match => {
              matches.push({
                ...match,
                sessionId: session.id,
                sessionName: session.sessionName,
                sessionIndex,
              });
            });
          }
        });
        setAllMatches(matches);
      } catch (error) {
        if (!isMounted || isAbortError(error)) return;
        const { logger } = await import('@/lib/logger');
        logger.error('Error loading sessions', error);
        toast.error('Failed to load some sessions');
      }
    };
    if (selectedSessionIds.length > 0) {
      loadSessionsData();
    } else {
      setSelectedSessionsData([]);
      setAllMatches([]);
    }
    return () => {
      isMounted = false;
    };
  }, [selectedSessionIds]);

  if (!user?.uid || isGuest) {
    if (!guestRedirectToastShown.current) {
      guestRedirectToastShown.current = true;
      setTimeout(() => toast.error('Please sign in to compare sessions'), 0);
    }
    return <Navigate to={ROUTES.SESSIONS} replace />;
  }

  const toggleSession = (sessionId: string) => {
    if (selectedSessionIds.includes(sessionId)) {
      setSelectedSessionIds(selectedSessionIds.filter(id => id !== sessionId));
    } else {
      setSelectedSessionIds([...selectedSessionIds, sessionId]);
    }
  };

  const renderSessionRow = (
    label: string,
    getValue: (session: Session) => number,
    opts: {
      indent?: boolean;
      higherIsBetter?: boolean;
      format?: (v: number) => string;
      highlight?: boolean;
    } = {}
  ) => {
    const {
      indent = false,
      higherIsBetter = true,
      format = v => Math.round(v).toString(),
      highlight = false,
    } = opts;
    const values = selectedSessionsData.map(getValue);
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
        {selectedSessionsData.map((session, i) => (
          <td
            key={session.id}
            className={`text-right py-3 px-4 text-sm ${highlight ? 'font-bold text-lg' : 'font-medium'} ${
              getCellColor(values[i], values, higherIsBetter) ||
              (highlight
                ? 'text-team-blue'
                : isDarkMode
                  ? 'text-white'
                  : 'text-gray-900')
            }`}
          >
            {format(values[i])}
          </td>
        ))}
      </tr>
    );
  };

  const renderMatchRow = (
    label: string,
    getValue: (match: CompareMatch) => number,
    opts: {
      indent?: boolean;
      higherIsBetter?: boolean;
      format?: (v: number) => string;
      highlight?: boolean;
    } = {}
  ) => {
    const {
      indent = false,
      higherIsBetter = true,
      format = v => Math.round(v).toString(),
      highlight = false,
    } = opts;
    const values = selectedMatches.map(getValue);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
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
        {selectedMatches.map((match, i) => (
          <td
            key={match.id}
            className={`text-right py-3 px-4 text-sm ${highlight ? 'font-bold text-lg' : 'font-medium'} ${
              getCellColor(values[i], values, higherIsBetter) ||
              (highlight
                ? 'text-team-blue'
                : isDarkMode
                  ? 'text-white'
                  : 'text-gray-900')
            }`}
          >
            {format(values[i])}
          </td>
        ))}
        {selectedMatches.length > 1 && (
          <td
            className={`text-right py-3 px-4 text-sm font-semibold ${isDarkMode ? 'text-team-blue' : 'text-team-blue'}`}
          >
            {format(avg)}
          </td>
        )}
      </tr>
    );
  };

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

  return (
    <div
      className={`min-h-[100dvh] ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}
    >
      <div className="max-w-[1152px] mx-auto px-4 sm:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold mb-2">
            Comparison
          </h1>
          <p
            className={`text-base mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            Compare sessions and matches side-by-side
          </p>

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
              disabled={selectedSessionIds.length === 0}
            >
              Compare Matches ({allMatches.length})
            </button>
          </div>
        </div>

        <div className="mb-6">
          {sessions.length === 0 ? (
            <div className={`text-center py-12 rounded-xl border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-gray-200 bg-gray-50'}`}>
              <p className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
              >
                No sessions available
              </p>
              <p className={`text-sm mb-4 ${isDarkMode ? 'text-team-white-40' : 'text-gray-400'}`}>
                Complete some practice sessions first, then come back to compare them.
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
                const isSelected = selectedSessionIds.includes(session.id);
                const avgScore = Math.round(
                  session.matches.reduce((sum, m) => sum + (m.finalScore || 0), 0) /
                  (session.matches.length || 1)
                );
                return (
                  <button
                    key={session.id}
                    onClick={() => toggleSession(session.id)}
                    title={`${session.sessionName || 'Unnamed'} · ${formatDate(session.createdAt)}`}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      isSelected
                        ? `bg-team-blue border-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`
                        : isDarkMode
                          ? 'bg-team-dark-20 border-team-blue-40 text-team-white-60 hover:border-team-blue hover:text-white'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400 hover:text-gray-900'
                    }`}
                  >
                    <span className="max-w-[140px] truncate">{session.sessionName || 'Unnamed'}</span>
                    <span className={`shrink-0 ${
                      isSelected
                        ? isDarkMode ? 'text-black/60' : 'text-white/70'
                        : isDarkMode ? 'text-team-white-60/60' : 'text-gray-400'
                    }`}>
                      {session.matches.length}m · {avgScore}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {comparisonMode === 'sessions' ? (
          selectedSessionsData.length > 0 ? (
            <div className="space-y-6">

              <Card className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}>
                <CardHeader
                  onClick={() => setIsScoreChartOpen(!isScoreChartOpen)}
                  className="cursor-pointer hover:bg-opacity-80 transition-all"
                >
                  <CardTitle className={`text-xl flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <span>Average Score Trend</span>
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isScoreChartOpen ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
                {isScoreChartOpen && (
                  <CardContent>
                    <p className={`text-xs mb-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}>
                      Average points from each element across all matches in each session. Each point = one session.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {ELEMENTS.map(phase => (
                        <button
                          key={phase}
                          onClick={() => setScoreChartPhase(phase)}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            scoreChartPhase === phase
                              ? `bg-team-blue border-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`
                              : isDarkMode
                                ? 'bg-team-dark border-team-blue-40 text-team-white-60 hover:border-team-blue hover:text-white'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900'
                          }`}
                        >
                          {ELEMENT_LABELS[phase]}
                        </button>
                      ))}
                    </div>

                    {(() => {
                      const chartData = selectedSessionsData.map((session, idx) => {
                        const n = session.matches.length || 1;
                        const avg =
                          session.matches.reduce(
                            (s, m) => s + elementPoints(m, scoreChartPhase),
                            0
                          ) / n;
                        return {
                          sessionLabel: session.sessionName || `Session ${idx + 1}`,
                          score: Math.round(avg * 10) / 10,
                        };
                      });
                      return (
                        <div className="w-full overflow-x-auto">
                        <ResponsiveContainer width="100%" height={280} minWidth={300}>
                          <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'} />
                            <XAxis
                              dataKey="sessionLabel"
                              tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                              axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                              tickLine={false}
                              interval={0}
                              tickFormatter={v => v.length > 12 ? `${v.slice(0, 12)}…` : v}
                            />
                            <YAxis
                              tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              width={36}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
                                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                            />
                            <Line
                              dataKey="score"
                              name={`Avg  Points`}
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

              <Card className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}>
                <CardHeader
                  onClick={() => setIsCycleChartOpen(!isCycleChartOpen)}
                  className="cursor-pointer hover:bg-opacity-80 transition-all"
                >
                  <CardTitle className={`text-xl flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <span>Average Cycle Time Trend</span>
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isCycleChartOpen ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
                {isCycleChartOpen && (
                  <CardContent>
                    <p className={`text-xs mb-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}>
                      Average cycle time across all matches in each session. Lower is faster.
                    </p>
                    {(() => {
                      const chartData = selectedSessionsData.map((session, idx) => {
                        const all = session.matches.flatMap(cycleTimesOf);
                        const avg = all.length > 0 ? avgOf(all) : null;
                        return {
                          sessionLabel: session.sessionName || `Session ${idx + 1}`,
                          cycleTime: avg !== null ? Math.round(avg * 10) / 10 : null,
                        };
                      }).filter(d => d.cycleTime !== null);
                      return (
                        <div className="w-full overflow-x-auto">
                        <ResponsiveContainer width="100%" height={280} minWidth={300}>
                          <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'} />
                            <XAxis
                              dataKey="sessionLabel"
                              tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                              axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                              tickLine={false}
                              interval={0}
                              tickFormatter={v => v.length > 12 ? `${v.slice(0, 12)}…` : v}
                            />
                            <YAxis
                              tickFormatter={v => `${v}s`}
                              tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              width={40}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
                                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                              formatter={(v) => [`${Number(v).toFixed(1)}s`, 'Avg Cycle Time']}
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

              <Card
                className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
              >
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
                                {session.sessionName || 'Unnamed'}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {renderSessionRow(
                            'Avg Final Score',
                            s =>
                              s.matches.reduce(
                                (sum, m) => sum + (m.finalScore || 0),
                                0
                              ) / (s.matches.length || 1),
                            { highlight: true }
                          )}
                          {renderSessionRow('Avg Garden Points', s =>
                            avgOf(s.matches.map(m => calculateScore(m).garden))
                          )}
                          {renderSessionRow(
                            'Avg Garden Scored',
                            s => avgOf(s.matches.map(m => m.garden || 0)),
                            { indent: true, format: v => v.toFixed(1) }
                          )}
                          {renderSessionRow('Avg Tipping Points', s =>
                            avgOf(s.matches.map(m => calculateScore(m).tipping))
                          )}
                          {renderSessionRow(
                            'Avg Tipping Scored',
                            s => avgOf(s.matches.map(m => m.tipping || 0)),
                            { indent: true, format: v => v.toFixed(1) }
                          )}
                          {renderSessionRow('Avg Flower Points', s =>
                            avgOf(s.matches.map(m => calculateScore(m).flower))
                          )}
                          {renderSessionRow(
                            'Avg Flower Scored',
                            s => avgOf(s.matches.map(m => m.flower || 0)),
                            { indent: true, format: v => v.toFixed(1) }
                          )}
                          {renderSessionRow('Avg Hive Points', s =>
                            avgOf(s.matches.map(m => calculateScore(m).hive))
                          )}
                          {renderSessionRow(
                            'Avg Balls in Hive',
                            s => avgOf(s.matches.map(m => m.ballsInHive || 0)),
                            { indent: true, format: v => v.toFixed(1) }
                          )}
                          {renderSessionRow('Avg Robot Points', s =>
                            avgOf(
                              s.matches.map(m => {
                                const b = calculateScore(m);
                                return b.leave + b.park;
                              })
                            )
                          )}
                          {renderSessionRow('Park Rate', getSessionParkRate, {
                            indent: true,
                            format: v => `${Math.round(v)}%`,
                          })}
                          {renderSessionRow(
                            'Avg Penalty Points',
                            getSessionPenalties,
                            {
                              higherIsBetter: false,
                              format: v => v.toFixed(1),
                            }
                          )}
                          <tr
                            className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                          >
                            <td
                              className={`py-3 px-4 pl-8 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                            >
                              ↳ Parking Summary
                            </td>
                            {selectedSessionsData.map(session => {
                              const autoCount = session.matches.filter(
                                m => m.robot1ParkAuto || m.robot2ParkAuto
                              ).length;
                              const teleopCount = session.matches.filter(
                                m => m.robot1ParkTeleop || m.robot2ParkTeleop
                              ).length;
                              return (
                                <td
                                  key={session.id}
                                  className={`text-right py-3 px-4 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                                >
                                  {autoCount > 0 ? `${autoCount} auto` : ''}
                                  {autoCount > 0 && teleopCount > 0 ? ', ' : ''}
                                  {teleopCount > 0
                                    ? `${teleopCount} teleop`
                                    : ''}
                                  {autoCount === 0 && teleopCount === 0
                                    ? 'None'
                                    : ''}
                                </td>
                              );
                            })}
                          </tr>
                          {renderSessionRow(
                            'Avg Cycle Time',
                            getSessionAvgCycleTime,
                            {
                              higherIsBetter: false,
                              format: v =>
                                v > 0 ? `${v.toFixed(1)}s` : 'N/A',
                            }
                          )}
                          {renderSessionRow(
                            'Leave Rate',
                            s => {
                              const slots = s.matches.length * 2;
                              if (slots === 0) return 0;
                              const left = s.matches.reduce(
                                (sum, m) =>
                                  sum +
                                  (m.robot1Leave ? 1 : 0) +
                                  (m.robot2Leave ? 1 : 0),
                                0
                              );
                              return (left / slots) * 100;
                            },
                            { format: v => `${Math.round(v)}%` }
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
                                {session.matchType || 'N/A'}
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
            <Card
              className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
            >
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="text-team-blue text-5xl mb-4">📊</div>
                  <h3
                    className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    Select Sessions to Compare
                  </h3>
                  <p
                    className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                  >
                    Choose sessions from the list above to see detailed
                    comparison
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        ) : 
        allMatches.length > 0 ? (
          <div className="space-y-6">
            <div className="space-y-4">
              {selectedSessionsData.map((session) => {
                const sessionMatches = allMatches.filter(
                  m => m.sessionId === session.id
                );
                return (
                  <div key={session.id}>
                    <div
                      className={`text-xs font-semibold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}
                    >
                      {session.sessionName || 'Unnamed Session'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sessionMatches.map(match => {
                        const isChecked = selectedMatches.some(
                          m => m.id === match.id
                        );
                        return (
                          <button
                            key={match.id}
                            onClick={() => {
                              if (isChecked) {
                                setSelectedMatches(
                                  selectedMatches.filter(m => m.id !== match.id)
                                );
                              } else {
                                setSelectedMatches([
                                  ...selectedMatches,
                                  match,
                                ]);
                              }
                            }}
                            title={`Garden ${match.garden || 0} · Tipping ${match.tipping || 0} · Flower ${match.flower || 0} · Hive ${match.ballsInHive || 0}`}
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
                                    ? 'text-black/60'
                                    : 'text-white/70'
                                  : isDarkMode
                                    ? 'text-team-white-60/60'
                                    : 'text-gray-400'
                              }`}
                            >
                              · {match.finalScore || 0}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedMatches.length > 0 && (
              <>
              <Card className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}>
                <CardHeader
                  onClick={() => setIsMatchScoreChartOpen(!isMatchScoreChartOpen)}
                  className="cursor-pointer hover:bg-opacity-80 transition-all"
                >
                  <CardTitle className={`text-xl flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <span>Score Trend by Match</span>
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isMatchScoreChartOpen ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
                {isMatchScoreChartOpen && (
                  <CardContent>
                    <p className={`text-xs mb-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}>
                      Score per phase for each selected match. Toggle phase to compare.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {ELEMENTS.map(phase => (
                        <button
                          key={phase}
                          onClick={() => setMatchScoreChartPhase(phase)}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            matchScoreChartPhase === phase
                              ? `bg-team-blue border-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`
                              : isDarkMode
                                ? 'bg-team-dark border-team-blue-40 text-team-white-60 hover:border-team-blue hover:text-white'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900'
                          }`}
                        >
                          {ELEMENT_LABELS[phase]}
                        </button>
                      ))}
                    </div>
                    {(() => {
                      const sessionColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                      const chartData = selectedMatches.map((match, idx) => {
                        const score = elementPoints(match, matchScoreChartPhase);
                        return {
                          matchLabel: `M${match.matchNumber}`,
                          score,
                          color: sessionColors[idx % sessionColors.length],
                        };
                      });
                      return (
                        <div className="w-full overflow-x-auto">
                        <ResponsiveContainer width="100%" height={280} minWidth={300}>
                          <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'} />
                            <XAxis
                              dataKey="matchLabel"
                              tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                              axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              width={36}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
                                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                            />
                            <Line
                              dataKey="score"
                              name={` Points`}
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

              <Card className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}>
                <CardHeader
                  onClick={() => setIsMatchCycleChartOpen(!isMatchCycleChartOpen)}
                  className="cursor-pointer hover:bg-opacity-80 transition-all"
                >
                  <CardTitle className={`text-xl flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <span>Cycle Times per Match</span>
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isMatchCycleChartOpen ? 'rotate-180' : ''}`} />
                  </CardTitle>
                </CardHeader>
                {isMatchCycleChartOpen && (
                  <CardContent>
                    <p className={`text-xs mb-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}>
                      Cycle time for each ball scored within a match. Supports up to 3 matches.
                      {selectedMatches.length > 3 && (
                        <span className="ml-1 text-amber-500 font-medium">Select 3 or fewer matches to enable this chart.</span>
                      )}
                    </p>
                    {selectedMatches.length > 3 ? (
                      <div className={`flex items-center justify-center h-32 rounded-lg border-2 border-dashed ${isDarkMode ? 'border-team-blue-40 text-team-white-60' : 'border-gray-200 text-gray-400'} text-sm`}>
                        Please select 3 or fewer matches to view cycle time chart
                      </div>
                    ) : (() => {
                      const sessionColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                      const maxBalls = Math.max(...selectedMatches.map(m => cycleTimesOf(m).length), 0);
                      if (maxBalls === 0) return (
                        <div className={`flex items-center justify-center h-32 rounded-lg border-2 border-dashed ${isDarkMode ? 'border-team-blue-40 text-team-white-60' : 'border-gray-200 text-gray-400'} text-sm`}>
                          No cycle time data for selected matches
                        </div>
                      );
                      const chartData = Array.from({ length: maxBalls }, (_, i) => {
                        const entry: Record<string, number | string> = { ball: `Ball ${i + 1}` };
                        selectedMatches.forEach((m, idx) => {
                          const ct = cycleTimesOf(m);
                          if (ct[i] !== undefined) entry[`match${idx}`] = ct[i];
                        });
                        return entry;
                      });
                      return (
                        <div className="w-full overflow-x-auto">
                        <ResponsiveContainer width="100%" height={280} minWidth={300}>
                          <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'} />
                            <XAxis
                              dataKey="ball"
                              tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                              axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={v => `${v}s`}
                              tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              width={40}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
                                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                              formatter={(v, name) => {
                                const idx = parseInt((name as string).replace('match', ''));
                                const m = selectedMatches[idx];
                                return [`${Number(v).toFixed(1)}s`, m ? `Match ${m.matchNumber}` : name];
                              }}
                            />
                            <Legend
                              iconType="circle"
                              iconSize={8}
                              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                              formatter={(value) => {
                                const idx = parseInt((value as string).replace('match', ''));
                                const m = selectedMatches[idx];
                                return m ? `Match ${m.matchNumber}${m.sessionName ? ` (${m.sessionName})` : ''}` : value;
                              }}
                            />
                            {selectedMatches.map((_m, idx) => (
                              <Line
                                key={`match${idx}`}
                                dataKey={`match${idx}`}
                                name={`match${idx}`}
                                stroke={sessionColors[idx % sessionColors.length]}
                                strokeWidth={2.5}
                                dot={{ r: 4, fill: sessionColors[idx % sessionColors.length], strokeWidth: 0 }}
                                activeDot={{ r: 6 }}
                                type="monotone"
                                connectNulls={false}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                        </div>
                      );
                    })()}
                  </CardContent>
                )}
              </Card>
              </>
            )}

            {selectedMatches.length > 0 && (
              <Card
                className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
              >
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
                            {selectedSessionsData.map(session => {
                              const matchesForSession = selectedMatches.filter(
                                m => m.sessionId === session.id
                              );
                              if (matchesForSession.length === 0) return null;
                              return matchesForSession.map(match => (
                                <th
                                  key={match.id}
                                  className={`text-right py-3 px-4 text-sm font-semibold ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                                >
                                  <div className={`text-xs font-normal mb-0.5 ${isDarkMode ? 'text-team-white-60/60' : 'text-gray-400'}`}>
                                    {session.sessionName || 'Unnamed'}
                                  </div>
                                  Match #{match.matchNumber}
                                </th>
                              ));
                            })}
                            {selectedMatches.length > 1 && (
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
                            m => m.finalScore || 0,
                            { highlight: true }
                          )}
                          {renderMatchRow('Garden Points', m =>
                            calculateScore(m).garden
                          )}
                          {renderMatchRow('Garden Scored', m => m.garden || 0, {
                            indent: true,
                          })}
                          {renderMatchRow('Tipping Points', m =>
                            calculateScore(m).tipping
                          )}
                          {renderMatchRow(
                            'Tipping Scored',
                            m => m.tipping || 0,
                            { indent: true }
                          )}
                          {renderMatchRow('Flower Points', m =>
                            calculateScore(m).flower
                          )}
                          {renderMatchRow('Flower Scored', m => m.flower || 0, {
                            indent: true,
                          })}
                          {renderMatchRow('Hive Points', m =>
                            calculateScore(m).hive
                          )}
                          {renderMatchRow(
                            'Balls in Hive',
                            m => m.ballsInHive || 0,
                            { indent: true }
                          )}
                          {renderMatchRow('Leave Points', m =>
                            calculateScore(m).leave
                          )}
                          {renderMatchRow('Park Points', m =>
                            calculateScore(m).park
                          )}
                          {renderMatchRow('Penalty Points', getMatchPenalties, {
                            higherIsBetter: false,
                          })}
                          <tr
                            className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                          >
                            <td
                              className={`py-3 px-4 pl-8 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                            >
                              ↳ Robot 1 Park
                            </td>
                            {selectedMatches.map(match => (
                              <td
                                key={match.id}
                                className={`text-right py-3 px-4 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                              >
                                {[
                                  match.robot1ParkAuto && 'auto',
                                  match.robot1ParkTeleop && 'teleop',
                                ]
                                  .filter(Boolean)
                                  .join(', ') || 'none'}
                              </td>
                            ))}
                            {selectedMatches.length > 1 && <td className="px-4 py-3" />}
                          </tr>
                          <tr
                            className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                          >
                            <td
                              className={`py-3 px-4 pl-8 text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                            >
                              ↳ Robot 2 Park
                            </td>
                            {selectedMatches.map(match => (
                              <td
                                key={match.id}
                                className={`text-right py-3 px-4 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                              >
                                {[
                                  match.robot2ParkAuto && 'auto',
                                  match.robot2ParkTeleop && 'teleop',
                                ]
                                  .filter(Boolean)
                                  .join(', ') || 'none'}
                              </td>
                            ))}
                            {selectedMatches.length > 1 && <td className="px-4 py-3" />}
                          </tr>
                          {renderMatchRow(
                            'Avg Cycle Time',
                            getMatchAvgCycleTime,
                            {
                              higherIsBetter: false,
                              format: v =>
                                v > 0 ? `${v.toFixed(1)}s` : 'N/A',
                            }
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
          </div>
        ) : (
          <Card
            className={`${isDarkMode ? 'bg-team-dark-20 border-team-blue-40' : 'bg-white border-gray-200'}`}
          >
            <CardContent className="py-12">
              <div className="text-center">
                <div className="text-team-blue text-5xl mb-4">🎮</div>
                <h3
                  className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                >
                  No Matches Found
                </h3>
                <p
                  className={`${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                >
                  The selected sessions don't have any matches recorded yet
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Compare;
