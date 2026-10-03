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
import { STORAGE_KEYS } from '@/constants';
import { COUNT_LABELS, ELEMENT_LABELS, POINTS } from '@/lib';
import { setWalkthroughSession } from '@/lib/signOutLoss';
import type { MatchPhase, SessionFormData } from '@/types';
import { useActiveCompact } from './layout/useActiveCompact';

const PreviewBox = ({
  children,
  dark,
}: {
  children: React.ReactNode;
  dark: boolean;
}) => (
  <div
    className="rounded-xl p-4 mt-4 mb-1 border"
    style={{
      backgroundColor: dark ? '#232323' : '#f5f5f5',
      borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    }}
  >
    {children}
  </div>
);

/** A mock scoring field, used to show what typing into one looks like. */
const FieldRow = ({
  label,
  value,
  points,
  dark,
}: {
  label: string;
  value: string;
  points: string;
  dark: boolean;
}) => (
  <div className="flex items-center gap-3">
    <span
      className="flex-1 text-xs font-semibold"
      style={{ color: dark ? '#e5e5e5' : '#333' }}
    >
      {label}
    </span>
    <span
      className="w-14 h-8 rounded-lg border-2 flex items-center justify-center text-sm font-bold"
      style={{
        borderColor: 'rgb(var(--team-blue) / 0.4)',
        color: dark ? '#fff' : '#000',
      }}
    >
      {value}
    </span>
    <span
      className="min-w-14 text-right text-xs font-semibold whitespace-nowrap"
      style={{ color: 'rgb(var(--team-blue))' }}
    >
      {points}
    </span>
  </div>
);

/** Cycles a count upward so the live-scoring step reads as "live". */
const LiveScoringPreview = ({ dark }: { dark: boolean }) => {
  const [n, setN] = useState(3);
  useEffect(() => {
    const id = setInterval(() => setN(v => (v >= 9 ? 3 : v + 1)), 1200);
    return () => clearInterval(id);
  }, []);
  return (
    <PreviewBox dark={dark}>
      <div className="space-y-2.5">
        <FieldRow
          label={ELEMENT_LABELS.tipping}
          value={String(n)}
          points={`${n * POINTS.HIVE_TIP} pts`}
          dark={dark}
        />
      </div>
    </PreviewBox>
  );
};

const EndOfMatchPreview = ({ dark }: { dark: boolean }) => (
  <PreviewBox dark={dark}>
    <div className="space-y-2.5">
      <FieldRow
        label={COUNT_LABELS.flower}
        value="4"
        points={`${4 * POINTS.FLOWER_ELEMENT} pts`}
        dark={dark}
      />
      <FieldRow
        label={COUNT_LABELS.flowerBonus}
        value="1"
        points={`${1 * POINTS.FLOWER_BONUS} pts`}
        dark={dark}
      />
      <FieldRow
        label={ELEMENT_LABELS.hive}
        value="3"
        points={`${3 * POINTS.CELL_REMAINING} pts`}
        dark={dark}
      />
      <FieldRow
        label={ELEMENT_LABELS.garden}
        value="6"
        points={`${6 * POINTS.GARDEN} pts`}
        dark={dark}
      />
      <div className="text-[10px] pt-1" style={{ color: 'var(--tt-muted)' }}>
        In a match: locked while the clock runs
      </div>
    </div>
  </PreviewBox>
);

/** What a step's text can say about the page as it is right now */
interface StepContext {
  /** What the button that starts a match reads, e.g. "Start Match 1" */
  startLabel: string;
  /** True at phone width, where the header folds its buttons into a menu */
  narrow: boolean;
  /**
   * True when the page uses its phone layout, where the robots are below
   * Hive Tips. The full-size layout has them beside it, with a scrim's
   * fouls beside the robots.
   */
  compact: boolean;
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
  preview: ((dark: boolean) => React.ReactNode) | null;
  /** Prompt shown when the user should interact with the real page element */
  pageAction?: string;
  /** Session field watched for automatic task completion */
  watchKey?: 'tipping';
}

