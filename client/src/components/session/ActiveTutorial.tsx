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
  const endgame =
    GAME_TIMING.ENDGAME_REMAINING === 60
      ? 'the last minute'
      : `the last ${GAME_TIMING.ENDGAME_REMAINING} seconds`;
  switch (matchType) {
    case 'Autonomous':
      return `The clock runs Auto (${auto}).`;
    case 'Teleop':
      return `The clock runs Teleop (${teleop}). Endgame is ${endgame}.`;
    default:
      return `After a 3-2-1: Auto (${auto}), an ${GAME_TIMING.CONTROLLER_PICKUP_SECONDS}-second controller pickup, then Teleop (${teleop}). Endgame is ${endgame}.`;
  }
};

/** Secondary text: smaller, in the card's muted colour */
const Aside = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs" style={{ color: 'var(--tt-muted)' }}>
    {children}
  </p>
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
    title: 'Save, then complete the session',
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
/** Least room kept between the ring and a screen edge, in px */
const RING_EDGE = 8;
/** Least room kept between the ring and what it surrounds, where the screen edge is close, in px */
const RING_MIN_OFFSET = 3;
/** Space kept between the card and the spotlit element, ring included, in px */
const CARD_GAP = SPOTLIGHT_RING + 8;
/** Space kept between the spotlit element and the header or screen edge, in px */
const TARGET_PAD = SPOTLIGHT_RING + 8;
/** Least body text a shrunken card still shows (two lines), in px */
const MIN_BODY_HEIGHT = 46;
/** Least of an element too tall for the screen kept in view under the card, in px */
const TALL_TARGET_SHOWN = 160;
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

/**
 * Bring a page element up over the dimmed backdrop. Its ring is drawn
 * separately (`SpotlightRing`), around what of it can be seen.
 */
function liftElement(el: HTMLElement, interactive = true) {
  (el as unknown as Record<string, unknown>)[ORIGINAL_STYLES_KEY] = {
    position: el.style.position,
    zIndex: el.style.zIndex,
    pointerEvents: el.style.pointerEvents,
    inert: el.inert,
  };
  // Only what is in the normal flow needs positioning for the z-index to
  // take. A bar pinned to the screen edge (the phone's match controls) must
  // stay pinned while it is spotlit.
  if (getComputedStyle(el).position === 'static') {
    el.style.position = 'relative';
  }
  el.style.zIndex = String(Z_SPOTLIGHT);
  // An element that is only being pointed at takes no taps and no keys.
  el.style.pointerEvents = interactive ? 'auto' : 'none';
  if (!interactive) el.inert = true;
}

function dropElement(el: HTMLElement) {
  const orig = (el as unknown as Record<string, unknown>)[
    ORIGINAL_STYLES_KEY
  ] as (Record<string, string> & { inert?: boolean }) | undefined;
  if (orig) {
    el.inert = orig.inert ?? false;
    el.style.position = orig.position ?? '';
    el.style.zIndex = orig.zIndex ?? '';
    el.style.pointerEvents = orig.pointerEvents ?? '';
    delete (el as unknown as Record<string, unknown>)[ORIGINAL_STYLES_KEY];
  }
}

const isTransparent = (color: string) =>
  color === 'transparent' || /rgba\(.*,\s*0\)$/.test(color);

/** Elements that draw something of their own whatever their styles say */
const REPLACED = new Set([
  'BUTTON',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'IMG',
  'svg',
  'CANVAS',
  'VIDEO',
]);

