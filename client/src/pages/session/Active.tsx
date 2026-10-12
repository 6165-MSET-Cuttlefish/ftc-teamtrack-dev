import { lazy, Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Notes,
  LiveCounters,
  MatchEntry,
  ScoringPad,
  ScoreBreakdown,
  LiveControlsProvider,
  PrimaryAction,
  PlayPauseControl,
  CancelMatchButton,
  MatchExtras,
  MatchLog,
  ActiveDesktopLayout,
  ActiveMobileLayout,
  type ActiveSlots,
} from '@/components';
import { ClockDigits } from '@/components/session/ClockDigits';
import { SessionMenu } from '@/components/session/controls/SessionMenu';
import { StaleSessionNotice } from '@/components/session/controls/StaleSessionNotice';
import {
  useActiveCompact,
  useActiveSideBySide,
} from '@/components/session/layout/useActiveCompact';
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
import { TUTORIAL_RESTART_EVENT } from '@/constants/events';
import { useAuth, useTheme, useSession, useSessionCore } from '@/contexts';
import { useMatchAudio, useNavigationGuard } from '@/hooks';
import { useWakeLock } from '@/hooks/useWakeLock';
import { APP_CONFIG, STORAGE_KEYS } from '@/constants';
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
 * How long the screen is kept on after the last tap or key while a match is
 * stopped (paused, or counted after the buzzer), in ms
 */
const STOPPED_AWAKE_MS = 3 * 60 * 1000;

/**
 * Keeps the screen on for a match, from Start until it is saved or
 * discarded, so a phone with a short auto-lock doesn't sleep on the scorer:
 * between taps while the clock counts, through a field-fault pause, and
 * while the refs settle the field before the count. While the clock is
 * stopped it lets go once nobody has touched the page for a while, so a
 * phone left on a table doesn't stay lit for an hour. Not for the
 * walkthrough's practice match.
 */
const ScreenAwake = () => {
  const {
    matchActive,
    matchPhase,
    isTimerRunning,
    isPickupPaused,
    isTutorialActive,
  } = useSessionCore();
  const [stoppedIdle, setStoppedIdle] = useState(false);

  const counting =
    matchPhase === 'controller_pickup' ? !isPickupPaused : isTimerRunning;
  const stopped = matchActive && !counting;

  useEffect(() => {
    setStoppedIdle(false);
    if (!stopped) return;
    let timer = setTimeout(() => setStoppedIdle(true), STOPPED_AWAKE_MS);
    const touched = () => {
      clearTimeout(timer);
      setStoppedIdle(false);
      timer = setTimeout(() => setStoppedIdle(true), STOPPED_AWAKE_MS);
    };
    window.addEventListener('pointerdown', touched, { passive: true });
    window.addEventListener('keydown', touched);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', touched);
      window.removeEventListener('keydown', touched);
    };
  }, [stopped]);

  useWakeLock(matchActive && !isTutorialActive && (counting || !stoppedIdle));
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
  // Still 3:1 dimmed: a step less faded on the light page.
  const dimmed = paused || editingMatchId !== null;
  const dimClass = isDarkMode ? 'opacity-40' : 'opacity-50';
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
      className={`min-w-[2.3em] text-center leading-none transition-opacity font-righteous text-[clamp(3rem,min(20vw,calc((100vw_-_12.25rem)/2.3)),5.5rem)] [@media(max-height:500px)]:text-[3.5rem] [@media(max-height:500px)_and_(max-width:639px)]:text-[3rem] [@media(min-width:768px)_and_(min-height:501px)_and_(max-height:760px)]:text-[4.5rem] ${isDarkMode ? 'text-white' : 'text-gray-900'} ${dimmed ? dimClass : ''}`}
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
    //
    // Under 260px wide (a phone at 200% zoom) the digits leave no room for
    // the phase beside them: it goes under them, both in the middle.
    <div
      data-clock-row
      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:gap-3 max-[259px]:flex max-[259px]:flex-col max-[259px]:gap-1 [@media(max-height:500px)_and_(min-width:640px)]:min-h-[4.75rem] [@media(min-width:768px)_and_(min-height:501px)_and_(max-height:760px)]:min-h-[4.75rem]"
    >
      <span aria-hidden className="max-[259px]:hidden" />
      <MatchClock />
      <div className="flex min-w-0 justify-start">
        {paused ? (
          <PausedPill size="clock" />
        ) : (
          <LivePhaseChip size="clock" keepSpace />
        )}
      </div>
    </div>
  );
};

