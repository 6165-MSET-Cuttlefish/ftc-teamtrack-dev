/**
 * Where the match is in match-audio.mp3. The track is one Full Game (3-2-1,
 * AUTO, controller pickup, TELEOP); the shorter match types play their part
 * of it.
 */

import { GAME_TIMING } from '@/constants';
import type { MatchPhase } from '@/types';

/** File time of the start of the 3-2-1, in seconds */
export const FULL_GAME_AUDIO_OFFSET = 0.8;
/** File time of the start of AUTO */
export const AUTON_AUDIO_OFFSET = FULL_GAME_AUDIO_OFFSET + 3;
/** File time of the start of TELEOP */
export const TELEOP_AUDIO_OFFSET = 42;

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
