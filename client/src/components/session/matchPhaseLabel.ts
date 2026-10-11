import { GAME_TIMING } from '@/constants';
import { useSessionCore } from '@/contexts';
import type { MatchPhase } from '@/types';

/** The one word that names where the match is, as shown beside the clock. */
export type PhaseLabel =
  | 'READY'
  | 'STARTING'
  | 'AUTO'
  | 'PICKUP'
  | 'TELEOP'
  | 'FLOWERS'
  | 'DONE';

/** Match clock values above this are the 3-2-1 before AUTO of a Full Game */
const PLAYING_SECONDS =
  GAME_TIMING.AUTONOMOUS_DURATION_SECONDS + GAME_TIMING.TELEOP_DURATION_SECONDS;

interface PhaseInput {
  matchActive: boolean;
  matchPhase: MatchPhase;
  /** Match clock, in seconds left */
  timer: number;
  /**
   * The match is the walkthrough's practice one, held open without its
   * clock ever starting
   */
  isTutorialActive?: boolean;
}

/**
 * True through the 3-2-1 before AUTO of a Full Game: Start was pressed and
 * nothing is being played yet. Not the walkthrough's practice match, whose
 * clock never leaves its starting value.
 */
export const inCountdown = ({
  matchActive,
  matchPhase,
  timer,
  isTutorialActive = false,
}: PhaseInput): boolean =>
  matchActive &&
  !isTutorialActive &&
  matchPhase === 'auton' &&
  timer > PLAYING_SECONDS;

/**
 * Names the phase of the match. Before Start it is READY, and through the
 * 3-2-1 STARTING: a clock that reads 3, 2, 1 beside READY looked like
 * seconds left of something. The last minute of TELEOP is FLOWERS: NECTAR
 * may go into FLOWERS from 1:00 (G410; Table 9-1 "FLOWER Ownership
 * Unlocked").
 */
export const phaseLabel = (input: PhaseInput): PhaseLabel => {
  const { matchActive, matchPhase, timer } = input;
  if (inCountdown(input)) return 'STARTING';
  if (!matchActive || timer > PLAYING_SECONDS) return 'READY';
  if (matchPhase === 'controller_pickup') return 'PICKUP';
  if (matchPhase === 'ended' || timer <= 0) return 'DONE';
  if (matchPhase === 'auton') return 'AUTO';
  return timer <= GAME_TIMING.FLOWERS_UNLOCK_REMAINING ? 'FLOWERS' : 'TELEOP';
};

interface ClockInput extends PhaseInput {
  /** Controller-pickup countdown, in seconds left */
  phaseTimer: number;
  /** The clock is being held still by the walkthrough */
  isTutorialActive: boolean;
}

/**
 * Seconds to show on the match clock.
 *
 * Until Start is pressed that is the length of the match about to be played
 * (2:30, 0:30 or 2:00), not the 3-2-1 that precedes a Full Game: "0:03" on
 * an idle clock reads as three seconds left. Once it is running, AUTO counts
 * 2:30 down to 2:00 like the field display, and controller pickup shows its
 * own countdown.
 */
export const matchClockSeconds = ({
  matchActive,
  matchPhase,
  timer,
  phaseTimer,
  isTutorialActive,
}: ClockInput): number => {
  if (!matchActive || isTutorialActive) return Math.min(timer, PLAYING_SECONDS);
  if (matchPhase === 'controller_pickup') return phaseTimer;
  return timer > PLAYING_SECONDS ? timer - PLAYING_SECONDS : timer;
};

/**
 * The match clock as it reads: 'm:ss', or through the 3-2-1 just the
 * digit ('3', not '0:03', which reads as three seconds of play left).
 */
export const matchClockText = (
  input: ClockInput & { formatTime: (seconds: number) => string }
): string => {
  const seconds = matchClockSeconds(input);
  return inCountdown(input)
    ? String(Math.max(0, Math.ceil(seconds)))
    : input.formatTime(seconds);
};

/**
 * True while a live match is paused by the user — not during the walkthrough
 * (which holds a match open without running it) and not after the buzzer.
 * The same rule the Pause / Resume button follows, read without the clocks'
 * once-a-second tick: a pause or a phase change is what re-renders.
 */
export const useMatchPaused = (): boolean => {
  const {
    matchActive,
    matchPhase,
    isTimerRunning,
    isPickupPaused,
    isTutorialActive,
    getTimers,
  } = useSessionCore();

  if (!matchActive || isTutorialActive) return false;
  if (matchPhase === 'controller_pickup') return isPickupPaused;
  if (matchPhase === 'ended') return false;
  return !isTimerRunning && getTimers().timer > 0;
};
