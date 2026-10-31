import { useSessionCore } from '@/contexts';
import type { MatchScoringFields } from '@/types';
import {
  ELEMENT_LABELS,
  includesAuto,
  includesTeleop,
  liveMatchType,
} from '@/lib';
import { robotsOf } from '@/lib/scoring';

/**
 * Why a field that looks ready before Start takes nothing yet, read out
 * with it: the words the Start button shows when such a field is pressed
 */
export const START_FIRST = 'Press Start first';

/**
 * Why a robot toggle can't be scored, in the same words on the phone and
 * the desktop pad (and for the Add/Edit Match dialog to say too), with
 * each park toggle called by its own name.
 */
export const LOCK_REASONS = {
  /** A Teleop match has no AUTO */
  noAuto: `No ${ELEMENT_LABELS.leave} or ${ELEMENT_LABELS.parkAuto} in a Teleop match`,
  /** An Autonomous match has no end of TELEOP */
  noEndPark: `No ${ELEMENT_LABELS.parkEnd} in an Autonomous match`,
  /** The same, where its flower counters are left out too */
  noEndParkOrFlowers: `No ${ELEMENT_LABELS.parkEnd} or flowers in an Autonomous match`,
  /** The same, where every end-of-match counter is left out */
  noEndParkOrCounts: `No ${ELEMENT_LABELS.parkEnd}, flowers, ${ELEMENT_LABELS.hive} or ${ELEMENT_LABELS.garden} in an Autonomous match`,
  /** During AUTO (and before Start, as the match starts in AUTO) */
  endParkWaits: `Pause or wait for Teleop to score ${ELEMENT_LABELS.parkEnd}`,
} as const;

/** The end-of-match counters in their pairs, as they are laid out */
const COUNTER_PAIRS = {
  flowers: ['flower', 'flowerBonus'],
  hiveGarden: ['ballsInHive', 'garden'],
} as const;

/** Which pairs of end-of-match counters a match shows */
export interface CountersShown {
  /** Owned flower pieces and Flower nectar at bottom */
  flowers: boolean;
  /** Left in Hive and Garden */
  hiveGarden: boolean;
}

/**
 * The end-of-match counters a match has, a pair at a time. AUTO scores none
 * of them, so an Autonomous-only match leaves them out, unless one of
 * `counted` (the match as saved, the counts in the fields) has some of a
 * pair: those stay, to be seen and fixed, as nothing counted is ever hidden.
 */
export const countersShown = (
  hasTeleop: boolean,
  ...counted: Array<Partial<MatchScoringFields> | undefined>
): CountersShown => {
  const shown = (keys: readonly (keyof MatchScoringFields)[]) =>
    hasTeleop ||
    counted.some(fields => keys.some(key => Number(fields?.[key] ?? 0) > 0));
  return {
    flowers: shown(COUNTER_PAIRS.flowers),
    hiveGarden: shown(COUNTER_PAIRS.hiveGarden),
  };
};

/** What an Autonomous match leaves out, said once over its robot rows */
export const autonomousNote = (shown: CountersShown): string =>
  !shown.flowers && !shown.hiveGarden
    ? LOCK_REASONS.noEndParkOrCounts
    : !shown.flowers
      ? LOCK_REASONS.noEndParkOrFlowers
      : LOCK_REASONS.noEndPark;

/**
 * Which scoring inputs on /active are open right now.
 *
 * One rule for every field, so the live counters, Match Entry and the
 * breakdown can't disagree:
 *
 * - A saved match opened from the Match Log is final, so nothing about the
 *   clock locks it — not even a later match running underneath it.
 * - Nothing is entered before Start: no match is open to hold it. What the
 *   match starts with still looks as it will at Start (Hive Tips, Leave,
 *   Park (Auto), a Scrim's fouls): only what its first period locks is
 *   locked, so nothing changes look at Start, and a press on the rest asks
 *   for Start instead (see `startNudge`).
 * - Tipping is counted while the match runs, but not during the 3-2-1.
 * - Flower, hive and garden contents can only be judged once play has
 *   stopped: after the buzzer (End early ends a match there too), or
 *   whenever the clock is paused. The controller pickup is play, not a
 *   stop, unless it is paused.
 * - A period the match type doesn't run can't be scored at all.
 *
 * Reads the session without its clocks, so the fields it gates are not
 * re-rendered every second.
 */
