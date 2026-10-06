/**
 * The match audio, put where a match clock that was put back stands (see
 * `resumeMatchClock`). Kept out of the session context: only the Undo of a
 * match that was ended early or discarded needs it.
 */

import { GAME_TIMING } from '@/constants';
import type { SessionClockState } from '@/types/storage';
import { matchAudioTime } from './matchAudioTime';

/**
 * Move the match audio to where `clock` is, to the millisecond: playing from
 * there while it counts, stopped there while it is paused. Not after the
 * buzzer, which has had its tail.
 */
export const followMatchClock = (
  clock: SessionClockState,
  matchType: string
): void => {
  const audio = (
    window as Window & { __teamtrack_match_audio__?: HTMLAudioElement }
  ).__teamtrack_match_audio__;
  if (!audio || clock.phase === 'ended') return;
  const now = Date.now();
  const secondsLeft = (deadline: number | null, stoppedMs: number) =>
    ((deadline ?? now + stoppedMs) - now) / 1000;
  const pickup = clock.phase === 'controller_pickup';
  // Controller pickup is in the track between AUTO and TELEOP: its seconds
  // left count on from the end of AUTO's.
  audio.currentTime = matchAudioTime(
    matchType,
    clock.phase,
    pickup
      ? GAME_TIMING.AUTON_END_REMAINING -
          GAME_TIMING.CONTROLLER_PICKUP_SECONDS +
          secondsLeft(clock.pickupDeadline, clock.pickupRemainingMs)
      : secondsLeft(clock.deadline, clock.remainingMs)
  );
  if (pickup ? clock.pickupPaused : !clock.running) audio.pause();
  else if (audio.paused) audio.play().catch(() => {});
};
