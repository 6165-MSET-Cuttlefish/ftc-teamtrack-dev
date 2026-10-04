import { Pause, Play, SkipForward, X } from 'lucide-react';

import { GAME_TIMING } from '@/constants';
import { useSession, useSessionCore } from '@/contexts';
import type { MatchPhase } from '@/types';
import { absorbDoubleTap } from './doubleTap';
import { ignoreHeldEnter } from './ignoreHeldEnter';
import { isPrimarySlotConfirm, useLiveControls } from './liveControlsContext';
import { actionClass } from './tones';
import { useArmed } from './useArmed';
import { useCompactControls } from './useCompactControls';

/**
 * Pause / resume: one large button, for as long as there is a match clock
 * to stop (the 3-2-1, AUTO, controller pickup, TELEOP).
 *
 * It is the big target while a match runs, where Save used to be, so a
 * stray thumb pauses rather than ends the match. Pause is an outline in
 * every theme; Resume is the filled button, the next step once paused.
 * A question about the match takes its place in the action bar, and on a
 * phone brings it along (see `PrimaryAction`).
 *
 * Controller pickup has its own countdown (the match clock is stopped for
 * it), so there the button freezes and resumes that countdown instead.
 */
export const PlayPauseControl = () => {
  const { matchPhase, matchActive, editingMatchId, pendingConfirm } =
    useLiveControls();
  const isCompact = useCompactControls();

  if (editingMatchId || !matchActive || matchPhase === 'ended') return null;
  if (isPrimarySlotConfirm(pendingConfirm, isCompact)) return null;

  // Discard Session asks at the end of the page: until it is answered,
  // Resume is an outline, and the question's own buttons are the next step.
  return <PauseResumeButton quiet={pendingConfirm !== null} />;
};

/**
 * The Pause / Resume button itself. `quiet` keeps Resume an outline too,
 * for when a question beside it is what needs answering first.
 */
export const PauseResumeButton = ({ quiet = false }: { quiet?: boolean }) => {
  const { isDarkMode, isTimerRunning, setIsTimerRunning, matchPhase } =
    useLiveControls();
  const { isPickupPaused, setIsPickupPaused, isTutorialActive } =
    useSessionCore();

  const inPickup = matchPhase === 'controller_pickup';
  // The walkthrough's practice match never starts its clock, and stands for
  // a match being played: it is not one the user paused.
  const running =
    isTutorialActive || (inPickup ? !isPickupPaused : isTimerRunning);
  const Icon = running ? Pause : Play;

  return (
    <button
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={() =>
        inPickup ? setIsPickupPaused(running) : setIsTimerRunning(!running)
      }
      className={`flex-1 min-w-0 px-4 h-12 rounded-2xl text-base gap-2 ${actionClass(running || quiet ? 'neutral' : 'primary', isDarkMode)}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      {running ? 'Pause' : 'Resume'}
    </button>
  );
};

/**
 * Discard the in-progress match: a small X, out of the way of the scoring
 * thumb. It only asks; the question, and the button that discards, show in
 * the action bar.
 */
export const CancelMatchButton = () => {
  const { isDarkMode, matchActive, editingMatchId, handleRequestDiscardMatch } =
    useLiveControls();

  if (editingMatchId || !matchActive) return null;

  return (
    <button
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={handleRequestDiscardMatch}
      title="Discard match"
      aria-label="Discard match"
      className={`ml-auto h-11 w-11 shrink-0 rounded-xl ${actionClass('dangerOutline', isDarkMode)}`}
    >
      <X className="h-5 w-5" aria-hidden />
    </button>
  );
};

/** The next point of the match that Skip jumps to */
type SkipTarget = 'teleop' | 'endgame' | 'end';

const SKIP_LABELS: Record<SkipTarget, { full: string; short: string }> = {
  teleop: { full: 'Skip to Teleop', short: 'Teleop' },
  endgame: { full: 'Skip to Endgame', short: 'Endgame' },
  end: { full: 'Skip to Buzzer', short: 'Buzzer' },
};

/** Every target a match of this type gets to, in the order it gets there */
const skipTargetsFor = (matchType: string): SkipTarget[] => {
  switch (matchType) {
    case 'Full Game':
      return ['teleop', 'endgame', 'end'];
    case 'Teleop':
      return ['endgame', 'end'];
    default:
      return ['end'];
  }
};

/**
 * Where Skip goes from here: TELEOP from AUTO (and controller pickup) of a
 * Full Game, ENDGAME from earlier in TELEOP, and the buzzer from ENDGAME or
 * from AUTO of an Autonomous match. Null once the match is over.
 */
const skipTargetOf = (
  matchType: string,
  matchPhase: MatchPhase,
  timer: number
): SkipTarget | null => {
  if (matchPhase === 'teleop') {
    return timer > GAME_TIMING.ENDGAME_REMAINING ? 'endgame' : 'end';
  }
  if (matchPhase === 'auton' || matchPhase === 'controller_pickup') {
    if (matchType === 'Full Game') return 'teleop';
    if (matchType === 'Autonomous' && matchPhase === 'auton') return 'end';
  }
  return null;
};

/** A press this soon after Skip changed where it goes is ignored */
const SKIP_ARM_DELAY_MS = 1000;

/**
 * Skip ahead to the next point of the match — a deliberate, between-action
 * control. One button whose target moves on with the match, so it never
 * adds a second one to the row.
 */
export const MatchExtras = () => {
  const {
    sessionData,
    isDarkMode,
    matchPhase,
    matchActive,
    editingMatchId,
    skipToTeleop,
    skipToEndgame,
    skipToEnd,
  } = useLiveControls();
  const { timer } = useSession();
  const isCompact = useCompactControls();
  const target =
    editingMatchId || !matchActive
      ? null
      : skipTargetOf(sessionData.matchType, matchPhase, timer);
  // The label changes in place under the pointer: the second tap of a
  // double tap (or a press right as ENDGAME starts) must not skip again.
  const armed = useArmed(SKIP_ARM_DELAY_MS, target);

  if (!target) return null;

  const skip = { teleop: skipToTeleop, endgame: skipToEndgame, end: skipToEnd };
  const labelOf = (t: SkipTarget) =>
    isCompact ? SKIP_LABELS[t].short : SKIP_LABELS[t].full;

  return (
    <button
      type="button"
      onKeyDown={ignoreHeldEnter}
      onClick={() => {
        if (!armed) return;
        // What comes up in its place (the next Skip, or after the buzzer the
        // hint and Save Match) must not take the second press of a double
        // tap. Skip to Buzzer also holds Save Match off for a moment.
        absorbDoubleTap();
        skip[target]();
      }}
      aria-label={SKIP_LABELS[target].full}
      className={`shrink-0 h-11 px-3 rounded-xl text-sm whitespace-nowrap ${actionClass('neutral', isDarkMode)}`}
    >
      {/* As wide as the longest label this match will show, so the row
          doesn't shift when the target moves on */}
      <span className="grid justify-items-center" aria-hidden>
        {skipTargetsFor(sessionData.matchType).map(t => (
          <span
            key={t}
            className={`col-start-1 row-start-1 flex items-center gap-2 ${t === target ? '' : 'invisible'}`}
          >
            <SkipForward className="h-4 w-4 shrink-0" />
            {labelOf(t)}
          </span>
        ))}
      </span>
    </button>
  );
};