const STEPS: StepDef[] = [
  {
    title: 'Start a match',
    body: ({ startLabel, narrow }) => (
      <div className="space-y-2">
        <div>
          TeamTrack scores BIOBUZZ match by match. You'll press {startLabel}: a
          3-second countdown, then the 2:30 clock (30 s AUTO, 8 s controller
          pickup, 2:00 TELEOP, endgame in the last minute).
        </div>
        <div className="text-xs" style={{ color: 'var(--tt-muted)' }}>
          What you enter here is practice, put back on closing. Replay from{' '}
          {narrow ? 'Tutorial in the header menu' : 'the (?) in the header'}{' '}
          when no match is running.
        </div>
      </div>
    ),
    target: 'controls',
    interactive: false,
    preview: null,
  },
  {
    title: 'Score while you watch',
    body: ({ compact }) => (
      <div className="space-y-2">
        <div>
          {compact
            ? `Add 1 for each HIVE TIP (${POINTS.HIVE_TIP}), or type the total.`
            : `Tap the Hive Tips pad, or press T on your keyboard, for each HIVE TIP (${POINTS.HIVE_TIP}).`}
        </div>
        <div className="text-xs">
          {compact ? 'Below' : 'Beside it'}, per robot: Leave ({POINTS.LEAVE})
          if off the wall when AUTO ends; Park ({POINTS.PARK}) for Auto and End
          (End unlocks after AUTO).
        </div>
        <div className="text-xs">
          In a Scrim, count your Minor ({POINTS.MINOR_PENALTY}) and Major (
          {POINTS.MAJOR_PENALTY}) fouls{' '}
          {compact ? 'under the robots, in Penalties' : 'beside the robots'}:
          they go to the opponent, never off your score.
        </div>
      </div>
    ),
    target: 'live',
    fallbackTarget: 'metrics',
    preview: d => <LiveScoringPreview dark={d} />,
    pageAction: 'Try it: add a Hive Tip',
    watchKey: 'tipping',
  },
  {
    title: 'After the buzzer',
    body: () => (
      <div className="space-y-2">
        <div>
          Count these once play stops. In a match they stay locked while the
          clock runs, and unlock at the buzzer or when you pause.
        </div>
        <ul className="list-disc pl-4 space-y-1 text-xs">
          <li>
            Flowers: you own a flower when your nectar is on top. Count every
            piece in it, opponent pieces too ({POINTS.FLOWER_ELEMENT} pts each).
            Then count the flowers with your nectar at the bottom (
            {POINTS.FLOWER_BONUS} pts each, up to 4).
          </li>
          <li>
            Left in Hive: pieces still in the hive&apos;s upward-facing cell (
            {POINTS.CELL_REMAINING} pts each). The 3 nectar that start there
            count unless a hive tip flipped the cell.
          </li>
          <li>
            Garden: every piece in your garden ({POINTS.GARDEN} pt each),
            including the 4 pollen that start there.
          </li>
        </ul>
      </div>
    ),
    target: 'end-of-match',
    preview: d => <EndOfMatchPreview dark={d} />,
  },
  {
    title: 'Save, then complete the session',
    body: () => (
      <div className="space-y-2">
        <div>
          Save Match stores it; Start Match runs the next. Notes hold what the
          numbers miss; the gear sets name, match type and Practice or Scrim.
        </div>
        <div>
          Complete Session asks for a name; Sessions, Analysis, Charts and
          Compare build on it.
        </div>
      </div>
    ),
    target: null,
    preview: null,
  },
];

const SCORING_STEP = STEPS.findIndex(s => s.watchKey === 'tipping');

/**
 * Stacking order while the walkthrough is up: the page, the dimming backdrop,
 * the spotlit element, the site header (raised so a spotlit element scrolls
 * under it like everything else), then the card.
 */
const Z_BACKDROP = 9997;
const Z_SPOTLIGHT = 9999;
const Z_HEADER = 10000;
const Z_CARD = 10001;

