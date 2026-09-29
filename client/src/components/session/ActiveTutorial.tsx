import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, useAuth, useSession } from '@/contexts';
import {
  TUTORIAL_RESTART_EVENT,
  TUTORIAL_OPEN_SESSION_SETUP_EVENT,
  TUTORIAL_ENDED_EVENT,
} from '@/constants/events';
import { STORAGE_KEYS } from '@/constants';
import { POINTS } from '@/lib';

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
      className="w-14 text-right text-xs font-semibold"
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
        <FieldRow label="Garden" value="2" points={`${2 * POINTS.GARDEN} pts`} dark={dark} />
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
        value="7"
        points={`${7 * POINTS.CELL_REMAINING} pts`}
        dark={dark}
      />
      <div
        className="text-[10px] pt-1"
        style={{ color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}
      >
        Locked until the buzzer sounds
      </div>
    </div>
  </PreviewBox>
);

const RobotsPreview = ({ dark }: { dark: boolean }) => {
  const pill = (text: string, on: boolean) => (
    <span
      className="px-2 py-1 rounded-lg border text-[11px]"
      style={{
        borderColor: on
          ? 'rgb(34,197,94)'
          : 'rgb(var(--team-blue) / 0.4)',
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
            {pill('Park (Auto)', true)}
            {pill('Park (Teleop)', false)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: dark ? '#e5e5e5' : '#333' }}>Robot 2</span>
          <span className="flex items-center gap-2">
            {pill('Leave', false)}
            {pill('Park (Auto)', false)}
            {pill('Park (Teleop)', true)}
          </span>
        </div>
      </div>
    </PreviewBox>
  );
};

const PenaltyPreview = ({ dark }: { dark: boolean }) => (
  <PreviewBox dark={dark}>
    <div className="space-y-2.5">
      <FieldRow
        label="Minor"
        value="1"
        points={`-${POINTS.MINOR_PENALTY} pts`}
        dark={dark}
      />
      <FieldRow label="Major" value="0" points="0 pts" dark={dark} dimmed />
    </div>
  </PreviewBox>
);

interface StepDef {
  title: string;
  body: React.ReactNode;
  /** `data-tutorial` attribute of the page element to spotlight */
  target: string | null;
  preview: ((dark: boolean) => React.ReactNode) | null;
  /** Prompt shown when the user should interact with the real page element */
  pageAction?: string;
  /** Session field watched for automatic task completion */
  watchKey?: 'notes' | 'garden';
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
        <div className="text-xs opacity-60">
          You can restart it anytime from the (?) button in the header.
        </div>
      </div>
    ),
    target: null,
    preview: null,
  },
  {
    title: 'Start Your Session',
    body: 'Every session is ready to go as a Practice session, so just press Start Session. It runs the real 2:30 clock — 30 seconds of autonomous, then teleop. Save Match stores the result, and Start Match runs the next one.',
    target: 'controls',
    preview: null,
  },
  {
    title: 'Score While You Watch',
    body: `Tipping and Garden are counted live. Type the running total into each field and press Enter — TeamTrack converts it to points as you go (Tipping ${POINTS.HIVE_TIP} each, Garden ${POINTS.GARDEN} each).`,
    target: 'scoring',
    preview: d => <LiveScoringPreview dark={d} />,
    pageAction: 'Type a Garden count above',
    watchKey: 'garden',
  },
  {
    title: 'After the Buzzer',
    body: 'Flower and balls left in the hive can only be judged once the match ends, so those fields stay locked until the clock runs out.',
    target: 'metrics',
    preview: d => <EndOfMatchPreview dark={d} />,
  },
  {
    title: 'Leave and Park',
    body: `Tick Leave for each robot that left its starting zone in autonomous (${POINTS.LEAVE} points each). Park is scored twice per robot — once if it's in the loading zone at the end of AUTO, once if it's there at the end of the match (${POINTS.PARK} points each). Park Tele stays locked while autonomous is running.`,
    target: 'metrics',
    preview: d => <RobotsPreview dark={d} />,
  },
  {
    title: 'Penalties',
    body: `In a Scrim, log minor and major penalties as they happen. They come straight off the match score, so you can see what fouls actually cost you.`,
    target: 'scoring',
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
    body: 'Open settings with the gear button whenever you need them — rename the session, change the match type, or switch between Practice and Scrim. Scrims are full matches against another alliance; practice is solo drilling.',
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
  el.style.zIndex = '9999';
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

export const ActiveTutorial = () => {
  const { isDarkMode } = useTheme();
  const { user, isGuest, guestId, loading } = useAuth();
  const {
    sessionData,
    matchActive,
    setMatchActive,
    setMatchPhase,
    setIsTimerRunning,
    resetSession,
    updateSessionData,
    replaceSessionData,
    setIsTutorialActive,
    timer,
    setTimer,
    matchPhase,
    isTimerRunning,
    hasStarted,
    setHasStarted,
    sessionTimer,
    setSessionTimer,
    hasTransitionedToTeleop,
    setHasTransitionedToTeleop,
    showTeleopTransition,
    setShowTeleopTransition,
    phaseTimer,
    setPhaseTimer,
  } = useSession();

  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [taskCompleted, setTaskCompleted] = useState(false);
  /** True when the user has finished the tutorial before — tasks are pre-skipped */
  const [isReplay, setIsReplay] = useState(false);
  const prevElRef = useRef<HTMLElement | null>(null);

  /** Session state captured before the tutorial ran, restored on dismiss */
  const snapshotRef = useRef<{
    sessionData: typeof sessionData;
    matchActive: boolean;
    matchPhase: typeof matchPhase;
    timer: number;
    isTimerRunning: boolean;
    hasStarted: boolean;
    sessionTimer: number;
    hasTransitionedToTeleop: boolean;
    showTeleopTransition: boolean;
    phaseTimer: number;
  } | null>(null);

  const getTutorialKey = useCallback(() => {
    if (user?.uid) return `${STORAGE_KEYS.TUTORIAL_SEEN}-${user.uid}`;
    if (guestId) return `${STORAGE_KEYS.TUTORIAL_SEEN}-guest-${guestId}`;
    return STORAGE_KEYS.TUTORIAL_SEEN;
  }, [user, guestId]);

  useEffect(() => {
    const shouldStart = sessionStorage.getItem(STORAGE_KEYS.START_TUTORIAL);
    if (shouldStart) {
      sessionStorage.removeItem(STORAGE_KEYS.START_TUTORIAL);
      const t = setTimeout(() => {
        setStep(0);
        setVisible(true);
      }, 500);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    snapshotRef.current = {
      sessionData: JSON.parse(JSON.stringify(sessionData)),
      matchActive,
      matchPhase,
      timer,
      isTimerRunning,
      hasStarted,
      sessionTimer,
      hasTransitionedToTeleop,
      showTeleopTransition,
      phaseTimer,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]); // snapshot once per showing, not on every state change

  useEffect(() => {
    if (loading) return;
    if (!user && !isGuest) return;
    const seen = localStorage.getItem(getTutorialKey());
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(t);
    }
  }, [loading, user, isGuest, getTutorialKey]);

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
    const scoringStep = STEPS.findIndex(s => s.title === 'Score While You Watch');
    if (step >= scoringStep && !matchActive) {
      setMatchActive(true);
      setMatchPhase(sessionData.matchType === 'Teleop' ? 'teleop' : 'auton');
    }
  }, [visible, step, matchActive, sessionData.matchType, setMatchActive, setMatchPhase]);

  // Keep the match audio muted for the duration of the tutorial.
  useEffect(() => {
    setIsTutorialActive(visible);
  }, [visible, setIsTutorialActive]);

  useEffect(() => {
    const handle = () => {
      setStep(0);
      setVisible(true);
    };
    window.addEventListener(TUTORIAL_RESTART_EVENT, handle);
    return () => window.removeEventListener(TUTORIAL_RESTART_EVENT, handle);
  }, []);

  // Complete the current page task when the watched field gets a value.
  useEffect(() => {
    if (!visible || taskCompleted) return;
    const key = STEPS[step]?.watchKey;
    if (!key) return;
    if (key === 'notes' && sessionData.notes?.trim()) {
      setTaskCompleted(true);
    }
    if (key === 'garden' && sessionData.garden > 0) {
      setTaskCompleted(true);
    }
  }, [visible, step, taskCompleted, sessionData]);

  const applyHighlight = useCallback(
    (targetAttr: string | null, dark = isDarkMode) => {
      if (prevElRef.current) {
        dropElement(prevElRef.current);
        prevElRef.current = null;
      }
      if (!targetAttr) return;

      const focus = (el: HTMLElement) => {
        liftElement(el, dark);
        prevElRef.current = el;
        const rect = el.getBoundingClientRect();
        if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };

      const query = () =>
        document.querySelector<HTMLElement>(`[data-tutorial="${targetAttr}"]`);

      const el = query();
      if (el) {
        focus(el);
        return;
      }

      // The session setup panel collapses once saved — ask it to reopen, then
      // re-query after React has had a frame to render it.
      if (targetAttr === 'session-setup') {
        window.dispatchEvent(new CustomEvent(TUTORIAL_OPEN_SESSION_SETUP_EVENT));
        setTimeout(() => {
          const reopened = query();
          if (reopened) focus(reopened);
        }, 50);
      }
    },
    [isDarkMode]
  );

  const clearHighlight = useCallback(() => {
    if (prevElRef.current) {
      dropElement(prevElRef.current);
      prevElRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    applyHighlight(STEPS[step]?.target ?? null, isDarkMode);
  }, [visible, step, applyHighlight, isDarkMode]);

  useEffect(() => {
    if (!visible) clearHighlight();
    return () => clearHighlight();
  }, [visible, clearHighlight]);

  const dismiss = useCallback(() => {
    setVisible(false);
    clearHighlight();
    setIsTutorialActive(false);

    const snapshot = snapshotRef.current;
    if (snapshot) {
      // Full replacement, so values typed during the tutorial never leak into
      // the user's real session.
      replaceSessionData(snapshot.sessionData);
      setMatchActive(snapshot.matchActive);
      setMatchPhase(snapshot.matchPhase);
      setTimer(snapshot.timer);
      setIsTimerRunning(snapshot.isTimerRunning);
      setHasStarted(snapshot.hasStarted);
      setSessionTimer(snapshot.sessionTimer);
      setHasTransitionedToTeleop(snapshot.hasTransitionedToTeleop);
      setShowTeleopTransition(snapshot.showTeleopTransition);
      setPhaseTimer(snapshot.phaseTimer);
      snapshotRef.current = null;
    } else {
      resetSession();
    }

    window.dispatchEvent(new Event(TUTORIAL_ENDED_EVENT));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    localStorage.setItem(getTutorialKey(), 'true');
  }, [
    getTutorialKey,
    clearHighlight,
    resetSession,
    replaceSessionData,
    setIsTutorialActive,
    setMatchActive,
    setMatchPhase,
    setTimer,
    setIsTimerRunning,
    setHasStarted,
    setSessionTimer,
    setHasTransitionedToTeleop,
    setShowTeleopTransition,
    setPhaseTimer,
  ]);

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
      }
      if (e.key === 'ArrowRight') {
        e.stopPropagation();
        e.preventDefault();
        next();
      }
      if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        e.preventDefault();
        prev();
      }
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
      `}</style>

      <div
        className="fixed inset-0 z-[9997]"
        style={{
          backgroundColor: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          pointerEvents: 'none',
        }}
      />

      <div
        key={step}
        className={
          hasTarget
            ? 'fixed z-[10000] tt-card-slide'
            : 'fixed z-[10000] tt-card-center'
        }
        style={
          hasTarget
            ? {
                bottom: 24,
                right: 24,
                width: 'min(400px, calc(100vw - 48px))',
                maxHeight: '80vh',
                overflowY: 'auto',
                backgroundColor: bg,
                border: `2px solid ${teamBlue50}`,
                color: text,
                borderRadius: 20,
                padding: '22px 22px 18px',
              }
            : {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(420px, 90vw)',
                maxHeight: '85vh',
                overflowY: 'auto',
                backgroundColor: bg,
                border: `2px solid ${teamBlue50}`,
                color: text,
                borderRadius: 20,
                padding: '24px 24px 20px',
              }
        }
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
          className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: teamBlue }}
        >
          {step + 1} / {STEPS.length}
        </div>

        <h3 className="text-lg font-bold mb-1.5" style={{ color: teamBlue }}>
          {current.title}
        </h3>

        <div
          className="text-sm leading-relaxed whitespace-pre-line"
          style={{ color: subtext }}
        >
          {current.body}
        </div>

        {current.preview && current.preview(isDarkMode)}

        {hasPageTask && (
          <div
            className="flex items-center gap-2 mt-4 px-3 py-2.5 rounded-xl transition-all duration-300"
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
                  if (current.watchKey === 'garden') {
                    updateSessionData({ garden: 0 });
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

        <div className="flex items-center justify-between mt-5">
          <button
            onClick={dismiss}
            className="text-xs font-medium uppercase tracking-wide opacity-45 hover:opacity-100 transition-opacity"
            style={{ color: text }}
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
      </div>
    </>,
    document.body
  );
};
