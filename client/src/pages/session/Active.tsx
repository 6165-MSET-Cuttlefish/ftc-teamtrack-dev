import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SessionSetup,
  LiveScoring,
  Notes,
  MatchEntry,
  ScoreBreakdown,
  ActiveTutorial,
  LiveControlsProvider,
  OpenSetupButton,
  PrimaryAction,
  SessionActions,
  PlayPauseControl,
  CancelMatchButton,
  MatchExtras,
  MatchLog,
  CompletedActions,
  ActiveDesktopLayout,
  ActiveMobileLayout,
  type ActiveSlots,
} from '@/components';
import {
  TUTORIAL_ENDED_EVENT,
  TUTORIAL_OPEN_SESSION_SETUP_EVENT,
} from '@/constants/events';
import { useTheme, useSession } from '@/contexts';
import { useMatchAudio, useNavigationGuard, useIsCompact } from '@/hooks';
import { APP_CONFIG, GAME_TIMING, ROUTES } from '@/constants';

const Active = () => {
  const { isDarkMode } = useTheme();
  const isCompact = useIsCompact();
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

  const isSessionSetupSavedInit = () =>
    sessionData.sessionName?.trim().length > 0;
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
    // The tutorial opens settings near its end; close them again so the user
    // lands back on Start Session.
    const handleTutorialEnded = () => {
      setShowSessionSetup(false);
    };
    window.addEventListener(TUTORIAL_OPEN_SESSION_SETUP_EVENT, handleOpenSetup);
    window.addEventListener(TUTORIAL_ENDED_EVENT, handleTutorialEnded);
    return () => {
      window.removeEventListener(
        TUTORIAL_OPEN_SESSION_SETUP_EVENT,
        handleOpenSetup
      );
      window.removeEventListener(TUTORIAL_ENDED_EVENT, handleTutorialEnded);
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

  const isCompleted = Boolean(sessionData.isSessionCompleted);
  const matchNumber = (sessionData.matches?.length || 0) + 1;

  /**
   * Every section of the page, keyed by slot. This decides *whether* a
   * section applies; the layout decides *where* it goes. Keep the nodes free
   * of page-level spacing so both layouts can position them.
   */
  const slots: ActiveSlots = {
    title: (
      <h1 className="text-center font-semibold text-team-blue text-[clamp(1.25rem,5vw,2.25rem)] leading-tight">
        {sessionData.sessionName?.trim() || 'Active Practice Session'}
      </h1>
    ),

    timer: isPreMatchDelay ? null : (
      <div
        role="timer"
        aria-label="Match timer"
        className={`text-center tracking-wider leading-none transition-colors font-righteous text-[clamp(3.5rem,20vw,5.5rem)] ${getTimerColor()}`}
        style={{ letterSpacing: '0.05em' }}
      >
        {matchPhase === 'controller_pickup'
          ? formatTime(phaseTimer)
          : matchPhase === 'auton'
            ? formatTime(getDisplayTimer(timer, matchPhase))
            : formatTime(timer)}
      </div>
    ),

    status: (
      <div className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap">
        <div
          className={`text-xs sm:text-sm font-semibold uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
        >
          {matchPhase === 'controller_pickup'
            ? 'Controller Pickup'
            : matchPhase === 'teleop' && timer <= GAME_TIMING.ENDGAME_REMAINING
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
            ? `Match ${matchNumber} Not Started`
            : isTimerRunning
              ? `Match ${matchNumber} Active`
              : `Match ${matchNumber} Paused`}
        </div>
      </div>
    ),

    openSetup: isCompleted ? null : <OpenSetupButton />,
    primaryAction: isCompleted ? null : <PrimaryAction />,
    sessionActions: isCompleted ? null : <SessionActions />,
    playPause: isCompleted ? null : <PlayPauseControl />,
    cancelMatch: isCompleted ? null : <CancelMatchButton />,
    matchExtras: isCompleted ? null : <MatchExtras />,
    matchLog: isCompleted ? null : <MatchLog />,
    completedActions: isCompleted ? <CompletedActions /> : null,

    setup:
      isCompleted || !showSessionSetup ? null : (
        <div data-tutorial="session-setup">
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
      ),

    scoring: isCompleted ? null : (
      <div data-tutorial="scoring">
        <LiveScoring />
      </div>
    ),

    matchEntry: isCompleted ? null : (
      <div data-tutorial="metrics">
        <MatchEntry />
      </div>
    ),

    breakdown: isCompleted ? null : <ScoreBreakdown />,

    notes: isCompleted ? null : (
      <div data-tutorial="notes">
        <Notes />
      </div>
    ),

    completionNotice: isCompleted ? (
      <div className="py-4 text-center space-y-4">
        <h2
          className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
        >
          Session Complete!
        </h2>
        <p
          className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
        >
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
    ) : null,
  };

  return (
    <div
      className={`min-h-[100dvh] page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'} relative`}
    >
      {navGuard.isBlocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div
            className={`max-w-sm w-full rounded-xl border p-6 text-center space-y-4 shadow-2xl ${
              isDarkMode
                ? 'bg-team-dark border-team-blue-40'
                : 'bg-white border-gray-200'
            }`}
          >
            <h3
              className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              Leave active session?
            </h3>
            <p
              className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              {navGuard.message}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={navGuard.reset}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  isDarkMode
                    ? 'border-team-blue-40 text-white hover:bg-team-white-10'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
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

      <LiveControlsProvider
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
          // A reset session comes back with default settings already filled
          // in, so go straight to Start rather than the settings panel.
          setIsSessionSetupSaved(true);
          setShowSessionSetup(false);
          setShouldFlashSetup(false);
        }}
      >
        <div className="max-w-6xl mx-auto md:px-6 lg:px-8 md:pt-6 md:pb-10 relative">
          <ActiveTutorial />
          {isCompact ? (
            <ActiveMobileLayout slots={slots} />
          ) : (
            <ActiveDesktopLayout slots={slots} />
          )}
        </div>
      </LiveControlsProvider>
    </div>
  );
};

export default Active;
