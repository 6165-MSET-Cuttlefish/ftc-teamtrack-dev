import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSessionCore } from '@/contexts';
import type { MatchScoringFields } from '@/types';
import { ELEMENT_LABELS, calculateScore } from '@/lib';
import { revealFirstStepperRow } from './controls/revealStepperRow';
import { requestStartNudge } from './controls/startNudge';
import { EndNote } from './EndOfMatchParts';
import { LOCK_REASONS, useScoringLocks } from './useScoringLocks';

/** How long the End of Match heading stays lit after the buzzer */
const UNLOCK_PULSE_MS = 1600;

/**
 * Setters, locks and lock captions for the robot and end-of-match fields,
 * shared by the phone layout's MatchEntry and the desktop ScoringPad. Also
 * lights the end-of-match fields at the buzzer and brings them into view:
 * `endSectionRef` goes on whatever holds them, and its first row of
 * steppers (its first input's row) is what has to be on screen, with the
 * robot rows (`robotsRef`, where End park is marked) kept on screen too
 * wherever there is room for both.
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
    robots,
  } = useScoringLocks();
  const robotsReasonId = useId();
  const endReasonId = useId();
  const startFirstId = useId();

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

  // A period the match never runs can't be scored for the whole match; the
  // phone layout leaves those toggles out. End park waits for AUTO to end,
  // from before Start on, as the match starts with it locked. Only the locks
  // that lift on their own are said, beside the Robots heading.
  const autoDisabledReason = hasAuto ? undefined : LOCK_REASONS.noAuto;
  const parkTeleopDisabledReason = !hasTeleop
    ? LOCK_REASONS.noEndPark
    : endParkLocked
      ? LOCK_REASONS.endParkWaits
      : undefined;
  /** The note beside the Robots heading, when something waits */
  const robotsReason =
    hasTeleop && endParkLocked ? parkTeleopDisabledReason : undefined;

  /**
   * Before Start the toggles and counters the match starts with look ready
   * (nothing changes look at Start), but there is no match to put a tap in:
   * a press asks the Start button to show it is the next step, and changes
   * nothing. Their `startFirstId` text says so to a screen reader.
   */
  const blockedPress = entryLocked ? requestStartNudge : undefined;

  /**
   * The flower counters, where flowers can score: not in an Autonomous-only
   * match (no flower scores before 1:00 is left), unless a saved one has
   * some to fix.
   */
  const flowersShown =
    hasTeleop || (sessionData.flower ?? 0) + (sessionData.flowerBonus ?? 0) > 0;

  // The buzzer hands the scorer from the live counters to this section:
  // light it for a moment, and bring its first row of steppers into view
  // unless that row is on screen already ("Count them first" does the same).
  const endSectionRef = useRef<HTMLDivElement>(null);
  const robotsRef = useRef<HTMLDivElement>(null);
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
    revealFirstStepperRow(section, robotsRef.current);
  }, [matchPhase, matchActive, editing, isTutorialActive]);
  useEffect(() => {
    if (!justUnlocked) return;
    const timer = setTimeout(() => setJustUnlocked(false), UNLOCK_PULSE_MS);
    return () => clearTimeout(timer);
  }, [justUnlocked]);

  // One note over the counters in every state, as tall in each (see
  // EndNote's `reserve`), so they stay where they are when the section
  // locks and unlocks. While locked it is a filled band that says when they
  // open: at the buzzer, or on a pause (before Start too, as the match
  // starts with them locked). Once open it says the one thing left to do,
  // or for a saved match open for editing, what that is for. It stays
  // empty (but kept) for the tutorial's practice match, whose fields are
  // open and whose own card says when to count.
  const unlockNote = (
    <>
      <span className="[@container(max-width:20.95rem)]:hidden">
        Unlocks at the buzzer or when you pause
      </span>
      <span className="hidden [@container(max-width:20.95rem)]:inline">
        Unlocks at the buzzer or on pause
      </span>
    </>
  );
  const pausedNote = 'Unlocked while paused';
  // The park toggle's own name: 'Park (End)' beside 'Park (Auto)', else
  // 'Park'
  const buzzerNote =
    hasAuto && hasTeleop
      ? `Mark ${ELEMENT_LABELS.parkEnd}, count, then save`
      : `Mark ${ELEMENT_LABELS.park}, count, then save`;
  const editingNote = 'Fix any count, then save';
  const notes = [unlockNote, pausedNote, buzzerNote, editingNote];
  const note = (current: number, locked: boolean) => (
    <EndNote
      id={locked ? endReasonId : undefined}
      locked={locked}
      reserve={notes.filter((_, i) => i !== current)}
    >
      {notes[current]}
    </EndNote>
  );
  const endCaption = endDisabled
    ? note(0, true)
    : isTutorialActive
      ? undefined
      : editing
        ? note(3, false)
        : note(matchPhase !== 'ended' ? 1 : 2, false);

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
    robotsRef,
    entryLocked,
    blockedPress,
    startFirstId,
    hasAuto,
    hasTeleop,
    robots,
    flowersShown,
  };
};
