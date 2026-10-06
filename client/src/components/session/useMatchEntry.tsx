import { useEffect, useId, useMemo, useRef } from 'react';
import { useSessionCore } from '@/contexts';
import type { MatchScoringFields } from '@/types';
import { calculateScore } from '@/lib';
import { revealFirstStepperRow } from './controls/revealStepperRow';
import { useScoringLocks } from './useScoringLocks';

/** Why Robots and End of Match can't be filled in yet: no match is open */
const START_REASON = 'Unlocks at Start';

/**
 * Setters, locks and lock captions for the robot and end-of-match fields,
 * shared by the phone layout's MatchEntry and the desktop ScoringPad. Also
 * lights the end-of-match fields at the buzzer and brings them into view:
 * `endSectionRef` goes on whatever holds them, and its first row of
 * steppers (its first input's row) is what has to be on screen.
 */
export const useMatchEntry = () => {
  const {
    sessionData,
    updateSessionData,
    matchActive,
    matchPhase,
    isTutorialActive,
  } = useSessionCore();
  const {
    editing,
    scoring,
    entryKey,
    entryLocked,
    endOfMatchUnlocked,
    endParkLocked,
    hasAuto,
    hasTeleop,
  } = useScoringLocks();
  const robotsReasonId = useId();
  const endReasonId = useId();

  // One setter per field, each keeping its identity between renders: the
  // rows and fields below are memoized, so changing one field re-renders
  // that one alone.
  const set = useMemo(() => {
    const setter =
      <K extends keyof MatchScoringFields>(field: K) =>
      (value: MatchScoringFields[K]) =>
        updateSessionData({ [field]: value });
    return {
      robot1Leave: setter('robot1Leave'),
      robot1ParkAuto: setter('robot1ParkAuto'),
      robot1ParkTeleop: setter('robot1ParkTeleop'),
      robot2Leave: setter('robot2Leave'),
      robot2ParkAuto: setter('robot2ParkAuto'),
      robot2ParkTeleop: setter('robot2ParkTeleop'),
      flower: setter('flower'),
      flowerBonus: setter('flowerBonus'),
      ballsInHive: setter('ballsInHive'),
      garden: setter('garden'),
    };
  }, [updateSessionData]);

  const breakdown = calculateScore(scoring);

  /**
   * Flower, hive and garden contents are only knowable once play has
   * stopped, so they stay locked while the match is played (the controller
   * pickup included). They open at the buzzer (End early ends a match there
   * too) and whenever the match is paused. Before Start there is no match
   * to put them in, so they wait for it, as Hive Tips does.
   */
  const endDisabled = !endOfMatchUnlocked;

  // Before Start nothing can be scored; after it, a period the match never
  // runs can't be scored for the whole match. The phone layout leaves those
  // toggles out, so only the locks that lift on their own are shown, on the
  // Robots heading's line: short enough to fit beside it on a 320px phone.
  const autoDisabledReason = entryLocked
    ? START_REASON
    : hasAuto
      ? undefined
      : 'No Auto in a Teleop match';
  const parkTeleopDisabledReason = entryLocked
    ? START_REASON
    : !hasTeleop
      ? 'No End park in an Autonomous match'
      : endParkLocked
        ? 'End park unlocks in Teleop or on pause'
        : undefined;
  /** Why the robot toggles wait, read out beside the Robots heading */
  const robotsReason = entryLocked
    ? START_REASON
    : hasTeleop && endParkLocked
      ? parkTeleopDisabledReason
      : undefined;

  // The buzzer hands the scorer from the live counters to this section:
  // bring its first row of steppers into view unless that row is on screen
  // already ("Count them first" does the same).
  const endSectionRef = useRef<HTMLDivElement>(null);
  const lastPhaseRef = useRef(matchPhase);
  useEffect(() => {
    const previousPhase = lastPhaseRef.current;
    lastPhaseRef.current = matchPhase;
    if (matchPhase !== 'ended' || previousPhase === 'ended') return;
    if (!matchActive || editing) return;

    // The walkthrough moves the page itself.
    const section = endSectionRef.current;
    if (!section || isTutorialActive) return;
    revealFirstStepperRow(section);
  }, [matchPhase, matchActive, editing, isTutorialActive]);

  // Why the counters are locked: read out with each stepper, not shown.
  // The locked look already says it.
  const endReason = endDisabled ? (
    <span id={endReasonId} className="sr-only">
      {entryLocked ? START_REASON : 'Unlocks at the buzzer or on pause'}
    </span>
  ) : null;

  return {
    sessionData,
    set,
    breakdown,
    entryKey,
    endDisabled,
    autoDisabledReason,
    parkTeleopDisabledReason,
    robotsReason,
    robotsReasonId,
    endReasonId,
    endReason,
    endSectionRef,
    entryLocked,
    hasAuto,
    hasTeleop,
  };
};
