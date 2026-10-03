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
  TUTORIAL_OPEN_SESSION_SETUP_EVENT,
  TUTORIAL_ENDED_EVENT,
} from '@/constants/events';
import { STORAGE_KEYS } from '@/constants';
import { POINTS } from '@/lib';
import type { MatchPhase, SessionFormData, SessionType } from '@/types';

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
  dimmed = false,
}: {
  label: string;
  value: string;
  points: string;
  dark: boolean;
  dimmed?: boolean;
}) => (
  <div
    className="flex items-center gap-3"
    style={{ opacity: dimmed ? 0.4 : 1 }}
  >
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
          label="Tipping"
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
        label="Flower"
        value="4"
        points={`${4 * POINTS.FLOWER_ELEMENT} pts`}
        dark={dark}
      />
      <FieldRow
        label="Left in Hive"
        value="3"
        points={`${3 * POINTS.CELL_REMAINING} pts`}
        dark={dark}
      />
      <FieldRow
        label="Garden"
        value="6"
        points={`${6 * POINTS.GARDEN} pts`}
        dark={dark}
      />
      <div className="text-[10px] pt-1" style={{ color: 'var(--tt-muted)' }}>
        Locked while the clock is running
      </div>
    </div>
  </PreviewBox>
);

const RobotsPreview = ({ dark }: { dark: boolean }) => {
  const pill = (text: string, on: boolean) => (
    <span
      className="px-2 py-1 rounded-lg border text-[11px]"
      style={{
        borderColor: on ? 'rgb(34,197,94)' : 'rgb(var(--team-blue) / 0.4)',
        color: on ? 'rgb(34,197,94)' : dark ? '#fff' : '#000',
      }}
    >
      {text}
    </span>
  );
  return (
    <PreviewBox dark={dark}>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: dark ? '#e5e5e5' : '#333' }}>Robot 1</span>
          <span className="flex items-center gap-2">
            {pill('Leave', true)}
            {pill('Auto', true)}
            {pill('End', false)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: dark ? '#e5e5e5' : '#333' }}>Robot 2</span>
          <span className="flex items-center gap-2">
            {pill('Leave', false)}
            {pill('Auto', false)}
            {pill('End', true)}
          </span>
        </div>
      </div>
    </PreviewBox>
  );
};

/** Fouls go to the other alliance, so the mock shows them that way too. */
const PenaltyPreview = ({ dark }: { dark: boolean }) => (
  <PreviewBox dark={dark}>
    <div className="space-y-2.5">
      <FieldRow
        label="Minor"
        value="1"
        points={`+${POINTS.MINOR_PENALTY} to opponent`}
        dark={dark}
      />
      <FieldRow
        label="Major"
        value="0"
        points="+0 to opponent"
        dark={dark}
        dimmed
      />
    </div>
  </PreviewBox>
);

interface StepDef {
  title: string;
  body: React.ReactNode;
  /** `data-tutorial` attribute of the page element to spotlight */
  target: string | null;
  /** Spotlit instead when the page has no `target` element */
  fallbackTarget?: string;
  preview: ((dark: boolean) => React.ReactNode) | null;
  /** Prompt shown when the user should interact with the real page element */
  pageAction?: string;
  /** Session field watched for automatic task completion */
  watchKey?: 'notes' | 'tipping';
}

