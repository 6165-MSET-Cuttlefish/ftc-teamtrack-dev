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
  const { sessionData, sessionTimer, formatTime } = useSession();

  return (
    <div
      className={`min-h-screen page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}
    >
      {/* Single Column Content - All Scrollable */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-6 sm:pb-10">
        <div className="space-y-4 sm:space-y-6">
          {/* Timer Section at Top - Scrolls with Page */}
          {sessionTimer > 0 && (
            <div className="pt-2 sm:pt-3 pb-1 sm:pb-2 space-y-5">
              {/* Title */}
              <h1 className="text-center text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-team-blue font-semibold">
                {sessionData.sessionName || 'Active Practice Session'}
              </h1>
              
              {/* Large Match Timer - Single Line */}
              <div className="flex flex-col items-center">
                <div className={`text-7xl sm:text-8xl font-bold tracking-wider leading-none ${isDarkMode ? 'text-white' : 'text-black'}`} style={{ fontFamily: '"Righteous", sans-serif', letterSpacing: '0.05em', fontWeight: 400 }}>
                  {formatTime(sessionTimer)}
                </div>
              </div>
              
              {/* Timer Info Below */}
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                <div className={`text-xs sm:text-sm font-semibold uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {sessionData.matchType || 'Full Game'}
                </div>
                <div className={`text-xs sm:text-sm font-semibold uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Session Timer: {formatTime(sessionTimer)}
                </div>
                <div className={`text-xs sm:text-sm font-semibold uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Match {(sessionData.matches?.length || 0) + 1}
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
            <SessionSetup />
          )}

          {/* Separator Line */}
          <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

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