/** Muted text for the line under the clock */
const statusTone = (isDarkMode: boolean) =>
  isDarkMode ? 'text-gray-400' : 'text-gray-600';

/**
 * Between two facts on the line under the clock ("Match 2", "Session
 * 4:10"): a hairline, as between the match and its points in the header.
 */
const StatusDivider = ({ className = '' }: { className?: string }) => {
  const { isDarkMode } = useTheme();
  return (
    <span
      aria-hidden
      className={`h-4 w-px shrink-0 ${className} ${isDarkMode ? 'bg-team-white-20' : 'bg-gray-300'}`}
    />
  );
};

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
  const divider = <StatusDivider />;

  return (
    <div
      data-match-status
      className={`h-6 flex items-center justify-center gap-3 whitespace-nowrap text-sm sm:text-base font-semibold tabular-nums ${statusTone(isDarkMode)}`}
    >
      <span>Match {matchNumber}</span>
      {!matchActive && (
        <>
          {divider}
          <span>Session {formatTime(sessionTimer)}</span>
        </>
      )}
      {total !== null && (
        <>
          {divider}
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
 * The line the breakdown card's Total is on (its heading's), for a phone on
 * its side, where the card has one while a match runs (see ScoreBreakdown)
 */
const CARD_TOTAL_LINE = '[data-breakdown-card] h2';

/**
 * The phone's one line under the clock: how long the session has run and,
 * once a match is saved, that match (proof that Save landed, without a trip
 * to the Match Log at the end of the page; pressing it goes there). Which
 * match is next is already in the header and on Start, so it isn't here.
 *
 * On its side, the header has nothing in its middle while a match is on (the
 * clock has a column of its own), so this line says what the header says
 * held upright: which match it is, with its total until the buzzer, while
 * the breakdown card's Total can't be read (it is the last thing in the
 * scoring column, a scroll down). Save says the total after the buzzer.
 *
 * One fixed-height line in every state, blank while a saved match is open
 * in the fields (the header says which): what is below it sits at the same
 * height from the first match to the last.
 *
 * At a 200% zoom the line has room for only one of the two, and once a
 * match is saved that one is the last match: cut short beside the session's
 * time, its points never showed.
 */
const PhoneStatus = ({ fallbackMatchType }: { fallbackMatchType: string }) => {
  const { isDarkMode } = useTheme();
  const {
    sessionData,
    sessionTimer,
    formatTime,
    editingMatchId,
    matchActive,
    matchPhase,
  } = useSession();
  const sideBySide = useActiveSideBySide();
  const editing = editingMatchId !== null;
  const namesMatch = sideBySide && matchActive && !editing;
  const totalOutOfView = useOutOfView(
    CARD_TOTAL_LINE,
    namesMatch && matchPhase !== 'ended'
  );
  const line = 'h-6 text-xs min-[375px]:text-sm font-medium tabular-nums';
  const lineClass = `${line} flex min-w-0 items-center justify-center gap-2.5 whitespace-nowrap ${statusTone(isDarkMode)}`;
  const divider = <StatusDivider />;

  if (editing) {
    return <div aria-hidden data-match-status className={line} />;
  }

  if (namesMatch) {
    // Not editing, so the fields hold the running match, of the session's type
    const total = totalOutOfView ? calculateScore(sessionData).total : null;
    return (
      <div data-match-status className={lineClass}>
        <span>Match {nextMatchNumber(sessionData.matches)}</span>
        {total !== null && (
          <>
            {divider}
            <span className={DATA_CLASS}>{formatPoints(total)}</span>
          </>
        )}
      </div>
    );
  }

  const matches = sessionData.matches ?? [];
  const last: Match | undefined = matches[matches.length - 1];

  return (
    <div data-match-status className={lineClass}>
      <span className={`shrink-0 ${last ? 'max-[279px]:hidden' : ''}`}>
        Session {formatTime(sessionTimer)}
      </span>
      {last && (
        <>
          <StatusDivider className="max-[279px]:hidden" />
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
              Last: Match {last.matchNumber},{' '}
              {formatPoints(matchScore(last, fallbackMatchType))}
            </span>
          </button>
        </>
      )}
    </div>
  );
};

/**
 * The way away from /active that asks first: while a match is on. Nothing
 * is lost by leaving (the match and its clock are kept in this browser), so
 * going ahead is the ordinary blue, not red; the question is only there
 * because a match can be scored and saved from this page alone. Between
 * matches leaving simply leaves (the header has the way back), Sign up
 * included: signing up carries the session into the new account.
 */
const leaveQuestion = (matchEnded: boolean, matchNumber: number) =>
  matchEnded
    ? {
        title: `Match ${matchNumber} isn't saved yet`,
        description:
          'It stays here until you save it, and you can only count and save it on this page.',
      }
    : {
        title: `Match ${matchNumber} is still running`,
        description:
          'Its clock keeps going, and you can only score it on this page.',
      };

/**
 * Whether the match on now was started on this page, rather than found on
 * as the page opened. One found on can be from an earlier day (left at its
 * buzzer), which the stale-session notice is there for: "Finish it, start
 * new" keeps it, dated when it was played. One started here is today's.
 */
const useMatchStartedHere = (matchActive: boolean): boolean => {
  const [seen, setSeen] = useState({ matchActive, startedHere: false });
  // Kept in step as it renders, so it holds from the commit the match
  // starts in
  if (seen.matchActive !== matchActive) {
    setSeen({ matchActive, startedHere: matchActive });
  }
  return matchActive && seen.startedHere;
};

const Active = () => {
  const { isDarkMode } = useTheme();
  const isCompact = useActiveCompact();
  const { sessionData, matchActive, matchPhase, isTutorialActive } =
    useSessionCore();
  const matchStartedHere = useMatchStartedHere(matchActive);

  useEffect(() => {
    document.title = `Active Session - ${APP_CONFIG.name}`;
  }, []);

  // Asked only while a match is on, and never by the browser on a reload or
  // a closed tab: the page comes back exactly as it was (see leaveQuestion).
  const leave = leaveQuestion(
    matchActive && matchPhase === 'ended',
    nextMatchNumber(sessionData.matches)
  );
  // Not the walkthrough's practice match: it goes back when the page does.
  const navGuard = useNavigationGuard(
    matchActive && !isTutorialActive && !sessionData.isSessionCompleted,
    leave.description,
    { beforeUnload: false }
  );
  const tutorial = useTutorialWanted();

  const sessionName =
    sessionData.sessionName?.trim() || 'Active Practice Session';

  /**
   * Every section of the page, keyed by slot. This decides *whether* a
   * section applies; the layout decides *where* it goes. Keep the nodes free
   * of page-level spacing so both layouts can position them.
   */
  const slots: ActiveSlots = {
    // Not over a match started here, paused or at its buzzer: nothing on
    // the page moves while a match is on, and a session in use today is
    // not one left open since an earlier day.
    staleNotice: matchStartedHere ? null : <StaleSessionNotice />,

    title: isCompact ? (
      // One line beside the session menu. Once a match is running the name
      // is the least important thing on screen: it is still the page's
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

    timer: <MatchClockRow />,

    status: isCompact ? (
      <PhoneStatus fallbackMatchType={sessionData.matchType} />
    ) : (
      <DesktopStatus />
    ),

    sessionMenu: <SessionMenu />,
    primaryAction: <PrimaryAction />,
    playPause: <PlayPauseControl />,
    cancelMatch: <CancelMatchButton />,
    matchExtras: <MatchExtras />,
    matchLog: <MatchLog />,

    liveScoring: <LiveCounters />,

    matchEntry: (
      <div data-tutorial="metrics">
        <MatchEntry />
      </div>
    ),

    // The desktop's one-piece scoring pad: Hive Tips, robots, fouls, the
    // end-of-match fields and the breakdown band
    scoring: (
      <div data-tutorial="metrics">
        <ScoringPad />
      </div>
    ),

    breakdown: <ScoreBreakdown />,

    notes: (
      <div data-tutorial="notes">
        <Notes />
      </div>
    ),
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
        tone="primary"
        title={leave.title}
        description={leave.description}
        cancelLabel="Keep scoring"
        confirmLabel="Leave"
        onConfirm={navGuard.proceed}
      />

      <MatchAudio />
      <ScreenAwake />

      <LiveControlsProvider>
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