const STEPS: StepDef[] = [
  {
    title: 'Welcome to TeamTrack',
    body: (
      <div className="space-y-2">
        <div>
          TeamTrack records your BIOBUZZ scoring match by match, then shows you
          where the points are coming from. This walkthrough takes about a
          minute.
        </div>
        <div className="text-xs" style={{ color: 'var(--tt-muted)' }}>
          Anything you enter while the walkthrough is open is just practice —
          when it closes, your session goes back to exactly how it was. You can
          replay it from the (?) button in the header whenever no match is
          running.
        </div>
      </div>
    ),
    target: null,
    preview: null,
  },
  {
    title: 'Start Your Session',
    body: 'Every session is ready to go as a Practice session, so just press Start Session. It runs the real match clock — 30 seconds of AUTO, an 8-second transition, then 2:00 of TELEOP, with endgame (and FLOWER scoring) opening at 1:00. Save Match stores the result, and Start Match runs the next one.',
    target: 'controls',
    preview: null,
  },
  {
    title: 'Score While You Watch',
    body: `Tipping is counted as the match runs. Tap + for each HIVE TIP or type the running total — TeamTrack converts it to points as you go (${POINTS.HIVE_TIP} each).`,
    target: 'live',
    fallbackTarget: 'metrics',
    preview: d => <LiveScoringPreview dark={d} />,
    pageAction: 'Enter a Tipping count',
    watchKey: 'tipping',
  },
  {
    title: 'Leave and Park',
    body: `Tick Leave for each robot that is no longer touching the perimeter wall when AUTO ends (${POINTS.LEAVE} points each). Park is scored twice per robot — Auto if it's parked at the end of AUTO, End if it's parked at the end of the match (${POINTS.PARK} points each). End stays locked while AUTO is running.`,
    target: 'robots',
    preview: d => <RobotsPreview dark={d} />,
  },
  {
    title: 'After the Buzzer',
    body: (
      <div className="space-y-2">
        <div>
          These can only be judged once play stops, so they stay locked while
          the clock is running.
        </div>
        <ul className="list-disc pl-4 space-y-1 text-xs">
          <li>
            Flower: the alliance whose NECTAR is top-most owns a FLOWER and
            scores every POLLEN/NECTAR in it ({POINTS.FLOWER_ELEMENT} each). The
            bottom-most NECTAR earns the Flower Bonus ({POINTS.FLOWER_BONUS}).
          </li>
          <li>
            Left in Hive: POLLEN/NECTAR in your upward-facing CELL (
            {POINTS.CELL_REMAINING} each). The 3 staged NECTAR count until a TIP
            flips the CELL.
          </li>
          <li>
            Garden: everything in your GARDEN ({POINTS.GARDEN} each), including
            the 4 pre-staged POLLEN.
          </li>
        </ul>
      </div>
    ),
    target: 'end-of-match',
    preview: d => <EndOfMatchPreview dark={d} />,
  },
  {
    title: 'Penalties',
    body: `In a Scrim, count your alliance's minor and major fouls as they're called. Each one is credited to the opponent (${POINTS.MINOR_PENALTY} for a minor, ${POINTS.MAJOR_PENALTY} for a major) and never reduces your own score, so TeamTrack shows them separately as points given to the opponent.`,
    target: 'penalties',
    preview: d => <PenaltyPreview dark={d} />,
  },
  {
    title: 'Notes',
    body: 'Jot down anything the numbers miss — a jammed intake, a driver swap, a field fault. Notes are saved with the session.',
    target: 'notes',
    preview: null,
  },
  {
    title: 'Session Settings',
    body: 'Open settings with the gear button whenever you need them — rename the session, change the match type, or switch between Practice and Scrim. Practice is solo drilling; Scrim is for matches against another alliance and adds penalty tracking. Either way you only score your own alliance.',
    target: 'session-setup',
    preview: null,
  },
  {
    title: 'You Are Set',
    body: "Save each match as you finish it, then press Complete Session — you'll be asked to confirm the session name before it saves. Your Sessions, Analysis, Charts, and Compare pages build on that data.",
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
/** Space kept between the card and the spotlit element, in px */
const CARD_GAP = 8;
/** Space kept between the spotlit element and the header or screen edge, in px */
const TARGET_PAD = 8;
/** Least body text a shrunken card still shows (two lines), in px */
const MIN_BODY_HEIGHT = 46;
/** A height change smaller than this is the URL bar sliding, not a new layout */
const URL_BAR_HEIGHT = 120;

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

function liftElement(el: HTMLElement, darkMode = true) {
  (el as unknown as Record<string, unknown>)[ORIGINAL_STYLES_KEY] = {
    position: el.style.position,
    zIndex: el.style.zIndex,
    borderRadius: el.style.borderRadius,
    boxShadow: el.style.boxShadow,
    animation: el.style.animation,
    backgroundColor: el.style.backgroundColor,
    pointerEvents: el.style.pointerEvents,
    border: el.style.border,
  };
  el.style.position = 'relative';
  el.style.zIndex = String(Z_SPOTLIGHT);
  el.style.borderRadius = '16px';
  el.style.pointerEvents = 'auto';
  // Light mode needs an opaque background so the lifted element reads clearly
  // against the dark backdrop; dark mode gets that from its own colors.
  if (!darkMode) {
    el.style.backgroundColor = '#ffffff';
  }
  el.style.border = `2px solid rgb(var(--team-blue) / 0.4)`;
  el.style.boxShadow = 'none';
}

function dropElement(el: HTMLElement) {
  const orig = (el as unknown as Record<string, unknown>)[
    ORIGINAL_STYLES_KEY
  ] as Record<string, string> | undefined;
  if (orig) {
    el.style.position = orig.position ?? '';
    el.style.zIndex = orig.zIndex ?? '';
    el.style.borderRadius = orig.borderRadius ?? '';
    el.style.boxShadow = orig.boxShadow ?? '';
    el.style.animation = orig.animation ?? '';
    el.style.backgroundColor = orig.backgroundColor ?? '';
    el.style.pointerEvents = orig.pointerEvents ?? '';
    el.style.border = orig.border ?? '';
    delete (el as unknown as Record<string, unknown>)[ORIGINAL_STYLES_KEY];
  }
}

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

export const ActiveTutorial = () => {
  const { isDarkMode } = useTheme();
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
  /** True while the page is scrolling because the placement code asked it to */
  const autoScrollRef = useRef(false);
  /** True once the current step has asked the settings panel to open */
  const setupRequestedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  /** What had focus when the walkthrough opened, to hand it back on close */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  /** Session type to put back after the penalties step previewed a scrim */
  const forcedScrimFromRef = useRef<SessionType | null>(null);
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
        toast.info('Finish or cancel the match first', {
          id: BLOCKED_TOAST_ID,
        });
      }
      return;
    }
    if (live.editing) {
      if (askedFor) {
        toast.info('Save or cancel your match edit first', {
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
    snapshotRef.current = {
      sessionData: JSON.parse(JSON.stringify(sessionData)),
      matchActive,
      matchPhase,
      timer,
      isTimerRunning,
      hasStarted,
      sessionTimer,
      phaseTimer,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]); // snapshot once per showing, not on every state change

  // First run for this account or guest: open by itself, once.
  useEffect(() => {
    if (loading) return;
    if (!user && !isGuest) return;
    const key = getTutorialKey();
    if (autoOpenCheckedRef.current === key) return;
    if (localStorage.getItem(key)) {
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
        localStorage.setItem(key, 'true');
        return;
      }
      open(false);
    }, 500);
    return () => clearTimeout(t);
  }, [loading, user, isGuest, getTutorialKey, open]);

  useEffect(() => {
    if (!visible) return;
    setIsReplay(!!localStorage.getItem(getTutorialKey()));
  }, [visible, getTutorialKey]);

  // On a replay every page task is pre-satisfied so Next is always available.
  useEffect(() => {
    if (!visible || !isReplay) return;
    if (STEPS[step]?.pageAction) setTaskCompleted(true);
  }, [visible, step, isReplay]);

  // Make the live-scoring fields editable once the walkthrough reaches them.
  useEffect(() => {
    if (!visible) return;
    if (step >= SCORING_STEP && !matchActive) {
      setMatchActive(true);
      setMatchPhase(sessionData.matchType === 'Teleop' ? 'teleop' : 'auton');
    }
  }, [
    visible,
    step,
    matchActive,
    sessionData.matchType,
    setMatchActive,
    setMatchPhase,
  ]);

  // Penalties only exist in a scrim, so preview one while that step is up —
  // otherwise there would be nothing on the page to point at.
  useEffect(() => {
    if (!visible) return;
    const onPenaltiesStep = STEPS[step]?.target === 'penalties';
    if (onPenaltiesStep && sessionData.sessionType !== 'Scrim') {
      if (forcedScrimFromRef.current === null) {
        forcedScrimFromRef.current = sessionData.sessionType;
      }
      updateSessionData({ sessionType: 'Scrim' });
    } else if (!onPenaltiesStep && forcedScrimFromRef.current !== null) {
      updateSessionData({ sessionType: forcedScrimFromRef.current });
      forcedScrimFromRef.current = null;
    }
  }, [visible, step, sessionData.sessionType, updateSessionData]);

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
    const key = STEPS[step]?.watchKey;
    if (!key) return;
    if (key === 'notes' && sessionData.notes?.trim()) {
      setTaskCompleted(true);
    }
    if (key === 'tipping' && sessionData.tipping > 0) {
      setTaskCompleted(true);
    }
  }, [visible, step, taskCompleted, sessionData]);

  // The settings panel is asked to open once per visit to its step, so that
  // closing it there (Save) doesn't just bring it straight back. A layout
  // effect, so the reset lands before the next step's spotlight below.
  useLayoutEffect(
    () => () => {
      setupRequestedRef.current = false;
    },
    [visible, step]
  );

  // Spotlight this step's page element, for as long as the step is up.
  useLayoutEffect(() => {
    if (!visible) return;
    const target = STEPS[step]?.target;
    if (!target) return;
    const fallbackTarget = STEPS[step].fallbackTarget;

    let lifted: HTMLElement | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;

    const find = () =>
      queryTarget(target) ??
      (fallbackTarget ? queryTarget(fallbackTarget) : null);

    const spotlight = () => {
      const el = find();
      if (el) {
        liftElement(el, isDarkMode);
        lifted = el;
        setTargetEl(el);
        return;
      }
      // The target may be about to render: the session setup panel collapses
      // once saved (ask it to reopen), and the penalties box only appears
      // once the step above switches the session to a scrim. Look again
      // after React has had a moment to render it.
      if (target === 'session-setup' && !setupRequestedRef.current) {
        setupRequestedRef.current = true;
        window.dispatchEvent(
          new CustomEvent(TUTORIAL_OPEN_SESSION_SETUP_EVENT)
        );
      }
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
    const headerEdge = header
      ? Math.max(0, header.getBoundingClientRect().bottom)
      : 0;

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
    /** Scroll the page so the element's top edge lands `top` px down the screen */
    const scrollTargetTo = (top: number) => {
      const to = clampScroll(pageTop - top);
      if (Math.abs(to - scrollY) <= 1) return;
      autoScrollRef.current = true;
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
    if (!visible) return;
    place(true);
  }, [visible, step, targetEl, short, fullWidth, place]);

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
      schedule(relayout);
    };

    // Once a scroll comes to rest. After one of our own, check the result:
    // the header grows a clock row once the page clock scrolls away, which
    // moves the line the element was scrolled up to.
    let settle: ReturnType<typeof setTimeout> | undefined;
    const handleScroll = () => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        const ownScroll = autoScrollRef.current;
        autoScrollRef.current = false;
        place(ownScroll);
      }, 150);
    };

    // The element can change size after it is spotlit: the settings panel
    // opening, the scrim counters arriving.
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
      forcedScrimFromRef.current = null;
    }

    window.dispatchEvent(new Event(TUTORIAL_ENDED_EVENT));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    localStorage.setItem(getTutorialKey(), 'true');

    const returnTo = returnFocusRef.current;
    returnFocusRef.current = null;
    if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
  }, [getTutorialKey, restoreSnapshot, setIsTutorialActive]);

  // Leaving /active mid-walkthrough unmounts this without dismiss() having
  // run. The session lives above the page, so it would keep the practice
  // match, the forced scrim and the muted audio: put it back on the way out.
  const abandonRef = useRef<() => void>(() => {});
  useEffect(() => {
    abandonRef.current = () => {
      const snapshot = snapshotRef.current;
      if (!snapshot) return;
      snapshotRef.current = null;
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
            {current.body}
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
                    : 'rgba(34,197,94,1)'
                  : teamBlue,
              }}
            >
              {taskCompleted
                ? 'Done! Click Next to continue'
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
                className="ml-auto text-xs font-medium opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
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
