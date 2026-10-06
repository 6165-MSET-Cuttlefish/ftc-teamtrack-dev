import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  SessionSetup,
  Notes,
  LiveCounters,
  MatchEntry,
  ScoringPad,
  ScoreBreakdown,
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
import { ClockDigits } from '@/components/session/ClockDigits';
import { SESSION_SETUP_PANEL_ID } from '@/components/session/controls/setupPanelId';
import { useActiveCompact } from '@/components/session/layout/useActiveCompact';
import { LivePhaseChip, PausedPill } from '@/components/session/MatchPhase';
import {
  matchClockText,
  useMatchPaused,
} from '@/components/session/matchPhaseLabel';
import {
  hasSeenTutorial,
  tutorialSeenKey,
} from '@/components/session/tutorialSeen';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PAGE_TITLE_CLASS } from '@/components/ui/page-header';
import { DATA_CLASS } from '@/components/ui/tokens';
import {
  TUTORIAL_ENDED_EVENT,
  TUTORIAL_RESTART_EVENT,
} from '@/constants/events';
import { useAuth, useTheme, useSession, useSessionCore } from '@/contexts';
import { useMatchAudio, useNavigationGuard } from '@/hooks';
import { useWakeLock } from '@/hooks/useWakeLock';
import { APP_CONFIG, ROUTES, STORAGE_KEYS } from '@/constants';
import { calculateScore, liveMatchType, matchScore } from '@/lib';
import { nextMatchNumber } from '@/lib/matchNumber';
import { formatPoints } from '@/lib/points';
import { cn } from '@/lib/utils';
import type { Match } from '@/types';

/**
 * In the tutorial's place when its code could not be fetched (offline, or
 * a tab left open across a deploy): the page carries on without it, and
 * asking for it says why nothing opens.
 */
const TutorialUnavailable = ({ openOnMount }: { openOnMount?: boolean }) => {
  useEffect(() => {
    const explain = () =>
      toast.error("The tutorial couldn't load. Reload the page to try again.", {
        id: 'tutorial-unavailable',
      });
    if (openOnMount) explain();
    window.addEventListener(TUTORIAL_RESTART_EVENT, explain);
    return () => window.removeEventListener(TUTORIAL_RESTART_EVENT, explain);
  }, [openOnMount]);
  return null;
};

/**
 * Fetched only when it is wanted (see `useTutorialWanted`). A failed fetch
 * must never take the scoring page down with it, so it settles for the
 * stand-in above rather than reaching the page's error boundary.
 */
const ActiveTutorial = lazy(() =>
  import('@/components/session/ActiveTutorial').then(
    module => ({ default: module.ActiveTutorial }),
    () => ({ default: TutorialUnavailable })
  )
);

/** Another page sent the user here to see the tutorial (see Header) */
const sentForTutorial = (): boolean => {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.START_TUTORIAL) !== null;
  } catch {
    return false;
  }
};

/**
 * Whether the tutorial is needed on the page: for a first run (nobody here
 * has seen it), when another page sent the user here for it, or once it is
 * asked for (`askedFor`: before it was on the page to hear the request).
 * Until then its code is not fetched at all. Once wanted it stays: it puts
 * the session back as it found it when it closes.
 */
