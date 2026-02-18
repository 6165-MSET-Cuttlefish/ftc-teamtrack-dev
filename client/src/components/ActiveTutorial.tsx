import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts';
import { Settings } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

export const TUTORIAL_STORAGE_KEY = 'teamtrack-tutorial-v1-seen';
export const TUTORIAL_RESTART_EVENT = 'teamtrack-restart-tutorial';

// ─── Visual previews for each step ─────────────────────────────────────────

/** Reusable mini-card wrapper for previews */
const PreviewBox = ({ children, dark }: { children: React.ReactNode; dark: boolean }) => (
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

/** Step 2 – Session Settings mockup */
const SettingsPreview = ({ dark }: { dark: boolean }) => {
  const inputBg = dark ? '#191919' : '#fff';
  const borderCol = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  const labelCol = dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  return (
    <PreviewBox dark={dark}>
      <div className="text-team-blue font-semibold text-sm mb-3">Session Settings</div>
      <div className="space-y-2">
        <div>
          <div className="text-xs mb-1" style={{ color: labelCol }}>Session Name *</div>
          <div className="rounded-lg px-3 py-2 text-xs border" style={{ backgroundColor: inputBg, borderColor: borderCol, color: dark ? '#fff' : '#000' }}>
            My Practice Session
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-xs mb-1" style={{ color: labelCol }}>Match Type</div>
            <div className="rounded-lg px-3 py-2 text-xs border" style={{ backgroundColor: inputBg, borderColor: borderCol, color: dark ? '#fff' : '#000' }}>
              Full Game
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs mb-1" style={{ color: labelCol }}>Features</div>
            <div className="rounded-lg px-3 py-2 text-xs border" style={{ backgroundColor: inputBg, borderColor: borderCol, color: dark ? '#fff' : '#000' }}>
              Cycle Times ✓
            </div>
          </div>
        </div>
        <button
          className="w-full py-1.5 rounded-lg text-xs font-bold mt-1"
          style={{ backgroundColor: 'rgb(var(--team-blue))', color: dark ? '#000' : '#fff' }}
        >
          Save
        </button>
      </div>
    </PreviewBox>
  );
};

/** Step 3 – Timer mockup */
const TimerPreview = ({ dark }: { dark: boolean }) => (
  <PreviewBox dark={dark}>
    <div className="flex flex-col items-center py-2">
      <div
        className="text-4xl font-bold tracking-wider"
        style={{ fontFamily: '"Righteous", sans-serif', letterSpacing: '0.05em', fontWeight: 400, color: dark ? '#fff' : '#000' }}
      >
        2:30
      </div>
      <div className="flex items-center gap-4 mt-2">
        <span className="text-xs font-semibold uppercase" style={{ color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>Full Game</span>
        <span className="text-xs font-semibold" style={{ color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Session: 0:00</span>
        <span className="text-xs font-semibold uppercase" style={{ color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>Match 1 Not Started</span>
      </div>
    </div>
  </PreviewBox>
);

/** Step 4 – Match Controls mockup */
const ControlsPreview = ({ dark }: { dark: boolean }) => (
  <PreviewBox dark={dark}>
    <div className="flex items-center gap-2">
      <div className="flex-1 px-3 py-2.5 rounded-xl border-2 border-green-500/40 bg-green-500/15 text-green-500 text-xs font-bold text-center">
        Start Match
      </div>
      <div className="px-3 py-2.5 rounded-xl border-2 flex items-center justify-center" style={{ borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', backgroundColor: dark ? '#191919' : '#fff' }}>
        <Settings className="h-4 w-4" style={{ color: dark ? '#fff' : '#000' }} />
      </div>
      <div className="px-3 py-2.5 rounded-xl border-2 border-green-500/40 bg-green-500/15 text-green-500 text-xs font-bold text-center whitespace-nowrap">
        Complete
      </div>
      <div className="px-3 py-2.5 rounded-xl border-2 border-red-500/40 bg-red-500/15 text-red-500 text-xs font-bold text-center whitespace-nowrap">
        Cancel
      </div>
    </div>
  </PreviewBox>
);

/** Step 5 – Scoring Grid mockup */
const ScoringPreview = ({ dark }: { dark: boolean }) => {
  const borderCol = dark ? 'rgb(var(--team-blue) / 0.4)' : 'rgba(0,0,0,0.15)';
  const circleBorder = dark ? '#fff' : '#000';
  return (
    <PreviewBox dark={dark}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-team-blue font-semibold text-sm">Scoring</span>
        <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>AUTON Score: <span className="text-team-blue font-bold">0</span></span>
      </div>
      {[1, 2, 3].map((balls) => (
        <div key={balls} className="flex items-center gap-2 mb-2">
          <span className="text-xs w-12 text-center" style={{ color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>
            {balls} {balls === 1 ? 'ball' : 'balls'}
          </span>
          {/* 0 scored = dashed */}
          <div className="flex-1 flex flex-col items-center justify-center rounded-lg border py-2" style={{ borderColor: borderCol }}>
            <div className="flex gap-1">
              {Array.from({ length: balls }).map((_, i) => (
                <div key={i} className="w-3.5 h-3.5 rounded-full border-2 border-dashed" style={{ borderColor: circleBorder }} />
              ))}
            </div>
            <span className="text-[9px] mt-0.5" style={{ color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>scored</span>
          </div>
          {/* 1..balls scored = solid */}
          {Array.from({ length: balls }).map((_, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center justify-center rounded-lg border py-2" style={{ borderColor: borderCol }}>
              <div className="flex gap-1">
                {Array.from({ length: idx + 1 }).map((_, j) => (
                  <div key={j} className="w-3.5 h-3.5 rounded-full border-2" style={{ borderColor: circleBorder }} />
                ))}
              </div>
              <span className="text-[9px] mt-0.5" style={{ color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>scored</span>
            </div>
          ))}
        </div>
      ))}
    </PreviewBox>
  );
};

/** Step 6 – Keybinds mockup */
const KeybindsPreview = ({ dark }: { dark: boolean }) => {
  const kbdStyle: React.CSSProperties = {
    backgroundColor: dark ? '#333' : '#e5e5e5',
    color: dark ? '#fff' : '#000',
    borderRadius: 6,
    padding: '2px 10px',
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 600,
    display: 'inline-block',
  };
  const arrowCol = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  return (
    <PreviewBox dark={dark}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span style={kbdStyle}>1</span>
          <span style={kbdStyle}>2</span>
          <span style={kbdStyle}>3</span>
          <span className="text-xs" style={{ color: arrowCol }}>→</span>
          <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>balls shot</span>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span style={kbdStyle}>0</span>
          <span style={kbdStyle}>1</span>
          <span style={kbdStyle}>2</span>
          <span style={kbdStyle}>3</span>
          <span className="text-xs" style={{ color: arrowCol }}>→</span>
          <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>balls made</span>
        </div>
        <div className="flex items-center justify-center gap-3">
          <span style={{ ...kbdStyle, padding: '2px 14px' }}>Enter</span>
          <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>confirm</span>
          <span style={{ ...kbdStyle, padding: '2px 12px' }}>Esc</span>
          <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>cancel</span>
        </div>
      </div>
    </PreviewBox>
  );
};

/** Step 7 – Performance Metrics tabs mockup */
const MetricsPreview = ({ dark }: { dark: boolean }) => {
  const tabs = ['Final', 'Autonomous', 'Teleop', 'Endgame'];
  return (
    <PreviewBox dark={dark}>
      <div className="text-team-blue font-semibold text-sm mb-2">Performance Metrics</div>
      <div className="flex gap-1 mb-3">
        {tabs.map((tab, i) => (
          <div
            key={tab}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-center"
            style={{
              backgroundColor: i === 0 ? 'rgb(var(--team-blue))' : (dark ? '#2a2a2a' : '#eee'),
              color: i === 0 ? (dark ? '#000' : '#fff') : (dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'),
            }}
          >
            {tab}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['Total Score', 'Accuracy', 'Shots'].map((label) => (
          <div key={label} className="rounded-lg p-2 text-center" style={{ backgroundColor: dark ? '#191919' : '#fff' }}>
            <div className="text-team-blue text-lg font-bold">0</div>
            <div className="text-[10px]" style={{ color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>{label}</div>
          </div>
        ))}
      </div>
    </PreviewBox>
  );
};

/** Step 8 – Notes mockup */
const NotesPreview = ({ dark }: { dark: boolean }) => (
  <PreviewBox dark={dark}>
    <div className="text-team-blue font-semibold text-sm mb-2">Notes</div>
    <div
      className="rounded-lg border p-2 text-xs"
      style={{
        backgroundColor: dark ? '#191919' : '#fff',
        borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
        minHeight: 48,
      }}
    >
      Performance observations, strategies, notes...
    </div>
  </PreviewBox>
);

// ─── Step data ──────────────────────────────────────────────────────────────

interface StepDef {
  title: string;
  body: string;
  preview: ((dark: boolean) => React.ReactNode) | null;
}

const STEPS: StepDef[] = [
  {
    title: 'Welcome to TeamTrack!',
    body: 'This quick walkthrough will show you how the Active Practice Session works. You can replay this anytime from the help button (?) in the top-right.',
    preview: null,
  },
  {
    title: 'Session Settings',
    body: 'Start here! Enter a session name, pick your match type, and toggle features. You must press Save before starting a match — the panel turns red until you do.',
    preview: (dark) => <SettingsPreview dark={dark} />,
  },
  {
    title: 'Match Timer',
    body: 'The timer counts down from 2:30 during a full game. It transitions through Autonomous → Controller Pickup (5 s) → Prepare (3 s) → Teleop. The last 20 seconds appear as End Game.',
    preview: (dark) => <TimerPreview dark={dark} />,
  },
  {
    title: 'Match Controls',
    body: 'Click "Start Match" to begin. After the match, click "Save Match" to record it. Use the gear icon for settings, and the other buttons to complete or cancel the session.',
    preview: (dark) => <ControlsPreview dark={dark} />,
  },
  {
    title: 'Scoring Grid',
    body: 'Each row represents 1, 2, or 3 balls shot. Tap how many scored — dashed circles = missed, solid = scored. Each made ball is worth 3 points.',
    preview: (dark) => <ScoringPreview dark={dark} />,
  },
  {
    title: 'Keyboard Shortcuts',
    body: 'Press 1–3 for balls shot, then 0–N for balls made, then Enter to confirm. Press Escape to cancel. Shortcuts only work while a match is running.',
    preview: (dark) => <KeybindsPreview dark={dark} />,
  },
  {
    title: 'Performance Metrics',
    body: 'Switch tabs for Autonomous, Teleop, and Endgame breakdowns. Track shot logs, robot parking, accuracy, and the live final score.',
    preview: (dark) => <MetricsPreview dark={dark} />,
  },
  {
    title: 'Notes',
    body: 'Jot down observations — strategies, mistakes, or anything to review later in the session analysis.',
    preview: (dark) => <NotesPreview dark={dark} />,
  },
  {
    title: "You're All Set!",
    body: 'Save your session settings, start your first match, and let TeamTrack handle the rest. Good luck at your next competition! 🤖',
    preview: null,
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export const ActiveTutorial = () => {
  const { isDarkMode } = useTheme();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  // Auto-show on first visit
  useEffect(() => {
    const seen = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(t);
    }
  }, []);

  // Listen for restart events
  useEffect(() => {
    const handleRestart = () => {
      setStep(0);
      setVisible(true);
    };
    window.addEventListener(TUTORIAL_RESTART_EVENT, handleRestart);
    return () => window.removeEventListener(TUTORIAL_RESTART_EVENT, handleRestart);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
  }, []);

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) dismiss();
    else setStep((s) => s + 1);
  }, [step, dismiss]);

  const prev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  // Keyboard (capture phase to block scoring keybinds)
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); dismiss(); }
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.stopPropagation(); e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [visible, next, prev, dismiss]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const teamBlue = 'rgb(var(--team-blue))';
  const teamBlue50 = 'rgb(var(--team-blue) / 0.5)';
  const teamBlue80 = 'rgb(var(--team-blue) / 0.8)';
  const bg = isDarkMode ? '#191919' : '#ffffff';
  const text = isDarkMode ? '#ffffff' : '#111111';
  const subtext = isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';

  return (
    <>
      <style>{`
        @keyframes ttFadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .tt-overlay-card {
          animation: ttFadeIn 0.25s ease-out forwards;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        onClick={dismiss}
      />

      {/* Centered card */}
      <div
        key={step}
        className="fixed z-[10000] tt-overlay-card"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(440px, 92vw)',
          maxHeight: '88vh',
          overflowY: 'auto',
          backgroundColor: bg,
          border: `2px solid ${teamBlue50}`,
          color: text,
          borderRadius: 20,
          padding: '24px 24px 20px',
        }}
        onClick={(e) => e.stopPropagation()}
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
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: teamBlue }}>
          {step + 1} / {STEPS.length}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold mb-1.5" style={{ color: teamBlue }}>
          {current.title}
        </h3>

        {/* Body */}
        <p className="text-sm leading-relaxed" style={{ color: subtext }}>
          {current.body}
        </p>

        {/* Embedded visual preview */}
        {current.preview && current.preview(isDarkMode)}

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
                style={{ border: `1px solid ${teamBlue50}`, color: teamBlue, backgroundColor: 'transparent' }}
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="px-5 py-2 text-sm font-bold rounded-xl transition-all"
              style={{ backgroundColor: teamBlue, color: isDarkMode ? '#000' : '#fff' }}
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <div className="mt-2.5 text-center text-xs opacity-30" style={{ color: text }}>
          ← → or Enter to navigate · Esc to skip
        </div>
      </div>
    </>
  );
};
