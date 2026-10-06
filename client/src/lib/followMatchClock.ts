/**
 * The match audio, put where a match clock that was put back stands (see
 * `resumeMatchClock`). Kept out of the session context: only the Undo of a
 * match that was ended early or discarded needs it, from inside the tap, as
 * browsers only let a tap start audio. `useMatchAudio` then keeps it there.
 */

import type { SessionClockState } from '@/types/storage';
import { clockAudioTime } from './matchAudioTime';

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
  audio.currentTime = clockAudioTime(clock, matchType, Date.now());
  const counting =
    clock.phase === 'controller_pickup' ? !clock.pickupPaused : clock.running;
  if (!counting) audio.pause();
  else if (audio.paused) audio.play().catch(() => {});
};