/** Viewports narrower than this get a card as wide as the screen */
const NARROW_WIDTH = 640;
/** Viewports shorter than this (a phone on its side) get the one-row card */
const SHORT_HEIGHT = 500;
/** How far the spotlight's ring stands off the spotlit element, in px */
const SPOTLIGHT_RING = 6;
/** Space kept between the card and the spotlit element, ring included, in px */
const CARD_GAP = SPOTLIGHT_RING + 8;
/** Space kept between the spotlit element and the header or screen edge, in px */
const TARGET_PAD = SPOTLIGHT_RING + 8;
/** Least body text a shrunken card still shows (two lines), in px */
const MIN_BODY_HEIGHT = 46;
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
  /** Height the card may take without covering the spotlit element */
  maxHeight: number | null;
}

const DEFAULT_PLACEMENT: CardPlacement = { dock: 'bottom', maxHeight: null };

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

function liftElement(el: HTMLElement, darkMode = true, interactive = true) {
  (el as unknown as Record<string, unknown>)[ORIGINAL_STYLES_KEY] = {
    position: el.style.position,
    zIndex: el.style.zIndex,
    borderRadius: el.style.borderRadius,
    boxShadow: el.style.boxShadow,
    animation: el.style.animation,
    backgroundColor: el.style.backgroundColor,
    pointerEvents: el.style.pointerEvents,
    outline: el.style.outline,
    outlineOffset: el.style.outlineOffset,
    inert: el.inert,
  };
  // Only what is in the normal flow needs positioning for the z-index to
  // take. A bar pinned to the screen edge (the phone's match controls) must
  // stay pinned while it is spotlit.
  const inFlow = getComputedStyle(el).position === 'static';
  if (inFlow) el.style.position = 'relative';
  const pinned = !inFlow && isPinned(el);
  el.style.zIndex = String(Z_SPOTLIGHT);
  el.style.borderRadius = '16px';
  // An element that is only being pointed at takes no taps and no keys.
  el.style.pointerEvents = interactive ? 'auto' : 'none';
  if (!interactive) el.inert = true;
  // The ring stands off the element, so text at its edge is not against the
  // line; an outline, so nothing on the page moves to make room for it. A
  // pinned bar already reaches the screen edges: its ring goes inside.
  el.style.outline = `2px solid rgb(var(--team-blue) / 0.4)`;
  el.style.outlineOffset = pinned ? '-2px' : `${SPOTLIGHT_RING}px`;
  // Light mode needs an opaque background so the lifted element reads clearly
  // against the dark backdrop; dark mode gets that from its own colors.
  if (!darkMode) {
    el.style.backgroundColor = '#ffffff';
    el.style.boxShadow = pinned ? 'none' : `0 0 0 ${SPOTLIGHT_RING}px #ffffff`;
  } else {
    el.style.boxShadow = 'none';
  }
}

function dropElement(el: HTMLElement) {
  const orig = (el as unknown as Record<string, unknown>)[
    ORIGINAL_STYLES_KEY
  ] as (Record<string, string> & { inert?: boolean }) | undefined;
  if (orig) {
    el.inert = orig.inert ?? false;
    el.style.position = orig.position ?? '';
    el.style.zIndex = orig.zIndex ?? '';
    el.style.borderRadius = orig.borderRadius ?? '';
    el.style.boxShadow = orig.boxShadow ?? '';
    el.style.animation = orig.animation ?? '';
    el.style.backgroundColor = orig.backgroundColor ?? '';
    el.style.pointerEvents = orig.pointerEvents ?? '';
    el.style.outline = orig.outline ?? '';
    el.style.outlineOffset = orig.outlineOffset ?? '';
    delete (el as unknown as Record<string, unknown>)[ORIGINAL_STYLES_KEY];
  }
}

const queryTarget = (id: string) =>
  document.querySelector<HTMLElement>(`[data-tutorial="${id}"]`);

