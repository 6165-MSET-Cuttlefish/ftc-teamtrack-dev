import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '@/contexts';

// ─── Tutorial step definitions ──────────────────────────────────────────────

interface TutorialStep {
  title: string;
  body: string;
  /** CSS selector for the element to spotlight, or null for a centered modal */
  target: string | null;
  /** Where to place the tooltip relative to the target */
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const STEPS: TutorialStep[] = [
  {
    title: 'Welcome to TeamTrack!',
    body: 'This quick walkthrough will show you how the Active Practice Session works. You can replay this anytime from the help button (?) in the top-right.',
    target: null,
    placement: 'center',
  },
  {
    title: 'Session Settings',
    body: 'Start here! Enter a session name, pick your match type (Full Game, Autonomous only, or Teleop only) and toggle features like Cycle Times. Press Save before starting a match — the panel turns red until you do.',
    target: '[data-tutorial="session-setup"]',
    placement: 'bottom',
  },
  {
    title: 'Match Timer',
    body: 'This large timer counts down from 2:30 during a full game. It automatically transitions through Autonomous → Controller Pickup (5 s) → Prepare (3 s) → Teleop. The last 20 seconds show as End Game.',
    target: '[data-tutorial="timer"]',
    placement: 'bottom',
  },
  {
    title: 'Match Controls',
    body: 'Click "Start Match" to begin the countdown. After the match, click "Save Match" to record it. You can also pause, cancel, or complete the entire session from this row of buttons.',
    target: '[data-tutorial="controls"]',
    placement: 'bottom',
  },
  {
    title: 'Scoring Grid',
    body: 'Tap a button to record how many balls were shot and how many scored. Each row represents 1, 2, or 3 balls shot. Dashed circles = missed, solid circles = scored. Each made ball is worth 3 points.',
    target: '[data-tutorial="scoring"]',
    placement: 'top',
  },
  {
    title: 'Keyboard Shortcuts',
    body: 'Speed up scoring with keybinds! Press 0–3 to select how many balls were shot, then press how many were made, then Enter to confirm. Press Escape to cancel. Keybinds only activate while a match is running.',
    target: '[data-tutorial="scoring"]',
    placement: 'top',
  },
  {
    title: 'Performance Metrics',
    body: 'See a live breakdown of Autonomous, Teleop, and Endgame scores. Switch tabs to view shot logs, adjust Robot Park status, and review the final score summary with accuracy percentages.',
    target: '[data-tutorial="metrics"]',
    placement: 'top',
  },
  {
    title: 'Notes',
    body: 'Jot down observations about each match — mistakes, strategies, or anything else you want to remember when you review the session later.',
    target: '[data-tutorial="notes"]',
    placement: 'top',
  },
  {
    title: 'You\'re All Set!',
    body: 'Save your session settings, start your first match, and let TeamTrack handle the rest. Good luck at your next competition! 🤖',
    target: null,
    placement: 'center',
  },
];

export const TUTORIAL_STORAGE_KEY = 'teamtrack-tutorial-v1-seen';
export const TUTORIAL_RESTART_EVENT = 'teamtrack-restart-tutorial';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Compute tooltip position style from the target element rect */
function computeTooltipPosition(
  rect: DOMRect,
  placement: string,
  tooltipWidth: number,
): React.CSSProperties {
  const gap = 16;
  const viewH = window.innerHeight;
  const style: React.CSSProperties = { position: 'fixed', maxWidth: tooltipWidth };

  switch (placement) {
    case 'bottom': {
      const proposedTop = rect.bottom + gap;
      if (proposedTop + 200 > viewH) {
        style.bottom = viewH - rect.top + gap;
      } else {
        style.top = proposedTop;
      }
      style.left = Math.max(16, Math.min(
        rect.left + rect.width / 2 - tooltipWidth / 2,
        window.innerWidth - tooltipWidth - 16
      ));
      break;
    }
    case 'top': {
      if (rect.top - gap - 200 < 0) {
        style.top = rect.bottom + gap;
      } else {
        style.bottom = viewH - rect.top + gap;
      }
      style.left = Math.max(16, Math.min(
        rect.left + rect.width / 2 - tooltipWidth / 2,
        window.innerWidth - tooltipWidth - 16
      ));
      break;
    }
    case 'left':
      style.top = Math.max(16, rect.top + rect.height / 2 - 100);
      style.right = window.innerWidth - rect.left + gap;
      break;
    case 'right':
      style.top = Math.max(16, rect.top + rect.height / 2 - 100);
      style.left = rect.right + gap;
      break;
  }

  return style;
}

const CENTER_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
};

// ─── Component ──────────────────────────────────────────────────────────────

