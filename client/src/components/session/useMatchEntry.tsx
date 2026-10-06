import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSessionCore } from '@/contexts';
import type { MatchScoringFields } from '@/types';
import { calculateScore } from '@/lib';
import { revealFirstStepperRow } from './controls/revealStepperRow';
import { SectionNote } from './SectionNote';
import { useScoringLocks } from './useScoringLocks';

/** How long the End of Match heading stays lit after the buzzer */
const UNLOCK_PULSE_MS = 1600;

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
        ? 'End park unlocks in Teleop'
        : undefined;
  /** The visible note beside the Robots heading, when something waits */
  const robotsReason = entryLocked
    ? START_REASON
    : hasTeleop && endParkLocked
      ? parkTeleopDisabledReason
      : undefined;

  // The buzzer hands the scorer from the live counters to this section:
  // light it for a moment, and bring its first row of steppers into view
  // unless that row is on screen already ("Count them first" does the same).
  const endSectionRef = useRef<HTMLDivElement>(null);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const lastPhaseRef = useRef(matchPhase);
  useEffect(() => {
    const previousPhase = lastPhaseRef.current;
    lastPhaseRef.current = matchPhase;
    if (matchPhase !== 'ended' || previousPhase === 'ended') return;
    if (!matchActive || editing) return;
    setJustUnlocked(true);

    // The walkthrough moves the page itself.
    const section = endSectionRef.current;
    if (!section || isTutorialActive) return;
    revealFirstStepperRow(section);
  }, [matchPhase, matchActive, editing, isTutorialActive]);
  useEffect(() => {
    if (!justUnlocked) return;
    const timer = setTimeout(() => setJustUnlocked(false), UNLOCK_PULSE_MS);
    return () => clearTimeout(timer);
  }, [justUnlocked]);

  // One line under the heading in every state, so the fields below it stay
  // where they are when the section locks and unlocks: what it waits for
  // while a match is played, and after the buzzer the one thing left to do.
  // Its line stays empty (but kept) for a saved match open for editing, and
  // for the tutorial's practice match, whose fields are open and whose own
  // card says when to count. Before Start every field on the page waits for
  // Start, the one filled button, and the locked look says so: 'Unlocks at
  // Start' is read out, not shown. Between matches the line says how to fix
  // a saved match.
  const hasSavedMatches = (sessionData.matches?.length ?? 0) > 0;
  const endCaption = endDisabled ? (
    <SectionNote
      id={endReasonId}
      icon="locked"
      visuallyHidden={entryLocked && !hasSavedMatches}
    >
      {entryLocked ? (
        hasSavedMatches ? (
          // One line in every column: the shorter pointer where the longer
          // would wrap (a column under 336px, from a 360px phone down).
          <>
            <span className="sr-only">{START_REASON}. </span>
            <span className="[@container(max-width:20.95rem)]:hidden">
              Tap a match in the Match Log to fix it.
            </span>
            <span className="hidden [@container(max-width:20.95rem)]:inline">
              Tap a saved match to fix it.
            </span>
          </>
        ) : (
          START_REASON
        )
      ) : (
        'Unlocks at the buzzer, or when you pause'
      )}
    </SectionNote>
  ) : editing || isTutorialActive ? undefined : (
    <SectionNote icon="unlocked">
      {matchPhase !== 'ended'
        ? 'Unlocked while paused'
        : // The park toggle's own name: 'End' beside 'Auto', else 'Park'
          hasAuto && hasTeleop
          ? 'Mark End park, count, then save'
          : 'Mark Park, count, then save'}
    </SectionNote>
  );

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
    endCaption,
    justUnlocked,
    endSectionRef,
    entryLocked,
    hasAuto,
    hasTeleop,
  };
};
