import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useTheme, useAuth, useSessionCore } from '@/contexts';
import {
  TUTORIAL_RESTART_EVENT,
  TUTORIAL_ENDED_EVENT,
} from '@/constants/events';
import { GAME_TIMING, STORAGE_KEYS } from '@/constants';
import { POINTS } from '@/lib';
import { nextMatchNumber } from '@/lib/matchNumber';
import { setWalkthroughSession } from '@/lib/signOutLoss';
import { formatTime } from '@/lib/utils';
import type { MatchPhase, SessionFormData } from '@/types';
import { useActiveCompact } from './layout/useActiveCompact';
import {
  hasSeenTutorial as seenUnder,
  tutorialSeenKey,
  writeFlag,
} from './tutorialSeen';
import { Spotlight } from './tutorial/Spotlight';
import { WelcomeCard } from './tutorial/WelcomeCard';
import {
  EDGE_MIN,
  isPinned,
  screenFloor,
  spotlitRect,
} from './tutorial/geometry';
import {
  BODY_TEXT,
  CARD_SURFACE,
  MUTED_TEXT,
  cardShadow,
  cardVars,
  primaryButton,
  quietButton,
  secondaryButton,
} from './tutorial/cardUi';

/** What a step's text can say about the page as it is right now */
interface StepContext {
  /** What the button that starts a match reads, e.g. "Start Match 1" */
  startLabel: string;
  /** True at phone width, where the header folds its buttons into a menu */
  narrow: boolean;
  /**
   * True when the page uses its phone layout, where the robots are below
   * Hive Tips. The full-size layout has them beside it, with a scrim's
   * penalties beside the robots.
   */
  compact: boolean;
  /** The match type a match started now would be: Full Game, Autonomous or Teleop */
  matchType: string;
  /** A Scrim, where penalties are counted */
  scrim: boolean;
  /** No mouse, so nothing is clicked and there is no keyboard to press keys on */
  touch: boolean;
}

interface StepDef {
  title: string;
  body: (context: StepContext) => React.ReactNode;
  /** `data-tutorial` attribute of the page element to spotlight */
  target: string | null;
  /** Spotlit instead when the page has no `target` element */
  fallbackTarget?: string;
  /**
   * False when the step only points at its element: it is shown, but can't
   * be pressed until the walkthrough has moved on.
   */
  interactive?: boolean;
  /** Prompt shown when the user should interact with the real page element */
  pageAction?: string;
  /** Session field watched for automatic task completion */
  watchKey?: 'tipping';
}

/** What the clock does once Start is pressed, for the match type about to be played */
const timingSentence = (matchType: string): string => {
  const auto = formatTime(GAME_TIMING.AUTONOMOUS_DURATION_SECONDS);
  const teleop = formatTime(GAME_TIMING.TELEOP_DURATION_SECONDS);
  // The FLOWERS on the field unlock mid-TELEOP, but End of Match (where the
  // flowers are counted) waits for the buzzer: say so, or "unlock" reads as
  // those counters opening.
  const flowers = `Flowers unlock at ${formatTime(GAME_TIMING.FLOWERS_UNLOCK_REMAINING)}; count them after the buzzer.`;
  switch (matchType) {
    case 'Autonomous':
      return `The clock runs Auto (${auto}).`;
    case 'Teleop':
      return `The clock runs Teleop (${teleop}). ${flowers}`;
    default:
      return `After a 3-2-1: Auto (${auto}), an ${GAME_TIMING.CONTROLLER_PICKUP_SECONDS}-second controller pickup, then Teleop (${teleop}). ${flowers}`;
  }
};

/** Secondary text: smaller, in the card's muted colour */
const Aside = ({ children }: { children: React.ReactNode }) => (
  <p className={MUTED_TEXT}>{children}</p>
);

const STEPS: StepDef[] = [
  {
    title: 'Start a match',
    body: ({ startLabel, matchType }) => (
      <div className="space-y-2">
        <p>
          Press {startLabel}. {timingSentence(matchType)}
        </p>
        <Aside>Nothing you do in this tutorial is saved.</Aside>
      </div>
    ),
    target: 'controls',
    interactive: false,
  },
  {
    title: 'Score while you watch',
    body: ({ compact, scrim, touch }) => (
      <div className="space-y-2">
        <p>
          {compact
            ? `Tap +1 Tip each time your alliance tips the hive (${POINTS.HIVE_TIP} pts). Mis-tap? Use \u2212.`
            : touch
              ? `Tap the Hive Tips pad for each tip (${POINTS.HIVE_TIP} pts).`
              : `Click the Hive Tips pad or press T for each tip (${POINTS.HIVE_TIP} pts).`}
        </p>
        {scrim && (
          <Aside>
            Count your Minor ({POINTS.MINOR_PENALTY}) and Major (
            {POINTS.MAJOR_PENALTY}) penalties{' '}
            {compact ? 'under the robots' : 'beside the robots'}: they go to the
            opponent, never off your score.
          </Aside>
        )}
      </div>
    ),
    target: 'live',
    fallbackTarget: 'metrics',
    pageAction: 'Try it: add a Hive Tip',
    watchKey: 'tipping',
  },
  {
    title: 'After the buzzer',
    body: () => (
      <p>
        Count what&apos;s left on the field once play stops, then save. The (i)
        beside each name has the full rule.
      </p>
    ),
    target: 'end-of-match',
  },
  {
    title: 'Save and finish',
    body: ({ narrow }) => (
      <div className="space-y-2">
        <p>
          Save each match when it ends. When you&apos;re done, press Complete
          Session and your matches show up in Sessions.
        </p>
        <Aside>
          Replay this tutorial from{' '}
          {narrow ? 'Tutorial in the header menu' : 'the (?) in the header'}{' '}
          when no match is running.
        </Aside>
      </div>
    ),
    target: null,
  },
];

