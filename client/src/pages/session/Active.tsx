import { useEffect, useState } from 'react';
import {
  SessionSetup,
  ScoringUI,
  Notes,
  LivePreview,
  PerformanceMetrics,
} from '@/components';
import { useTheme, useSession } from '@/contexts';
import { APP_CONFIG } from '@/constants';

const ActiveSessionContent = () => {
  const [showSessionSetup, setShowSessionSetup] = useState(true);

  useEffect(() => {
    document.title = `Active Session - ${APP_CONFIG.name}`;
  }, []);
  const { isDarkMode } = useTheme();
  const { sessionData, timer, sessionTimer, formatTime, hasStarted, setHasStarted, matchPhase, isTimerRunning, phaseTimer } = useSession();
  // matchActive = timer has been started for the current match
  const matchActive = hasStarted && timer < 150;

  // Determine timer color based on phase
  const getTimerColor = () => {
    if (matchPhase === 'controller_pickup' || matchPhase === 'prepare') {
      return 'text-yellow-400';
    }
    return isDarkMode ? 'text-white' : 'text-black';
  };

  return (
    <div
      className={`min-h-screen page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      {/* Single Column Content - All Scrollable */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-6 sm:pb-10">
        <div className="space-y-4 sm:space-y-6">
          {/* Start Match Button - Before timer section */}
          {!hasStarted && (
            <div className="flex flex-col items-center gap-4">
              <h1 className="text-center text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-team-blue font-semibold">
                {sessionData.sessionName || 'Active Practice Session'}
              </h1>
              <button
                onClick={() => setHasStarted(true)}
                className={`px-8 py-4 bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'} text-lg font-bold rounded-2xl transition-colors`}
              >
                Start Match
              </button>
            </div>
          )}

          {/* Timer Section at Top - Scrolls with Page */}
          {hasStarted && (
            <div className="space-y-4">
              
              {/* Large Match Timer - Single Line */}
              <div className="flex flex-col items-center">
                <div className={`text-7xl sm:text-8xl font-bold tracking-wider leading-none transition-colors ${getTimerColor()}`} style={{ fontFamily: '"Righteous", sans-serif', letterSpacing: '0.05em', fontWeight: 400 }}>
                  {(matchPhase === 'controller_pickup' || matchPhase === 'prepare') ? formatTime(phaseTimer) : formatTime(timer)}
                </div>
              </div>
              
              {/* Timer Info Below */}
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                <div className={`text-xs sm:text-sm font-semibold uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {matchPhase === 'controller_pickup' ? 'Controller Pickup' : matchPhase === 'prepare' ? 'Prepare' : matchPhase === 'teleop' && timer <= 20 ? 'End Game' : sessionData.matchType || 'Full Game'}
                </div>
                <div className={`text-sm sm:text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Session Timer: {formatTime(sessionTimer)}
                </div>
                <div className={`text-xs sm:text-sm font-semibold uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {!matchActive
                    ? `Match ${(sessionData.matches?.length || 0) + 1} Not Started`
                    : isTimerRunning
                      ? `Match ${(sessionData.matches?.length || 0) + 1} Active`
                      : `Match ${(sessionData.matches?.length || 0) + 1} Paused`}
                </div>
              </div>
            </div>
          )}

          {/* Live Preview (controls, buttons, scores) */}
          <LivePreview onOpenSessionSetup={() => setShowSessionSetup(!showSessionSetup)} />

          {/* Separator Line */}
          <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

          {/* Session Setup - Toggle visibility with settings icon */}
          {showSessionSetup && (
            <>
              <h2 className={`text-lg sm:text-xl font-bold ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Session Settings
              </h2>
              
              <SessionSetup onSave={() => setShowSessionSetup(false)} />

              {/* Separator Line */}
              <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
            </>
          )}

          {/* Scoring UI */}
          <ScoringUI />

          {/* Separator Line */}
          <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

          {/* Performance Metrics */}
          <PerformanceMetrics />

          {/* Separator Line */}
          <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

          {/* Notes */}
          <Notes />
        </div>
      </div>
    </div>
  );
};

export default ActiveSessionContent;
