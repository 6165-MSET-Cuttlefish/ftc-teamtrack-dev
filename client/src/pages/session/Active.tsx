import { useEffect } from 'react';
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-8 sm:pb-12">
        <div className="space-y-16 sm:space-y-20">
          {/* Timer Section at Top - Scrolls with Page */}
          {sessionTimer > 0 && (
            <div className="pt-4 sm:pt-6 pb-2 sm:pb-4 space-y-9">
              {/* Title */}
              <h1 className="text-center text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-team-blue font-semibold">
                {sessionData.sessionName || 'Active Practice Session'}
              </h1>
              
              {/* Large Match Timer - Single Line */}
              <div className="flex flex-col items-center">
                <div className={`text-7xl sm:text-8xl font-light tracking-widest leading-none ${isDarkMode ? 'text-white' : 'text-black'}`} style={{ fontFamily: 'monospace', letterSpacing: '0.15em' }}>
                  {formatTime(sessionTimer)}
                </div>
              </div>
              
              {/* Timer Info Below */}
              <div className="flex items-center justify-center gap-8 sm:gap-12">
                <div className={`text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                  {sessionData.matchType || 'Full Game'}
                </div>
                <div className={`text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                  Session Timer: {formatTime(sessionTimer)}
                </div>
                <div className={`text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                  Match {(sessionData.matches?.length || 0) + 1}
                </div>
              </div>
            </div>
          )}

          {/* Live Preview (controls, buttons, scores) */}
          <LivePreview />

          {/* Session Setup */}
          <SessionSetup />

          {/* Scoring UI */}
          <ScoringUI />

          {/* Performance Metrics */}
          <PerformanceMetrics />

          {/* Notes */}
          <Notes />
        </div>
      </div>
    </div>
  );
};

export default ActiveSessionContent;
