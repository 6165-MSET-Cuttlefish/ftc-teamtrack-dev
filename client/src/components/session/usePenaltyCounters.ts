import { useCallback, useState } from 'react';
import { useSessionCore } from '@/contexts';
import { requestStartNudge } from './controls/startNudge';
import { useScoringLocks } from './useScoringLocks';

/**
 * Handlers for the two foul counters, shared by the phone's MatchEntry and
 * the desktop ScoringPad. Fouls are credited to the opponent (MINOR 5, MAJOR
 * 20) and never come off this alliance's score.
 *
 * They are counted in a Scrim, and wherever the match in the fields has
 * some (a saved Scrim match opened after the session was switched to
 * Practice), so what was counted can always be seen and fixed (`shown`).
 * Taken back to 0 there, they stay until another match is in the fields:
 * the counters don't vanish from under the finger, and a tap too many can
 * be put back.
 *
 * Like the robots and Hive Tips, they look ready before Start but wait for
 * it: there is no match to count them in yet, so a press asks for Start
 * (`blockedPress`). A saved match opened for editing and the walkthrough's
 * practice match keep them open.
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

  const minor = sessionData.minorPenalties;
  const major = sessionData.majorPenalties;
  const hasFouls = (minor ?? 0) + (major ?? 0) > 0;
  /** The match in the fields (`entryKey`) that has had fouls in it */
  const [heldFor, setHeldFor] = useState<string | null>(null);
  if (hasFouls && heldFor !== entryKey) setHeldFor(entryKey);

  return {
    minor,
    major,
    shown:
      sessionData.sessionType === 'Scrim' || hasFouls || heldFor === entryKey,
    entryKey,
    blockedPress: entryLocked ? requestStartNudge : undefined,
    handleMinorPenalties,
    handleMajorPenalties,
  };
};
