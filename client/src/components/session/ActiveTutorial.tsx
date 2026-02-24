import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme, useAuth, useSession } from '@/contexts';
import { ArrowUp } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

export const TUTORIAL_STORAGE_KEY = 'teamtrack-tutorial-v1-seen';
export const TUTORIAL_RESTART_EVENT = 'teamtrack-restart-tutorial';
export const TUTORIAL_OPEN_SESSION_SETUP_EVENT = 'teamtrack-tutorial-open-session-setup';
/** Fired by SessionSetup when the Save button is clicked */
export const TUTORIAL_SESSION_SAVED_EVENT = 'teamtrack-tutorial-session-saved';
/** Fired by PerformanceMetrics when a shot is confirmed via keyboard (Enter) */
export const TUTORIAL_KEYBOARD_SCORE_EVENT = 'teamtrack-tutorial-keyboard-score';
/** Fired by PerformanceMetrics when G is pressed to open/close the gate */
export const TUTORIAL_GATE_TOGGLED_EVENT = 'teamtrack-tutorial-gate-toggled';
export const TUTORIAL_GATE_CYCLE_EVENT   = 'teamtrack-tutorial-gate-cycle';
export const TUTORIAL_ENDED_EVENT        = 'teamtrack-tutorial-ended';
export const TUTORIAL_METRICS_AUTON_TAB_EVENT  = 'teamtrack-tutorial-metrics-auton-tab';
export const TUTORIAL_METRICS_LEAVE_EVENT      = 'teamtrack-tutorial-metrics-leave';
export const TUTORIAL_METRICS_SHOT_EDIT_EVENT  = 'teamtrack-tutorial-metrics-shot-edit';
export const TUTORIAL_METRICS_MOTIF_EDIT_EVENT = 'teamtrack-tutorial-metrics-motif-edit';

// ─── Visual previews ───────────────────────────────────────────────────────

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

