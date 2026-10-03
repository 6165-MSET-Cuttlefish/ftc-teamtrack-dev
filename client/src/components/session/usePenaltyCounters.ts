import { useCallback } from 'react';
import { useSessionCore } from '@/contexts';
import { useScoringLocks } from './useScoringLocks';

/**
 * Handlers for the two fouls counters, shared by PenaltyCounters and the
 * desktop ScoringPad. Fouls are credited to the opponent (MINOR 5, MAJOR
 * 20) and never come off this alliance's score.
 */
export const usePenaltyCounters = () => {
  const { sessionData, updateSessionData } = useSessionCore();
  const { entryKey } = useScoringLocks();

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
    handleMinorPenalties,
    handleMajorPenalties,
  };
};