export const useScoringLocks = () => {
  const {
    sessionData,
    editingMatchId,
    matchActive,
    matchPhase,
    isTimerRunning,
    isPickupPaused,
    isMatchCountdown,
    isTutorialActive,
    sessionEpoch,
  } = useSessionCore();

  const editing = editingMatchId !== null;

  /** The type of the match in the fields: the saved one while editing. */
  const matchType = liveMatchType(sessionData, editingMatchId);
  const hasAuto = includesAuto(matchType);

  /**
   * The robots the fields have rows for: the session's count, or while a
   * saved match is open, the one it was played with (2 for a match saved
   * before the count existed).
   */
  const edited = editing
    ? sessionData.matches?.find(m => m.id === editingMatchId)
    : undefined;
  const robots = robotsOf({
    ...sessionData,
    robotCount: edited ? edited.robotCount : sessionData.robotCount,
  });

  // The walkthrough holds a match open without starting its clock, which
  // would otherwise look like a countdown that never ends.
  const inCountdown =
    matchActive &&
    !isTutorialActive &&
    sessionData.matchType === 'Full Game' &&
    isMatchCountdown;

  const entryLocked = !editing && !matchActive && !isTutorialActive;

  return {
    editing,
    /** The saved match open for editing, as it was saved */
    edited,
    matchType,
    robots,
    /** The fields being scored, tagged with the match type they belong to */
    scoring: { ...sessionData, matchType },
    /**
     * Names the match the fields hold right now. It changes whenever they
     * are handed a different one — a match started, saved or cancelled, a
     * saved match opened or closed, a new session, the walkthrough opening
     * or rolling back — which is when a half-typed number stops belonging
     * to them.
     */
    entryKey: [
      sessionEpoch,
      sessionData.matches?.length ?? 0,
      editingMatchId ?? '',
      matchActive,
      isTutorialActive,
    ].join(':'),
    tippingEnabled: editing || (matchActive && !inCountdown),
    /**
     * No match is open in the fields: before the first Start and between
     * matches.
     */
    awaitingStart: !editing && !matchActive,
    /**
     * No match is open to put anything in (before Start and between
     * matches): every field waits for Start. Those the match starts with
     * look ready all the same, and a press on one asks for Start; End park
     * and End of Match keep the lock their first period gives them. A saved
     * match opened for editing, and the walkthrough's practice match, are
     * open.
     */
    entryLocked,
    /** The 3-2-1 before a Full Game's AUTO: Start is pressed, play isn't on */
    inCountdown,
    /**
     * The live match is being played: tips are counted by tapping, so the
     * count is a readout rather than a text box. Controller pickup belongs
     * to play — the clock stops for it, but nobody has paused. Typing comes
     * back when the match is paused, after the buzzer and for a saved match.
     */
    tippingLive:
      !editing &&
      matchActive &&
      !inCountdown &&
      matchPhase !== 'ended' &&
      (isTimerRunning ||
        (matchPhase === 'controller_pickup' && !isPickupPaused)),
    /** True while a live match's clock is counting AUTO or TELEOP down */
    clockRunning: !editing && matchActive && isTimerRunning && !inCountdown,
    /**
     * Flower, hive and garden counts, once play has stopped: the buzzer, or a
     * pause. The 8 s controller pickup stops the clock but not play, so it
     * keeps them locked unless it is paused too. Before Start they wait with
     * everything else (`entryLocked`).
     */
    endOfMatchUnlocked:
      !entryLocked &&
      (editing ||
        !matchActive ||
        matchPhase === 'ended' ||
        (matchPhase === 'controller_pickup'
          ? isPickupPaused
          : !isTimerRunning)),
    /**
     * End-of-match park can't be known while AUTO is still running; a pause
     * opens it, as it opens the End of Match counts. Before Start it has
     * the lock the match will start with: AUTO's, where there is one.
     */
    endParkLocked:
      (entryLocked && hasAuto) ||
      (!editing && matchActive && matchPhase === 'auton' && isTimerRunning),
    hasAuto,
    hasTeleop: includesTeleop(matchType),
  };
};
