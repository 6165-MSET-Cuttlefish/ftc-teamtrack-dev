import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';

const DataCard = ({ value, label }: { value: string; label: string }) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`flex flex-col items-center gap-4 px-9 py-6 rounded-lg border ${isDarkMode ? 'border-team-blue-40 bg-team-dark-20' : 'border-team-blue-10 bg-[#FEFEFE]'}`}
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

const InsightsCard = () => {
  const { isDarkMode } = useTheme();
  return (
    <div className="w-full px-6 py-6 rounded-lg border border-team-blue-40 space-y-2.5">
      <h3
        className={`text-base font-medium leading-6 ${isDarkMode ? 'text-white' : 'text-black'}`}
      >
        Performance Insights
      </h3>
      <div className="text-team-white-60 text-xs leading-6">
        Improvements in XXX
      </div>
    </div>
  );
};

export const LivePreview = () => {
  const { sessionData, completeSession } = useSession();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { createSession, loading } = useApi();
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

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

      // Autonomous data (map frontend names to backend names)
      autonBasket: sessionData.autonomousBasket || 0,
      autonSpeci: sessionData.autonomousSpecimen || 0,
      autonFloor: sessionData.autonomousFloorMark || 0,
      autonRung: 0, // Not tracked in frontend currently
      autonHighRung: 0, // Not tracked in frontend currently

      // TeleOp data (map frontend names to backend names)
      teleBasket: sessionData.teleOpSamples || 0,
      teleSpeci: sessionData.teleOpSpecimen || 0,
      teleNetZone: sessionData.teleOpFloorMark || 0,
      teleLowRung: 0, // Not tracked in frontend currently
      teleHighRung: 0, // Not tracked in frontend currently

      // Endgame data
      endgameHang: sessionData.endGameValue || 0,
      endgamePark: 0, // Not tracked in frontend currently

      // Additional metadata
      finalScore: sessionData.finalScore || 0,
      completedAt: new Date().toISOString(),
    };

    try {
      // console.log("Sending session data:", sessionToSave);
      const result = await createSession(sessionToSave);
      if (result) {
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
          <DataCard value="87%" label="Consistency" />
        </div>

        {/* Overview Card */}
        <OverviewCard
          driverName={sessionData.driverName}
          matchType={sessionData.matchType}
          sessionDuration={sessionData.sessionDuration}
          finalScore={sessionData.finalScore}
        />

        {/* Insights Card */}
        <InsightsCard />

        {/* CTA Buttons */}
        <div className="flex flex-col gap-4 w-full sm:w-60">
          {!sessionData.isSessionCompleted && (
            <button
              onClick={handleCompleteSession}
              disabled={loading}
              className="w-full px-2.5 py-2.5 rounded-2xl border border-team-blue bg-transparent text-team-blue text-base leading-6 font-normal hover:bg-team-blue hover:text-team-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Complete Session'}
            </button>
          )}

          <Link
            to="/analysis"
            className="inline-block w-full px-2.5 py-2.5 rounded-2xl border border-team-white-20 bg-team-blue text-team-dark text-base leading-6 font-normal text-center hover:bg-team-blue/90 transition-colors"
          >
            View Full Analysis Report
          </Link>
        </div>
      </div>
    </div>
  );
};
