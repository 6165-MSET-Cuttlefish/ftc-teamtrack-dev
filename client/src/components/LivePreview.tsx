import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession, useTheme, useAuth } from '@/contexts';
import { useFirebase } from '@/hooks';

const DataCard = ({ value, label }: { value: string; label: string }) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`flex flex-col items-center gap-4 px-9 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue/60 bg-[#FEFEFE]'}`}
    >
      <div className="text-team-blue text-3xl font-medium leading-6">
        {value}
      </div>
      <div
        className={
          isDarkMode
            ? 'text-team-white-60 text-base leading-6'
            : 'text-team-blue-40 text-base leading-6'
        }
      >
        {label}
      </div>
    </div>
  );
};

const InsightsCard = ({
  currentTeleOpScore,
  currentAutonomousScore,
  userId,
}: {
  currentTeleOpScore: number;
  currentAutonomousScore: number;
  userId: string;
}) => {
  const { isDarkMode } = useTheme();
  const [teleOpImprovement, setTeleOpImprovement] =
    useState<string>('Calculating...');
  const [autonomousImprovement, setAutonomousImprovement] =
    useState<string>('Calculating...');
  const [teleOpTrend, setTeleOpTrend] = useState<'up' | 'down' | 'neutral'>(
    'neutral'
  );
  const [autonomousTrend, setAutonomousTrend] = useState<
    'up' | 'down' | 'neutral'
  >('neutral');

  useEffect(() => {
    const calculateImprovements = async () => {
      try {
        const { firebaseService } = await import('../services/firebaseService');

        const recentSessions = await firebaseService.getUserSessions(userId);

        const lastThreeSessions = recentSessions.slice(0, 3);

        if (lastThreeSessions.length === 0) {
          setTeleOpImprovement('First session');
          setAutonomousImprovement('First session');
          setTeleOpTrend('neutral');
          setAutonomousTrend('neutral');
          return;
        }

        const avgTeleOp =
          lastThreeSessions.reduce(
            (sum, session) => sum + (session.teleOpScore || 0),
            0
          ) / lastThreeSessions.length;
        const avgAutonomous =
          lastThreeSessions.reduce(
            (sum, session) => sum + (session.autonomousScore || 0),
            0
          ) / lastThreeSessions.length;

        const calcPercentChange = (current: number, average: number) => {
          if (average === 0) return current > 0 ? 100 : 0;
          return ((current - average) / average) * 100;
        };

        const teleOpChange = calcPercentChange(currentTeleOpScore, avgTeleOp);
        const autonomousChange = calcPercentChange(
          currentAutonomousScore,
          avgAutonomous
        );

        setTeleOpImprovement(
          `${teleOpChange >= 0 ? '+' : ''}${teleOpChange.toFixed(1)}%`
        );
        setAutonomousImprovement(
          `${autonomousChange >= 0 ? '+' : ''}${autonomousChange.toFixed(1)}%`
        );

        setTeleOpTrend(
          teleOpChange > 0 ? 'up' : teleOpChange < 0 ? 'down' : 'neutral'
        );
        setAutonomousTrend(
          autonomousChange > 0
            ? 'up'
            : autonomousChange < 0
              ? 'down'
              : 'neutral'
        );
      } catch (error) {
        console.error('Error calculating improvements:', error);
        setTeleOpImprovement('Error');
        setAutonomousImprovement('Error');
      }
    };

    if (userId) {
      calculateImprovements();
    }
  }, [currentTeleOpScore, currentAutonomousScore, userId]);

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '—';
  };

  const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return 'text-green-500';
    if (trend === 'down') return 'text-red-500';
    return 'text-gray-500';
  };

  return (
    <div className="w-full px-6 py-6 rounded-lg border border-team-blue-40 space-y-2.5">
      <h3
        className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
      >
        Performance Insights
      </h3>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span
            className={`text-xs leading-6 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue'}`}
          >
            TeleOp vs Avg (last 3):
          </span>
          <span
            className={`text-xs font-semibold ${getTrendColor(teleOpTrend)}`}
          >
            {getTrendIcon(teleOpTrend)} {teleOpImprovement}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span
            className={`text-xs leading-6 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue'}`}
          >
            Autonomous vs Avg (last 3):
          </span>
          <span
            className={`text-xs font-semibold ${getTrendColor(autonomousTrend)}`}
          >
            {getTrendIcon(autonomousTrend)} {autonomousImprovement}
          </span>
        </div>
      </div>
    </div>
  );
};

