/**
 * Where the match is in match-audio.mp3. The track is one Full Game (3-2-1,
 * AUTO, controller pickup, TELEOP); the shorter match types play their part
 * of it. Its sounds and their file times are listed in `useMatchAudio`.
 */

import { GAME_TIMING } from '@/constants';
import type { MatchPhase } from '@/types';
import type { SessionClockState } from '@/types/storage';

/** File time of the start of the 3-2-1, in seconds */
export const FULL_GAME_AUDIO_OFFSET = 1;
/** File time of the start of AUTO */
export const AUTON_AUDIO_OFFSET = FULL_GAME_AUDIO_OFFSET + 3;
/** File time of the start of TELEOP, after AUTO and the controller pickup */
export const TELEOP_AUDIO_OFFSET =
  AUTON_AUDIO_OFFSET +
  GAME_TIMING.AUTONOMOUS_DURATION_SECONDS +
  GAME_TIMING.CONTROLLER_PICKUP_SECONDS;

/**
 * Seconds after AUTO ends that "Drivers, pick up your controllers" starts,
 * as in FTC Live: right as AUTO's buzzer stops
 */
const PICKUP_CALL_DELAY = 2;
/** Seconds the end-of-match buzzer is let play on after 0:00 */
const BUZZER_TAIL = 5;

/**
 * File time the track stops at once the match is over: after its buzzer
 * has played out, or for an Autonomous match as AUTO's buzzer stops, before
 * the call to pick up the controllers.
 */
export const matchAudioStopTime = (matchType: string): number =>
  matchType === 'Autonomous'
    ? AUTON_AUDIO_OFFSET +
      GAME_TIMING.AUTONOMOUS_DURATION_SECONDS +
      PICKUP_CALL_DELAY
    : TELEOP_AUDIO_OFFSET + GAME_TIMING.TELEOP_DURATION_SECONDS + BUZZER_TAIL;

/** File time for `timer` seconds left on the match clock, in seconds */
export const matchAudioTime = (
  matchType: string,
  phase: MatchPhase,
  timer: number
): number => {
  if (matchType === 'Autonomous') {
    return (
      AUTON_AUDIO_OFFSET + (GAME_TIMING.AUTONOMOUS_DURATION_SECONDS - timer)
    );
  }
  if (matchType === 'Teleop' || phase === 'teleop') {
    return TELEOP_AUDIO_OFFSET + (GAME_TIMING.TELEOP_DURATION_SECONDS - timer);
  }
  return (
    FULL_GAME_AUDIO_OFFSET + (GAME_TIMING.FULL_GAME_DURATION_SECONDS - timer)
  );
};

/**
 * File time for where `clock` stands at `now`, to the millisecond: the
 * seconds on screen are whole, but a clock that was put back (see
 * `resumeMatchClock`) or paused mid-second is not. After the buzzer it is
 * the buzzer.
 */
export const clockAudioTime = (
  clock: SessionClockState,
  matchType: string,
  now: number
): number => {
  const secondsLeft = (deadline: number | null, stoppedMs: number) =>
    Math.max(0, (deadline ?? now + stoppedMs) - now) / 1000;
  if (clock.phase === 'controller_pickup') {
    // Controller pickup is in the track between AUTO and TELEOP: its
    // seconds left count on from the end of AUTO's.
    return matchAudioTime(
      matchType,
      clock.phase,
      GAME_TIMING.AUTON_END_REMAINING -
        GAME_TIMING.CONTROLLER_PICKUP_SECONDS +
        secondsLeft(clock.pickupDeadline, clock.pickupRemainingMs)
    );
  }
  if (clock.phase === 'ended') {
    return matchAudioTime(
      matchType,
      matchType === 'Autonomous' ? 'auton' : 'teleop',
      0
    );
  }
  return matchAudioTime(
    matchType,
    clock.phase,
    secondsLeft(clock.deadline, clock.remainingMs)
  );
};
