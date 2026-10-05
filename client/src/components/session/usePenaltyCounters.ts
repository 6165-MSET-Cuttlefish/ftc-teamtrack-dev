import { useCallback } from 'react';
import { useSessionCore } from '@/contexts';
import { useScoringLocks } from './useScoringLocks';

/** Why the penalty counters can't be used yet, wherever they show it */
export const PENALTIES_LOCKED_REASON = 'Unlocks at Start';

/**
 * Handlers for the two penalty counters, shared by the phone's MatchEntry
 * and the desktop ScoringPad. Penalties are credited to the opponent (MINOR 5, MAJOR
 * 20) and never come off this alliance's score.
 *
 * Like the robots and Hive Tips, they wait for Start: before it there is no
 * match to count them in (`locked`). A saved match opened for editing and
 * the walkthrough's practice match keep them open.
 */
export const usePenaltyCounters = () => {
  const { sessionData, updateSessionData } = useSessionCore();
  const { entryKey, entryLocked } = useScoringLocks();

  // ScoreField is memoized: handlers that keep their identity mean a tap on
  // one counter re-renders that counter only.
  const handleMinorPenalties = useCallback(
    (value: number) => updateSessionData({ minorPenalties: value }),
    [updateSessionData]
  );
  const handleMajorPenalties = useCallback(
    (value: number) => updateSessionData({ majorPenalties: value }),
    [updateSessionData]
  );

  return {
    minor: sessionData.minorPenalties,
    major: sessionData.majorPenalties,
    entryKey,
    locked: entryLocked,
    handleMinorPenalties,
    handleMajorPenalties,
  };
};