const useTutorialWanted = (): { wanted: boolean; askedFor: boolean } => {
  const { user, isGuest, guestId, loading } = useAuth();
  const [kept, setKept] = useState(false);
  const [askedFor, setAskedFor] = useState(false);
  const [sent] = useState(sentForTutorial);

  const firstRun =
    !kept &&
    !loading &&
    (Boolean(user) || isGuest) &&
    !hasSeenTutorial(tutorialSeenKey(user?.uid, guestId));
  const wanted = kept || askedFor || sent || firstRun;

  useEffect(() => {
    if (wanted) {
      setKept(true);
      return;
    }
    const ask = () => setAskedFor(true);
    window.addEventListener(TUTORIAL_RESTART_EVENT, ask);
    return () => window.removeEventListener(TUTORIAL_RESTART_EVENT, ask);
  }, [wanted]);

  return { wanted, askedFor };
};

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

  // A clock that is not counting for the match in the fields steps back:
  // paused, or behind a saved match that is open for editing. The digits
  // keep the text colour in every phase; the chip beside them carries it.
  const dimmed = paused || editingMatchId !== null;
  const reading = matchClockText({
    matchActive,
    matchPhase,
    timer,
    phaseTimer,
    isTutorialActive,
    formatTime,
  });

  return (
    <div
      role="timer"
      aria-label="Match timer"
      data-match-timer
      // Always as wide as 'm:ss' (the 3-2-1's one digit sits in the middle
      // of that), so nothing beside it moves. On a phone it is sized to
      // leave the chip's track room beside it, smaller on a phone on its
      // side (smaller still where it shares its row with the title), and a
      // little smaller on a short laptop screen, where every line above the
      // scoring fields counts.
      className={`min-w-[2.3em] text-center leading-none transition-opacity font-righteous text-[clamp(3rem,min(20vw,calc((100vw_-_12.25rem)/2.3)),5.5rem)] [@media(max-height:500px)]:text-[3.5rem] [@media(max-height:500px)_and_(max-width:639px)]:text-[3rem] [@media(min-width:768px)_and_(min-height:501px)_and_(max-height:760px)]:text-[4.5rem] ${isDarkMode ? 'text-white' : 'text-gray-900'} ${dimmed ? 'opacity-40' : ''}`}
    >
      <ClockDigits text={reading} />
      <span className="sr-only">{reading}</span>
    </div>
  );
};

/**
 * The clock with its phase beside it. Three tracks, the outer two always
 * equal: the digits are in the middle of the row (and of the line under
 * it), and the phase starts at the same spot in its own track whatever the
 * digits read and whatever the chip says, paused included.
 */
const MatchClockRow = () => {
  const paused = useMatchPaused();

  return (
    // On a phone held sideways, and on a short laptop screen, the row keeps
    // the height it has always had there, so the lines below it sit where
    // they did.
    //
    // `data-clock-row` lets a layout that puts other things beside the
    // clock lay these three tracks out on its own row's (see
    // `ShortStackedTitleRow`).
    <div
      data-clock-row
      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:gap-3 [@media(max-height:500px)_and_(min-width:640px)]:min-h-[4.75rem] [@media(min-width:768px)_and_(min-height:501px)_and_(max-height:760px)]:min-h-[4.75rem]"
    >
      <span aria-hidden />
      <MatchClock />
      <div className="flex min-w-0 justify-start">
        {paused ? (
          <PausedPill size="clock" />
        ) : (
          <LivePhaseChip size="clock" keepIdleSpace />
        )}
      </div>
    </div>
  );
};

/** Muted text for the line under the clock */
const statusTone = (isDarkMode: boolean) =>
  isDarkMode ? 'text-gray-400' : 'text-gray-600';

/**
 * The line under the clock on a full-size screen: which match is next and
 * how long the session has run, then, once one is running, only which
 * match it is, with its total while the breakdown's own Total can't be
 * read (a short laptop, where it is below the bottom of the screen). Not
 * after the buzzer: Save says the total then, a line below this one.
 * Blank while a saved match is open in the fields: the header says which
 * one, and the clock above belongs to the next match, not to the numbers
 * on screen. One line in every state.
 */
const DesktopStatus = () => {
  const { isDarkMode } = useTheme();
  const {
    sessionData,
    sessionTimer,
    formatTime,
    editingMatchId,
    matchActive,
    matchPhase,
  } = useSession();
  const editing = editingMatchId !== null;
  const scoring = matchActive && !editing && matchPhase !== 'ended';
  const totalOutOfView = useOutOfView('[data-breakdown-total]', scoring);

  if (editing) return <div aria-hidden data-match-status className="h-6" />;

  // As Start numbers it: one past the highest saved (a deleted match leaves
  // a gap), so this line and the button under it name the same match
  const matchNumber = nextMatchNumber(sessionData.matches);
  const total =
    scoring && totalOutOfView
      ? calculateScore({
          ...sessionData,
          matchType: liveMatchType(sessionData, editingMatchId),
        }).total
      : null;
  const dot = (
    <span aria-hidden className="opacity-60">
      ·
    </span>
  );

  return (
    <div
      data-match-status
      className={`h-6 flex items-center justify-center gap-2 whitespace-nowrap text-sm sm:text-base font-semibold tabular-nums ${statusTone(isDarkMode)}`}
    >
      <span>Match {matchNumber}</span>
      {!matchActive && (
        <>
          {dot}
          <span>Session {formatTime(sessionTimer)}</span>
        </>
      )}
      {total !== null && (
        <>
          {dot}
          <span className={DATA_CLASS}>{formatPoints(total)}</span>
        </>
      )}
    </div>
  );
};

