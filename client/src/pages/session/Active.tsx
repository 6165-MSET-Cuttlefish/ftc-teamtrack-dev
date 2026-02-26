import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SessionSetup,
  ScoringUI,
  GateVisual,
  Notes,
  LivePreview,
  ScoringMetrics,
  ActiveTutorial,
} from '@/components';
import { TUTORIAL_OPEN_SESSION_SETUP_EVENT } from '@/constants/events';
import { useTheme, useSession } from '@/contexts';
import { useMatchAudio, useNavigationGuard } from '@/hooks';
import { APP_CONFIG, ROUTES } from '@/constants';

/** Thin divider that adapts to the current theme */
const Divider = ({ className = '' }: { className?: string }) => {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`h-px mx-4 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-200'} ${className}`}
    />
  );
};

const Active = () => {
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
    isPreMatchDelay,
    hasStarted,
  } = useSession();

  const isSessionSetupSavedInit =
    () => sessionData.sessionName?.trim().length > 0;
  const [showSessionSetup, setShowSessionSetup] = useState(
    () => !isSessionSetupSavedInit()
  );
  const [isSessionSetupSaved, setIsSessionSetupSaved] = useState(
    isSessionSetupSavedInit
  );
  const [shouldFlashSetup, setShouldFlashSetup] = useState(false);

  useMatchAudio();

  useEffect(() => {
    document.title = `Active Session - ${APP_CONFIG.name}`;

    const handleOpenSetup = () => {
      setShowSessionSetup(true);
    };
    window.addEventListener(TUTORIAL_OPEN_SESSION_SETUP_EVENT, handleOpenSetup);
    return () => {
      window.removeEventListener(TUTORIAL_OPEN_SESSION_SETUP_EVENT, handleOpenSetup);
    };
  }, []);

  const hasUnsavedWork = hasStarted && !sessionData.isSessionCompleted;
  const navGuard = useNavigationGuard(
    hasUnsavedWork,
    'You have an active session in progress. Are you sure you want to leave? Your current match data may be lost.'
  );

  useEffect(() => {
    if (!sessionData.sessionName?.trim()) {
      setShowSessionSetup(true);
      setIsSessionSetupSaved(false);
    }
  }, [sessionData.sessionName]);

  const getTimerColor = () => {
    if (matchPhase === 'controller_pickup') {
      return 'text-yellow-400';
    }
    return isDarkMode ? 'text-white' : 'text-team-blue';
  };

  return (
    <div
      className={`min-h-screen page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'} relative`}
    >
      {navGuard.isBlocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div
            className={`max-w-sm w-full rounded-xl border p-6 text-center space-y-4 shadow-2xl ${
              isDarkMode ? 'bg-team-dark border-team-blue-40' : 'bg-white border-gray-200'
            }`}
          >
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Leave active session?
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
              {navGuard.message}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={navGuard.reset}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  isDarkMode ? 'border-team-blue-40 text-white hover:bg-team-white-10' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Stay
              </button>
              <button
                onClick={navGuard.proceed}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-6 sm:pb-10 relative">
        <div className="space-y-4 sm:space-y-6">
          <ActiveTutorial />

          <div
            className="space-y-4 px-4 py-4"
            data-tutorial="timer"
          >
            <div className="flex flex-col items-center">
              <h1 className="text-center text-2xl sm:text-4xl md:text-5xl font-semibold text-team-blue">
                {sessionData.sessionName?.trim() || 'Active Practice Session'}
              </h1>
            </div>

            {!isPreMatchDelay && (
              <div className="flex flex-col items-center">
                <div
                  role="timer"
                  aria-label="Match timer"
                  className={`text-7xl sm:text-8xl tracking-wider leading-none transition-colors font-righteous ${getTimerColor()}`}
                  style={{
                    letterSpacing: '0.05em',
                  }}
                >
                  {matchPhase === 'controller_pickup'
                    ? formatTime(phaseTimer)
                    : matchPhase === 'auton'
                      ? formatTime(getDisplayTimer(timer, matchPhase))
                      : formatTime(timer)}
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
              <div
                className={`text-xs sm:text-sm font-semibold uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                {matchPhase === 'controller_pickup'
                  ? 'Controller Pickup'
                  : matchPhase === 'teleop' && timer <= 20
                      ? 'Endgame'
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

          <div data-tutorial="controls" className="px-4 py-4">
            <LivePreview
              onOpenSessionSetup={() => {
                if (showSessionSetup && !sessionData.sessionName?.trim()) return;
                setShowSessionSetup(!showSessionSetup);
              }}
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

          {!sessionData.isSessionCompleted && (
            <>
              <Divider />

              {showSessionSetup && (
                <>
                  <div data-tutorial="session-setup" className="px-4 py-4">
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

              <div data-tutorial="gate" className="px-4 py-4">
                {sessionData.gateEnabled !== false && <GateVisual />}
              </div>

              <div data-tutorial="scoring" className="px-4 py-4">
                <ScoringUI />
              </div>

              <Divider />

              <div data-tutorial="metrics" className="px-4 py-4">
                <ScoringMetrics />
              </div>

              <Divider />

              <div data-tutorial="notes" className="px-4 py-4">
                <Notes />
              </div>
            </>
          )}

          {sessionData.isSessionCompleted && (
            <div className="px-4 py-8 text-center space-y-4">
              <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Session Complete!
              </h2>
              <p className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}>
                Great work! View your analysis or go to your sessions list.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to={ROUTES.SESSIONS}
                  className={`px-6 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    isDarkMode
                      ? 'border-team-blue-40 text-team-white-60 hover:text-white hover:border-team-blue'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  View Sessions
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Active;
