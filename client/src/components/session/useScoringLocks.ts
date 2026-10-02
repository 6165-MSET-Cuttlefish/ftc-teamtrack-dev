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
 * - Tipping is counted while the match runs, but not during the 3-2-1.
 * - Flower, hive and garden contents can only be judged once play has
 *   stopped: after the buzzer, or whenever the clock is paused, which is
 *   what lets a match that ends early be scored before it is saved.
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
    /** True while a live match's clock is counting AUTO or TELEOP down */
    clockRunning: !editing && matchActive && isTimerRunning && !inCountdown,
    endOfMatchUnlocked:
      editing || !matchActive || matchPhase === 'ended' || !isTimerRunning,
    /** End-of-match park can't be known while AUTO is still running. */
    endParkLocked: !editing && matchActive && matchPhase === 'auton',
    hasAuto: includesAuto(matchType),
    hasTeleop: includesTeleop(matchType),
  };
};