interface Edges {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/**
 * Where the element shows anything: the union of what is in it, its text,
 * its controls and every box that has a background or a border, skipping
 * what is hidden or visually hidden. Not its own box: an element can be
 * taller than what it shows (the live counters keep a blank line for a
 * message that comes and goes), or reach the screen's edges (the phone's
 * match controls), and the ring goes round what can be seen in it.
 */
const paintedEdges = (root: HTMLElement): Edges | null => {
  let edges: Edges | null = null;
  const add = (r: DOMRect) => {
    if (r.width <= 1 || r.height <= 1) return;
    edges = edges
      ? {
          top: Math.min(edges.top, r.top),
          left: Math.min(edges.left, r.left),
          right: Math.max(edges.right, r.right),
          bottom: Math.max(edges.bottom, r.bottom),
        }
      : { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
  };
  const visit = (el: Element) => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || Number(style.opacity) === 0) return;
    if (style.visibility === 'visible') {
      const box =
        el !== root &&
        (REPLACED.has(el.tagName) ||
          !isTransparent(style.backgroundColor) ||
          (['Top', 'Right', 'Bottom', 'Left'] as const).some(
            side =>
              parseFloat(style[`border${side}Width`]) > 0 &&
              !isTransparent(style[`border${side}Color`])
          ));
      if (box) {
        add(el.getBoundingClientRect());
      } else {
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
            const range = document.createRange();
            range.selectNodeContents(node);
            add(range.getBoundingClientRect());
          }
        }
      }
      // A control's insides are already inside its box
      if (box && REPLACED.has(el.tagName)) return;
    }
    for (const child of el.children) visit(child);
  };
  visit(root);
  return edges;
};

/** The colour of the page behind an element, for the spotlight's well */
const pageBackground = (el: HTMLElement): string => {
  for (
    let node: HTMLElement | null = el.parentElement;
    node;
    node = node.parentElement
  ) {
    const color = getComputedStyle(node).backgroundColor;
    if (!isTransparent(color)) return color;
  }
  return getComputedStyle(document.body).backgroundColor;
};

interface RingBox {
  top: number;
  left: number;
  width: number;
  height: number;
  /** Pinned to the screen (in screen px), or placed on the page (page px) */
  fixed: boolean;
}

/**
 * The spotlight's ring and the well of page colour under the spotlit
 * element: round what the element shows rather than its whole box, standing
 * a little off it, and kept clear of the screen edges so it is never cut
 * off (the phone's match controls reach both sides and the bottom).
 *
 * Placed on the page, not the screen, for an element that scrolls with
 * it, so the two move together; re-measured only when the element changes
 * or moves on the page.
 */
const SpotlightRing = ({ target }: { target: HTMLElement }) => {
  const [box, setBox] = useState<RingBox | null>(null);
  const [fill, setFill] = useState('transparent');

  useEffect(() => {
    const fixed = isPinned(target);
    setFill(pageBackground(target));
    /** What the element shows, relative to its own top left corner */
    let shown: Edges | null = null;
    let dirty = true;
    const markDirty = () => {
      dirty = true;
    };
    const resizes = new ResizeObserver(markDirty);
    resizes.observe(target);
    const mutations = new MutationObserver(markDirty);
    mutations.observe(target, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'disabled'],
    });
    window.addEventListener('resize', markDirty);

    let last = '';
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const rect = target.getBoundingClientRect();
      if (dirty) {
        dirty = false;
        const edges = paintedEdges(target);
        shown = edges && {
          top: edges.top - rect.top,
          left: edges.left - rect.left,
          right: edges.right - rect.left,
          bottom: edges.bottom - rect.top,
        };
      }
      if (!shown) return;
      // On screen, then kept off the edges; never closer than
      // RING_MIN_OFFSET to what it surrounds where an edge is that close.
      const near = (edge: number, limit: number, inward: number) =>
        inward > 0
          ? Math.max(edge, Math.min(limit, edge + inward))
          : Math.min(edge, Math.max(limit, edge + inward));
      const width = window.innerWidth;
      const height = window.innerHeight;
      const shownLeft = rect.left + shown.left;
      const shownRight = rect.left + shown.right;
      const shownTop = rect.top + shown.top;
      const shownBottom = rect.top + shown.bottom;
      const left = near(
        shownLeft - SPOTLIGHT_RING,
        RING_EDGE,
        SPOTLIGHT_RING - RING_MIN_OFFSET
      );
      const right = near(
        shownRight + SPOTLIGHT_RING,
        width - RING_EDGE,
        RING_MIN_OFFSET - SPOTLIGHT_RING
      );
      const top = shownTop - SPOTLIGHT_RING;
      const bottom = fixed
        ? near(
            shownBottom + SPOTLIGHT_RING,
            height - RING_EDGE,
            RING_MIN_OFFSET - SPOTLIGHT_RING
          )
        : shownBottom + SPOTLIGHT_RING;
      const next: RingBox = {
        top: Math.round(top + (fixed ? 0 : window.scrollY)),
        left: Math.round(left + (fixed ? 0 : window.scrollX)),
        width: Math.round(right - left),
        height: Math.round(bottom - top),
        fixed,
      };
      const key = `${next.top},${next.left},${next.width},${next.height}`;
      if (key !== last) {
        last = key;
        setBox(next);
      }
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      resizes.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', markDirty);
    };
  }, [target]);

  if (!box) return null;
  const frame: React.CSSProperties = {
    position: box.fixed ? 'fixed' : 'absolute',
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
    borderRadius: 16,
    pointerEvents: 'none',
  };
  return (
    <>
      {/* Under the element, over the backdrop: the page as it really looks */}
      <div
        aria-hidden
        style={{ ...frame, zIndex: Z_SPOTLIGHT - 1, backgroundColor: fill }}
      />
      <div
        aria-hidden
        style={{
          ...frame,
          zIndex: Z_SPOTLIGHT,
          border: '2px solid rgb(var(--team-blue) / 0.4)',
        }}
      />
    </>
  );
};