// ── Preview components ──────────────────────────────────────────────────
// ── Animated Controls: cursor cycles through buttons ────────────────────
// ── Animated Scoring: highlights cells in sequence ──────────────────────
const SCORE_SEQUENCE: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
]; // (row, col)
const ScoringPreview = ({ dark }: { dark: boolean }) => {
  const borderCol = dark ? 'rgb(var(--team-blue) / 0.4)' : 'rgba(0,0,0,0.15)';
  const circleBorder = dark ? '#fff' : '#000';
  const [seqIdx, setSeqIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setSeqIdx(i => (i + 1) % SCORE_SEQUENCE.length),
      1800
    );
    return () => clearInterval(id);
  }, []);

  const [hRow, hCol] = SCORE_SEQUENCE[seqIdx];

  const cellBorder = (r: number, c: number) => ({
    borderColor: r === hRow && c === hCol ? 'rgb(34,197,94)' : borderCol,
    backgroundColor:
      r === hRow && c === hCol ? 'rgba(34,197,94,0.2)' : 'transparent',
    transition: 'border-color 0.3s, background-color 0.3s',
  });

  return (
    <PreviewBox dark={dark}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-team-blue font-semibold text-sm">Scoring</span>
        <span
          className="text-xs"
          style={{ color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
        >
          AUTON Score: <span className="text-team-blue font-bold">0</span>
        </span>
      </div>
      {[1, 2, 3].map((balls, rowIdx) => (
        <div key={balls} className="flex items-center gap-2 mb-2">
          <span
            className="text-xs w-12 text-center"
            style={{
              color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
            }}
          >
            {balls} {balls === 1 ? 'ball' : 'balls'}
          </span>
          <div
            className="flex-1 flex flex-col items-center justify-center rounded-lg border py-2"
            style={cellBorder(rowIdx, 0)}
          >
            <div className="flex gap-1">
              {Array.from({ length: balls }).map((_, i) => (
                <div
                  key={i}
                  className="w-3.5 h-3.5 rounded-full border-2 border-dashed"
                  style={{ borderColor: circleBorder }}
                />
              ))}
            </div>
            <span
              className="text-[9px] mt-0.5"
              style={{
                color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
              }}
            >
              scored
            </span>
          </div>
          {Array.from({ length: balls }).map((_, idx) => (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center justify-center rounded-lg border py-2"
              style={cellBorder(rowIdx, idx + 1)}
            >
              <div className="flex gap-1">
                {Array.from({ length: idx + 1 }).map((_, j) => (
                  <div
                    key={j}
                    className="w-3.5 h-3.5 rounded-full border-2"
                    style={{ borderColor: circleBorder }}
                  />
                ))}
              </div>
              <span
                className="text-[9px] mt-0.5"
                style={{
                  color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                }}
              >
                scored
              </span>
            </div>
          ))}
        </div>
      ))}
    </PreviewBox>
  );
};

// ── Interactive Keybinds Guide: Step-by-step keyboard scoring ──────────────
const KeybindsPreview = ({ dark }: { dark: boolean }) => {
  const [step, setStep] = useState(0); // 0: press 3, 1: press 2, 2: press enter, 3: done
  
  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => (s + 1) % 4);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    { label: 'Press Shot Count', key: '3', desc: 'How many balls shot?' },
    { label: 'Press Made Count', key: '2', desc: 'How many scored?' },
    { label: 'Press Enter', key: '⏎', desc: 'Confirm & save' },
    { label: 'Score Recorded!', key: '✓', desc: 'Try it yourself' },
  ];

  const currentStep = steps[step];
  const keyBg = dark ? '#a855f7' : '#9333ea';
  const keyText = '#fff';
  const textDim = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';

  return (
    <PreviewBox dark={dark}>
      <div className="text-team-blue font-semibold text-sm mb-4">Keyboard Shortcut</div>
      
      {/* Animated input cells showing progress */}
      <div className="flex items-end gap-2 mb-6 h-16">
        {/* Shot cell */}
        <div className="flex-1 flex flex-col items-center">
          <div
            className="w-full h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all duration-500"
            style={{
              borderColor: step >= 0 ? keyBg : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
              backgroundColor: step >= 0 ? `${keyBg}22` : 'transparent',
              transform: step === 0 ? 'scale(1.05)' : 'scale(1)',
              color: step >= 0 ? keyBg : (dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'),
            }}
          >
            {step >= 0 ? '3' : '—'}
          </div>
          <span className="text-xs mt-2 text-center" style={{ color: textDim }}>Shot</span>
        </div>

        {/* Plus sign */}
        <div className="pb-4 text-lg font-light" style={{ color: textDim }}>+</div>

        {/* Made cell */}
        <div className="flex-1 flex flex-col items-center">
          <div
            className="w-full h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all duration-500"
            style={{
              borderColor: step >= 1 ? keyBg : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
              backgroundColor: step >= 1 ? `${keyBg}22` : 'transparent',
              transform: step === 1 ? 'scale(1.05)' : 'scale(1)',
              color: step >= 1 ? keyBg : (dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'),
            }}
          >
            {step >= 1 ? '2' : '—'}
          </div>
          <span className="text-xs mt-2 text-center" style={{ color: textDim }}>Made</span>
        </div>
      </div>

      {/* Key instruction */}
      <div className="flex flex-col items-center gap-3 py-4 px-3 rounded-xl" style={{ backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
        <div className="text-xs font-medium" style={{ color: textDim }}>{currentStep.desc}</div>
        <div
          className="px-6 py-3 rounded-lg font-bold text-lg transition-all duration-500"
          style={{
            backgroundColor: keyBg,
            color: keyText,
            transform: step === 2 ? 'scale(1.1)' : 'scale(1)',
            boxShadow: step === 2 ? `0 0 20px ${keyBg}66` : 'none',
          }}
        >
          {currentStep.key}
        </div>
        <div className="text-sm font-semibold" style={{ color: dark ? '#fff' : '#000' }}>{currentStep.label}</div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mt-4">
        {steps.map((_, i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: i <= step ? '8px' : '4px',
              backgroundColor: i <= step ? keyBg : (dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
            }}
          />
        ))}
      </div>
    </PreviewBox>
  );
};

const MetricsPreview = ({ dark }: { dark: boolean }) => {
  const borderCol = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textDim = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const cardBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const [view, setView] = useState<'leave' | 'endgame'>('leave');

  // Cycle between the two views
  useEffect(() => {
    const t = setInterval(() => setView(v => v === 'leave' ? 'endgame' : 'leave'), 2800);
    return () => clearInterval(t);
  }, []);

  const tabStyle = (active: boolean) => ({
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'default',
    backgroundColor: active ? 'rgb(var(--team-blue))' : 'transparent',
    color: active ? (dark ? '#000' : '#fff') : textDim,
    transition: 'all 0.3s',
  });

  return (
    <PreviewBox dark={dark}>
      <div className="text-team-blue font-semibold text-sm mb-3">Scoring Metrics</div>

      {/* Mini tab bar */}
      <div
        className="flex gap-1 rounded-lg p-0.5 mb-3"
        style={{ backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
      >
        {(['Autonomous', 'Endgame'] as const).map(t => (
          <div key={t} style={tabStyle((t === 'Autonomous') === (view === 'leave'))}>{t}</div>
        ))}
      </div>

      {view === 'leave' ? (
        <div
          className="rounded-lg p-3 flex flex-col gap-2"
          style={{ backgroundColor: cardBg, border: `1px solid ${borderCol}` }}
        >
          <div className="text-xs font-semibold" style={{ color: textDim }}>Autonomous Leave</div>
          <label className="flex items-center gap-2 cursor-default select-none">
            <div
              className="w-4 h-4 rounded flex items-center justify-center"
              style={{
                backgroundColor: 'rgb(var(--team-blue))',
                border: '2px solid rgb(var(--team-blue))',
              }}
            >
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke={dark ? '#000' : '#fff'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)' }}>
              Robot left starting zone
            </span>
            <span className="text-xs font-bold" style={{ color: 'rgb(var(--team-blue))' }}>+3 pts</span>
          </label>
          <div className="text-[10px] mt-1" style={{ color: textDim }}>✏️ Editable anytime — even after saving the match</div>
        </div>
      ) : (
        <div
          className="rounded-lg p-3 flex flex-col gap-2"
          style={{ backgroundColor: cardBg, border: `1px solid ${borderCol}` }}
        >
          <div className="text-xs font-semibold" style={{ color: textDim }}>Endgame — Robot Parking</div>
          {(['Robot 1', 'Robot 2'] as const).map(robot => (
            <div key={robot} className="flex items-center justify-between gap-2">
              <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)' }}>{robot}</span>
              <div className="flex gap-0 rounded overflow-hidden" style={{ border: `1px solid ${borderCol}` }}>
                {(['None', 'Partial', 'Full'] as const).map((val, vi) => (
                  <div
                    key={val}
                    className="px-2 py-1 text-[10px] font-medium"
                    style={{
                      backgroundColor: vi === (robot === 'Robot 1' ? 2 : 1)
                        ? 'rgb(var(--team-blue))'
                        : (dark ? '#1a1a1a' : '#f5f5f5'),
                      color: vi === (robot === 'Robot 1' ? 2 : 1)
                        ? (dark ? '#000' : '#fff')
                        : textDim,
                    }}
                  >
                    {val}
                  </div>
                ))}
              </div>
              <span className="text-xs font-bold" style={{ color: 'rgb(var(--team-blue))' }}>
                {robot === 'Robot 1' ? '10' : '5'} pts
              </span>
            </div>
          ))}
          <div className="text-[10px] mt-1" style={{ color: textDim }}>Both robots full park = 30 pts bonus!</div>
        </div>
      )}
    </PreviewBox>
  );
};
// ── Animated Gate: shows balls being released ───────────────────────────
const GatePreview = ({ dark }: { dark: boolean }) => {
  const [released, setReleased] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReleased(!released), 1600);
    return () => clearTimeout(t);
  }, [released]);

  const GATE_CAPACITY = 9;
  const ballsInGate = 6;

  return (
    <PreviewBox dark={dark}>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-team-blue font-semibold text-sm">Gate Mechanic</div>
        <span className="text-xs font-bold text-white bg-blue-500/40 px-1.5 py-0.5 rounded">
          G
        </span>
      </div>
      <div className="flex items-center justify-center gap-3 -mx-4 px-4 py-2">
        {Array.from({ length: GATE_CAPACITY }).map((_, i) => (
          <div
            key={i}
            className="w-6 h-6 rounded-full border-2 transition-all duration-500"
            style={{
              backgroundColor:
                i < (released ? 0 : ballsInGate)
                  ? i % 2 === 0
                    ? dark
                      ? '#a855f7'
                      : '#c084fc'
                    : dark
                      ? '#10b981'
                      : '#34d399'
                  : dark
                    ? '#374151'
                    : '#e5e7eb',
              borderColor:
                i < (released ? 0 : ballsInGate)
                  ? i % 2 === 0
                    ? dark
                      ? '#9333ea'
                      : '#a855f7'
                    : dark
                      ? '#059669'
                      : '#10b981'
                  : dark
                    ? '#4b5563'
                    : '#d1d5db',
              transform: released && i < ballsInGate ? 'scale(0) translateY(20px)' : 'scale(1) translateY(0)',
              opacity: released && i < ballsInGate ? 0 : 1,
            }}
          />
        ))}
      </div>
      <div
        className="text-xs mt-3 text-center"
        style={{
          color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
        }}
      >
        {released ? 'Released!' : `Holding ${ballsInGate} balls`}
      </div>
    </PreviewBox>
  );
};

