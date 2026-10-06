import { useSessionCore } from '@/contexts';
import { includesAuto, includesTeleop, liveMatchType } from '@/lib';

/**
 * Which scoring inputs on /active are open right now.
 *
 * One rule for every field, so the live counters, Match Entry and the
 * breakdown can't disagree:
 *
 * - A saved match opened from the Match Log is final, so nothing about the
 *   clock locks it — not even a later match running underneath it.
 * - Nothing is entered before Start: no match is open to hold it.
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
    matchType,
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
     * Robots, End of Match and Scrim penalties wait for Start like Hive Tips
     * do ('Unlocks at Start'): no match is open to put them in. A saved match
     * opened for editing, and the walkthrough's practice match, keep them
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
     * opens it, as it opens the End of Match counts.
     */
    endParkLocked:
      !editing && matchActive && matchPhase === 'auton' && isTimerRunning,
    hasAuto: includesAuto(matchType),
    hasTeleop: includesTeleop(matchType),
  };
};
