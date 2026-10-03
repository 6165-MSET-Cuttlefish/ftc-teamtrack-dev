import { useEffect, useState } from 'react';
import {
  SessionSetup,
  Notes,
  LiveCounters,
  MatchEntry,
  ScoringPad,
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
  ViewSessionsLink,
  ActiveDesktopLayout,
  ActiveMobileLayout,
  type ActiveSlots,
} from '@/components';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  TUTORIAL_ENDED_EVENT,
  TUTORIAL_OPEN_SESSION_SETUP_EVENT,
} from '@/constants/events';
import { useTheme, useSession, useSessionCore } from '@/contexts';
import { useMatchAudio, useNavigationGuard, useIsCompact } from '@/hooks';
import { APP_CONFIG, GAME_TIMING } from '@/constants';

/*
 * The pieces below are the only parts of the page that follow the clocks.
 * They are components of their own so the once-a-second tick re-renders
 * them and nothing else: the page itself reads the session without its
 * clocks.
 */

/** Keeps the match audio in step with the clock; renders nothing. */
const MatchAudio = () => {
  useMatchAudio();
  return null;
};

/** The big match clock. */
const MatchClock = () => {
  const { isDarkMode } = useTheme();
  const { timer, phaseTimer, matchPhase, formatTime, getDisplayTimer } =
    useSession();

  const timerColor =
    matchPhase === 'controller_pickup'
      ? // yellow-400 is unreadable on the light background, and amber-600
        // is still under 4.5:1 there
        isDarkMode
        ? 'text-yellow-400'
        : 'text-amber-700'
      : isDarkMode
        ? 'text-white'
        : 'text-team-blue';

  return (
    <div
      role="timer"
      aria-label="Match timer"
      data-match-timer
      className={`text-center tracking-wider leading-none transition-colors font-righteous text-[clamp(3.5rem,20vw,5.5rem)] lg:text-[3.75rem] ${timerColor}`}
      style={{ letterSpacing: '0.05em' }}
    >
      {matchPhase === 'controller_pickup'
        ? formatTime(phaseTimer)
        : matchPhase === 'auton'
          ? formatTime(getDisplayTimer(timer, matchPhase))
          : formatTime(timer)}
    </div>
  );
};

/** Phase, session clock and match status, on the line under the clock. */
const MatchStatus = () => {
  const { isDarkMode } = useTheme();
  const {
    sessionData,
    timer,
    sessionTimer,
    formatTime,
    matchPhase,
    isTimerRunning,
    matchActive,
    isPickupPaused,
  } = useSession();

  /**
   * Controller pickup and the post-buzzer window both have the match clock
   * stopped without the user pausing anything, so neither may fall through
   * to "Paused" — pickup only reads as paused when its own countdown has
   * been. (Pickup is already named in the phase label beside this.)
   */
  const matchStatus = () => {
    if (!matchActive) return 'Not Started';
    if (matchPhase === 'controller_pickup')
      return isPickupPaused ? 'Paused' : 'Active';
    if (matchPhase === 'ended' || (timer === 0 && !isTimerRunning))
      return 'Ended';
    if (isTimerRunning) return 'Active';
    return 'Paused';
  };

  const matchNumber = (sessionData.matches?.length || 0) + 1;

  return (
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
        Match {matchNumber} {matchStatus()}
      </div>
    </div>
  );
};

const Active = () => {
  const { isDarkMode } = useTheme();
  const isCompact = useIsCompact();
  const { sessionData, hasStarted } = useSessionCore();

  const isSessionSetupSavedInit = () =>
    sessionData.sessionName?.trim().length > 0;
  const [showSessionSetup, setShowSessionSetup] = useState(
    () => !isSessionSetupSavedInit()
  );
  const [isSessionSetupSaved, setIsSessionSetupSaved] = useState(
    isSessionSetupSavedInit
  );
  const [shouldFlashSetup, setShouldFlashSetup] = useState(false);

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

  const isCompleted = Boolean(sessionData.isSessionCompleted);

  /**
   * Every section of the page, keyed by slot. This decides *whether* a
   * section applies; the layout decides *where* it goes. Keep the nodes free
   * of page-level spacing so both layouts can position them.
   */
  const slots: ActiveSlots = {
    title: (
      <h1 className="text-center font-semibold text-team-blue text-[clamp(1.25rem,5vw,2.25rem)] lg:text-3xl leading-tight break-words [overflow-wrap:anywhere] min-w-0">
        {sessionData.sessionName?.trim() || 'Active Practice Session'}
      </h1>
    ),

    timer: <MatchClock />,

    status: <MatchStatus />,

    openSetup: isCompleted ? null : <OpenSetupButton />,
    primaryAction: isCompleted ? null : <PrimaryAction />,
    sessionActions: isCompleted ? null : <SessionActions />,
    playPause: isCompleted ? null : <PlayPauseControl />,
    cancelMatch: isCompleted ? null : <CancelMatchButton />,
    matchExtras: isCompleted ? null : <MatchExtras />,
    matchLog: isCompleted ? null : <MatchLog />,
    completedActions: isCompleted ? <CompletedActions /> : null,

    liveScoring: isCompleted ? null : <LiveCounters />,

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

    matchEntry: isCompleted ? null : (
      <div data-tutorial="metrics">
        <MatchEntry />
      </div>
    ),

    scoring: isCompleted ? null : (
      <div data-tutorial="metrics">
        <ScoringPad />
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
          <ViewSessionsLink />
        </div>
      </div>
    ) : null,
  };

  return (
    <div
      className={`min-h-[100dvh] page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'} relative`}
    >
      <Dialog
        open={navGuard.isBlocked}
        onOpenChange={open => {
          if (!open) navGuard.reset();
        }}
      >
        <DialogContent
          className={`max-w-sm border p-6 text-center space-y-4 ${
            isDarkMode
              ? 'bg-team-dark border-team-blue-40'
              : 'bg-white border-gray-200'
          }`}
        >
          <DialogTitle
            className={`justify-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          >
            Leave active session?
          </DialogTitle>
          <p
            className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            {navGuard.message}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
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
              type="button"
              onClick={navGuard.proceed}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Leave
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <MatchAudio />

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
        <div className="max-w-6xl mx-auto md:px-6 lg:px-8 md:pt-3 md:pb-10 relative">
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