// ── Live motif snapshot — shows the actual pattern set by the user ─────────
const MotifSnapshot = ({ dark }: { dark: boolean }) => {
  const { sessionData } = useSession();
  const pattern = sessionData.motifPattern ?? ['empty', 'empty', 'empty'];
  const allSet = pattern.every(c => c !== 'empty');

  const slotColor = (color: string) => {
    if (color === 'purple') return dark ? '#a855f7' : '#9333ea';
    if (color === 'green') return dark ? '#22c55e' : '#16a34a';
    return dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  };

  return (
    <div
      className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-3"
      style={{
        backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      <span className="text-xs font-medium opacity-50 shrink-0" style={{ color: dark ? '#fff' : '#000' }}>
        Your motif
      </span>
      <div className="flex gap-2">
        {pattern.map((color, i) => (
          <div
            key={i}
            className="w-5 h-5 rounded-full border-2 transition-colors duration-300"
            style={{
              backgroundColor: slotColor(color),
              borderColor: color === 'empty'
                ? (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)')
                : slotColor(color),
              opacity: color === 'empty' ? 0.4 : 1,
            }}
          />
        ))}
      </div>
      <span
        className="text-xs font-semibold ml-auto"
        style={{ color: allSet ? '#22c55e' : (dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)') }}
      >
        {allSet ? '✓ Set' : 'Not set'}
      </span>
    </div>
  );
};

// ─── Step data ──────────────────────────────────────────────────────────────

interface StepDef {
  title: string;
  body: string;
  target: string | null;
  preview: ((dark: boolean) => React.ReactNode) | null;
  /** Prompt shown when the user should interact with the real page element */
  pageAction?: string;
  /** Watch a sessionData/context field for automatic task completion */
  watchKey?: 'sessionName' | 'notes' | 'motifPattern' | 'matchActive' | 'shots' | 'motifScore';
  /** Listen for a custom DOM event for task completion (e.g. keyboard score, gate toggle) */
  watchEvent?: string;
  /** How many times the watchEvent must fire before completing (default: 1) */
  watchEventCount?: number;
}

const STEPS: StepDef[] = [
  {
    title: 'Welcome to TeamTrack!',
    body: 'Record every shot and motif during your match. The scoring, gate, and metrics panel are all you need. Replay anytime from the help button (?) in the top-right.',
    target: null,
    preview: null,
  },
  {
    title: 'Scoring Grid',
    body: 'Each row = balls shot. Tap to select how many scored — dashed are missed, solid are made.',
    target: 'scoring',
    preview: d => <ScoringPreview dark={d} />,
    pageAction: 'Record 3 shots using tap method',
    watchKey: 'shots',
  },
  {
    title: 'Keyboard Scoring',
    body: 'Faster method: press 1–3 for shot count, 0–N for made count, Enter to confirm. Try it below!',
    target: 'scoring',
    preview: d => <KeybindsPreview dark={d} />,
    pageAction: 'Score 1 shot using keyboard',
    watchEvent: TUTORIAL_KEYBOARD_SCORE_EVENT,
  },
  {
    title: 'Gate Mechanic',
    body: 'The gate holds classified balls. Click "Open Gate → Confirm" or press G → number → Enter. Quick way to manage your ball count.',
    target: 'gate',
    preview: d => <GatePreview dark={d} />,
    pageAction: 'Complete at least 2 gate cycles',
    watchEvent: TUTORIAL_GATE_CYCLE_EVENT,
    watchEventCount: 2,
  },
  {
    title: 'Motif Scoring',
    body: "When the match ends, click the 'M' buttons to score motif matches. Each press = +2 pts.",
    target: 'gate',
    preview: d => <MotifSnapshot dark={d} />,
    pageAction: 'Click at least one M button',
    watchKey: 'motifScore',
  },
  {
    title: 'Scoring Metrics',
    body: "Check Autonomous Leave, edit any shots, and toggle Motif buttons here. You can change anything after the match — just revisit before saving the session.",
    target: 'metrics',
    preview: d => <MetricsPreview dark={d} />,
    pageAction: 'Complete all 3 tasks in the panel below',
  },
  {
    title: "You're All Set!",
    body: 'Start a match and begin tracking. Save when done. Good luck!',
    target: null,
    preview: null,
  },
];

// ─── Highlight management ───────────────────────────────────────────────────
// Instead of blurring the parent (which creates a stacking context that traps
// all children), we:
//  1. Put a backdrop-filter overlay at z-index 9997 — this blurs anything
//     rendered BEHIND it.
//  2. Lift the target element above the overlay via inline position+z-index so
//     it renders ON TOP of the overlay and is never blurred.

const ORIGINAL_STYLES_KEY = '__tt_original_styles__';

function liftElement(el: HTMLElement, breathing = false, darkMode = true) {
  // Save originals so we can restore them
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
  // In light mode, force a solid white background so the element is fully
  // opaque against the dark backdrop overlay (same effect dark mode gets for free
  // from its natural dark background colors).
  if (!darkMode) {
    el.style.backgroundColor = '#ffffff';
  }
  // Always apply a static blue border (don't pulse the containers)
  // Only the clickable elements inside (M buttons, shot numbers, leave text) pulse
  el.style.border = `2px solid rgb(var(--team-blue) / 0.4)`;
  el.style.boxShadow = 'none';
}

function dropElement(el: HTMLElement) {
  el.classList.remove('tt-breathe');
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

// ─── Component ──────────────────────────────────────────────────────────────

export const ActiveTutorial = () => {
  const { isDarkMode } = useTheme();
  const { user, isGuest, guestId, loading } = useAuth();
  const { sessionData, matchActive, setMatchActive, setMatchPhase, setIsTimerRunning, resetSession, updateSessionData } = useSession();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [tutorialEventCount, setTutorialEventCount] = useState(0);
  const [motifStepInitialized, setMotifStepInitialized] = useState(false);
  // bitmask: bit 0 = leave done, bit 1 = shot edited, bit 2 = motif toggled
  const [metricsTasksMask, setMetricsTasksMask] = useState(0);
  /** true when the user has already completed the tutorial once — all tasks are pre-skippable */
  const [isReplay, setIsReplay] = useState(false);
  const prevElRef = useRef<HTMLElement | null>(null);

  // Generate a stable tutorial key for both logged-in users and guests
  const getTutorialKey = useCallback(() => {
    if (user?.uid) return `${TUTORIAL_STORAGE_KEY}-${user.uid}`;
    if (guestId) return `${TUTORIAL_STORAGE_KEY}-guest-${guestId}`;
    return TUTORIAL_STORAGE_KEY;
  }, [user, guestId]);

  // Start tutorial when navigated here via the header button
  useEffect(() => {
    const shouldStart = sessionStorage.getItem('teamtrack-start-tutorial');
    if (shouldStart) {
      sessionStorage.removeItem('teamtrack-start-tutorial');
      const t = setTimeout(() => {
        setStep(0);
        setVisible(true);
      }, 500);
      return () => clearTimeout(t);
    }
  }, []); // only on mount — independent of user loading

  // Auto-show on first visit — works for both logged-in users AND guests
  useEffect(() => {
    // Wait until auth has resolved (not still loading)
    if (loading) return;
    // Must have some identity (logged-in user OR guest)
    if (!user && !isGuest) return;
    const tutorialKey = getTutorialKey();
    const seen = localStorage.getItem(tutorialKey);
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(t);
    }
  }, [loading, user, isGuest, getTutorialKey]);

  // Detect whether this is a replay (user has already seen the tutorial)
  useEffect(() => {
    if (!visible) return;
    const tutorialKey = getTutorialKey();
    const seen = localStorage.getItem(tutorialKey);
    setIsReplay(!!seen);
  }, [visible, getTutorialKey]);

  // When replaying, auto-complete any page task so the user can click Next freely
  useEffect(() => {
    if (!visible || !isReplay) return;
    const current = STEPS[step];
    if (current?.pageAction) setTaskCompleted(true);
  }, [visible, step, isReplay]);

  // Activate match at the Scoring Grid step so the scoring grid becomes editable
  useEffect(() => {
    if (!visible) return;
    const SCORING_GRID_STEP_INDEX = STEPS.findIndex(s => s.title === 'Scoring Grid');
    if (step >= SCORING_GRID_STEP_INDEX && !matchActive) {
      setMatchActive(true);
      // Set initial phase and timer state for scoring to work
      if (sessionData.matchType === 'Teleop') {
        setMatchPhase('teleop');
      } else {
        setMatchPhase('auton');
      }
    }
  }, [visible, step, matchActive, sessionData.matchType, setMatchActive, setMatchPhase]);

  // Listen for restart
  useEffect(() => {
    const handle = () => {
      setStep(0);
      setVisible(true);
    };
    window.addEventListener(TUTORIAL_RESTART_EVENT, handle);
    return () => window.removeEventListener(TUTORIAL_RESTART_EVENT, handle);
  }, []);

  // Watch real sessionData/context for page-level task completion
  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    if (!current?.watchKey || taskCompleted) return;

    const key = current.watchKey;
    if (key === 'sessionName' && sessionData.sessionName?.trim()) {
      setTaskCompleted(true);
    }
    if (key === 'notes' && sessionData.notes?.trim()) {
      setTaskCompleted(true);
    }
    if (key === 'motifPattern') {
      const pattern = sessionData.motifPattern ?? [];
      if (pattern.length === 3 && pattern.every(s => s !== 'empty')) {
        setTaskCompleted(true);
      }
    }
    if (key === 'matchActive' && matchActive) {
      setTaskCompleted(true);
    }
    if (key === 'shots') {
      const total =
        (sessionData.autonShots?.length ?? 0) +
        (sessionData.teleopShots?.length ?? 0);
      if (total >= 3) setTaskCompleted(true);
    }
    if (key === 'motifScore') {
      if ((sessionData.autonMotif ?? 0) > 0 || (sessionData.teleMotif ?? 0) > 0) {
        setTaskCompleted(true);
      }
    }
  }, [
    visible,
    step,
    taskCompleted,
    sessionData.sessionName,
    sessionData.notes,
    sessionData.motifPattern,
    sessionData.autonShots,
    sessionData.teleopShots,
    sessionData.autonMotif,
    sessionData.teleMotif,
    matchActive,
  ]);

  // Broadcast current step to dependent components (like SessionSetup)
  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    window.dispatchEvent(new CustomEvent('teamtrack-tutorial-step-changed', {
      detail: { step, target: current?.target, taskCompleted }
    }));
  }, [visible, step, taskCompleted]);

  // When on the motif scoring step, force match state to 'ended' so real M buttons appear
  const MOTIF_STEP_INDEX = STEPS.findIndex(s => s.watchKey === 'motifScore');
  useEffect(() => {
    if (!visible || step !== MOTIF_STEP_INDEX) {
      setMotifStepInitialized(false);
      return;
    }
    if (motifStepInitialized) return; // Only run once per step entry
    
    setMotifStepInitialized(true);
    
    // Ensure motif pattern is set and gate has balls so M buttons are visible
    const currentPattern = sessionData.motifPattern ?? ['empty', 'empty', 'empty'];
    const noneSet = currentPattern.every(c => c === 'empty');
    const updates: Record<string, any> = {};
    
    if (noneSet) {
      updates.motifPattern = ['purple', 'green', 'purple'];
    }
    if ((sessionData.gateBallCount ?? 0) < 3) {
      updates.gateBallCount = 3;
    }
    
    if (Object.keys(updates).length > 0) {
      updateSessionData(updates);
    }
    
    setMatchActive(true);
    setMatchPhase('ended');
    setIsTimerRunning(false);
  }, [visible, step, MOTIF_STEP_INDEX, sessionData.motifPattern, sessionData.gateBallCount, motifStepInitialized, setMatchActive, setMatchPhase, setIsTimerRunning, updateSessionData]);

  // Open the Autonomous tab in Scoring Metrics when that step is reached
  const METRICS_STEP_INDEX = STEPS.findIndex(s => s.title === 'Scoring Metrics');
  useEffect(() => {
    if (!visible || step !== METRICS_STEP_INDEX) return;
    window.dispatchEvent(new CustomEvent(TUTORIAL_METRICS_AUTON_TAB_EVENT));
  }, [visible, step, METRICS_STEP_INDEX]);

  // Listen for the 3 sub-tasks on the Scoring Metrics step
  useEffect(() => {
    if (!visible || step !== METRICS_STEP_INDEX || taskCompleted) return;
    const makeHandler = (bit: number) => () => {
      setMetricsTasksMask(prev => {
        const next = prev | bit;
        if ((next & 0b111) === 0b111) setTaskCompleted(true);
        return next;
      });
    };
    const leaveHandler = makeHandler(0b001);
    const shotHandler  = makeHandler(0b010);
    const motifHandler = makeHandler(0b100);
    window.addEventListener(TUTORIAL_METRICS_LEAVE_EVENT, leaveHandler);
    window.addEventListener(TUTORIAL_METRICS_SHOT_EDIT_EVENT, shotHandler);
    window.addEventListener(TUTORIAL_METRICS_MOTIF_EDIT_EVENT, motifHandler);
    return () => {
      window.removeEventListener(TUTORIAL_METRICS_LEAVE_EVENT, leaveHandler);
      window.removeEventListener(TUTORIAL_METRICS_SHOT_EDIT_EVENT, shotHandler);
      window.removeEventListener(TUTORIAL_METRICS_MOTIF_EDIT_EVENT, motifHandler);
    };
  }, [visible, step, taskCompleted, METRICS_STEP_INDEX]);

  // Reset event count and metrics task mask when step changes
  useEffect(() => {
    setTutorialEventCount(0);
    setMetricsTasksMask(0);
  }, [step]);

  // Listen for custom DOM events — supports counted requirements (watchEventCount)
  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    if (!current?.watchEvent || taskCompleted) return;

    const required = current.watchEventCount ?? 1;
    const handler = () => {
      setTutorialEventCount(prev => {
        const next = prev + 1;
        if (next >= required) setTaskCompleted(true);
        return next;
      });
    };

    window.addEventListener(current.watchEvent, handler);
    return () => window.removeEventListener(current.watchEvent!, handler);
  }, [visible, step, taskCompleted]);

  // Remove lift from previous element + apply to new one
  const applyHighlight = useCallback((targetAttr: string | null, breathing = false, dark = isDarkMode) => {
    // Drop previous
    if (prevElRef.current) {
      dropElement(prevElRef.current);
      prevElRef.current = null;
    }
    if (!targetAttr) return;

    // Special handling: if targeting session-setup and it's not in DOM,
    // send event to open it
    if (targetAttr === 'session-setup') {
      const el = document.querySelector<HTMLElement>(
        `[data-tutorial="${targetAttr}"]`
      );
      if (!el) {
        // Panel is closed, emit event to open it
        window.dispatchEvent(
          new CustomEvent(TUTORIAL_OPEN_SESSION_SETUP_EVENT)
        );
        // Re-query after a small delay to give React time to render
        setTimeout(() => {
          const newEl = document.querySelector<HTMLElement>(
            `[data-tutorial="${targetAttr}"]`
          );
          if (newEl) {
            liftElement(newEl, breathing, dark);
            prevElRef.current = newEl;
            const rect = newEl.getBoundingClientRect();
            const viewH = window.innerHeight;
            if (rect.top < 80 || rect.bottom > viewH - 80) {
              newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 50);
        return;
      }
    }

    const el = document.querySelector<HTMLElement>(
      `[data-tutorial="${targetAttr}"]`
    );
    if (!el) return;

    liftElement(el, breathing, dark);
    prevElRef.current = el;

    // Scroll into view if needed
    const rect = el.getBoundingClientRect();
    const viewH = window.innerHeight;
    if (rect.top < 80 || rect.bottom > viewH - 80) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const clearHighlight = useCallback(() => {
    if (prevElRef.current) {
      dropElement(prevElRef.current);
      prevElRef.current = null;
    }
  }, []);

  // Apply highlight on step change
  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    const hasPageTask = !!current?.pageAction;
    applyHighlight(current?.target ?? null, hasPageTask, isDarkMode);
  }, [visible, step, applyHighlight, isDarkMode]);

  // Clean up when hidden
  useEffect(() => {
    if (!visible) clearHighlight();
    return () => clearHighlight();
  }, [visible, clearHighlight]);

  const dismiss = useCallback(() => {
    setVisible(false);
    clearHighlight();
    // Reset all session data
    resetSession();
    // Notify other components (e.g. clear keybind popup)
    window.dispatchEvent(new Event(TUTORIAL_ENDED_EVENT));
    // Scroll back to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Mark tutorial as seen for this user/guest
    const tutorialKey = getTutorialKey();
    localStorage.setItem(tutorialKey, 'true');
  }, [getTutorialKey, clearHighlight, resetSession]);

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) dismiss();
    else {
      setTaskCompleted(false);
      setStep(s => {
        const nextStep = s + 1;
        window.dispatchEvent(new CustomEvent('teamtrack-tutorial-step-changed', {
          detail: { step: nextStep, target: STEPS[nextStep]?.target }
        }));
        return nextStep;
      });
    }
  }, [step, dismiss]);

  const prev = useCallback(() => {
    if (step > 0) {
      setTaskCompleted(false);
      setStep(s => {
        const prevStep = s - 1;
        window.dispatchEvent(new CustomEvent('teamtrack-tutorial-step-changed', {
          detail: { step: prevStep, target: STEPS[prevStep]?.target }
        }));
        return prevStep;
      });
    }
  }, [step]);

  // Keyboard capture
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      const currentStep = STEPS[step];
      const hasPageTask = !!currentStep?.pageAction && !taskCompleted;

      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        dismiss();
      }
      if (e.key === 'ArrowRight') {
        e.stopPropagation();
        e.preventDefault();
        if (!hasPageTask) next();
      }
      if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [visible, next, prev, dismiss, step, taskCompleted]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const hasTarget = !!current.target;

  const teamBlue = 'rgb(var(--team-blue))';
  // Light mode: stronger border opacity so it's visible against white background
  const teamBlue50 = isDarkMode ? 'rgb(var(--team-blue) / 0.5)' : 'rgb(var(--team-blue) / 0.75)';
  const teamBlue80 = 'rgb(var(--team-blue) / 0.8)';
  const bg = isDarkMode ? '#191919' : '#ffffff';
  const text = isDarkMode ? '#ffffff' : '#111111';
  const subtext = isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';

  const hasPageTask = !!current.pageAction;
  const taskPending = hasPageTask && !taskCompleted;

  return (
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
        @keyframes ttCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes ttBreathe {
          0%, 100% {
            box-shadow: 0 0 0 4px rgb(var(--team-blue) / 0.35),
                        0 0 40px rgb(var(--team-blue) / 0.12);
          }
          50% {
            box-shadow: 0 0 0 6px rgb(var(--team-blue) / 0.55),
                        0 0 70px rgb(var(--team-blue) / 0.25);
          }
        }
        /* Stronger variant for light mode where team-blue is a muted #537788 */
        @keyframes ttBreatheLight {
          0%, 100% {
            box-shadow: 0 0 0 3px rgb(var(--team-blue) / 0.75),
                        0 0 28px rgb(var(--team-blue) / 0.22);
          }
          50% {
            box-shadow: 0 0 0 5px rgb(var(--team-blue) / 0.95),
                        0 0 48px rgb(var(--team-blue) / 0.35);
          }
        }
        .tt-card-slide { animation: ttCardIn 0.3s ease-out forwards; }
        .tt-card-center { animation: ttCardCenter 0.25s ease-out forwards; }
        .tt-breathe { animation: ttBreathe 2s ease-in-out infinite; }
        .tt-breathe[data-tt-dark="0"] { animation: ttBreatheLight 2s ease-in-out infinite; }
      `}</style>

      {/*
        Backdrop overlay.
        backdrop-filter blurs the content rendered BEHIND this element.
        The target element is lifted above (z-index 9999) so it renders
        ON TOP of this overlay and is NOT affected by the blur.
        pointer-events: none allows clicks to pass through to interactive elements.
      */}
      <div
        className="fixed inset-0 z-[9997]"
        style={{
          backgroundColor: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          pointerEvents: 'none',
        }}
      />

      {/* Tutorial card */}
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
        {/* Progress bar */}
        <div
          className="absolute top-0 left-0 h-1 rounded-tl-[20px] transition-all duration-300"
          style={{
            width: `${((step + 1) / STEPS.length) * 100}%`,
            background: `linear-gradient(90deg, ${teamBlue80}, ${teamBlue})`,
            borderTopRightRadius: isLast ? 20 : 0,
          }}
        />

        {/* Step counter */}
        <div
          className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: teamBlue }}
        >
          {step + 1} / {STEPS.length}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold mb-1.5" style={{ color: teamBlue }}>
          {current.title}
        </h3>

        {/* Body */}
        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: subtext }}>
          {current.body}
        </p>

        {/* Preview */}
        {current.preview && current.preview(isDarkMode)}

        {/* Page action prompt — guides user to interact with the real page element */}
        {hasPageTask && step === METRICS_STEP_INDEX ? (
          /* 3-item checklist for the Scoring Metrics step */
          <div className="mt-4 flex flex-col gap-2">
            {[
              { label: 'Check Autonomous Leave', bit: 0b001 },
              { label: 'Edit a shot value',       bit: 0b010 },
              { label: 'Toggle a Motif (M button)', bit: 0b100 },
            ].map(({ label, bit }) => {
              const done = !!(metricsTasksMask & bit);
              return (
                <div
                  key={bit}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-300"
                  style={{
                    backgroundColor: done
                      ? isDarkMode ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)'
                      : isDarkMode ? 'rgba(var(--team-blue) / 0.1)' : 'rgba(var(--team-blue) / 0.08)',
                    border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : 'rgb(var(--team-blue) / 0.25)'}`,
                  }}
                >
                  {done ? (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'rgba(34,197,94,0.2)' }}
                    >
                      <span className="text-green-500 text-xs font-bold">✓</span>
                    </div>
                  ) : (
                    <ArrowUp size={16} className="flex-shrink-0" style={{ color: teamBlue }} />
                  )}
                  <span
                    className="text-xs font-medium"
                    style={{ color: done ? (isDarkMode ? 'rgba(34,197,94,0.9)' : 'rgba(34,197,94,1)') : teamBlue }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : hasPageTask ? (
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
                ? 'Done — you can continue'
                : current.watchEventCount && current.watchEventCount > 1
                  ? `${current.pageAction} (${Math.min(tutorialEventCount, current.watchEventCount)}/${current.watchEventCount})`
                  : current.watchKey === 'shots'
                    ? (() => {
                        const n = (sessionData.autonShots?.length ?? 0) + (sessionData.teleopShots?.length ?? 0);
                        return `${current.pageAction} (${Math.min(n, 3)}/3)`;
                      })()
                    : current.pageAction}
            </span>
          </div>
        ) : null}

        {/* Controls */}
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
              onClick={() => {
                if (taskPending) return;
                next();
              }}
              className={`px-5 py-2 text-sm font-bold rounded-xl transition-all duration-200 ${
                taskPending ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundColor: taskPending
                  ? isDarkMode
                    ? 'rgba(255,255,255,0.15)'
                    : 'rgba(0,0,0,0.1)'
                  : teamBlue,
                color: taskPending
                  ? isDarkMode
                    ? 'rgba(255,255,255,0.4)'
                    : 'rgba(0,0,0,0.35)'
                  : isDarkMode
                    ? '#000'
                    : '#fff',
              }}
            >
              {isLast
                ? 'Get Started'
                : taskPending
                  ? 'Interact above to continue'
                  : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
