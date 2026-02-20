import { useState, useEffect } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useAuth, useTheme, useTeam } from '@/contexts';
import { firebaseService } from '@/services';
import { formatDate, isAbortError } from '@/lib/utils';
import { ROUTES } from '@/constants';
import type { Session, Match } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface CompareMatch extends Match {
  sessionId: string;
  sessionName: string;
  sessionIndex: number;
}

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

  const [comparisonMode, setComparisonMode] = useState<'sessions' | 'matches'>(
    'sessions'
  );
  const [allMatches, setAllMatches] = useState<CompareMatch[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<CompareMatch[]>([]);

  // --- Helpers ---

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

  const getSessionAvgCycleTime = (session: Session): number => {
    const all = session.matches.flatMap(m => m.cycleTimes || []);
    return all.length > 0 ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  };

  const getSessionAccuracy = (session: Session): number => {
    let totalShot = 0,
      totalMade = 0;
    session.matches.forEach(m => {
      const shots = [...(m.autonShots || []), ...(m.teleopShots || [])];
      if (shots.length > 0) {
        shots.forEach(s => {
          totalShot += s.ballsShot;
          totalMade += s.ballsMade;
        });
      } else {
        const made =
          (m.autonClassifiedArtifact || 0) +
          (m.autonOverflowArtifact || 0) +
          (m.teleClassifiedArtifact || 0) +
          (m.teleOverflowArtifact || 0);
        const missed = (m.autonBallsMissed || 0) + (m.teleBallsMissed || 0);
        totalMade += made;
        totalShot += made + missed;
      }
    });
    return totalShot > 0 ? (totalMade / totalShot) * 100 : 0;
  };

  const getMatchAccuracy = (match: CompareMatch): number => {
    const shots = [...(match.autonShots || []), ...(match.teleopShots || [])];
    let totalShot = 0,
      totalMade = 0;
    if (shots.length > 0) {
      shots.forEach(s => {
        totalShot += s.ballsShot;
        totalMade += s.ballsMade;
      });
    } else {
      const made =
        (match.autonClassifiedArtifact || 0) +
        (match.autonOverflowArtifact || 0) +
        (match.teleClassifiedArtifact || 0) +
        (match.teleOverflowArtifact || 0);
      const missed =
        (match.autonBallsMissed || 0) + (match.teleBallsMissed || 0);
      totalMade = made;
      totalShot = made + missed;
    }
    return totalShot > 0 ? (totalMade / totalShot) * 100 : 0;
  };

  const getMatchAvgCycleTime = (match: CompareMatch): number => {
    const ct = match.cycleTimes || [];
    return ct.length > 0 ? ct.reduce((a, b) => a + b, 0) / ct.length : 0;
  };

  // --- Data loading ---

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

  const toggleSession = (sessionId: string) => {
    if (selectedSessionIds.includes(sessionId)) {
      setSelectedSessionIds(selectedSessionIds.filter(id => id !== sessionId));
    } else {
      setSelectedSessionIds([...selectedSessionIds, sessionId]);
    }
  };

  // --- Render helpers ---

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
          className={`py-3 px-4 ${indent ? 'pl-8' : ''} ${
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
            className={`text-right py-3 px-4 ${highlight ? 'font-bold text-lg' : 'font-medium'} ${
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
    return (
      <tr
        className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
      >
        <td
          className={`py-3 px-4 ${indent ? 'pl-8' : ''} ${
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
            className={`text-right py-3 px-4 ${highlight ? 'font-bold text-lg' : 'font-medium'} ${
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

  // --- Guards ---

  if (!user?.uid || isGuest) {
    return <Navigate to={ROUTES.SESSIONS} replace />;
  }

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}
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
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-gray-50'}`}
    >
      <div className="max-w-[1152px] mx-auto px-4 sm:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold mb-2">
            Comparison
          </h1>
          <p
            className={`text-base mb-6 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            Compare sessions and matches side-by-side
          </p>

          {/* Comparison Mode Tabs */}
          <div className="flex gap-2">
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

        {/* Session Selector — pill grid */}
        <div className="mb-6">
          {sessions.length === 0 ? (
            <p className={`text-sm py-2 ${isDarkMode ? 'text-team-white-60' : 'text-gray-500'}`}>
              No sessions available
            </p>
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

        {/* ====== SESSIONS MODE ====== */}
        {comparisonMode === 'sessions' ? (
          selectedSessionsData.length > 0 ? (
            <div className="space-y-6">
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
                    <span>Detailed Breakdown</span>
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
                              className={`text-left py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                            >
                              Metric
                            </th>
                            {selectedSessionsData.map(session => (
                              <th
                                key={session.id}
                                className={`text-right py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
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
                          {renderSessionRow(
                            'Avg Autonomous Score',
                            s =>
                              s.matches.reduce(
                                (sum, m) => sum + (m.autonomousScore || 0),
                                0
                              ) / (s.matches.length || 1)
                          )}
                          {renderSessionRow(
                            'Avg Classified Artifact',
                            s =>
                              s.matches.reduce(
                                (sum, m) =>
                                  sum + (m.autonClassifiedArtifact || 0),
                                0
                              ) / (s.matches.length || 1),
                            { indent: true, format: v => v.toFixed(1) }
                          )}
                          {renderSessionRow(
                            'Avg Overflow Artifact',
                            s =>
                              s.matches.reduce(
                                (sum, m) =>
                                  sum + (m.autonOverflowArtifact || 0),
                                0
                              ) / (s.matches.length || 1),
                            { indent: true, format: v => v.toFixed(1) }
                          )}
                          {renderSessionRow(
                            'Avg Motif',
                            s =>
                              s.matches.reduce(
                                (sum, m) => sum + (m.autonMotif || 0),
                                0
                              ) / (s.matches.length || 1),
                            { indent: true, format: v => v.toFixed(1) }
                          )}
                          {renderSessionRow(
                            'Avg Leave',
                            s =>
                              s.matches.reduce(
                                (sum, m) => sum + (m.autonLeave || 0),
                                0
                              ) / (s.matches.length || 1),
                            { indent: true, format: v => v.toFixed(1) }
                          )}
                          {renderSessionRow(
                            'Avg Teleop Score',
                            s =>
                              s.matches.reduce(
                                (sum, m) => sum + (m.teleopScore || 0),
                                0
                              ) / (s.matches.length || 1)
                          )}
                          {renderSessionRow(
                            'Avg Classified Artifact',
                            s =>
                              s.matches.reduce(
                                (sum, m) =>
                                  sum + (m.teleClassifiedArtifact || 0),
                                0
                              ) / (s.matches.length || 1),
                            { indent: true, format: v => v.toFixed(1) }
                          )}
                          {renderSessionRow(
                            'Avg Overflow Artifact',
                            s =>
                              s.matches.reduce(
                                (sum, m) =>
                                  sum + (m.teleOverflowArtifact || 0),
                                0
                              ) / (s.matches.length || 1),
                            { indent: true, format: v => v.toFixed(1) }
                          )}
                          {renderSessionRow(
                            'Avg Motif',
                            s =>
                              s.matches.reduce(
                                (sum, m) => sum + (m.teleMotif || 0),
                                0
                              ) / (s.matches.length || 1),
                            { indent: true, format: v => v.toFixed(1) }
                          )}
                          {renderSessionRow(
                            'Avg Endgame Score',
                            s =>
                              s.matches.reduce(
                                (sum, m) => sum + (m.endGameScore || 0),
                                0
                              ) / (s.matches.length || 1)
                          )}
                          {/* Parking Summary */}
                          <tr
                            className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                          >
                            <td
                              className={`py-3 px-4 pl-8 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                            >
                              ↳ Parking Summary
                            </td>
                            {selectedSessionsData.map(session => {
                              const fullCount = session.matches.filter(
                                m =>
                                  m.robot1Park === 'full' ||
                                  m.robot2Park === 'full'
                              ).length;
                              const partialCount = session.matches.filter(
                                m =>
                                  m.robot1Park === 'partial' ||
                                  m.robot2Park === 'partial'
                              ).length;
                              return (
                                <td
                                  key={session.id}
                                  className={`text-right py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                                >
                                  {fullCount > 0 ? `${fullCount} full` : ''}
                                  {fullCount > 0 && partialCount > 0
                                    ? ', '
                                    : ''}
                                  {partialCount > 0
                                    ? `${partialCount} partial`
                                    : ''}
                                  {fullCount === 0 && partialCount === 0
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
                          {renderSessionRow('Accuracy', getSessionAccuracy, {
                            format: v =>
                              v > 0 ? `${v.toFixed(1)}%` : 'N/A',
                          })}
                          <tr>
                            <td
                              className={`py-3 px-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                            >
                              Match Type
                            </td>
                            {selectedSessionsData.map(session => (
                              <td
                                key={session.id}
                                className={`text-right py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
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
        ) : // ====== MATCHES MODE ======
        allMatches.length > 0 ? (
          <div className="space-y-6">
            {/* Match Selector — pill grid */}
            <div className="flex flex-wrap gap-2">
              {allMatches.map(match => {
                const isChecked = selectedMatches.some(m => m.id === match.id);
                return (
                  <button
                    key={match.id}
                    onClick={() => {
                      if (isChecked) {
                        setSelectedMatches(selectedMatches.filter(m => m.id !== match.id));
                      } else {
                        setSelectedMatches([...selectedMatches, match]);
                      }
                    }}
                    title={`${match.sessionName} · Auto ${match.autonomousScore || 0} / Teleop ${match.teleopScore || 0} / End ${match.endGameScore || 0}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      isChecked
                        ? `bg-team-blue border-team-blue ${isDarkMode ? 'text-black' : 'text-white'}`
                        : isDarkMode
                          ? 'bg-team-dark-20 border-team-blue-40 text-team-white-60 hover:border-team-blue hover:text-white'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400 hover:text-gray-900'
                    }`}
                  >
                    <span className={`shrink-0 ${
                      isChecked
                        ? isDarkMode ? 'text-black/60' : 'text-white/70'
                        : isDarkMode ? 'text-team-white-60/60' : 'text-gray-400'
                    }`}>{match.sessionName}</span>
                    <span>#{match.matchNumber}</span>
                    <span className={`shrink-0 ${
                      isChecked
                        ? isDarkMode ? 'text-black/60' : 'text-white/70'
                        : isDarkMode ? 'text-team-white-60/60' : 'text-gray-400'
                    }`}>· {match.finalScore || 0}</span>
                  </button>
                );
              })}
            </div>

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
                    <span>Detailed Breakdown</span>
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
                              className={`text-left py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                            >
                              Metric
                            </th>
                            {selectedMatches.map(match => (
                              <th
                                key={match.id}
                                className={`text-right py-3 px-4 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                              >
                                {match.sessionName} — M{match.matchNumber}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {renderMatchRow(
                            'Final Score',
                            m => m.finalScore || 0,
                            { highlight: true }
                          )}
                          {renderMatchRow(
                            'Autonomous Score',
                            m => m.autonomousScore || 0
                          )}
                          {renderMatchRow(
                            'Classified Artifact',
                            m => m.autonClassifiedArtifact || 0,
                            { indent: true }
                          )}
                          {renderMatchRow(
                            'Overflow Artifact',
                            m => m.autonOverflowArtifact || 0,
                            { indent: true }
                          )}
                          {renderMatchRow('Motif', m => m.autonMotif || 0, {
                            indent: true,
                          })}
                          {renderMatchRow('Leave', m => m.autonLeave || 0, {
                            indent: true,
                          })}
                          {renderMatchRow(
                            'Teleop Score',
                            m => m.teleopScore || 0
                          )}
                          {renderMatchRow(
                            'Classified Artifact',
                            m => m.teleClassifiedArtifact || 0,
                            { indent: true }
                          )}
                          {renderMatchRow(
                            'Overflow Artifact',
                            m => m.teleOverflowArtifact || 0,
                            { indent: true }
                          )}
                          {renderMatchRow('Motif', m => m.teleMotif || 0, {
                            indent: true,
                          })}
                          {renderMatchRow(
                            'Endgame Score',
                            m => m.endGameScore || 0
                          )}
                          <tr
                            className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                          >
                            <td
                              className={`py-3 px-4 pl-8 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                            >
                              ↳ Robot 1 Park
                            </td>
                            {selectedMatches.map(match => (
                              <td
                                key={match.id}
                                className={`text-right py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                              >
                                {match.robot1Park || 'none'}
                              </td>
                            ))}
                          </tr>
                          <tr
                            className={`border-b ${isDarkMode ? 'border-team-blue-40/50' : 'border-gray-100'}`}
                          >
                            <td
                              className={`py-3 px-4 pl-8 ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
                            >
                              ↳ Robot 2 Park
                            </td>
                            {selectedMatches.map(match => (
                              <td
                                key={match.id}
                                className={`text-right py-3 px-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                              >
                                {match.robot2Park || 'none'}
                              </td>
                            ))}
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
                          {renderMatchRow('Accuracy', getMatchAccuracy, {
                            format: v =>
                              v > 0 ? `${v.toFixed(1)}%` : 'N/A',
                          })}
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