const SCORING_STEP = STEPS.findIndex(s => s.watchKey === 'tipping');

/**
 * Stacking order while the walkthrough is up: the page, the dim with its
 * opening, the site header (raised so a spotlit element scrolls under it
 * like everything else, and dimmed by a strip of its own), then the card.
 */
const Z_BACKDROP = 9997;
const Z_HEADER = 10000;
const Z_CARD = 10001;

/** Viewports narrower than this get a card as wide as the screen */
const NARROW_WIDTH = 640;
/** Viewports shorter than this (a phone on its side) get the one-row card */
const SHORT_HEIGHT = 500;
/** Space kept between the card and the spotlight's ring, in px */
const CARD_GAP = 12;
/** Space kept between the spotlight's ring and the header, in px */
const TARGET_PAD = 8;
/** Least body text a shrunken card still shows (two lines), in px */
const MIN_BODY_HEIGHT = 46;
/** Least of an element too tall for the screen kept in view under the card, in px */
const TALL_TARGET_SHOWN = 160;
/** The phone's match controls, pinned over the bottom of the screen */
const BOTTOM_BAR = '[data-tutorial="controls"]';
/** A height change smaller than this is the URL bar sliding, not a new layout */
const URL_BAR_HEIGHT = 120;
/** Scrolls the walkthrough may make for one element: the first and two corrections */
const MAX_AUTO_SCROLLS = 3;
/** One of its scrolls that comes to rest within this of where it was sent has arrived, in px */
const SCROLL_ARRIVED = 24;

const cardLayout = (width: number, height: number) => {
  const short = height < SHORT_HEIGHT;
  const fullWidth = short || width < NARROW_WIDTH;
  return { short, fullWidth, gutter: fullWidth ? 12 : 24 };
};

type Dock = 'top' | 'bottom';

interface CardPlacement {
  dock: Dock;
  /** Distance from that edge of the screen, when not the gutter */
  inset: number | null;
  /** Height the card may take without covering the spotlit element */
  maxHeight: number | null;
}

const DEFAULT_PLACEMENT: CardPlacement = {
  dock: 'bottom',
  inset: null,
  maxHeight: null,
};

const BLOCKED_TOAST_ID = 'tutorial-blocked';

/**
 * Session state as it was before the walkthrough started using it. Kept in
 * memory only, never in storage: SessionProvider stores nothing while the
 * walkthrough is open, so a reload or a closed tab (which never reach
 * dismiss) comes back to the stored session as the walkthrough found it —
 * exactly what a reload without the walkthrough would show.
 */
interface TutorialSnapshot {
  sessionData: SessionFormData;
  matchActive: boolean;
  matchPhase: MatchPhase;
  timer: number;
  isTimerRunning: boolean;
  hasStarted: boolean;
  sessionTimer: number;
  phaseTimer: number;
}

const ORIGINAL_STYLES_KEY = '__tt_original_styles__';

/**
 * An element the step only points at: it shows through the spotlight as it
 * is, but takes no taps and no keys until the walkthrough has moved on.
 */
function holdElement(el: HTMLElement) {
  (el as unknown as Record<string, unknown>)[ORIGINAL_STYLES_KEY] = {
    pointerEvents: el.style.pointerEvents,
    inert: el.inert,
  };
  el.style.pointerEvents = 'none';
  el.inert = true;
}

function releaseElement(el: HTMLElement) {
  const orig = (el as unknown as Record<string, unknown>)[
    ORIGINAL_STYLES_KEY
  ] as { pointerEvents?: string; inert?: boolean } | undefined;
  if (orig) {
    el.inert = orig.inert ?? false;
    el.style.pointerEvents = orig.pointerEvents ?? '';
    delete (el as unknown as Record<string, unknown>)[ORIGINAL_STYLES_KEY];
  }
}

/** Smooth scrolling, unless the user has asked for less motion */
const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'instant'
    : 'smooth';

const queryTarget = (id: string) =>
  document.querySelector<HTMLElement>(`[data-tutorial="${id}"]`);

/** True for anything that uses the arrow keys itself. */
const usesArrowKeys = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest(
      'input, textarea, select, [role="radiogroup"], [role="listbox"], [role="slider"], [role="tablist"], [role="menu"]'
    ) !== null
  );
};

/**
 * The tutorial over /active. Its code is fetched only once it is needed
 * (see Active.tsx), so a replay can be asked for before it is on the page:
 * `openOnMount` opens it then, as that request would have.
 *
 * A first run opens on a welcome card over the page as it is, nothing
 * dimmed, so a newcomer sees the real app before deciding anything; only
 * "Take the tour" starts the spotlit steps. Asked for again (the (?) in the
 * header), it goes straight to the first step.
 */