export const ActiveTutorial = () => {
  const { isDarkMode } = useTheme();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const animKey = useRef(0);

  // Show on first visit
  useEffect(() => {
    const seen = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!seen) {
      const t = setTimeout(() => {
        setVisible(true);
        animKey.current += 1;
      }, 600);
      return () => clearTimeout(t);
    }
  }, []);

  // Listen for restart events from the Header help button
  useEffect(() => {
    const handleRestart = () => {
      setStep(0);
      setVisible(true);
      animKey.current += 1;
      // Scroll to top so the first steps are visible
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener(TUTORIAL_RESTART_EVENT, handleRestart);
    return () => window.removeEventListener(TUTORIAL_RESTART_EVENT, handleRestart);
  }, []);

  // Position the spotlight + tooltip whenever step changes
  const positionTooltip = useCallback(() => {
    const current = STEPS[step];
    if (!current) return;

    if (!current.target || current.placement === 'center') {
      setSpotlightRect(null);
      setTooltipStyle(CENTER_STYLE);
      return;
    }

    const el = document.querySelector(current.target);
    if (!el) {
      setSpotlightRect(null);
      setTooltipStyle(CENTER_STYLE);
      return;
    }

    const elRect = el.getBoundingClientRect();
    const viewH = window.innerHeight;
    const isOffScreen = elRect.top < 60 || elRect.bottom > viewH - 30;

    if (isOffScreen) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const tooltipWidth = Math.min(400, window.innerWidth - 32);

    const finalise = () => {
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
      setTooltipStyle(computeTooltipPosition(rect, current.placement, tooltipWidth));
    };

    if (isOffScreen) {
      setTimeout(finalise, 450);
    } else {
      finalise();
    }
  }, [step]);

  // Re-position on step change or visibility change
  useEffect(() => {
    if (!visible) return;
    positionTooltip();

    const handleScrollOrResize = () => {
      const current = STEPS[step];
      if (!current?.target) return;
      const el = document.querySelector(current.target);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
      const tooltipWidth = Math.min(400, window.innerWidth - 32);
      setTooltipStyle(computeTooltipPosition(rect, current.placement, tooltipWidth));
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [visible, positionTooltip, step]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setSpotlightRect(null);
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
  }, []);

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) {
      dismiss();
    } else {
      setStep((s) => s + 1);
    }
  }, [step, dismiss]);

  const prev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  // Keyboard navigation (capture phase to prevent scoring keybinds)
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
  const isCenter = !current.target || current.placement === 'center';
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  // Theme-adaptive colors using CSS variables
  const teamBlue = 'rgb(var(--team-blue))';
  const teamBlue50 = 'rgb(var(--team-blue) / 0.5)';
  const teamBlue25 = 'rgb(var(--team-blue) / 0.25)';
  const teamBlue15 = 'rgb(var(--team-blue) / 0.15)';
  const teamBlue80 = 'rgb(var(--team-blue) / 0.8)';
  const bg = isDarkMode ? '#191919' : '#ffffff';
  const text = isDarkMode ? '#ffffff' : '#111111';
  const subtext = isDarkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)';

  return (
    <>
      <style>{`
        @keyframes tutorialGlow {
          0%, 100% { box-shadow: 0 0 0 0 ${teamBlue50}, 0 0 20px ${teamBlue15}; }
          50% { box-shadow: 0 0 0 3px ${teamBlue25}, 0 0 40px ${teamBlue25}; }
        }
        @keyframes tutorialFadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.94); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes tooltipSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tt-card-${animKey.current}-${step} {
          animation: ${isCenter ? 'tutorialFadeIn' : 'tooltipSlideIn'} 0.3s ease-out forwards;
        }
        .tt-glow-ring {
          animation: tutorialGlow 2s ease-in-out infinite;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        onClick={dismiss}
      />

      {/* Spotlight cutout */}
      {spotlightRect && !isCenter && (
        <div
          className="fixed z-[9999] rounded-xl tt-glow-ring pointer-events-none"
          style={{
            top: spotlightRect.top - 8,
            left: spotlightRect.left - 8,
            width: spotlightRect.width + 16,
            height: spotlightRect.height + 16,
            border: `2px solid ${teamBlue80}`,
            boxShadow: `0 0 0 9999px rgba(0,0,0,0.6), 0 0 30px ${teamBlue25}`,
            backgroundColor: 'transparent',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        key={`card-${step}`}
        className={`fixed z-[10000] rounded-2xl p-5 sm:p-6 tt-card-${animKey.current}-${step}`}
        style={{
          ...tooltipStyle,
          backgroundColor: bg,
          border: `2px solid ${teamBlue50}`,
          color: text,
          maxWidth: isCenter ? 460 : 400,
          width: isCenter ? '90vw' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div
          className="absolute top-0 left-0 h-1 rounded-tl-2xl transition-all duration-300"
          style={{
            width: `${((step + 1) / STEPS.length) * 100}%`,
            background: `linear-gradient(90deg, ${teamBlue80}, ${teamBlue})`,
            borderTopRightRadius: step === STEPS.length - 1 ? '1rem' : 0,
          }}
        />

        {/* Step counter */}
        <div
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: teamBlue }}
        >
          {step + 1} / {STEPS.length}
        </div>

        {/* Title */}
        <h3
          className="text-lg sm:text-xl font-bold mb-2"
          style={{ color: teamBlue }}
        >
          {current.title}
        </h3>

        {/* Body */}
        <p className="text-sm leading-relaxed mb-5" style={{ color: subtext }}>
          {current.body}
        </p>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={dismiss}
            className="text-xs font-medium uppercase tracking-wide opacity-50 hover:opacity-100 transition-opacity"
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
              className="px-5 py-2 text-sm font-bold rounded-xl transition-all"
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
        <div className="mt-3 text-center text-xs opacity-35" style={{ color: text }}>
          ← → or Enter to navigate · Esc to skip
        </div>
      </div>
    </>
  );
};
