import { GAME_TIMING } from '@/constants';
import { useSessionCore } from '@/contexts';
import type { MatchPhase } from '@/types';

/** The one word that names where the match is, as shown beside the clock. */
export type PhaseLabel =
  | 'READY'
  | 'AUTO'
  | 'PICKUP'
  | 'TELEOP'
  | 'ENDGAME'
  | 'DONE';

/** Match clock values above this are the 3-2-1 before AUTO of a Full Game */
const PLAYING_SECONDS =
  GAME_TIMING.AUTONOMOUS_DURATION_SECONDS + GAME_TIMING.TELEOP_DURATION_SECONDS;

interface PhaseInput {
  matchActive: boolean;
  matchPhase: MatchPhase;
  /** Match clock, in seconds left */
  timer: number;
}

/**
 * Names the phase of the match. Before Start and through the 3-2-1 nothing
 * is being played yet, so both read READY; the last minute of TELEOP is
 * ENDGAME, the cue to watch for parking.
 */
export const phaseLabel = ({
  matchActive,
  matchPhase,
  timer,
}: PhaseInput): PhaseLabel => {
  if (!matchActive || timer > PLAYING_SECONDS) return 'READY';
  if (matchPhase === 'controller_pickup') return 'PICKUP';
  if (matchPhase === 'ended' || timer <= 0) return 'DONE';
  if (matchPhase === 'auton') return 'AUTO';
  return timer <= GAME_TIMING.ENDGAME_REMAINING ? 'ENDGAME' : 'TELEOP';
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
