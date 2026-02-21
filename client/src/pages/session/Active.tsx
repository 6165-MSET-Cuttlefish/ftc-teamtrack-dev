import { useEffect, useState } from 'react';
import {
  SessionSetup,
  ScoringUI,
  GateVisual,
  Notes,
  LivePreview,
  PerformanceMetrics,
  ActiveTutorial,
} from '@/components';
import { useTheme, useSession } from '@/contexts';
import { useMatchAudio } from '@/hooks';
import { isInAudioIntroPhase } from '@/lib';
import { APP_CONFIG } from '@/constants';

/** Thin divider that adapts to the current theme */
const Divider = ({ className = '' }: { className?: string }) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`h-px mx-4 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'} ${className}`}
    />
  );
};

const ActiveSessionContent = () => {
  const { sessionData: initialSessionData } = useSession();
  const isSessionSetupSavedInit =
    () => initialSessionData.sessionName?.trim().length > 0;
  const [showSessionSetup, setShowSessionSetup] = useState(
    () => !isSessionSetupSavedInit()
  );
  const [isSessionSetupSaved, setIsSessionSetupSaved] = useState(
    isSessionSetupSavedInit
  );
  const [shouldFlashSetup, setShouldFlashSetup] = useState(false);

  useMatchAudio(); // Initialize match audio with appropriate events

  useEffect(() => {
    document.title = `Active Session - ${APP_CONFIG.name}`;
    
    // Listen for tutorial event to open session setup
    const handleOpenSetup = () => {
      setShowSessionSetup(true);
    };
    window.addEventListener('teamtrack-tutorial-open-session-setup', handleOpenSetup);
    return () => {
      window.removeEventListener('teamtrack-tutorial-open-session-setup', handleOpenSetup);
    };
  }, []);
  const { isDarkMode } = useTheme();
  const {
    sessionData,
    timer,
    sessionTimer,
    formatTime,
    getDisplayTimer,
    matchPhase,
    isTimerRunning,
    phaseTimer,
    matchActive,
  } = useSession();

  // Determine timer color based on phase
  const getTimerColor = () => {
    if (matchPhase === 'controller_pickup' || matchPhase === 'prepare') {
      return 'text-yellow-400';
    }
    return isDarkMode ? 'text-white' : 'text-team-blue';
  };

  return (
    <div
      className={`min-h-screen page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'} relative`}
    >
      {/* Single Column Content - All Scrollable */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-6 sm:pb-10 relative">
        <div className="space-y-4 sm:space-y-6">
          {/* Interactive Tutorial */}
          <ActiveTutorial />

          {/* Timer Section at Top - Scrolls with Page */}
          <div
            className="space-y-4 px-4 py-4"
            data-tutorial="timer"
          >
            {/* Session Name */}
            <div className="flex flex-col items-center">
              <h1 className="text-center text-2xl sm:text-4xl md:text-5xl font-semibold text-team-blue">
                {sessionData.sessionName?.trim() || 'Active Practice Session'}
              </h1>
            </div>

            {/* Large Match Timer - Single Line */}
            {!isInAudioIntroPhase(timer) && (
              <div className="flex flex-col items-center">
                <div
                  className={`text-7xl sm:text-8xl tracking-wider leading-none transition-colors font-righteous ${getTimerColor()}`}
                  style={{
                    letterSpacing: '0.05em',
                  }}
                >
                  {matchPhase === 'controller_pickup' || matchPhase === 'prepare'
                    ? formatTime(phaseTimer)
                    : matchPhase === 'auton'
                      ? formatTime(getDisplayTimer(timer, matchPhase))
                      : formatTime(timer)}
                </div>
              </div>
            )}

            {/* Timer Info Below */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
              <div
                className={`text-xs sm:text-sm font-semibold uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                {matchPhase === 'controller_pickup'
                  ? 'Controller Pickup'
                  : matchPhase === 'prepare'
                    ? 'Prepare'
                    : matchPhase === 'teleop' && timer <= 20
                      ? 'End Game'
                      : sessionData.matchType || 'Full Game'}
              </div>
              <div
                className={`text-sm sm:text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
              >
                Session: {formatTime(sessionTimer)}
              </div>
              <div
                className={`text-xs sm:text-sm font-semibold uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                {!matchActive
                  ? `Match ${(sessionData.matches?.length || 0) + 1} Not Started`
                  : isTimerRunning
                    ? `Match ${(sessionData.matches?.length || 0) + 1} Active`
                    : `Match ${(sessionData.matches?.length || 0) + 1} Paused`}
              </div>
            </div>
          </div>

          {/* Live Preview (controls, buttons, scores) */}
          <div data-tutorial="controls" className="px-4 py-4">
            <LivePreview
              onOpenSessionSetup={() => setShowSessionSetup(!showSessionSetup)}
              onTryStartWithoutSetup={() => {
                setShouldFlashSetup(true);
                setShowSessionSetup(true);
              }}
              isSessionSetupSaved={isSessionSetupSaved}
              onSessionReset={() => {
                setIsSessionSetupSaved(false);
                setShowSessionSetup(true);
                setShouldFlashSetup(false);
              }}
            />
          </div>

          {/* Hide everything below controls when session is completed */}
          {!sessionData.isSessionCompleted && (
            <>
              <Divider />

              {/* Session Setup - Toggle visibility with settings icon */}
              {showSessionSetup && (
                <>
                  <div data-tutorial="session-setup" className="px-4 py-4 relative z-50">
                    <SessionSetup
                      onSave={() => {
                        setShowSessionSetup(false);
                        setIsSessionSetupSaved(true);
                        setShouldFlashSetup(false);
                      }}
                      shouldFlash={shouldFlashSetup}
                      isUnsaved={!isSessionSetupSaved}
                    />
                  </div>

                  <Divider />
                </>
              )}

              {/* Gate Visual */}
              <div data-tutorial="gate" className="px-4 py-4">
                <GateVisual />
              </div>

              {/* Scoring UI */}
              <div data-tutorial="scoring" className="px-4 py-4">
                <ScoringUI />
              </div>

              <Divider />

              {/* Performance Metrics */}
              <div data-tutorial="metrics" className="px-4 py-4">
                <PerformanceMetrics />
              </div>

              <Divider />

              {/* Session Notes */}
              <div data-tutorial="notes" className="px-4 py-4">
                <Notes />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActiveSessionContent;