/** True for an element that stays where it is on screen as the page scrolls. */
const isPinned = (el: HTMLElement) => {
  for (
    let node: HTMLElement | null = el;
    node && node !== document.body;
    node = node.parentElement
  ) {
    if (getComputedStyle(node).position === 'fixed') return true;
  }
  return false;
};

/** localStorage, for a browser that may refuse it. */
const readFlag = (key: string): boolean => {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
};

const writeFlag = (key: string): void => {
  try {
    localStorage.setItem(key, 'true');
  } catch {
    /* storage unavailable: the walkthrough is offered again next time */
  }
};

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

export const ActiveTutorial = () => {
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
  const liveRef = useRef({
    visible,
    matchActive,
    isTimerRunning,
    hasStarted,
    editing: editingMatchId !== null,
    matchCount: sessionData.matches?.length ?? 0,
  });
  useEffect(() => {
    liveRef.current = {
      visible,
      matchActive,
      isTimerRunning,
      hasStarted,
      editing: editingMatchId !== null,
      matchCount: sessionData.matches?.length ?? 0,
    };
  });

  const getTutorialKey = useCallback(() => {
    if (user?.uid) return `${STORAGE_KEYS.TUTORIAL_SEEN}-${user.uid}`;
    if (guestId) return `${STORAGE_KEYS.TUTORIAL_SEEN}-guest-${guestId}`;
    return STORAGE_KEYS.TUTORIAL_SEEN;
  }, [user, guestId]);

  /**
   * Seen on this device, by anyone: someone who has been shown around as a
   * guest is not shown around again for signing up on the same phone.
   */
  const hasSeenTutorial = useCallback(
    () => readFlag(getTutorialKey()) || readFlag(STORAGE_KEYS.TUTORIAL_SEEN),
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
   * Show the walkthrough from its first step. Refused while a match is live:
   * it borrows the session and puts back what it found when it closes, which
   * over a running match would undo scoring and rewind the clock. Refused
   * while a saved match is open for editing too: the fields then hold that
   * match, and which match they belong to is not part of what is put back.
   */
  const open = useCallback((askedFor: boolean) => {
    const live = liveRef.current;
    if (live.visible) {
      setStep(0);
      setTaskCompleted(false);
      return;
    }
    if (live.matchActive || live.isTimerRunning) {
      if (askedFor) {
        toast.info('Finish or discard this match to replay the tour', {
          id: BLOCKED_TOAST_ID,
        });
      }
      return;
    }
    if (live.editing) {
      if (askedFor) {
        toast.info('Save or discard your changes first', {
          id: BLOCKED_TOAST_ID,
        });
      }
      return;
    }
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : null;
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

  useEffect(() => {
    if (!visible) return;
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
  }, [visible]); // snapshot once per showing, not on every state change

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
    if (!visible) return;
    setIsReplay(hasSeenTutorial());
  }, [visible, hasSeenTutorial]);

  // On a replay every page task is pre-satisfied so Next is always available.
  useEffect(() => {
    if (!visible || !isReplay) return;
    if (STEPS[step]?.pageAction) setTaskCompleted(true);
  }, [visible, step, isReplay]);

  // Make the live-scoring fields editable once the walkthrough reaches them,
  // with a practice match that never starts its clock. Going back to the
  // first step puts the session back as it was found: that step shows the
  // Start button, which a match in progress replaces.
  useEffect(() => {
    if (!visible) return;
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
    visible,
    step,
    matchActive,
    sessionData.matchType,
    setMatchActive,
    setMatchPhase,
    restoreSnapshot,
  ]);

  // Keep the match audio muted for the duration of the tutorial.
  useEffect(() => {
    setIsTutorialActive(visible);
  }, [visible, setIsTutorialActive]);

  useEffect(() => {
    const handle = () => open(true);
    window.addEventListener(TUTORIAL_RESTART_EVENT, handle);
    return () => window.removeEventListener(TUTORIAL_RESTART_EVENT, handle);
  }, [open]);

  // Complete the current page task when the watched field gets a value.
  useEffect(() => {
    if (!visible || taskCompleted) return;
    if (STEPS[step]?.watchKey === 'tipping' && sessionData.tipping > 0) {
      setTaskCompleted(true);
    }
  }, [visible, step, taskCompleted, sessionData.tipping]);

  // Spotlight this step's page element, for as long as the step is up.
  useLayoutEffect(() => {
    if (!visible) return;
    const { target, fallbackTarget, interactive } = STEPS[step] ?? {};
    if (!target) return;

    let lifted: HTMLElement | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;

    const find = () =>
      queryTarget(target) ??
      (fallbackTarget ? queryTarget(fallbackTarget) : null);

    const spotlight = () => {
      const el = find();
      if (el) {
        liftElement(el, isDarkMode, interactive !== false);
        lifted = el;
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
      if (lifted) dropElement(lifted);
      setTargetEl(null);
    };
  }, [visible, step, isDarkMode, spotlightEpoch]);

  // The header is sticky and normally sits under the spotlit element, which
  // would then slide over it when the page scrolls. Raise it for as long as
  // the walkthrough is up; a strip of backdrop over it keeps it dimmed.
  useLayoutEffect(() => {
    if (!visible) return;
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
  }, [visible]);

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

    const rect = target.getBoundingClientRect();
    const apply = (dock: Dock, maxHeight: number) =>
      setPlacement(prev =>
        prev.dock === dock && prev.maxHeight === maxHeight
          ? prev
          : { dock, maxHeight }
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
      window.scrollTo({ top: to, behavior: 'smooth' });
    };

    const inView = rect.top >= headerEdge - 1 && rect.bottom <= viewHeight + 1;

    // On a wide screen the card sits beside the element's column, so the two
    // can't meet: only make sure the element can be seen.
    const cardRect = card.getBoundingClientRect();
    if (rect.right <= cardRect.left || rect.left >= cardRect.right) {
      apply('bottom', full);
      if (allowScroll && !inView) scrollTargetTo(headerEdge + TARGET_PAD);
      return;
    }

    // An element pinned to the screen (the phone's match controls) stays
    // put whatever the page does: the card takes the larger space beside it.
    if (pinned) {
      const fit = (room: number) =>
        Math.min(full, Math.max(minimum, Math.floor(room)));
      const above = rect.top - CARD_GAP - gutter;
      const below = viewHeight - gutter - CARD_GAP - rect.bottom;
      if (below > above) apply('bottom', fit(below));
      else apply('top', fit(above));
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
      const shownBottom = Math.min(rect.bottom, viewHeight);
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
          Math.max(
            headerEdge + TARGET_PAD,
            viewHeight - TARGET_PAD - rect.height
          )
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
      // under the card: the rest is a scroll away.
      dock = 'top';
      height = minimum;
      targetTop = underCard(minimum);
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
    if (!visible) return;
    place(true);
  }, [visible, step, targetEl, short, fullWidth, place]);

  // The task row grows when its task is done: give the card the height it
  // now needs, where it is, without moving the page. Not while one of the
  // walkthrough's own scrolls is under way, which ends in a placement anyway.
  const placedForTaskRef = useRef(taskCompleted);
  useLayoutEffect(() => {
    if (placedForTaskRef.current === taskCompleted) return;
    placedForTaskRef.current = taskCompleted;
    if (visible && autoScrollRef.current === null) place(false);
  }, [visible, taskCompleted, place]);

  // Keep the placement right as the element, the window or the scroll
  // position changes under it.
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
      schedule(relayout);
    };

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

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [visible, targetEl, place]);

  // Keyboard users land on Next for every step.
  useEffect(() => {
    if (!visible) return;
    nextButtonRef.current?.focus({ preventScroll: true });
  }, [visible, step]);

  const dismiss = useCallback(() => {
    // A page field that still has focus (Escape while typing in Notes) hands
    // in what it holds when it loses it. Have that happen now, so the restore
    // below is the last word.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && !cardRef.current?.contains(focused)) {
      focused.blur();
    }

    setVisible(false);
    setIsTutorialActive(false);

    const snapshot = snapshotRef.current;
    if (snapshot) {
      restoreSnapshot(snapshot);
      snapshotRef.current = null;
    }
    practiceMatchRef.current = false;
    setWalkthroughSession(null);

    window.dispatchEvent(new Event(TUTORIAL_ENDED_EVENT));
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (!visible) return;
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
  }, [visible, next, prev, dismiss]);

  if (!visible) return null;

  const current = STEPS[step];
  // The button the first step spotlights, as the page words it ("Start
  // Match 3" on a replay). Worked out from the session rather than read off
  // the page: going Back to that step puts the session back after this
  // render, and the button changes with it.
  const startLabel = `Start Match ${(sessionData.matches?.length ?? 0) + 1}`;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const hasTarget = !!current.target;
  const hasPageTask = !!current.pageAction;

  const teamBlue = 'rgb(var(--team-blue))';
  const teamBlue50 = isDarkMode
    ? 'rgb(var(--team-blue) / 0.5)'
    : 'rgb(var(--team-blue) / 0.75)';
  const teamBlue80 = 'rgb(var(--team-blue) / 0.8)';
  const bg = isDarkMode ? '#191919' : '#ffffff';
  const text = isDarkMode ? '#ffffff' : '#111111';
  const subtext = isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
  // Secondary text. Solid enough to stay over 4.5:1 on the card and on the
  // preview boxes in both themes, which stacked opacity was not.
  const muted = isDarkMode ? 'rgba(255,255,255,0.52)' : 'rgba(0,0,0,0.58)';

  const backdrop = {
    backgroundColor: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    pointerEvents: 'none',
  } as const;

  const cardSurface = {
    zIndex: Z_CARD,
    backgroundColor: bg,
    border: `2px solid ${teamBlue50}`,
    color: text,
    borderRadius: 20,
    overflow: 'hidden',
    '--tt-muted': muted,
    '--tt-text': text,
  } as React.CSSProperties;

  const cardStyle: React.CSSProperties = hasTarget
    ? {
        ...cardSurface,
        ...(placement.dock === 'top' ? { top: gutter } : { bottom: gutter }),
        right: gutter,
        ...(fullWidth
          ? { left: gutter }
          : { width: 'min(400px, calc(100vw - 48px))' }),
        maxHeight: placement.maxHeight ?? '80vh',
        padding: fullWidth ? '14px 16px 12px' : '22px 22px 18px',
      }
    : {
        ...cardSurface,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(420px, 90vw)',
        maxHeight: '85vh',
        padding: '24px 24px 20px',
      };

  // A phone on its side has no height to spare, so the one-row card puts the
  // buttons beside the title and drops the mock.
  const compactCard = hasTarget && short;
  // On a phone every row counts: the step counter shares the title's line.
  const inlineCounter = hasTarget && fullWidth;
  const showPreview = current.preview !== null && !(hasTarget && fullWidth);

  const nav = (
    <div
      className={`flex items-center gap-2 flex-shrink-0 ${
        compactCard ? '' : 'justify-between mt-4'
      }`}
    >
      <button
        onClick={dismiss}
        className="tt-skip px-1 py-2 text-xs font-medium uppercase tracking-wide transition-colors"
      >
        Skip
      </button>
      <div className="flex items-center gap-2">
        {!isFirst && (
          <button
            onClick={prev}
            className="px-4 py-2 text-sm font-semibold rounded-xl transition-colors"
            style={{
              border: `1px solid ${teamBlue50}`,
              color: teamBlue,
              backgroundColor: 'transparent',
            }}
          >
            Back
          </button>
        )}
        <button
          ref={nextButtonRef}
          onClick={next}
          className="px-5 py-2 text-sm font-bold rounded-xl transition-all duration-200"
          style={{
            backgroundColor: teamBlue,
            color: isDarkMode ? '#000' : '#fff',
          }}
        >
          {isLast ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  );

  return createPortal(
    <>
      <style>{`
        @keyframes ttCardIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ttCardCenter {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .tt-card-slide { animation: ttCardIn 0.3s ease-out forwards; }
        .tt-card-center { animation: ttCardCenter 0.25s ease-out forwards; }
        .tt-skip { color: var(--tt-muted); }
        .tt-skip:hover, .tt-skip:focus-visible { color: var(--tt-text); }
      `}</style>

      <div
        className="fixed inset-0"
        style={{ ...backdrop, zIndex: Z_BACKDROP }}
      />
      {/* The raised header is above the backdrop, so it gets its own strip. */}
      <div
        className="fixed top-0 left-0 right-0"
        style={{ ...backdrop, zIndex: Z_HEADER, height: headerBottom }}
      />

      <div
        key={step}
        ref={cardRef}
        role="dialog"
        aria-label={`Tutorial: ${current.title}`}
        className={`fixed flex flex-col ${
          hasTarget ? 'tt-card-slide' : 'tt-card-center'
        }`}
        style={cardStyle}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="absolute top-0 left-0 h-1 rounded-tl-[20px] transition-all duration-300"
          style={{
            width: `${((step + 1) / STEPS.length) * 100}%`,
            background: `linear-gradient(90deg, ${teamBlue80}, ${teamBlue})`,
            borderTopRightRadius: isLast ? 20 : 0,
          }}
        />

        <div
          className={
            compactCard
              ? 'flex flex-wrap items-center justify-between gap-x-3 flex-shrink-0'
              : 'flex-shrink-0'
          }
        >
          <div
            className={
              inlineCounter
                ? `flex items-baseline gap-3 ${compactCard ? '' : 'mb-1.5'}`
                : ''
            }
          >
            <div
              className={`text-xs font-semibold uppercase tracking-widest whitespace-nowrap ${
                inlineCounter ? '' : 'mb-2'
              }`}
              style={{ color: teamBlue }}
            >
              {step + 1} / {STEPS.length}
            </div>
            <h3
              className={`text-lg font-bold ${inlineCounter ? '' : 'mb-1.5'}`}
              style={{ color: teamBlue }}
            >
              {current.title}
            </h3>
          </div>
          {compactCard && nav}
        </div>

        <div
          ref={bodyRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        >
          <div
            className="text-sm leading-relaxed whitespace-pre-line"
            style={{ color: subtext }}
          >
            {current.body({
              startLabel,
              narrow: viewport.width < NARROW_WIDTH,
              compact: isCompactLayout,
            })}
          </div>

          {showPreview && current.preview?.(isDarkMode)}
        </div>

        {hasPageTask && (
          <div
            className={`flex items-center gap-2 px-3 rounded-xl transition-all duration-300 flex-shrink-0 ${
              compactCard ? 'mt-2 py-1.5' : 'mt-4 py-2.5'
            }`}
            style={{
              backgroundColor: taskCompleted
                ? isDarkMode
                  ? 'rgba(34,197,94,0.1)'
                  : 'rgba(34,197,94,0.08)'
                : isDarkMode
                  ? 'rgba(var(--team-blue) / 0.1)'
                  : 'rgba(var(--team-blue) / 0.08)',
              border: `1px solid ${
                taskCompleted
                  ? 'rgba(34,197,94,0.3)'
                  : 'rgb(var(--team-blue) / 0.25)'
              }`,
            }}
          >
            {taskCompleted && (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(34,197,94,0.2)' }}
              >
                <span className="text-green-500 text-xs font-bold">✓</span>
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
                ? 'Done! Press Next to continue'
                : current.pageAction}
            </span>
            {taskCompleted && !isReplay && (
              <button
                onClick={() => {
                  setTaskCompleted(false);
                  if (current.watchKey === 'tipping') {
                    updateSessionData({ tipping: 0 });
                  }
                }}
                className="ml-auto text-xs font-medium opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
                style={{ color: teamBlue }}
              >
                ↻ Try Again
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