export const ActiveTutorial = ({
  openOnMount = false,
}: {
  openOnMount?: boolean;
}) => {
  const { isDarkMode } = useTheme();
  const isCompactLayout = useActiveCompact();
  const { user, isGuest, guestId, loading } = useAuth();
  const {
    sessionData,
    matchActive,
    editingMatchId,
    setMatchActive,
    setMatchPhase,
    setIsTimerRunning,
    updateSessionData,
    replaceSessionData,
    setIsTutorialActive,
    getTimers,
    setTimer,
    matchPhase,
    isTimerRunning,
    hasStarted,
    setHasStarted,
    setSessionTimer,
    setPhaseTimer,
  } = useSessionCore();

  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  /**
   * The welcome card is up rather than a step: the page is left as it is,
   * usable and undimmed, and nothing of the session is borrowed yet.
   */
  const [welcome, setWelcome] = useState(false);
  /** The spotlit steps are up */
  const touring = visible && !welcome;
  const [taskCompleted, setTaskCompleted] = useState(false);
  /** True when the user has finished the tutorial before — tasks are pre-skipped */
  const [isReplay, setIsReplay] = useState(false);
  /** The page element currently spotlit, once it exists */
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  /** Bumped to spotlight the step's element afresh after the page replaced it */
  const [spotlightEpoch, setSpotlightEpoch] = useState(0);
  const [placement, setPlacement] = useState<CardPlacement>(DEFAULT_PLACEMENT);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  /** Bottom edge of the sticky site header, in px from the top of the screen */
  const [headerBottom, setHeaderBottom] = useState(0);

  /** `targetEl` for the placement code, which runs outside of renders too */
  const targetElRef = useRef<HTMLElement | null>(null);
  /** Where the placement code sent the page, while that scroll is under way */
  const autoScrollRef = useRef<number | null>(null);
  /** Scrolls the placement code has made for the element now spotlit */
  const autoScrollCountRef = useRef(0);
  /** Lowest the header's bottom edge has been while that element was spotlit */
  const headerEdgeRef = useRef(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  /** What had focus when the walkthrough opened, to hand it back on close */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  /** True while the session holds the practice match the scoring steps use */
  const practiceMatchRef = useRef(false);
  /** Tutorial key the first-run check has already been made for */
  const autoOpenCheckedRef = useRef<string | null>(null);

  /** Session state captured before the tutorial ran, restored when it ends */
  const snapshotRef = useRef<TutorialSnapshot | null>(null);

  /** What the session is doing right now, for handlers that outlive a render */
  /** Number of the saved match open in the fields, if one is */
  const editingMatchNumber =
    editingMatchId !== null
      ? (sessionData.matches?.find(m => m.id === editingMatchId)?.matchNumber ??
        null)
      : null;
  const liveRef = useRef({
    visible,
    matchActive,
    isTimerRunning,
    hasStarted,
    editing: editingMatchId !== null,
    editingMatchNumber,
    matchCount: sessionData.matches?.length ?? 0,
  });
  useEffect(() => {
    liveRef.current = {
      visible,
      matchActive,
      isTimerRunning,
      hasStarted,
      editing: editingMatchId !== null,
      editingMatchNumber,
      matchCount: sessionData.matches?.length ?? 0,
    };
  });

  const getTutorialKey = useCallback(
    () => tutorialSeenKey(user?.uid, guestId),
    [user, guestId]
  );

  /** Seen by this identity, or on this device by anyone */
  const hasSeenTutorial = useCallback(
    () => seenUnder(getTutorialKey()),
    [getTutorialKey]
  );

  /**
   * Full replacement, so values typed during the tutorial never leak into the
   * user's real session.
   */
  const restoreSnapshot = useCallback(
    (snapshot: TutorialSnapshot) => {
      replaceSessionData(snapshot.sessionData);
      setMatchActive(snapshot.matchActive);
      setMatchPhase(snapshot.matchPhase);
      setTimer(snapshot.timer);
      setIsTimerRunning(snapshot.isTimerRunning);
      setHasStarted(snapshot.hasStarted);
      setSessionTimer(snapshot.sessionTimer);
      setPhaseTimer(snapshot.phaseTimer);
    },
    [
      replaceSessionData,
      setMatchActive,
      setMatchPhase,
      setTimer,
      setIsTimerRunning,
      setHasStarted,
      setSessionTimer,
      setPhaseTimer,
    ]
  );

  /**
   * Show the walkthrough: the welcome card on a first run (`askedFor`
   * false), the first step when asked for. Refused while a match is live:
   * it borrows the session and puts back what it found when it closes,
   * which over a running match would undo scoring and rewind the clock.
   * Refused while a saved match is open for editing too: the fields then
   * hold that match, and which match they belong to is not part of what is
   * put back.
   */
  const open = useCallback((askedFor: boolean) => {
    const live = liveRef.current;
    if (live.visible) {
      setWelcome(false);
      setStep(0);
      setTaskCompleted(false);
      return;
    }
    if (live.matchActive || live.isTimerRunning) {
      if (askedFor) {
        toast.info('Finish or discard this match to replay the tutorial', {
          id: BLOCKED_TOAST_ID,
        });
      }
      return;
    }
    if (live.editing) {
      if (askedFor) {
        toast.info(
          live.editingMatchNumber !== null
            ? `Save or discard your Match ${live.editingMatchNumber} changes to replay the tutorial`
            : 'Save or discard your changes to replay the tutorial',
          { id: BLOCKED_TOAST_ID }
        );
      }
      return;
    }
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : null;
    setWelcome(!askedFor);
    setStep(0);
    setTaskCompleted(false);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!sessionStorage.getItem(STORAGE_KEYS.START_TUTORIAL)) return;
    // The flag is only spent once the timer fires: an effect that is torn
    // down first (StrictMode runs each one twice) must leave it in place.
    const t = setTimeout(() => {
      sessionStorage.removeItem(STORAGE_KEYS.START_TUTORIAL);
      open(true);
    }, 500);
    return () => clearTimeout(t);
  }, [open]);

  // Asked for again (Tutorial in the header) before this was on the page:
  // the request came before there was anything here to hear it.
  const openOnMountRef = useRef(openOnMount);
  useEffect(() => {
    if (openOnMountRef.current) open(true);
  }, [open]);

  useEffect(() => {
    if (!touring) return;
    const { timer, sessionTimer, phaseTimer } = getTimers();
    const snapshot: TutorialSnapshot = {
      sessionData: JSON.parse(JSON.stringify(sessionData)),
      matchActive,
      matchPhase,
      timer,
      isTimerRunning,
      hasStarted,
      sessionTimer,
      phaseTimer,
    };
    snapshotRef.current = snapshot;
    practiceMatchRef.current = false;
    // Signing out from here must still ask about the matches in it, even
    // when storage has no copy of them to ask about.
    setWalkthroughSession(snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touring]); // snapshot once per tour, not on every state change

  // First run for this account or guest: open by itself, once.
  useEffect(() => {
    if (loading) return;
    if (!user && !isGuest) return;
    const key = getTutorialKey();
    if (autoOpenCheckedRef.current === key) return;
    if (hasSeenTutorial()) {
      autoOpenCheckedRef.current = key;
      return;
    }
    const t = setTimeout(() => {
      autoOpenCheckedRef.current = key;
      const live = liveRef.current;
      if (
        live.hasStarted ||
        live.matchActive ||
        live.isTimerRunning ||
        live.matchCount > 0
      ) {
        // Someone with a session under way is not a first-time user — a
        // guest who just signed up brings theirs along under a new identity.
        // Don't cover it, and don't come back for it later either.
        writeFlag(key);
        return;
      }
      open(false);
    }, 500);
    return () => clearTimeout(t);
  }, [loading, user, isGuest, getTutorialKey, hasSeenTutorial, open]);

  useEffect(() => {
    if (!touring) return;
    setIsReplay(hasSeenTutorial());
  }, [touring, hasSeenTutorial]);

  // On a replay every page task is pre-satisfied so Next is always available.
  useEffect(() => {
    if (!touring || !isReplay) return;
    if (STEPS[step]?.pageAction) setTaskCompleted(true);
  }, [touring, step, isReplay]);

  // Make the live-scoring fields editable once the walkthrough reaches them,
  // with a practice match that never starts its clock. Going back to the
  // first step puts the session back as it was found: that step shows the
  // Start button, which a match in progress replaces.
  useEffect(() => {
    if (!touring) return;
    if (step >= SCORING_STEP) {
      if (matchActive) return;
      practiceMatchRef.current = true;
      setMatchActive(true);
      setMatchPhase(sessionData.matchType === 'Teleop' ? 'teleop' : 'auton');
    } else if (practiceMatchRef.current) {
      practiceMatchRef.current = false;
      if (snapshotRef.current) restoreSnapshot(snapshotRef.current);
    }
  }, [
    touring,
    step,
    matchActive,
    sessionData.matchType,
    setMatchActive,
    setMatchPhase,
    restoreSnapshot,
  ]);

  // Keep the match audio muted, and the session unsaved, for the duration
  // of the tour. Not for the welcome card: the page under it is the real one.
  useEffect(() => {
    setIsTutorialActive(touring);
  }, [touring, setIsTutorialActive]);

  useEffect(() => {
    const handle = () => open(true);
    window.addEventListener(TUTORIAL_RESTART_EVENT, handle);
    return () => window.removeEventListener(TUTORIAL_RESTART_EVENT, handle);
  }, [open]);

  // Complete the current page task when the watched field gets a value.
  useEffect(() => {
    if (!touring || taskCompleted) return;
    if (STEPS[step]?.watchKey === 'tipping' && sessionData.tipping > 0) {
      setTaskCompleted(true);
    }
  }, [touring, step, taskCompleted, sessionData.tipping]);

  // Spotlight this step's page element, for as long as the step is up.
  useLayoutEffect(() => {
    if (!touring) return;
    const { target, fallbackTarget, interactive } = STEPS[step] ?? {};
    if (!target) return;

    let held: HTMLElement | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;

    const find = () =>
      queryTarget(target) ??
      (fallbackTarget ? queryTarget(fallbackTarget) : null);

    const spotlight = () => {
      const el = find();
      if (el) {
        if (interactive === false) {
          holdElement(el);
          held = el;
        }
        setTargetEl(el);
        return;
      }
      // The target may be about to render (the practice match brings the
      // live counters with it). Look again after React has had a moment.
      if (++tries <= 8) retry = setTimeout(spotlight, 50 * tries);
    };
    spotlight();

    return () => {
      clearTimeout(retry);
      if (held) releaseElement(held);
      setTargetEl(null);
    };
  }, [touring, step, spotlightEpoch]);

  // The header is sticky, and the dim goes over the page. Raise it over the
  // dim for as long as the tour is up, so a spotlit element scrolls under it
  // like everything else; a strip of dim over it keeps it dimmed.
  useLayoutEffect(() => {
    if (!touring) return;
    const header = document.querySelector<HTMLElement>('header');
    if (!header) return;

    const previousZIndex = header.style.zIndex;
    header.style.zIndex = String(Z_HEADER);
    const measure = () =>
      setHeaderBottom(Math.max(0, header.getBoundingClientRect().bottom));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);

    return () => {
      observer.disconnect();
      header.style.zIndex = previousZIndex;
    };
  }, [touring]);

  /**
   * Put the card where it does not cover the spotlit element: docked to the
   * bottom with the element scrolled up under the header, or to the top (over
   * the header) with the element below it — whichever leaves the card more
   * room — and no taller than the space that is left. `allowScroll` is false
   * when the user is the one scrolling: then the card only gets out of the
   * way, and the page is not pulled back.
   */
  const place = useCallback((allowScroll: boolean) => {
    const card = cardRef.current;
    const target = targetElRef.current;
    if (!card || !target) {
      setPlacement(DEFAULT_PLACEMENT);
      return;
    }
    if (!target.isConnected) {
      // The page has rendered that part again (turning a phone swaps the
      // whole layout), so the element in hand is gone: find the new one.
      setSpotlightEpoch(epoch => epoch + 1);
      return;
    }

    const viewHeight = window.innerHeight;
    const { gutter } = cardLayout(window.innerWidth, viewHeight);
    const header = document.querySelector('header');
    // The header can change height as the page scrolls under it. The element
    // is kept clear of the tallest it has been, so that a header growing and
    // shrinking again never sends the page back and forth.
    headerEdgeRef.current = Math.max(
      headerEdgeRef.current,
      header ? header.getBoundingClientRect().bottom : 0
    );
    const headerEdge = headerEdgeRef.current;

    // Card height with nothing scrolled away, and with its text at the minimum
    const body = bodyRef.current;
    const bodyFull = body?.scrollHeight ?? 0;
    const chrome = card.offsetHeight - (body?.clientHeight ?? 0);
    const full = Math.min(chrome + bodyFull, viewHeight - 2 * gutter);
    const minimum = Math.min(
      chrome + Math.min(bodyFull, MIN_BODY_HEIGHT),
      full
    );

    // What the spotlight takes, ring included: the card keeps off all of it
    const spot = spotlitRect(target);
    const rect = {
      ...spot,
      height: spot.bottom - spot.top,
    };
    const apply = (
      dock: Dock,
      maxHeight: number,
      inset: number | null = null
    ) =>
      setPlacement(prev =>
        prev.dock === dock &&
        prev.maxHeight === maxHeight &&
        prev.inset === inset
          ? prev
          : { dock, inset, maxHeight }
      );

    const scrollY = window.scrollY;
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - viewHeight
    );
    const clampScroll = (y: number) => Math.min(maxScroll, Math.max(0, y));
    const pageTop = rect.top + scrollY;
    const pinned = isPinned(target);
    /**
     * Scroll the page so the element's top edge lands `top` px down the
     * screen. The first scroll for an element goes as far as it has to; one
     * after that only corrects an element still well off, and there are only
     * so many, so the page always comes to rest.
     */
    const scrollTargetTo = (top: number) => {
      if (pinned) return;
      const to = clampScroll(pageTop - top);
      const made = autoScrollCountRef.current;
      if (Math.abs(to - scrollY) <= (made === 0 ? 1 : SCROLL_ARRIVED)) return;
      // Already on its way there.
      const under = autoScrollRef.current;
      if (under !== null && Math.abs(to - under) <= SCROLL_ARRIVED) return;
      if (made >= MAX_AUTO_SCROLLS) return;
      autoScrollCountRef.current = made + 1;
      autoScrollRef.current = to;
      window.scrollTo({ top: to, behavior: scrollBehavior() });
    };

    // The phone's match controls are pinned over the bottom of the page: an
    // element under them is hidden, and its spotlight would be cut off at
    // their edge. The card can go over them, so only the element keeps off.
    const floor = screenFloor(target, BOTTOM_BAR, viewHeight);
    const inView =
      rect.top >= headerEdge - 1 && rect.bottom <= floor - EDGE_MIN + 1;

    // On a wide screen the card sits beside the element's column, so the two
    // can't meet: only make sure the element can be seen.
    const cardRect = card.getBoundingClientRect();
    if (rect.right <= cardRect.left || rect.left >= cardRect.right) {
      apply('bottom', full);
      if (allowScroll && !inView) scrollTargetTo(headerEdge + TARGET_PAD);
      return;
    }

    // An element pinned to the screen (the phone's match controls) stays
    // put whatever the page does: the card goes right beside it, on the
    // side with more room, so the two read as one and the rest of the page
    // (the clock) stays in view.
    if (pinned) {
      const fit = (room: number) =>
        Math.min(full, Math.max(minimum, Math.floor(room)));
      const above = rect.top - CARD_GAP - gutter;
      const below = viewHeight - gutter - CARD_GAP - rect.bottom;
      if (below > above) {
        apply('top', fit(below), Math.round(rect.bottom + CARD_GAP));
      } else {
        apply(
          'bottom',
          fit(above),
          Math.round(viewHeight - rect.top + CARD_GAP)
        );
      }
      return;
    }

    // Already clear of each other where things are: leave the page alone.
    const roomBelow = viewHeight - gutter - CARD_GAP - rect.bottom;
    const roomAbove = rect.top - CARD_GAP - gutter;
    if (inView && (roomBelow >= full || roomAbove >= full)) {
      // The half of the screen the element is not in, if the card fits there
      const lowerHalf = rect.top + rect.height / 2 > viewHeight / 2;
      const dock: Dock = lowerHalf
        ? roomAbove >= full
          ? 'top'
          : 'bottom'
        : roomBelow >= full
          ? 'bottom'
          : 'top';
      apply(dock, full);
      return;
    }

    if (!allowScroll) {
      // What can be seen of the element: the header hides what is above it
      const shownTop = Math.max(rect.top, headerEdge);
      const shownBottom = Math.min(rect.bottom, floor);
      if (cardRect.top >= shownBottom || shownTop >= cardRect.bottom) return;
      // Whichever end hides less of it, at the height that fits there
      const fit = (room: number) => Math.min(full, Math.max(minimum, room));
      const heightBelow = fit(viewHeight - gutter - CARD_GAP - shownBottom);
      const heightAbove = fit(shownTop - CARD_GAP - gutter);
      const hiddenBelow = Math.max(
        0,
        shownBottom - (viewHeight - gutter - heightBelow)
      );
      const hiddenAbove = Math.max(0, gutter + heightAbove - shownTop);
      if (
        hiddenBelow < hiddenAbove ||
        (hiddenBelow === hiddenAbove && heightBelow >= heightAbove)
      ) {
        apply('bottom', heightBelow);
      } else {
        apply('top', heightAbove);
      }
      return;
    }

    // Card at the bottom: the element goes right under the header.
    const topIfBottom =
      pageTop - clampScroll(pageTop - headerEdge - TARGET_PAD);
    const spaceIfBottom =
      viewHeight - gutter - CARD_GAP - (topIfBottom + rect.height);
    // Card at the top: the element goes as low as it can and still be seen.
    const topIfTop =
      pageTop -
      clampScroll(
        pageTop -
          Math.max(headerEdge + TARGET_PAD, floor - TARGET_PAD - rect.height)
      );
    const spaceIfTop = topIfTop - CARD_GAP - gutter;
    /** Where the element sits under a top-docked card of this height */
    const underCard = (height: number) =>
      Math.max(headerEdge + TARGET_PAD, gutter + height + CARD_GAP);

    let dock: Dock;
    let height: number;
    let targetTop: number;
    if (spaceIfBottom >= full) {
      dock = 'bottom';
      height = full;
      targetTop = topIfBottom;
    } else if (spaceIfTop >= full) {
      dock = 'top';
      height = full;
      targetTop = underCard(full);
    } else if (Math.max(spaceIfBottom, spaceIfTop) >= minimum) {
      // Both fit only if the card gives up some height; its text scrolls.
      dock = spaceIfBottom >= spaceIfTop ? 'bottom' : 'top';
      height = Math.floor(Math.max(spaceIfBottom, spaceIfTop));
      targetTop = dock === 'bottom' ? topIfBottom : underCard(height);
    } else if (pageTop >= underCard(minimum)) {
      // The element is too tall to share the screen with the card. Over the
      // header the card costs it the least room, and nothing of it is ever
      // under the card: the rest is a scroll away. The card keeps all of its
      // text while a useful part of the element still shows under it.
      dock = 'top';
      height = Math.max(
        minimum,
        Math.min(full, floor - TALL_TARGET_SHOWN - CARD_GAP - gutter)
      );
      targetTop = underCard(height);
    } else {
      dock = 'bottom';
      height = minimum;
      targetTop = topIfBottom;
    }

    apply(dock, height);
    scrollTargetTo(targetTop);
  }, []);

  const { short, fullWidth, gutter } = cardLayout(
    viewport.width,
    viewport.height
  );

  // Place the card for each step, once its element is on the page, and again
  // if the card changes shape.
  useLayoutEffect(() => {
    targetElRef.current = targetEl;
    autoScrollRef.current = null;
    autoScrollCountRef.current = 0;
    headerEdgeRef.current = 0;
    if (!touring) return;
    place(true);
  }, [touring, step, targetEl, short, fullWidth, place]);

  // The task row grows when its task is done: give the card the height it
  // now needs, where it is, without moving the page. Not while one of the
  // walkthrough's own scrolls is under way, which ends in a placement anyway.
  const placedForTaskRef = useRef(taskCompleted);
  useLayoutEffect(() => {
    if (placedForTaskRef.current === taskCompleted) return;
    placedForTaskRef.current = taskCompleted;
    if (touring && autoScrollRef.current === null) place(false);
  }, [touring, taskCompleted, place]);

  // Keep the placement right as the element, the window or the scroll
  // position changes under it. The window's size is followed for the
  // welcome card too, which is laid out by it.
  useEffect(() => {
    if (!visible) return;

    let frame = 0;
    const schedule = (allowScroll: boolean) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => place(allowScroll));
    };

    let last = { width: window.innerWidth, height: window.innerHeight };
    const handleResize = () => {
      const next = { width: window.innerWidth, height: window.innerHeight };
      const relayout =
        next.width !== last.width ||
        Math.abs(next.height - last.height) > URL_BAR_HEIGHT;
      last = next;
      setViewport(next);
      if (relayout) {
        // A new layout is a new start: what was scrolled for is elsewhere.
        autoScrollCountRef.current = 0;
        headerEdgeRef.current = 0;
      }
      if (touring) schedule(relayout);
    };
    window.addEventListener('resize', handleResize);
    if (!touring) {
      return () => window.removeEventListener('resize', handleResize);
    }

    // Once a scroll comes to rest. After one of our own, check the result:
    // the page may have changed under it (the header changes height as the
    // page clock scrolls away), leaving the element short of where it was
    // sent. place() allows only a few such corrections per element.
    let settle: ReturnType<typeof setTimeout> | undefined;
    const handleScroll = () => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        const ownScroll = autoScrollRef.current !== null;
        autoScrollRef.current = null;
        place(ownScroll);
      }, 150);
    };

    // The element can change size after it is spotlit: the live counters
    // arriving with the practice match.
    const observer = new ResizeObserver(() => schedule(true));
    if (targetEl) observer.observe(targetEl);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [visible, touring, targetEl, place]);

  // Keyboard users land on Next for every step.
  useEffect(() => {
    if (!touring) return;
    nextButtonRef.current?.focus({ preventScroll: true });
  }, [touring, step]);

  /**
   * Close the welcome card without a tour (Skip, or the page put to use).
   * Nothing was borrowed, so nothing is put back and the page stays where
   * it is. Seen, as a finished tour would be.
   */
  const closeWelcome = useCallback(() => {
    setVisible(false);
    setWelcome(false);
    writeFlag(getTutorialKey());
    writeFlag(STORAGE_KEYS.TUTORIAL_SEEN);
    const returnTo = returnFocusRef.current;
    returnFocusRef.current = null;
    if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
  }, [getTutorialKey]);

  // Starting a match (or opening a saved one) with the welcome card up is
  // an answer too: this visitor is scoring, not looking for a tour.
  useEffect(() => {
    if (!visible || !welcome) return;
    if (matchActive || isTimerRunning || editingMatchId !== null) {
      closeWelcome();
    }
  }, [
    visible,
    welcome,
    matchActive,
    isTimerRunning,
    editingMatchId,
    closeWelcome,
  ]);

  const startTour = useCallback(() => {
    setWelcome(false);
    setStep(0);
    setTaskCompleted(false);
  }, []);

  const dismiss = useCallback(() => {
    // A page field that still has focus (Escape while typing in Notes) hands
    // in what it holds when it loses it. Have that happen now, so the restore
    // below is the last word.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && !cardRef.current?.contains(focused)) {
      focused.blur();
    }

    setVisible(false);
    setWelcome(false);
    setIsTutorialActive(false);

    const snapshot = snapshotRef.current;
    if (snapshot) {
      restoreSnapshot(snapshot);
      snapshotRef.current = null;
    }
    practiceMatchRef.current = false;
    setWalkthroughSession(null);

    window.dispatchEvent(new Event(TUTORIAL_ENDED_EVENT));
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    // For this identity, and for the device: signing up on the same phone
    // is not a reason to be shown around again.
    writeFlag(getTutorialKey());
    writeFlag(STORAGE_KEYS.TUTORIAL_SEEN);

    const returnTo = returnFocusRef.current;
    returnFocusRef.current = null;
    if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
  }, [getTutorialKey, restoreSnapshot, setIsTutorialActive]);

  // Leaving /active mid-walkthrough unmounts this without dismiss() having
  // run. The session lives above the page, so it would keep the practice
  // match and the muted audio: put it back on the way out.
  const abandonRef = useRef<() => void>(() => {});
  useEffect(() => {
    abandonRef.current = () => {
      const snapshot = snapshotRef.current;
      if (!snapshot) return;
      snapshotRef.current = null;
      practiceMatchRef.current = false;
      setWalkthroughSession(null);
      restoreSnapshot(snapshot);
      setIsTutorialActive(false);
    };
  });
  useEffect(() => () => abandonRef.current(), []);

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) {
      dismiss();
      return;
    }
    setStep(s => s + 1);
    setTaskCompleted(false);
  }, [step, dismiss]);

  const prev = useCallback(() => {
    setStep(s => Math.max(0, s - 1));
    setTaskCompleted(false);
  }, []);

  useEffect(() => {
    if (!touring) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        dismiss();
        return;
      }
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      // Several steps ask for typing on the page; the arrows belong to the
      // caret there, not to the walkthrough.
      if (usesArrowKeys(e.target)) return;
      e.stopPropagation();
      e.preventDefault();
      if (e.key === 'ArrowRight') next();
      else prev();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [touring, next, prev, dismiss]);

  if (!visible) return null;

  if (welcome) {
    return createPortal(
      <WelcomeCard
        isDarkMode={isDarkMode}
        compact={isCompactLayout}
        short={short}
        zIndex={Z_CARD}
        onStart={startTour}
        onSkip={closeWelcome}
      />,
      document.body
    );
  }

  const current = STEPS[step];
  // The button the first step spotlights, as the page words it ("Start
  // Match 3" on a replay). Worked out from the session rather than read off
  // the page: going Back to that step puts the session back after this
  // render, and the button changes with it. One past the highest saved, as
  // Start numbers it: a deleted match leaves a gap.
  const startLabel = `Start Match ${nextMatchNumber(sessionData.matches)}`;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const hasTarget = !!current.target;
  const hasPageTask = !!current.pageAction;

  const teamBlue = 'rgb(var(--team-blue))';

  const cardStyle: React.CSSProperties = {
    ...cardVars(isDarkMode),
    zIndex: Z_CARD,
    boxShadow: cardShadow(isDarkMode),
    ...(hasTarget
      ? {
          ...(placement.dock === 'top'
            ? { top: placement.inset ?? gutter }
            : { bottom: placement.inset ?? gutter }),
          right: gutter,
          ...(fullWidth
            ? { left: gutter }
            : { width: 'min(380px, calc(100vw - 48px))' }),
          maxHeight: placement.maxHeight ?? '80vh',
          padding: fullWidth ? '14px 16px 12px' : '18px 20px 16px',
        }
      : {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          // On a phone the same card as the other steps, only centred
          width: fullWidth
            ? `calc(100vw - ${2 * gutter}px)`
            : 'min(400px, 90vw)',
          maxHeight: '85vh',
          padding: fullWidth ? '14px 16px 12px' : '20px 22px 18px',
        }),
  };

  // A phone on its side has no height to spare, so the one-row card puts the
  // buttons beside the title.
  const compactCard = hasTarget && short;

  const nav = (
    <div
      className={`flex items-center gap-2 flex-shrink-0 ${
        compactCard ? '' : 'justify-between mt-3'
      }`}
    >
      <button type="button" onClick={dismiss} className={quietButton}>
        Skip
      </button>
      <div className="flex items-center gap-2">
        {!isFirst && (
          <button type="button" onClick={prev} className={secondaryButton}>
            Back
          </button>
        )}
        <button
          type="button"
          ref={nextButtonRef}
          onClick={next}
          className={primaryButton(isDarkMode)}
        >
          {isLast ? (isReplay ? 'Done' : 'Get started') : 'Next'}
        </button>
      </div>
    </div>
  );

  return createPortal(
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes ttCardIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes ttCardCenter {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.97); }
            to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
          .tt-card-slide { animation: ttCardIn 0.26s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .tt-card-center { animation: ttCardCenter 0.26s cubic-bezier(0.22, 1, 0.36, 1) both; }
        }
      `}</style>

      <Spotlight
        target={hasTarget ? targetEl : null}
        expectTarget={hasTarget}
        isDarkMode={isDarkMode}
        zIndex={Z_BACKDROP}
        header={{ bottom: headerBottom, zIndex: Z_HEADER }}
        bottomBar={BOTTOM_BAR}
      />

      <div
        key={step}
        ref={cardRef}
        role="dialog"
        aria-label={`Tutorial: ${current.title}`}
        data-tutorial-card=""
        className={`fixed flex flex-col rounded-2xl ${CARD_SURFACE} ${
          hasTarget ? 'tt-card-slide' : 'tt-card-center'
        }`}
        style={cardStyle}
        onClick={e => e.stopPropagation()}
      >
        <div
          className={
            compactCard
              ? 'flex flex-wrap items-center justify-between gap-x-3 flex-shrink-0'
              : 'flex-shrink-0'
          }
        >
          <div
            className={`flex items-baseline justify-between gap-3 ${
              compactCard ? 'flex-1 min-w-0' : 'mb-1'
            }`}
          >
            <h2 className="text-base font-semibold text-balance">
              {current.title}
            </h2>
            <span
              className={`${MUTED_TEXT} font-medium tabular-nums whitespace-nowrap`}
            >
              <span className="sr-only">Step </span>
              {step + 1} / {STEPS.length}
            </span>
          </div>
          {compactCard && nav}
        </div>

        <div
          ref={bodyRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        >
          <div className={`${BODY_TEXT} whitespace-pre-line`}>
            {current.body({
              startLabel,
              narrow: viewport.width < NARROW_WIDTH,
              compact: isCompactLayout,
              matchType: sessionData.matchType,
              scrim: sessionData.sessionType === 'Scrim',
              touch: window.matchMedia('(pointer: coarse)').matches,
            })}
          </div>
        </div>

        {hasPageTask && (
          <div
            className={`flex items-center gap-2 px-3 rounded-xl transition-colors duration-300 flex-shrink-0 ${
              compactCard ? 'mt-2 py-1.5' : 'mt-3 py-2'
            }`}
            style={{
              backgroundColor: taskCompleted
                ? isDarkMode
                  ? 'rgba(34,197,94,0.1)'
                  : 'rgba(34,197,94,0.08)'
                : 'rgb(var(--team-blue) / 0.1)',
              border: `1px solid ${
                taskCompleted
                  ? 'rgba(34,197,94,0.3)'
                  : 'rgb(var(--team-blue) / 0.3)'
              }`,
            }}
          >
            {taskCompleted && (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(34,197,94,0.2)' }}
              >
                <span aria-hidden className="text-green-500 text-xs font-bold">
                  ✓
                </span>
              </div>
            )}
            <span
              className="text-xs font-medium"
              style={{
                color: taskCompleted
                  ? isDarkMode
                    ? 'rgba(34,197,94,0.9)'
                    : '#15803d'
                  : teamBlue,
              }}
            >
              {taskCompleted
                ? 'Tip added. Press Next to continue.'
                : current.pageAction}
            </span>
            {taskCompleted && !isReplay && (
              <button
                type="button"
                onClick={() => {
                  setTaskCompleted(false);
                  if (current.watchKey === 'tipping') {
                    updateSessionData({ tipping: 0 });
                  }
                }}
                className="ml-auto -my-1 px-1.5 py-1 text-xs font-medium flex-shrink-0 text-[color:var(--tt-muted)] hover:text-[color:var(--tt-text)] transition-colors [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:-my-3"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {!compactCard && nav}
      </div>
    </>,
    document.body
  );
};