export const LivePreview = () => {
  const {
    sessionData,
    completeSession,
    timer,
    isTimerRunning,
    setIsTimerRunning,
    formatTime,
    resetSession,
    resetTimer,
    setExpandedSection,
    updateSessionData,
  } = useSession();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { createSession, loading } = useFirebase();
  const navigate = useNavigate();
  const [, setSavedSessionId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [showTeleOpTransition, setShowTeleOpTransition] =
    useState<boolean>(false);
  const [hasTransitionedToTeleOp, setHasTransitionedToTeleOp] =
    useState<boolean>(false);

  // Session timer - starts when component mounts and runs continuously
  const [sessionTimer, setSessionTimer] = useState<number>(0);

  // Real-time consistency calculation
  const [consistency, setConsistency] = useState<number>(0);
  const [isCalculatingConsistency, setIsCalculatingConsistency] =
    useState(true);

  // Session timer effect - always running
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTimer(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Check if timer reaches 30 seconds in Full Game mode
  useEffect(() => {
    if (
      sessionData.matchType === 'Full Game' &&
      timer === 30 &&
      isTimerRunning &&
      !hasTransitionedToTeleOp
    ) {
      setIsTimerRunning(false);
      setShowTeleOpTransition(true);
    }
  }, [
    timer,
    isTimerRunning,
    sessionData.matchType,
    hasTransitionedToTeleOp,
    setIsTimerRunning,
  ]);

  const handleContinueToTeleOp = () => {
    setShowTeleOpTransition(false);
    setHasTransitionedToTeleOp(true);
    setExpandedSection('TeleOp Score');
    setIsTimerRunning(true);
  };

  useEffect(() => {
    const calculateConsistency = async () => {
      try {
        setIsCalculatingConsistency(true);
        const { firebaseService } = await import('../services/firebaseService');

        const recentSessions = await firebaseService.getUserSessions(
          user?.uid || ''
        );

        const lastThreeSessions = recentSessions.slice(0, 3);

        if (lastThreeSessions.length === 0) {
          setConsistency(100);
          setIsCalculatingConsistency(false);
          return;
        }

        const allScores = [
          sessionData.finalScore ?? 0,
          ...lastThreeSessions.map(session => session.finalScore || 0),
        ];

        const avgScore =
          allScores.reduce((sum, score) => sum + score, 0) / allScores.length;

        if (avgScore === 0) {
          setConsistency(100);
          setIsCalculatingConsistency(false);
          return;
        }

        const variance =
          allScores.reduce((sum, score) => {
            return sum + Math.pow(score - avgScore, 2);
          }, 0) / allScores.length;

        const stdDev = Math.sqrt(variance);

        const cv = stdDev / avgScore;

        const consistencyScore = 100 / (1 + cv);

        setConsistency(Math.round(consistencyScore));
        setIsCalculatingConsistency(false);
      } catch (error) {
        console.error('Error calculating consistency:', error);
        setConsistency(0);
        setIsCalculatingConsistency(false);
      }
    };

    if (user?.uid) {
      calculateConsistency();
    }
  }, [sessionData.finalScore, user?.uid]);

  const handleViewAnalysis = async () => {
    navigate('/analysis');
  };

  const handleNewSession = () => {
    // Reset the session to default state
    resetSession();
    setSavedSessionId(null);
    setHasStarted(false);
    // Stay on the current page to start a new session
  };

  const handleSaveMatch = () => {
    // Create a new match from current session data
    const newMatch = {
      id: `match-${Date.now()}`,
      matchNumber: (sessionData.matches?.length || 0) + 1,
      matchType: sessionData.matchType,
      finalScore: sessionData.finalScore,
      autonomousScore: sessionData.autonomousScore,
      teleOpScore: sessionData.teleOpScore,
      endGameScore: sessionData.endGameScore,
      autonClassifiedArtifact: sessionData.autonClassifiedArtifact,
      autonOverflowArtifact: sessionData.autonOverflowArtifact,
      autonMotif: sessionData.autonMotif,
      autonLeave: sessionData.autonLeave,
      teleClassifiedArtifact: sessionData.teleClassifiedArtifact,
      teleOverflowArtifact: sessionData.teleOverflowArtifact,
      teleMotif: sessionData.teleMotif,
      endgameHang: sessionData.endgameHang,
      cycleTimes: sessionData.cycleTimes,
      createdAt: new Date().toISOString(),
    };

    // Add to matches array
    const updatedMatches = [...(sessionData.matches || []), newMatch];
    updateSessionData({
      matches: updatedMatches,
      // Reset scoring for next match
      finalScore: 0,
      autonomousScore: 0,
      teleOpScore: 0,
      endGameScore: 0,
      autonClassifiedArtifact: 0,
      autonOverflowArtifact: 0,
      autonMotif: 0,
      autonLeave: 0,
      teleClassifiedArtifact: 0,
      teleOverflowArtifact: 0,
      teleMotif: 0,
      endgameHang: 0,
      cycleTimes: [],
    });
    
    // Reset match timer and tracking states
    resetTimer();
    setHasStarted(false);
    setIsTimerRunning(false);
  };

  const handleCompleteSession = async () => {
    const currentTime = formatTime(timer);
    setIsTimerRunning(false);
    completeSession(currentTime);

    const sessionToSave = {
      sessionName: sessionData.sessionName.trim() || 'Untitled Session',
      driverName: sessionData.driverName.trim() || 'Unknown Driver',
      matchType: sessionData.matchType || 'Practice',
      sessionDuration: currentTime,

      userId: user?.uid || '',
      userEmail: user?.email || '',

      autonClassifiedArtifact: sessionData.autonomousBasket || 0,
      autonOverflowArtifact: sessionData.autonomousSpecimen || 0,
      autonMotif: sessionData.autonomousFloorMark || 0,
      autonLeave: sessionData.autonLeave || 0,

      teleClassifiedArtifact: sessionData.teleOpSamples || 0,
      teleOverflowArtifact: sessionData.teleOpSpecimen || 0,
      teleMotif: sessionData.teleOpFloorMark || 0,

      endgameHang: sessionData.endGameValue || 0,
      endgamePark: 0,

      finalScore: sessionData.finalScore || 0,
      autonomousScore: sessionData.autonomousScore || 0,
      teleOpScore: sessionData.teleOpScore || 0,
      endGameScore: sessionData.endGameScore || 0,

      selectedFeature: sessionData.selectedFeature || '',
      cycleTimes: sessionData.cycleTimes || [],

      completedAt: new Date().toISOString(),
    };

    try {
      const result = await createSession(sessionToSave);
      if (result && result.id) {
        // session saved successfully; navigation or toast can be added here
      }
    } catch {
      // Ignore session save errors
    }
  };

  return (
    <div className="flex flex-col items-center gap-12 lg:gap-16">
      <div className="flex flex-col items-center gap-8 lg:gap-12">
        <div className="text-center space-y-6">
          <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold leading-tight lg:leading-9">
            Live Preview
          </h1>
          <p
            className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}
          >
            Real time analysis
          </p>
        </div>

        <div className="text-center">
          <p className={`text-sm mb-2 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>
            Session Timer
          </p>
          <div className="text-team-blue text-4xl lg:text-5xl font-semibold leading-tight lg:leading-9">
            {formatTime(sessionTimer)}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 lg:gap-8 w-full">
        {/* Current Match Box */}
        <div className={`w-full px-6 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue/60 bg-white'} space-y-6`}>
          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-team-blue'}`}>
            Current Match
          </h3>
          
          <div className="text-center">
            <div className="text-team-blue text-4xl lg:text-5xl font-semibold leading-tight lg:leading-9">
              {formatTime(timer)}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 lg:gap-9 w-full justify-center">
            <DataCard
              value={(sessionData.finalScore ?? 0).toString()}
              label="Final Score"
            />
            <DataCard
              value={isCalculatingConsistency ? '...' : `${consistency}%`}
              label="Consistency"
            />
          </div>

          <InsightsCard
            currentTeleOpScore={sessionData.teleOpScore ?? 0}
            currentAutonomousScore={sessionData.autonomousScore ?? 0}
            userId={user?.uid || ''}
          />
        </div>

        <div className="flex flex-col gap-4 w-full sm:w-60">
          {!sessionData.isSessionCompleted && (
            <>
              {showTeleOpTransition ? (
                <button
                  onClick={handleContinueToTeleOp}
                  className={`w-full px-2.5 py-2.5 rounded-2xl border border-team-blue bg-team-blue ${isDarkMode ? 'text-[#191919]' : 'text-[#FEFEFE]'} text-base leading-6 font-normal hover:bg-team-blue/90 transition-colors`}
                >
                  Continue into TeleOp
                </button>
              ) : (
                <>
                  {!isTimerRunning ? (
                    <button
                      onClick={() => {
                        setIsTimerRunning(true);
                        setHasStarted(true);
                      }}
                      className="w-full px-2.5 py-2.5 rounded-2xl border border-team-blue bg-transparent text-team-blue text-base leading-6 font-normal transition-colors"
                    >
                      {hasStarted ? 'Resume' : 'Start Timer'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsTimerRunning(false)}
                      className={`w-full px-2.5 py-2.5 rounded-2xl border border-team-blue bg-team-blue ${isDarkMode ? 'text-[#191919]' : 'text-[#FEFEFE]'} text-base leading-6 font-normal hover:bg-team-blue/90 transition-colors`}
                    >
                      Pause
                    </button>
                  )}
                </>
              )}

              <button
                onClick={handleSaveMatch}
                className={`w-full px-2.5 py-2.5 rounded-2xl border border-team-blue bg-team-blue ${isDarkMode ? 'text-[#191919]' : 'text-[#FEFEFE]'} text-base leading-6 font-normal hover:bg-team-blue/90 transition-colors`}
              >
                Save Match & Start New
              </button>

              <button
                onClick={handleCompleteSession}
                disabled={loading}
                className={`w-full px-2.5 py-2.5 rounded-2xl border border-team-blue bg-transparent text-team-blue text-base leading-6 font-normal transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'hover:bg-team-blue/10' : 'hover:bg-team-blue hover:text-[#FEFEFE]'}`}
              >
                {loading ? 'Saving...' : 'Complete Session'}
              </button>
            </>
          )}

          {sessionData.isSessionCompleted && (
            <>
              <button
                onClick={handleViewAnalysis}
                disabled={loading}
                className={`w-full px-2.5 py-2.5 rounded-2xl border border-team-white-20 bg-team-blue ${isDarkMode ? 'text-black' : 'text-[#FEFEFE]'} text-base leading-6 font-normal text-center hover:bg-team-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Loading...' : 'View Full Analysis Report'}
              </button>

              <button
                onClick={handleNewSession}
                className={`w-full px-2.5 py-2.5 rounded-2xl border border-team-blue bg-transparent text-team-blue text-base leading-6 font-normal transition-colors ${isDarkMode ? 'hover:bg-team-blue/10' : 'hover:bg-team-blue hover:text-[#FEFEFE]'}`}
              >
                New Session
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