/**
 * How much of a number's line box may be off the screen with the number
 * still readable. The digits fill its middle (cap height, no descenders),
 * so with a fifth of the box gone at either edge less than a tenth of
 * their height is cut.
 */
const READABLE_CUT = 0.2;

/**
 * True while the element `selector` finds can't be read: more of it than
 * `READABLE_CUT` is under the site header or below the bottom of the
 * screen. Only looked at while `enabled`; false otherwise.
 */
const useOutOfView = (selector: string, enabled: boolean): boolean => {
  const [outOfView, setOutOfView] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = document.querySelector(selector);
      if (!el) {
        setOutOfView(false);
        return;
      }
      const rect = el.getBoundingClientRect();
      const top = Math.max(
        0,
        document.querySelector('header')?.getBoundingClientRect().bottom ?? 0
      );
      const shown =
        Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, top);
      setOutOfView(shown < rect.height * (1 - READABLE_CUT));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    schedule();

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // The page above it changing height (a question in the controls row)
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      setOutOfView(false);
    };
  }, [selector, enabled]);

  return enabled && outOfView;
};

/** Gap left between the sticky site header and what is scrolled to, in px */
const SCROLL_GAP = 8;

/** Scroll the Match Log up under the site header. */
const showMatchLog = () => {
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

/**
 * The phone's one line under the clock: how long the session has run and,
 * once a match is saved, that match (proof that Save landed, without a trip
 * to the Match Log at the end of the page; pressing it goes there). Which
 * match is next is already in the header and on Start, so it isn't here.
 *
 * One fixed-height line in every state, blank while a saved match is open
 * in the fields (the header says which): what is below it sits at the same
 * height from the first match to the last.
 */
const PhoneStatus = ({ fallbackMatchType }: { fallbackMatchType: string }) => {
  const { isDarkMode } = useTheme();
  const { sessionData, sessionTimer, formatTime, editingMatchId } =
    useSession();
  const line = 'h-6 text-xs min-[375px]:text-sm font-medium tabular-nums';

  if (editingMatchId !== null) {
    return <div aria-hidden data-match-status className={line} />;
  }

  const matches = sessionData.matches ?? [];
  const last: Match | undefined = matches[matches.length - 1];

  return (
    <div
      data-match-status
      className={`${line} flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap ${statusTone(isDarkMode)}`}
    >
      <span className="shrink-0">Session {formatTime(sessionTimer)}</span>
      {last && (
        <>
          <span aria-hidden className="shrink-0 opacity-60">
            ·
          </span>
          <button
            type="button"
            onClick={showMatchLog}
            data-last-match
            // As tall as the line, so it costs the scoring controls one
            // line of height; the pseudo-element makes up the rest of a
            // 44px target out of the gaps above and below it. The text is
            // cut short inside, not the button: cutting the button's own
            // overflow would cut that pseudo-element down to the text.
            className={`relative flex h-6 min-h-0 min-w-0 items-center after:absolute after:inset-x-0 after:-inset-y-2.5 ${isDarkMode ? 'hover:text-gray-200' : 'hover:text-gray-900'}`}
          >
            <span className="truncate underline decoration-dotted underline-offset-4">
              Last: Match {last.matchNumber} ·{' '}
              {formatPoints(matchScore(last, fallbackMatchType))}
            </span>
          </button>
        </>
      )}
    </div>
  );
};

/**
 * What the leave prompt says, in one sentence, from what is actually at
 * stake. Nothing is thrown away by leaving the page — the session is kept on
 * this device and its clocks keep counting — so it says that instead of
 * threatening a loss.
 */
const leaveMessage = (matchActive: boolean, matches: Match[]): string => {
  if (matchActive) {
    return `Match ${nextMatchNumber(matches)} keeps running while you're away, and can only be scored on this page.`;
  }
  const savedCount = matches.length;
  return savedCount === 0
    ? 'The session stays on this device until you complete it.'
    : `Your ${savedCount} saved match${savedCount === 1 ? '' : 'es'} stay${savedCount === 1 ? 's' : ''} on this device until you complete the session.`;
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
    leaveMessage(matchActive, matches)
  );
  const tutorial = useTutorialWanted();

  useEffect(() => {
    if (!sessionData.sessionName?.trim()) {
      setShowSessionSetup(true);
      setIsSessionSetupSaved(false);
    }
  }, [sessionData.sessionName]);

  // While the settings are open the title keeps the name as last saved,
  // not each keystroke of the one being typed (or the fallback, the moment
  // the field is cleared to type a new one).
  const [shownName, setShownName] = useState(sessionData.sessionName);
  if (!showSessionSetup && shownName !== sessionData.sessionName) {
    setShownName(sessionData.sessionName);
  }

  const isCompleted = Boolean(sessionData.isSessionCompleted);
  const sessionName = shownName?.trim() || 'Active Practice Session';

  /**
   * Every section of the page, keyed by slot. This decides *whether* a
   * section applies; the layout decides *where* it goes. Keep the nodes free
   * of page-level spacing so both layouts can position them.
   */
  const slots: ActiveSlots = {
    title: isCompact ? (
      // One line beside the settings toggle. Once a match is running the
      // name is the least important thing on screen: it is still the page's
      // title for a screen reader, but the row goes to Skip and Discard,
      // which then have room for their full labels. The shared title class,
      // cut down to that one line at every width (a phone on its side is
      // `sm`); cn drops a size's line height, so leading-tight follows each.
      <h1
        className={
          matchActive
            ? 'sr-only'
            : cn(
                PAGE_TITLE_CLASS,
                'truncate text-left text-xl font-semibold leading-tight sm:text-xl sm:leading-tight'
              )
        }
      >
        {sessionName}
      </h1>
    ) : (
      <h1
        className={cn(
          PAGE_TITLE_CLASS,
          // One line height at every size (the shared class lets the
          // larger size bring its own), and smaller on a short laptop
          // screen: every line above the scoring fields counts there.
          'text-center min-w-0 sm:leading-tight [@media(max-height:760px)]:text-[1.75rem]',
          // Steps back while a match runs, for the clock under it: the
          // colour only, so nothing below it moves
          matchActive && 'text-muted-foreground'
        )}
      >
        {sessionName}
      </h1>
    ),

    // A finished session has no clock to show: the result takes its place
    timer: isCompleted ? null : <MatchClockRow />,

    status: isCompleted ? null : isCompact ? (
      <PhoneStatus fallbackMatchType={sessionData.matchType} />
    ) : (
      <DesktopStatus />
    ),

    openSetup: isCompleted ? null : (
      <OpenSetupButton expanded={showSessionSetup} />
    ),
    primaryAction: isCompleted ? null : <PrimaryAction />,
    sessionActions: isCompleted ? null : <SessionActions />,
    playPause: isCompleted ? null : <PlayPauseControl />,
    cancelMatch: isCompleted ? null : <CancelMatchButton />,
    matchExtras: isCompleted ? null : <MatchExtras />,
    matchLog: isCompleted ? null : <MatchLog />,
    completedActions: isCompleted ? <CompletedActions /> : null,

    liveScoring: isCompleted ? null : <LiveCounters />,

    // The one element with the panel's id, which the Settings toggle names
    // as what it opens
    setup:
      isCompleted || !showSessionSetup ? null : (
        <div id={SESSION_SETUP_PANEL_ID} data-tutorial="session-setup">
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
      <ConfirmDialog
        open={navGuard.isBlocked}
        onOpenChange={open => {
          if (!open) navGuard.reset();
        }}
        title="Leave active session?"
        description={navGuard.message}
        cancelLabel="Stay"
        confirmLabel="Leave"
        onConfirm={navGuard.proceed}
      />

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
            used (a phone on its side is wider than a small tablet). The
            site header lines its ends up with this column plus the layout's
            own px-4 (ACTIVE_PAGE_CONTAINER in constants/layout.ts): change
            that too if the width or padding here changes. */}
        <div
          className={`max-w-6xl mx-auto relative ${isCompact ? '' : 'md:px-6 lg:px-8 md:pt-4 md:pb-10'}`}
        >
          {tutorial.wanted && (
            <Suspense fallback={null}>
              <ActiveTutorial openOnMount={tutorial.askedFor} />
            </Suspense>
          )}
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
