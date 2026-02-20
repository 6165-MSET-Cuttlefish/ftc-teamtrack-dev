import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme, useAuth, useSession } from '@/contexts';
import { Settings } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

export const TUTORIAL_STORAGE_KEY = 'teamtrack-tutorial-v1-seen';
export const TUTORIAL_RESTART_EVENT = 'teamtrack-restart-tutorial';
export const TUTORIAL_OPEN_SESSION_SETUP_EVENT = 'teamtrack-tutorial-open-session-setup';

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

// ── Animated Settings: types session name then clicks Save ──────────────
const SettingsPreview = ({ dark }: { dark: boolean }) => {
  const inputBg = dark ? '#191919' : '#fff';
  const borderCol = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  const labelCol = dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const fullText = 'My Practice Session';
  const [charIdx, setCharIdx] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'save' | 'pause'>('typing');

  useEffect(() => {
    if (phase === 'typing') {
      if (charIdx < fullText.length) {
        const t = setTimeout(() => setCharIdx(i => i + 1), 80);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase('save'), 500);
      return () => clearTimeout(t);
    }
    if (phase === 'save') {
      const t = setTimeout(() => setPhase('pause'), 1200);
      return () => clearTimeout(t);
    }
    // pause → restart
    const t = setTimeout(() => {
      setCharIdx(0);
      setPhase('typing');
    }, 800);
    return () => clearTimeout(t);
  }, [phase, charIdx]);

  return (
    <PreviewBox dark={dark}>
      <div className="text-team-blue font-semibold text-sm mb-3">
        Session Settings
      </div>
      <div className="space-y-2">
        <div>
          <div className="text-xs mb-1" style={{ color: labelCol }}>
            Session Name *
          </div>
          <div
            className="rounded-lg px-3 py-2 text-xs border flex items-center"
            style={{
              backgroundColor: inputBg,
              borderColor:
                phase === 'typing' ? 'rgb(var(--team-blue))' : borderCol,
              color: dark ? '#fff' : '#000',
              transition: 'border-color 0.2s',
            }}
          >
            <span>{fullText.slice(0, charIdx)}</span>
            {phase === 'typing' && (
              <span
                className="inline-block w-[2px] h-3.5 ml-[1px]"
                style={{
                  backgroundColor: 'rgb(var(--team-blue))',
                  animation: 'ttCursorBlink 0.8s step-end infinite',
                }}
              />
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-xs mb-1" style={{ color: labelCol }}>
              Match Type
            </div>
            <div
              className="rounded-lg px-3 py-2 text-xs border"
              style={{
                backgroundColor: inputBg,
                borderColor: borderCol,
                color: dark ? '#fff' : '#000',
              }}
            >
              Full Game
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs mb-1" style={{ color: labelCol }}>
              Features
            </div>
            <div
              className="rounded-lg px-3 py-2 text-xs border"
              style={{
                backgroundColor: inputBg,
                borderColor: borderCol,
                color: dark ? '#fff' : '#000',
              }}
            >
              Cycle Times ✓
            </div>
          </div>
        </div>
        <button
          className="w-full py-1.5 rounded-lg text-xs font-bold mt-1"
          style={{
            backgroundColor: 'rgb(var(--team-blue))',
            color: dark ? '#000' : '#fff',
            boxShadow:
              phase === 'save'
                ? '0 0 20px rgb(var(--team-blue) / 0.6)'
                : 'none',
            transform: phase === 'save' ? 'scale(1.04)' : 'scale(1)',
            transition: 'box-shadow 0.3s, transform 0.3s',
          }}
        >
          Save{phase === 'save' ? ' ✓' : ''}
        </button>
      </div>
    </PreviewBox>
  );
};

// ── Animated Timer: ticks down from 2:30 ────────────────────────────────
const TimerPreview = ({ dark }: { dark: boolean }) => {
  const [seconds, setSeconds] = useState(150);

  useEffect(() => {
    const id = setInterval(
      () => setSeconds(s => (s <= 145 ? 150 : s - 1)),
      1000
    );
    return () => clearInterval(id);
  }, []);

  const display = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  return (
    <PreviewBox dark={dark}>
      <div className="flex flex-col items-center py-2">
        <div
          className="text-4xl font-bold tracking-wider"
          style={{
            fontFamily: '"Righteous", sans-serif',
            letterSpacing: '0.05em',
            fontWeight: 400,
            color: dark ? '#fff' : '#000',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {display}
        </div>
        <div className="flex items-center gap-4 mt-2">
          <span
            className="text-xs font-semibold uppercase"
            style={{
              color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
            }}
          >
            Full Game
          </span>
          <span
            className="text-xs font-semibold"
            style={{
              color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
            }}
          >
            Session: 0:00
          </span>
          <span
            className="text-xs font-semibold uppercase"
            style={{
              color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
            }}
          >
            Match 1
          </span>
        </div>
      </div>
    </PreviewBox>
  );
};

// ── Animated Controls: cursor cycles through buttons ────────────────────
const CTRL_SEQUENCE = [0, -1, 2, -1, 3, -1]; // Start Match → pause → Complete → pause → Cancel → pause
const ControlsPreview = ({ dark }: { dark: boolean }) => {
  const [seqIdx, setSeqIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setSeqIdx(i => (i + 1) % CTRL_SEQUENCE.length),
      1200
    );
    return () => clearInterval(id);
  }, []);

  const active = CTRL_SEQUENCE[seqIdx];

  const glow = (idx: number, color: string): React.CSSProperties => ({
    transform: active === idx ? 'scale(1.06)' : 'scale(1)',
    boxShadow: active === idx ? `0 0 16px ${color}` : 'none',
    transition: 'transform 0.3s, box-shadow 0.3s',
  });

  return (
    <PreviewBox dark={dark}>
      <div className="flex items-center gap-2">
        <div
          className="flex-1 px-3 py-2.5 rounded-xl border-2 border-green-500/40 bg-green-500/15 text-green-500 text-xs font-bold text-center"
          style={glow(0, 'rgba(34,197,94,0.5)')}
        >
          Start Match
        </div>
        <div
          className="px-3 py-2.5 rounded-xl border-2 flex items-center justify-center"
          style={{
            borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            backgroundColor: dark ? '#191919' : '#fff',
            ...glow(1, 'rgb(var(--team-blue) / 0.5)'),
          }}
        >
          <Settings
            className="h-4 w-4"
            style={{ color: dark ? '#fff' : '#000' }}
          />
        </div>
        <div
          className="px-3 py-2.5 rounded-xl border-2 border-green-500/40 bg-green-500/15 text-green-500 text-xs font-bold text-center whitespace-nowrap"
          style={glow(2, 'rgba(34,197,94,0.5)')}
        >
          Complete
        </div>
        <div
          className="px-3 py-2.5 rounded-xl border-2 border-red-500/40 bg-red-500/15 text-red-500 text-xs font-bold text-center whitespace-nowrap"
          style={glow(3, 'rgba(239,68,68,0.5)')}
        >
          Cancel
        </div>
      </div>
    </PreviewBox>
  );
};

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

// ── Animated Keybinds: keys light up in sequence (2 shot → 1 made → Enter) ─
const KeybindsPreview = ({ dark }: { dark: boolean }) => {
  const arrowCol = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  // animStep: 0 = key "2" (shot), 1 = key "1" (made), 2 = "Enter", 3 = pause
  const [animStep, setAnimStep] = useState(0);

  useEffect(() => {
    const delays = [1200, 1200, 1200, 800];
    const t = setTimeout(() => setAnimStep(s => (s + 1) % 4), delays[animStep]);
    return () => clearTimeout(t);
  }, [animStep]);

  const kbd = (isActive: boolean, pad?: string): React.CSSProperties => ({
    backgroundColor: isActive
      ? 'rgb(var(--team-blue))'
      : dark
        ? '#333'
        : '#e5e5e5',
    color: isActive ? (dark ? '#000' : '#fff') : dark ? '#fff' : '#000',
    borderRadius: 6,
    padding: pad || '2px 10px',
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 600,
    display: 'inline-block',
    transform: isActive ? 'scale(1.12) translateY(-1px)' : 'scale(1)',
    boxShadow: isActive ? '0 0 14px rgb(var(--team-blue) / 0.6)' : 'none',
    transition: 'all 0.25s',
  });

  return (
    <PreviewBox dark={dark}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span style={kbd(false)}>1</span>
          <span style={kbd(animStep === 0)}>2</span>
          <span style={kbd(false)}>3</span>
          <span className="text-xs" style={{ color: arrowCol }}>
            →
          </span>
          <span
            className="text-xs"
            style={{
              color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
            }}
          >
            balls shot
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span style={kbd(false)}>0</span>
          <span style={kbd(animStep === 1)}>1</span>
          <span style={kbd(false)}>2</span>
          <span style={kbd(false)}>3</span>
          <span className="text-xs" style={{ color: arrowCol }}>
            →
          </span>
          <span
            className="text-xs"
            style={{
              color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
            }}
          >
            balls made
          </span>
        </div>
        <div className="flex items-center justify-center gap-3">
          <span style={kbd(animStep === 2, '2px 14px')}>Enter</span>
          <span
            className="text-xs"
            style={{
              color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
            }}
          >
            confirm
          </span>
          <span style={kbd(false, '2px 12px')}>Esc</span>
          <span
            className="text-xs"
            style={{
              color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
            }}
          >
            cancel
          </span>
        </div>
      </div>
    </PreviewBox>
  );
};

// ── Shot Table Preview: shows example autonomous shots table ───────────────
const SAMPLE_SHOTS = [
  { shot: 3, made: 2 },
  { shot: 2, made: 2 },
  { shot: 1, made: 1 },
];

const MetricsPreview = ({ dark }: { dark: boolean }) => {
  const bgTable = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const bgHeader = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const borderCol = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textDim = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';

  let runningTotal = 0;

  return (
    <PreviewBox dark={dark}>
      <div className="text-team-blue font-semibold text-sm mb-3">
        Autonomous Shots
      </div>
      {/* Mini table */}
      <div className="rounded border overflow-hidden text-xs" style={{ borderColor: borderCol }}>
        {/* Header */}
        <div
          className="grid grid-cols-5 gap-0 font-semibold"
          style={{
            backgroundColor: bgHeader,
            borderBottom: `1px solid ${borderCol}`,
          }}
        >
          <div className="px-2 py-1.5 text-center">#</div>
          <div className="px-2 py-1.5 text-center">Shot</div>
          <div className="px-2 py-1.5 text-center">Made</div>
          <div className="px-2 py-1.5 text-center">Pts</div>
          <div className="px-2 py-1.5 text-center">Total</div>
        </div>
        {/* Rows */}
        {SAMPLE_SHOTS.map((row, i) => {
          const pts = row.made * 3;
          runningTotal += pts;
          return (
            <div
              key={i}
              className="grid grid-cols-5 gap-0 border-t"
              style={{
                backgroundColor: bgTable,
                borderTopColor: borderCol,
              }}
            >
              <div className="px-2 py-1.5 text-center" style={{ color: textDim }}>
                {i + 1}
              </div>
              <div className="px-2 py-1.5 text-center">{row.shot}</div>
              <div className="px-2 py-1.5 text-center">{row.made}</div>
              <div className="px-2 py-1.5 text-center" style={{ color: 'rgb(var(--team-blue))' }}>
                {pts}
              </div>
              <div className="px-2 py-1.5 text-center font-semibold" style={{ color: 'rgb(var(--team-blue))' }}>
                {runningTotal}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[10px] flex items-center gap-1" style={{ color: textDim }}>
        <span>✓ Each made ball = 3 pts</span>
      </div>
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
// ── Animated Notes: typewriter effect ───────────────────────────────────
const NOTES_TEXT = 'Robot intake jammed twice during teleop. Try adjusting...';
const NotesPreview = ({ dark }: { dark: boolean }) => {
  const [charIdx, setCharIdx] = useState(0);

  useEffect(() => {
    if (charIdx < NOTES_TEXT.length) {
      const t = setTimeout(() => setCharIdx(i => i + 1), 55);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCharIdx(0), 2000);
    return () => clearTimeout(t);
  }, [charIdx]);

  return (
    <PreviewBox dark={dark}>
      <div className="text-team-blue font-semibold text-sm mb-2">Session Notes</div>
      <div
        className="rounded-lg border p-2 text-xs"
        style={{
          backgroundColor: dark ? '#191919' : '#fff',
          borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
          minHeight: 48,
        }}
      >
        <span>{NOTES_TEXT.slice(0, charIdx)}</span>
        <span
          className="inline-block w-[2px] h-3 ml-[1px] align-middle"
          style={{
            backgroundColor: 'rgb(var(--team-blue))',
            animation: 'ttCursorBlink 0.8s step-end infinite',
          }}
        />
      </div>
    </PreviewBox>
  );
};

// ─── Step data ──────────────────────────────────────────────────────────────

interface StepDef {
  title: string;
  body: string;
  target: string | null;
  preview: ((dark: boolean) => React.ReactNode) | null;
}

const STEPS: StepDef[] = [
  {
    title: 'Welcome to TeamTrack!',
    body: 'This walkthrough shows you how the Active Practice Session works. Replay anytime from the help button (?) in the top-right.',
    target: null,
    preview: null,
  },
  {
    title: 'Session Settings',
    body: 'Enter a session name, pick your match type, and toggle features. Press Save before starting — the panel turns red until you do.',
    target: 'session-setup',
    preview: d => <SettingsPreview dark={d} />,
  },
  {
    title: 'Match Timer',
    body: 'Counts down from 2:30 in a full game. Transitions: Autonomous → Controller Pickup (5 s) → Prepare (3 s) → Teleop. Last 20 s = End Game.',
    target: 'timer',
    preview: d => <TimerPreview dark={d} />,
  },
  {
    title: 'Match Controls',
    body: 'Start Match begins the countdown. Save Match records it. Gear opens settings. Complete and Cancel manage the session.',
    target: 'controls',
    preview: d => <ControlsPreview dark={d} />,
  },
  {
    title: 'Scoring Grid',
    body: 'Each row = 1, 2, or 3 balls shot. Tap how many scored — dashed circles = missed, solid = scored. Each made ball = 3 pts.',
    target: 'scoring',
    preview: d => <ScoringPreview dark={d} />,
  },
  {
    title: 'Keyboard Shortcuts',
    body: 'Press 1–3 for balls shot, then 0–N for balls made, Enter to confirm, Escape to cancel. Only active during a match.',
    target: 'scoring',
    preview: d => <KeybindsPreview dark={d} />,
  },
  {
    title: 'Gate Mechanic',
    body: 'Press G to open the gate and release balls. Press G again to set how many stay (0-9) — or click a ball slot to set the count.',
    target: 'gate',
    preview: d => <GatePreview dark={d} />,
  },
  {
    title: 'Performance Metrics',
    body: 'Switch tabs for Autonomous, Teleop, and Endgame. Track shot logs, robot parking, accuracy, and the live final score.',
    target: 'metrics',
    preview: d => <MetricsPreview dark={d} />,
  },
  {
    title: 'Session Notes',
    body: 'Jot down observations — strategies, mistakes, or anything to review later in analysis.',
    target: 'notes',
    preview: d => <NotesPreview dark={d} />,
  },
  {
    title: "You're All Set!",
    body: 'Save your session settings, start your first match, and let TeamTrack handle the rest. Good luck at your next competition!',
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

function liftElement(el: HTMLElement) {
  // Save originals so we can restore them
  (el as unknown as Record<string, unknown>)[ORIGINAL_STYLES_KEY] = {
    position: el.style.position,
    zIndex: el.style.zIndex,
    borderRadius: el.style.borderRadius,
    boxShadow: el.style.boxShadow,
  };
  el.style.position = 'relative';
  el.style.zIndex = '9999';
  el.style.borderRadius = '16px';
  el.style.boxShadow =
    '0 0 0 4px rgb(var(--team-blue) / 0.35), 0 0 60px rgb(var(--team-blue) / 0.15)';
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
    delete (el as unknown as Record<string, unknown>)[ORIGINAL_STYLES_KEY];
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export const ActiveTutorial = () => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { resetSession } = useSession();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevElRef = useRef<HTMLElement | null>(null);

  // Generate user-specific tutorial key so each account sees tutorial independently
  const getTutorialKey = useCallback(() => user?.uid
    ? `${TUTORIAL_STORAGE_KEY}-${user.uid}`
    : TUTORIAL_STORAGE_KEY, [user]);

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

  // Auto-show on first visit (per user)
  useEffect(() => {
    if (!user) return; // Wait for user to be loaded
    const tutorialKey = getTutorialKey();
    const seen = localStorage.getItem(tutorialKey);
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(t);
    }
  }, [user, getTutorialKey]);

  // Listen for restart
  useEffect(() => {
    const handle = () => {
      setStep(0);
      setVisible(true);
    };
    window.addEventListener(TUTORIAL_RESTART_EVENT, handle);
    return () => window.removeEventListener(TUTORIAL_RESTART_EVENT, handle);
  }, []);

  // Remove lift from previous element + apply to new one
  const applyHighlight = useCallback((targetAttr: string | null) => {
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
            liftElement(newEl);
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

    liftElement(el);
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
    applyHighlight(STEPS[step]?.target ?? null);
  }, [visible, step, applyHighlight]);

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
    // Scroll back to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Mark tutorial as seen for this user
    const tutorialKey = user?.uid
      ? `${TUTORIAL_STORAGE_KEY}-${user.uid}`
      : TUTORIAL_STORAGE_KEY;
    localStorage.setItem(tutorialKey, 'true');
  }, [user, clearHighlight, resetSession]);

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) dismiss();
    else setStep(s => s + 1);
  }, [step, dismiss]);

  const prev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  // Keyboard capture
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        dismiss();
      }
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
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

  const teamBlue = 'rgb(var(--team-blue))';
  const teamBlue50 = 'rgb(var(--team-blue) / 0.5)';
  const teamBlue80 = 'rgb(var(--team-blue) / 0.8)';
  const bg = isDarkMode ? '#191919' : '#ffffff';
  const text = isDarkMode ? '#ffffff' : '#111111';
  const subtext = isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';

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
        .tt-card-slide { animation: ttCardIn 0.3s ease-out forwards; }
        .tt-card-center { animation: ttCardCenter 0.25s ease-out forwards; }
      `}</style>

      {/*
        Backdrop overlay.
        backdrop-filter blurs the content rendered BEHIND this element.
        The target element is lifted above (z-index 9999) so it renders
        ON TOP of this overlay and is NOT affected by the blur.
      */}
      <div
        className="fixed inset-0 z-[9997]"
        style={{
          backgroundColor: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={dismiss}
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
        <p className="text-sm leading-relaxed" style={{ color: subtext }}>
          {current.body}
        </p>

        {/* Preview */}
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
              className="px-5 py-2 text-sm font-bold rounded-xl"
              style={{
                backgroundColor: teamBlue,
                color: isDarkMode ? '#000' : '#fff',
              }}
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <div
          className="mt-2.5 text-center text-xs opacity-30"
          style={{ color: text }}
        >
          ← → or Enter to navigate · Esc to skip
        </div>
      </div>
    </>
  );
};
