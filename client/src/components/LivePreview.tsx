import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../hooks/useFirebase';

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

const OverviewCard = ({
  driverName,
  matchType,
  sessionDuration,
  finalScore,
}: {
  driverName: string;
  matchType: string;
  sessionDuration: string;
  finalScore: number;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <div className="w-full px-6 py-6 rounded-lg border border-team-blue-40 space-y-2.5">
      <h3
        className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
      >
        Session Overview
      </h3>
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2.5">
          <div className="text-team-white-60 text-xs leading-6">Driver</div>
          <div className="text-team-white-60 text-xs leading-6">Match Type</div>
          <div className="text-team-white-60 text-xs leading-6">Duration</div>
          <div className="text-team-white-60 text-xs leading-6">Score</div>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="text-team-blue text-xs leading-6">
            {driverName || 'N/A'}
          </div>
          <div className="text-team-blue text-xs leading-6">
            {matchType || 'N/A'}
          </div>
          <div className="text-team-blue text-xs leading-6">
            {sessionDuration || 'N/A'}
          </div>
          <div className="text-team-blue text-xs leading-6">{finalScore}</div>
        </div>
      </div>
    </div>
  );
};

const InsightsCard = ({ 
  currentTeleOpScore, 
  currentAutonomousScore,
  userId 
}: { 
  currentTeleOpScore: number; 
  currentAutonomousScore: number;
  userId: string;
}) => {
  const { isDarkMode } = useTheme();
  const [teleOpImprovement, setTeleOpImprovement] = useState<string>('Calculating...');
  const [autonomousImprovement, setAutonomousImprovement] = useState<string>('Calculating...');
  const [teleOpTrend, setTeleOpTrend] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [autonomousTrend, setAutonomousTrend] = useState<'up' | 'down' | 'neutral'>('neutral');

  useEffect(() => {
    const calculateImprovements = async () => {
      try {
        // Import firebaseService
        const { firebaseService } = await import('../services/firebaseService');
        
        // Get user's recent sessions
        const recentSessions = await firebaseService.getUserSessions(userId);
        
        // Get last 3 sessions (excluding current)
        const lastThreeSessions = recentSessions.slice(0, 3);
        
        // Edge case: less than 1 previous session
        if (lastThreeSessions.length === 0) {
          setTeleOpImprovement('First session');
          setAutonomousImprovement('First session');
          setTeleOpTrend('neutral');
          setAutonomousTrend('neutral');
          return;
        }
        
        // Calculate averages
        const avgTeleOp = lastThreeSessions.reduce((sum, session) => 
          sum + (session.teleOpScore || 0), 0) / lastThreeSessions.length;
        const avgAutonomous = lastThreeSessions.reduce((sum, session) => 
          sum + (session.autonomousScore || 0), 0) / lastThreeSessions.length;
        
        // Calculate percentage changes
        const calcPercentChange = (current: number, average: number) => {
          if (average === 0) return current > 0 ? 100 : 0;
          return ((current - average) / average) * 100;
        };
        
        const teleOpChange = calcPercentChange(currentTeleOpScore, avgTeleOp);
        const autonomousChange = calcPercentChange(currentAutonomousScore, avgAutonomous);
        
        // Format and set results
        setTeleOpImprovement(`${teleOpChange >= 0 ? '+' : ''}${teleOpChange.toFixed(1)}%`);
        setAutonomousImprovement(`${autonomousChange >= 0 ? '+' : ''}${autonomousChange.toFixed(1)}%`);
        
        setTeleOpTrend(teleOpChange > 0 ? 'up' : teleOpChange < 0 ? 'down' : 'neutral');
        setAutonomousTrend(autonomousChange > 0 ? 'up' : autonomousChange < 0 ? 'down' : 'neutral');
        
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
        className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
      >
        Performance Insights
      </h3>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-team-white-60 text-xs leading-6">TeleOp vs Avg (last 3):</span>
          <span className={`text-xs font-semibold ${getTrendColor(teleOpTrend)}`}>
            {getTrendIcon(teleOpTrend)} {teleOpImprovement}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-team-white-60 text-xs leading-6">Autonomous vs Avg (last 3):</span>
          <span className={`text-xs font-semibold ${getTrendColor(autonomousTrend)}`}>
            {getTrendIcon(autonomousTrend)} {autonomousImprovement}
          </span>
        </div>
      </div>
    </div>
  );
};

export const LivePreview = () => {
  const { sessionData, completeSession } = useSession();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { createSession, loading } = useFirebase();
  const navigate = useNavigate();
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

  // Real-time consistency calculation
  const [consistency, setConsistency] = useState<number>(0);
  const [isCalculatingConsistency, setIsCalculatingConsistency] = useState(true);

  // Calculate consistency in real-time whenever final score changes
  useEffect(() => {
    const calculateConsistency = async () => {
      try {
        setIsCalculatingConsistency(true);
        const { firebaseService } = await import('../services/firebaseService');
        
        // Get user's recent sessions
        const recentSessions = await firebaseService.getUserSessions(user?.uid || '');
        
        // Include current score in calculation
        const allScores = [
          sessionData.finalScore,
          ...recentSessions.map(session => session.finalScore || 0)
        ].slice(0, 10); // Use last 10 sessions including current
        
        // Edge case: first session
        if (allScores.length <= 1) {
          setConsistency(100);
          setIsCalculatingConsistency(false);
          return;
        }
        
        // Calculate average score
        const avgScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
        
        // Calculate standard deviation
        const variance = allScores.reduce((sum, score) => {
          return sum + Math.pow(score - avgScore, 2);
        }, 0) / allScores.length;
        
        const stdDev = Math.sqrt(variance);
        
        // Calculate coefficient of variation (CV)
        const cv = avgScore > 0 ? (stdDev / avgScore) * 100 : 0;
        
        // Convert to consistency percentage (inverse of CV)
        const consistencyScore = Math.max(0, Math.min(100, 100 - cv));
        
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

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isTimerRunning && !sessionData.isSessionCompleted) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, sessionData.isSessionCompleted]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleViewAnalysis = async () => {
    // If we already have a saved session ID, navigate directly
    if (savedSessionId) {
      navigate(`/analysis?sessionId=${savedSessionId}`);
      return;
    }

    // If session is not completed yet, complete it first then navigate
    if (!sessionData.isSessionCompleted) {
      const currentTime = formatTime(timer);
      setIsTimerRunning(false);
      completeSession(currentTime);

      // Create and save the session
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
        autonLeave: sessionData.autonomousLeave || 0,
        teleClassifiedArtifact: sessionData.teleOpSamples || 0,
        teleOverflowArtifact: sessionData.teleOpSpecimen || 0,
        teleMotif: sessionData.teleOpFloorMark || 0,
        endgameHang: sessionData.endGameValue || 0,
        endgamePark: 0,
        finalScore: sessionData.finalScore || 0,
        autonomousScore: sessionData.autonomousScore || 0,
        teleOpScore: sessionData.teleOpScore || 0,
        endGameScore: sessionData.endGameScore || 0,
        completedAt: new Date().toISOString(),
      };

      try {
        const result = await createSession(sessionToSave);
        if (result && result.id) {
          setSavedSessionId(result.id);
          navigate(`/analysis?sessionId=${result.id}`);
        }
      } catch (error) {
        console.error('Failed to save session:', error);
        // Still navigate but show an error - could pass session data through state as fallback
        navigate('/analysis', {
          state: {
            sessionData: sessionToSave,
            isTemporary: true,
          },
        });
      }
    } else {
      // Session is completed but we don't have the ID - this shouldn't happen in normal flow
      // Pass session data through state as fallback
      navigate('/analysis', {
        state: {
          sessionData: sessionData,
          isTemporary: true,
        },
      });
    }
  };

  const handleCompleteSession = async () => {
    const currentTime = formatTime(timer);
    setIsTimerRunning(false);
    completeSession(currentTime);

    // Map frontend data structure to backend expected format
    const sessionToSave = {
      // Basic session info - ensure no empty strings
      sessionName: sessionData.sessionName.trim() || 'Untitled Session',
      driverName: sessionData.driverName.trim() || 'Unknown Driver',
      matchType: sessionData.matchType || 'Practice',
      sessionDuration: currentTime,

      // User information for authentication
      userId: user?.uid || '',
      userEmail: user?.email || '',

      // Autonomous data with new scoring system (no more separate basket/specimen)
      autonClassifiedArtifact: sessionData.autonomousBasket || 0, // Classified Artifact (3 pts each)
      autonOverflowArtifact: sessionData.autonomousSpecimen || 0, // Overflow Artifact (1 pt each)
      autonMotif: sessionData.autonomousFloorMark || 0, // Motif (2 pts each)
      autonLeave: sessionData.autonomousLeave || 0, // Leave (3 pts)

      // TeleOp data with new scoring system (no more separate basket/specimen)
      teleClassifiedArtifact: sessionData.teleOpSamples || 0, // Classified Artifact (3 pts each)
      teleOverflowArtifact: sessionData.teleOpSpecimen || 0, // Overflow Artifact (1 pt each)
      teleMotif: sessionData.teleOpFloorMark || 0, // Motif (2 pts each)

      // Endgame data
      endgameHang: sessionData.endGameValue || 0,
      endgamePark: 0, // Not tracked in frontend currently

      // Score data - both calculated and manually entered scores
      finalScore: sessionData.finalScore || 0,
      autonomousScore: sessionData.autonomousScore || 0,
      teleOpScore: sessionData.teleOpScore || 0,
      endGameScore: sessionData.endGameScore || 0,

      // Additional metadata
      completedAt: new Date().toISOString(),
    };

    try {
      // console.log("Sending session data:", sessionToSave);
      const result = await createSession(sessionToSave);
      if (result && result.id) {
        setSavedSessionId(result.id);
        // console.log("Session saved successfully to Firestore:", result);
        // You could add a toast notification here for user feedback
      }
    } catch {
      // console.error("Failed to save session:", error);
      // You could add error notification here
    }
  };

  return (
    <div className="flex flex-col items-center gap-12 lg:gap-16">
      {/* Header Section */}
      <div className="flex flex-col items-center gap-8 lg:gap-12">
        <div className="text-center space-y-6">
          <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold leading-tight lg:leading-9">
            Live Preview
          </h1>
          <p
            className={`text-base leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
          >
            Real time analysis
          </p>
        </div>

        <div className="text-team-blue text-4xl lg:text-5xl font-semibold leading-tight lg:leading-9">
          {formatTime(timer)}
        </div>
      </div>

      {/* Data Section */}
      <div className="flex flex-col items-center gap-6 lg:gap-8 w-full">
        {/* Data Cards Row */}
        <div className="flex flex-col sm:flex-row gap-6 lg:gap-9 w-full justify-center">
          <DataCard
            value={sessionData.finalScore.toString()}
            label="Final Score"
          />
          <DataCard 
            value={isCalculatingConsistency ? "..." : `${consistency}%`} 
            label="Consistency" 
          />
        </div>

        {/* Overview Card */}
        <OverviewCard
          driverName={sessionData.driverName}
          matchType={sessionData.matchType}
          sessionDuration={sessionData.sessionDuration}
          finalScore={sessionData.finalScore}
        />

        {/* Insights Card */}
        <InsightsCard 
          currentTeleOpScore={sessionData.teleOpScore}
          currentAutonomousScore={sessionData.autonomousScore}
          userId={user?.uid || ''}
        />

        {/* CTA Buttons */}
        <div className="flex flex-col gap-4 w-full sm:w-60">
          {!sessionData.isSessionCompleted && (
            <>
              {!isTimerRunning ? (
                <button
                  onClick={() => setIsTimerRunning(true)}
                  className="w-full px-2.5 py-2.5 rounded-2xl border border-team-blue bg-transparent text-team-blue text-base leading-6 font-normal hover:bg-team-blue hover:text-[#FEFEFE] transition-colors"
                >
                  Start
                </button>
              ) : (
                <button
                  onClick={() => setIsTimerRunning(false)}
                  className="w-full px-2.5 py-2.5 rounded-2xl border border-team-white-20 bg-transparent text-white text-base leading-6 font-normal hover:bg-team-white/10 transition-colors"
                >
                  Pause
                </button>
              )}

              <button
                onClick={handleCompleteSession}
                disabled={loading}
                className="w-full px-2.5 py-2.5 rounded-2xl border border-team-blue bg-transparent text-team-blue text-base leading-6 font-normal hover:bg-team-blue hover:text-[#FEFEFE] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Complete Session'}
              </button>
            </>
          )}

          <button
            onClick={handleViewAnalysis}
            disabled={loading}
            className={`w-full px-2.5 py-2.5 rounded-2xl border border-team-white-20 bg-team-blue ${isDarkMode ? 'text-black' : 'text-[#FEFEFE]'} text-base leading-6 font-normal text-center hover:bg-team-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? 'Loading...' : 'View Full Analysis Report'}
          </button>
        </div>
      </div>
    </div>
  );
};
