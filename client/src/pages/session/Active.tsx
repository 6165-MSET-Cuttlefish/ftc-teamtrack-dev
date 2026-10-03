import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { useActiveCompact } from '@/components/session/layout/useActiveCompact';
import { LivePhaseChip, PausedPill } from '@/components/session/MatchPhase';
import {
  matchClockSeconds,
  useMatchPaused,
} from '@/components/session/matchPhaseLabel';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TUTORIAL_ENDED_EVENT } from '@/constants/events';
import { useAuth, useTheme, useSession, useSessionCore } from '@/contexts';
import { useMatchAudio, useNavigationGuard } from '@/hooks';
import { useWakeLock } from '@/hooks/useWakeLock';
import { APP_CONFIG, ROUTES } from '@/constants';
import { matchScore, rankingPoints } from '@/lib';
import type { Match } from '@/types';

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

/**
 * Keeps the screen on while a match clock is counting, so a phone with a
 * short auto-lock doesn't sleep between taps. Not for the walkthrough's
 * practice match, and not for a clock that is paused or has run out.
 */
const ScreenAwake = () => {
  const {
    matchActive,
    matchPhase,
    isTimerRunning,
    isPickupPaused,
    isTutorialActive,
  } = useSessionCore();

  const counting =
    matchPhase === 'controller_pickup' ? !isPickupPaused : isTimerRunning;
  useWakeLock(matchActive && counting && !isTutorialActive);
  return null;
};

/** The big match clock. */
const MatchClock = () => {
  const { isDarkMode } = useTheme();
  const {
    timer,
    phaseTimer,
    matchPhase,
    matchActive,
    isTutorialActive,
    editingMatchId,
    formatTime,
  } = useSession();
  const paused = useMatchPaused();

  const timerColor =
    matchPhase === 'controller_pickup' && matchActive
      ? // yellow-400 is unreadable on the light background, and amber-600
        // is still under 4.5:1 there
        isDarkMode
        ? 'text-yellow-400'
        : 'text-amber-700'
      : isDarkMode
        ? 'text-white'
        : 'text-gray-900';

  // A clock that is not counting for the match in the fields steps back:
  // paused, or behind a saved match that is open for editing.
  const dimmed = paused || editingMatchId !== null;

  return (
    <div
      role="timer"
      aria-label="Match timer"
      data-match-timer
      // Smaller on a phone on its side, and a little smaller on a short
      // laptop screen, where every line above the scoring fields counts.
      className={`text-center tracking-wider leading-none transition-[color,opacity] font-righteous text-[clamp(3.5rem,20vw,5.5rem)] [@media(max-height:500px)]:text-[3.5rem] [@media(min-width:768px)_and_(min-height:501px)_and_(max-height:760px)]:text-[4.5rem] ${timerColor} ${dimmed ? 'opacity-40' : ''}`}
      style={{ letterSpacing: '0.05em' }}
    >
      {formatTime(
        matchClockSeconds({
          matchActive,
          matchPhase,
          timer,
          phaseTimer,
          isTutorialActive,
        })
      )}
    </div>
  );
};

/**
 * The clock with its phase beside it. The space for the phase is held open
 * at the width of the widest thing shown there, so the digits don't move
 * sideways when the match is paused.
 */
const MatchClockRow = () => {
  const paused = useMatchPaused();

  return (
    // On a phone held sideways, and on a short laptop screen, the digits
    // are shorter than the phase with the paused pill under it: the row is
    // as tall as that pair from the start, so pausing doesn't push the lines
    // below it down. A phone on its side too narrow for the clock's own
    // column has no height for that: the pill goes beside the phase there,
    // in room held open for it.
    <div className="flex items-center justify-center gap-3 md:grid md:grid-cols-[1fr_auto_1fr] [@media(max-height:500px)]:flex [@media(max-height:500px)_and_(min-width:640px)]:min-h-[4.75rem] [@media(min-width:768px)_and_(min-height:501px)_and_(max-height:760px)]:min-h-[4.75rem]">
      <span aria-hidden className="hidden md:block" />
      <MatchClock />
      <div className="flex flex-col items-start justify-center gap-1 min-w-[6.75rem] [@media(max-height:500px)_and_(max-width:639px)]:flex-row [@media(max-height:500px)_and_(max-width:639px)]:items-center [@media(max-height:500px)_and_(max-width:639px)]:justify-start [@media(max-height:500px)_and_(max-width:639px)]:min-w-[10.5rem]">
        <LivePhaseChip />
        {paused && <PausedPill stacked />}
      </div>
    </div>
  );
};

