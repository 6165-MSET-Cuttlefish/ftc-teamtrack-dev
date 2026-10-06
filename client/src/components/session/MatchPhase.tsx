import { Pause } from 'lucide-react';
import { CHIP_BASE, CHIP_SIZES } from '@/components/ui/tokens';
import { useSession, useSessionCore, useTheme } from '@/contexts';

import { phaseLabel, type PhaseLabel } from './matchPhaseLabel';

/**
 * Tint, text and ring per phase, [light theme, dark themes]. Each phase has
 * its own muted hue so AUTO, TELEOP and ENDGAME read apart at a glance, kept
 * soft so the chip never looks like a button: the accent fill is for actions,
 * amber for PAUSED and Hive Tips, emerald for Garden. Text is at least 4.5:1
 * on its tint, and the word is always there, so colour is never the only cue.
 * The colour of a phase lives here only: the clock's digits stay in the
 * text colour in every phase.
 */
const CHIP_TONES: Record<PhaseLabel, readonly [string, string]> = {
  READY: [
    'bg-gray-100 text-gray-700 ring-gray-300',
    'bg-white/5 text-gray-300 ring-white/15',
  ],
  // The 3-2-1: no longer idle, not yet AUTO
  STARTING: [
    'bg-indigo-100 text-indigo-800 ring-indigo-200',
    'bg-indigo-400/15 text-indigo-200 ring-indigo-400/30',
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

/**
 * The word on each chip, typed in ordinary case: the chip's capitals are
 * CSS, so a screen reader says "Teleop" rather than spelling it out.
 */
const CHIP_WORDS: Record<PhaseLabel, string> = {
  READY: 'Ready',
  STARTING: 'Starting',
  AUTO: 'Auto',
  PICKUP: 'Pickup',
  TELEOP: 'Teleop',
  ENDGAME: 'Endgame',
  DONE: 'Done',
};

/**
 * Chip sizes: the shared two, and `clock` for the chip beside the big
 * clock. That one sits in a track a third of the clock row wide, so it is
 * the small size wherever that track is narrow (a phone, a phone on its
 * side) and the full size on a larger screen.
 */
const SIZES = {
  ...CHIP_SIZES,
  clock:
    'px-2 py-0.5 text-[0.6875rem] [@media(min-width:768px)_and_(min-height:501px)]:px-2.5 [@media(min-width:768px)_and_(min-height:501px)]:py-1 [@media(min-width:768px)_and_(min-height:501px)]:text-sm',
} as const;

type Size = keyof typeof SIZES;

/**
 * The phase as a filled pill. Before Start there is no phase to name: the
 * Start button already says nothing is running, so READY only keeps its
 * space (AUTO appears there without moving anything), not drawn or read out.
 */
export const PhaseChip = ({
  label,
  size = 'md',
}: {
  label: PhaseLabel;
  size?: Size;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <span
      data-match-phase={label}
      className={`${CHIP_BASE} ${SIZES[size]} ${CHIP_TONES[label][isDarkMode ? 1 : 0]} ${label === 'READY' ? 'invisible' : ''}`}
    >
      {CHIP_WORDS[label]}
    </span>
  );
};

/**
 * `PhaseChip` for the match being played; follows the clock. Before Start
 * there is none, except beside the scoring page's own clock
 * (`keepIdleSpace`), where AUTO appears on Start: there it keeps its space.
 */
export const LivePhaseChip = ({
  size,
  keepIdleSpace = false,
}: {
  size?: Size;
  keepIdleSpace?: boolean;
}) => {
  const { matchActive, matchPhase, timer, isTutorialActive } = useSession();
  const label = phaseLabel({
    matchActive,
    matchPhase,
    timer,
    isTutorialActive,
  });
  if (label === 'READY' && !keepIdleSpace) return null;
  return <PhaseChip label={label} size={size} />;
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
 * the controls are scrolled away; its touch area reaches 44px tall around
 * the chip, at either size, without making it bigger.
 */
export const PausedPill = ({ size = 'md' }: { size?: Size }) => {
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
      className={`${CHIP_BASE} relative min-h-0 min-w-0 gap-1 after:absolute after:-inset-2 after:content-[''] [@media(pointer:coarse)]:after:-inset-x-3 [@media(pointer:coarse)]:after:inset-y-[calc((100%_-_2.75rem)/2)] ${SIZES[size]} ${PAUSED_TONE[isDarkMode ? 1 : 0]}`}
    >
      <Pause className="h-3 w-3 fill-current" aria-hidden />
      Paused
    </button>
  );
};
