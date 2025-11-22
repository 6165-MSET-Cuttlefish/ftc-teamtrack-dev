import { useState, useEffect } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { TrendingUp, TrendingDown, BarChart3, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../hooks/useFirebase';
import { firebaseService } from '../services/firebaseService';

const DataCard = ({ value, label }: { value: string; label: string }) => {
  const { isDarkMode } = useTheme();
  return (
    <div className={`flex flex-col items-center gap-4 px-9 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
      <div className="text-team-blue text-3xl font-medium leading-6">
        {value}
      </div>
      <div className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-base leading-6`}>{label}</div>
    </div>
  );
};

const SensorOverviewCard = ({
  sessionName,
  driverName,
  matchType,
  sessionDuration,
  finalScore,
  totalTime,
}: {
  sessionName: string;
  driverName: string;
  matchType: string;
  sessionDuration: string;
  finalScore: number;
  totalTime: string;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'} space-y-4`}>
      <h3
        className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
      >
        Session Overview
      </h3>
      <div className="grid grid-cols-2 gap-6">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2.5">
            <div className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs leading-6`}>
              Session Name
            </div>
            <div className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs leading-6`}>Driver</div>
            <div className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs leading-6`}>
              Match Type
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="text-team-blue text-xs leading-6">
              {sessionName || 'N/A'}
            </div>
            <div className="text-team-blue text-xs leading-6">
              {driverName || 'N/A'}
            </div>
            <div className="text-team-blue text-xs leading-6">
              {matchType || 'N/A'}
            </div>
          </div>
        </div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2.5">
            <div className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs leading-6`}>Duration</div>
            <div className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs leading-6`}>
              Final Score
            </div>
            <div className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs leading-6`}>
              Total Finished Time
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="text-team-blue text-xs leading-6">
              {sessionDuration || 'N/A'}
            </div>
            <div className="text-team-blue text-xs leading-6">{finalScore}</div>
            <div className="text-team-blue text-xs leading-6">{totalTime}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CycleTimesCard = ({
  cycleTimes,
}: {
  cycleTimes?: number[];
}) => {
  const { isDarkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!cycleTimes || cycleTimes.length === 0) return null;

  const calculateAverageCycleTime = (): string => {
    const avg = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;
    const mins = Math.floor(avg / 60);
    const secs = Math.round(avg % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`w-full px-6 py-6 rounded-lg border cursor-pointer transition-all ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20 hover:bg-team-dark-40' : 'border-team-blue-40 bg-white hover:bg-gray-50'}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            <h4 className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}>
              Cycle Times
            </h4>
            <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>
              {cycleTimes.length} cycles • Avg: {calculateAverageCycleTime()}
            </p>
          </div>
        </div>
        <ChevronRight
          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''} ${isDarkMode ? 'text-white' : 'text-black'}`}
        />
      </div>

      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-team-blue-40 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            {cycleTimes.map((time, index) => {
              const mins = Math.floor(time / 60);
              const secs = time % 60;
              return (
                <div
                  key={index}
                  className={`px-3 py-2 rounded text-sm ${isDarkMode ? 'bg-team-dark text-white border border-team-blue-40' : 'bg-[#FEFEFE] text-black border border-team-blue-40'}`}
                >
                  <div className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs`}>
                    Cycle {index + 1}
                  </div>
                  <div className="text-base font-medium">
                    {mins}:{secs.toString().padStart(2, '0')}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className={`mt-4 px-4 py-3 rounded text-center ${isDarkMode ? 'bg-team-blue-40/20 text-white border border-team-blue-40' : 'bg-team-blue-40/10 text-black border border-team-blue-40'}`}
          >
            <div className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs`}>
              Average Cycle Time
            </div>
            <div className="text-xl font-semibold mt-1">
              {calculateAverageCycleTime()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PerformanceInsightCard = ({
  metric,
  value,
  isPositive,
}: {
  metric: string;
  value: string;
  isPositive: boolean;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div className={`flex items-center justify-between px-6 py-4 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-40 bg-white'}`}>
      <div className="flex items-center gap-4">
        <span
          className={`text-base font-medium ${isDarkMode ? 'text-white' : 'text-black'}`}
        >
          {metric || 'Metric Name'}
        </span>
        <span className="text-team-blue text-base font-medium">
          {value || 'Value'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded ${isDarkMode ? 'text-white' : 'text-black'}`}>
          <BarChart3 className="w-5 h-5" />
        </div>
        <div
          className={`p-2 rounded ${
            isPositive
              ? 'text-green-500'
              : 'text-red-500'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-5 h-5" />
          ) : (
            <TrendingDown className="w-5 h-5" />
          )}
        </div>
      </div>
    </div>
  );
};

const ScoreBreakdownCard = ({
  matchType,
  autonomousScore,
  teleOpScore,
  endGameScore,
}: {
  matchType?: string;
  autonomousScore?: number;
  teleOpScore?: number;
  endGameScore?: number;
}) => {
  const { isDarkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const isFullMatch = matchType?.toLowerCase().includes('full') || !matchType?.toLowerCase().includes('tele');
  const isTeleOnlyMatch = matchType?.toLowerCase().includes('tele');

  const scoreBreakdown = isTeleOnlyMatch
    ? [
        { label: 'TeleOp', score: teleOpScore || 0 },
        { label: 'Endgame', score: endGameScore || 0 },
      ]
    : [
        { label: 'Autonomous', score: autonomousScore || 0 },
        { label: 'TeleOp', score: teleOpScore || 0 },
        { label: 'Endgame', score: endGameScore || 0 },
      ];

  const totalBreakdownScore = scoreBreakdown.reduce((sum, item) => sum + item.score, 0);

  return (
    <div
      className={`w-full px-6 py-6 rounded-lg border cursor-pointer transition-all ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20 hover:bg-team-dark-40' : 'border-team-blue-40 bg-white hover:bg-gray-50'}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            <h4 className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}>
              Score Breakdown
            </h4>
            <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>
              {scoreBreakdown.length} phases • Total: {totalBreakdownScore}
            </p>
          </div>
        </div>
        <ChevronRight
          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''} ${isDarkMode ? 'text-white' : 'text-black'}`}
        />
      </div>

      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-team-blue-40 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            {scoreBreakdown.map((item, index) => (
              <div
                key={index}
                className={`px-4 py-3 rounded ${isDarkMode ? 'bg-team-dark text-white border border-team-blue-40' : 'bg-[#FEFEFE] text-black border border-team-blue-40'}`}
              >
                <div className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs mb-1`}>
                  {item.label}
                </div>
                <div className="text-2xl font-semibold text-team-blue">
                  {item.score}
                </div>
              </div>
            ))}
          </div>
          <div
            className={`mt-4 px-4 py-3 rounded text-center ${isDarkMode ? 'bg-team-blue-40/20 text-white border border-team-blue-40' : 'bg-team-blue-40/10 text-black border border-team-blue-40'}`}
          >
            <div className={`${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'} text-xs mb-1`}>
              Score Breakdown Total
            </div>
            <div className="text-2xl font-semibold text-team-blue">
              {totalBreakdownScore}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AnalysisContent = () => {
  const { sessionData, updateSessionData } = useSession();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { getUserSessions } = useFirebase();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [_graphModal, _setGraphModal] = useState<{
    isOpen: boolean;
    metric: string;
  }>({
    isOpen: false,
    metric: '',
  });

  // Calculated metrics
  const [consistency, setConsistency] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(0);

  // Performance insights state
  const [insights, setInsights] = useState<{
    id: number;
    metric: string;
    value: string;
    isPositive: boolean;
  }[]>([]);

  // Load session data from Firebase or location state
  useEffect(() => {
    const loadSessionData = async () => {
      setLoading(true);
      
      // First check if session data was passed through state (for temporary sessions)
      const stateData = location.state as { sessionData?: any; isTemporary?: boolean } | null;
      if (stateData?.sessionData) {
        updateSessionData(stateData.sessionData);
        setLoading(false);
        return;
      }

      // Otherwise, try to load by sessionId from query params
      const sessionId = searchParams.get('sessionId');
      if (sessionId) {
        try {
          const session = await firebaseService.getSession(sessionId);
          if (session) {
            // Update the session context with loaded data
            updateSessionData({
              sessionName: session.sessionName || '',
              driverName: session.driverName || '',
              sessionDuration: session.sessionDuration || '',
              matchType: session.matchType || '',
              finalScore: session.finalScore || 0,
              autonomousScore: session.autonomousScore || 0,
              teleOpScore: session.teleOpScore || 0,
              endGameScore: session.endGameScore || 0,
              isSessionCompleted: true,
              autonomousBasket: session.autonClassifiedArtifact || 0,
              autonomousSpecimen: session.autonOverflowArtifact || 0,
              autonomousFloorMark: session.autonMotif || 0,
              autonomousLeave: session.autonLeave || 0,
              teleOpSamples: session.teleClassifiedArtifact || 0,
              teleOpSpecimen: session.teleOverflowArtifact || 0,
              teleOpFloorMark: session.teleMotif || 0,
              endGameValue: session.endgameHang || 0,
              selectedFeature: session.selectedFeature || '',
              cycleTimes: session.cycleTimes || [],
            });
          }
        } catch (error) {
          console.error('Error loading session:', error);
        }
      }
      
      setLoading(false);
    };

    loadSessionData();
  }, [searchParams, location.state, updateSessionData]);

  // Calculate metrics based on historical data
  useEffect(() => {
    let mounted = true;
    const fetchComparisons = async () => {
      if (!user?.uid) {
        // no user - can't compare
        setInsights([
          { id: 1, metric: 'Consistency', value: 'N/A', isPositive: false },
          { id: 2, metric: 'Autonomous', value: 'N/A', isPositive: false },
          { id: 3, metric: 'TeleOp', value: 'N/A', isPositive: false },
        ]);
        setConsistency(0);
        setAccuracy(0);
        return;
      }

      const result = await getUserSessions(user.uid);
      if (!mounted) return;

      if (!result || result.length === 0) {
        setInsights([
          { id: 1, metric: 'Consistency', value: 'N/A', isPositive: false },
          { id: 2, metric: 'Autonomous', value: 'N/A', isPositive: false },
          { id: 3, metric: 'TeleOp', value: 'N/A', isPositive: false },
        ]);
        setConsistency(0);
        setAccuracy(0);
        return;
      }

      // Use last 3 previous sessions (excluding current if it matches by finalScore and duration)
      // Filter out the current session when possible (match by finalScore and sessionDuration)
      const filtered = result.filter(s => !(s.finalScore === sessionData.finalScore && s.sessionDuration === sessionData.sessionDuration));
      const prevSessions = filtered.slice(0, 3);

      if (prevSessions.length === 0) {
        setInsights([
          { id: 1, metric: 'Consistency', value: 'N/A', isPositive: false },
          { id: 2, metric: 'Autonomous', value: 'N/A', isPositive: false },
          { id: 3, metric: 'TeleOp', value: 'N/A', isPositive: false },
        ]);
        setConsistency(0);
        setAccuracy(0);
        return;
      }

      const avgFinal = prevSessions.reduce((s, p) => s + (p.finalScore || 0), 0) / prevSessions.length;
      const avgAuton = prevSessions.reduce((s, p) => s + (p.autonomousScore || 0), 0) / prevSessions.length;
      const avgTele = prevSessions.reduce((s, p) => s + (p.teleOpScore || 0), 0) / prevSessions.length;

      // Calculate consistency: standard deviation of scores
      const scoreVariance = prevSessions.reduce((sum, session) => {
        const diff = (session.finalScore || 0) - avgFinal;
        return sum + diff * diff;
      }, 0) / prevSessions.length;
      const stdDev = Math.sqrt(scoreVariance);
      // Convert to percentage: lower std dev = higher consistency
      const consistencyPercent = avgFinal > 0 ? Math.max(0, Math.min(100, 100 - (stdDev / avgFinal) * 100)) : 0;
      setConsistency(Math.round(consistencyPercent));

      // Calculate accuracy: percentage of theoretical max score achieved
      // Assuming max score is around 150 for FTC (adjust if needed)
      const maxPossibleScore = 150;
      const accuracyPercent = (sessionData.finalScore / maxPossibleScore) * 100;
      setAccuracy(Math.round(Math.min(100, accuracyPercent)));

      const formatChange = (current: number, average: number) => {
        if (average === 0) return 'N/A';
        const perc = ((current - average) / average) * 100;
        const sign = perc >= 0 ? '+' : '';
        return `${sign}${Math.round(perc)}%`;
      };

      const consistencyChange = formatChange(sessionData.finalScore, avgFinal);
      const autonChange = formatChange(sessionData.autonomousScore, avgAuton);
      const teleChange = formatChange(sessionData.teleOpScore, avgTele);

      setInsights([
        { id: 1, metric: 'Consistency', value: consistencyChange, isPositive: sessionData.finalScore >= avgFinal },
        { id: 2, metric: 'Autonomous', value: autonChange, isPositive: sessionData.autonomousScore >= avgAuton },
        { id: 3, metric: 'TeleOp', value: teleChange, isPositive: sessionData.teleOpScore >= avgTele },
      ]);
    };

    fetchComparisons();

    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, sessionData.finalScore, sessionData.autonomousScore, sessionData.teleOpScore]);

  // Show loading state
  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'} flex items-center justify-center`}>
        <div className="text-team-blue text-2xl">Loading session...</div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
   <div className="max-w-[800px] mx-auto px-4 sm:px-8 py-8 lg:py-16">
        <div className="space-y-12">
          {/* Header */}
          <div className="text-center space-y-6">
            <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold leading-[48px]">
              {sessionData.sessionName || 'Session'} Analysis
            </h1>
            <p
              className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-[#191919]'}`}
            >
              Detailed performance analysis
            </p>
          </div>

          {/* Data Cards */}
          <div className="flex flex-col sm:flex-row gap-6 lg:gap-9 justify-center">
            <DataCard
              value={sessionData.finalScore.toString()}
              label="Final Score"
            />
            <DataCard value={`${consistency}%`} label="Consistency" />
            <DataCard value={`${accuracy}%`} label="Accuracy" />
          </div>

          {/* Sensor Overview */}
          <SensorOverviewCard
            sessionName={sessionData.sessionName}
            driverName={sessionData.driverName}
            matchType={sessionData.matchType}
            sessionDuration={sessionData.sessionDuration}
            finalScore={sessionData.finalScore}
            totalTime={sessionData.sessionDuration}
          />

          {/* Performance Insights */}
          <div className="space-y-6">
            <h2 className="text-team-blue text-2xl font-semibold leading-6">
              Performance Insights
            </h2>
            <div className="space-y-4">
              {insights.map(insight => (
                <PerformanceInsightCard
                  key={insight.id}
                  metric={insight.metric}
                  value={insight.value}
                  isPositive={insight.isPositive}
                />
              ))}
              {sessionData.selectedFeature === 'Cycle Times' && (
                <CycleTimesCard cycleTimes={sessionData.cycleTimes} />
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/original"
              className="w-full sm:w-60 px-2.5 py-2.5 rounded-2xl border border-team-blue text-team-blue text-base leading-6 font-normal text-center hover:bg-team-blue hover:text-team-dark transition-colors"
            >
              Back to Session
            </Link>
            <button 
              disabled
              className="w-full sm:w-60 px-2.5 py-2.5 rounded-2xl border border-team-white-20 bg-team-blue text-team-dark text-base leading-6 font-normal opacity-50 cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisContent;