/** Smooth scrolling, unless the user has asked for less motion */
const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'instant'
    : 'smooth';

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
        liftElement(el, interactive !== false);
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
  }, [visible, step, spotlightEpoch]);

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
      window.scrollTo({ top: to, behavior: scrollBehavior() });
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
      // under the card: the rest is a scroll away. The card keeps all of its
      // text while a useful part of the element still shows under it.
      dock = 'top';
      height = Math.max(
        minimum,
        Math.min(full, viewHeight - TALL_TARGET_SHOWN - CARD_GAP - gutter)
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
  // render, and the button changes with it. One past the highest saved, as
  // Start numbers it: a deleted match leaves a gap.
  const startLabel = `Start Match ${nextMatchNumber(sessionData.matches)}`;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const hasTarget = !!current.target;
  const hasPageTask = !!current.pageAction;

  const teamBlue = 'rgb(var(--team-blue))';
  const teamBlue50 = isDarkMode
    ? 'rgb(var(--team-blue) / 0.5)'
    : 'rgb(var(--team-blue) / 0.75)';
  const teamBlue80 = 'rgb(var(--team-blue) / 0.8)';
  // The theme's own card surface (navy in Deep Sea, near-black in
  // Honeycomb), as the page's cards and menus use
  const bg = isDarkMode ? 'hsl(var(--card))' : '#ffffff';
  const text = isDarkMode ? '#ffffff' : '#111111';
  const subtext = isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
  // Secondary text. Solid enough to stay over 4.5:1 on the card in every
  // theme, which stacked opacity was not.
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
        // On a phone the same card as the other steps, only centred
        width: fullWidth ? `calc(100vw - ${2 * gutter}px)` : 'min(420px, 90vw)',
        maxHeight: '85vh',
        padding: fullWidth ? '14px 16px 12px' : '24px 24px 20px',
      };

  // A phone on its side has no height to spare, so the one-row card puts the
  // buttons beside the title.
  const compactCard = hasTarget && short;
  // On a phone every row counts: the step counter shares the title's line,
  // on every step.
  const inlineCounter = fullWidth;

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
          className="px-5 py-2 text-sm font-bold whitespace-nowrap rounded-xl transition-all duration-200"
          style={{
            backgroundColor: teamBlue,
            color: isDarkMode ? '#000' : '#fff',
          }}
        >
          {isLast ? (isReplay ? 'Done' : 'Get started') : 'Next'}
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

      {hasTarget && targetEl && <SpotlightRing target={targetEl} />}

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
            <h2
              className={`text-lg font-bold text-balance ${inlineCounter ? '' : 'mb-1.5'}`}
            >
              {current.title}
            </h2>
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
              matchType: sessionData.matchType,
              scrim: sessionData.sessionType === 'Scrim',
              touch: window.matchMedia('(pointer: coarse)').matches,
            })}
          </div>
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
                ↻ Try again
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
