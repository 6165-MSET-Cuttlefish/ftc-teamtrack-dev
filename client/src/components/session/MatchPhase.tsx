import { Pause } from 'lucide-react';
import { useSession, useSessionCore, useTheme } from '@/contexts';

import { phaseLabel, type PhaseLabel } from './matchPhaseLabel';

/**
 * Tint, text and ring per phase, [light theme, dark themes]. Each phase has
 * its own muted hue so AUTO, TELEOP and ENDGAME read apart at a glance, kept
 * soft so the chip never looks like a button: the accent fill is for actions,
 * amber for PAUSED and Hive Tips, emerald for Garden. Text is at least 4.5:1
 * on its tint, and the word is always there, so colour is never the only cue.
 */
const CHIP_TONES: Record<PhaseLabel, readonly [string, string]> = {
  READY: [
    'bg-gray-100 text-gray-700 ring-gray-300',
    'bg-white/5 text-gray-300 ring-white/15',
  ],
  AUTO: [
    'bg-violet-100 text-violet-800 ring-violet-200',
    'bg-violet-400/15 text-violet-200 ring-violet-400/30',
  ],
  PICKUP: [
    'bg-slate-100 text-slate-700 ring-slate-300',
    'bg-slate-400/15 text-slate-200 ring-slate-400/30',
  ],
  TELEOP: [
    'bg-teal-100 text-teal-800 ring-teal-200',
    'bg-teal-400/15 text-teal-200 ring-teal-400/30',
  ],
  ENDGAME: [
    'bg-rose-100 text-rose-800 ring-rose-200',
    'bg-rose-400/15 text-rose-200 ring-rose-400/30',
  ],
  DONE: [
    'bg-gray-100 text-gray-700 ring-gray-300',
    'bg-white/5 text-gray-300 ring-white/15',
  ],
};

const CHIP_SIZES = {
  sm: 'px-2 py-0.5 text-[0.6875rem]',
  md: 'px-2.5 py-1 text-xs sm:text-sm',
} as const;

/** The phase as a filled pill. */
export const PhaseChip = ({
  label,
  size = 'md',
}: {
  label: PhaseLabel;
  size?: keyof typeof CHIP_SIZES;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <span
      data-match-phase={label}
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wide leading-none whitespace-nowrap ring-1 ring-inset transition-colors ${CHIP_SIZES[size]} ${CHIP_TONES[label][isDarkMode ? 1 : 0]}`}
    >
      {label}
    </span>
  );
};

/** `PhaseChip` for the match being played; follows the clock. */
export const LivePhaseChip = ({ size }: { size?: keyof typeof CHIP_SIZES }) => {
  const { matchActive, matchPhase, timer } = useSession();
  return (
    <PhaseChip
      label={phaseLabel({ matchActive, matchPhase, timer })}
      size={size}
    />
  );
};

/** Same muted chip style as the phases, in amber: a pause, not an action. */
const PAUSED_TONE: readonly [string, string] = [
  'bg-amber-100 text-amber-900 ring-amber-300 hover:bg-amber-200',
  'bg-amber-400/15 text-amber-200 ring-amber-400/35 hover:bg-amber-400/25',
];

/**
 * Takes the phase chip's place wherever the clock is while the match is
 * paused: a paused clock has the same digits as a running one, so this is
 * what says it has stopped. Pressing it starts the clock again, for when
 * the controls are scrolled away; its touch area reaches 44px around the
 * chip without making it bigger.
 */
export const PausedPill = ({
  size = 'md',
}: {
  size?: keyof typeof CHIP_SIZES;
}) => {
  const { isDarkMode } = useTheme();
  const { matchPhase, setIsTimerRunning, setIsPickupPaused } = useSessionCore();

  return (
    <button
      type="button"
      data-match-paused
      aria-label="Paused. Resume match"
      onClick={() =>
        matchPhase === 'controller_pickup'
          ? setIsPickupPaused(false)
          : setIsTimerRunning(true)
      }
      className={`relative inline-flex min-h-0 min-w-0 items-center gap-1 rounded-full font-bold uppercase tracking-wide leading-none whitespace-nowrap ring-1 ring-inset transition-colors after:absolute after:-inset-2 after:content-[''] [@media(pointer:coarse)]:after:-inset-3 ${CHIP_SIZES[size]} ${PAUSED_TONE[isDarkMode ? 1 : 0]}`}
    >
      <Pause className="h-3 w-3 fill-current" aria-hidden />
      Paused
    </button>
  );
};