/**
 * The line under the clock: which match this is and how long the session
 * has run. While a saved match is open in the fields it says so instead —
 * the clock above belongs to the next match, not to the numbers on screen.
 */
const MatchStatus = () => {
  const { isDarkMode } = useTheme();
  const { sessionData, sessionTimer, formatTime, editingMatchId } =
    useSession();

  const matches = sessionData.matches ?? [];
  const editing = editingMatchId
    ? matches.find(match => match.id === editingMatchId)
    : undefined;

  if (editing) {
    return (
      <div
        data-match-editing
        className={`text-center text-sm sm:text-base font-bold uppercase tracking-wide whitespace-nowrap ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}
      >
        Editing Match {editing.matchNumber}
      </div>
    );
  }

  return (
    <div
      className={`text-center text-sm sm:text-base font-semibold whitespace-nowrap tabular-nums ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
    >
      Match {matches.length + 1}
      <span aria-hidden className="mx-2 opacity-60">
        ·
      </span>
      Session {formatTime(sessionTimer)}
    </div>
  );
};

/** Gap left between the sticky site header and what is scrolled to, in px */
const SCROLL_GAP = 8;

/**
 * The match saved last, under the clock: proof that Save landed, without a
 * trip to the Match Log at the end of the page. Pressing it goes there.
 *
 * The line is there from the first match on, saying so while there is
 * nothing to show: what is below it then sits at the same height in every
 * match of the session.
 */
const LastMatch = ({
  match,
  fallbackMatchType,
}: {
  match: Match | undefined;
  fallbackMatchType: string;
}) => {
  const { isDarkMode } = useTheme();
  const line = 'h-6 text-xs font-medium tabular-nums';

  if (!match) {
    return (
      <p
        className={`${line} flex items-center justify-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
      >
        No matches saved yet
      </p>
    );
  }

  const rp = rankingPoints({
    ...match,
    matchType: match.matchType || fallbackMatchType,
  }).total;

  const showLog = () => {
    const log = document.querySelector('[data-match-log]');
    if (!log) return;
    const headerBottom =
      document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    window.scrollBy({
      top: log.getBoundingClientRect().top - headerBottom - SCROLL_GAP,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };

  return (
    <button
      type="button"
      onClick={showLog}
      data-last-match
      // One line of text, so it costs the scoring controls one line of
      // height; the pseudo-element makes up the rest of a 44px target out
      // of the gaps above and below it.
      className={`${line} relative mx-auto min-h-0 max-w-full truncate px-3 underline decoration-dotted underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-2.5 ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
    >
      Last: Match {match.matchNumber} · {matchScore(match, fallbackMatchType)}{' '}
      pts{rp > 0 ? ` · ${rp} RP` : ''}
    </button>
  );
};

/**
 * What the leave prompt says, from what is actually at stake. Nothing is
 * thrown away by leaving the page — the session is kept on this device and
 * its clocks keep counting — so it says that instead of threatening a loss.
 */
const leaveMessage = (matchActive: boolean, savedCount: number): string => {
  const saved =
    savedCount === 0
      ? 'No match is saved yet.'
      : `Your ${savedCount} saved match${savedCount === 1 ? '' : 'es'} stay${savedCount === 1 ? 's' : ''} on this device until you complete the session.`;
  return matchActive
    ? `Match ${savedCount + 1} is still running: its clock keeps counting while you are away, and it can only be scored on this page. ${saved}`
    : `This session is not finished. ${saved}`;
};

/** "3 matches · best 158 · avg 128 · 18:53" for the completed screen. */
const sessionSummary = (
  matches: Match[],
  fallbackMatchType: string,
  duration: string | undefined
): string => {
  const scores = matches.map(match => matchScore(match, fallbackMatchType));
  const parts = [`${scores.length} match${scores.length === 1 ? '' : 'es'}`];
  if (scores.length > 0) {
    const average =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;
    parts.push(`best ${Math.max(...scores)}`, `avg ${Math.round(average)}`);
  }
  if (duration) parts.push(duration);
  return parts.join(' · ');
};

const Active = () => {
  const { isDarkMode } = useTheme();
  const { isGuest } = useAuth();
  const isCompact = useActiveCompact();
  const { sessionData, hasStarted, matchActive } = useSessionCore();

  const isSessionSetupSavedInit = () =>
    sessionData.sessionName?.trim().length > 0;
  const [showSessionSetup, setShowSessionSetup] = useState(
    () => !isSessionSetupSavedInit()
  );
  const [isSessionSetupSaved, setIsSessionSetupSaved] = useState(
    isSessionSetupSavedInit
  );
  const [shouldFlashSetup, setShouldFlashSetup] = useState(false);

  /** The session name as of the last render, for the handlers below */
  const sessionNameRef = useRef(sessionData.sessionName);
  useEffect(() => {
    sessionNameRef.current = sessionData.sessionName;
  }, [sessionData.sessionName]);

  useEffect(() => {
    document.title = `Active Session - ${APP_CONFIG.name}`;

    let settle: ReturnType<typeof setTimeout> | undefined;

    // The tutorial puts the session back as it found it when it ends. A
    // name emptied while it was up marked the settings unsaved (below), and
    // nothing marks them saved again when the name returns: once the
    // restored session has landed, go by the name, the same as when the
    // page loads.
    const handleTutorialEnded = () => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        if (sessionNameRef.current?.trim()) setIsSessionSetupSaved(true);
      }, 0);
    };
    window.addEventListener(TUTORIAL_ENDED_EVENT, handleTutorialEnded);
    return () => {
      clearTimeout(settle);
      window.removeEventListener(TUTORIAL_ENDED_EVENT, handleTutorialEnded);
    };
  }, []);

  const matches = sessionData.matches ?? [];
  const hasUnsavedWork = hasStarted && !sessionData.isSessionCompleted;
  const navGuard = useNavigationGuard(
    hasUnsavedWork,
    leaveMessage(matchActive, matches.length)
  );

  useEffect(() => {
    if (!sessionData.sessionName?.trim()) {
      setShowSessionSetup(true);
      setIsSessionSetupSaved(false);
    }
  }, [sessionData.sessionName]);

  const isCompleted = Boolean(sessionData.isSessionCompleted);
  const lastMatch = matches[matches.length - 1];
  const sessionName =
    sessionData.sessionName?.trim() || 'Active Practice Session';

  /**
   * Every section of the page, keyed by slot. This decides *whether* a
   * section applies; the layout decides *where* it goes. Keep the nodes free
   * of page-level spacing so both layouts can position them.
   */
  const slots: ActiveSlots = {
    title: isCompact ? (
      // One line beside the settings toggle. Once a match is running the
      // name is the least important thing on screen, and steps back.
      <h1
        className={`truncate text-left font-semibold leading-tight transition-colors ${
          matchActive
            ? `text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`
            : 'text-xl text-team-blue'
        }`}
      >
        {sessionName}
      </h1>
    ) : (
      <h1 className="text-center font-semibold text-team-blue text-[clamp(1.25rem,5vw,2.25rem)] [@media(max-height:760px)]:text-[1.75rem] leading-tight break-words [overflow-wrap:anywhere] min-w-0">
        {sessionName}
      </h1>
    ),

    // A finished session has no clock to show: the result takes its place
    timer: isCompleted ? null : <MatchClockRow />,

    status: isCompleted ? null : <MatchStatus />,

    lastMatch: isCompleted ? null : (
      <LastMatch match={lastMatch} fallbackMatchType={sessionData.matchType} />
    ),

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

    // The desktop's one-piece scoring pad: Hive Tips, robots, fouls, the
    // end-of-match fields and the breakdown band
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
      <div className="py-2 text-center space-y-3" data-session-complete>
        <h2
          className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
        >
          Session complete
        </h2>
        <p
          className={`text-base font-medium tabular-nums ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
        >
          {sessionSummary(
            matches,
            sessionData.matchType,
            sessionData.sessionDuration
          )}
        </p>
        {isGuest && (
          <p
            className={`text-sm ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            Saved on this device only ·{' '}
            <Link
              to={ROUTES.SIGNUP}
              className="font-semibold text-team-blue underline underline-offset-2"
            >
              Sign up to back it up
            </Link>
          </p>
        )}
      </div>
    ) : null,

    // Under the two buttons that matter here, as the way out
    completedLinks: isCompleted ? (
      <div className="flex justify-center">
        <ViewSessionsLink />
      </div>
    ) : null,
  };

  return (
    <div
      // No entry animation on a phone: it moves the page with a transform,
      // and for as long as it runs the bar pinned to the bottom of the
      // screen would be pinned to the bottom of the page instead.
      className={`min-h-[100dvh] ${isCompact ? '' : 'page-transition'} ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'} relative`}
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
      <ScreenAwake />

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
        {/* The phone layout brings its own gutters, at whatever width it is
            used (a phone on its side is wider than a small tablet). */}
        <div
          className={`max-w-6xl mx-auto relative ${isCompact ? '' : 'md:px-6 lg:px-8 md:pt-4 md:pb-10'}`}
        >
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
